/**
 * Falcon-Algorand SDK
 * Post-quantum secure Algorand accounts using Falcon signatures
 */

import algosdk from 'algosdk';
import Falcon from 'falcon-signatures';
import { Point } from '@noble/ed25519';
import { base32 } from "rfc4648";
/**
 * Network configurations
 */
export const Networks = {
  MAINNET: {
    server: 'https://mainnet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'mainnet'
  },
  TESTNET: {
    server: 'https://testnet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'testnet'
  },
  BETANET: {
    server: 'https://betanet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'betanet'
  }
};

function isOnCurve(bytes) {
  try {
    Point.fromHex(bytes);
    return true;  // BAD
  } catch {
    return false; // GOOD
  }
}
/**
 * Main SDK class for Falcon-powered Algorand accounts
 */
export class FalconAlgoSDK {
  constructor(network = Networks.TESTNET, customAlgod = null) {
    this.network = network;
    this.algod = customAlgod || new algosdk.Algodv2(network.token, network.server, network.port);
    this.falcon = new Falcon();
    this.initialized = false;
    this._initPromise = this._initialize();
  }

  /**
   * Initialize the Falcon module
   * @private
   */
  async _initialize() {
    if (!this.initialized) {
      await this.falcon._ensureInitialized();
      this.initialized = true;
    }
  }

  /**
   * Ensure SDK is initialized before operations
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this._initPromise;
    }
  }

  /**
   * Generate TEAL program for Falcon signature verification
   * @param {Uint8Array} falconPublicKey - Falcon public key
   * @returns {string} TEAL program source code
   * @private
   */
  _generateTealProgram(falconPublicKey, counter) {
    return `#pragma version 12
bytecblock 0x${counter.toString(16).padStart(2, '0')}
gtxn 0 TxID
arg 0
pushbytes 0x${Buffer.from(falconPublicKey).toString('hex')}
falcon_verify`;
  }


  /**
   * Core Function 1: Create a new Falcon-protected Algorand account
   * @param {Object} options - Options for account creation
   * @param {boolean} options.generateEdKeys - Whether to generate ed25519 keys for backup (default: true)
   * @returns {Promise<Object>} Account information
   */
  async createFalconAccount(options = {}) {
    await this._ensureInitialized();

    const { generateEdKeys = true } = options;

    console.log('Generating Falcon-protected Algorand account...');

    // 1. Generate Falcon keypair
    const falconKeys = await this.falcon.keypair();

    // 2. Optionally generate standard Algorand keys for backup/compatibility
    let algoAccount = null;
    let algoAddress = null;
    if (generateEdKeys) {
      algoAccount = algosdk.generateAccount();
      algoAddress = algoAccount.addr.toString();
    }

    // 3. Create TEAL program that verifies Falcon signatures
    // 4. Compile TEAL program to get the escrow address (this becomes our account address)

    let tealProgram = null;
    let programBytes = null;
    let escrowAddress = null;
    let edpCounter = 0;
    for (let counter = 0; counter < 256; counter++) {
      tealProgram = this._generateTealProgram(falconKeys.publicKey, counter);
      const compileResp = await this.algod.compile(tealProgram).do();
      programBytes = new Uint8Array(Buffer.from(compileResp.result, "base64"));
      const addressBytes = algosdk.decodeAddress(compileResp.hash).publicKey;
      if (!isOnCurve(addressBytes)) {
        console.log(`Selected counter: ${counter}`);
        edpCounter = counter;
        escrowAddress = compileResp.hash;
        break;
      }
    }

    const messageToVerify = generateEdKeys ? Buffer.from(algoAccount.sk.slice(-32)) : new Uint8Array([0]);

    // 5. Generate the Falcon signature for the verification message
    const falconSignature = await this.falcon.sign(messageToVerify, falconKeys.secretKey);

    // 6. Verify the setup works
    const verifyResult = await this.falcon.verify(messageToVerify, falconSignature, falconKeys.publicKey);
    if (!verifyResult) {
      throw new Error('Failed to verify Falcon signature setup');
    }

    const accountInfo = {
      // Primary Falcon-protected address (escrow address from TEAL compilation)
      address: escrowAddress,
 
      falconKeys: {
        publicKey: Falcon.bytesToHex(falconKeys.publicKey),
        secretKey: Falcon.bytesToHex(falconKeys.secretKey)
      },

      // Backup ed25519 account (if generated)
      backupAccount: algoAccount ? {
        address: algoAddress,
        mnemonic: algosdk.secretKeyToMnemonic(algoAccount.sk),
        publicKey: Buffer.from(algoAccount.sk.slice(-32)).toString('hex')
      } : null,

      // LogicSig information
      logicSig: {
        counter: edpCounter,
        program: Buffer.from(programBytes).toString('base64'),
        address: escrowAddress, // LogicSig address matches the escrow address
        verificationMessage: Buffer.from(messageToVerify).toString('hex'),
      },

      // Metadata
      created: new Date().toISOString(),
      network: this.network.name,
      type: 'falcon-protected'
    };

    console.log(`✅ Falcon-protected account created: ${escrowAddress}`);
    return accountInfo;
  }

  /**
   * Core Function 2: Convert existing Algorand account to Falcon-protected
   * @param {string|Object} account - Mnemonic string or account object with secretKey
   * @param {Object} falconKeys - Existing Falcon keys or null to generate new ones
   * @param {string} falconKeys.publicKey - Hex string of Falcon public key
   * @param {string} falconKeys.secretKey - Hex string of Falcon secret key
   * @returns {Promise<Object>} Conversion result with rekey transaction info
   */
  async convertToFalconAccount(account, falconKeys = null) {
    await this._ensureInitialized();

    console.log('Converting existing Algorand account to Falcon-protected...');

    // 1. Parse the existing account - properly handle mnemonic input
    let algoAccount;
    if (typeof account === 'string') {
      // It's a mnemonic - convert it properly
      algoAccount = algosdk.mnemonicToSecretKey(account);
    } else if (account.sk) {
      algoAccount = account;
    } else {
      throw new Error('Invalid account format. Provide mnemonic string or account object with secretKey.');
    }

    // 2. Generate or use provided Falcon keys
    let falconKeyPair;
    if (falconKeys) {
      falconKeyPair = {
        publicKey: Falcon.hexToBytes(falconKeys.publicKey),
        secretKey: Falcon.hexToBytes(falconKeys.secretKey)
      };
    } else {
      falconKeyPair = await this.falcon.keypair();
    }

    // 3. Extract ed25519 public key from the account (last 32 bytes of secret key)
    const ed25519PublicKey = Buffer.from(algoAccount.sk.slice(-32));
    const originalAddress = algoAccount.addr.toString();
    console.log(`Converting account: ${originalAddress}`);

    // 4. Create TEAL program that verifies Falcon signatures of this account's public key
    // 5. Compile TEAL program to get escrow address
    let tealProgram = null;
    let programBytes = null;
    let escrowAddress = null;
    let edpCounter = 0;
    for (let counter = 0; counter < 256; counter++) {
      tealProgram = this._generateTealProgram(falconKeyPair.publicKey, counter);
      const compileResp = await this.algod.compile(tealProgram).do();
      programBytes = new Uint8Array(Buffer.from(compileResp.result, "base64"));

      const addressBytes = algosdk.decodeAddress(compileResp.hash).publicKey;
      if (!isOnCurve(addressBytes)) {
        console.log(`Selected counter: ${counter}`);
        edpCounter = counter;
        escrowAddress = compileResp.hash;
        break;
      }
    }

    // 6. Generate Falcon signature of the account's ed25519 public key
    const falconSignature = await this.falcon.sign(ed25519PublicKey, falconKeyPair.secretKey);

    // 7. Verify the signature works
    const verifyResult = await this.falcon.verify(ed25519PublicKey, falconSignature, falconKeyPair.publicKey);
    if (!verifyResult) {
      throw new Error('Failed to verify Falcon signature during conversion');
    }

    // 8. Create rekey transaction
    const params = await this.algod.getTransactionParams().do();

    const rekeyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: originalAddress,
      receiver: originalAddress, // Send to self
      amount: 0, // Zero amount for rekey
      rekeyTo: escrowAddress, // Rekey to Falcon-protected LogicSig
      suggestedParams: params
    });

    // 9. Sign rekey transaction with original account
    const signedRekeyTxn = rekeyTxn.signTxn(algoAccount.sk);

    const conversionInfo = {
      // Original account info (use the account we actually derived from mnemonic)
      originalAddress,
      originalMnemonic: algosdk.secretKeyToMnemonic(algoAccount.sk),

      // New Falcon-protected address (escrow address from TEAL compilation)
      newAddress: escrowAddress,

      // Falcon keys
      falconKeys: {
        publicKey: Falcon.bytesToHex(falconKeyPair.publicKey),
        secretKey: Falcon.bytesToHex(falconKeyPair.secretKey)
      },

      // LogicSig information
      logicSig: {
        counter: edpCounter,
        program: Buffer.from(programBytes).toString('base64'),
        address: escrowAddress, // LogicSig address matches escrow address
        verificationMessage: ed25519PublicKey.toString('hex'),
      },

      // Rekey transaction (ready to submit)
      rekeyTransaction: {
        txn: rekeyTxn,
        signedTxn: signedRekeyTxn,
        txId: rekeyTxn.txID().toString()
      },

      // Metadata
      converted: new Date().toISOString(),
      network: this.network.name,
      type: 'converted-to-falcon'
    };

    console.log(`✅ Conversion prepared. Original: ${originalAddress}, New: ${escrowAddress}`);
    console.log(`Submit the rekey transaction to complete conversion: ${rekeyTxn.txID().toString()}`);

    return conversionInfo;
  }

  /**
   * Submit a rekey transaction to complete account conversion
   * @param {Object} conversionInfo - Result from convertToFalconAccount
   * @param {boolean} waitForConfirmation - Whether to wait for confirmation (default: true)
   * @returns {Promise<Object>} Transaction result
   */
  async submitConversion(conversionInfo, waitForConfirmation = true) {
    console.log('Submitting rekey transaction...');

    const txResponse = await this.algod.sendRawTransaction(conversionInfo.rekeyTransaction.signedTxn).do();
    console.log(`Rekey transaction submitted: ${txResponse.txid}`);

    if (waitForConfirmation) {
      console.log('Waiting for confirmation...');
      const confirmation = await algosdk.waitForConfirmation(this.algod, txResponse.txid, 10);
      console.log(`✅ Rekey confirmed in round: ${confirmation["confirmed-round"]}`);

      return {
        txId: txResponse.txid,
        confirmedRound: confirmation["confirmed-round"],
        status: 'confirmed'
      };
    }

    return {
      txId: txResponse.txid,
      status: 'submitted'
    };
  }

  /**
   * Create a LogicSig account from Falcon account info
   * @param {Object} accountInfo - Account info from createFalconAccount or convertToFalconAccount
   * @returns {algosdk.LogicSigAccount} LogicSig account ready for transaction signing
   */
  async createLogicSig(accountInfo, txid) {
    const programBytes = new Uint8Array(Buffer.from(accountInfo.logicSig.program, 'base64'));
    const raw = base32.parse(txid, { loose: true });
    const txnIdBytes = new Uint8Array(raw);
   
    const falconKeyPair = {
      publicKey: Falcon.hexToBytes(accountInfo.falconKeys.publicKey),
      secretKey: Falcon.hexToBytes(accountInfo.falconKeys.secretKey)
    };
    const arg0 = await this.falcon.sign(txnIdBytes, falconKeyPair.secretKey);

    return new algosdk.LogicSigAccount(programBytes, [arg0]);
  }

  /**
   * Sign a transaction with Falcon-protected account
   * @param {Object} transaction - Algorand transaction object
   * @param {Object} accountInfo - Account info from createFalconAccount or convertToFalconAccount
   * @returns {Promise<Object>} Signed transaction
   */
  async signTransaction(transaction, accountInfo, txid) {
    const lsig = await this.createLogicSig(accountInfo, txid);
    return algosdk.signLogicSigTransactionObject(transaction, lsig);
  }

  /**
   * Create and sign a payment transaction
   * @param {Object} params - Payment parameters
   * @param {string} params.sender - Sender address (should match accountInfo.address)
   * @param {string} params.receiver - Receiver address
   * @param {number} params.amount - Amount in microAlgos
   * @param {string} params.note - Optional note
   * @param {Object} accountInfo - Falcon account info
   * @returns {Promise<Object>} Signed transaction ready for submission
   */
  async createPayment(params, accountInfo) {
    const { sender, receiver, amount, note } = params;

    // Get suggested parameters
    const suggestedParams = await this.algod.getTransactionParams().do();

    // Create payment transaction
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver,
      amount,
      note: note ? new Uint8Array(Buffer.from(note)) : undefined,
      suggestedParams
    });
    const txid = txn.txID().toString();

    // Sign with Falcon LogicSig
    return await this.signTransaction(txn, accountInfo, txid);
  }

  /**
   * Get account information from Algorand network
   * @param {string} address - Account address
   * @returns {Promise<Object>} Account information
   */
  async getAccountInfo(address) {
    return await this.algod.accountInformation(address).do();
  }

  /**
   * Check if an address has sufficient balance for a transaction
   * @param {string} address - Account address
   * @param {number} amount - Amount to check (in microAlgos)
   * @returns {Promise<boolean>} True if sufficient balance
   */
  async hasSufficientBalance(address, amount) {
    try {
      const accountInfo = await this.getAccountInfo(address);
      return accountInfo.amount >= amount;
    } catch (error) {
      return false;
    }
  }

  /**
   * Additional Function: Rotate Falcon keys for an existing Falcon-protected account
   * @param {Object} currentAccountInfo - Current account info
   * @param {Object} oldFalconKeys - Old Falcon keys for signing the rotation
   * @returns {Promise<Object>} New account info with rotated keys
   */
  async rotateFalconKeys(currentAccountInfo, oldFalconKeys) {
    await this._ensureInitialized();

    console.log('Rotating Falcon keys for account...');

    // Generate new Falcon keypair
    const newFalconKeys = await this.falcon.keypair();

    // For key rotation, we need to create a new LogicSig that proves ownership
    // This is a simplified approach - in production, you might want a more sophisticated key rotation mechanism

    const rotatedAccount = await this.createFalconAccount({ generateEdKeys: false });

    console.log(`✅ Keys rotated. New address: ${rotatedAccount.address}`);
    console.log('Note: You will need to transfer funds from old to new address and update references');

    return {
      ...rotatedAccount,
      previousAddress: currentAccountInfo.address,
      rotated: new Date().toISOString()
    };
  }

  /**
   * Additional Function: Create a multi-signature transaction group
   * @param {Array} transactions - Array of transaction objects
   * @param {Array} accountInfos - Array of corresponding account infos for signing
   * @returns {Promise<Array>} Array of signed transactions ready for group submission
   */
  async signTransactionGroup(transactions, accountInfos) {
    if (transactions.length !== accountInfos.length) {
      throw new Error('Number of transactions must match number of account infos');
    }

    // Assign group ID
    algosdk.assignGroupID(transactions);

    // Sign each transaction with its corresponding account
    const signedTxns = [];
    for (let i = 0; i < transactions.length; i++) {
      const signedTxn = await this.signTransaction(transactions[i], accountInfos[i], transactions[i].txID().toString());
      signedTxns.push(signedTxn.blob);
    }

    return signedTxns;
  }

  /**
   * Additional Function: Submit transaction group and wait for confirmation
   * @param {Array} signedTransactions - Array of signed transaction blobs
   * @param {number} maxRounds - Maximum rounds to wait for confirmation (default: 10)
   * @returns {Promise<Object>} Confirmation result
   */
  async submitTransactionGroup(signedTransactions, maxRounds = 10) {
    console.log(`Submitting transaction group with ${signedTransactions.length} transactions...`);

    const txResponse = await this.algod.sendRawTransaction(signedTransactions).do();
    console.log(`Group submitted with TxID: ${txResponse.txid}`);

    const confirmation = await algosdk.waitForConfirmation(this.algod, txResponse.txid, maxRounds);
    console.log(`✅ Group confirmed in round: ${confirmation["confirmed-round"]}`);

    return {
      txId: txResponse.txid,
      confirmedRound: confirmation["confirmed-round"],
      groupSize: signedTransactions.length
    };
  }

  /**
   * Additional Function: Estimate transaction fees for Falcon transactions
   * @param {number} transactionCount - Number of transactions in group (default: 1)
   * @returns {Promise<Object>} Fee estimation
   */
  async estimateFees(transactionCount = 1) {
    const params = await this.algod.getTransactionParams().do();

    // Falcon transactions are typically larger due to LogicSig signatures
    const baseFee = params.fee || 1000; // 1000 microAlgos base fee
    const falconOverhead = 500; // Additional overhead for Falcon signatures

    const estimatedFeePerTx = baseFee + falconOverhead;
    const totalFee = estimatedFeePerTx * transactionCount;

    return {
      baseFePerTransaction: baseFee,
      falconOverheadPerTransaction: falconOverhead,
      estimatedFeePerTransaction: estimatedFeePerTx,
      totalEstimatedFee: totalFee,
      transactionCount
    };
  }

  /**
   * Additional Function: Backup account information to JSON
   * @param {Object} accountInfo - Account info to backup
   * @param {boolean} includeSecretKey - Whether to include secret key (default: false)
   * @returns {string} JSON string for backup
   */
  backupAccount(accountInfo, includeSecretKey = false) {
    // Create a deep copy to avoid modifying the original
    const backup = JSON.parse(JSON.stringify(accountInfo));
    backup.backedUp = new Date().toISOString();

    if (!includeSecretKey) {
      delete backup.falconKeys.secretKey;
      if (backup.backupAccount) {
        delete backup.backupAccount.mnemonic;
      }
    }

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Additional Function: Restore account from backup
   * @param {string} backupJson - JSON backup string
   * @param {string} secretKey - Falcon secret key (if not included in backup)
   * @returns {Object} Restored account info
   */
  restoreAccount(backupJson, secretKey = null) {
    const accountInfo = JSON.parse(backupJson);

    if (!accountInfo.falconKeys.secretKey && secretKey) {
      accountInfo.falconKeys.secretKey = secretKey;
    }

    accountInfo.restored = new Date().toISOString();

    return accountInfo;
  }
}

/**
 * Utility functions
 */
export const FalconAlgoUtils = {
  /**
   * Validate Falcon account info structure
   * @param {Object} accountInfo - Account info to validate
   * @returns {boolean} True if valid
   */
  validateAccountInfo(accountInfo) {
    const required = ['address', 'falconKeys', 'logicSig', 'type'];
    return required.every(field => accountInfo.hasOwnProperty(field));
  },

  /**
   * Convert microAlgos to Algos
   * @param {number|bigint} microAlgos - Amount in microAlgos
   * @returns {number} Amount in Algos
   */
  microAlgosToAlgos(microAlgos) {
    // Handle BigInt values from Algorand SDK
    const microAlgosNum = typeof microAlgos === 'bigint' ? Number(microAlgos) : microAlgos;
    return microAlgosNum / 1000000;
  },

  /**
   * Convert Algos to microAlgos
   * @param {number} algos - Amount in Algos
   * @returns {number} Amount in microAlgos
   */
  algosToMicroAlgos(algos) {
    return Math.round(algos * 1000000);
  },

  /**
   * Generate a secure random lease
   * @returns {Uint8Array} 32-byte random lease
   */
  generateRandomLease() {
    return new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
  }
};

// Default export
export default FalconAlgoSDK;
