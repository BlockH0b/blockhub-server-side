// ===============================
// BlockHub Server - index.js
// ===============================

require('dotenv').config(); // load env before anything else reads it

// Stop early (with a clear message) if MONGODB_URI / JWT_SECRET are missing
require('./config/secrets').checkRequiredEnv();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('./confiq/index'); // Twitter strategies
const http = require('http');
const socket = require('./confiq/socket');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');

// Optional cron/automated jobs
const startJobs = require('./cron/hashtagsChecker');
const startAutoApprove = require('./cron/pointApprove');

// Initialize Express
const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);

// Initialize Socket.io
const io = socket.init(server);

// ===============================
// DNS Configuration (optional)
// ===============================
const dnsPromises = require("node:dns/promises");
const dns = require("dns");
dnsPromises.setServers(["1.1.1.1", "8.8.8.8"]);
dns.setDefaultResultOrder("ipv4first");

// ===============================
// Middleware
// ===============================
const { allowedOrigins } = require('./confiq/origins');


app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());


// VERY IMPORTANT FOR RENDER
app.set("trust proxy", 1);
// ===============================
// Session Middleware (for OAuth/Twitter)
// ===============================
app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: true,               // force save on every request
    saveUninitialized: true,    // ensure new sessions are stored
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
    },
}));

// ===============================
// Passport initialization
// ===============================
app.use(passport.initialize());
app.use(passport.session());

// ===============================
// Socket.io Connection
// ===============================
io.on('connection', (socket) => {
    console.log("User connected:", socket.userId || socket.id);
});

// ===============================
// MongoDB Connection
// ===============================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB connected');
        // Scheduled emails (class reminders, digests, campaign alerts...)
        require('./services/email/jobs').startEmailJobs();
        // startAutoApprove(); // start cron jobs if needed
    })
    .catch(err => console.error('MongoDB connection error:', err));



if (process.env.NODE_ENV === "production") {
    const telegramBot = require("./services/bots/telegramBot");

    telegramBot.launch();

    console.log("🤖 Telegram bot started in production");
} else {
    console.log("🤖 Telegram bot disabled in development");
}

// ===============================
// Serve static uploads (if needed)
// ===============================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// Routes
// ===============================

// Twitter v1 auth
app.use('/auth', require('./route_user/twitterAuth'));

// Ambassador routes
// app.use('/auth', require('./route_ambassador/auth'));
app.use('/ambassador_tasks', require('./route_ambassador/task'));
app.use('/ambassador_dashboard', require('./route_ambassador/dashboard'));

// Academy
app.use('/academy_form', require('./route_academy/form'));

// User routes
app.use('/user', require('./route_user/payment'));
app.use('/user_auth', require('./route_user/auth'));
app.use('/user_onboard', require('./route_user/onboarding'));
app.use('/user_create', require('./route_user/create'));
app.use('/user_discover', require('./route_user/discover'));
app.use('/user_activity', require('./route_user/activity'));
app.use('/user_profile', require('./route_user/profile'));
app.use('/user_twitter', require('./route_user/user_followers'));
app.use('/user_waitlist', require('./route_user/waitlist'));
app.use('/user_courses', require('./route_user/course'));
app.use('/user_jobs', require('./route_user/jobs'));
app.use('/user_wallet', require('./route_user/wallet'));
app.use('/user_payment', require('./route_user/payment'));
app.use('/user_market', require('./route_user/Market'));
app.use('/user_purchase', require('./route_user/purchase'));
app.use('/user_Hk', require('./route_user/Hk'));
app.use('/user_ai', require('./route_user/ai'));
app.use('/user_project', require('./route_user/project'));
app.use('/user_campaign', require('./route_user/campaign'));
app.use('/user_cohort', require('./route_user/cohort'));
app.use('/user_referral', require('./route_user/referral'));
app.use('/user_userCohort', require('./route_user/userCohort'));

// Tutor routes
app.use('/tutor_auth', require('./route_tutor/auth'));
app.use('/tutor_course', require('./route_tutor/course'));
app.use('/tutor_dashboard', require('./route_tutor/dashboard'));
app.use('/tutor_cohort', require('./route_tutor/cohort'));


// Tutor routes
app.use('/seller_auth', require('./route_seller/auth'));
app.use('/seller_product', require('./route_seller/product'));
app.use('/seller_dashboard', require('./route_seller/dashboard'));

// Admin routes
app.use('/admin_tasks', require('./route_admin/task'));
app.use('/admin_auth', require('./route_admin/auth'));
app.use('/admin_ambassadors', require('./route_admin/ambassadors'));
app.use('/admin_dashboard', require('./route_admin/dashboard'));

// Project routes
app.use('/project_auth', require('./route_project/auth'));
app.use('/project_dashboard', require('./route_project/dashboard'));
app.use('/project_tasks', require('./route_project/task'));
app.use('/project_profile', require('./route_project/profile'));

// Live classes (BlockHub Live - video classroom powered by LiveKit)
app.use('/live_class', require('./route_live/liveClass'));

// Emails: verification, preferences, unsubscribe, admin tools
app.use('/email', require('./route_email/email'));

// ===============================
// Cloudinary File Upload Endpoint
// ===============================

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const requireAnyAuth = require('./middlewave/requireAnyAuth');

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

// Memory storage for Multer
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});


app.post('/upload', requireAnyAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Upload to Cloudinary via stream
        // detect file type
        const resourceType = req.file.mimetype.startsWith("video")
            ? "video"
            : req.file.mimetype.startsWith("image")
                ? "image"
                : "raw";



        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, folder: 'courses', chunk_size: 6000000 },
            (error, result) => {
                if (error) return res.status(500).json({ error: error.message });
                // Return file metadata + Cloudinary ID
                return res.status(200).json({
                    file: {
                        id: result.public_id,
                        name: req.file.originalname,
                        size: Number((req.file.size / (1024 * 1024)).toFixed(2)),
                        type: req.file.mimetype.split('/')[1].toUpperCase(),
                        url: result.secure_url
                    }
                });
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.delete("/delete-file", requireAnyAuth, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || typeof id !== "string") {
            return res.status(400).json({
                success: false,
                message: "File id required",
            });
        }

        // Only files created through /upload (folder "courses/") can be deleted
        if (!id.startsWith("courses/")) {
            return res.status(403).json({
                success: false,
                message: "This file cannot be deleted.",
            });
        }

        // delete from cloudinary
        const result = await cloudinary.uploader.destroy(id);

        return res.json({
            success: true,
            message: "File deleted successfully",
            result,
        });
    } catch (error) {
        console.error("Delete file error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete file",
        });
    }
});


// ===============================
// Default Route
// ===============================
app.get('/', (req, res) => {
    res.send('Welcome to BlockHub Server');
});

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: Math.round(process.uptime()),
    });
});

// ===============================
// Start Server
// ===============================
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});