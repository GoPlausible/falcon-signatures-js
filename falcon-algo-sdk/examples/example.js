/**
 * Example usage of Falcon-Algorand SDK
 * Demonstrates creating Falcon-protected accounts, converting existing accounts, and making transactions
 */

import FalconAlgoSDK, { Networks, FalconAlgoUtils } from '../index.js';
import dotenv from 'dotenv';

// Load environment variables if available
dotenv.config();

async function runExample() {
  console.log('🚀 Falcon-Algorand SDK Example\n');

  try {
    // 1. Initialize SDK (using TestNet for this example)
    console.log('1️⃣ Initializing Falcon-Algorand SDK...');
    const sdk = new FalconAlgoSDK(Networks.TESTNET);
    console.log('✅ SDK initialized\n');

    // 2. Create a new Falcon-protected account
    console.log('2️⃣ Creating new Falcon-protected account...');
    const newAccount = await sdk.createFalconAccount();
    
    console.log(`✅ New Falcon-protected account created!`);
    console.log(`   Address: ${newAccount.address}`);
    console.log(`   Falcon Public Key: ${newAccount.falconKeys.publicKey.substring(0, 40)}...`);
    console.log(`   Backup Address: ${newAccount.backupAccount?.address || 'None'}\n`);

    // 3. Convert existing account (if mnemonic is provided)
    if (process.env.EXISTING_ACCOUNT_MNEMONIC) {
      console.log('3️⃣ Converting existing account to Falcon-protected...');
      
      const conversionResult = await sdk.convertToFalconAccount(process.env.EXISTING_ACCOUNT_MNEMONIC);
      
      console.log(`✅ Account conversion prepared!`);
      console.log(`   Original Address: ${conversionResult.originalAddress}`);
      console.log(`   New Falcon Address: ${conversionResult.newAddress}`);
      console.log(`   Rekey Transaction ID: ${conversionResult.rekeyTransaction.txId}`);
      console.log('   Note: Submit the rekey transaction to complete conversion\n');

      // Optionally submit the conversion (uncomment if you want to actually submit)
      // console.log('   Submitting rekey transaction...');
      // const submissionResult = await sdk.submitConversion(conversionResult);
      // console.log(`   ✅ Conversion completed! TxID: ${submissionResult.txId}\n`);
    } else {
      console.log('3️⃣ Skipping account conversion (no EXISTING_ACCOUNT_MNEMONIC provided)\n');
    }

    // 4. Demonstrate transaction creation (without submitting)
    console.log('4️⃣ Creating sample payment transaction...');
    
    const paymentParams = {
      sender: newAccount.address,
      receiver: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Dummy address
      amount: FalconAlgoUtils.algosToMicroAlgos(0.1), // 0.1 Algo
      note: 'Falcon-powered payment example'
    };

    try {
      const signedPayment = await sdk.createPayment(paymentParams, newAccount);
      console.log(`✅ Payment transaction created and signed with Falcon signature`);
      console.log(`   Amount: ${FalconAlgoUtils.microAlgosToAlgos(paymentParams.amount)} Algo`);
      console.log(`   Receiver: ${paymentParams.receiver}`);
      console.log(`   Note: ${paymentParams.note}`);
      console.log('   (Transaction not submitted - this is just a demo)\n');
    } catch (error) {
      console.log(`⚠️  Could not create payment (likely due to network params): ${error.message}\n`);
    }

    // 5. Demonstrate fee estimation
    console.log('5️⃣ Estimating transaction fees...');
    
    try {
      const feeEstimate = await sdk.estimateFees(1);
      console.log(`✅ Fee estimation for Falcon transactions:`);
      console.log(`   Base fee per transaction: ${feeEstimate.baseFePerTransaction} microAlgos`);
      console.log(`   Falcon overhead: ${feeEstimate.falconOverheadPerTransaction} microAlgos`);
      console.log(`   Total estimated fee: ${feeEstimate.estimatedFeePerTransaction} microAlgos\n`);
    } catch (error) {
      console.log(`⚠️  Could not estimate fees: ${error.message}\n`);
    }

    // 6. Demonstrate account backup
    console.log('6️⃣ Creating account backup...');
    
    const backupWithoutSecrets = sdk.backupAccount(newAccount, false);
    const backupWithSecrets = sdk.backupAccount(newAccount, true);
    
    console.log(`✅ Account backup created`);
    console.log(`   Backup without secrets: ${backupWithoutSecrets.length} characters`);
    console.log(`   Backup with secrets: ${backupWithSecrets.length} characters`);
    console.log('   (Backup data not displayed for security)\n');

    // 7. Demonstrate utility functions
    console.log('7️⃣ Utility functions demo...');
    
    const isValidAccount = FalconAlgoUtils.validateAccountInfo(newAccount);
    const randomLease = FalconAlgoUtils.generateRandomLease();
    
    console.log(`✅ Utilities demo:`);
    console.log(`   Account validation: ${isValidAccount}`);
    console.log(`   Random lease generated: ${randomLease.length} bytes`);
    console.log(`   Conversion example: 1 Algo = ${FalconAlgoUtils.algosToMicroAlgos(1)} microAlgos\n`);

    // 8. Key rotation example (creates new account)
    console.log('8️⃣ Demonstrating key rotation...');
    
    const rotatedAccount = await sdk.rotateFalconKeys(newAccount, newAccount.falconKeys);
    console.log(`✅ Key rotation completed:`);
    console.log(`   Previous address: ${rotatedAccount.previousAddress}`);
    console.log(`   New address: ${rotatedAccount.address}`);
    console.log('   Note: In production, you would transfer funds and update references\n');

    console.log('🎉 Example completed successfully!');
    console.log('\n📝 Summary of what was demonstrated:');
    console.log('   ✅ SDK initialization');
    console.log('   ✅ New Falcon-protected account creation');
    console.log('   ✅ Existing account conversion preparation');
    console.log('   ✅ Payment transaction creation and signing');
    console.log('   ✅ Fee estimation');
    console.log('   ✅ Account backup and restore');
    console.log('   ✅ Utility functions');
    console.log('   ✅ Key rotation');
    
    console.log('\n🔐 Security Notes:');
    console.log('   • Falcon signatures provide post-quantum security');
    console.log('   • All accounts use LogicSig with embedded Falcon public keys');
    console.log('   • Secret keys should be stored securely and never shared');
    console.log('   • Test on TestNet before using on MainNet');

  } catch (error) {
    console.error('❌ Error in example:', error);
    process.exit(1);
  }
}

// Run the example
runExample();
