import { uploadJsonToPinata } from "../lib/fileStorage.js";
export default async function uploadMetadata(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (!(req.method === "POST" || req.method == "OPTIONS")) {
        return res.status(405).json({ error: "Method not allowed" });
    }
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    try {
        const jsonData = req.body;
        console.log('Received metadata:', jsonData);
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Using PINATA_JWT:', process.env.PINATA_JWT ? 'Yes (length: ' + process.env.PINATA_JWT.length + ')' : 'No');
        // Generate a filename based on character name or timestamp
        const fileName = jsonData.name ?
            `character-${jsonData.name}-${Date.now()}.json` :
            `character-${Date.now()}.json`;
        const cid = await uploadJsonToPinata(jsonData, fileName);
        console.log('Upload result CID:', cid);
        if (!cid) {
            console.error('Failed to get CID from Pinata');
            return res.status(500).json({ error: "Error uploading metadata" });
        }
        const gatewayUrl = `https://violet-magnetic-tick-248.mypinata.cloud/ipfs/${cid}`;
        return res.status(200).json({ url: gatewayUrl });
    }
    catch (error) {
        console.error('Error in uploadMetadata:', error);
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
        return res.status(500).json({ error: "Error uploading metadata" });
    }
}
