// ===============================
// 📁 routes/dailyActivities.js
// ===============================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const DailyActivity = require('../models/DailyActivity');

// ===============================
// 🖼️ Multer setup for image upload
// ===============================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/dailyActivities'); // make sure this folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// ===============================
// 🧑‍💼 ADMIN ROUTES
// ===============================

// POST /api/admin/daily-updates  -> Create new activity
router.post('/admin/daily-updates', upload.single('image'), async (req, res) => {
    try {
        const { date, department, title, description } = req.body;
        const image = req.file ? `/uploads/dailyActivities/${req.file.filename}` : null;

        const activity = new DailyActivity({
            date,
            department,
            title,
            description,
            image,
            createdBy: req.user ? req.user.id : null, // optional: if auth middleware used
        });

        await activity.save();
        res.status(201).json({ message: 'Daily activity created successfully', activity });
    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/daily-updates -> List all activities (with pagination)
router.get('/admin/daily-updates', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const activities = await DailyActivity.find()
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit);

        const total = await DailyActivity.countDocuments();

        res.status(200).json({
            activities,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/admin/daily-updates/:id -> Edit activity
router.put('/admin/daily-updates/:id', upload.single('image'), async (req, res) => {
    try {
        const { date, department, title, description } = req.body;
        const updateData = { date, department, title, description };

        if (req.file) {
            updateData.image = `/uploads/dailyActivities/${req.file.filename}`;
        }

        const updatedActivity = await DailyActivity.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updatedActivity) {
            return res.status(404).json({ message: 'Activity not found' });
        }

        res.status(200).json({ message: 'Activity updated successfully', updatedActivity });
    } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/daily-updates/:id -> Delete activity
router.delete('/admin/daily-updates/:id', async (req, res) => {
    try {
        const activity = await DailyActivity.findByIdAndDelete(req.params.id);
        if (!activity) {
            return res.status(404).json({ message: 'Activity not found' });
        }
        res.status(200).json({ message: 'Activity deleted successfully' });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ===============================
// 🌍 USER ROUTE
// ===============================

// GET /api/daily-updates -> public display of activities
router.get('/daily-updates', async (req, res) => {
    try {
        const activities = await DailyActivity.find().sort({ date: -1 });
        res.status(200).json(activities);
    } catch (error) {
        console.error('Error fetching public updates:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
