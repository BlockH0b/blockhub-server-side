const express = require('express');
const route = express.Router();
const Project = require('../models/project'); // your project schema
const jwt = require('jsonwebtoken');

// Middleware to verify token (optional, if you want auth)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// UPDATE project by ID
route.put('/projects/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { projectName, twitterHandle, description, profileImage, compensation } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Update fields
    project.projectName = projectName || project.projectName;
    project.twitterHandle = twitterHandle || project.twitterHandle;
    project.description = description || project.description;
    project.profileImage = profileImage || project.profileImage;
    project.compensation = compensation || project.compensation;

    await project.save();

    res.status(200).json({ message: 'Project updated successfully', project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
});

// OPTIONAL: RESTORE project from local storage / previous state
route.get('/projects/restore/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.status(200).json({ message: 'Project restored', project });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
});

module.exports = route;
