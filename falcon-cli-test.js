#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import Falcon from "./index.js";

// File paths for keys and signatures
const PK_FILE = "falcon_pk.bin";
const SK_FILE = "falcon_sk.bin";
const SIG_FILE = "falcon_sig.bin";

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
  
  // Step 2: Sign a message
  console.log("\n=== Step 2: Signing a message ===");
  console.log("Generating a new keypair for signing...");
  
  // First generate a new keypair to test with
  run("node ./falcon-cli.js keygen");
  
  const msg = "Hello, Falcon!";
  // Read the secret key from the file saved by the keygen command
  const skFromFileForSigning = fs.readFileSync(SK_FILE);
  const skHexForSigning = Array.from(skFromFileForSigning).map(b => b.toString(16).padStart(2, "0")).join("");
  
  const signOutput = run(`node ./falcon-cli.js sign "${msg}" ${skHexForSigning}`);
  console.log("Signing completed successfully");
  
  // Extract signature from output
  const sigMatch = signOutput.match(/Signature:\s*([0-9a-f]+\.\.\.?[0-9a-f]+)/i);
  const sigShort = sigMatch ? sigMatch[1] : "N/A";
  console.log(`Signature: ${sigShort}`);
  
  const sigFile = fs.readFileSync(SIG_FILE);
  console.log(`Signature length: ${sigFile.length} bytes`);
  
  // Step 3: Verify the signature
  console.log("\n=== Step 3: Verifying the signature ===");
  const pkFromFileForVerifying = fs.readFileSync(PK_FILE);
  const pkHexForVerifying = Array.from(pkFromFileForVerifying).map(b => b.toString(16).padStart(2, "0")).join("");
  // Read signature hex from file for verification
  const sigFromFileHex = fs.readFileSync("falcon_sig_hex.txt", "utf8");
  const verifyOutput = run(`node ./falcon-cli.js verify "${msg}" ${sigFromFileHex} ${pkHexForVerifying}`);
  console.log("Verification result:", verifyOutput);
  
  if (!verifyOutput.includes("✅ Verification success")) {
    throw new Error("Verification failed");
  }
  
  // Step 4: Test file-based approach by reading from files
  console.log("\n=== Step 4: Testing file-based approach ===");
  
  // Read keys and signature from files
  const pkFromFile = fs.readFileSync(PK_FILE);
  const skFromFile = fs.readFileSync(SK_FILE);
  const sigFromFile = fs.readFileSync(SIG_FILE);
  
  console.log(`Read public key from ${PK_FILE} (${pkFromFile.length} bytes)`);
  console.log(`Read secret key from ${SK_FILE} (${skFromFile.length} bytes)`);
  console.log(`Read signature from ${SIG_FILE} (${sigFromFile.length} bytes)`);
  
  // Test direct usage with Falcon class
  console.log("\n=== Step 5: Direct verification with Falcon class ===");
  const falcon = new Falcon();
  const pkHex = Falcon.bytesToHex(pkFromFile);
  const sigHex = Falcon.bytesToHex(sigFromFile);
  
  const result = await falcon.verify(msg, sigHex, pkHex);
  console.log(`Direct verification result: ${result ? "✅ Success" : "❌ Failed"}`);
  
  if (!result) {
    throw new Error("Direct verification with Falcon class failed");
  }
  
  console.log("\n=== All tests passed successfully! ===");
} catch (e) {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
}
