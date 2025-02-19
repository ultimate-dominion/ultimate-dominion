import pinataSDK from '@pinata/sdk';
import "dotenv/config";

const PINATA_JWT = process.env.PINATA_JWT || '';

if (!PINATA_JWT) {
  throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
}

// Initialize Pinata once
// @ts-expect-error - Pinata SDK initialization type mismatch
const pinata = new pinataSDK({ pinataJWTKey: PINATA_JWT });

/**
 * Upload JSON metadata to Pinata
 * @param fileContents Buffer containing JSON data
 * @param fileName Name to store the file as
 * @returns IPFS hash or null if upload fails
 */
export async function uploadJsonToPinata(fileContents: Buffer, fileName: string): Promise<string | null> {
  try {
    console.log('Parsing JSON data...');
    const jsonData = JSON.parse(fileContents.toString());
    console.log('JSON data:', jsonData);
    
    console.log('Uploading JSON to Pinata...');
    const result = await pinata.pinJSONToIPFS(jsonData, {
      pinataMetadata: {
        name: fileName
      }
    });
    console.log('Pinata result:', result);

    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading JSON to Pinata:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Upload binary file to Pinata
 * @param fileContents Buffer containing file data
 * @param fileName Name to store the file as
 * @returns IPFS hash or null if upload fails
 */
export async function uploadFileToPinata(fileContents: Buffer, fileName: string): Promise<string | null> {
  try {
    console.log('Uploading file to Pinata...');
    const result = await pinata.pinFileToIPFS(fileContents, {
      pinataMetadata: {
        name: fileName
      }
    });
    console.log('Pinata result:', result);

    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}
