#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";
import ModuleFactory from "./falcon.js";

const Module = await ModuleFactory();

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage:");
    console.log("  node falcon-cli.js keygen");
    console.log("  node falcon-cli.js sign <message> <hex_sk>");
    console.log("  node falcon-cli.js verify <message> <hex_sig> <hex_pk>");
    process.exit(1);
  }

  // Falcon-1024 key and signature sizes
  const PK_LEN = 1793;  // Public key: 1,793 bytes
  const SK_LEN = 2305;  // Private key: 2,305 bytes
  const SIG_MAX = 1538; // Signature: 1,538 bytes (uncompressed)
  
  // Verify sizes match what the module reports
  const modulePkLen = Module._get_pk_size();
  const moduleSkLen = Module._get_sk_size();
  const moduleSigMax = Module._get_sig_max_size();
  
  console.log(`Using key sizes: PK=${PK_LEN} bytes, SK=${SK_LEN} bytes, SIG=${SIG_MAX} bytes`);
  console.log(`Module reports: PK=${modulePkLen} bytes, SK=${moduleSkLen} bytes, SIG=${moduleSigMax} bytes`);
  
  if (PK_LEN !== modulePkLen || SK_LEN !== moduleSkLen) {
    console.warn("Warning: Key sizes don't match module-reported sizes!");
  }

  const cmd = args[0];
  if (cmd === "keygen") {
    console.log("🔑 Generating Falcon keypair...");
    const pkPtr = Module._malloc(PK_LEN);
    const skPtr = Module._malloc(SK_LEN);

    const res = Module._simple_keygen(skPtr, pkPtr);
    if (res !== 0) throw new Error("Keygen failed: " + res);

    const pk = new Uint8Array(Module.HEAPU8.buffer, pkPtr, PK_LEN);
    const sk = new Uint8Array(Module.HEAPU8.buffer, skPtr, SK_LEN);

    console.log("PublicKey:", bytesToHex(pk));
    console.log("SecretKey:", bytesToHex(sk));

    Module._free(pkPtr);
    Module._free(skPtr);
  } else if (cmd === "sign") {
    const msg = new TextEncoder().encode(args[1]);
    const sk = hexToBytes(args[2]);

    // Verify the secret key length
    if (sk.length !== SK_LEN) {
      console.error(`Invalid secret key length: ${sk.length}, expected ${SK_LEN}`);
      process.exit(1);
    }

    // Allocate memory for message and secret key
    const msgPtr = Module._malloc(msg.length);
    const skPtr = Module._malloc(SK_LEN);
    
    // Copy message and secret key to WebAssembly memory
    Module.HEAPU8.set(msg, msgPtr);
    Module.HEAPU8.set(sk, skPtr);

    // Allocate memory for signature and signature length
    // Use a larger buffer for the signature to be safe
    const sigPtr = Module._malloc(SIG_MAX);
    const sigLenPtr = Module._malloc(4);
    
    // Initialize the signature length pointer with the buffer size
    Module.setValue(sigLenPtr, SIG_MAX, "i32");

    try {
      // The C function signature is:
      // int simple_sign(uint8_t *sig, size_t *sig_len, const uint8_t *sk, const uint8_t *msg, size_t msg_len)
      // Make sure we pass the parameters in the correct order
      console.log("Calling sign with parameters:");
      console.log(`- sigPtr: ${sigPtr}`);
      console.log(`- sigLenPtr: ${sigLenPtr}`);
      console.log(`- skPtr: ${skPtr}`);
      console.log(`- msgPtr: ${msgPtr}`);
      console.log(`- msg.length: ${msg.length}`);
      
      // Pass parameters in the exact order defined in the C function
      const res = Module._simple_sign(sigPtr, sigLenPtr, skPtr, msgPtr, msg.length);
      
      if (res !== 0) {
        console.error(`Sign failed with error code: ${res}`);
        process.exit(1);
      }
      
      // Get signature length and copy signature from WebAssembly memory
      const sigLen = Module.getValue(sigLenPtr, "i32");
      
      // Create a copy of the signature to avoid issues with memory being freed
      const sig = new Uint8Array(Module.HEAPU8.buffer, sigPtr, sigLen).slice();
      console.log("Signature:", bytesToHex(sig));
    } catch (e) {
      console.error("Error during signing:", e);
      process.exit(1);
    } finally {
      // Free allocated memory
      Module._free(msgPtr);
      Module._free(skPtr);
      Module._free(sigPtr);
      Module._free(sigLenPtr);
    }
  } else if (cmd === "verify") {
    const msg = new TextEncoder().encode(args[1]);
    const sig = hexToBytes(args[2]);
    const pk = hexToBytes(args[3]);

    // Verify the public key and signature lengths
    if (pk.length !== PK_LEN) {
      console.error(`Invalid public key length: ${pk.length}, expected ${PK_LEN}`);
      process.exit(1);
    }

    // Allocate memory for message, signature, and public key
    const msgPtr = Module._malloc(msg.length);
    const sigPtr = Module._malloc(sig.length);
    const pkPtr = Module._malloc(PK_LEN);
    
    // Copy message, signature, and public key to WebAssembly memory
    Module.HEAPU8.set(msg, msgPtr);
    Module.HEAPU8.set(sig, sigPtr);
    Module.HEAPU8.set(pk, pkPtr);

    try {
      // The C function signature is:
      // int simple_verify(const uint8_t *sig, size_t sig_len, const uint8_t *pk, const uint8_t *msg, size_t msg_len)
      // Make sure we pass the parameters in the correct order
      console.log("Calling verify with parameters:");
      console.log(`- sigPtr: ${sigPtr}`);
      console.log(`- sig.length: ${sig.length}`);
      console.log(`- pkPtr: ${pkPtr}`);
      console.log(`- msgPtr: ${msgPtr}`);
      console.log(`- msg.length: ${msg.length}`);
      
      // Pass parameters in the exact order defined in the C function
      const res = Module._simple_verify(sigPtr, sig.length, pkPtr, msgPtr, msg.length);
      console.log(res === 0 ? "✅ Verification success" : "❌ Verification failed");
    } catch (e) {
      console.error("Error during verification:", e);
      process.exit(1);
    } finally {
      // Free allocated memory
      Module._free(msgPtr);
      Module._free(sigPtr);
      Module._free(pkPtr);
    }
  } else {
    console.error("Unknown command:", cmd);
  }
}

await main();
