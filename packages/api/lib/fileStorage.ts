import pinataSDK from '@pinata/sdk';
import { createReadStream } from "fs";

const PINATA_JWT = process.env.PINATA_JWT || '';

if (!PINATA_JWT) {
  throw new Error(`Invalid/Missing environment variable: "PINATA_JWT"`);
}

// Initialize Pinata once
// @ts-expect-error - Pinata SDK initialization type mismatch
const pinata = new pinataSDK({ pinataJWTKey: PINATA_JWT });

// Test Pinata connection on startup
pinata.testAuthentication().then(() => {
  console.log('Successfully connected to Pinata');
}).catch((error) => {
  console.error('Failed to connect to Pinata:', error);
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
});

/**
 * Upload JSON metadata to Pinata
 * @param jsonData JSON data
 * @param fileName Name to store the file as
 * @returns IPFS hash or null if upload fails
 */
export async function uploadJsonToPinata(jsonData: Record<string, unknown>, fileName: string): Promise<string | null> {
  try {
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
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return null;
  }
}

/**
 * Upload binary file to Pinata
 * @param filePath Path to the file
 * @param fileName Name to store the file as
 * @returns IPFS hash or null if upload fails
 */
export async function uploadFileToPinata(filePath: string, fileName: string): Promise<string | null> {
  try {
    console.log('Uploading file to Pinata...');
    const readStream = createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(readStream, {
      pinataMetadata: {
        name: fileName
      }
    });
    console.log('Pinata result:', result);

    return result.IpfsHash;
  } catch (error) {
    console.error('Error uploading file to Pinata:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return null;
  }
}
