const express = require('express');
const multer = require('multer');
const path = require('path');
const message = require('../models/message');
const http = require('http');
const socket = require('../confiq/socket');
require('dotenv').config();

const app = express(); // 👈 define app first
const port = process.env.PORT || 8080;
const server = http.createServer(app); // 👈 wrap express in http server
const io = socket.init(server); // 👈 initialize socket with server


const router = express.Router();

// Store files in /uploads folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Upload route
router.post('/upload', upload.single('file'), async(req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const fileSizeMB = Number((req.file.size / (1024 * 1024)).toFixed(2));
        const fileData = {
            name: req.file.originalname,
            size: fileSizeMB, // now in MB as a float
            type: req.file.mimetype.split('/')[1].toUpperCase() || 'FILE',
            url: `/uploads/${req.file.filename}`
        };

        const newMessage = await message.create({
            chatId: req.body.chatId,
            sender: req.body.senderId,
            content: '',
            file: fileData
        });

        io.to(req.body.chatId).emit('receiveMessage', newMessage);

        res.status(200).json(newMessage);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;