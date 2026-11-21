// Browser tests for the admin panel and the public site. They need Playwright
// with Chromium; where it is not installed the whole file is skipped.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { reset, seedProject, getStored, startServer, login } = require('./helpers/setup');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch { /* skipped below */ }
const skip = chromium ? false : 'Playwright yüklü değil';

let srv;
let browser;
before(async () => {
  if (skip) return;
  srv = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  if (skip) return;
  await browser.close();
  await srv.close();
});
beforeEach(reset);

// A page whose external requests (CDN fonts, Cloudinary images) are answered
// locally, so tests do not depend on the network.
async function newPage({ loggedIn = false, viewport = { width: 1280, height: 800 } } = {}) {
  const context = await browser.newContext({ viewport });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 204, body: '' }));
  if (loggedIn) {
    const [name, value] = (await login(srv.base)).split('=');
    await context.addCookies([{ name, value, url: srv.base }]);
  }
  const page = await context.newPage();
  page.dialogs = [];
  page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss(); });
  return page;
}

// Each payload sets window.__xss if the page turns data into markup.
const hostile = {
  title: '<img src=x onerror="window.__xss=\'title\'">Başlık',
  description: '<img src=x onerror="window.__xss=\'desc\'">ilk satır\nikinci satır',
  images: [{
    url: 'https://res.cloudinary.com/demo/a.jpg" onerror="window.__xss=\'url\'" x="',
    filename: 'erdalkazan-projects/a" onerror="window.__xss=\'filename\'" x="',
  }],
};

test('public homepage shows project text literally without running it', { skip }, async () => {
  await seedProject(hostile);
  const page = await newPage();
  await page.goto(`${srv.base}/`);
  await page.locator('.project-card h3').waitFor();
  await page.waitForTimeout(300); // let any injected onerror handlers fire

  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('.project-card h3').textContent(), hostile.title);
  assert.equal(
    await page.locator('.project-description').innerText(),
    '<img src=x onerror="window.__xss=\'desc\'">ilk satır\nikinci satır',
  );
  await page.context().close();
});

test('admin project list shows titles literally without running them', { skip }, async () => {
  await seedProject(hostile);
  const page = await newPage({ loggedIn: true });
  await page.goto(`${srv.base}/admin/`);
  await page.locator('.project-card h3').waitFor();
  await page.waitForTimeout(300);

  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('.project-card h3').textContent(), hostile.title);
  await page.context().close();
});

test('edit page shows existing images without running injected attributes', { skip }, async () => {
  const p = await seedProject(hostile);
  const page = await newPage({ loggedIn: true });
  await page.goto(`${srv.base}/admin/edit.html?id=${p._id}`);
  await page.locator('.image-preview').first().waitFor();
  await page.waitForTimeout(300);

  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.inputValue('#title'), hostile.title);
  await page.context().close();
});

const MB = 1024 * 1024;
const upload = (name, size = 2048, mimeType = 'image/jpeg') => ({ name, mimeType, buffer: Buffer.alloc(size, name) });

// Names of the files a multipart request body carries.
function uploadedNames(request) {
  const body = request.postDataBuffer().toString('latin1');
  return [...body.matchAll(/name="images"; filename="([^"]+)"/g)].map((m) => m[1]);
}

async function removePreview(page, name) {
  const preview = page.locator('.image-preview', { has: page.locator(`img[alt="${name}"]`) });
  await preview.hover();
  await preview.locator('.remove-image').click();
}

test('new project page: removing a preview drops exactly that file', { skip }, async () => {
  const page = await newPage({ loggedIn: true });
  await page.goto(`${srv.base}/admin/new.html`);
  await page.fill('#title', 'Yeni proje');
  // A larger first file finishes reading last, which used to scramble the order.
  await page.setInputFiles('#imageUpload', [upload('a.jpg', 3 * MB), upload('b.jpg'), upload('c.jpg')]);
  await page.waitForFunction(() => document.querySelectorAll('.image-preview').length === 3, null, { timeout: 5000 });

  await removePreview(page, 'b.jpg');
  const request = page.waitForRequest((r) => r.url().endsWith('/api/projects') && r.method() === 'POST');
  await page.click('button[type="submit"]');

  assert.deepEqual(uploadedNames(await request), ['a.jpg', 'c.jpg']);
  await page.context().close();
});

for (const [label, files] of [
  ['a file over 10 MB', [upload('dev.jpg', 10 * MB + 1)]],
  ['an unsupported type', [upload('anim.gif', 2048, 'image/gif')]],
  ['more than 10 files', Array.from({ length: 11 }, (_, i) => upload(`g${i}.jpg`))],
]) {
  test(`new project page refuses ${label} before uploading`, { skip }, async () => {
    const page = await newPage({ loggedIn: true });
    await page.goto(`${srv.base}/admin/new.html`);
    await page.setInputFiles('#imageUpload', files);

    await page.locator('#errorModal').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('.image-preview').count(), 0);
    await page.context().close();
  });
}

test('edit page: removing a new image preview keeps existing images and the other new file', { skip }, async () => {
  const p = await seedProject({
    title: 'Var olan',
    images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/aaa.jpg', filename: 'erdalkazan-projects/aaa' }],
  });
  const page = await newPage({ loggedIn: true });
  await page.goto(`${srv.base}/admin/edit.html?id=${p._id}`);
  await page.locator('.image-preview').first().waitFor();
  await page.setInputFiles('#imageUpload', [upload('x.jpg', 3 * MB), upload('y.jpg')]);
  await page.waitForFunction(() => document.querySelectorAll('.image-preview').length === 3, null, { timeout: 5000 });

  await removePreview(page, 'x.jpg');
  const request = page.waitForRequest((r) => r.url().includes(`/api/projects/${p._id}`) && r.method() === 'PUT');
  await page.click('button[type="submit"]');

  assert.deepEqual(uploadedNames(await request), ['y.jpg']);
  await page.waitForURL(/\/admin\/?$/, { timeout: 5000 });
  assert.deepEqual(
    getStored(p._id).images.map((i) => i.filename),
    ['erdalkazan-projects/aaa', 'erdalkazan-projects/fake1'],
  );
  await page.context().close();
});

test('edit page deletes an existing image', { skip }, async () => {
  const p = await seedProject({
    title: 'Görselli',
    images: [
      { url: 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/aaa.jpg', filename: 'erdalkazan-projects/aaa' },
      { url: 'https://res.cloudinary.com/demo/image/upload/v1/erdalkazan-projects/bbb.jpg', filename: 'erdalkazan-projects/bbb' },
    ],
  });
  const page = await newPage({ loggedIn: true });
  await page.goto(`${srv.base}/admin/edit.html?id=${p._id}`);
  await page.locator('.image-preview').first().waitFor();

  await page.locator('.image-preview').first().hover();
  await page.locator('.image-preview .remove-image').first().click();
  await page.locator('#confirmDeleteImage').click();

  await page.waitForFunction(() => document.querySelectorAll('.image-preview').length === 1, null, { timeout: 5000 });
  assert.deepEqual(getStored(p._id).images.map((i) => i.filename), ['erdalkazan-projects/bbb']);
  await page.context().close();
});
