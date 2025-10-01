#!/usr/bin/env node
import { strict as assert } from 'assert';

// We'll import from the npm package instead of a local file
import Falcon from 'falcon-signatures';

/**
 * Simple test for the Falcon npm package
 */
async function runTests() {
  console.log('🧪 Testing Falcon npm package...');
  
  // Initialize Falcon
  console.log('- Initializing Falcon...');
  const falcon = new Falcon();
  
  // Test key generation
  console.log('- Testing keypair generation...');
  const { publicKey, secretKey } = await falcon.keypair();
  console.log(`  ✓ Generated public key (${publicKey.length} bytes)`);
  console.log(`  ✓ Generated secret key (${secretKey.length} bytes)`);
  
  // Display keys in shortened format
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
  console.log('- Testing signing...');
  const message = 'This is a test message for Falcon signatures';
  console.log(`  Message: "${message}"`);
  
  const signature = await falcon.sign(message, secretKey);
  const sigHex = Falcon.bytesToHex(signature);
  console.log(`  ✓ Generated signature (${signature.length} bytes)`);
  console.log(`  Signature: ${shortenHex(sigHex)}`);
  
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
  
  console.log('\n✅ All tests passed! The npm package is working correctly.');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
