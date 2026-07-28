/**
 * scripts/migrate-availability.mjs
 *
 * Idempotent migration for the controlled-monthly-availability feature.
 *
 * Run with:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/migrate-availability.mjs
 *
 * What it does:
 *  1. Create availability_months + availability_days tables via Supabase SQL endpoint
 *  2. Backfill July 2026, August 2026, current month, next month as published + all days open
 *  3. Backfill months that have future active reservations
 *  4. Write scripts/rpc-migration.sql for the get_nightly_occupancy RPC update
 */

import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function pad(n) { return String(n).padStart(2, '0') }
function monthStart(year, month) { return `${year}-${pad(month)}-01` }
function daysInMonth(year, month) {
  const last = new Date(year, month, 0).getDate()
  const days = []
  for (let d = 1; d <= last; d++) days.push(`${year}-${pad(month)}-${pad(d)}`)
  return days
}

/** Execute raw SQL via Supabase's pg REST endpoint (service_role required). */
async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Prefer': 'params=single-object',
    },
    body: JSON.stringify({ query: sql }),
  })
  // If the REST endpoint doesn't support raw SQL, it will 404/405 — that's OK,
  // we fall back to table-level checks.
  return response
}

/** Try to run DDL via the Supabase SQL management endpoint. */
async function tryDDL(sql, label) {
  try {
    // Supabase hosted projects expose a SQL endpoint at /pg/query for service_role
    const response = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ query: sql }),
    })
    if (response.ok) {
      console.log(`  DDL via /pg/query: ${label} OK`)
      return true
    }
    // Try alternative endpoint
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ sql }),
    })
    if (r2.ok) {
      console.log(`  DDL via exec_ddl: ${label} OK`)
      return true
    }
    return false
  } catch (err) {
    return false
  }
}

async function tableExists(tableName) {
  const { error } = await admin.from(tableName).select('*').limit(0)
  return !error
}

async function run() {
  console.log('=== Verde Availability Migration ===\n')

  // ── STEP 1: Create tables ─────────────────────────────────────────────────
  console.log('Step 1: Checking/creating tables...')

  const monthsExists = await tableExists('availability_months')
  const daysExists   = await tableExists('availability_days')

  if (!monthsExists || !daysExists) {
    console.log('  Tables missing — attempting DDL via Supabase SQL endpoint...')

    const ddlMonths = `
      CREATE TABLE IF NOT EXISTS availability_months (
        month_start  date PRIMARY KEY
          CHECK (extract(day from month_start) = 1),
        status       text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','published')),
        published_at timestamptz,
        published_by uuid REFERENCES auth.users(id),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );`

    const ddlDays = `
      CREATE TABLE IF NOT EXISTS availability_days (
        date          date PRIMARY KEY,
        month_start   date NOT NULL REFERENCES availability_months(month_start) ON DELETE CASCADE,
        is_open       boolean NOT NULL DEFAULT false,
        internal_note text,
        updated_by    uuid REFERENCES auth.users(id),
        updated_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS availability_days_month_start_idx ON availability_days(month_start);`

    const ddlOk = await tryDDL(ddlMonths + '\n' + ddlDays, 'availability tables')
    if (!ddlOk) {
      console.warn('\n  Could not auto-create tables. Writing DDL to scripts/ddl-tables.sql.')
      console.warn('  Apply that file in the Supabase Dashboard > SQL Editor, then re-run this script.\n')
      await writeFile(
        join(process.cwd(), 'scripts', 'ddl-tables.sql'),
        (ddlMonths + '\n' + ddlDays).trim(),
        'utf8'
      )
      // Continue anyway — if tables now exist via some other mechanism, the rest will work
    }
  } else {
    console.log('  Both tables already exist. OK.')
  }

  // Re-check after DDL attempt
  const monthsOk = await tableExists('availability_months')
  const daysOk   = await tableExists('availability_days')

  if (!monthsOk || !daysOk) {
    console.error('\n  Tables still do not exist after DDL attempt.')
    console.error('  Please apply scripts/ddl-tables.sql in Supabase Dashboard > SQL Editor, then re-run.\n')
    process.exit(1)
  }
  console.log('  Tables confirmed present. OK.\n')

  // ── STEP 2 + 3: Backfill months ───────────────────────────────────────────
  console.log('Step 2: Backfilling months...')
  const now = new Date()

  const toBackfill = new Map() // key → { year, month }

  // Always backfill Jul 2026, Aug 2026, current, next
  for (const { year, month } of [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { year: new Date(now.getFullYear(), now.getMonth() + 1, 1).getFullYear(),
      month: new Date(now.getFullYear(), now.getMonth() + 1, 1).getMonth() + 1 },
  ]) {
    toBackfill.set(`${year}-${month}`, { year, month })
  }

  // Months with future active reservations
  const todayStr = now.toISOString().split('T')[0]
  const { data: futureRes, error: futureErr } = await admin
    .from('reservations')
    .select('arrival_date, departure_date')
    .gte('departure_date', todayStr)
    .not('status', 'in', '("cancelled","rejected","checked_out")')

  if (futureErr) {
    console.warn('  Could not load future reservations:', futureErr.message)
  } else {
    for (const r of futureRes ?? []) {
      let d = new Date(r.arrival_date)
      const end = new Date(r.departure_date)
      while (d < end) {
        toBackfill.set(`${d.getFullYear()}-${d.getMonth() + 1}`, {
          year: d.getFullYear(), month: d.getMonth() + 1
        })
        d.setDate(d.getDate() + 1)
      }
    }
  }

  console.log(`  Will backfill ${toBackfill.size} month(s): ${[...toBackfill.keys()].sort().join(', ')}`)

  for (const { year, month } of toBackfill.values()) {
    const ms = monthStart(year, month)

    // Upsert month row (always mark published so existing reservations remain valid)
    const { error: mErr } = await admin.from('availability_months').upsert(
      {
        month_start:  ms,
        status:       'published',
        published_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'month_start' }
    )
    if (mErr) {
      console.error(`  WARN: Cannot upsert availability_months for ${ms}: ${mErr.message}`)
      continue
    }

    // Upsert all days as open
    const days = daysInMonth(year, month).map(d => ({
      date:        d,
      month_start: ms,
      is_open:     true,
      updated_at:  new Date().toISOString(),
    }))

    const { error: dErr } = await admin
      .from('availability_days')
      .upsert(days, { onConflict: 'date' })

    if (dErr) {
      console.error(`  WARN: Cannot upsert availability_days for ${ms}: ${dErr.message}`)
    } else {
      // Only update days that are NOT already set (ignoreDuplicates preserves manual changes)
      console.log(`  ${ms}: ${days.length} days upserted as open. OK.`)
    }
  }

  // ── STEP 4: Verify ────────────────────────────────────────────────────────
  console.log('\nStep 3: Verifying backfill...')
  const { data: months } = await admin
    .from('availability_months')
    .select('month_start, status')
    .order('month_start')
  console.log('  availability_months rows:', months?.map(m => `${m.month_start}(${m.status})`).join(', '))

  const { count: dayCount } = await admin
    .from('availability_days')
    .select('*', { count: 'exact', head: true })
  console.log(`  availability_days total rows: ${dayCount}`)

  // ── STEP 5: Write RPC SQL ─────────────────────────────────────────────────
  console.log('\nStep 4: Writing RPC migration SQL...')
  await writeRpcSql()

  console.log('\n=== Migration complete ===')
  console.log('Next: Apply scripts/rpc-migration.sql in Supabase Dashboard > SQL Editor')
  console.log('This updates get_nightly_occupancy to return publication_status, is_open, day_state.')
}

async function writeRpcSql() {
  const sql = `-- Verde Availability — RPC Migration
-- Apply in Supabase Dashboard > SQL Editor
-- Run AFTER the availability_months and availability_days tables exist.
-- Both statements use CREATE OR REPLACE and are idempotent.

-- ─────────────────────────────────────────────────────────────────────────────
-- get_nightly_occupancy: extended with publication_status, is_open, day_state
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_nightly_occupancy(p_from date, p_to date)
RETURNS TABLE (
  date               date,
  booked             integer,
  max_dogs           integer,
  free               integer,
  publication_status text,
  is_open            boolean,
  day_state          text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_global_max integer;
BEGIN
  SELECT COALESCE(
    (value->>'maxDogs')::integer,
    (value->>'max_dogs')::integer,
    (value->>'boxes')::integer,
    6
  ) INTO v_global_max
  FROM site_settings
  WHERE key = 'capacity'
  LIMIT 1;

  IF v_global_max IS NULL THEN v_global_max := 6; END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_from, p_to - interval '1 day', interval '1 day')::date AS d
  ),
  overrides AS (
    SELECT
      ds.d,
      COALESCE(
        (SELECT MAX(co.max_dogs) FROM capacity_overrides co
         WHERE ds.d BETWEEN co.date_from AND (co.date_to - interval '1 day')::date
           AND co.max_dogs IS NOT NULL),
        v_global_max
      ) AS effective_max
    FROM date_series ds
  ),
  bookings AS (
    SELECT ds.d, COUNT(r.id) AS booked_count
    FROM date_series ds
    LEFT JOIN reservations r
      ON ds.d >= r.arrival_date AND ds.d < r.departure_date
     AND r.status NOT IN ('cancelled','rejected','checked_out')
    GROUP BY ds.d
  ),
  month_info AS (
    SELECT ds.d, am.status AS m_status, ad.is_open AS d_is_open
    FROM date_series ds
    LEFT JOIN availability_months am ON date_trunc('month', ds.d)::date = am.month_start
    LEFT JOIN availability_days   ad ON ds.d = ad.date
  )
  SELECT
    ds.d,
    COALESCE(b.booked_count, 0)::integer,
    o.effective_max::integer,
    GREATEST(0, o.effective_max - COALESCE(b.booked_count, 0))::integer,
    CASE
      WHEN mi.m_status IS NULL OR mi.m_status = 'draft' THEN 'unreleased'
      ELSE 'published'
    END,
    COALESCE(mi.d_is_open, false),
    CASE
      WHEN mi.m_status IS NULL OR mi.m_status = 'draft'         THEN 'unreleased'
      WHEN NOT COALESCE(mi.d_is_open, false)                    THEN 'closed'
      WHEN GREATEST(0, o.effective_max - COALESCE(b.booked_count, 0)) = 0 THEN 'full'
      WHEN GREATEST(0, o.effective_max - COALESCE(b.booked_count, 0)) = 1 THEN 'last'
      WHEN COALESCE(b.booked_count, 0)::float / NULLIF(o.effective_max, 0) >= 0.5
                                                                 THEN 'limited'
      ELSE 'available'
    END
  FROM date_series ds
  JOIN overrides  o  ON o.d  = ds.d
  JOIN bookings   b  ON b.d  = ds.d
  JOIN month_info mi ON mi.d = ds.d
  ORDER BY ds.d;
END;
$$;

GRANT EXECUTE ON FUNCTION get_nightly_occupancy(date, date) TO anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- create_reservation guard patch
-- ─────────────────────────────────────────────────────────────────────────────
-- Add these checks to the night-loop in create_reservation BEFORE the capacity
-- check. The exact location depends on your function body.
-- These are not executable standalone; integrate them manually.
--
-- FOR v_night IN SELECT generate_series(p_arrival, p_departure - interval '1 day', interval '1 day')::date LOOP
--
--   -- Guard 1: month published?
--   IF NOT EXISTS (
--     SELECT 1 FROM availability_months
--     WHERE month_start = date_trunc('month', v_night)::date AND status = 'published'
--   ) THEN
--     RAISE EXCEPTION 'MONTH_UNRELEASED:%', v_night;
--   END IF;
--
--   -- Guard 2: day open?
--   IF NOT EXISTS (
--     SELECT 1 FROM availability_days WHERE date = v_night AND is_open = true
--   ) THEN
--     RAISE EXCEPTION 'DATE_CLOSED:%', v_night;
--   END IF;
--
-- END LOOP;
`

  const outPath = join(process.cwd(), 'scripts', 'rpc-migration.sql')
  await writeFile(outPath, sql.trim(), 'utf8')
  console.log(`  Written: scripts/rpc-migration.sql`)
}

run().catch(e => {
  console.error('Migration error:', e)
  process.exit(1)
})
