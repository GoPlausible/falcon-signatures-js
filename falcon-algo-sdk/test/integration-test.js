/**
 * Falcon-Algorand SDK Integration Test
 * Complete end-to-end test demonstrating the full flow:
 * 1. Create standard Algorand account
 * 2. Fund it via TestNet faucet  
 * 3. Convert to Falcon-protected account
 * 4. Make a post-quantum Resistant account payment
 * 
 * This is an educational test showing the complete post-quantum migration process.
 */

import FalconAlgoSDK, { Networks, FalconAlgoUtils } from '../dist/index.js';
import algosdk from 'algosdk';
import fs from 'fs/promises';
import readline from 'readline';
import path from 'path';

// Target address for the test payment
const TARGET_ADDRESS = 'UTI7PAASILRDA3ISHY5M7J7LNRX2AIVQJWI7ZKCCGKVLMFD3VPR5PWSZ4I';
const PAYMENT_AMOUNT_ALGO = 0.1;
const PAYMENT_AMOUNT_MICRO_ALGOS = FalconAlgoUtils.algosToMicroAlgos(PAYMENT_AMOUNT_ALGO);
const STANDARD_ACCOUNT_PATH = path.join(process.cwd(), 'standard-account.json');
const FALCON_ACCOUNT_PATH = path.join(process.cwd(), 'falcon-protected-account.json');

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'info': '📝',
    'success': '✅',
    'warning': '⚠️ ',
    'error': '❌',
    'step': '🔄',
    'falcon': '🦅',
    'algo': '🔷',
    'security': '🔐'
  }[level] || '📝';
  
  console.log(`[${timestamp.substring(11, 19)}] ${prefix} ${message}`);
}

function normalizeAddress(address) {
  if (typeof address === 'string') {
    return address;
  }
  if (address && typeof address.toString === 'function') {
    return address.toString();
  }
  return String(address);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function stringifyWithBigInt(obj) {
  return JSON.stringify(
    obj,
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
}

async function waitForConfirmation(algod, txId, maxRounds = 10) {
  log(`Waiting for transaction confirmation: ${txId}`, 'step');
  
  for (let round = 0; round < maxRounds; round++) {
    try {
      const confirmation = await algosdk.waitForConfirmation(algod, txId, 1);
      return confirmation;
    } catch (error) {
      log(`Waiting... (round ${round + 1}/${maxRounds})`, 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Transaction not confirmed after ${maxRounds} rounds`);
}

async function checkBalance(algod, address, requiredAmount = 0) {
  const addressStr = normalizeAddress(address);
  try {
    const accountInfo = await algod.accountInformation(addressStr).do();
    const balance = accountInfo.amount;
    const balanceAlgo = FalconAlgoUtils.microAlgosToAlgos(balance);
    
    log(`Account ${addressStr.substring(0, 10)}... balance: ${balanceAlgo} Algo (${balance} microAlgos)`, 'info');
    
    if (requiredAmount > 0) {
      const sufficient = balance >= requiredAmount;
      log(`Required: ${FalconAlgoUtils.microAlgosToAlgos(requiredAmount)} Algo - ${sufficient ? 'Sufficient' : 'Insufficient'} funds`, sufficient ? 'success' : 'warning');
      return { balance, sufficient };
    }
    
    return { balance, sufficient: true };
  } catch (error) {
    if (error.message.includes('account does not exist')) {
      log(`Account ${addressStr.substring(0, 10)}... does not exist (0 Algo balance)`, 'warning');
      return { balance: 0, sufficient: false };
    }
    throw error;
  }
}

async function runIntegrationTest() {
  console.log('🚀 Falcon-Algorand SDK Integration Test');
  console.log('=====================================');
  console.log('This test demonstrates the complete flow from standard to post-quantum Resistant Algorand accounts.\n');

  try {
    // Step 1: Initialize SDK
    log('Initializing Falcon-Algorand SDK on TestNet...', 'step');
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    log('SDK initialized successfully', 'success');
    log(`Connected to: ${Networks.TESTNET.server}`, 'info');

    // Step 2: Create or reuse standard Algorand account
    let standardAccount;
    let mnemonic;
    let senderAddress;
    if (await fileExists(STANDARD_ACCOUNT_PATH)) {
      const saved = JSON.parse(await fs.readFile(STANDARD_ACCOUNT_PATH, 'utf8'));
      senderAddress = normalizeAddress(saved.address);
      mnemonic = saved.mnemonic;
      const savedSecretKey = saved.secretKey ? Buffer.from(saved.secretKey, 'base64') : null;
      standardAccount = savedSecretKey ? { addr: senderAddress, sk: savedSecretKey } : { addr: senderAddress };
      log('Found existing standard account. Reusing saved account (delete standard-account.json to regenerate).', 'info');
      if (!mnemonic) {
        throw new Error('Saved standard account is missing mnemonic. Delete standard-account.json to regenerate.');
      }
      log(`Address: ${senderAddress}`, 'algo');
    } else {
      log('Creating new standard Algorand account...', 'step');
      standardAccount = algosdk.generateAccount();
      senderAddress = normalizeAddress(standardAccount.addr);
      mnemonic = algosdk.secretKeyToMnemonic(standardAccount.sk);
      
      const accountInfo = {
        address: senderAddress,
        mnemonic: mnemonic,
        secretKey: Buffer.from(standardAccount.sk).toString('base64'),
        publicKey: Buffer.from(standardAccount.sk.slice(-32)).toString('base64'),
        created: new Date().toISOString(),
        network: 'testnet',
        type: 'standard'
      };
  
      // Save standard account
      await fs.writeFile(STANDARD_ACCOUNT_PATH, stringifyWithBigInt(accountInfo));
      
      log('Standard Algorand account created successfully!', 'success');
      log(`Address: ${senderAddress}`, 'algo');
      log(`Mnemonic: ${mnemonic}`, 'info');
      log(`Account saved to: ${STANDARD_ACCOUNT_PATH}`, 'info');
    }

    // Step 3: Check initial balance and request funding
    await checkBalance(sdk.algod, senderAddress);
    
    console.log('\n🏦 ACCOUNT FUNDING REQUIRED');
    console.log('===========================');
    console.log(`Please fund the account with at least ${PAYMENT_AMOUNT_ALGO + 0.1} Algo for testing:`);
    console.log(`1. Visit: https://bank.testnet.algorand.network/`);
    console.log(`2. Enter address: ${senderAddress}`);
    console.log(`3. Click "Dispense" to receive 10 TestNet Algos`);
    console.log(`4. Wait for the transaction to complete\n`);

    // Wait for user confirmation
    await question('Press Enter after funding the account...');

    // Step 4: Verify funding
    log('Checking account balance after funding...', 'step');
    const requiredForTest = PAYMENT_AMOUNT_MICRO_ALGOS + 100000; // Extra for fees
    const balanceCheck = await checkBalance(sdk.algod, senderAddress, requiredForTest);
    
    if (!balanceCheck.sufficient) {
      throw new Error(`Insufficient funds! Need at least ${FalconAlgoUtils.microAlgosToAlgos(requiredForTest)} Algo for the test.`);
    }
    
    log('Account successfully funded!', 'success');

    // Step 5: Create or reuse Falcon-protected account conversion
    let conversionInfo;
    let usingSavedConversion = false;
    if (await fileExists(FALCON_ACCOUNT_PATH)) {
      const savedConversion = JSON.parse(await fs.readFile(FALCON_ACCOUNT_PATH, 'utf8'));
      conversionInfo = {
        ...savedConversion,
        originalAddress: normalizeAddress(savedConversion.originalAddress),
        newAddress: normalizeAddress(savedConversion.newAddress)
      };
      usingSavedConversion = true;
      log('Found existing Falcon conversion info. Reusing saved Falcon keys/LogicSig (delete falcon-protected-account.json to regenerate).', 'info');
    } else {
      log('Converting account to Falcon-protected...', 'step');
      log('Generating Falcon keypair...', 'falcon');
      conversionInfo = await sdk.convertToFalconAccount(mnemonic);
      log('Falcon keypair generated successfully!', 'success');
    }
    
    log(`Falcon Public Key: ${conversionInfo.falconKeys.publicKey.substring(0, 40)}...`, 'falcon');
    log(`Original Address: ${conversionInfo.originalAddress}`, 'algo');
    log(`New PQ Address: ${conversionInfo.newAddress}`, 'security');
    log(`LogicSig Program: ${conversionInfo.logicSig.program.substring(0, 40)}... (${conversionInfo.logicSig.program.length} chars)`, 'info');

    // Check current rekey status; if not rekeyed, refresh conversion (for fresh tx params) and submit
    const currentAuthInfo = await sdk.getAccountInfo(senderAddress);
    const alreadyRekeyed = currentAuthInfo['auth-addr'] === conversionInfo.newAddress;

    if (!alreadyRekeyed) {
      if (usingSavedConversion) {
        conversionInfo = await sdk.convertToFalconAccount(mnemonic, conversionInfo.falconKeys);
        conversionInfo.originalAddress = normalizeAddress(conversionInfo.originalAddress);
        conversionInfo.newAddress = normalizeAddress(conversionInfo.newAddress);
        log('Refreshed conversion info with saved Falcon keys for new rekey transaction.', 'info');
      }

      await fs.writeFile(FALCON_ACCOUNT_PATH, stringifyWithBigInt(conversionInfo));
      log('Falcon account info saved to: falcon-protected-account.json', 'info');

      // Step 6: Submit rekey transaction
      log('Submitting rekey transaction to convert account to post-quantum security...', 'step');
      
      const rekeyResult = await sdk.submitConversion(conversionInfo);
      
      log(`Rekey transaction submitted successfully!`, 'success');
      log(`Transaction ID: ${rekeyResult.txId}`, 'algo');
      log(`Confirmed in round: ${rekeyResult.confirmedRound}`, 'info');
      log('Account is now protected by Falcon post-quantum signatures!', 'security');
    } else {
      log('Account already rekeyed to Falcon LogicSig. Skipping rekey submission.', 'success');
      await fs.writeFile(FALCON_ACCOUNT_PATH, stringifyWithBigInt(conversionInfo));
    }

    // Step 7: Verify the account is rekeyed
    log('Verifying account rekey status...', 'step');
    const rekeyedAccountInfo = await sdk.getAccountInfo(senderAddress);
    log(`Rekeyed Account: `, rekeyedAccountInfo);
    log(`Auth Address: ${rekeyedAccountInfo['authAddr']}`);
    log(`New Address: ${conversionInfo.newAddress}`);

    if (String(rekeyedAccountInfo['authAddr']) === String(conversionInfo.newAddress)) {
      log('✅ Account successfully rekeyed to Falcon LogicSig!', 'success');
      log(`Auth Address: ${rekeyedAccountInfo['authAddr']}`, 'security');
    } else {
      throw new Error('Account rekey verification failed');
    }

 

    // Step 8: Create transaction group with dummy transactions for additional pool bytes
    log(`Creating post-quantum Resistant account payment transaction group...`, 'step');
    log(`Sending ${PAYMENT_AMOUNT_ALGO} Algo to: ${TARGET_ADDRESS}`, 'algo');

    const paymentParams = {
      sender: senderAddress, // Original address (now rekeyed)
      receiver: TARGET_ADDRESS,
      amount: PAYMENT_AMOUNT_MICRO_ALGOS,
      note: `Falcon PQ-Resistant payment - ${new Date().toISOString()}`
    };

    // Get transaction parameters
    const suggestedParams = await sdk.algod.getTransactionParams().do();
    log(`Network fee: ${suggestedParams.fee} microAlgos per transaction`, 'info');
    log(`Transaction validity: rounds ${suggestedParams.firstValid} to ${suggestedParams.lastValid}`, 'info');

    // Create main payment transaction with higher fee to cover group
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: paymentParams.sender,
      receiver: paymentParams.receiver,
      amount: paymentParams.amount,
      note: new Uint8Array(Buffer.from(paymentParams.note)),
      suggestedParams: { ...suggestedParams, fee: 4000, flatFee: true } // Cover all transaction fees
    });

   

    // Create dummy LogicSig for additional pool bytes (similar to falcon-txn-test pattern)
    log('Creating dummy LogicSig for transaction group optimization...', 'step');
    const dummyProgram = `#pragma version 3
      txn RekeyTo
      global ZeroAddress
      ==
      txn CloseRemainderTo
      global ZeroAddress
      ==
      &&
      txn Amount
      int 0
      ==
      txn Lease
      len
      int 32
      >=
      &&
      assert`;

    const dummyProgramCompiled = await sdk.algod.compile(dummyProgram).do();
    const dummyProgramBytes = new Uint8Array(Buffer.from(dummyProgramCompiled.result, "base64"));
    const dummyLsig = new algosdk.LogicSigAccount(dummyProgramBytes);
    const dummyAddress = dummyLsig.address();

    log(`Dummy LogicSig Address: ${dummyAddress}`, 'info');

    // Create dummy transactions for additional pool bytes
    const dummyTx1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: dummyAddress,
      receiver: dummyAddress,
      amount: 0,
      lease: new Uint8Array(32).map(() => Math.floor(Math.random() * 256)), // Random 32-byte lease
      suggestedParams: { ...suggestedParams, fee: 0, flatFee: true }
    });

    const dummyTx2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: dummyAddress,
      receiver: dummyAddress,
      amount: 0,
      lease: new Uint8Array(32).map(() => Math.floor(Math.random() * 256)), // Random 32-byte lease
      suggestedParams: { ...suggestedParams, fee: 0, flatFee: true }
    });

    const dummyTx3 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: dummyAddress,
      receiver: dummyAddress,
      amount: 0,
      lease: new Uint8Array(32).map(() => Math.floor(Math.random() * 256)), // Random 32-byte lease
      suggestedParams: { ...suggestedParams, fee: 0, flatFee: true }
    });

    // Group all transactions
    const transactions = [paymentTxn, dummyTx1, dummyTx2, dummyTx3];
    algosdk.assignGroupID(transactions);


    log('Transaction group created with additional pool bytes', 'success');
    log(`Group contains ${transactions.length} transactions`, 'info');
    log(`Main payment: ${PAYMENT_AMOUNT_ALGO} Algo from ${senderAddress} to ${TARGET_ADDRESS}`, 'algo');
    log(`Dummy transactions: 3x zero-amount transactions for pool byte optimization`, 'info');
    log(`Total group fee: 4000 microAlgos (covered by main transaction)`, 'info');
    // Step 9: Create LogicSig for transaction signing
    log('Creating LogicSig for transaction signing...', 'step');
    const logicSig = await sdk.createLogicSig(conversionInfo, paymentTxn.txID().toString());
    
    log(`LogicSig created with address: ${logicSig.address()}`, 'success');
    log(`LogicSig arguments: ${logicSig.lsig.args.length} (Falcon signature included)`, 'info');
    log(`Falcon signature size: ${logicSig.lsig.args[0].length} bytes`, 'falcon');
    // Sign with LogicSig (Falcon signature for main tx, dummy LogicSig for others)
    log('Signing transaction group with Falcon post-quantum signature...', 'falcon');
    const signedPayment = algosdk.signLogicSigTransactionObject(paymentTxn, logicSig);
    const signedDummy1 = algosdk.signLogicSigTransactionObject(dummyTx1, dummyLsig);
    const signedDummy2 = algosdk.signLogicSigTransactionObject(dummyTx2, dummyLsig);
    const signedDummy3 = algosdk.signLogicSigTransactionObject(dummyTx3, dummyLsig);

    const signedGroup = [signedPayment.blob, signedDummy1.blob, signedDummy2.blob, signedDummy3.blob];

    log('Transaction group signed successfully with Falcon signature!', 'success');
    log(`Main transaction signed with Falcon signature (${logicSig.lsig.args[0].length} bytes)`, 'falcon');
    log(`Dummy transactions signed with optimization LogicSig`, 'info');
    log(`Total group size: ${signedGroup.reduce((sum, tx) => sum + tx.length, 0)} bytes`, 'info');

    // Step 10: Submit transaction group
    log('Submitting transaction group to TestNet...', 'step');
    
    const txResponse = await sdk.algod.sendRawTransaction(signedGroup).do();
    const paymentTxId = txResponse.txid;
    
    log(`Transaction group submitted successfully!`, 'success');
    log(`Group Transaction ID: ${paymentTxId}`, 'algo');

    // Step 11: Wait for confirmation
    const paymentConfirmation = await waitForConfirmation(sdk.algod, paymentTxId);
    
    log(`🎉 POST-QUANTUM PAYMENT CONFIRMED!`, 'success');
    log(`Confirmed in round: ${paymentConfirmation['confirmed-round']}`, 'success');
    log(`Transaction fee: ${paymentConfirmation.txn.txn.fee} microAlgos`, 'info');

    // Step 12: Verify balances after transaction
    log('Verifying final balances...', 'step');
    
    const senderFinalBalance = await checkBalance(sdk.algod, senderAddress);
    const receiverFinalBalance = await checkBalance(sdk.algod, TARGET_ADDRESS);
    
    console.log('\n🎯 TRANSACTION SUMMARY');
    console.log('=====================');
    console.log(`✅ Successfully sent ${PAYMENT_AMOUNT_ALGO} Algo using Falcon post-quantum signatures!`);
    console.log(`📄 Transaction ID: ${paymentTxId}`);
    console.log(`🌐 View on LORA: https://lora.algokit.io/testnet/transaction/${paymentTxId}`);
    console.log(`🔐 Signature Algorithm: Falcon-1024 (Post-Quantum Resistant)`);
    console.log(`📊 Signature Size: ${logicSig.lsig.args[0].length} bytes`);
    console.log(`💰 Transaction Fee: ${paymentConfirmation.txn.txn.fee} microAlgos`);
    console.log(`🏦 Sender Final Balance: ${FalconAlgoUtils.microAlgosToAlgos(senderFinalBalance.balance)} Algo`);
    console.log(`🎯 Receiver Balance: ${FalconAlgoUtils.microAlgosToAlgos(receiverFinalBalance.balance)} Algo`);

    console.log('\n🔬 EDUCATIONAL INSIGHTS');
    console.log('=======================');
    console.log('🛡️  Post-Quantum Security: This transaction is resistant against quantum computer attacks');
    console.log('🔑 Falcon Signatures: Used deterministic lattice-based cryptography');
    console.log('📋 LogicSig Integration: Leveraged Algorand\'s smart contract system for verification');
    console.log('🔄 Account Rekeying: Original account now requires Falcon signatures for all transactions');
    console.log('🌐 Blockchain Compatibility: Full integration with Algorand\'s consensus mechanism');
    console.log('⚡ Performance: Near-native performance thanks to WebAssembly implementation');

    console.log('\n📁 FILES CREATED');
    console.log('================');
    console.log('📄 standard-account.json - Original Algorand account details');
    console.log('📄 falcon-protected-account.json - Complete Falcon account information');
    console.log('💡 These files contain all necessary information for account recovery and future use');

    log('🎉 Integration test completed successfully!', 'success');
    log('Your Algorand account is now protected by post-quantum cryptography!', 'security');

  } catch (error) {
    log(`Integration test failed: ${error.message}`, 'error');
    console.error('\n❌ Error Details:', error);
    
    if (error.message.includes('insufficient')) {
      console.log('\n💡 Troubleshooting:');
      console.log('- Make sure the account is funded with at least 0.2 Algo');
      console.log('- Visit https://bank.testnet.algorand.network/ to get TestNet funds');
      console.log('- Wait a few moments for the funding transaction to confirm');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Test interrupted by user');
  rl.close();
  process.exit(0);
});

// Run the integration test
console.log('🦅 Starting Falcon-Algorand Integration Test...\n');
runIntegrationTest().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
