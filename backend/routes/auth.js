const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../utils/emailService');

const router = express.Router();

// Register - Only buyers can self-register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, invitationToken } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let userRole = role || 'buyer';
    let onboardedBy = null;

    // If invitation token provided, this is a supplier accepting invitation
    if (invitationToken) {
      const invitedUser = await User.findOne({ 
        invitationToken,
        status: 'invited',
        role: 'seller'
      });

      if (!invitedUser) {
        return res.status(400).json({ message: 'Invalid or expired invitation token' });
      }

      if (new Date() > invitedUser.invitationExpires) {
        return res.status(400).json({ message: 'Invitation token has expired' });
      }

      // Update invited user with password and activate
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date();
      emailVerificationExpires.setDate(emailVerificationExpires.getDate() + 1);

      invitedUser.name = name;
      invitedUser.password = password;
      invitedUser.status = 'active';
      invitedUser.invitationToken = null;
      invitedUser.invitationExpires = null;
      invitedUser.emailVerificationToken = emailVerificationToken;
      invitedUser.emailVerificationExpires = emailVerificationExpires;
      await invitedUser.save();

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerificationToken}`;
      const verificationEmail = emailTemplates.emailVerification(verificationLink);
      await sendEmail(invitedUser.email, verificationEmail.subject, verificationEmail.html);

      // Generate token
      const token = jwt.sign(
        { userId: invitedUser._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        token,
        user: {
          id: invitedUser._id,
          name: invitedUser.name,
          email: invitedUser.email,
          role: invitedUser.role
        }
      });
    }

    // Only buyers can self-register (no invitation token)
    if (userRole !== 'buyer') {
      return res.status(403).json({ 
        message: 'Only buyers can self-register. Suppliers must be onboarded by a buyer.' 
      });
    }

    // Create buyer user
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setDate(emailVerificationExpires.getDate() + 1); // 1 day expiry

    const user = new User({ 
      name, 
      email, 
      password, 
      role: 'buyer',
      status: 'active',
      emailVerificationToken,
      emailVerificationExpires
    });
    await user.save();

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerificationToken}`;
    const verificationEmail = emailTemplates.emailVerification(verificationLink);
    await sendEmail(user.email, verificationEmail.subject, verificationEmail.html);

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Validate role if provided
    if (role && user.role !== role) {
      return res.status(403).json({ 
        message: `This account is registered as a ${user.role === 'seller' ? 'Supplier' : 'Buyer/Admin'}. Please select the correct user type.` 
      });
    }

    // Check if user is active
    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status
    }
  });
});

// Supplier onboarding routes (Buyer only)
// Invite/Onboard a supplier (Buyer only)
router.post('/suppliers/invite', auth, requireRole('buyer'), async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.role === 'seller' && existingUser.onboardedBy?.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'This supplier is already onboarded by you' });
      }
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date();
    invitationExpires.setDate(invitationExpires.getDate() + 7); // 7 days expiry

    // Create invited supplier
    const supplier = new User({
      name,
      email,
      role: 'seller',
      onboardedBy: req.user._id,
      status: 'invited',
      invitationToken,
      invitationExpires,
      password: crypto.randomBytes(16).toString('hex') // Temporary password, will be set on acceptance
    });

    await supplier.save();

    // Send invitation email
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${invitationToken}`;
    const invitationEmail = emailTemplates.supplierInvitation(req.user.name, invitationLink);
    await sendEmail(supplier.email, invitationEmail.subject, invitationEmail.html);

    res.status(201).json({
      message: 'Supplier invited successfully. Invitation email sent.',
      supplier: {
        id: supplier._id,
        name: supplier.name,
        email: supplier.email,
        status: supplier.status
      },
      invitationLink // Still return for manual sharing if needed
    });
  } catch (error) {
    console.error('Invite supplier error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all suppliers onboarded by buyer
router.get('/suppliers', auth, requireRole('buyer'), async (req, res) => {
  try {
    const suppliers = await User.find({ 
      onboardedBy: req.user._id,
      role: 'seller'
    }).select('-password -invitationToken');

    res.json(suppliers);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get supplier by ID
router.get('/suppliers/:id', auth, requireRole('buyer'), async (req, res) => {
  try {
    const supplier = await User.findOne({
      _id: req.params.id,
      onboardedBy: req.user._id,
      role: 'seller'
    }).select('-password -invitationToken');

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update supplier status
router.patch('/suppliers/:id/status', auth, requireRole('buyer'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be active or inactive' });
    }

    const supplier = await User.findOne({
      _id: req.params.id,
      onboardedBy: req.user._id,
      role: 'seller'
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    supplier.status = status;
    await supplier.save();

    res.json({
      message: 'Supplier status updated',
      supplier: {
        id: supplier._id,
        name: supplier.name,
        email: supplier.email,
        status: supplier.status
      }
    });
  } catch (error) {
    console.error('Update supplier status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete/Remove supplier
router.delete('/suppliers/:id', auth, requireRole('buyer'), async (req, res) => {
  try {
    const supplier = await User.findOne({
      _id: req.params.id,
      onboardedBy: req.user._id,
      role: 'seller'
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Soft delete - set status to inactive
    supplier.status = 'inactive';
    await supplier.save();

    res.json({ message: 'Supplier removed successfully' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Password Reset - Request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    const resetEmail = emailTemplates.passwordReset(resetLink);
    await sendEmail(user.email, resetEmail.subject, resetEmail.html);

    res.json({ message: 'If the email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Password Reset - Reset
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Email Verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Resend verification email
router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setDate(emailVerificationExpires.getDate() + 1);

    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save();

    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerificationToken}`;
    const verificationEmail = emailTemplates.emailVerification(verificationLink);
    await sendEmail(user.email, verificationEmail.subject, verificationEmail.html);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update Profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      // If email changed, require verification
      user.email = email;
      user.emailVerified = false;
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date();
      emailVerificationExpires.setDate(emailVerificationExpires.getDate() + 1);
      user.emailVerificationToken = emailVerificationToken;
      user.emailVerificationExpires = emailVerificationExpires;

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${emailVerificationToken}`;
      const verificationEmail = emailTemplates.emailVerification(verificationLink);
      await sendEmail(user.email, verificationEmail.subject, verificationEmail.html);
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change Password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;


