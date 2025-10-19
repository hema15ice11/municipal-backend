// =========================
// 📁 server.js
// =========================
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();
const app = express();
const server = http.createServer(app);

// =========================
// ✅ Allowed origins for CORS
// =========================
const allowedOrigins = [
    'http://localhost:5173',               // local frontend
    'https://mcc-frontend.onrender.com'   // deployed frontend
];

// =========================
// ✅ Socket.IO Setup
// =========================
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Map to store userId → socketId
const userSockets = new Map();

io.on('connection', (socket) => {
    console.log(`⚡ User connected: ${socket.id}`);

    socket.on('registerUser', (userId) => {
        if (userId) {
            userSockets.set(userId, socket.id);
            console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
        }
    });

    socket.on('disconnect', () => {
        for (let [userId, sockId] of userSockets.entries()) {
            if (sockId === socket.id) {
                userSockets.delete(userId);
                console.log(`❌ User ${userId} disconnected`);
                break;
            }
        }
    });
});

// =========================
// ✅ Middleware
// =========================
app.use(express.json());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// =========================
// ✅ MongoDB Connection
// =========================
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(async () => {
        console.log('✅ MongoDB connected');

        // Ensure default admin exists
        const User = require('./models/User');
        const adminEmail = 'admin@gmail.com';
        const adminPassword = 'admin123';

        const existingAdmin = await User.findOne({ email: adminEmail, role: 'admin' });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await User.create({
                firstName: 'System',
                lastName: 'Admin',
                email: adminEmail,
                phone: '0000000000',
                address: 'Head Office',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Default admin created successfully');
        }
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

// =========================
// ✅ Session Middleware
// =========================
app.use(session({
    secret: process.env.JWT_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// =========================
// ✅ Static files
// =========================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =========================
// ✅ Routes
// =========================
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Make sure your other routes are functions if needed (for complaints with io)
const complaintRoutes = require('./routes/complaintRoutes');
app.use('/api/complaints', complaintRoutes(io, userSockets));

const chatRoutes = require('./routes/chatRoutes');
app.use('/api', chatRoutes);

const dailyActivitiesRoutes = require('./routes/dailyActivities');
app.use('/api', dailyActivitiesRoutes);

// =========================
// ✅ Protected profile route (frontend session check)
// =========================
app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ msg: 'Not authenticated' });
    try {
        const User = require('./models/User');
        const user = await User.findById(req.session.userId).select('-password');
        res.json({ user });
    } catch (err) {
        console.error('Error fetching user session:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// =========================
// ✅ Default route
// =========================
app.get('/', (req, res) => res.send('Server is running successfully 🚀'));

// =========================
// ✅ 404 handler
// =========================
app.use((req, res) => res.status(404).json({ msg: 'Route not found' }));

// =========================
// ✅ Start server
// =========================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server + Socket.IO running on port ${PORT}`));
