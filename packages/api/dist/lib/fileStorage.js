// @ts-ignore
import pinataSDK from '@pinata/sdk';
import "dotenv/config";
const PINATA_JWT = process.env.PINATA_JWT || '';
if (!PINATA_JWT) {
    throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
}
export async function uploadToPinata(fileContents, fileName) {
    try {
        // @ts-ignore
        const pinata = pinataSDK({ pinataJWTKey: PINATA_JWT });
        const result = await pinata.pinFileToIPFS(fileContents, {
            pinataMetadata: {
                name: fileName
            }
        });
        return result.IpfsHash;
    }
    catch (error) {
        console.error('Error uploading to Pinata:', error);
        return null;
    }
}
