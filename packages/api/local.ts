import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import uploadMetadata from "./api/uploadMetadata.js";
import uploadFile from "./api/uploadFile.js";
import sessionBooting from "./api/sessionBooting.js";

// Load configuration from the .env file
config();

const app = express();

// CORS - restrict to allowed origins
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({ origin: allowedOrigins }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

app.use(express.json());

// Set up local storage directory path for development mode
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'dev-storage');

// Routes
app.post("/api/upload", uploadMetadata);      // Upload character metadata to IPFS
app.post("/api/upload-file", uploadFile);     // Upload and process image files
app.get("/api/session", sessionBooting);      // Game session management

// Serve local files in development mode
app.get("/files/:filename", (req, res) => {
  let filename = req.params.filename;
  
  // If filename starts with 'local-', strip it to find the actual file
  // This is because the client sends the full identifier, but we store without the prefix
  if (filename.startsWith('local-')) {
    filename = filename.substring(6); // Remove 'local-' prefix
  }
  
  const resolvedPath = path.resolve(LOCAL_STORAGE_DIR, filename);

  // Prevent path traversal
  if (!resolvedPath.startsWith(path.resolve(LOCAL_STORAGE_DIR))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const filePath = resolvedPath;
  console.log(`Attempting to serve file: ${filePath}`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return res.status(404).json({ error: "File not found" });
  }
  
  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let contentType = "application/octet-stream";
  
  switch (ext) {
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
    case ".jpeg":
      contentType = "image/jpeg";
      break;
    case ".gif":
      contentType = "image/gif";
      break;
  }
  
  res.setHeader("Content-Type", contentType);
  
  // Stream the file to the response
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

const port = process.env.API_PORT || 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
