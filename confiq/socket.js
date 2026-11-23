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

            // Track group chat: join with the ticket from GET /track_chat/me
            socket.on('trackchat:join', async (payload) => {
                try {
                    const jwt = require('jsonwebtoken');
                    const d = jwt.verify(String((payload && payload.ticket) || ''), process.env.JWT_SECRET);
                    if (d.purpose !== 'trackchat' || !d.cohort || !d.track) return;
                    const room = `trackchat:${d.cohort}:${d.track}`;
                    if (socket.data.chatRoom && socket.data.chatRoom !== room) socket.leave(socket.data.chatRoom);
                    socket.data.userId = String(d.userId);
                    socket.data.chatName = d.name;
                    socket.data.chatRoom = room;
                    socket.join(room);
                    const online = (await io.in(room).fetchSockets()).map((s) => s.data.userId);
                    io.to(room).emit('trackchat:presence', { online: [...new Set(online)].length });
                } catch (err) {
                    socket.emit('trackchat:error', { message: 'Chat session expired. Refresh the page.' });
                }
            });

            socket.on('trackchat:typing', () => {
                if (socket.data.chatRoom) {
                    socket.to(socket.data.chatRoom).emit('trackchat:typing', { userId: socket.data.userId, name: socket.data.chatName });
                }
            });

            socket.on('disconnect', () => {
                if (socket.data && socket.data.chatRoom) {
                    const room = socket.data.chatRoom;
                    io.in(room).fetchSockets()
                        .then((list) => io.to(room).emit('trackchat:presence', { online: new Set(list.map((s) => s.data.userId)).size }))
                        .catch(() => {});
                }
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