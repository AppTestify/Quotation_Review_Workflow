const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
// For development, you can use Gmail, SendGrid, or other services
const createTransporter = () => {
  // If email credentials are not set, return a mock transporter for development
  if (!process.env.EMAIL_HOST) {
    console.warn('Email not configured. Using console logging instead.');
    return {
      sendMail: async (options) => {
        console.log('=== EMAIL (Mock) ===');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Text:', options.text);
        console.log('HTML:', options.html);
        console.log('===================');
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const transporter = createTransporter();

const sendEmail = async (to, subject, html, text) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@quotationreview.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  supplierInvitation: (buyerName, invitationLink) => ({
    subject: 'Invitation to Join Quotation Review System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You've been invited!</h2>
        <p>Hello,</p>
        <p><strong>${buyerName}</strong> has invited you to join as a supplier on the Quotation Review System.</p>
        <p>Click the link below to complete your registration:</p>
        <p style="margin: 30px 0;">
          <a href="${invitationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete Registration
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${invitationLink}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This invitation will expire in 7 days.
        </p>
      </div>
    `
  }),

  passwordReset: (resetLink) => ({
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset</h2>
        <p>Hello,</p>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p style="margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request this, please ignore this email.
        </p>
      </div>
    `
  }),

  newQuotationVersion: (quotationTitle, version, quotationId) => ({
    subject: `New Version Uploaded: ${quotationTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Quotation Version</h2>
        <p>Hello,</p>
        <p>A new version (${version}) of the quotation <strong>"${quotationTitle}"</strong> has been uploaded.</p>
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/quotation/${quotationId}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Quotation
          </a>
        </p>
      </div>
    `
  }),

  quotationStatusChange: (quotationTitle, status, comments, quotationId) => ({
    subject: `Quotation Status Updated: ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Quotation Status Update</h2>
        <p>Hello,</p>
        <p>The status of your quotation <strong>"${quotationTitle}"</strong> has been updated to <strong>${status}</strong>.</p>
        ${comments ? `<p><strong>Comments:</strong></p><p style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">${comments}</p>` : ''}
        <p style="margin-top: 30px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/quotation/${quotationId}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Quotation
          </a>
        </p>
      </div>
    `
  }),

  emailVerification: (verificationLink) => ({
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verify Your Email</h2>
        <p>Hello,</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p style="margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationLink}</p>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  emailTemplates
};

