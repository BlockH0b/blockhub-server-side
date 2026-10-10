const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    content: { type: String, default: '' },
    file: {
        name: String,
        size: Number,
        type: String,
        url: String
    },
    createdAt: { type: Date, default: Date.now },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],

});

module.exports = mongoose.model('Message', messageSchema);