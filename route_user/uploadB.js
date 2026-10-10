const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // explicitly point to root
const cloudinary = require('cloudinary').v2;
const express = require('express');

const router = express.Router();


// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

console.log(process.env.CLOUDINARY_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET);


// Standalone upload function for public folder
async function uploadPublicImage(filename) {
  try {
    const filePath = path.join(__dirname, '../public', filename);
    const result = await cloudinary.uploader.upload(filePath, { folder: 'emails' });
    console.log('✅ Image uploaded! Public URL:', result.secure_url);
  } catch (err) {
    console.error('❌ Upload failed:', err);
  }
}

// Run this if called directly via node
if (require.main === module) {
  // Replace 'blockhub.jpeg' with your file in /public
  uploadPublicImage('blockhub.jpeg');
}

module.exports = router;
