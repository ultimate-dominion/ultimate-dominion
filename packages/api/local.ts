import express from "express";
import uploadFile from "./api/uploadFile.js";
import uploadMetadata from "./api/uploadMetadata.js";
import sessionBooting from "./api/sessionBooting.js";
import { VercelRequest, VercelResponse } from "@vercel/node";
import "dotenv/config";

const PORT = 8080;

if (process.env.NODE_ENV !== "production") {
  const app = express();

  app.use(express.json());

  app.use("/api/uploadFile", (req: unknown, res: unknown) => {
    uploadFile(req as VercelRequest, res as VercelResponse);
  });

  app.use("/api/uploadMetadata", (req: unknown, res: unknown) => {
    uploadMetadata(req as VercelRequest, res as VercelResponse);
  });

  app.use("/api/sessionBooting", (req: unknown, res: unknown) => {
    sessionBooting(req as VercelRequest, res as VercelResponse);
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
} else {
  throw new Error("local.js should not be used in production");
}
