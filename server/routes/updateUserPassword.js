// routes/updateUserPassword.js
import express from "express";
import admin from "firebase-admin";

const router = express.Router();

// Handle preflight OPTIONS request
router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept",
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.post("/", async (req, res) => {
  const { uid, newPassword } = req.body;

  if (!uid || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "uid and newPassword are required",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters long",
    });
  }

  try {
    // Update the user's password in Firebase Auth using the Admin SDK.
    // This does not require the user's current password or an active
    // session for that account, unlike the client-side updatePassword API.
    await admin.auth().updateUser(uid, { password: newPassword });

    console.log("✅ Password updated successfully for uid:", uid);
    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update password",
    });
  }
});

export default router;
