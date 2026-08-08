import { describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  originAllowed,
  readTokens,
  setSessionCookies,
} from '../cookies';

const request = (init: { method?: string; origin?: string; cookie?: string } = {}) =>
  new NextRequest('http://localhost:3000/api/proxy/v1/codes', {
    method: init.method ?? 'GET',
    headers: {
      ...(init.origin === undefined ? {} : { origin: init.origin }),
      ...(init.cookie === undefined ? {} : { cookie: init.cookie }),
    },
  });

describe('session cookies', () => {
  it('marks both httpOnly, so an XSS cannot read them', () => {
    const response = NextResponse.json({});
    setSessionCookies(response, { access_token: 'a', refresh_token: 'r' });

    expect(response.cookies.get(ACCESS_COOKIE)?.httpOnly).toBe(true);
    expect(response.cookies.get(REFRESH_COOKIE)?.httpOnly).toBe(true);
  });

  it('uses SameSite=Lax on both', () => {
    const response = NextResponse.json({});
    setSessionCookies(response, { access_token: 'a', refresh_token: 'r' });
    expect(response.cookies.get(ACCESS_COOKIE)?.sameSite).toBe('lax');
    expect(response.cookies.get(REFRESH_COOKIE)?.sameSite).toBe('lax');
  });

  it('gives the access cookie no maxAge', () => {
    // Its real lifetime is the 15 minutes the JWT enforces server-side. A
    // longer cookie would just keep a dead token around.
    const response = NextResponse.json({});
    setSessionCookies(response, { access_token: 'a', refresh_token: 'r' });

    expect(response.cookies.get(ACCESS_COOKIE)?.maxAge).toBeUndefined();
    expect(response.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('clears both on logout', () => {
    const response = NextResponse.json({});
    clearSessionCookies(response);
    expect(response.cookies.get(ACCESS_COOKIE)?.maxAge).toBe(0);
    expect(response.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
  });

  it('reads tokens back, and omits empty ones', () => {
    expect(readTokens(request({ cookie: `${ACCESS_COOKIE}=a; ${REFRESH_COOKIE}=r` }))).toEqual({
      access: 'a',
      refresh: 'r',
    });
    expect(readTokens(request({ cookie: `${ACCESS_COOKIE}=` }))).toEqual({});
    expect(readTokens(request())).toEqual({});
  });
});

describe('origin checks', () => {
  it('allows reads regardless of origin', () => {
    expect(originAllowed(request({ origin: 'https://evil.example' }))).toBe(true);
  });

  it('rejects a cross-site write', () => {
    // SameSite=Lax is a browser behaviour, not a guarantee. This is
    // server-side and costs nothing.
    expect(originAllowed(request({ method: 'POST', origin: 'https://evil.example' }))).toBe(false);
  });

  it('allows a same-origin write', () => {
    expect(originAllowed(request({ method: 'POST', origin: 'http://localhost:3000' }))).toBe(true);
  });

  it('allows a write with no Origin header at all', () => {
    // Non-browser callers and some same-origin navigations omit it entirely;
    // rejecting those would break curl and server-side rendering for nothing.
    expect(originAllowed(request({ method: 'POST' }))).toBe(true);
  });
});
