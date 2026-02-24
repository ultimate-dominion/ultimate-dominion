import formidable from "formidable";
import sharp from "sharp";
import { join } from "path";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { uploadFileToPinata } from "../lib/fileStorage.js";
export default async function uploadFile(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    if (!(req.method === "POST" || req.method == "OPTIONS")) {
        return res.status(405).json({ error: "Method not allowed" });
    }
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    const fileName = req.query.name;
    const form = formidable({});
    try {
        const [fields, files] = await form.parse(req);
        console.log('Received files:', Object.keys(files));
        // Get the first file from the files object
        const fileArray = Object.values(files)[0];
        if (!fileArray || !fileArray[0]) {
            return res.status(400).json({ error: "No file provided" });
        }
        const file = fileArray[0];
        console.log('File details:', {
            filepath: file.filepath,
            originalFilename: file.originalFilename,
            mimetype: file.mimetype
        });
        // Process image with sharp
        const processedImageBuffer = await sharp(file.filepath)
            .resize(800, 800, { fit: 'inside' })
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
        const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
        return res.status(200).json({ url: gatewayUrl });
    }
    catch (error) {
        console.error('Error in uploadFile:', error);
        return res.status(500).json({ error: "Error uploading file" });
    }
}
