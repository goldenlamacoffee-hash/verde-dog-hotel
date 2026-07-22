import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // supabaseResponse is reassigned inside setAll — capture it by reference
  // using a container so every return path can copy the latest cookies.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to request so downstream server code can read them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // Rebuild the pass-through response with the refreshed cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: getUser() may call setAll() to refresh the session token.
  // After this call, supabaseResponse holds the authoritative cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // /admin/login must NEVER be protected — always pass through with cookies
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return supabaseResponse
  }

  // All other /admin/* routes require an authenticated user.
  // CRITICAL: copy the Supabase session cookies from supabaseResponse onto
  // the redirect response, otherwise the browser drops the token and the
  // user is logged out immediately after the first /admin request.
  if (pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.delete('next')
    url.searchParams.set('next', pathname)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}
