#!/usr/bin/env node
import Falcon from './index.js';
import { strict as assert } from 'assert';

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
  
  // Display partial keys to verify randomness across runs
  const pkHex = Falcon.bytesToHex(publicKey);
  const skHex = Falcon.bytesToHex(secretKey);
  console.log(`  Public key (first 32 chars): ${pkHex.substring(0, 32)}...`);
  console.log(`  Secret key (first 32 chars): ${skHex.substring(0, 32)}...`);
  
  // Generate a second keypair to test randomness
  console.log('- Generating a second keypair to test randomness...');
  const { publicKey: pk2, secretKey: sk2 } = await falcon.keypair();
  const pk2Hex = Falcon.bytesToHex(pk2);
  const sk2Hex = Falcon.bytesToHex(sk2);
  console.log(`  Second public key (first 32 chars): ${pk2Hex.substring(0, 32)}...`);
  console.log(`  Second secret key (first 32 chars): ${sk2Hex.substring(0, 32)}...`);
  
  // Compare keys
  const keysAreDifferent = pkHex !== pk2Hex;
  console.log(`  Keys are different: ${keysAreDifferent ? '✓ YES (good)' : '✗ NO (problem)'}`);
  
  // Verify key sizes are correct
  assert(publicKey.length === 1793, 'Public key should be 1793 bytes');
  assert(secretKey.length === 2305, 'Secret key should be 2305 bytes');
  // For a proper implementation, keys should be random
  assert(pkHex !== pk2Hex, 'Different key pairs should produce different public keys');
  
  // Test signing
  console.log('- Testing signing...');
  const message = 'This is a test message for Falcon signatures';
  console.log(`  Message: "${message}"`);
  
  const signature = await falcon.sign(message, secretKey);
  console.log(`  ✓ Generated signature (${signature.length} bytes)`);
  
  // Test signature verification
  console.log('- Testing verification...');
  const isValid = await falcon.verify(message, signature, publicKey);
  console.log(`  ✓ Verification result: ${isValid ? 'Valid' : 'Invalid'}`);
  assert(isValid === true, 'Signature should be valid');
  
  // Test invalid verification
  console.log('- Testing invalid verification...');
  const tampered = 'This is a tampered message';
  const invalidResult = await falcon.verify(tampered, signature, publicKey);
  console.log(`  ✓ Invalid verification result: ${invalidResult ? 'Valid' : 'Invalid'}`);
  assert(invalidResult === false, 'Tampered signature should be invalid');
  
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
  
  console.log('\n✅ All tests passed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
