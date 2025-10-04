# Falcon Deterministic Signatures in JavaScript (WASM)

## A WASM/JS port of the Falcon deterministic post-quantum signature algorithm using Emscripten & WebAssembly. 
Try it live here: [Falcon Signatures](https://falcon-signatures-js.pages.dev/)

<img width="500" height="1024" alt="ChatGPT Image Sep 26, 2025, 08_53_23 PM" src="https://github.com/user-attachments/assets/b6b50e1d-9df2-4f04-b3a4-6d578d9fdd77" />


The Algorand Falcon repository does only provide the C and GO implementations; therefore, a majority of developers were not able to use Falcon keys and signatures in their JavaScript or TypeScript applications. 

This project from [GoPlausible](https://goplausible.com) aims to fill that gap. We initially use that to make all of our agentic toolins and platforms post-quantum resistant.

Includes A JavaScript CLI and library for the Falcon post-quantum cryptography signature algorithm, compiled to WebAssembly for use in both Node.js and browser environments.

The original library in C and GO is great work of:

<lazard@csail.mit.edu>, David Lazar
<chris.peikert@algorand.com>  Chris Peikert from Algorand, Inc.

[Falcon GitHub Repository](https://github.com/algorand/falcon)


This contribution is inspired by  [ amazing work of](https://github.com/algorandfoundation/falcon-signatures) [Giulio Pizzini](https://x.com/giuliopizzini) in Go language by the Algorand Foundation. Many thanks to Giulio for his great work and support!


Many thanks to my good friend [Nullun](https://x.com/nullun)




## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Command Line Interface](#command-line-interface)
  - [Node.js and Browser](#nodejs-and-browser)
- [Building from Source](#building-from-source)
- [Post-Quantum Resistance & Entropy Improvements (v2.0)](#post-quantum-resistance--entropy-improvements-v20)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Implementation Details](#implementation-details)
- [License](#license)
- [Results example](#results-example)

## Introduction

Falcon (Fast-Fourier Lattice-based Compact Signatures over NTRU) is a post-quantum cryptographic signature algorithm submitted to NIST's Post-Quantum Cryptography project. It is designed to be resistant against attacks from quantum computers while maintaining efficiency and compact signatures.

This project provides a JavaScript CLI and library for the deterministic variant of Falcon, compiled from the C implementation to WebAssembly using Emscripten. It supports key generation, signing, and verification operations in both Node.js and browser environments.

The implementation uses the deterministic variant of Falcon, which provides reproducible signatures for the same message and key pair. This is particularly important for applications where signature reproducibility is required.

---

## Features

- **Post-Quantum Resistance**: Implements the deterministic Falcon-1024 signature scheme, resistant to quantum computer attacks  
- **Deterministic Signatures**: Produces reproducible signatures for the same message and key pair  
- **Dual Signature Formats**:
  - **Compressed Format**: Variable length, smaller size (~1,230 bytes)
  - **Constant-Time Format**: Fixed length, better timing attack resistance (1,538 bytes)
- **Format Conversion**: Easily convert between compressed and constant-time formats  
- **Salt Version Support**: Retrieve the salt version from signatures  
- **Cross-Platform**: Works in Node.js and modern browsers via WebAssembly  
- **Simple API**: Easy-to-use functions for all cryptographic operations  
- **Command Line Interface**: Convenient CLI with automatic signature format detection  
- **Now uses libsodium’s ChaCha20-based CSPRNG** for high-entropy seed generation  
- **Secure Memory Handling**: Sensitive data is wiped after use with `sodium_memzero()`  
- **Mnemonic-ready architecture** for future human-readable key recovery  

---

## Installation

### NPM Package

```bash
npm install falcon-signatures
```

---

## Usage

### Command Line Interface

The CLI provides commands for key generation, signing, and verification:

#### Generate a keypair

```bash
node falcon-cli.js keygen
```

This will output the public and private keys in hexadecimal format and save them to `falcon_pk.bin` and `falcon_sk.bin`.

#### Sign a message

```bash
node falcon-cli.js sign "message to sign" <hex_secret_key>
```

This produces a compressed signature format. To sign using a message from a file:

```bash
node falcon-cli.js sign "$(cat message.txt)" <hex_secret_key>
```

#### Verify a signature

```bash
node falcon-cli.js verify "message to verify" <hex_signature> <hex_public_key>
```

The verify command automatically detects whether the signature is in compressed or constant-time format.

#### Convert signature format

```bash
node falcon-cli.js convert <hex_compressed_signature>
```

This converts a compressed signature to constant-time format.

### Node.js and Browser

```javascript
// Using ES modules
import Falcon from 'falcon-signatures';

// Using CommonJS
// const Falcon = require('falcon-signatures');

async function example() {
  // Initialize the Falcon instance
  const falcon = new Falcon();
  
  // Generate a deterministic keypair
  console.log('Generating a Falcon-1024 deterministic keypair...');
  const { publicKey, secretKey } = await falcon.keypair();
  
  console.log(`Public key length: ${publicKey.length} bytes`);
  console.log(`Secret key length: ${secretKey.length} bytes`);
  
  // Convert to hex for storage or display
  const pkHex = Falcon.bytesToHex(publicKey);
  const skHex = Falcon.bytesToHex(secretKey);
  
  // Display shortened versions for better readability
  const shortenHex = (hex) => {
    if (hex.length <= 40) return hex;
    return hex.substring(0, 20) + '...' + hex.substring(hex.length - 20);
  };
  
  console.log(`Public key: ${shortenHex(pkHex)}`);
  console.log(`Secret key: ${shortenHex(skHex)}`);
  
  // Sign a message (produces compressed signature)
  const message = 'Hello, Falcon!';
  console.log(`Signing message: "${message}"`);
  
  const signature = await falcon.sign(message, secretKey);
  console.log(`Compressed signature length: ${signature.length} bytes`);
  console.log(`Compressed signature: ${shortenHex(Falcon.bytesToHex(signature))}`);
  
  // Get the salt version
  const saltVersion = await falcon.getSaltVersion(signature);
  console.log(`Signature salt version: ${saltVersion}`);
  
  // Verify the compressed signature
  const isValid = await falcon.verify(message, signature, publicKey);
  console.log(`Verification result: ${isValid ? 'Valid ✓' : 'Invalid ✗'}`);
  
  // Convert to constant-time signature format
  const ctSignature = await falcon.convertToConstantTime(signature);
  console.log(`Constant-time signature length: ${ctSignature.length} bytes`);
  console.log(`CT signature: ${shortenHex(Falcon.bytesToHex(ctSignature))}`);
  
  // Verify the constant-time signature
  const ctIsValid = await falcon.verifyConstantTime(message, ctSignature, publicKey);
  console.log(`CT verification result: ${ctIsValid ? 'Valid ✓' : 'Invalid ✗'}`);
  
  // Demonstrate deterministic property
  const sig1 = await falcon.sign(message, secretKey);
  const sig2 = await falcon.sign(message, secretKey);
  const areIdentical = Falcon.bytesToHex(sig1) === Falcon.bytesToHex(sig2);
  console.log(`Signatures for same message are identical: ${areIdentical ? 'Yes ✓' : 'No ✗'}`);
}

example().catch(console.error);
```

## Building from Source

If you're building the library from source:

1. **Ensure Emscripten is installed**
   ```bash
   source /path/to/emsdk/emsdk_env.sh
   ```

2. **Clone and initialize the repository**
   ```bash
   git clone https://github.com/GoPlausible/falcon-signatures-js.git
   cd falcon-signatures-js
   git submodule update --init --recursive
   ```

3. **Build libsodium (secure RNG)**
   ```bash
   chmod +x build_libsodium_wasm.sh
   ./build_libsodium_wasm.sh
   ```

   This compiles a WASM-safe static `libsodium.a` under:
   ```
   external/libsodium/dist/
   ```

4. Build the WebAssembly module:
```bash
emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker,node \
  -Iexternal/libsodium/dist/include \
  -Lexternal/libsodium/dist/lib -lsodium \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_falcon_det1024_keygen_wrapper","_falcon_det1024_sign_compressed_wrapper","_falcon_det1024_convert_compressed_to_ct_wrapper","_falcon_det1024_verify_compressed_wrapper","_falcon_det1024_verify_ct_wrapper","_falcon_det1024_get_salt_version_wrapper","_get_sk_size","_get_pk_size","_get_sig_compressed_max_size","_get_sig_ct_size"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","HEAPU8"]' \
  falcon/common.c falcon/codec.c falcon/deterministic.c falcon/falcon.c falcon/fft.c falcon/fpr.c falcon/keygen.c falcon/rng.c falcon/shake.c falcon/sign.c falcon/vrfy.c falcon_wrapper.c \
  -o falcon.js
```

This will generate two files:
- `falcon.js`: The JavaScript wrapper for the WebAssembly module
- `falcon.wasm`: The WebAssembly binary

## Testing

To run the tests:

```bash
node falcon-cli-test.js
node falcon-test.js
```

These will:
1. Generate a keypair (and check for randomness to work properly using a second keypair generation)
2. Sign a test message with compressed format
3. Convert the signature to constant-time format
4. Verify both compressed and constant-time signatures
5. Test the deterministic property of signatures

## API Reference

### WebAssembly Module Functions

- `_get_sk_size()`: Returns the size of a secret key in bytes
- `_get_pk_size()`: Returns the size of a public key in bytes
- `_get_sig_compressed_max_size()`: Returns the maximum size of a compressed signature in bytes
- `_get_sig_ct_size()`: Returns the size of a constant-time signature in bytes
- `_falcon_det1024_keygen_wrapper()`: Generates a deterministic keypair
- `_falcon_det1024_sign_compressed_wrapper()`: Signs a message with compressed format
- `_falcon_det1024_convert_compressed_to_ct_wrapper()`: Converts to constant-time format
- `_falcon_det1024_verify_compressed_wrapper()`: Verifies a compressed signature
- `_falcon_det1024_verify_ct_wrapper()`: Verifies a constant-time signature
- `_falcon_det1024_get_salt_version_wrapper()`: Gets the salt version from a signature

### CLI Commands

- `keygen`: Generates a new deterministic keypair
- `sign <message> <hex_sk>`: Signs a message using a secret key (compressed format)
- `verify <message> <hex_sig> <hex_pk>`: Verifies a signature (auto-detects format)
- `convert <hex_compressed_sig>`: Converts a compressed signature to constant-time format

### NPM Library methods

- `keypair()`: Generates a new deterministic keypair
- `sign(message, secretKey)`: Signs a message with compressed format
- `verify(message, signature, publicKey)`: Verifies a compressed signature
- `convertToConstantTime(compressedSignature)`: Converts to constant-time format
- `verifyConstantTime(message, signature, publicKey)`: Verifies a constant-time signature
- `getSaltVersion(signature)`: Gets the salt version from a signature

## Implementation Details

This implementation is based on the deterministic variant of the Falcon reference implementation in C, compiled to WebAssembly using Emscripten. It uses the Falcon-1024 parameter set, which provides the highest security level.

The Falcon C implementation is included as a Git submodule from the [Algorand Falcon repository](https://github.com/algorand/falcon). The C wrapper functions in `falcon_wrapper.c` provide a simplified interface to the Falcon implementation, handling memory allocation and parameter passing. The JavaScript CLI and API then interact with these wrapper functions through the WebAssembly module.

Key technical details:
- Uses deterministic Falcon-1024 (logn=10)
- Secret key size: 2,305 bytes
- Public key size: 1,793 bytes
- Compressed signature size: ~1,230 bytes (variable length)
- Constant-time signature size: 1,538 bytes (fixed length)

Memory management is handled carefully to avoid memory leaks and stack overflows in the WebAssembly environment:
- Large temporary buffers are allocated on the heap instead of the stack to avoid stack overflow errors
- All allocated memory is properly freed after use
- Error handling is implemented for all memory allocations

### Project Structure

The project is structured as follows:
- `falcon/`: Git submodule containing the Falcon C implementation
- `falcon_wrapper.c`: C wrapper functions for the WebAssembly interface
- `index.js`: JavaScript API for the Falcon functionality
- `falcon-cli.js`: Command-line interface
- `falcon-test.js`: Test file for the JavaScript API
- `falcon-cli-test.js`: Test file for the CLI
- `falcon.html`: Browser demo
- `falcon.js`: JavaScript wrapper for the WebAssembly module (generated)
- `falcon.wasm`: WebAssembly binary (generated)

## Implementation Details

This implementation now depends on both the **Falcon C reference** and **libsodium**:
- Falcon logic remains deterministic and PQC-correct.
- libsodium provides secure entropy and constant-time memory ops.
- Deterministic SHAKE256 internal PRNG ensures repeatable key derivation.
- libsodium’s ChaCha20-based CSPRNG seeds the Falcon PRNG with high-entropy randomness.

### Libsodium’s ChaCha20-based RNG

🔬 How it works

- Built around a ChaCha20 stream cipher in counter mode.

- Initially seeded from the system CSPRNG (/dev/urandom, getrandom(), or platform equivalents).

- Then it runs in user space with periodic reseeding and internal re-keying.

- Each process and thread gets an independent DRBG instance.

- In Emscripten builds, it automatically maps to WebCrypto’s crypto.getRandomValues().

✅ Strengths

- ChaCha20 is one of the most extensively reviewed modern ciphers (RFC 8439, used in TLS 1.3, WireGuard, OpenSSH).

- Deterministic and portable — runs identically across Linux, macOS, Windows, WASM, Node.js.

- High performance: zero syscalls after seeding; constant-time, branch-free.

- Entropy refresh: automatic reseed after ~1 MB of output or ~10 minutes.

- Built-in safety mechanisms: crash-safe state, constant-time zeroization, entropy whitening.

## License

This project is licensed under the [MIT License](LICENSE).

## Results example
```bash
=== Falcon CLI Test ===

=== Step 1: Generating a new Falcon keypair ===

> node ./falcon-cli.js keygen
🔑 Generating Falcon-1024 deterministic keypair...
PublicKey: 0a5daabb30542b41...24dbfc2058d9ea7a8341
SecretKey: 5a107dc07ba3177...fceffef2edfbfb260e11
Keygen completed successfully
Public key length: 1793 bytes
Secret key length: 2305 bytes
Keys saved to falcon_pk.bin and falcon_sk.bin

=== Step 2: Signing a message (compressed format) ===

> node ./falcon-cli.js sign "Hello, Deterministic Falcon!" 5a107dc07ba3177...260e11
Signature (compressed format): ba008f28282bf9bd45...5b4aee1566f394c73c80
Signature salt version: 0
Signing completed successfully
Compressed signature length: 1230 bytes
Signature saved to falcon_sig_compressed.bin

=== Step 3: Converting signature to constant-time format ===

> node ./falcon-cli.js convert ba008f28282bf9bd45...394c73c80
CT Signature: da00054ff40900b5fb...e990cceb1
Conversion completed successfully
CT Signature length: 1538 bytes
CT Signature saved to falcon_sig_ct.bin

=== Step 4: Verifying the compressed signature ===

> node ./falcon-cli.js verify "Hello, Deterministic Falcon!" ba008f28282bf9bd45...394c73c80 0a5daabb30542b41...ea7a8341
Detected compressed signature format
[falcon_wrapper] Signature verified successfully
✅ Verification success

=== Step 5: Verifying the constant-time signature ===

> node ./falcon-cli.js verify "Hello, Deterministic Falcon!" da00054ff40900b5fb...e990cceb1 0a5daabb30542b41...ea7a8341
Detected constant-time signature format
[falcon_wrapper] Signature verified successfully
✅ Verification success

=== All tests passed successfully! ===
```
