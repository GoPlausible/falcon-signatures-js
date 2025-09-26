#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";

// File paths for keys and signatures
const PK_FILE = "falcon_pk.bin";
const SK_FILE = "falcon_sk.bin";
const SIG_FILE = "falcon_sig.bin";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

try {
  console.log("=== Falcon CLI Test ===");
  
  // Step 1: Generate a new keypair
  console.log("\n=== Step 1: Generating a new Falcon keypair ===");
  const keygenOutput = run("node ./falcon-cli.js keygen");
  console.log("Keygen completed successfully");
  
  // Extract keys from output
  const pk = keygenOutput.match(/PublicKey:\s*([0-9a-f]+)/i)[1];
  const sk = keygenOutput.match(/SecretKey:\s*([0-9a-f]+)/i)[1];
  
  console.log(`Public key length: ${pk.length / 2} bytes`);
  console.log(`Secret key length: ${sk.length / 2} bytes`);
  
  // Save keys to files for later use
  fs.writeFileSync(PK_FILE, hexToBytes(pk));
  fs.writeFileSync(SK_FILE, hexToBytes(sk));
  console.log(`Keys saved to ${PK_FILE} and ${SK_FILE}`);
  
  // Step 2: Sign a message (using a shorter message and generating a new key)
  console.log("\n=== Step 2: Signing a message ===");
  const msg = "test";
  
  // Generate a new keypair specifically for signing
  console.log("Generating a new keypair for signing...");
  const signKeygenOutput = run("node ./falcon-cli.js keygen");
  const signPk = signKeygenOutput.match(/PublicKey:\s*([0-9a-f]+)/i)[1];
  const signSk = signKeygenOutput.match(/SecretKey:\s*([0-9a-f]+)/i)[1];
  
  const signOutput = run(`node ./falcon-cli.js sign "${msg}" ${signSk}`);
  console.log("Signing completed successfully");
  
  // Extract signature from output
  const sig = signOutput.match(/Signature:\s*([0-9a-f]+)/i)[1];
  console.log(`Signature length: ${sig.length / 2} bytes`);
  
  // Save signature to file for later use
  fs.writeFileSync(SIG_FILE, hexToBytes(sig));
  console.log(`Signature saved to ${SIG_FILE}`);
  
  // Step 3: Verify the signature
  console.log("\n=== Step 3: Verifying the signature ===");
  const verifyOutput = run(`node ./falcon-cli.js verify "${msg}" ${sig} ${signPk}`);
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
  
  // Convert to hex for comparison
  const pkHex = bytesToHex(pkFromFile);
  const skHex = bytesToHex(skFromFile);
  const sigHex = bytesToHex(sigFromFile);
  
  // Verify that the keys and signature match
  if (pkHex !== pk) {
    throw new Error("Public key from file doesn't match original");
  }
  
  if (skHex !== sk) {
    throw new Error("Secret key from file doesn't match original");
  }
  
  if (sigHex !== sig) {
    throw new Error("Signature from file doesn't match original");
  }
  
  console.log("File-based approach test passed!");
  
  console.log("\n=== All tests passed successfully! ===");
} catch (e) {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
}
