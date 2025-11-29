# Falcon-Algorand SDK

**Create and manage post-quantum secure Algorand accounts using Falcon signatures**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Algorand](https://img.shields.io/badge/Algorand-Compatible-blue)](https://algorand.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)](https://github.com/GoPlausible/falcon-signatures-js)

A JavaScript SDK for integrating Falcon post-quantum signatures with Algorand blockchain accounts. Create quantum-resistant accounts, convert existing accounts, and sign transactions using the Falcon signature scheme through Algorand's LogicSig system.

## 🚀 Features

- **🔐 Account Creation**: Generate new Falcon-protected Algorand accounts
- **🔄 Account Conversion**: Convert existing accounts to Falcon-protected via rekeying
- **📝 Transaction Signing**: Sign transactions with Falcon post-quantum signatures
- **📦 Transaction Groups**: Support for atomic transaction groups
- **🌐 Multi-Network**: MainNet, TestNet, and BetaNet support
- **💾 Account Management**: Backup, restore, and key rotation
- **🛠️ Developer Tools**: Comprehensive utilities and fee estimation

## Prerequisites

- Node.js 18 or higher
- Basic understanding of Algorand blockchain
- Access to Algorand network (TestNet for development)

## 📦 Installation

```bash
npm install falcon-algo-sdk
```

### Dependencies

The SDK requires:
- `algosdk` ^3.5.2 - Algorand JavaScript SDK
- `falcon-signatures` 1.4.0 - Falcon post-quantum signature library
  - 📦 [NPM Package](https://www.npmjs.com/package/falcon-signatures)
  - 📁 [GitHub Repository](https://github.com/GoPlausible/falcon-signatures-js)
  - 🌐 [Live Demo](https://falcon-signatures-js.pages.dev/falcon)

## 🏁 Quick Start

```javascript
import FalconAlgoSDK, { Networks } from 'falcon-algo-sdk';

async function quickStart() {
  // Initialize SDK
  const sdk = new FalconAlgoSDK(Networks.TESTNET);
  
  // Create new Falcon-protected account
  const account = await sdk.createFalconAccount();
  console.log(`New account: ${account.address}`);
  
  // Create and sign a payment
  const payment = await sdk.createPayment({
    sender: account.address,
    receiver: 'RECEIVER_ADDRESS_HERE',
    amount: 1000000, // 1 Algo in microAlgos
    note: 'Post-quantum payment'
  }, account);
  
  console.log('Transaction signed with Falcon signature!');
}

quickStart();
```

## 📖 API Reference

### Class: FalconAlgoSDK

#### Constructor

```javascript
new FalconAlgoSDK(network?, customAlgod?)
```

- `network` - Network configuration (default: `Networks.TESTNET`)
- `customAlgod` - Custom Algod client (optional)

#### Core Methods

##### `createFalconAccount(options?)`

Creates a new Falcon-protected Algorand account.

```javascript
const account = await sdk.createFalconAccount({
  generateEdKeys: true // Generate backup ed25519 keys
});
```

**Returns:** Account information object with Falcon keys and LogicSig details.

##### `convertToFalconAccount(account, falconKeys?)`

Converts an existing Algorand account to Falcon-protected.

```javascript
const conversionInfo = await sdk.convertToFalconAccount(
  'mnemonic phrase here', // or account object
  falconKeys // optional existing Falcon keys
);

// Submit the conversion
const result = await sdk.submitConversion(conversionInfo);
```

**Returns:** Conversion information with rekey transaction ready for submission.

##### `createPayment(params, accountInfo)`

Creates and signs a payment transaction.

```javascript
const signedTxn = await sdk.createPayment({
  sender: 'SENDER_ADDRESS',
  receiver: 'RECEIVER_ADDRESS',
  amount: 1000000,
  note: 'Payment note'
}, accountInfo);
```

##### `signTransaction(transaction, accountInfo)`

Signs any Algorand transaction with Falcon signature.

```javascript
const signedTxn = await sdk.signTransaction(txnObject, accountInfo);
```

#### Account Management

##### `getAccountInfo(address)`
##### `hasSufficientBalance(address, amount)`
##### `createLogicSig(accountInfo)`

#### Advanced Features

##### `rotateFalconKeys(currentAccountInfo, oldFalconKeys)`

Rotates Falcon keys for enhanced security.

##### `signTransactionGroup(transactions, accountInfos)`

Signs multiple transactions as an atomic group.

##### `submitTransactionGroup(signedTransactions, maxRounds?)`

Submits and confirms transaction groups.

##### `estimateFees(transactionCount?)`

Estimates fees including Falcon signature overhead.

##### `backupAccount(accountInfo, includeSecretKey?)`
##### `restoreAccount(backupJson, secretKey?)`

Backup and restore account information.

### Utility Functions

```javascript
import { FalconAlgoUtils } from 'falcon-algo-sdk';

// Convert between Algos and microAlgos
const microAlgos = FalconAlgoUtils.algosToMicroAlgos(1.5);
const algos = FalconAlgoUtils.microAlgosToAlgos(1500000);

// Validate account structure
const isValid = FalconAlgoUtils.validateAccountInfo(accountInfo);

// Generate random lease
const lease = FalconAlgoUtils.generateRandomLease();
```

### Network Configurations

```javascript
import { Networks } from 'falcon-algo-sdk';

// Available networks
Networks.MAINNET  // Algorand MainNet
Networks.TESTNET  // Algorand TestNet  
Networks.BETANET  // Algorand BetaNet
```

## 💡 Usage Examples

### Creating a New Falcon Account

```javascript
import FalconAlgoSDK, { Networks } from 'falcon-algo-sdk';

const sdk = new FalconAlgoSDK(Networks.TESTNET);

// Create account
const account = await sdk.createFalconAccount();

// Account structure:
// {
//   address: 'ALGORAND_ADDRESS',
//   falconKeys: {
//     publicKey: 'hex_public_key',
//     secretKey: 'hex_secret_key'
//   },
//   backupAccount: {
//     address: 'backup_address',
//     mnemonic: '25 word mnemonic'
//   },
//   logicSig: {
//     program: 'base64_teal_program',
//     signature: 'hex_falcon_signature'
//   },
//   type: 'falcon-protected'
// }
```

### Converting Existing Account

```javascript
// Convert existing account
const mnemonic = 'your 25 word mnemonic here...';
const conversionInfo = await sdk.convertToFalconAccount(mnemonic);

// Submit rekey transaction
const result = await sdk.submitConversion(conversionInfo);
console.log(`Account converted! TxID: ${result.txId}`);
```

### Making Payments

```javascript
// Create payment transaction
const payment = await sdk.createPayment({
  sender: account.address,
  receiver: 'RECEIVER_ADDRESS',
  amount: 1000000, // 1 Algo
  note: 'Falcon-secured payment'
}, account);

// Submit to network
const result = await sdk.algod.sendRawTransaction(payment.blob).do();
```

### Transaction Groups

```javascript
// Create multiple transactions
const txn1 = /* payment transaction */;
const txn2 = /* asset transfer */;

// Sign as group
const signedGroup = await sdk.signTransactionGroup(
  [txn1, txn2], 
  [account1, account2]
);

// Submit group
const result = await sdk.submitTransactionGroup(signedGroup);
```

## 🧪 Testing

### Basic Tests

Run the unit test suite (no network required):

```bash
npm test
```

This runs 10 comprehensive tests covering:
- SDK initialization and configuration
- Account creation and conversion
- Transaction signing and LogicSig creation
- Backup/restore functionality
- Utility functions

### Integration Test

**Important**: The integration test requires TestNet funding.

```bash
npm run test:integration
```

The integration test demonstrates the complete workflow:

1. **Account Creation**: Creates a new Algorand account with mnemonic
2. **Funding Prompt**: Provides TestNet faucet instructions 
3. **Account Conversion**: Converts to Falcon-protected via rekeying
4. **Transaction Group**: Creates payment with dummy transactions for pool optimization
5. **Submission**: Submits and confirms the post-quantum secured transaction

#### Integration Test Requirements

- Internet connection for TestNet access
- Manual funding step at https://bank.testnet.algorand.network/
- Approximately 2-3 minutes to complete

#### Generated Files

The integration test creates these files in the project directory:
- `standard-account.json` - Original account details
- `falcon-protected-account.json` - Conversion information

#### Sample logs of the integration test

```bash
🦅 Starting Falcon-Algorand Integration Test...

🚀 Falcon-Algorand SDK Integration Test
=====================================
This test demonstrates the complete flow from standard to post-quantum secured Algorand accounts.

[18:49:40] 🔄 Initializing Falcon-Algorand SDK on TestNet...
[18:49:40] ✅ SDK initialized successfully
[18:49:40] 📝 Connected to: https://testnet-api.algonode.cloud
[18:49:40] 🔄 Creating new standard Algorand account...
[18:49:40] ✅ Standard Algorand account created successfully!
[18:49:40] 🔷 Address: MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY
[18:49:40] 📝 Mnemonic: infant cave bag fence firm south brass stem music wrestle side tribe cube grit local inside island giant unfold detect blue bench mom able dust
[18:49:40] 📝 Account saved to: /Users/mg/Documents/GitHub/GoPlausible/falcon-signatures-js/falcon-algo-sdk/standard-account.json
[18:49:41] 📝 Account MN5UCKFURR... balance: 0 Algo (0 microAlgos)

🏦 ACCOUNT FUNDING REQUIRED
===========================
Please fund the account with at least 0.2 Algo for testing:
1. Visit: https://bank.testnet.algorand.network/
2. Enter address: MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY
3. Click "Dispense" to receive 10 TestNet Algos
4. Wait for the transaction to complete

Press Enter after funding the account...
[18:50:05] 🔄 Checking account balance after funding...
[18:50:05] 📝 Account MN5UCKFURR... balance: 10 Algo (10000000 microAlgos)
[18:50:05] ✅ Required: 0.2 Algo - Sufficient funds
[18:50:05] ✅ Account successfully funded!
[18:50:05] 🔄 Converting account to Falcon-protected...
[18:50:05] 🦅 Generating Falcon keypair...
Converting existing Algorand account to Falcon-protected...
Converting account: MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY
[falcon_wrapper] falcon_det1024_sign_compressed_wrapper called
[falcon_wrapper] Signature generated successfully (1233 bytes)
[falcon_wrapper] falcon_det1024_verify_compressed_wrapper called with:
  - sig: 0x18ae0
  - sig_len: 1233
  - pk: 0x18fb8
  - msg: 0x18ab8
  - msg_len: 32
[falcon_wrapper] Signature verified successfully
✅ Conversion prepared. Original: MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY, New: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
Submit the rekey transaction to complete conversion: Q6FIAN3UJ2T4CMOU7LRASDMRTIVN54LP2UOOOX7H5DRUU3OVUVGA
[18:50:06] ✅ Falcon keypair generated successfully!
[18:50:06] 🦅 Falcon Public Key: 0a0dccc851d0c56e968999c342ce0c4ad28870a2...
[18:50:06] 🔷 Original Address: MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY
[18:50:06] 🔐 New PQ Address: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
[18:50:06] 📝 LogicSig Program: DCYBAQCAIGN7QSi0jGg4OuteImsLdCjeikbh5PpW... (2452 chars)
[18:50:06] 📝 Falcon account info saved to: falcon-protected-account.json
[18:50:06] 🔄 Submitting rekey transaction to convert account to post-quantum security...
Submitting rekey transaction...
Rekey transaction submitted: Q6FIAN3UJ2T4CMOU7LRASDMRTIVN54LP2UOOOX7H5DRUU3OVUVGA
Waiting for confirmation...
✅ Rekey confirmed in round: undefined
[18:50:09] ✅ Rekey transaction submitted successfully!
[18:50:09] 🔷 Transaction ID: Q6FIAN3UJ2T4CMOU7LRASDMRTIVN54LP2UOOOX7H5DRUU3OVUVGA
[18:50:09] 📝 Confirmed in round: undefined
[18:50:09] 🔐 Account is now protected by Falcon post-quantum signatures!
[18:50:09] 🔄 Verifying account rekey status...
[18:50:09] 📝 Rekeyed Account: 
[18:50:09] 📝 Auth Address: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
[18:50:09] 📝 New Address: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
[18:50:09] ✅ ✅ Account successfully rekeyed to Falcon LogicSig!
[18:50:09] 🔐 Auth Address: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
[18:50:09] 🔄 Creating LogicSig for transaction signing...
[18:50:09] ✅ LogicSig created with address: WNA254RYLK5L2N4EHZA23HICZQXSA5MTLIBHGNYOWMWWI64LGFRD5I5O7I
[18:50:09] 📝 LogicSig arguments: 1 (Falcon signature included)
[18:50:09] 🦅 Falcon signature size: 1233 bytes
[18:50:09] 🔄 Creating post-quantum secured payment transaction group...
[18:50:09] 🔷 Sending 0.1 Algo to: UTI7PAASILRDA3ISHY5M7J7LNRX2AIVQJWI7ZKCCGKVLMFD3VPR5PWSZ4I
[18:50:10] 📝 Network fee: 0 microAlgos per transaction
[18:50:10] 📝 Transaction validity: rounds 58003481 to 58004481
[18:50:10] 🔄 Creating dummy LogicSig for transaction group optimization...
[18:50:10] 📝 Dummy LogicSig Address: MK4BJ4NAVYMCPBFDW2MVUF66MG6ADZBSESKGTC6HMEZGT7VQSFYDOJ27ZI
[18:50:10] ✅ Transaction group created with additional pool bytes
[18:50:10] 📝 Group contains 4 transactions
[18:50:10] 🔷 Main payment: 0.1 Algo from MN5UCKFURRUDQOXLLYRGWC3UFDPIURXB4T5FMEVOEEX2W6VMFW4GVXQIHY to UTI7PAASILRDA3ISHY5M7J7LNRX2AIVQJWI7ZKCCGKVLMFD3VPR5PWSZ4I
[18:50:10] 📝 Dummy transactions: 3x zero-amount transactions for pool byte optimization
[18:50:10] 📝 Total group fee: 4000 microAlgos (covered by main transaction)
[18:50:10] 🦅 Signing transaction group with Falcon post-quantum signature...
[18:50:10] ✅ Transaction group signed successfully with Falcon signature!
[18:50:10] 🦅 Main transaction signed with Falcon signature (1233 bytes)
[18:50:10] 📝 Dummy transactions signed with optimization LogicSig
[18:50:10] 📝 Total group size: 4221 bytes
[18:50:10] 🔄 Submitting post-quantum secured transaction group to TestNet...
[18:50:10] ✅ Transaction group submitted successfully!
[18:50:10] 🔷 Group Transaction ID: XRJSTJJYEDZ3J56RBEBY35JP2VR5F7BAZ23PYJH4MKZ7DFZKC76A
[18:50:10] 🔄 Waiting for transaction confirmation: XRJSTJJYEDZ3J56RBEBY35JP2VR5F7BAZ23PYJH4MKZ7DFZKC76A
[18:50:14] 📝 Waiting... (round 1/10)
[18:50:16] ✅ 🎉 POST-QUANTUM PAYMENT CONFIRMED!
[18:50:16] ✅ Confirmed in round: undefined
[18:50:16] 📝 Transaction fee: 4000 microAlgos
[18:50:16] 🔄 Verifying final balances...
[18:50:16] 📝 Account MN5UCKFURR... balance: 9.895 Algo (9895000 microAlgos)
[18:50:16] 📝 Account UTI7PAASIL... balance: 63.050318 Algo (63050318 microAlgos)

🎯 TRANSACTION SUMMARY
=====================
✅ Successfully sent 0.1 Algo using Falcon post-quantum signatures!
📄 Transaction ID: XRJSTJJYEDZ3J56RBEBY35JP2VR5F7BAZ23PYJH4MKZ7DFZKC76A
🔍 View on AlloExplorer: https://testnet.algoexplorer.io/tx/XRJSTJJYEDZ3J56RBEBY35JP2VR5F7BAZ23PYJH4MKZ7DFZKC76A
🌐 View on Allo: https://lora.algokit.io/testnet/transaction/XRJSTJJYEDZ3J56RBEBY35JP2VR5F7BAZ23PYJH4MKZ7DFZKC76A
🔐 Signature Algorithm: Falcon-1024 (Post-Quantum Secure)
📊 Signature Size: 1233 bytes
💰 Transaction Fee: 4000 microAlgos
🏦 Sender Final Balance: 9.895 Algo
🎯 Receiver Balance: 63.050318 Algo

🔬 EDUCATIONAL INSIGHTS
=======================
🛡️  Post-Quantum Security: This transaction is secure against quantum computer attacks
🔑 Falcon Signatures: Used deterministic lattice-based cryptography
📋 LogicSig Integration: Leveraged Algorand's smart contract system for verification
🔄 Account Rekeying: Original account now requires Falcon signatures for all transactions
🌐 Blockchain Compatibility: Full integration with Algorand's consensus mechanism
⚡ Performance: Near-native performance thanks to WebAssembly implementation

📁 FILES CREATED
================
📄 standard-account.json - Original Algorand account details
📄 falcon-protected-account.json - Complete Falcon account information
💡 These files contain all necessary information for account recovery and future use
[18:50:16] ✅ 🎉 Integration test completed successfully!
[18:50:16] 🔐 Your Algorand account is now protected by post-quantum cryptography!
```

### Example Usage

Run the basic example:

```bash
npm run example
```

### CLI

Install globally (or use `npx`):

```bash
npm install -g falcon-algo-sdk
```

Usage:

```bash
# Create a new Falcon-protected account (saves JSON to cwd)
falcon-algo create --network testnet

# Convert an existing mnemonic-based account (prompts if omitted)
falcon-algo convert --network testnet --mnemonic "word list ..."
```

Networks: `mainnet`, `testnet` (default), `betanet`.

The CLI saves generated or converted account details as JSON in the current directory (BigInt-safe), including addresses, Falcon keys, and rekey transaction info.

## 🏗️ How It Works

The Falcon-Algorand SDK uses Algorand's LogicSig (Logic Signature) functionality to embed Falcon post-quantum signatures into the blockchain:

1. **TEAL Program Generation**: Creates a TEAL smart contract that verifies Falcon signatures
2. **Account Creation**: Generates LogicSig accounts with embedded Falcon public keys  
3. **Transaction Signing**: Signs transactions with Falcon signatures passed as LogicSig arguments
4. **On-Chain Verification**: Algorand nodes verify Falcon signatures using the embedded TEAL program

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│  Falcon-Algo-SDK │───▶│   Algorand      │
│                 │    │                  │    │   Network       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Falcon Signatures│
                       │    (WASM)        │
                       └──────────────────┘
```

### Security Model

- **Post-Quantum Resistance**: Falcon signatures remain secure against quantum attacks
- **Deterministic Signing**: Same message produces same signature for auditability
- **LogicSig Integration**: Leverages Algorand's native smart contract verification
- **Key Management**: Secure key generation using libsodium's ChaCha20 CSPRNG

## 🔒 Security Considerations

### Best Practices

- 🔐 **Secure Key Storage**: Store Falcon secret keys securely and never share them
- 🧪 **Test First**: Always test on TestNet before using MainNet
- 💾 **Backup Keys**: Create secure backups of your Falcon keys
- 🔄 **Key Rotation**: Regularly rotate Falcon keys for enhanced security
- 📊 **Monitor Transactions**: Verify all transactions before submission

### Limitations

- **Signature Size**: Falcon signatures are larger (~1,230 bytes) than ed25519 signatures
- **Transaction Fees**: LogicSig transactions have slightly higher fees
- **Network Support**: Requires Algorand network to support `falcon_verify` opcode
- **Key Recovery**: No mnemonic recovery for Falcon keys (backup required)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/GoPlausible/falcon-signatures-js/issues)
- 📚 **Documentation**: This README and inline code documentation
- 💬 **Community**: Join the discussion in repository issues

---

**⚠️ Important**: This is experimental software. While Falcon signatures are cryptographically secure, this implementation should be thoroughly tested before production use. Post-quantum cryptography is an evolving field - stay updated with the latest developments.
