const User = require('../models/User');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// -------------------- EMAIL SENDER --------------------
const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
};

// -------------------- REGISTER USER --------------------
exports.registerUser = async (req, res) => {
  const { firstName, lastName, email, phone, address, password } = req.body;
  if (!firstName || !lastName || !email || !phone || !address || !password) {
    return res.status(400).json({ msg: 'Please fill all fields' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      address,
      password: hashedPassword,
      role: 'user'
    });

    await user.save();
    await sendEmail(email, 'Registration Successful', `Hello ${firstName},\n\nYou have successfully registered.`);

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// -------------------- LOGIN USER --------------------
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Please fill all fields' });

  try {
    const user = await User.findOne({ email });
    if (!user || user.role !== 'user') return res.status(400).json({ msg: 'Invalid user credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid user credentials' });

    req.session.userId = user._id;
    req.session.role = 'user';

    res.json({
      msg: 'Login successful',
      user: { _id: user._id, firstName: user.firstName, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// -------------------- LOGIN ADMIN --------------------
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Please fill all fields' });

  try {
    const admin = await User.findOne({ email, role: 'admin' });
    if (!admin) return res.status(400).json({ msg: 'Invalid admin credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid admin credentials' });

    req.session.userId = admin._id;
    req.session.role = 'admin';

    res.json({
      msg: 'Admin login successful',
      user: { _id: admin._id, firstName: admin.firstName, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// -------------------- LOGOUT USER --------------------
exports.logoutUser = (req, res) => {
  if (req.session.role !== 'user') return res.status(400).json({ msg: 'Not logged in as user' });

  req.session.destroy(err => {
    if (err) return res.status(500).json({ msg: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ msg: 'User logged out successfully' });
  });
};

// -------------------- LOGOUT ADMIN --------------------
exports.logoutAdmin = (req, res) => {
  if (req.session.role !== 'admin') return res.status(400).json({ msg: 'Not logged in as admin' });

  req.session.destroy(err => {
    if (err) return res.status(500).json({ msg: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ msg: 'Admin logged out successfully' });
  });
};


// -------------------- CREATE ADMIN --------------------
exports.createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ msg: 'Please fill all fields' });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ msg: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = new User({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();

    res.status(201).json({
      msg: 'Admin created successfully',
      admin: {
        _id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Admin creation error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
