import pinataSDK from '@pinata/sdk';
import "dotenv/config";

const PINATA_JWT = process.env.PINATA_JWT || '';

if (!PINATA_JWT) {
  throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
}

export async function uploadToPinata(fileContents: Buffer, fileName: string): Promise<string | null> {
  try {
    console.log('Initializing Pinata with JWT length:', PINATA_JWT.length);
    // @ts-expect-error - Pinata SDK initialization type mismatch
    const pinata = pinataSDK({ pinataJWTKey: PINATA_JWT });
    
    console.log('Parsing JSON data...');
    const jsonData = JSON.parse(fileContents.toString());
    console.log('JSON data:', jsonData);
    
    console.log('Uploading to Pinata...');
    const result = await pinata.pinJSONToIPFS(jsonData, {
      pinataMetadata: {
        name: fileName
      }
    });
    console.log('Pinata result:', result);

    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}
