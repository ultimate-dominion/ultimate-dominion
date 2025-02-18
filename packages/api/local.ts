import express from "express";
import { config } from "dotenv";
import { uploadMetadata } from "./api/uploadMetadata.js";

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
app.post("/api/upload", uploadMetadata);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
