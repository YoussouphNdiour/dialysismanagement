import { auth } from '@/server/auth';
import { canAccess, type UserRole } from '@/lib/permissions';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to login
  if (!req.auth?.user) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role as UserRole;

  // Patient role → force to portail
  if (role === 'patient' && !pathname.startsWith('/portail') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/portail', req.nextUrl.origin));
  }

  // Backend roles → block portail access
  if (role !== 'patient' && pathname.startsWith('/portail')) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  // Check route permissions
  if (!canAccess(role, pathname)) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
