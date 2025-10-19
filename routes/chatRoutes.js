const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const DailyActivity = require('../models/DailyActivity');

// POST /api/chat
router.post('/chat', async (req, res) => {
    const { message } = req.body;

    // Ensure user is logged in
    if (!req.session?.userId) {
        console.log("❌ Chat request blocked: User not authenticated");
        return res.json({ reply: "User not authenticated. Please login." });
    }

    const userId = req.session.userId;
    console.log("💬 Chat request from userId:", userId);
    console.log("Message:", message);

    let reply = "Sorry, I didn't understand that. Try asking about your complaints or daily activities.";

    const lowerMsg = message.toLowerCase();

    try {
        // Complaints
        if (lowerMsg.includes("complaint") || lowerMsg.includes("status")) {
            const complaints = await Complaint.find({ userId })
                .sort({ createdAt: -1 })
                .limit(5);

            if (complaints.length === 0) reply = "You have no complaints.";
            else {
                reply = "Your latest complaints:\n";
                complaints.forEach((c, i) => {
                    reply += `${i + 1}. "${c.description}" - Status: "${c.status}"\n`;
                });
            }
        }

        // Daily activities
        else if (lowerMsg.includes("activity") || lowerMsg.includes("daily work") || lowerMsg.includes("update")) {
            const activities = await DailyActivity.find()
                .sort({ date: -1 })
                .limit(5);

            if (activities.length === 0) reply = "No recent activities available.";
            else {
                reply = "Recent activities:\n";
                activities.forEach((a, i) => {
                    const formattedDate = new Date(a.date).toLocaleDateString();
                    reply += `${i + 1}. ${a.title} (${formattedDate})\n`;
                });
            }
        }

        // FAQ example
        else if (lowerMsg.includes("how to file complaint")) {
            reply = "To file a complaint, go to the 'File Complaint' section in the portal and fill in the details.";
        }

    } catch (err) {
        console.error("Chat error:", err.message);
        reply = "Oops! Something went wrong while fetching your data.";
    }

    console.log("Reply:", reply);
    res.json({ reply });
});

module.exports = router;
