import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const ARCHIVE_ROOT = path.join(__dirname, "..", "public", "archived-tickets");

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const sanitizePart = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const normalizeYear = (year) => {
  const num = parseInt(year, 10);
  if (Number.isNaN(num) || num < 2000 || num > 2100) return null;
  return String(num);
};

const deriveFileName = (tickets, label) => {
  const safeLabel = sanitizePart(label);
  if (safeLabel) return `${safeLabel}.json`;

  const nums = (tickets || [])
    .map((t) => t.ticketNum ?? t.number)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));

  if (nums.length === 0) {
    return `archive_${Date.now()}.json`;
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = (n) => String(n).padStart(4, "0");
  return `${pad(min)}__${pad(max)}.json`;
};

router.post("/", async (req, res) => {
  try {
    const { year, label, tickets } = req.body || {};
    const normalizedYear = normalizeYear(year);
    if (!normalizedYear) {
      return res.status(400).json({ error: "Invalid year" });
    }
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "Tickets array is required" });
    }

    const yearDir = path.join(ARCHIVE_ROOT, normalizedYear);
    await ensureDir(yearDir);

    const fileName = deriveFileName(tickets, label);
    const filePath = path.join(yearDir, fileName);

    const payload = {
      archivedAt: new Date().toISOString(),
      year: normalizedYear,
      label: label || null,
      count: tickets.length,
      tickets,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");

    return res.json({
      ok: true,
      file: fileName,
      path: `/archived-tickets/${normalizedYear}/${fileName}`,
      count: tickets.length,
    });
  } catch (error) {
    console.error("Archive save failed:", error);
    return res.status(500).json({ error: "Failed to save archive" });
  }
});

router.get("/years", async (_req, res) => {
  try {
    await ensureDir(ARCHIVE_ROOT);
    console.log("Reading archive root:", ARCHIVE_ROOT);
    const entries = await fs.readdir(ARCHIVE_ROOT, { withFileTypes: true });
    const years = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => Number(b) - Number(a));

    return res.json({ years });
  } catch (error) {
    console.error("Archive years fetch failed:", error);
    return res.status(500).json({ error: "Failed to load archive years" });
  }
});

router.get("/files", async (req, res) => {
  try {
    const normalizedYear = normalizeYear(req.query.year);
    if (!normalizedYear) {
      return res.status(400).json({ error: "Invalid year" });
    }

    const yearDir = path.join(ARCHIVE_ROOT, normalizedYear);
    await ensureDir(yearDir);

    const entries = await fs.readdir(yearDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();

    return res.json({ year: normalizedYear, files });
  } catch (error) {
    console.error("Archive files fetch failed:", error);
    return res.status(500).json({ error: "Failed to load archive files" });
  }
});

export default router;
