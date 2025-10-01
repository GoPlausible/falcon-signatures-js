#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";
import Falcon from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  // Initialize Falcon
  const falcon = new Falcon();

  const cmd = args[0];
  
  try {
    switch (cmd) {
      case "keygen":
        await handleKeygen(falcon);
        break;
      case "sign":
        await handleSign(falcon, args);
        break;
      case "verify":
        await handleVerify(falcon, args);
        break;
      case "convert":
        await handleConvert(falcon, args);
        break;
      case "help":
        printUsage();
        break;
      default:
        console.error("Unknown command:", cmd);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error during ${cmd} operation:`, error.message);
    process.exit(1);
  }
}

function printUsage() {
  console.log("Falcon Deterministic Signatures CLI");
  console.log("");
  console.log("Usage:");
  console.log("  node falcon-cli.js keygen");
  console.log("  node falcon-cli.js sign <message> <hex_sk>");
  console.log("  node falcon-cli.js verify <message> <hex_sig> <hex_pk>");
  console.log("  node falcon-cli.js convert <hex_compressed_sig>");
  console.log("");
  console.log("Options:");
  console.log("  keygen    Generate a new Falcon-1024 keypair");
  console.log("  sign      Sign a message using a secret key (produces compressed signature)");
  console.log("  verify    Verify a signature (compressed or CT) using a public key");
  console.log("  convert   Convert a compressed signature to constant-time format");
  console.log("  help      Show this help message");
}

async function handleKeygen(falcon) {
  console.log("🔑 Generating Falcon-1024 deterministic keypair...");
  
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
  
  // Write keys to binary files
  fs.writeFileSync("falcon_pk.bin", publicKey);
  fs.writeFileSync("falcon_sk.bin", secretKey);
  
  console.log("Keygen completed successfully");
  console.log(`Public key length: ${publicKey.length} bytes`);
  console.log(`Secret key length: ${secretKey.length} bytes`);
  console.log("Keys saved to falcon_pk.bin and falcon_sk.bin");
}

async function handleSign(falcon, args) {
  if (args.length < 3) {
    console.error("Error: Missing arguments for sign command");
    console.log("Usage: node falcon-cli.js sign <message> <hex_sk>");
    process.exit(1);
  }
  
  const message = args[1];
  const secretKey = args[2]; // Already in hex format
  
  // Sign the message (produces compressed format by default)
  const signature = await falcon.sign(message, secretKey);
  
  // Convert to hex for display
  const sigHex = Falcon.bytesToHex(signature);
  
  // Display shortened version for better readability
  const shortenHex = (hex) => {
    if (hex.length <= 40) return hex;
    return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
  };
  
  console.log("Signature (compressed format):", shortenHex(sigHex));
  
  // Get the salt version
  const saltVersion = await falcon.getSaltVersion(signature);
  console.log(`Signature salt version: ${saltVersion}`);
  
  // Store full hex value in file for reference
  fs.writeFileSync("falcon_sig_compressed_hex.txt", sigHex);
  
  // Write signature to binary file
  fs.writeFileSync("falcon_sig_compressed.bin", signature);
  
  console.log("Signing completed successfully");
  console.log(`Signature length: ${signature.length} bytes`);
  console.log("Signature saved to falcon_sig_compressed.bin");
}

async function handleVerify(falcon, args) {
  if (args.length < 4) {
    console.error("Error: Missing arguments for verify command");
    console.log("Usage: node falcon-cli.js verify <message> <hex_sig> <hex_pk>");
    process.exit(1);
  }
  
  const message = args[1];
  const signature = args[2]; // Already in hex format
  const publicKey = args[3]; // Already in hex format
  
  try {
    // Convert signature from hex to bytes
    const sigBytes = Falcon.hexToBytes(signature);
    
    // Determine signature type based on the header byte
    const headerByte = sigBytes[0];
    const isCompressed = (headerByte === 0xBA); // FALCON_DET1024_SIG_COMPRESSED_HEADER
    const isCT = (headerByte === 0xDA); // FALCON_DET1024_SIG_CT_HEADER
    
    let result;
    if (isCompressed) {
      console.log("Detected compressed signature format");
      result = await falcon.verify(message, signature, publicKey);
    } else if (isCT) {
      console.log("Detected constant-time signature format");
      result = await falcon.verifyConstantTime(message, signature, publicKey);
    } else {
      console.error(`Unknown signature format (header byte: 0x${headerByte.toString(16)})`);
      process.exit(1);
    }
    
    console.log(result ? "✅ Verification success" : "❌ Verification failed");
  } catch (error) {
    console.error("Error during verification:", error.message);
    process.exit(1);
  }
}

async function handleConvert(falcon, args) {
  if (args.length < 2) {
    console.error("Error: Missing arguments for convert command");
    console.log("Usage: node falcon-cli.js convert <hex_compressed_sig>");
    process.exit(1);
  }
  
  const compressedSigHex = args[1];
  
  try {
    // Convert from compressed to CT format
    const ctSignature = await falcon.convertToConstantTime(compressedSigHex);
    
    // Convert to hex for display
    const ctSigHex = Falcon.bytesToHex(ctSignature);
    
    // Display shortened version for better readability
    const shortenHex = (hex) => {
      if (hex.length <= 40) return hex;
      return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
    };
    
    console.log("CT Signature:", shortenHex(ctSigHex));
    
    // Store full hex value in file for reference
    fs.writeFileSync("falcon_sig_ct_hex.txt", ctSigHex);
    
    // Write signature to binary file
    fs.writeFileSync("falcon_sig_ct.bin", ctSignature);
    
    console.log("Conversion completed successfully");
    console.log(`CT Signature length: ${ctSignature.length} bytes`);
    console.log("CT Signature saved to falcon_sig_ct.bin");
  } catch (error) {
    console.error("Error during conversion:", error.message);
    process.exit(1);
  }
}

await main();
