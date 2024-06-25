import { VercelRequest, VercelResponse } from "@vercel/node";

import { uploadToPinata } from "../lib/fileStorage";

const uploadMetadata = async (req: VercelRequest, res: VercelResponse) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (!(req.method === "POST" || req.method == "OPTIONS")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const fileName = req.query.name as string;
    const metadata = req.body;

    console.log(metadata);

    const fileContents = Buffer.from(JSON.stringify(metadata));
    const cid = await uploadToPinata(fileContents, fileName);
    if (!cid) {
      return res.status(500).json({ error: "Error uploading file" });
    }
    return res.status(200).json({ cid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

export default uploadMetadata;
