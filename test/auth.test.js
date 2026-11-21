const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { reset, seedProject, getStored, startServer, login } = require('./helpers/setup');

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });
beforeEach(reset);

function withEnv(vars, fn) {
  return async () => {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { await fn(); } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  };
}

for (const nodeEnv of [undefined, 'development']) {
  test(`write endpoints refuse requests without a session (NODE_ENV=${nodeEnv})`, withEnv({ NODE_ENV: nodeEnv }, async () => {
    const p = await seedProject({ title: 'Korunan', images: [{ url: 'u', filename: 'erdalkazan-projects/x' }] });
    const imageId = getStored(p._id).images[0]._id;

    const form = new FormData();
    form.append('title', 'Değişti');
    const attempts = [
      ['DELETE', `/api/projects/${p._id}`],
      ['DELETE', `/api/projects/${p._id}/images/${imageId}`],
      ['PUT', `/api/projects/${p._id}`, form],
      ['POST', '/api/projects', form],
    ];
    for (const [method, url, body] of attempts) {
      const res = await fetch(srv.base + url, { method, body });
      assert.equal(res.status, 401, `${method} ${url}`);
    }

    const stored = getStored(p._id);
    assert.equal(stored.title, 'Korunan');
    assert.equal(stored.images.length, 1);
    const all = await (await fetch(`${srv.base}/api/projects`)).json();
    assert.equal(all.length, 1);
  }));
}

test('check-auth reports unauthenticated without a session', withEnv({ NODE_ENV: undefined }, async () => {
  const res = await fetch(`${srv.base}/admin/check-auth`);
  assert.equal(res.status, 401);
}));

test('a token signed with a different secret is rejected', withEnv({ NODE_ENV: 'production' }, async () => {
  const p = await seedProject({ title: 'Korunan' });
  const forged = jwt.sign({ role: 'admin' }, 'tahmin-edilen-secret');

  const res = await fetch(`${srv.base}/api/projects/${p._id}`, { method: 'DELETE', headers: { cookie: `token=${forged}` } });

  assert.ok([401, 403].includes(res.status), `status ${res.status}`);
  assert.ok(getStored(p._id));
}));

test('a valid session can delete a project', async () => {
  const p = await seedProject({ title: 'Silinecek' });
  const cookie = await login(srv.base);

  const res = await fetch(`${srv.base}/api/projects/${p._id}`, { method: 'DELETE', headers: { cookie } });

  assert.equal(res.status, 200);
  assert.equal(getStored(p._id), null);
});

test('login accepts a bcrypt-hashed ADMIN_PASSWORD', withEnv({ ADMIN_PASSWORD: bcrypt.hashSync('gizli-sifre', 4) }, async () => {
  const hash = process.env.ADMIN_PASSWORD;
  const post = (password) => fetch(`${srv.base}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });

  assert.equal((await post('gizli-sifre')).status, 200);
  assert.equal((await post(hash)).status, 401, 'the hash itself must not work as a password');
}));

test('login without a JSON body is a failed login, not a server error', async () => {
  const res = await fetch(`${srv.base}/admin/login`, { method: 'POST' });
  assert.equal(res.status, 401);
});

for (const missing of ['ADMIN_PASSWORD', 'JWT_SECRET']) {
  test(`login issues no session when ${missing} is not configured`, withEnv({ [missing]: undefined }, async () => {
    const res = await fetch(`${srv.base}/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'dogru-sifre' }),
    });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('set-cookie'), null);
  }));
}
