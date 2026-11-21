// Shared test setup.
//
// MongoDB and Cloudinary are external services, so tests replace only their
// I/O: Project persistence (an in-memory Map) and Cloudinary's upload/destroy
// network calls. Express, the routes, auth, multer and Mongoose's own schema
// validation all run for real.
const { once } = require('node:events');
const { Writable } = require('node:stream');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'dogru-sifre';

const mongoose = require('mongoose');
// Any DB call the fake does not cover fails immediately instead of hanging.
mongoose.set('bufferCommands', false);

const Project = require('../../models/Project');
const { cloudinary } = require('../../middleware/cloudinary');

const store = new Map();
const cloud = { uploaded: [], destroyed: [], counter: 0 };

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function hydrate(obj) {
  return obj ? Project.hydrate(clone(obj)) : null;
}

function installFakeDb() {
  Project.find = () => ({
    sort: async () =>
      [...store.values()]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(hydrate),
  });
  Project.findById = async (id) => hydrate(store.get(String(id)));
  Project.findByIdAndDelete = async (id) => {
    const doc = store.get(String(id));
    store.delete(String(id));
    return hydrate(doc);
  };
  Project.findByIdAndUpdate = async (id, update) => {
    const doc = store.get(String(id));
    if (!doc) return null;
    const pull = update && update.$pull && update.$pull.images;
    if (pull) {
      doc.images = doc.images.filter((img) =>
        !Object.entries(pull).every(([k, v]) => String(img[k]) === String(v)));
    }
    return hydrate(doc);
  };
  Project.prototype.save = async function save() {
    await this.validate();
    if (!this.createdAt) this.createdAt = new Date();
    store.set(String(this._id), clone(this.toObject({ virtuals: false })));
    return this;
  };
  Project.prototype.deleteOne = async function deleteOne() {
    store.delete(String(this._id));
    return { deletedCount: 1 };
  };
}

function installFakeCloudinary() {
  cloudinary.uploader.upload_stream = (options, callback) => {
    let bytes = 0;
    return new Writable({
      write(chunk, _enc, done) { bytes += chunk.length; done(); },
      final(done) {
        cloud.counter += 1;
        const publicId = `${options.folder}/fake${cloud.counter}`;
        const resp = {
          public_id: publicId,
          secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`,
          bytes,
          format: 'jpg',
        };
        cloud.uploaded.push(publicId);
        done();
        callback(undefined, resp);
      },
    });
  };
  cloudinary.uploader.destroy = (publicId, options, callback) => {
    cloud.destroyed.push(publicId);
    const res = { result: 'ok' };
    if (typeof options === 'function') options(undefined, res);
    else if (typeof callback === 'function') callback(undefined, res);
    return Promise.resolve(res);
  };
}

installFakeDb();
installFakeCloudinary();

function reset() {
  store.clear();
  cloud.uploaded.length = 0;
  cloud.destroyed.length = 0;
  cloud.counter = 0;
}

// Insert a project straight into the fake store (bypassing the API).
async function seedProject({ title = 'Proje', description = '', images = [], createdAt } = {}) {
  const doc = new Project({ title, description, images });
  if (createdAt) doc.createdAt = createdAt;
  await doc.save();
  return clone(doc.toObject());
}

function getStored(id) {
  const doc = store.get(String(id));
  return doc ? clone(doc) : null;
}

async function startServer() {
  const app = require('../../app');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// Log in through the real endpoint and return the Cookie header value.
async function login(base, password = process.env.ADMIN_PASSWORD) {
  const res = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/token=[^;]+/);
  if (!match) throw new Error('login did not set a token cookie');
  return match[0];
}

module.exports = { store, cloud, reset, seedProject, getStored, startServer, login, Project };
