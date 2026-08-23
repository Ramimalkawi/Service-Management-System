import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sendEmailRoute from "./routes/sendEmail.js";
import createUserRoute from "./routes/createUser.js";
import updateUserPasswordRoute from "./routes/updateUserPassword.js";
import archiveTicketsRoute from "./routes/archiveTickets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env explicitly — without a path, dotenv looks relative to
// process.cwd(), which is wrong whenever this server isn't started with
// server/ as the working directory (e.g. `npm start` from the repo root).
dotenv.config({ path: path.join(__dirname, ".env") });

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    let serviceAccount = null;
    let credentialSource = null;

    // 1. A base64-encoded service account JSON in an env var — the most
    //    portable option for hosts like Render/Railway/Heroku, where you
    //    can't drop a key file onto the filesystem but can set an env var.
    //    Base64 also sidesteps dashboards mangling the private_key field's
    //    embedded newlines when a raw JSON string is pasted in.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      serviceAccount = JSON.parse(
        Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          "base64",
        ).toString("utf8"),
      );
      credentialSource = "FIREBASE_SERVICE_ACCOUNT_BASE64 env var";
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // 2. The raw JSON pasted directly into an env var (works as long as
      //    the host preserves the string exactly).
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credentialSource = "FIREBASE_SERVICE_ACCOUNT_JSON env var";
    } else {
      // 3. A local key file, e.g. for development — resolved against this
      //    file's own directory rather than process.cwd(), which is wrong
      //    whenever the server isn't started with server/ as the working
      //    directory (e.g. `npm start` from the repo root).
      const rawCredentialsPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        "./serviceAccountKey.json";
      const serviceAccountPath = path.isAbsolute(rawCredentialsPath)
        ? rawCredentialsPath
        : path.join(__dirname, rawCredentialsPath);

      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, "utf8"),
        );
        credentialSource = serviceAccountPath;
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "solutionssystemmain",
      });
      console.log(
        "✅ Firebase Admin SDK initialized with service account:",
        credentialSource,
      );
    } else {
      // Fall back to Application Default Credentials (works on GCP-hosted
      // infrastructure like Cloud Run/Functions without a key file).
      admin.initializeApp({
        projectId: "solutionssystemmain",
      });
      console.log(
        "⚠️ No service account credentials found (checked FIREBASE_SERVICE_ACCOUNT_BASE64, " +
          "FIREBASE_SERVICE_ACCOUNT_JSON, and a local key file) — falling back to Application Default Credentials.",
      );
    }
  } catch (error) {
    console.error(
      "❌ Firebase Admin SDK initialization failed:",
      error.message,
    );
    console.log(
      "⚠️ Note: User creation/password updates will not work without proper Firebase Admin credentials",
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
  }),
);

// Increase the request size limit to handle base64 images in emails
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/sendEmail", sendEmailRoute);
app.use("/api/createUser", createUserRoute);
app.use("/api/updateUserPassword", updateUserPasswordRoute);
app.use("/api/archive", archiveTicketsRoute);

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
  console.log("- POST /api/updateUserPassword");
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
