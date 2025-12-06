/**
 * Test suite for Falcon-Algorand SDK
 * Basic tests to verify core functionality
 */

import FalconAlgoSDK, { Networks, FalconAlgoUtils } from '../dist/index.js';
import algosdk from 'algosdk';

let testResults = [];

function test(description, testFunction) {
  return new Promise(async (resolve) => {
    try {
      console.log(`🧪 Testing: ${description}`);
      await testFunction();
      console.log(`✅ PASS: ${description}\n`);
      testResults.push({ description, status: 'PASS' });
      resolve();
    } catch (error) {
      console.log(`❌ FAIL: ${description}`);
      console.log(`   Error: ${error.message}\n`);
      testResults.push({ description, status: 'FAIL', error: error.message });
      resolve();
    }
  });
}

async function runTests() {
  console.log('🚀 Running Falcon-Algorand SDK Tests\n');

  // Test 1: SDK Initialization
  await test('SDK initialization', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    if (!sdk.network || !sdk.algod || !sdk.falcon) {
      throw new Error('SDK components not properly initialized');
    }
  });

  // Test 2: Network configurations
  await test('Network configurations', async () => {
    if (!Networks.MAINNET || !Networks.TESTNET || !Networks.BETANET) {
      throw new Error('Network configurations missing');
    }
    
    if (!Networks.TESTNET.server || !Networks.TESTNET.name) {
      throw new Error('Network configuration incomplete');
    }
  });

  // Test 3: Utility functions
  await test('Utility functions', async () => {
    // Test Algo/microAlgo conversion
    const algos = 1.5;
    const microAlgos = FalconAlgoUtils.algosToMicroAlgos(algos);
    const backToAlgos = FalconAlgoUtils.microAlgosToAlgos(microAlgos);
    
    if (microAlgos !== 1500000) {
      throw new Error(`Algo to microAlgo conversion failed: expected 1500000, got ${microAlgos}`);
    }
    
    if (backToAlgos !== algos) {
      throw new Error(`MicroAlgo to Algo conversion failed: expected ${algos}, got ${backToAlgos}`);
    }
    
    // Test random lease generation
    const lease = FalconAlgoUtils.generateRandomLease();
    if (lease.length !== 32) {
      throw new Error(`Random lease should be 32 bytes, got ${lease.length}`);
    }
  });

  // Test 4: Account creation
  await test('Falcon account creation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    const account = await sdk.createFalconAccount();
    
    if (!account.address || !account.falconKeys || !account.logicSig) {
      throw new Error('Account creation missing required fields');
    }
    
    if (!account.falconKeys.publicKey || !account.falconKeys.secretKey) {
      throw new Error('Falcon keys not properly generated');
    }
    
    if (account.type !== 'falcon-protected') {
      throw new Error('Account type not set correctly');
    }
    
    // Validate account info structure
    if (!FalconAlgoUtils.validateAccountInfo(account)) {
      throw new Error('Generated account info validation failed');
    }
  });

  // Test 5: Account conversion preparation
  await test('Account conversion preparation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    
    // Create a dummy Algorand account for testing
    const dummyAccount = algosdk.generateAccount();
    const mnemonic = algosdk.secretKeyToMnemonic(dummyAccount.sk);
    
    const conversionInfo = await sdk.convertToFalconAccount(mnemonic);
    
    if (!conversionInfo.originalAddress || !conversionInfo.newAddress) {
      throw new Error('Conversion info missing required addresses');
    }
    
    if (!conversionInfo.rekeyTransaction || !conversionInfo.logicSig) {
      throw new Error('Conversion info missing required transaction or LogicSig');
    }
    
    if (conversionInfo.type !== 'converted-to-falcon') {
      throw new Error('Conversion type not set correctly');
    }
    
    // The conversion should preserve the original account address
    if (String(conversionInfo.originalAddress) !== String(dummyAccount.addr)) {
      throw new Error(`Original address mismatch: expected "${dummyAccount.addr}", got "${conversionInfo.originalAddress}"`);
    }
  });

  // Test 6: LogicSig creation
  await test('LogicSig creation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    const account = await sdk.createFalconAccount();
    // Create a dummy transaction object that provides a txID() method
    const txid = '347BME23NZR3CGQA3EDRZTWJZWJ43QYDOVV43SVWTCI6EMJHVVVQ'
    
    const lsig = await sdk.createLogicSig(account, txid);
    
    if (!lsig || !lsig.lsig || !lsig.address()) {
      throw new Error('LogicSig not properly created');
    }
    
    // The LogicSig address should match the account address (both are the escrow address)
    if (String(lsig.address()) !== String(account.address)) {
      throw new Error(`LogicSig address mismatch: expected "${account.address}", got "${lsig.address()}"`);
    }
    
    if (!lsig.lsig.args || lsig.lsig.args.length === 0) {
      throw new Error('LogicSig arguments missing');
    }
  });

  // Test 7: Account backup and restore
  await test('Account backup and restore', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    const account = await sdk.createFalconAccount();
    
    // Test backup without secrets
    const backupWithoutSecrets = sdk.backupAccount(account, false);
    const restoredWithoutSecrets = JSON.parse(backupWithoutSecrets);
    
    if (restoredWithoutSecrets.falconKeys.secretKey) {
      throw new Error('Secret key should not be included in backup without secrets');
    }
    
    // Test backup with secrets
    const backupWithSecrets = sdk.backupAccount(account, true);
    const restoredWithSecrets = JSON.parse(backupWithSecrets);
    
    // Fix: Check that secret key exists and is not undefined/null
    if (!restoredWithSecrets.falconKeys || !restoredWithSecrets.falconKeys.secretKey) {
      throw new Error('Secret key should be included in backup with secrets');
    }
    
    // Test restore functionality
    const restoredAccount = sdk.restoreAccount(backupWithSecrets);
    
    if (restoredAccount.address !== account.address) {
      throw new Error('Restored account address does not match original');
    }
  });

  // Test 8: TEAL program generation
  await test('TEAL program generation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    const account = await sdk.createFalconAccount();
    
    // Test internal TEAL generation methods
    const falconPk = new Uint8Array(32).fill(1); // Dummy public key
    const message = new Uint8Array(32).fill(2); // Dummy message
    
    const tealProgram = sdk._generateTealProgram(falconPk, message);
    
    if (!tealProgram.includes('#pragma version 12')) {
      throw new Error('TEAL program missing pragma version');
    }
    
    if (!tealProgram.includes('falcon_verify')) {
      throw new Error('TEAL program missing falcon_verify opcode');
    }
    
    if (!tealProgram.includes('pushbytes')) {
      throw new Error('TEAL program missing pushbytes opcode');
    }
  });

  // Test 9: Transaction creation (without submitting)
  await test('Transaction creation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    const account = await sdk.createFalconAccount();
    
    // Create a mock transaction (this will fail due to network call, but we can test the structure)
    const paymentParams = {
      sender: account.address,
      receiver: 'LP6QRRBRDTDSP4HF7CSPWJV4AG4QWE437OYHGW7K5Y7DETKCSK5H3HCA7Q', // Valid test address
      amount: 1000000,
      note: 'Test payment'
    };
    
    try {
      await sdk.createPayment(paymentParams, account);
      // If we get here, the transaction was created successfully
    } catch (error) {
      // This is expected due to network call, but we can check the error type
      if (!error.message.includes('getTransactionParams') && !error.message.includes('network')) {
        throw new Error(`Unexpected error in transaction creation: ${error.message}`);
      }
      // This is an acceptable error for testing
    }
  });

  // Test 10: Fee estimation
  await test('Fee estimation', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    
    try {
      await sdk.estimateFees(1);
      // If successful, great!
    } catch (error) {
      // This is expected due to network call
      if (!error.message.includes('getTransactionParams') && !error.message.includes('network')) {
        throw new Error(`Unexpected error in fee estimation: ${error.message}`);
      }
      // This is an acceptable error for testing
    }
  });

  // Print test summary
  console.log('📊 Test Summary:');
  console.log('================');
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;
  
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    testResults.filter(r => r.status === 'FAIL').forEach(test => {
      console.log(`   • ${test.description}: ${test.error}`);
    });
  }
  
  console.log('\n' + (failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed.'));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);
