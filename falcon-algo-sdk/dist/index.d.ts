/**
 * Falcon-Algorand SDK
 * Post-quantum secure Algorand accounts using Falcon signatures
 */
import algosdk, { Algodv2, LogicSigAccount, Transaction } from 'algosdk';
import Falcon from 'falcon-signatures';
/**
 * Network configurations
 */
export type NetworkConfig = {
    server: string;
    port: string | number;
    token: string;
    name: string;
};
export declare const Networks: Record<'MAINNET' | 'TESTNET' | 'BETANET', NetworkConfig>;
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
/**
 * Main SDK class for Falcon-powered Algorand accounts
 */
export declare class FalconAlgoSDK {
    network: NetworkConfig;
    algod: Algodv2;
    falcon: Falcon;
    initialized: boolean;
    private _initPromise;
    constructor(network?: NetworkConfig, customAlgod?: Algodv2 | null);
    /**
     * Initialize the Falcon module
     * @private
     */
    private _initialize;
    /**
     * Ensure SDK is initialized before operations
     * @private
     */
    private _ensureInitialized;
    /**
     * Generate TEAL program for transaction ID verification
     * @param falconPublicKey Falcon public key
     * @param counter byte value (0-255) used to shift off-curve addresses
     * @returns TEAL source
     * @private
     */
    private _generateTealProgram;
    /**
     * Core Function 1: Create a new Falcon-protected Algorand account
     * @param options Options for account creation
     * @param options.generateEdKeys Whether to generate ed25519 keys for backup (default: true)
     * @returns Account information
     */
    createFalconAccount(options?: {
        generateEdKeys?: boolean;
    }): Promise<FalconAccountInfo>;
    /**
     * Core Function 2: Convert existing Algorand account to Falcon-protected
     * @param account Mnemonic string or account object with secretKey
     * @param falconKeys Existing Falcon keys or null to generate new ones
     * @returns Conversion result with rekey transaction info
     */
    convertToFalconAccount(account: string | algosdk.Account, falconKeys?: FalconKeysHex | null): Promise<ConversionInfo>;
    /**
     * Submit a rekey transaction to complete account conversion
     * @param conversionInfo Result from convertToFalconAccount
     * @param waitForConfirmation Whether to wait for confirmation (default: true)
     * @returns Transaction result
     */
    submitConversion(conversionInfo: ConversionInfo, waitForConfirmation?: boolean): Promise<{
        txId: string;
        confirmedRound?: number;
        status: 'confirmed' | 'submitted';
    }>;
    /**
     * Create a LogicSig account from Falcon account info and txId
     */
    createLogicSig(accountInfo: FalconAccountInfo | ConversionInfo, txid: string): Promise<LogicSigAccount>;
    /**
     * Sign a transaction with Falcon-protected account
     */
    signTransaction(transaction: Transaction, accountInfo: FalconAccountInfo | ConversionInfo, txid: string): Promise<SignedLogicSigTx>;
    /**
     * Create and sign a payment transaction
     */
    createPayment(params: {
        sender: string;
        receiver: string;
        amount: number;
        note?: string;
    }, accountInfo: FalconAccountInfo | ConversionInfo): Promise<SignedLogicSigTx>;
    /**
     * Get account information from Algorand network
     */
    getAccountInfo(address: string): Promise<any>;
    /**
     * Check if an address has sufficient balance for a transaction
     */
    hasSufficientBalance(address: string, amount: number): Promise<boolean>;
    /**
     * Additional Function: Rotate Falcon keys for an existing Falcon-protected account
     */
    rotateFalconKeys(currentAccountInfo: FalconAccountInfo, _oldFalconKeys: FalconKeysHex): Promise<FalconAccountInfo & {
        previousAddress: string;
        rotated: string;
    }>;
    /**
     * Additional Function: Create a multi-signature transaction group
     */
    signTransactionGroup(transactions: Transaction[], accountInfos: (FalconAccountInfo | ConversionInfo)[]): Promise<Uint8Array[]>;
    /**
     * Additional Function: Submit transaction group and wait for confirmation
     */
    submitTransactionGroup(signedTransactions: Uint8Array[], maxRounds?: number): Promise<{
        txId: string;
        confirmedRound: number;
        groupSize: number;
    }>;
    /**
     * Additional Function: Estimate transaction fees for Falcon transactions
     */
    estimateFees(transactionCount?: number): Promise<{
        baseFePerTransaction: number;
        falconOverheadPerTransaction: number;
        estimatedFeePerTransaction: number;
        totalEstimatedFee: number;
        transactionCount: number;
    }>;
    /**
     * Additional Function: Backup account information to JSON
     */
    backupAccount(accountInfo: FalconAccountInfo, includeSecretKey?: boolean): string;
    /**
     * Additional Function: Restore account from backup
     */
    restoreAccount(backupJson: string, secretKey?: string | null): FalconAccountInfo;
}
/**
 * Utility functions
 */
export declare const FalconAlgoUtils: {
    /**
     * Validate Falcon account info structure
     * @param accountInfo Account info to validate
     * @returns True if valid
     */
    validateAccountInfo(accountInfo: Record<string, unknown>): boolean;
    /**
     * Convert microAlgos to Algos
     */
    microAlgosToAlgos(microAlgos: number | bigint): number;
    /**
     * Convert Algos to microAlgos
     */
    algosToMicroAlgos(algos: number): number;
    /**
     * Generate a secure random lease
     */
    generateRandomLease(): Uint8Array;
};
export default FalconAlgoSDK;
