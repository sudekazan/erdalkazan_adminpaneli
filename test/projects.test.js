const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { reset, seedProject, getStored, startServer, login, cloud } = require('./helpers/setup');

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });
beforeEach(reset);

function jpeg(name, size = 1024) {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

test('lists projects newest first', async () => {
  await seedProject({ title: 'Eski', createdAt: new Date('2024-01-01') });
  await seedProject({ title: 'Yeni', createdAt: new Date('2025-01-01') });

  const res = await fetch(`${srv.base}/api/projects`);

  assert.equal(res.status, 200);
  const titles = (await res.json()).map((p) => p.title);
  assert.deepEqual(titles, ['Yeni', 'Eski']);
});

test('creating a project uploads its images to Cloudinary and stores url + public id', async () => {
  const cookie = await login(srv.base);
  const form = new FormData();
  form.append('title', 'Tambur boyama');
  form.append('description', 'Astar + epoksi');
  form.append('images', jpeg('a.jpg'));
  form.append('images', jpeg('b.jpg'));

  const res = await fetch(`${srv.base}/api/projects`, { method: 'POST', body: form, headers: { cookie } });

  assert.equal(res.status, 201);
  const created = await res.json();
  const stored = getStored(created._id);
  assert.equal(stored.title, 'Tambur boyama');
  assert.equal(stored.description, 'Astar + epoksi');
  assert.deepEqual(
    stored.images.map((i) => i.filename),
    ['erdalkazan-projects/fake1', 'erdalkazan-projects/fake2'],
  );
  assert.equal(stored.images[0].url, 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/fake1.jpg');
  assert.deepEqual(cloud.uploaded, ['erdalkazan-projects/fake1', 'erdalkazan-projects/fake2']);
});

test('creating a project without a title is rejected and nothing is stored', async () => {
  const cookie = await login(srv.base);
  const form = new FormData();
  form.append('description', 'başlıksız');

  const res = await fetch(`${srv.base}/api/projects`, { method: 'POST', body: form, headers: { cookie } });

  assert.equal(res.status, 400);
  const list = await (await fetch(`${srv.base}/api/projects`)).json();
  assert.equal(list.length, 0);
});

test('updating a project changes its text and appends new images', async () => {
  const cookie = await login(srv.base);
  const p = await seedProject({
    title: 'Eski başlık',
    images: [{ url: 'https://x/1.jpg', filename: 'erdalkazan-projects/old1' }],
  });
  const form = new FormData();
  form.append('title', 'Yeni başlık');
  form.append('images', jpeg('c.jpg'));

  const res = await fetch(`${srv.base}/api/projects/${p._id}`, { method: 'PUT', body: form, headers: { cookie } });

  assert.equal(res.status, 200);
  const stored = getStored(p._id);
  assert.equal(stored.title, 'Yeni başlık');
  assert.deepEqual(stored.images.map((i) => i.filename), ['erdalkazan-projects/old1', 'erdalkazan-projects/fake1']);
});
