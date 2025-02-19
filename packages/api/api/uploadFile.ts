import formidable from "formidable";
import sharp from "sharp";
import { Request, Response } from "express";

import { uploadFileToPinata } from "../lib/fileStorage.js";

type FormFile = {
  _writeStream: {
    path: string;
  };
};

export default async function uploadFile(
  req: Request,
  res: Response
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (!(req.method === "POST" || req.method == "OPTIONS")) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const fileName = req.query.name as string;
  const form = formidable({});

  try {
    const [, files] = await form.parse(req);
    const file = files[fileName];
    const filePath = (file as unknown as FormFile)._writeStream.path;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Process image with sharp
    const processedImageBuffer = await sharp(filePath)
      .resize(800, 800, { fit: 'inside' })
      .toBuffer();

    const cid = await uploadFileToPinata(processedImageBuffer, fileName);
    if (!cid) {
      return res.status(500).json({ error: "Error uploading file" });
    }

    const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
    return res.status(200).json({ url: gatewayUrl });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return res.status(500).json({ error: "Error uploading file" });
  }
}
