const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' }, // Who receives the notification
    type: String, // e.g., 'job_application', 'job_posted'
    sender: { // Who triggered the notification
        name: String,
        avatar: String,
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    },
    message: String, // Message to display (e.g., "applied to your job")
    jobTitle: String, // Optional - title of the job involved
    link: String, // Where to go on the frontend when clicked
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);