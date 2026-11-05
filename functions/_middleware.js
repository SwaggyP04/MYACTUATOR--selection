/**
 * Cloudflare Pages Functions 中间件
 *
 * 作用：给 /admin.html 加服务端 HTTP Basic Auth 保护
 *      （主站 index.html 及所有公开资源不受影响）
 *
 * 账号密码不在代码里，存在 Cloudflare 环境变量：
 *    ADMIN_USER
 *    ADMIN_PASS
 *
 * 设置位置：
 *   Workers & Pages → 项目 → Settings → Environment variables
 *   类型选「Secret / 加密」，Production 和 Preview 都要加
 */

const REALM = 'MyActuator Admin';
const PROTECTED = ['/admin.html', '/admin'];

function unauthorized() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store'
    }
  });
}

/** 常数时间比较，避免时序侧信道 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  const isProtected = PROTECTED.some(
    p => url.pathname === p || url.pathname === p + '/'
  );

  if (!isProtected) return next();

  // 没配置环境变量时直接拒绝，避免"忘配置 = 无保护"
  const expectedUser = env.ADMIN_USER;
  const expectedPass = env.ADMIN_PASS;
  if (!expectedUser || !expectedPass) {
    return new Response(
      '管理后台未配置访问凭证。\n\n请在 Cloudflare Pages -> Settings -> Environment variables 中设置 ADMIN_USER 与 ADMIN_PASS。',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return unauthorized();

  let decoded = '';
  try {
    const bin = atob(auth.slice(6).trim());
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    decoded = new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  if (sep < 0) return unauthorized();

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  if (!safeEqual(user, expectedUser) || !safeEqual(pass, expectedPass)) {
    return unauthorized();
  }

  // 认证通过：禁止缓存，避免被中间层缓存后绕过登录
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: headers
  });
}
