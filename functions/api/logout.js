/**
 * POST /api/logout —— 清除会话 Cookie
 */

const COOKIE = 'ma_admin';

export async function onRequestPost(context) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    }
  });
}

export async function onRequestGet(context) {
  return Response.redirect(new URL('/admin-login.html', new URL(context.request.url).origin).toString(), 302);
}
