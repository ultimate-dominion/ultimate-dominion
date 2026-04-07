import formidable, { type File as FormidableFile } from "formidable";
import sharp from "sharp";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";
import { join } from "path";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";

import { uploadFileToPinata } from "../lib/fileStorage.js";
import { setCors } from "../lib/cors.js";

export default async function uploadFile(req: VercelRequest, res: VercelResponse): Promise<unknown>;
export default async function uploadFile(req: Request, res: Response): Promise<unknown>;
export default async function uploadFile(
  req: VercelRequest | Request,
  res: VercelResponse | Response
) {
  const request = req as VercelRequest & Request;
  const response = res as VercelResponse & Response;
  if (setCors(request, response)) return response.status(204).end();

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const fileName = request.query.name as string;

  // Validate fileName: alphanumeric, hyphens, dots only
  if (!fileName || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return response.status(400).json({ error: "Invalid file name" });
  }

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB limit (sharp compresses before IPFS upload)

  try {
    const [_fields, files] = await form.parse(request);

    // Get the first file from the files object
    const firstEntry = Object.values(files)[0] as FormidableFile[] | FormidableFile | undefined;
    const file = Array.isArray(firstEntry) ? firstEntry[0] : firstEntry;
    if (!file) {
      return response.status(400).json({ error: "No file provided" });
    }

    // Validate mimetype is an image
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return response.status(400).json({ error: "Only image files are allowed" });
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
      return response.status(500).json({ error: "Error uploading file" });
    }

    return response.status(200).json({ cid });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return response.status(500).json({ error: "Error uploading file" });
  }
}
