const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Başlık zorunludur'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // url: Cloudinary adresi, filename: Cloudinary public_id
  images: [{
    url: String,
    filename: String
  }]
}, {
  timestamps: true, // createdAt ve updatedAt alanlarını otomatik ekler
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Arama indeksi title ve description ile güncellendi
projectSchema.index({ title: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;