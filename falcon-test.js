#!/usr/bin/env node
import Falcon from './index.js';
import { strict as assert } from 'assert';

// Constants for deterministic Falcon-1024
const EXPECTED_PK_SIZE = 1793;  // Size of public key in bytes
const EXPECTED_SK_SIZE = 2305;  // Size of secret key in bytes
// The compressed signature size can vary, but has a maximum
// The CT signature size is fixed

/**
 * Test the Falcon class implementation
 */
async function runTests() {
  console.log('🧪 Testing Falcon class implementation...');
  
  // Initialize Falcon
  console.log('- Initializing Falcon...');
  const falcon = new Falcon();
  
  // Test key generation
  console.log('- Testing keypair generation...');
  const { publicKey, secretKey } = await falcon.keypair();
  console.log(`  ✓ Generated public key (${publicKey.length} bytes)`);
  console.log(`  ✓ Generated secret key (${secretKey.length} bytes)`);
  
  // Display keys in shortened format (first 20 chars...last 20 chars)
  const pkHex = Falcon.bytesToHex(publicKey);
  const skHex = Falcon.bytesToHex(secretKey);
  const shortenHex = (hex) => {
    if (hex.length <= 40) return hex;
    return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
  };
  console.log(`  Public key: ${shortenHex(pkHex)}`);
  console.log(`  Secret key: ${shortenHex(skHex)}`);
  
  // Generate a second keypair to test randomness
  console.log('- Generating a second keypair to test randomness...');
  const { publicKey: pk2, secretKey: sk2 } = await falcon.keypair();
  const pk2Hex = Falcon.bytesToHex(pk2);
  const sk2Hex = Falcon.bytesToHex(sk2);
  console.log(`  Second public key: ${shortenHex(pk2Hex)}`);
  console.log(`  Second secret key: ${shortenHex(sk2Hex)}`);
  
  // Compare keys
  const keysAreDifferent = pkHex !== pk2Hex;
  console.log(`  Keys are different: ${keysAreDifferent ? '✓ YES (good)' : '✗ NO (problem)'}`);
  
  // Verify key sizes are correct
  assert(publicKey.length === 1793, 'Public key should be 1793 bytes');
  assert(secretKey.length === 2305, 'Secret key should be 2305 bytes');
  // For a proper implementation, keys should be random
  assert(pkHex !== pk2Hex, 'Different key pairs should produce different public keys');
  
  // Test signing
  console.log('- Testing signing with deterministic compressed format...');
  const message = 'This is a test message for Falcon signatures';
  console.log(`  Message: "${message}"`);
  
  const signature = await falcon.sign(message, secretKey);
  const sigHex = Falcon.bytesToHex(signature);
  console.log(`  ✓ Generated compressed signature (${signature.length} bytes)`);
  console.log(`  Signature: ${shortenHex(sigHex)}`);
  
  // Get salt version of the signature
  console.log('- Testing salt version retrieval...');
  const saltVersion = await falcon.getSaltVersion(signature);
  console.log(`  ✓ Salt version: ${saltVersion}`);
  assert(saltVersion >= 0, 'Salt version should be a non-negative integer');
  
  // Test signature verification
  console.log('- Testing verification of compressed signature...');
  const isValid = await falcon.verify(message, signature, publicKey);
  console.log(`  ✓ Verification result: ${isValid ? 'Valid' : 'Invalid'}`);
  assert(isValid === true, 'Signature should be valid');
  
  // Convert to constant-time signature
  console.log('- Testing conversion to constant-time format...');
  const ctSignature = await falcon.convertToConstantTime(signature);
  const ctSigHex = Falcon.bytesToHex(ctSignature);
  console.log(`  ✓ Generated CT signature (${ctSignature.length} bytes)`);
  console.log(`  CT Signature: ${shortenHex(ctSigHex)}`);
  
  // Test CT signature verification
  console.log('- Testing verification of CT signature...');
  const ctIsValid = await falcon.verifyConstantTime(message, ctSignature, publicKey);
  console.log(`  ✓ CT Verification result: ${ctIsValid ? 'Valid' : 'Invalid'}`);
  assert(ctIsValid === true, 'CT Signature should be valid');
  
  // Test invalid verification
  console.log('- Testing invalid verification...');
  const tampered = 'This is a tampered message';
  const invalidResult = await falcon.verify(tampered, signature, publicKey);
  console.log(`  ✓ Invalid verification result: ${invalidResult ? 'Valid' : 'Invalid'}`);
  assert(invalidResult === false, 'Tampered signature should be invalid');
  
  const ctInvalidResult = await falcon.verifyConstantTime(tampered, ctSignature, publicKey);
  console.log(`  ✓ Invalid CT verification result: ${ctInvalidResult ? 'Valid' : 'Invalid'}`);
  assert(ctInvalidResult === false, 'Tampered CT signature should be invalid');
  
  // Test hex conversion utilities
  console.log('- Testing hex conversion utilities...');
  const hexPk = Falcon.bytesToHex(publicKey);
  const pkFromHex = Falcon.hexToBytes(hexPk);
  assert(Buffer.from(publicKey).toString('hex') === hexPk, 'Hex conversion should match');
  assert(Buffer.compare(Buffer.from(publicKey), Buffer.from(pkFromHex)) === 0, 
         'Converting back from hex should result in the same bytes');
  console.log('  ✓ Hex conversion works correctly');
  
  // Test with binary message
  console.log('- Testing with binary message...');
  const binaryMessage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const binSig = await falcon.sign(binaryMessage, secretKey);
  const binVerify = await falcon.verify(binaryMessage, binSig, publicKey);
  assert(binVerify === true, 'Binary message signature should be valid');
  console.log('  ✓ Binary message signing and verification works');
  
  // Test binary message with CT signature
  const binCtSig = await falcon.convertToConstantTime(binSig);
  const binCtVerify = await falcon.verifyConstantTime(binaryMessage, binCtSig, publicKey);
  assert(binCtVerify === true, 'Binary message CT signature should be valid');
  console.log('  ✓ Binary message CT signature verification works');
  
  // Test deterministic property of signatures
  console.log('- Testing deterministic property of signatures...');
  const sig1 = await falcon.sign(message, secretKey);
  const sig2 = await falcon.sign(message, secretKey);
  // Compare the signatures - should be identical for the same message and key
  const sig1Hex = Falcon.bytesToHex(sig1);
  const sig2Hex = Falcon.bytesToHex(sig2);
  assert(sig1Hex === sig2Hex, 'Signatures should be deterministic for the same message and key');
  console.log('  ✓ Deterministic signatures confirmed');
  
  console.log('\n✅ All tests passed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
