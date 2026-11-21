const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { reset, startServer, login, cloud } = require('./helpers/setup');
const { cloudinary } = require('../middleware/cloudinary');

let srv;
let cookie;
before(async () => {
  srv = await startServer();
  cookie = await login(srv.base);
});
after(async () => { await srv.close(); });
beforeEach(reset);

const MB = 1024 * 1024;
const file = (name, type, size = 1024) => new File([new Uint8Array(size)], name, { type });

async function create(files) {
  const form = new FormData();
  form.append('title', 'Yükleme testi');
  for (const f of files) form.append('images', f);
  const res = await fetch(`${srv.base}/api/projects`, { method: 'POST', body: form, headers: { cookie } });
  return { res, body: await res.json() };
}

async function projectCount() {
  return (await (await fetch(`${srv.base}/api/projects`)).json()).length;
}

function assertNothingLeftOnCloudinary() {
  const left = cloud.uploaded.filter((id) => !cloud.destroyed.includes(id));
  assert.deepEqual(left, []);
}

test('an image over 10 MB is rejected with 413 and nothing is kept', async () => {
  const { res, body } = await create([
    file('kucuk.jpg', 'image/jpeg'),
    file('buyuk.jpg', 'image/jpeg', 10 * MB + 1),
  ]);

  assert.equal(res.status, 413);
  assert.equal(typeof body.message, 'string');
  assert.equal(await projectCount(), 0);
  assertNothingLeftOnCloudinary();
});

test('an image of exactly 10 MB is accepted', async () => {
  const { res } = await create([file('tam.jpg', 'image/jpeg', 10 * MB)]);
  assert.equal(res.status, 201);
});

test('more than 10 images in one request are rejected with 400 and nothing is kept', async () => {
  const files = Array.from({ length: 11 }, (_, i) => file(`g${i}.jpg`, 'image/jpeg'));

  const { res } = await create(files);

  assert.equal(res.status, 400);
  assert.equal(await projectCount(), 0);
  assertNothingLeftOnCloudinary();
});

for (const [name, type, expected] of [
  ['foto.jpg', 'image/jpeg', 201],
  ['foto.png', 'image/png', 201],
  ['foto.webp', 'image/webp', 201],
  ['anim.gif', 'image/gif', 400],
  ['belge.pdf', 'application/pdf', 400],
  ['not.txt', 'text/plain', 400],
]) {
  test(`${type} upload -> ${expected}`, async () => {
    const { res } = await create([file(name, type)]);
    assert.equal(res.status, expected);
    if (expected !== 201) {
      assert.equal(await projectCount(), 0);
      assertNothingLeftOnCloudinary();
    }
  });
}

test('if Cloudinary rejects an upload, no project is created and the error is reported', async (t) => {
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, cb) => {
    const { Writable } = require('node:stream');
    return new Writable({
      write(_c, _e, done) { done(); },
      final(done) { done(); cb(new Error('Invalid api_key')); },
    });
  });
  t.mock.method(console, 'error', () => {});

  const { res, body } = await create([file('a.jpg', 'image/jpeg')]);

  assert.equal(res.status, 502);
  assert.doesNotMatch(body.message, /api_key/);
  assert.equal(await projectCount(), 0);
});
