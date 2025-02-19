import express from "express";
import cors from "cors";
import { config } from "dotenv";
import uploadMetadata from "./api/uploadMetadata.js";
import uploadFile from "./api/uploadFile.js";
import sessionBooting from "./api/sessionBooting.js";

config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.post("/api/upload", uploadMetadata);      // Upload character metadata to IPFS
app.post("/api/upload-file", uploadFile);     // Upload and process image files
app.get("/api/session", sessionBooting);      // Game session management

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
