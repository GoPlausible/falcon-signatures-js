/**
 * Test suite for Falcon-Algorand SDK
 * Basic tests to verify core functionality
 */

import FalconAlgoSDK, {
  Networks,
  FalconAlgoUtils,
  isOnCurve,
  isLsigAddressOffCurve,
  assertLsigAddressOffCurve,
} from '../dist/index.js';
import algosdk from 'algosdk';
import { getPublicKeyAsync, utils as edUtils } from '@noble/ed25519';

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

  // Test 3b: isOnCurve oracle hardening. This must NOT be constant-false
  // (the original bug) or constant-true (a future regression in the other
  // direction). Both would silently destroy the rejection loop.
  await test('isOnCurve oracle: deterministic vectors plus statistical balance', async () => {
    // Deterministic on-curve: any genuine ed25519 public key.
    const realPk = await getPublicKeyAsync(edUtils.randomSecretKey());
    if (!isOnCurve(realPk)) {
      throw new Error('isOnCurve returned false for a valid ed25519 public key');
    }

    // Deterministic off-curve: y = 2^256-1 exceeds the field prime so
    // RFC8032 decoding rejects it before curve math.
    const allOnes = new Uint8Array(32).fill(0xff);
    if (isOnCurve(allOnes)) {
      throw new Error('isOnCurve returned true for an out-of-field value');
    }

    // Statistical on-curve check: 16 fresh pubkeys must all return true.
    // Catches a constant-false stub even if deterministic samples pass.
    let onCurveHits = 0;
    for (let i = 0; i < 16; i++) {
      const pk = await getPublicKeyAsync(edUtils.randomSecretKey());
      if (isOnCurve(pk)) onCurveHits++;
    }
    if (onCurveHits !== 16) {
      throw new Error(`Expected 16/16 random pubkeys on-curve, got ${onCurveHits}/16`);
    }

    // Statistical balance check: across 64 random 32-byte buffers, the
    // result must vary (roughly ~50% on-curve under non-zip215 decoding).
    // A constant-true or constant-false stub fails here.
    let trues = 0;
    for (let i = 0; i < 64; i++) {
      const buf = edUtils.randomSecretKey(); // 32 random bytes
      if (isOnCurve(buf)) trues++;
    }
    if (trues === 0 || trues === 64) {
      throw new Error(`isOnCurve is constant (${trues}/64 true) — oracle is broken`);
    }
    if (trues < 8 || trues > 56) {
      throw new Error(`isOnCurve distribution looks wrong: ${trues}/64 true (expected ~32)`);
    }
  });

  // Test 3c: rejection loop in createFalconAccount must skip on-curve
  // candidates and settle on the first off-curve one. Uses a stubbed
  // algod.compile so we can control which counter yields which address.
  await test('rejection loop skips on-curve candidates (mocked algod)', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);

    const onCurveAddr1 = algosdk.encodeAddress(
      await getPublicKeyAsync(edUtils.randomSecretKey()),
    );
    const onCurveAddr2 = algosdk.encodeAddress(
      await getPublicKeyAsync(edUtils.randomSecretKey()),
    );
    const offCurveAddr = algosdk.encodeAddress(new Uint8Array(32).fill(0xff));

    const sequence = [onCurveAddr1, onCurveAddr2, offCurveAddr];
    let callCount = 0;
    sdk.algod = {
      compile: () => ({
        do: async () => {
          if (callCount >= sequence.length) {
            throw new Error(`compile called ${callCount + 1} times; expected at most ${sequence.length}`);
          }
          const hash = sequence[callCount++];
          return { result: 'AA==', hash };
        },
      }),
    };

    const account = await sdk.createFalconAccount({ generateEdKeys: false });

    if (account.logicSig.counter !== 2) {
      throw new Error(`Loop must settle at counter 2 (first off-curve), got ${account.logicSig.counter}`);
    }
    if (callCount !== 3) {
      throw new Error(`Loop must make exactly 3 compile calls, made ${callCount}`);
    }
    if (account.address !== offCurveAddr) {
      throw new Error(`Selected address must be the off-curve one, got ${account.address}`);
    }
  });

  // Test 3d: rejection loop must throw if all 256 candidates are on-curve.
  // Probability in production is ~2^-256, but the bail-out path must work.
  await test('rejection loop throws after 256 on-curve candidates', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);

    // Pre-generate 256 on-curve addresses up-front to keep the test fast.
    const onCurveAddrs = [];
    for (let i = 0; i < 256; i++) {
      onCurveAddrs.push(
        algosdk.encodeAddress(await getPublicKeyAsync(edUtils.randomSecretKey())),
      );
    }

    let callCount = 0;
    sdk.algod = {
      compile: () => ({
        do: async () => {
          const hash = onCurveAddrs[callCount++];
          return { result: 'AA==', hash };
        },
      }),
    };

    let threw = false;
    let message = '';
    try {
      await sdk.createFalconAccount({ generateEdKeys: false });
    } catch (e) {
      threw = true;
      message = e.message;
    }

    if (!threw) {
      throw new Error('Loop must throw when every candidate is on-curve');
    }
    if (!/off-curve/i.test(message)) {
      throw new Error(`Throw message must mention off-curve, got: ${message}`);
    }
    if (callCount !== 256) {
      throw new Error(`Loop must try all 256 counters, tried ${callCount}`);
    }
  });

  // Test 3e: runtime guard must refuse to sign with a legacy on-curve
  // account (produced by SDK <= 1.0.5) and must accept any account created
  // by the current code path.
  await test('createLogicSig refuses legacy on-curve accounts and accepts current ones', async () => {
    const sdk = new FalconAlgoSDK(Networks.TESTNET);

    // 1. A real, current-SDK account must pass the guard.
    const freshAccount = await sdk.createFalconAccount({ generateEdKeys: false });
    if (!isLsigAddressOffCurve(freshAccount)) {
      throw new Error('Fresh account from current SDK reports as on-curve — fix regressed');
    }
    assertLsigAddressOffCurve(freshAccount); // must not throw

    // 2. A synthetic accountInfo with an on-curve address must be rejected
    //    by both the utility and by createLogicSig before any signing.
    const onCurveAddr = algosdk.encodeAddress(
      await getPublicKeyAsync(edUtils.randomSecretKey()),
    );
    const vulnerable = {
      ...freshAccount,
      address: onCurveAddr,
      logicSig: { ...freshAccount.logicSig, address: onCurveAddr },
    };

    if (isLsigAddressOffCurve(vulnerable)) {
      throw new Error('Guard helper failed to detect on-curve LSig address');
    }

    let threw = false;
    let message = '';
    try {
      assertLsigAddressOffCurve(vulnerable);
    } catch (e) {
      threw = true;
      message = e.message;
    }
    if (!threw) throw new Error('assertLsigAddressOffCurve must throw on on-curve address');
    if (!/post-quantum/i.test(message) || !/recreate/i.test(message)) {
      throw new Error(`Guard error must mention PQ status and remediation, got: ${message}`);
    }

    // 3. createLogicSig must refuse before producing any Falcon signature.
    const txid = '347BME23NZR3CGQA3EDRZTWJZWJ43QYDOVV43SVWTCI6EMJHVVVQ';
    let signThrew = false;
    try {
      await sdk.createLogicSig(vulnerable, txid);
    } catch (e) {
      signThrew = true;
      if (!/post-quantum/i.test(e.message)) {
        throw new Error(`createLogicSig threw with the wrong message: ${e.message}`);
      }
    }
    if (!signThrew) {
      throw new Error('createLogicSig must refuse to sign for an on-curve LSig address');
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
