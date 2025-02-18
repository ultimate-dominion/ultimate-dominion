import { Request, Response } from 'express';
import { uploadToPinata } from '../lib/fileStorage.js';

export async function uploadMetadata(req: Request, res: Response) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (!(req.method === "POST" || req.method === "OPTIONS")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const fileName = req.query.name as string;
    const metadata = req.body;

    // eslint-disable-next-line no-console
    console.log(metadata);

    const fileContents = Buffer.from(JSON.stringify(metadata));
    const cid = await uploadToPinata(fileContents, fileName);
    if (!cid) {
      return res.status(500).json({ error: "Error uploading file" });
    }
    const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
    return res.status(200).json({ url: gatewayUrl });
  } catch (error) {
    console.error('Error in uploadMetadata:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
