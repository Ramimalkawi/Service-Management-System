import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import sendEmailRoute from "./routes/sendEmail.js";
import createUserRoute from "./routes/createUser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: "solutionssystemmain", // Match the client Firebase config
      // For development, we'll use default credentials or service account key
      // In production, you should use proper service account credentials
    });
    console.log("✅ Firebase Admin SDK initialized");
  } catch (error) {
    console.error(
      "❌ Firebase Admin SDK initialization failed:",
      error.message
    );
    console.log(
      "⚠️ Note: User creation will not work without proper Firebase Admin credentials"
    );
  }
}

dotenv.config();

const app = express();

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, "public")));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
    ],
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  })
);

// Increase the request size limit to handle base64 images in emails
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/sendEmail", sendEmailRoute);
app.use("/api/createUser", createUserRoute);

// API health check route
app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

// Serve React app for all non-API routes
app.use((req, res) => {
  // Only serve React app for GET requests that don't start with /api
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "public/index.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(process.env.PORT || 5001, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5001}`);
  console.log("Available routes:");
  console.log("- GET  /");
  console.log("- POST /api/sendEmail");
  console.log("- POST /api/createUser");
});

// Keep the process alive
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT. Gracefully shutting down...");
  server.close(() => {
    console.log("✅ Server closed.");
    process.exit(0);
  });
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});
