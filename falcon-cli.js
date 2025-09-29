#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";
import Falcon from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage:");
    console.log("  node falcon-cli.js keygen");
    console.log("  node falcon-cli.js sign <message> <hex_sk>");
    console.log("  node falcon-cli.js verify <message> <hex_sig> <hex_pk>");
    process.exit(1);
  }

  // Initialize Falcon
  const falcon = new Falcon();
  
  const cmd = args[0];
  if (cmd === "keygen") {
    console.log("🔑 Generating Falcon keypair...");
    
    // Generate keypair
    const { publicKey, secretKey } = await falcon.keypair();
    
    // Convert to hex for display
    const pkHex = Falcon.bytesToHex(publicKey);
    const skHex = Falcon.bytesToHex(secretKey);
    
    // Display shortened versions for better readability
    const shortenHex = (hex) => {
      if (hex.length <= 40) return hex;
      return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
    };
    
    console.log("PublicKey:", shortenHex(pkHex));
    console.log("SecretKey:", shortenHex(skHex));
    
    // Store full hex values in files for reference
    fs.writeFileSync("falcon_pk_hex.txt", pkHex);
    fs.writeFileSync("falcon_sk_hex.txt", skHex);
    
    // Write keys to binary files (optional)
    fs.writeFileSync("falcon_pk.bin", publicKey);
    fs.writeFileSync("falcon_sk.bin", secretKey);
    
    console.log("Keygen completed successfully");
    console.log(`Public key length: ${publicKey.length} bytes`);
    console.log(`Secret key length: ${secretKey.length} bytes`);
    console.log("Keys saved to falcon_pk.bin and falcon_sk.bin");
    
  } else if (cmd === "sign") {
    if (args.length < 3) {
      console.error("Error: Missing arguments for sign command");
      console.log("Usage: node falcon-cli.js sign <message> <hex_sk>");
      process.exit(1);
    }
    
    const message = args[1];
    const secretKey = args[2]; // Already in hex format
    
    try {
      // Sign the message
      const signature = await falcon.sign(message, secretKey);
      
      // Convert to hex for display
      const sigHex = Falcon.bytesToHex(signature);
      
      // Display shortened version for better readability
      const shortenHex = (hex) => {
        if (hex.length <= 40) return hex;
        return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
      };
      
      console.log("Signature:", shortenHex(sigHex));
      
      // Store full hex value in file for reference
      fs.writeFileSync("falcon_sig_hex.txt", sigHex);
      
      // Write signature to binary file (optional)
      fs.writeFileSync("falcon_sig.bin", signature);
      
      console.log("Signing completed successfully");
      console.log(`Signature length: ${signature.length} bytes`);
      console.log("Signature saved to falcon_sig.bin");
      
    } catch (error) {
      console.error("Error during signing:", error.message);
      process.exit(1);
    }
    
  } else if (cmd === "verify") {
    if (args.length < 4) {
      console.error("Error: Missing arguments for verify command");
      console.log("Usage: node falcon-cli.js verify <message> <hex_sig> <hex_pk>");
      process.exit(1);
    }
    
    const message = args[1];
    const signature = args[2]; // Already in hex format
    const publicKey = args[3]; // Already in hex format
    
    try {
      // Verify the signature
      const result = await falcon.verify(message, signature, publicKey);
      
      console.log(result ? "✅ Verification success" : "❌ Verification failed");
      
    } catch (error) {
      console.error("Error during verification:", error.message);
      process.exit(1);
    }
    
  } else {
    console.error("Unknown command:", cmd);
  }
}

await main();
