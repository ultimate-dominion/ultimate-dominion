import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response } from "express";
import { uploadJsonToPinata } from "../lib/fileStorage.js";
import { setCors } from "../lib/cors.js";

export default async function uploadMetadata(req: VercelRequest, res: VercelResponse): Promise<unknown>;
export default async function uploadMetadata(req: Request, res: Response): Promise<unknown>;
export default async function uploadMetadata(
  req: VercelRequest | Request,
  res: VercelResponse | Response
) {
  const request = req as VercelRequest & Request;
  const response = res as VercelResponse & Response;
  if (setCors(request, response)) return response.status(204).end();

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    const jsonData = request.body;

    // Validate metadata schema
    if (!jsonData || typeof jsonData !== 'object' || !jsonData.name) {
      return response.status(400).json({ error: "Invalid metadata: 'name' field is required" });
    }

    // Generate a filename based on character name or timestamp
    const fileName = jsonData.name ? 
      `character-${jsonData.name}-${Date.now()}.json` : 
      `character-${Date.now()}.json`;

    const cid = await uploadJsonToPinata(jsonData, fileName);

    if (!cid) {
      console.error('Failed to get CID from Pinata');
      return response.status(500).json({ error: "Error uploading metadata" });
    }

    const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
    return response.status(200).json({ url: gatewayUrl });
  } catch (error: unknown) {
    console.error('Error in uploadMetadata:', error);
    return response.status(500).json({ error: "Error uploading metadata" });
  }
}
