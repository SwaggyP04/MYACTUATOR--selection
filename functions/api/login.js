/**
 * POST /api/login
 * 校验用户名密码，通过后下发 HMAC 签名的会话 Cookie
 *
 * 环境变量：ADMIN_USER、ADMIN_PASS、ADMIN_SESSION_HOURS（可选，默认 12）
 */

const COOKIE = 'ma_admin';

function b64urlEncode(buf) {
  const arr = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64urlEncode(sig);
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_USER || !env.ADMIN_PASS) {
    return json({ ok: false, error: '后台未配置访问凭证（ADMIN_USER / ADMIN_PASS）' }, 503);
  }

  let body = {};
  try {
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      body = await request.json();
    } else {
      const fd = await request.formData();
      body = { user: fd.get('user'), pass: fd.get('pass'), next: fd.get('next') };
    }
  } catch (e) {
    return json({ ok: false, error: '请求格式错误' }, 400);
  }

  const user = String(body.user || '');
  const pass = String(body.pass || '');

  // 简单的暴力破解延迟
  await new Promise(r => setTimeout(r, 300));

  if (!safeEqual(user, env.ADMIN_USER) || !safeEqual(pass, env.ADMIN_PASS)) {
    return json({ ok: false, error: '用户名或密码错误' }, 401);
  }

  const hours = Number(env.ADMIN_SESSION_HOURS) > 0 ? Number(env.ADMIN_SESSION_HOURS) : 12;
  const ttl = Math.floor(hours * 3600);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const token = exp + '.' + await hmacHex(env.ADMIN_PASS, String(exp));

  const cookie = [
    COOKIE + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + ttl
  ].join('; ');

  // 只允许跳回站内路径，避免开放重定向
  let next = String(body.next || '/admin.html');
  if (!next.startsWith('/') || next.startsWith('//')) next = '/admin.html';

  return new Response(JSON.stringify({ ok: true, next: next }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookie
    }
  });
}
