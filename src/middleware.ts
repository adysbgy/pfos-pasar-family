// Middleware — proteksi route berdasarkan session cookie (BERTANDA TANGAN)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rute publik yang tidak butuh login
  const isLoginPage = pathname === '/app/login'
  const isApiAuth   = pathname.startsWith('/api/auth')
  const isApiUsers  = pathname === '/api/users'
  const isPublic    = isLoginPage || isApiAuth || isApiUsers

  // Baca + VERIFIKASI session (tanda tangan + expiry)
  const session = await getSessionFromRequest(request)

  // Sudah login → jangan bisa akses /app/login lagi
  if (isLoginPage && session) {
    const role = session.primaryRole
    const dest =
      role === 'kitchen'         ? '/app/kitchen'  :
      role === 'kasir'           ? '/app/pos'       :
      role === 'qa_checker'      ? '/app/qa'        :
      role === 'supervisor'      ? '/app/qa'        :
      '/app/dashboard'

    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Belum login → paksa ke login page
  if (!isPublic && !session) {
    const loginUrl = new URL('/app/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Jalankan middleware di semua rute /app/* dan /api/* kecuali static files
  matcher: [
    '/app/:path*',
    '/api/((?!auth).*)',
  ],
}
