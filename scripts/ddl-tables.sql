CREATE TABLE IF NOT EXISTS availability_months (
        month_start  date PRIMARY KEY
          CHECK (extract(day from month_start) = 1),
        status       text NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','published')),
        published_at timestamptz,
        published_by uuid REFERENCES auth.users(id),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS availability_days (
        date          date PRIMARY KEY,
        month_start   date NOT NULL REFERENCES availability_months(month_start) ON DELETE CASCADE,
        is_open       boolean NOT NULL DEFAULT false,
        internal_note text,
        updated_by    uuid REFERENCES auth.users(id),
        updated_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS availability_days_month_start_idx ON availability_days(month_start);