import formidable from "formidable";
import sharp from "sharp";
import { Request, Response } from "express";
import { join } from "path";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";

import { uploadFileToPinata } from "../lib/fileStorage.js";
import { setCors } from "../lib/cors.js";

export default async function uploadFile(
  req: Request,
  res: Response
) {
  if (setCors(req, res)) return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fileName = req.query.name as string;

  // Validate fileName: alphanumeric, hyphens, dots only
  if (!fileName || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return res.status(400).json({ error: "Invalid file name" });
  }

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB limit (sharp compresses before IPFS upload)

  try {
    const [fields, files] = await form.parse(req);

    // Get the first file from the files object
    const fileArray = Object.values(files)[0];
    if (!fileArray || !fileArray[0]) {
      return res.status(400).json({ error: "No file provided" });
    }

    const file = fileArray[0];

    // Validate mimetype is an image
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    // Process image with sharp (skip for GIFs to preserve animation)
    const isGif = file.mimetype === 'image/gif';
    const processedImageBuffer = isGif
      ? await readFile(file.filepath)
      : await sharp(file.filepath)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), 'ultimate-dominion-'));
    const tempFilePath = join(tempDir, fileName);
    
    // Write processed image to temp file
    await writeFile(tempFilePath, processedImageBuffer);

    // Upload to Pinata
    const cid = await uploadFileToPinata(tempFilePath, fileName);
    if (!cid) {
      return res.status(500).json({ error: "Error uploading file" });
    }

    return res.status(200).json({ cid });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return res.status(500).json({ error: "Error uploading file" });
  }
}
