const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'jobs', default: null },
    lastMessage: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);