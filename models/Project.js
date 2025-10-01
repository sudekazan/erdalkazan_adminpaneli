const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  // subtitle alanı kaldırıldı
  description: {
    type: String,
    trim: true
  },
  // technologies alanı kaldırıldı
  images: [{
    url: String,
    filename: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Arama indeksi title ve description ile güncellendi
projectSchema.index({ title: 'text', description: 'text' });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;