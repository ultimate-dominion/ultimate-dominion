import formidable from "formidable";
import sharp from "sharp";
import { Request, Response } from "express";

import { uploadToPinata } from "../lib/fileStorage.js";

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
    const formFile = files[fileName] as [FormFile] | undefined;

    if (!formFile) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileContents = await sharp(formFile[0]._writeStream.path)
      .resize(700)
      .png()
      .toBuffer();

    const cid = await uploadToPinata(fileContents, `${fileName}.png`);
    if (!cid) {
      return res.status(500).json({ error: "Error uploading file" });
    }

    return res.status(200).json({ cid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
