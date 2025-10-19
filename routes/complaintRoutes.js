const express = require("express");
const multer = require("multer");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const nodemailer = require("nodemailer");

// -------------------- EMAIL SENDER --------------------
const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,   // your Gmail
        pass: process.env.EMAIL_PASS    // Gmail App Password if 2FA enabled
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("⚠️ Email sending failed:", err.message);
  }
};

module.exports = (io, userSockets) => {
  const router = express.Router();

  // ===== Multer setup =====
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  });
  const upload = multer({ storage });

  // ===== Middleware: User authentication =====
  const isUserAuthenticated = async (req, res, next) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ msg: "Not authenticated" });
      }
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(404).json({ msg: "User not found" });
      req.user = user;
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ msg: "Server error in authentication" });
    }
  };

  // ===== POST: New complaint =====
  router.post("/", isUserAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const { category, subcategory, description } = req.body;
      if (!category || !subcategory || !description)
        return res.status(400).json({ msg: "All fields are required" });

      if (req.user.role !== "user")
        return res.status(403).json({ msg: "Only users can file complaints" });

      const complaint = new Complaint({
        userId: req.user._id,
        category,
        subcategory,
        description,
        fileUrl: req.file ? req.file.path.replace(/\\/g, "/") : undefined,
      });

      await complaint.save();

      io.emit("newComplaint", {
        userId: req.user._id,
        category,
        subcategory,
        description,
        createdAt: complaint.createdAt,
      });

      res.status(201).json({ msg: "Complaint submitted successfully", complaint });
    } catch (err) {
      console.error("Error creating complaint:", err);
      res.status(500).json({ msg: "Server error while creating complaint" });
    }
  });

  // ===== GET: Complaints by user =====
  router.get("/user/:userId", async (req, res) => {
    try {
      const complaints = await Complaint.find({ userId: req.params.userId }).sort({ createdAt: -1 });
      res.json(complaints);
    } catch (err) {
      console.error("Error fetching user complaints:", err);
      res.status(500).json({ msg: "Server error while fetching complaints" });
    }
  });

  // ===== GET: All complaints (Admin only) =====
  router.get("/all", async (req, res) => {
    try {
      const complaints = await Complaint.find()
          .populate("userId", "firstName lastName email phone address")
          .sort({ createdAt: -1 });
      res.json(complaints);
    } catch (err) {
      console.error("Error fetching all complaints:", err);
      res.status(500).json({ msg: "Server error while fetching all complaints" });
    }
  });

  // ===== PATCH: Update complaint status (Admin only) =====
  router.patch("/status/:id", async (req, res) => {
    try {
      const { status } = req.body;
      const complaintId = req.params.id;

      if (!status) return res.status(400).json({ msg: "Status is required" });
      if (!complaintId) return res.status(400).json({ msg: "Complaint ID missing" });

      const complaint = await Complaint.findByIdAndUpdate(
          complaintId,
          { $set: { status } },
          { new: true, runValidators: true }
      ).populate("userId", "firstName lastName email phone address");

      if (!complaint) {
        console.error("Complaint not found:", complaintId);
        return res.status(404).json({ msg: "Complaint not found" });
      }

      io.emit("complaintUpdated", { complaintId, status });

      // ===== Send email to the complaint owner about status =====
      if (complaint.userId?.email) {
        const subject = `Complaint Status Updated: ${complaint.category}`;
        const text = `Hello ${complaint.userId.firstName},\n\nYour complaint under category "${complaint.category}" has been updated to status: "${status}".\n\nThank you for using our service.`;
        sendEmail(complaint.userId.email, subject, text);
      }

      res.json(complaint);
    } catch (err) {
      console.error("Error while updating status:", err.message);
      res.status(500).json({ msg: "Server error while updating status" });
    }
  });

  return router;
};
