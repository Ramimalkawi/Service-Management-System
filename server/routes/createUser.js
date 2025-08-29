// routes/createUser.js
import express from "express";
import admin from "firebase-admin";

const router = express.Router();

// Handle preflight OPTIONS request
router.options("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

router.post("/", async (req, res) => {
  const { email, password, userData } = req.body;
  console.log("Creating user with email:", email);

  try {
    // Create user in Firebase Auth using Admin SDK
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      disabled: false,
    });

    // Create the technician record in Firestore
    await admin
      .firestore()
      .collection("technicions")
      .add({
        ...userData,
        email: email,
        uid: userRecord.uid,
        createdAt: new Date(),
      });

    console.log("✅ User created successfully:", userRecord.uid);
    res.status(200).json({
      success: true,
      uid: userRecord.uid,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create user",
    });
  }
});

export default router;
