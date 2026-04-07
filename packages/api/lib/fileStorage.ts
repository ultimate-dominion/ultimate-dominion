import pinataSDK from '@pinata/sdk';
import { createReadStream } from "fs";
import * as fs from 'fs';
import * as path from 'path';

const PINATA_JWT = process.env.PINATA_JWT || '';
const IS_DEV_MODE = !PINATA_JWT || process.env.NODE_ENV === 'development';

// Set up local storage directory for development mode
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'dev-storage');
if (IS_DEV_MODE && !fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

// Define a type for Pinata client to avoid 'any'
type PinataClient = {
  pinJSONToIPFS: (jsonBody: object, options: object) => Promise<{IpfsHash: string}>;
  pinFileToIPFS: (readStream: fs.ReadStream, options: object) => Promise<{IpfsHash: string}>;
  testAuthentication: () => Promise<object>;
};

// Initialize Pinata if JWT is available
let pinata: PinataClient | null = null;
if (!IS_DEV_MODE) {
  try {
    const PinataSDK = pinataSDK as unknown as new (args: { pinataJWTKey: string }) => PinataClient;
    pinata = new PinataSDK({ pinataJWTKey: PINATA_JWT });
    
    // Test Pinata connection on startup
    if (pinata) {
      pinata.testAuthentication().then(() => {
        // connected
      }).catch((error: unknown) => {
        console.error('Failed to connect to Pinata:', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize Pinata:', error);
  }
}

/**
 * Upload JSON metadata to Pinata or local storage in development mode
 * @param jsonData JSON data
 * @param fileName Name to store the file as
 * @returns IPFS hash or local file ID if successful, null if upload fails
 */
export async function uploadJsonToPinata(jsonData: Record<string, unknown>, fileName: string): Promise<string | null> {
  // In development mode, save to local file system
  if (IS_DEV_MODE) {
    try {
      const safeFileName = fileName.replace(/[^a-z0-9-_.]/gi, '_') || 'character-metadata.json';
      const timestamp = new Date().getTime();
      const filePath = path.join(LOCAL_STORAGE_DIR, `${timestamp}-${safeFileName}`);
      
      // Add dev mode metadata
      const jsonWithMetadata = {
        ...jsonData,
        _devModeMetadata: {
          timestamp: new Date().toISOString(),
          type: 'character-metadata'
        }
      };
      
      await fs.promises.writeFile(filePath, JSON.stringify(jsonWithMetadata, null, 2));

      // Return a local identifier
      return `local-${timestamp}-${safeFileName}`;
    } catch (error) {
      console.error('Error saving JSON locally:', error);
      return null;
    }
  }
  
  // Production mode - use Pinata
  if (!pinata) {
    console.error('Pinata client not initialized');
    return null;
  }

  try {
    const result = await pinata.pinJSONToIPFS(jsonData, {
      pinataMetadata: {
        name: fileName || 'character-metadata.json',
        keyvalues: {
          type: 'character-metadata',
          timestamp: new Date().toISOString()
        }
      }
    });

    return result.IpfsHash;
  } catch (error: unknown) {
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
 * Upload binary file to Pinata or local storage in development mode
 * @param filePath Path to the file
 * @param fileName Name to store the file as
 * @returns IPFS hash or local file ID if successful, null if upload fails
 */
export async function uploadFileToPinata(filePath: string, fileName: string): Promise<string | null> {
  // In development mode, save to local file system
  if (IS_DEV_MODE) {
    try {
      const safeFileName = fileName.replace(/[^a-z0-9-_.]/gi, '_');
      const timestamp = new Date().getTime();
      const destPath = path.join(LOCAL_STORAGE_DIR, `${timestamp}-${safeFileName}`);
      
      // Copy the file to local storage
      await fs.promises.copyFile(filePath, destPath);

      // Return a local identifier
      return `local-${timestamp}-${safeFileName}`;
    } catch (error) {
      console.error('Error saving file locally:', error);
      return null;
    }
  }
  
  // Production mode - use Pinata
  if (!pinata) {
    console.error('Pinata client not initialized');
    return null;
  }
  
  try {
    const readStream = createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(readStream, {
      pinataMetadata: {
        name: fileName
      }
    });

    return result.IpfsHash;
  } catch (error: unknown) {
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
