import { uploadJsonToPinata } from "../lib/fileStorage.js";
export default async function uploadMetadata(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const jsonData = req.body;
        // Validate metadata schema
        if (!jsonData || typeof jsonData !== 'object' || !jsonData.name) {
            return res.status(400).json({ error: "Invalid metadata: 'name' field is required" });
        }
        // Generate a filename based on character name or timestamp
        const fileName = jsonData.name ?
            `character-${jsonData.name}-${Date.now()}.json` :
            `character-${Date.now()}.json`;
        const cid = await uploadJsonToPinata(jsonData, fileName);
        if (!cid) {
            console.error('Failed to get CID from Pinata');
            return res.status(500).json({ error: "Error uploading metadata" });
        }
        const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
        return res.status(200).json({ url: gatewayUrl });
    }
    catch (error) {
        console.error('Error in uploadMetadata:', error);
        return res.status(500).json({ error: "Error uploading metadata" });
    }
}
