const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login } = require('./helpers/setup');

let srv;
let cookie;
before(async () => {
  srv = await startServer();
  cookie = await login(srv.base);
});
after(async () => { await srv.close(); });

const get = (path, headers = {}) => fetch(srv.base + path, { redirect: 'manual', headers });

test('another website cannot read API responses with the admin session', async () => {
  const res = await get('/api/projects', { Origin: 'https://evil.example', cookie });

  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal(res.headers.get('access-control-allow-credentials'), null);
});

test('pages cannot be framed by other sites and do not advertise the server', async () => {
  for (const path of ['/', '/admin/login.html', '/api/projects']) {
    const res = await get(path);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', path);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(res.headers.get('x-powered-by'), null, path);
  }
});

const adminPages = [
  '/admin',
  '/admin/',
  '/admin/index.html',
  '/admin/new.html',
  '/admin/edit.html',
  // Alternative spellings the static file server would still resolve:
  '/admin//index.html',
  '/admin/%69ndex.html',
  '/admin/edit.htm%6c',
];

test('admin pages redirect to login without a valid session', async () => {
  for (const path of adminPages) {
    for (const headers of [{}, { cookie: 'token=sahte' }]) {
      const res = await get(path, headers);
      assert.ok([301, 302, 303].includes(res.status), `${path} ${JSON.stringify(headers)} -> ${res.status}`);
      const location = res.headers.get('location');
      // /admin -> /admin/ is the static server's own slash redirect; follow it.
      if (location === '/admin/') {
        const next = await get(location, headers);
        assert.equal(next.headers.get('location'), '/admin/login.html', path);
      } else {
        assert.equal(location, '/admin/login.html', path);
      }
    }
  }
});

test('admin pages are served to a logged-in admin', async () => {
  for (const path of ['/admin/', '/admin/index.html', '/admin/new.html', '/admin/edit.html']) {
    const res = await get(path, { cookie });
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/, path);
  }
});

test('every local stylesheet, script and image the pages reference exists', async () => {
  const pages = ['/', '/admin/login.html', '/admin/', '/admin/new.html', '/admin/edit.html'];
  for (const page of pages) {
    const html = await (await fetch(srv.base + page, { headers: { cookie } })).text();
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)]
      .map((m) => m[1])
      .filter((u) => !/^(https?:|mailto:|tel:|data:|\/\/)/.test(u) && !u.includes('${'));
    assert.ok(refs.length > 0, `${page} has local references`);
    for (const ref of refs) {
      const url = new URL(ref, srv.base + page);
      const res = await fetch(url, { headers: { cookie } });
      assert.equal(res.status, 200, `${page} -> ${ref}`);
    }
  }
});

test('the login page and admin stylesheet are reachable without a session', async () => {
  assert.equal((await get('/admin/login.html')).status, 200);
  assert.equal((await get('/admin/css/admin.css')).status, 200);
});
