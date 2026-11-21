// Runs in its own process (node --test isolates files), so the limiter state
// here does not leak into other test files.
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/setup');

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

function attempt(password, headers = {}) {
  return fetch(`${srv.base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ password }),
  });
}

test('a successful login resets the failure count', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await attempt('yanlis')).status, 401);
  assert.equal((await attempt('dogru-sifre')).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await attempt('yanlis')).status, 401);
  assert.equal((await attempt('dogru-sifre')).status, 200);
});

test('after 5 wrong passwords even the right password is refused until the window passes', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.now() });
  try {
    for (let i = 0; i < 5; i++) assert.equal((await attempt('yanlis')).status, 401);

    const blocked = await attempt('dogru-sifre');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('set-cookie'), null);

    // A spoofed X-Forwarded-For must not open a fresh bucket when the
    // app is not configured to trust a proxy.
    assert.equal((await attempt('dogru-sifre', { 'X-Forwarded-For': '203.0.113.9' })).status, 429);

    mock.timers.tick(14 * 60 * 1000);
    assert.equal((await attempt('dogru-sifre')).status, 429, 'still blocked before 15 minutes');

    mock.timers.tick(61 * 1000);
    assert.equal((await attempt('dogru-sifre')).status, 200, 'allowed again after 15 minutes');
  } finally {
    mock.timers.reset();
  }
});
