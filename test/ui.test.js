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
