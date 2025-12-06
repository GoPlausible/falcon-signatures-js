/**
 * Falcon-Algorand SDK
 * Post-quantum secure Algorand accounts using Falcon signatures
 */

import algosdk, {
  Algodv2,
  LogicSigAccount,
  SuggestedParams,
  Transaction,
} from 'algosdk';
import Falcon from 'falcon-signatures';
import { Point } from '@noble/ed25519';
import { base32 } from 'rfc4648';

/**
 * Network configurations
 */
export type NetworkConfig = {
  server: string;
  port: string | number;
  token: string;
  name: string;
};

export const Networks: Record<'MAINNET' | 'TESTNET' | 'BETANET', NetworkConfig> = {
  MAINNET: {
    server: 'https://mainnet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'mainnet',
  },
  TESTNET: {
    server: 'https://testnet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'testnet',
  },
  BETANET: {
    server: 'https://betanet-api.algonode.cloud',
    port: '',
    token: '',
    name: 'betanet',
  },
};

export type FalconKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export type FalconKeysHex = {
  publicKey: string;
  secretKey: string;
};

export type BackupAccount = {
  address: string;
  mnemonic: string;
  publicKey: string;
};

export type LogicSigInfo = {
  counter: number;
  program: string;
  address: string;
  verificationMessage: string;
};

export type RekeyTransactionInfo = {
  txn: Transaction;
  signedTxn: Uint8Array;
  txId: string;
};

export type FalconAccountInfo = {
  address: string;
  falconKeys: FalconKeysHex;
  backupAccount: BackupAccount | null;
  logicSig: LogicSigInfo;
  created: string;
  network: string;
  type: 'falcon-protected';
};

export type ConversionInfo = {
  originalAddress: string;
  originalMnemonic: string;
  newAddress: string;
  falconKeys: FalconKeysHex;
  logicSig: LogicSigInfo;
  rekeyTransaction: RekeyTransactionInfo;
  converted: string;
  network: string;
  type: 'converted-to-falcon';
};

type SignedLogicSigTx = {
  txID: string;
  blob: Uint8Array;
};

function isOnCurve(bytes: Uint8Array): boolean {
  try {
    Point.fromHex(bytes as any);
    return true; // On curve (bad for LogicSig address)
  } catch {
    return false; // Off curve (good)
  }
}

const getConfirmedRound = (resp: any): number | undefined =>
  resp?.confirmedRound ?? resp?.['confirmed-round'];

/**
 * Main SDK class for Falcon-powered Algorand accounts
 */
export class FalconAlgoSDK {
  network: NetworkConfig;
  algod: Algodv2;
  falcon: Falcon;
  initialized: boolean;
  private _initPromise: Promise<void>;

  constructor(network: NetworkConfig = Networks.TESTNET, customAlgod: Algodv2 | null = null) {
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
  private async _initialize(): Promise<void> {
    if (!this.initialized) {
      await this.falcon._ensureInitialized();
      this.initialized = true;
    }
  }

  /**
   * Ensure SDK is initialized before operations
   * @private
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this._initPromise;
    }
  }

  /**
   * Generate TEAL program for transaction ID verification
   * @param falconPublicKey Falcon public key
   * @param counter byte value (0-255) used to shift off-curve addresses
   * @returns TEAL source
   * @private
   */
  private _generateTealProgram(falconPublicKey: Uint8Array, counter: number): string {
    return `#pragma version 12
bytecblock 0x${counter.toString(16).padStart(2, '0')}
gtxn 0 TxID
arg 0
pushbytes 0x${Buffer.from(falconPublicKey).toString('hex')}
falcon_verify`;
  }

  /**
   * Core Function 1: Create a new Falcon-protected Algorand account
   * @param options Options for account creation
   * @param options.generateEdKeys Whether to generate ed25519 keys for backup (default: true)
   * @returns Account information
   */
  async createFalconAccount(options: { generateEdKeys?: boolean } = {}): Promise<FalconAccountInfo> {
    await this._ensureInitialized();

    const { generateEdKeys = true } = options;

    console.log('Generating Falcon-protected Algorand account...');

    // 1. Generate Falcon keypair
    const falconKeys: FalconKeyPair = await this.falcon.keypair();

    // 2. Optionally generate standard Algorand keys for backup/compatibility
    let algoAccount: algosdk.Account | null = null;
    let algoAddress: string | null = null;
    if (generateEdKeys) {
      algoAccount = algosdk.generateAccount();
      algoAddress = algoAccount.addr.toString();
    }

    // 3-4. Create TEAL program and compile until off-curve address is found
    let tealProgram: string | null = null;
    let programBytes: Uint8Array | null = null;
    let escrowAddress: string | null = null;
    let edpCounter = 0;
    for (let counter = 0; counter < 256; counter++) {
      tealProgram = this._generateTealProgram(falconKeys.publicKey, counter);
      const compileResp = await this.algod.compile(tealProgram).do();
      programBytes = new Uint8Array(Buffer.from(compileResp.result, 'base64'));
      const addressBytes = algosdk.decodeAddress(compileResp.hash).publicKey;
      if (!isOnCurve(addressBytes)) {
        console.log(`Selected counter: ${counter}`);
        edpCounter = counter;
        escrowAddress = compileResp.hash;
        break;
      }
    }

    if (!programBytes || !escrowAddress) {
      throw new Error('Failed to generate an off-curve LogicSig address');
    }

    const messageToVerify = generateEdKeys && algoAccount
      ? Buffer.from(algoAccount.sk.slice(-32))
      : new Uint8Array([0]);

    // 5. Generate the Falcon signature for the verification message
    const falconSignature = await this.falcon.sign(messageToVerify, falconKeys.secretKey);

    // 6. Verify the setup works
    const verifyResult = await this.falcon.verify(messageToVerify, falconSignature, falconKeys.publicKey);
    if (!verifyResult) {
      throw new Error('Failed to verify Falcon signature setup');
    }

    const accountInfo: FalconAccountInfo = {
      address: escrowAddress,
      falconKeys: {
        publicKey: Falcon.bytesToHex(falconKeys.publicKey),
        secretKey: Falcon.bytesToHex(falconKeys.secretKey),
      },
      backupAccount: algoAccount && algoAddress
        ? {
            address: algoAddress,
            mnemonic: algosdk.secretKeyToMnemonic(algoAccount.sk),
            publicKey: Buffer.from(algoAccount.sk.slice(-32)).toString('hex'),
          }
        : null,
      logicSig: {
        counter: edpCounter,
        program: Buffer.from(programBytes).toString('base64'),
        address: escrowAddress,
        verificationMessage: Buffer.from(messageToVerify).toString('hex'),
      },
      created: new Date().toISOString(),
      network: this.network.name,
      type: 'falcon-protected',
    };

    console.log(`✅ Falcon-protected account created: ${escrowAddress}`);
    return accountInfo;
  }

  /**
   * Core Function 2: Convert existing Algorand account to Falcon-protected
   * @param account Mnemonic string or account object with secretKey
   * @param falconKeys Existing Falcon keys or null to generate new ones
   * @returns Conversion result with rekey transaction info
   */
  async convertToFalconAccount(
    account: string | algosdk.Account,
    falconKeys: FalconKeysHex | null = null,
  ): Promise<ConversionInfo> {
    await this._ensureInitialized();

    console.log('Converting existing Algorand account to Falcon-protected...');

    // 1. Parse the existing account
    let algoAccount: algosdk.Account;
    if (typeof account === 'string') {
      algoAccount = algosdk.mnemonicToSecretKey(account);
    } else if ('sk' in account) {
      algoAccount = account;
    } else {
      throw new Error('Invalid account format. Provide mnemonic string or account object with secretKey.');
    }

    // 2. Generate or use provided Falcon keys
    let falconKeyPair: FalconKeyPair;
    if (falconKeys) {
      falconKeyPair = {
        publicKey: Falcon.hexToBytes(falconKeys.publicKey),
        secretKey: Falcon.hexToBytes(falconKeys.secretKey),
      };
    } else {
      falconKeyPair = await this.falcon.keypair();
    }

    // 3. Extract ed25519 public key from the account (last 32 bytes of secret key)
    const ed25519PublicKey = Buffer.from(algoAccount.sk.slice(-32));
    const originalAddress = algoAccount.addr.toString();
    console.log(`Converting account: ${originalAddress}`);

    // 4-5. Create TEAL program and compile until off-curve address is found
    let tealProgram: string | null = null;
    let programBytes: Uint8Array | null = null;
    let escrowAddress: string | null = null;
    let edpCounter = 0;
    for (let counter = 0; counter < 256; counter++) {
      tealProgram = this._generateTealProgram(falconKeyPair.publicKey, counter);
      const compileResp = await this.algod.compile(tealProgram).do();
      programBytes = new Uint8Array(Buffer.from(compileResp.result, 'base64'));

      const addressBytes = algosdk.decodeAddress(compileResp.hash).publicKey;
      if (!isOnCurve(addressBytes)) {
        console.log(`Selected counter: ${counter}`);
        edpCounter = counter;
        escrowAddress = compileResp.hash;
        break;
      }
    }

    if (!programBytes || !escrowAddress) {
      throw new Error('Failed to generate an off-curve LogicSig address');
    }

    // 6. Generate Falcon signature of the account's ed25519 public key
    const falconSignature = await this.falcon.sign(ed25519PublicKey, falconKeyPair.secretKey);

    // 7. Verify the signature works
    const verifyResult = await this.falcon.verify(ed25519PublicKey, falconSignature, falconKeyPair.publicKey);
    if (!verifyResult) {
      throw new Error('Failed to verify Falcon signature during conversion');
    }

    // 8. Create rekey transaction
    const params: SuggestedParams = await this.algod.getTransactionParams().do();

    const rekeyTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: originalAddress,
      receiver: originalAddress,
      amount: 0,
      rekeyTo: escrowAddress,
      suggestedParams: params,
    });

    // 9. Sign rekey transaction with original account
    const signedRekeyTxn = rekeyTxn.signTxn(algoAccount.sk);

    const conversionInfo: ConversionInfo = {
      originalAddress,
      originalMnemonic: algosdk.secretKeyToMnemonic(algoAccount.sk),
      newAddress: escrowAddress,
      falconKeys: {
        publicKey: Falcon.bytesToHex(falconKeyPair.publicKey),
        secretKey: Falcon.bytesToHex(falconKeyPair.secretKey),
      },
      logicSig: {
        counter: edpCounter,
        program: Buffer.from(programBytes).toString('base64'),
        address: escrowAddress,
        verificationMessage: ed25519PublicKey.toString('hex'),
      },
      rekeyTransaction: {
        txn: rekeyTxn,
        signedTxn: signedRekeyTxn,
        txId: rekeyTxn.txID().toString(),
      },
      converted: new Date().toISOString(),
      network: this.network.name,
      type: 'converted-to-falcon',
    };

    console.log(`✅ Conversion prepared. Original: ${originalAddress}, New: ${escrowAddress}`);
    console.log(`Submit the rekey transaction to complete conversion: ${rekeyTxn.txID().toString()}`);

    return conversionInfo;
  }

  /**
   * Submit a rekey transaction to complete account conversion
   * @param conversionInfo Result from convertToFalconAccount
   * @param waitForConfirmation Whether to wait for confirmation (default: true)
   * @returns Transaction result
   */
  async submitConversion(
    conversionInfo: ConversionInfo,
    waitForConfirmation = true,
  ): Promise<{ txId: string; confirmedRound?: number; status: 'confirmed' | 'submitted' }> {
    console.log('Submitting rekey transaction...');

    const txResponse = await this.algod.sendRawTransaction(conversionInfo.rekeyTransaction.signedTxn).do();
    console.log(`Rekey transaction submitted: ${txResponse.txid}`);

    if (waitForConfirmation) {
      console.log('Waiting for confirmation...');
      const confirmation = await algosdk.waitForConfirmation(this.algod, txResponse.txid, 10);
      const confirmedRound = getConfirmedRound(confirmation);
      console.log(`✅ Rekey confirmed in round: ${confirmedRound}`);

      return {
        txId: txResponse.txid,
        confirmedRound,
        status: 'confirmed',
      };
    }

    return {
      txId: txResponse.txid,
      status: 'submitted',
    };
  }

  /**
   * Create a LogicSig account from Falcon account info and txId
   */
  async createLogicSig(accountInfo: FalconAccountInfo | ConversionInfo, txid: string): Promise<LogicSigAccount> {
    const programBytes = new Uint8Array(Buffer.from(accountInfo.logicSig.program, 'base64'));
    const raw = base32.parse(txid, { loose: true });
    const txnIdBytes = new Uint8Array(raw);

    const falconKeyPair: FalconKeyPair = {
      publicKey: Falcon.hexToBytes(accountInfo.falconKeys.publicKey),
      secretKey: Falcon.hexToBytes(accountInfo.falconKeys.secretKey),
    };
    const arg0 = await this.falcon.sign(txnIdBytes, falconKeyPair.secretKey);

    return new algosdk.LogicSigAccount(programBytes, [arg0]);
  }

  /**
   * Sign a transaction with Falcon-protected account
   */
  async signTransaction(
    transaction: Transaction,
    accountInfo: FalconAccountInfo | ConversionInfo,
    txid: string,
  ): Promise<SignedLogicSigTx> {
    const lsig = await this.createLogicSig(accountInfo, txid);
    return algosdk.signLogicSigTransactionObject(transaction, lsig);
  }

  /**
   * Create and sign a payment transaction
   */
  async createPayment(
    params: {
      sender: string;
      receiver: string;
      amount: number;
      note?: string;
    },
    accountInfo: FalconAccountInfo | ConversionInfo,
  ): Promise<SignedLogicSigTx> {
    const { sender, receiver, amount, note } = params;

    const suggestedParams = await this.algod.getTransactionParams().do();

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver,
      amount,
      note: note ? new Uint8Array(Buffer.from(note)) : undefined,
      suggestedParams,
    });
    const txid = txn.txID().toString();

    return await this.signTransaction(txn, accountInfo, txid);
  }

  /**
   * Get account information from Algorand network
   */
  async getAccountInfo(address: string): Promise<any> {
    return await this.algod.accountInformation(address).do();
  }

  /**
   * Check if an address has sufficient balance for a transaction
   */
  async hasSufficientBalance(address: string, amount: number): Promise<boolean> {
    try {
      const accountInfo = await this.getAccountInfo(address);
      return accountInfo.amount >= amount;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Additional Function: Rotate Falcon keys for an existing Falcon-protected account
   */
  async rotateFalconKeys(
    currentAccountInfo: FalconAccountInfo,
    _oldFalconKeys: FalconKeysHex,
  ): Promise<FalconAccountInfo & { previousAddress: string; rotated: string }> {
    await this._ensureInitialized();

    console.log('Rotating Falcon keys for account...');

    const rotatedAccount = await this.createFalconAccount({ generateEdKeys: false });

    console.log(`✅ Keys rotated. New address: ${rotatedAccount.address}`);
    console.log('Note: You will need to transfer funds from old to new address and update references');

    return {
      ...rotatedAccount,
      previousAddress: currentAccountInfo.address,
      rotated: new Date().toISOString(),
    };
  }

  /**
   * Additional Function: Create a multi-signature transaction group
   */
  async signTransactionGroup(
    transactions: Transaction[],
    accountInfos: (FalconAccountInfo | ConversionInfo)[],
  ): Promise<Uint8Array[]> {
    if (transactions.length !== accountInfos.length) {
      throw new Error('Number of transactions must match number of account infos');
    }

    algosdk.assignGroupID(transactions);

    const signedTxns: Uint8Array[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const signedTxn = await this.signTransaction(transactions[i], accountInfos[i], transactions[i].txID().toString());
      signedTxns.push(signedTxn.blob);
    }

    return signedTxns;
  }

  /**
   * Additional Function: Submit transaction group and wait for confirmation
   */
  async submitTransactionGroup(
    signedTransactions: Uint8Array[],
    maxRounds = 10,
  ): Promise<{ txId: string; confirmedRound: number; groupSize: number }> {
    console.log(`Submitting transaction group with ${signedTransactions.length} transactions...`);

    const txResponse = await this.algod.sendRawTransaction(signedTransactions).do();
    console.log(`Group submitted with TxID: ${txResponse.txid}`);

    const confirmation = await algosdk.waitForConfirmation(this.algod, txResponse.txid, maxRounds);
    const confirmedRound = getConfirmedRound(confirmation) ?? 0;
    console.log(`✅ Group confirmed in round: ${confirmedRound}`);

    return {
      txId: txResponse.txid,
      confirmedRound,
      groupSize: signedTransactions.length,
    };
  }

  /**
   * Additional Function: Estimate transaction fees for Falcon transactions
   */
  async estimateFees(transactionCount = 1): Promise<{
    baseFePerTransaction: number;
    falconOverheadPerTransaction: number;
    estimatedFeePerTransaction: number;
    totalEstimatedFee: number;
    transactionCount: number;
  }> {
    const params = await this.algod.getTransactionParams().do();

    const baseFee = Number(params.fee ?? 1000);
    const falconOverhead = 500;

    const estimatedFeePerTx = baseFee + falconOverhead;
    const totalFee = estimatedFeePerTx * transactionCount;

    return {
      baseFePerTransaction: baseFee,
      falconOverheadPerTransaction: falconOverhead,
      estimatedFeePerTransaction: estimatedFeePerTx,
      totalEstimatedFee: totalFee,
      transactionCount,
    };
  }

  /**
   * Additional Function: Backup account information to JSON
   */
  backupAccount(accountInfo: FalconAccountInfo, includeSecretKey = false): string {
    const backup = JSON.parse(JSON.stringify(accountInfo)) as FalconAccountInfo;
    (backup as any).backedUp = new Date().toISOString();

    if (!includeSecretKey) {
      const backupAny: any = backup;
      if (backupAny.falconKeys) {
        delete backupAny.falconKeys.secretKey;
      }
      if (backupAny.backupAccount) {
        delete backupAny.backupAccount.mnemonic;
      }
    }

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Additional Function: Restore account from backup
   */
  restoreAccount(backupJson: string, secretKey: string | null = null): FalconAccountInfo {
    const accountInfo = JSON.parse(backupJson) as FalconAccountInfo;

    if (!accountInfo.falconKeys.secretKey && secretKey) {
      accountInfo.falconKeys.secretKey = secretKey;
    }

    (accountInfo as any).restored = new Date().toISOString();

    return accountInfo;
  }
}

/**
 * Utility functions
 */
export const FalconAlgoUtils = {
  /**
   * Validate Falcon account info structure
   * @param accountInfo Account info to validate
   * @returns True if valid
   */
  validateAccountInfo(accountInfo: Record<string, unknown>): boolean {
    const required = ['address', 'falconKeys', 'logicSig', 'type'];
    return required.every((field) => Object.prototype.hasOwnProperty.call(accountInfo, field));
  },

  /**
   * Convert microAlgos to Algos
   */
  microAlgosToAlgos(microAlgos: number | bigint): number {
    const microAlgosNum = typeof microAlgos === 'bigint' ? Number(microAlgos) : microAlgos;
    return microAlgosNum / 1_000_000;
  },

  /**
   * Convert Algos to microAlgos
   */
  algosToMicroAlgos(algos: number): number {
    return Math.round(algos * 1_000_000);
  },

  /**
   * Generate a secure random lease
   */
  generateRandomLease(): Uint8Array {
    return new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
  },
};

// Default export
export default FalconAlgoSDK;
