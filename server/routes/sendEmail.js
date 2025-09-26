// routes/sendEmail.js

import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Handle preflight OPTIONS request
router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.post("/", async (req, res) => {
  const { to, subject, html } = req.body;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "365 Solutions <help@365solutionsjo.com>", // must be a verified sender in Resend
        to,
        subject,
        html,
      }),
    });
    const data = await response.json();
    if (response.ok) {
      res.status(200).json({ success: true, data });
    } else {
      res.status(500).json({ success: false, error: data });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
