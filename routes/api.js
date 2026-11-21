const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Project = require('../models/Project');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { storage, cloudinary } = require('../middleware/cloudinary');

const router = express.Router();

// Upload rules (Cloudinary's free plan also caps images at 10 MB).
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Desteklenmeyen dosya türü: ${file.originalname}. Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.`);
    err.code = 'UNSUPPORTED_TYPE';
    cb(err);
  },
}).array('images', MAX_FILES);

// Runs multer and turns its failures into clear 4xx/502 answers. Multer has
// already removed any files of the failed request from Cloudinary.
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Her görsel en fazla 10 MB olabilir.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: `Tek seferde en fazla ${MAX_FILES} görsel yükleyebilirsiniz.` });
    }
    if (err.code === 'UNSUPPORTED_TYPE') {
      return res.status(400).json({ message: err.message });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'Yükleme isteği geçersiz.' });
    }
    console.error('Görsel yükleme hatası:', err);
    res.status(502).json({ message: 'Görseller yüklenemedi. Lütfen biraz sonra tekrar deneyin.' });
  });
}

// Malformed ids can never match a document: answer 404 up front instead of
// letting Mongoose throw a CastError (which used to surface as a 500).
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: 'Proje bulunamadı' });
  }
  next();
});
router.param('imageId', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: 'Görsel bulunamadı' });
  }
  next();
});

// Log the details on the server; never send them to the client.
function serverError(res, err, message) {
  console.error(message, err);
  res.status(500).json({ message });
}

function sendSaveError(res, err, message) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message: details || message });
  }
  serverError(res, err, message);
}

// Best effort: a failed Cloudinary call only leaves an unused file behind,
// so it is logged and never blocks the database change.
async function removeFromCloudinary(publicIds) {
  await Promise.all(publicIds.filter(Boolean).map(async (publicId) => {
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    } catch (err) {
      console.error(`Cloudinary görseli silinemedi (${publicId}):`, err);
    }
  }));
}

// Images uploaded for a request whose save failed would never be referenced.
function discardUploads(req) {
  return removeFromCloudinary((req.files || []).map((f) => f.filename));
}

function uploadedImages(req) {
  return (req.files || []).map((f) => ({ url: f.path, filename: f.filename }));
}

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort('-createdAt');
    res.json(projects);
  } catch (err) {
    serverError(res, err, 'Projeler yüklenemedi');
  }
});

// Get a single project
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    res.json(project);
  } catch (err) {
    serverError(res, err, 'Proje yüklenemedi');
  }
});

// Create a new project
router.post('/projects', authenticateToken, isAdmin, handleUpload, async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const project = new Project({ title, description, images: uploadedImages(req) });
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    await discardUploads(req);
    sendSaveError(res, err, 'Proje kaydedilemedi');
  }
});

// Update a project's text and append newly uploaded images
router.put('/projects/:id', authenticateToken, isAdmin, handleUpload, async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const project = await Project.findById(req.params.id);
    if (!project) {
      await discardUploads(req);
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }

    project.title = title;
    project.description = description;
    project.images.push(...uploadedImages(req));

    await project.save();
    res.json(project);
  } catch (err) {
    await discardUploads(req);
    sendSaveError(res, err, 'Proje güncellenemedi');
  }
});

// Delete a project together with its images on Cloudinary
router.delete('/projects/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    await removeFromCloudinary(project.images.map((img) => img.filename));
    res.json({ message: 'Proje silindi' });
  } catch (err) {
    serverError(res, err, 'Proje silinemedi');
  }
});

// Delete one image of a project. Images are addressed by their own id:
// Cloudinary public ids contain "/" and cannot be used as a URL segment.
router.delete('/projects/:id/images/:imageId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Proje bulunamadı' });
    }
    const image = project.images.id(req.params.imageId);
    if (!image) {
      return res.status(404).json({ message: 'Görsel bulunamadı' });
    }

    const publicId = image.filename;
    project.images.pull(image._id);
    await project.save();
    await removeFromCloudinary([publicId]);

    res.json(project);
  } catch (err) {
    serverError(res, err, 'Görsel silinemedi');
  }
});

module.exports = router;
