const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const { authenticateToken, isAdmin } = require('../middleware/auth');
// Cloudinary'i tek ve doğru şekilde içe aktarma
const { storage, cloudinary } = require('../middleware/cloudinary'); 

// Configure multer to use Cloudinary storage
const upload = multer({ storage });

// Get all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort('-createdAt');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
});

// Get a single project
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project', error: error.message });
  }
});

// Create a new project (protected route)
router.post('/projects', authenticateToken, isAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { title, description } = req.body; 

    const project = new Project({
      title,
      description,
      images: req.files.map(f => ({ url: f.path, filename: f.filename }))
    });

    await project.save();
    res.status(201).json(project);
  } catch (error) {
    console.error('PROJE KAYIT HATASI:', error); 
    res.status(400).json({ message: 'Error creating project', error: error.message });
  }
});

// Update a project (protected route)
router.put('/projects/:id', authenticateToken, isAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { title, description } = req.body; 
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.title = title;
    project.description = description;

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => ({ url: f.path, filename: f.filename }));
      project.images.push(...newImages);
    }

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: 'Error updating project', error: error.message });
  }
});

// Delete a project (protected route) - SİLME ROTASI EKLENDİ
router.delete('/projects/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});

// Delete an image from a project (protected route) - GÖRSEL SİLME ROTASI EKLENDİ
router.delete('/projects/:projectId/images/:filename', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { projectId, filename } = req.params;
    // Cloudinary'den görseli sil
    await cloudinary.uploader.destroy(filename); 
    // Veritabanından görseli kaldır
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { images: { filename: filename } } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting image', error: error.message });
  }
});

module.exports = router;