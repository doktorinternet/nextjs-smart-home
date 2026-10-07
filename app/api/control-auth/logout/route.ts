import { NextResponse } from 'next/server';
import { getControlSessionCookieOptions } from '@/app/lib/control-auth';

export async function POST() {
  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
  response.cookies.set({
    ...getControlSessionCookieOptions(),
    value: '',
    maxAge: 0,
  });
  return response;
}
