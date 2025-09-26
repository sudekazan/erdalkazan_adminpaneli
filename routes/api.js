const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
    const { title, subtitle, description, technologies } = req.body;
    
    // Process uploaded files
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push({
          filename: file.originalname,
          mimeType: file.mimetype,
          base64: file.buffer.toString('base64')
        });
      });
    }

    const project = new Project({
      title,
      subtitle,
      description,
      technologies: typeof technologies === 'string' ? technologies.split(',').map(t => t.trim()) : technologies,
      images
    });

    const savedProject = await project.save();
    res.status(201).json(savedProject);
  } catch (error) {
    res.status(400).json({ message: 'Error creating project', error: error.message });
  }
});

// Update a project (protected route)
router.put('/projects/:id', authenticateToken, isAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { title, subtitle, description, technologies } = req.body;
    const update = {
      title,
      subtitle,
      description,
      technologies: typeof technologies === 'string' ? technologies.split(',').map(t => t.trim()) : technologies
    };

    // Process new uploaded files
    if (req.files && req.files.length > 0) {
      update.$push = {
        images: {
          $each: req.files.map(file => ({
            filename: file.originalname,
            mimeType: file.mimetype,
            base64: file.buffer.toString('base64')
          }))
        }
      };
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(400).json({ message: 'Error updating project', error: error.message });
  }
});

// Delete a project (protected route)
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

// Delete an image from a project (protected route)
router.delete('/projects/:projectId/images/:imageId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { projectId, imageId } = req.params;
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { images: { _id: imageId } } },
      { new: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting image', error: error.message });
  }
});

module.exports = router;
