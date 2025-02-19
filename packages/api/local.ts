import express from "express";
import { config } from "dotenv";
import { uploadMetadata } from "./api/uploadMetadata.js";
import uploadFile from "./api/uploadFile.js";
import sessionBooting from "./api/sessionBooting.js";

config();

const app = express();
const port = process.env.PORT || 8080;

// CORS middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Body parser middleware
app.use(express.json());

// Routes
app.post("/api/upload", uploadMetadata);      // Upload character metadata to IPFS
app.post("/api/upload-file", uploadFile);     // Upload and process image files
app.get("/api/session", sessionBooting);      // Game session management

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
