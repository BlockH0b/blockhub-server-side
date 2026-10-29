const { Server } = require('socket.io');
const Chat = require('../models/chat');
const message = require('../models/message');
const { allowedOrigins } = require('./origins');

let io;

module.exports = {
    init: (server) => {
        io = new Server(server, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
                methods: ['GET', 'POST']
            }
        });

        io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // Join chat room
            socket.on('joinChat', (chatId) => {
                socket.join(chatId);
                console.log(`User ${socket.id} joined chat ${chatId}`);
            });

            socket.on('sendMessage', async (data) => {
                try {
                    const { chatId, sender, content, file } = data;
                    if (!chatId || !sender || (!content && !file)) return;

                    // Make sure sender is only userId string
                    const newMessage = await message.create({
                        chatId,
                        sender, // must be ObjectId string
                        content,
                        file,
                        createdAt: new Date(),
                    });

                    await Chat.findByIdAndUpdate(chatId, {
                        lastMessage: content || (file && file.name) || '',
                        lastMessageTime: new Date(),
                    });

                    // Re-fetch & populate properly
                    const populatedMessage = await message.findById(newMessage._id)
                        .populate('sender', '_id fullName profileImage');
                    // Emit to all users in this chat room
                    io.to(chatId).emit('receiveMessage', populatedMessage);
                } catch (err) {
                    console.error('sendMessage error:', err);
                }
            });


            // BlockHub Live (YouTube classes): join a class's question room.
            // The ticket is signed by the server when the student opens the class.
            socket.on('yt:join', (payload) => {
                try {
                    const { verifyTicket } = require('../services/youtube.service');
                    const decoded = verifyTicket(payload && payload.ticket);
                    if (!decoded || !decoded.code) return;
                    socket.join(`yt:${decoded.code}`);
                } catch (err) {
                    console.error('yt:join error:', err.message);
                }
            });

            socket.on('yt:leave', (payload) => {
                if (payload && typeof payload.code === 'string') socket.leave(`yt:${payload.code}`);
            });

            socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) throw new Error('Socket.io not initialized!');
        return io;
    }
};