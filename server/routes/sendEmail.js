// routes/sendEmail.js
import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// Handle preflight OPTIONS request
router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.post("/", async (req, res) => {
  const { to, subject, html, location } = req.body;
  console.log("Start to send email via SMTP");

  try {
    // Configure SMTP settings based on location (similar to Swift implementation)
    const smtpConfig = {
      host: "mail.365solutionsjo.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user:
          location === "M"
            ? "help@365solutionsjo.com"
            : "irbid@365solutionsjo.com",
        pass: location === "M" ? "Help@365" : "irbid_123",
      },
    };

    // Create transporter
    const transporter = nodemailer.createTransport(smtpConfig);

    // Email options
    const mailOptions = {
      from: {
        name: "365Solutions",
        address:
          location === "M"
            ? "help@365solutionsjo.com"
            : "irbid@365solutionsjo.com",
      },
      to: to,
      subject: subject,
      html: html,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("❌ Email error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
