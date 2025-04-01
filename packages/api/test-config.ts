import { getNetworkConfig } from "./lib/getNetworkConfig.js";

async function testConfig() {
  try {
    const config = await getNetworkConfig();
    console.log("Network Config:");
    console.log(JSON.stringify(config, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    // Check if indexerUrl exists
    console.log("\nIndexer URL check:");
    console.log("config.chain.indexerUrl:", config.chain.indexerUrl);
    
    // Check WebSocket URL
    console.log("\nWebSocket URL check:");
    const wsUrls = config.chain.rpcUrls?.default?.webSocket || 
                  config.chain.rpcUrls?.public?.webSocket || 
                  ["None configured"];
    console.log("WebSocket URLs:", wsUrls);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testConfig();
