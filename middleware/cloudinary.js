const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const UPLOAD_OPTIONS = {
  folder: 'erdalkazan-projects',
  allowed_formats: ['jpeg', 'png', 'jpg']
};

// Multer storage engine that streams each uploaded file straight to
// Cloudinary (nothing is written to disk or held in memory). On success the
// file gets `path` (secure URL) and `filename` (Cloudinary public id).
const storage = {
  _handleFile(req, file, cb) {
    const upload = cloudinary.uploader.upload_stream(UPLOAD_OPTIONS, (err, result) => {
      if (err) return cb(err);
      cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
    });
    file.stream.on('error', cb);
    file.stream.pipe(upload);
  },
  // Called by multer when a later part of the request fails, so already
  // uploaded files of that request are not left behind on Cloudinary.
  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, { invalidate: true })
      .then(() => cb(null), cb);
  }
};

module.exports = { cloudinary, storage };
