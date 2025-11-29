#!/usr/bin/env node

/**
 * Falcon-Algorand SDK CLI
 * Create Falcon-protected accounts or convert mnemonic-based accounts.
 *
 * Usage:
 *  node cli.js create [--network mainnet|testnet|betanet]
 *  node cli.js convert [--network mainnet|testnet|betanet] [--mnemonic \"word list\"]
 *    - If --mnemonic is omitted, it will be read from stdin.
 *
 * Output: JSON files saved in the current working directory.
 */

import fs from 'fs/promises';
import readline from 'readline';
import path from 'path';
import FalconAlgoSDK, { Networks } from './index.js';

const HELP = `
Falcon-Algorand SDK CLI

Commands:
  create                      Create a new Falcon-protected account.
  convert                     Convert a mnemonic-based account to Falcon-protected.

Options:
  --network <name>            mainnet | testnet | betanet (default: testnet)
  --mnemonic "<words>"        Mnemonic to convert (convert command only). If omitted, read from stdin.
  -h, --help                  Show this help message.
`;

function parseArgs() {
  const [, , ...args] = process.argv;
  const opts = { network: 'testnet', mnemonic: null, command: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!opts.command && (arg === 'create' || arg === 'convert')) {
      opts.command = arg;
      continue;
    }
    if (arg === '--network' && args[i + 1]) {
      opts.network = args[i + 1].toLowerCase();
      i++;
      continue;
    }
    if (arg === '--mnemonic' && args[i + 1]) {
      opts.mnemonic = args[i + 1];
      i++;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      console.log(HELP);
      process.exit(0);
    }
  }

  return opts;
}

function getNetworkConfig(name) {
  switch (name) {
    case 'mainnet': return Networks.MAINNET;
    case 'betanet': return Networks.BETANET;
    case 'testnet':
    default: return Networks.TESTNET;
  }
}

function timestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function stringifyWithBigInt(obj) {
  return JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2);
}

async function saveJson(filename, data) {
  const filePath = path.join(process.cwd(), filename);
  await fs.writeFile(filePath, stringifyWithBigInt(data));
  return filePath;
}

async function readMnemonicFromStdin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((resolve) => rl.question(q, resolve));
  const answer = await question('Enter mnemonic: ');
  rl.close();
  return answer.trim();
}

async function createAccount(network) {
  const sdk = new FalconAlgoSDK(network);
  const account = await sdk.createFalconAccount();
  const filePath = await saveJson(`falcon-account-${timestamp()}.json`, account);
  console.log('✅ Falcon-protected account created');
  console.log(`Address: ${account.address}`);
  console.log(`Saved to: ${filePath}`);
}

async function convertAccount(network, mnemonicInput) {
  const mnemonic = mnemonicInput || await readMnemonicFromStdin();
  if (!mnemonic) {
    throw new Error('Mnemonic is required for conversion.');
  }

  const sdk = new FalconAlgoSDK(network);
  const conversionInfo = await sdk.convertToFalconAccount(mnemonic);
  const filePath = await saveJson(`falcon-conversion-${timestamp()}.json`, conversionInfo);

  console.log('✅ Conversion prepared');
  console.log(`Original address: ${conversionInfo.originalAddress}`);
  console.log(`New Falcon address: ${conversionInfo.newAddress}`);
  console.log(`Rekey TxID: ${conversionInfo.rekeyTransaction.txId}`);
  console.log(`Saved to: ${filePath}`);
  console.log('Submit the rekey transaction to complete conversion:');
  console.log(conversionInfo.rekeyTransaction.txId);
}

async function main() {
  try {
    const opts = parseArgs();
    if (!opts.command) {
      console.log(HELP);
      process.exit(1);
    }

    const network = getNetworkConfig(opts.network);
    if (!network) {
      throw new Error(`Unknown network: ${opts.network}`);
    }

    if (opts.command === 'create') {
      await createAccount(network);
    } else if (opts.command === 'convert') {
      await convertAccount(network, opts.mnemonic);
    } else {
      console.log(HELP);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ CLI error:', error.message);
    process.exit(1);
  }
}

main();
