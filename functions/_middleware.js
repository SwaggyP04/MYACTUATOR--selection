/**
 * Cloudflare Pages Functions 中间件 —— 保护 /admin.html
 *
 * 认证方式：登录页 + 服务端 HMAC 签名 Cookie
 * （相比 HTTP Basic Auth：样式可控、微信内置浏览器可用）
 *
 * 需要的环境变量（Pages → Settings → Variables and secrets，类型 Secret）：
 *   ADMIN_USER  登录用户名
 *   ADMIN_PASS  登录密码（同时作为 Cookie 签名密钥）
 *
 * 可选：
 *   ADMIN_SESSION_HOURS  会话有效期，默认 12
 */

const COOKIE = 'ma_admin';
const LOGIN_PATH = '/admin-login.html';

/* ── 小工具 ── */

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

function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

/** 常数时间比较 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** 校验会话令牌：格式 <过期时间戳>.<签名> */
async function verifyToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const exp = parseInt(parts[0], 10);
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expect = await hmacHex(secret, String(exp));
  return safeEqual(expect, parts[1]);
}

/* ── 中间件 ── */

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  const isProtected = url.pathname === '/admin.html' || url.pathname === '/admin';

  // 其它路径一律放行（主站公开）
  if (!isProtected) return next();

  // 未配置凭证：fail closed
  if (!env.ADMIN_USER || !env.ADMIN_PASS) {
    return new Response(
      '管理后台未配置访问凭证。\n\n请在 Cloudflare Pages -> Settings -> Variables and secrets 中设置 ADMIN_USER 与 ADMIN_PASS（类型选 Secret），然后重新部署。',
      {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
      }
    );
  }

  const token = getCookie(request, COOKIE);
  if (token && await verifyToken(token, env.ADMIN_PASS)) {
    const res = await next();
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: headers
    });
  }

  // 未登录 → 跳登录页，并带回原地址
  const nextUrl = url.pathname + url.search;
  const target = new URL(LOGIN_PATH, url.origin);
  target.searchParams.set('next', nextUrl);
  return Response.redirect(target.toString(), 302);
}
