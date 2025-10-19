// ===============================
// 📁 models/DailyActivity.js
// ===============================
const mongoose = require('mongoose');

const dailyActivitySchema = new mongoose.Schema({
    date: {
        type: Date,
        default: Date.now,
    },
    department: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    image: {
        type: String, // store image URL (from multer or cloud upload)
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
}, { timestamps: true });

module.exports = mongoose.model('DailyActivity', dailyActivitySchema);
