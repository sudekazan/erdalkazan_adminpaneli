// Behind a reverse proxy every request arrives from the proxy's address.
// With TRUST_PROXY set, the login limiter must count real clients separately.
process.env.TRUST_PROXY = '1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/setup');

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

function attempt(password, clientIp) {
  return fetch(`${srv.base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp },
    body: JSON.stringify({ password }),
  });
}

test('one client locked out behind the proxy does not lock out another', async () => {
  for (let i = 0; i < 5; i++) await attempt('yanlis', '198.51.100.7');
  assert.equal((await attempt('dogru-sifre', '198.51.100.7')).status, 429);

  assert.equal((await attempt('dogru-sifre', '198.51.100.8')).status, 200);
});
