const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { reset, seedProject, getStored, startServer, login, cloud, Project } = require('./helpers/setup');
const { cloudinary } = require('../middleware/cloudinary');

let srv;
let cookie;
before(async () => {
  srv = await startServer();
  cookie = await login(srv.base);
});
after(async () => { await srv.close(); });
beforeEach(reset);

const twoImages = [
  { url: 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/aaa.jpg', filename: 'erdalkazan-projects/aaa' },
  { url: 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/bbb.jpg', filename: 'erdalkazan-projects/bbb' },
];

test('deleting an image removes it from the project and from Cloudinary', async () => {
  const p = await seedProject({ title: 'P', images: twoImages });
  const [first] = getStored(p._id).images;

  const res = await fetch(`${srv.base}/api/projects/${p._id}/images/${first._id}`, { method: 'DELETE', headers: { cookie } });

  assert.equal(res.status, 200);
  assert.deepEqual(getStored(p._id).images.map((i) => i.filename), ['erdalkazan-projects/bbb']);
  assert.deepEqual(cloud.destroyed, ['erdalkazan-projects/aaa']);
});

test('an image of another project cannot be deleted through this project', async () => {
  const owner = await seedProject({ title: 'Sahibi', images: twoImages });
  const other = await seedProject({ title: 'Başka' });
  const [img] = getStored(owner._id).images;

  const res = await fetch(`${srv.base}/api/projects/${other._id}/images/${img._id}`, { method: 'DELETE', headers: { cookie } });

  assert.equal(res.status, 404);
  assert.equal(getStored(owner._id).images.length, 2);
  assert.deepEqual(cloud.destroyed, []);
});

test('an image is removed from the project even if Cloudinary deletion fails', async (t) => {
  const p = await seedProject({ title: 'P', images: twoImages });
  const [first] = getStored(p._id).images;
  t.mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('Cloudinary erişilemiyor'); });
  t.mock.method(console, 'error', () => {});

  const res = await fetch(`${srv.base}/api/projects/${p._id}/images/${first._id}`, { method: 'DELETE', headers: { cookie } });

  assert.equal(res.status, 200);
  assert.equal(getStored(p._id).images.length, 1);
});

test('deleting a project also deletes its images from Cloudinary', async () => {
  const p = await seedProject({ title: 'P', images: twoImages });

  const res = await fetch(`${srv.base}/api/projects/${p._id}`, { method: 'DELETE', headers: { cookie } });

  assert.equal(res.status, 200);
  assert.equal(getStored(p._id), null);
  assert.deepEqual(cloud.destroyed.sort(), ['erdalkazan-projects/aaa', 'erdalkazan-projects/bbb']);
});

test('a malformed project id is answered with 404, not a server error', async () => {
  const form = new FormData();
  form.append('title', 'x');
  const attempts = [
    ['GET', '/api/projects/abc'],
    ['PUT', '/api/projects/abc', form],
    ['DELETE', '/api/projects/abc'],
    ['DELETE', '/api/projects/abc/images/def'],
  ];
  for (const [method, url, body] of attempts) {
    const res = await fetch(srv.base + url, { method, body, headers: { cookie } });
    assert.equal(res.status, 404, `${method} ${url}`);
  }
});

test('server errors do not reveal internal error details', async (t) => {
  t.mock.method(Project, 'find', () => { throw new Error('mongodb://kullanici:parola@db.internal'); });
  t.mock.method(console, 'error', () => {});

  const res = await fetch(`${srv.base}/api/projects`);

  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /kullanici|parola|db\.internal/);
});
