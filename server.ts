import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DATA_FILE_PATH = path.join(process.cwd(), "iam_users.json");

const STATIC_IAM_ROSTER = [
  {
    id: "admin-master",
    name: "Master Admin",
    pin: "123456",
    role: "Master Admin",
    createdAt: "2026-05-25T00:00:00.000Z"
  },
  {
    id: "admin-coor",
    name: "Admin Coordinator",
    pin: "654321",
    role: "Admin",
    createdAt: "2026-05-25T00:00:00.000Z"
  },
  {
    id: "player-read-only",
    name: "Standard Player",
    pin: "111111",
    role: "User",
    createdAt: "2026-05-25T00:00:00.000Z"
  }
];

async function initializeDataFile() {
  try {
    await fs.access(DATA_FILE_PATH);
  } catch {
    // Initialize with default roster
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(STATIC_IAM_ROSTER, null, 2), "utf8");
    console.log("Initialized iam_users.json with default master roster.");
  }
}

async function startServer() {
  await initializeDataFile();

  const app = express();
  app.use(express.json());

  // API endpoint to retrieve IAM user credentials from the server-side JSON database
  app.get("/api/iam/users", async (req, res) => {
    try {
      const content = await fs.readFile(DATA_FILE_PATH, "utf8");
      const users = JSON.parse(content);
      res.json(users);
    } catch (err) {
      console.error("Error reading users JSON file:", err);
      res.json(STATIC_IAM_ROSTER);
    }
  });

  // API endpoint to update the global IAM user credentials list
  app.post("/api/iam/users", async (req, res) => {
    try {
      const updatedUsers = req.body;
      if (Array.isArray(updatedUsers)) {
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(updatedUsers, null, 2), "utf8");
        res.json({ success: true, message: "User credentials successfully persisted on the server." });
      } else {
        res.status(400).json({ error: "Invalid payload format. Expected static roster array." });
      }
    } catch (err) {
      console.error("Error saving users to JSON file:", err);
      res.status(500).json({ error: "Failed to persist users." });
    }
  });

  // Integrate Vite Dev/Build system wrapper
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack Node Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
