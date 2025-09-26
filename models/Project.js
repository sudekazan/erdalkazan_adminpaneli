const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  subtitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  technologies: [{
    type: String,
    trim: true
  }],
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

// Add text index for search functionality
projectSchema.index({ title: 'text', description: 'text', technologies: 'text' });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
