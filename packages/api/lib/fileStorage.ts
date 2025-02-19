import pinataSDK from '@pinata/sdk';
import "dotenv/config";

const PINATA_JWT = process.env.PINATA_JWT || '';

if (!PINATA_JWT) {
  throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
}

export async function uploadToPinata(fileContents: Buffer, fileName: string): Promise<string | null> {
  try {
    // @ts-expect-error - Pinata SDK initialization type mismatch
    const pinata = pinataSDK({ pinataJWTKey: PINATA_JWT });
    
    const jsonData = JSON.parse(fileContents.toString());
    const result = await pinata.pinJSONToIPFS(jsonData, {
      pinataMetadata: {
        name: fileName
      }
    });

    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    return null;
  }
}
