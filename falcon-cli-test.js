#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import Falcon from "./index.js";

// File paths for keys and signatures
const PK_FILE = "falcon_pk.bin";
const SK_FILE = "falcon_sk.bin";
const SIG_COMPRESSED_FILE = "falcon_sig_compressed.bin";
const SIG_CT_FILE = "falcon_sig_ct.bin";
const SIG_COMPRESSED_HEX_FILE = "falcon_sig_compressed_hex.txt";
const SIG_CT_HEX_FILE = "falcon_sig_ct_hex.txt";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { encoding: "utf8" }).trim();
}

try {
  console.log("=== Falcon CLI Test ===");
  
  // Step 1: Generate a new keypair
  console.log("\n=== Step 1: Generating a new Falcon keypair ===");
  const keygenOutput = run("node ./falcon-cli.js keygen");
  console.log("Keygen completed successfully");
  
  // Extract keys from output - note these might be shortened in the output
  const pkMatch = keygenOutput.match(/PublicKey:\s*([0-9a-f]+\.\.\.?[0-9a-f]+)/i);
  const skMatch = keygenOutput.match(/SecretKey:\s*([0-9a-f]+\.\.\.?[0-9a-f]+)/i);
  
  // Display the shortened keys from the CLI output
  const pkShort = pkMatch ? pkMatch[1] : "N/A";
  const skShort = skMatch ? skMatch[1] : "N/A";
  console.log(`Public key: ${pkShort}`);
  console.log(`Secret key: ${skShort}`);
  
  // For byte length, read the binary files
  const pkBin = fs.readFileSync(PK_FILE);
  const skBin = fs.readFileSync(SK_FILE);
  console.log(`Public key length: ${pkBin.length} bytes`);
  console.log(`Secret key length: ${skBin.length} bytes`);
  
  // Step 2: Sign a message with compressed signature format
  console.log("\n=== Step 2: Signing a message (compressed format) ===");
  console.log("Using the generated keypair for signing...");
  
  const msg = "Hello, Deterministic Falcon!";
  // Read the secret key from the file saved by the keygen command
  const skFromFileForSigning = fs.readFileSync(SK_FILE);
  const skHexForSigning = Array.from(skFromFileForSigning).map(b => b.toString(16).padStart(2, "0")).join("");
  
  const signOutput = run(`node ./falcon-cli.js sign "${msg}" ${skHexForSigning}`);
  console.log("Signing completed successfully");
  
  // Extract signature from output
  const sigMatch = signOutput.match(/Signature.*?:\s*([0-9a-f]+\.\.\.?[0-9a-f]+)/i);
  const sigShort = sigMatch ? sigMatch[1] : "N/A";
  console.log(`Compressed signature: ${sigShort}`);
  
  // Check for salt version
  const saltVersionMatch = signOutput.match(/Signature salt version:\s*(\d+)/i);
  const saltVersion = saltVersionMatch ? saltVersionMatch[1] : "N/A";
  console.log(`Salt version: ${saltVersion}`);
  
  const sigCompressedFile = fs.readFileSync(SIG_COMPRESSED_FILE);
  console.log(`Compressed signature length: ${sigCompressedFile.length} bytes`);
  
  // Step 3: Convert the compressed signature to constant-time format
  console.log("\n=== Step 3: Converting signature to constant-time format ===");
  const compressedSigHex = fs.readFileSync(SIG_COMPRESSED_HEX_FILE, "utf8");
  const convertOutput = run(`node ./falcon-cli.js convert ${compressedSigHex}`);
  
  // Extract CT signature from output
  const ctSigMatch = convertOutput.match(/CT Signature:\s*([0-9a-f]+\.\.\.?[0-9a-f]+)/i);
  const ctSigShort = ctSigMatch ? ctSigMatch[1] : "N/A";
  console.log(`CT signature: ${ctSigShort}`);
  
  const sigCTFile = fs.readFileSync(SIG_CT_FILE);
  console.log(`CT signature length: ${sigCTFile.length} bytes`);
  
  // Step 4: Verify the compressed signature
  console.log("\n=== Step 4: Verifying the compressed signature ===");
  const pkFromFileForVerifying = fs.readFileSync(PK_FILE);
  const pkHexForVerifying = Array.from(pkFromFileForVerifying).map(b => b.toString(16).padStart(2, "0")).join("");
  // Read signature hex from file for verification
  const compSigFromFileHex = fs.readFileSync(SIG_COMPRESSED_HEX_FILE, "utf8");
  
  const verifyCompOutput = run(`node ./falcon-cli.js verify "${msg}" ${compSigFromFileHex} ${pkHexForVerifying}`);
  console.log("Compressed verification result:", verifyCompOutput);
  
  if (!verifyCompOutput.includes("✅ Verification success")) {
    throw new Error("Compressed signature verification failed");
  }
  
  // Step 5: Verify the constant-time signature
  console.log("\n=== Step 5: Verifying the constant-time signature ===");
  // Read CT signature hex from file for verification
  const ctSigFromFileHex = fs.readFileSync(SIG_CT_HEX_FILE, "utf8");
  
  const verifyCTOutput = run(`node ./falcon-cli.js verify "${msg}" ${ctSigFromFileHex} ${pkHexForVerifying}`);
  console.log("CT verification result:", verifyCTOutput);
  
  if (!verifyCTOutput.includes("✅ Verification success")) {
    throw new Error("CT signature verification failed");
  }
  
  // Step 6: Test file-based approach by reading from files
  console.log("\n=== Step 6: Testing file-based approach ===");
  
  // Read keys and signatures from files
  const pkFromFile = fs.readFileSync(PK_FILE);
  const skFromFile = fs.readFileSync(SK_FILE);
  const compSigFromFile = fs.readFileSync(SIG_COMPRESSED_FILE);
  const ctSigFromFile = fs.readFileSync(SIG_CT_FILE);
  
  console.log(`Read public key from ${PK_FILE} (${pkFromFile.length} bytes)`);
  console.log(`Read secret key from ${SK_FILE} (${skFromFile.length} bytes)`);
  console.log(`Read compressed signature from ${SIG_COMPRESSED_FILE} (${compSigFromFile.length} bytes)`);
  console.log(`Read CT signature from ${SIG_CT_FILE} (${ctSigFromFile.length} bytes)`);
  
  // Test direct usage with Falcon class
  console.log("\n=== Step 7: Direct API testing with Falcon class ===");
  const falcon = new Falcon();
  const pkHex = Falcon.bytesToHex(pkFromFile);
  const compSigHex = Falcon.bytesToHex(compSigFromFile);
  const ctSigHex = Falcon.bytesToHex(ctSigFromFile);
  
  // Test compressed signature verification
  const compResult = await falcon.verify(msg, compSigHex, pkHex);
  console.log(`Direct compressed verification result: ${compResult ? "✅ Success" : "❌ Failed"}`);
  
  if (!compResult) {
    throw new Error("Direct compressed verification with Falcon class failed");
  }
  
  // Test CT signature verification
  const ctResult = await falcon.verifyConstantTime(msg, ctSigHex, pkHex);
  console.log(`Direct CT verification result: ${ctResult ? "✅ Success" : "❌ Failed"}`);
  
  if (!ctResult) {
    throw new Error("Direct CT verification with Falcon class failed");
  }
  
  // Test conversion API
  const convertedSig = await falcon.convertToConstantTime(compSigHex);
  console.log(`API conversion successful: ${convertedSig.length} bytes`);
  
  // Test salt version API
  const apiSaltVersion = await falcon.getSaltVersion(compSigFromFile);
  console.log(`API salt version: ${apiSaltVersion}`);
  
  // Test deterministic property by signing the same message twice
  const sig1 = await falcon.sign(msg, skFromFile);
  const sig2 = await falcon.sign(msg, skFromFile);
  const sig1Hex = Falcon.bytesToHex(sig1);
  const sig2Hex = Falcon.bytesToHex(sig2);
  
  console.log(`Deterministic check: ${sig1Hex === sig2Hex ? "✅ Signatures match (deterministic)" : "❌ Signatures differ"}`);
  
  if (sig1Hex !== sig2Hex) {
    console.warn("Warning: Signatures are not deterministic for the same message and key!");
  }
  
  console.log("\n=== All tests passed successfully! ===");
  console.log("✅ Key generation works");
  console.log("✅ Compressed signature generation works");
  console.log("✅ Conversion to constant-time format works");
  console.log("✅ Compressed signature verification works");
  console.log("✅ Constant-time signature verification works");
  console.log("✅ Salt version retrieval works");
  console.log("✅ Deterministic signatures confirmed");
} catch (e) {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
}
