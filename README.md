# Falcon Keys and Signatures in JavaScript (WASM)

## A WASM/JS port of the Falcon post-quantum signature algorithm using Emscripten & WebAssembly. 

<img width="500" height="1024" alt="ChatGPT Image Sep 26, 2025, 08_53_23 PM" src="https://github.com/user-attachments/assets/b6b50e1d-9df2-4f04-b3a4-6d578d9fdd77" />


The Algorand Falcon repository does only provide the C and GO implementations; therefore, a majority of developers were not able to use Falcon keys and signatures in their JavaScript or TypeScript applications. 

This project from [GoPlausible](https://goplausible.com) aims to fill that gap. We initially use that to make all of our agentic toolins and platforms post-quantum secure.

Includes A JavaScript CLI and library for the Falcon post-quantum cryptography signature algorithm, compiled to WebAssembly for use in both Node.js and browser environments.

[Algorand Falcon GitHub Repository](https://github.com/algorand/falcon)


This contribution is inspired by  [ amazing work of](https://github.com/algorandfoundation/falcon-signatures) [Giulio Pizzini](https://x.com/giuliopizzini) in Go language by the Algorand Foundation. Many thanks to Giulio for his great work and support!


Many thanks to my good friend [Nullun](https://x.com/nullun)




## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Command Line Interface](#command-line-interface)
  - [Node.js API](#nodejs-api)
  - [Browser Usage](#browser-usage)
- [Building from Source](#building-from-source)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Implementation Details](#implementation-details)
- [License](#license)

## Introduction

Falcon (Fast-Fourier Lattice-based Compact Signatures over NTRU) is a post-quantum cryptographic signature algorithm submitted to NIST's Post-Quantum Cryptography project. It is designed to be secure against attacks from quantum computers while maintaining efficiency and compact signatures.

This project provides a JavaScript CLI and library for the deterministic variant of Falcon, compiled from the C implementation to WebAssembly using Emscripten. It supports key generation, signing, and verification operations in both Node.js and browser environments.

The implementation uses the deterministic variant of Falcon, which provides reproducible signatures for the same message and key pair. This is particularly important for applications where signature reproducibility is required.

## Features

- **Post-Quantum Security**: Implements the Falcon-1024 signature scheme, which is resistant to attacks from quantum computers
- **Cross-Platform**: Works in Node.js and modern browsers via WebAssembly
- **Simple API**: Easy-to-use functions for key generation, signing, and verification
- **Command Line Interface**: Convenient CLI for file-based operations
- **Compact Signatures**: Produces relatively small signatures compared to other post-quantum algorithms

## Installation

### NPM Package

You can install the package via npm:

```bash
npm install falcon-signatures
```

### Manual Installation

If you prefer to install manually:

1. Clone the repository:
```bash
git clone https://github.com/GoPlausible/falcon-signatures-js.git
cd falcon-signatures-js
```

2. Initialize and update the Falcon submodule:
```bash
git submodule init
git submodule update
```

3. Build the WebAssembly module (requires Emscripten):
```bash
# First, set up the Emscripten environment
source /path/to/emsdk/emsdk_env.sh

# Then build the module
emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker,node -s EXPORTED_FUNCTIONS='["_malloc","_free","_simple_keygen","_simple_sign","_simple_verify","_get_sk_size","_get_pk_size","_get_sig_max_size"]' -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","HEAPU8"]' falcon/common.c falcon/codec.c falcon/deterministic.c falcon/falcon.c falcon/fft.c falcon/fpr.c falcon/keygen.c falcon/rng.c falcon/shake.c falcon/sign.c falcon/vrfy.c falcon_wrapper.c -o falcon.js
```

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

Or sign using a message from a file:

```bash
node falcon-cli.js sign "$(cat message.txt)" <hex_secret_key>
```

#### Verify a signature

```bash
node falcon-cli.js verify "message to verify" <hex_signature> <hex_public_key>
```

### Node.js and Browser

```javascript
// Using ES modules
import Falcon from 'falcon-signatures';

// Using CommonJS
// const Falcon = require('falcon-signatures');

async function example() {
  // Initialize the Falcon instance
  const falcon = new Falcon();
  
  // Generate a keypair
  console.log('Generating a Falcon keypair...');
  const { publicKey, secretKey } = await falcon.keypair();
  
  console.log(`Public key length: ${publicKey.length} bytes`);
  console.log(`Secret key length: ${secretKey.length} bytes`);
  
  // Convert to hex for storage or display
  const pkHex = Falcon.bytesToHex(publicKey);
  const skHex = Falcon.bytesToHex(secretKey);
  
  console.log(`Public key (first 32 chars): ${pkHex.substring(0, 32)}...`);
  
  // Sign a message
  const message = 'Hello, Falcon!';
  console.log(`Signing message: "${message}"`);
  
  const signature = await falcon.sign(message, secretKey);
  console.log(`Signature length: ${signature.length} bytes`);
  
  // Verify the signature
  const isValid = await falcon.verify(message, signature, publicKey);
  console.log(`Verification result: ${isValid ? 'Valid ✓' : 'Invalid ✗'}`);
  
  // You can also use hex strings for keys and signatures
  const isValidHex = await falcon.verify(message, Falcon.bytesToHex(signature), pkHex);
  console.log(`Verification with hex inputs: ${isValidHex ? 'Valid ✓' : 'Invalid ✗'}`);
}

example().catch(console.error);
```

## Building from Source

If you're building the library from source (rather than installing via npm), you'll need to have Emscripten installed:

1. Install Emscripten by following the instructions at [emscripten.org](https://emscripten.org/docs/getting_started/downloads.html)

2. Clone the repository and initialize submodules:
```bash
git clone https://github.com/GoPlausible/falcon-signatures-js.git
cd falcon-signatures-js
git submodule init
git submodule update
```

3. Set up the Emscripten environment:
```bash
source /path/to/emsdk/emsdk_env.sh
```

4. Build the WebAssembly module:
```bash
emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker,node \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_simple_keygen","_simple_sign","_simple_verify","_get_sk_size","_get_pk_size","_get_sig_max_size"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","HEAPU8"]' \
  falcon/common.c falcon/codec.c falcon/deterministic.c falcon/falcon.c \
  falcon/fft.c falcon/fpr.c falcon/keygen.c falcon/rng.c falcon/shake.c \
  falcon/sign.c falcon/vrfy.c falcon_wrapper.c -o falcon.js
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
2. Sign a test message
3. Verify the signature
4. Test file-based operations

## API Reference

### WebAssembly Module Functions

- `_get_sk_size()`: Returns the size of a secret key in bytes
- `_get_pk_size()`: Returns the size of a public key in bytes
- `_get_sig_max_size()`: Returns the maximum size of a signature in bytes
- `_simple_keygen(skPtr, pkPtr)`: Generates a keypair
- `_simple_sign(sigPtr, sigLenPtr, skPtr, msgPtr, msgLen)`: Signs a message
- `_simple_verify(sigPtr, sigLen, pkPtr, msgPtr, msgLen)`: Verifies a signature

### CLI Commands

- `keygen`: Generates a new keypair
- `sign <message> <hex_sk>`: Signs a message using a secret key
- `verify <message> <hex_sig> <hex_pk>`: Verifies a signature

### NPM Library methods

- `keygen`: Generates a new keypair
- `sign <message> <hex_sk>`: Signs a message using a secret key
- `verify <message> <hex_sig> <hex_pk>`: Verifies a signature

## Implementation Details

This implementation is based on the deterministic variant of the Falcon reference implementation in C, compiled to WebAssembly using Emscripten. It uses the Falcon-1024 parameter set, which provides the highest security level.

The Falcon C implementation is included as a Git submodule from the [Algorand Falcon repository](https://github.com/algorand/falcon). The C wrapper functions in `falcon_wrapper.c` provide a simplified interface to the Falcon implementation, handling memory allocation and parameter passing. The JavaScript CLI and API then interact with these wrapper functions through the WebAssembly module.

Key technical details:
- Uses Falcon-1024 (logn=10)
- Secret key size: 2,305 bytes
- Public key size: 1,793 bytes
- Maximum signature size: 1,538 bytes (compressed format)
- Actual signature size: ~1,267 bytes (varies slightly)

Memory management is handled carefully to avoid memory leaks and stack overflows in the WebAssembly environment:
- Large temporary buffers are allocated on the heap instead of the stack to avoid stack overflow errors
- All allocated memory is properly freed after use
- Error handling is implemented for all memory allocations

### Project Structure

The project is structured as follows:
- `falcon/`: Git submodule containing the Falcon C implementation
- `falcon-cli.js`: Command-line interface for the Falcon functionality
- `falcon-cli-test.js`: Test file for the CLI
- `falcon.js`: JavaScript wrapper for the WebAssembly module (generated)
- `falcon.wasm`: WebAssembly binary (generated)
- `README.md`: This file

## License

This project is licensed under the [MIT License](LICENSE).

## Results example
```bash
mg@GoPlausible falcon % node falcon-cli-test.js
=== Falcon CLI Test ===

=== Step 1: Generating a new Falcon keypair ===

> node ./falcon-cli.js keygen
Keygen completed successfully
Public key length: 1793 bytes
Secret key length: 2305 bytes
Keys saved to falcon_pk.bin and falcon_sk.bin

=== Step 2: Signing a message ===
Generating a new keypair for signing...

> node ./falcon-cli.js keygen

> node ./falcon-cli.js sign "test" 5ae8c9d0189ed83e3d7bdf08081eeffe20c7d0fbe008061f843cd8061e841f37cbf09400eff7fdf802f18010083d0887fe77e2f77fff7bc5ff402093e20f7e108ba0f77dff7c03ff7c0ff802373c128c60f08df213dbe8c1d170203930228403fffe0e907b21bdc203801f7bd11fa1e602400fffd0bc1f6421f04610f71f093bf083c0f80202743cf0c5c00bdcefbe4dfc1be908000802093c0083df17840b0bfce6f01003e1208a3ff77cf93df089010f85d0708311404078860f45ff94fb013e10f7bdf745ff8c20f837f0040018be2083a4f103ef77e2ff3e3f87c000442effbee045ff845d083a1f13dcff41fffbe01707b0707b08362f7c01e745e013fde7c5fe87a2103a1fe86018000effc410421ff87c18420d8862e7c3f08021e0c00e747ef83dce07c4ef840e0c9e00f811f80016b8119405078432081e00843de400183c01f7e11802116cde0840127ffce807e09cbfe007f1ffe1f139deef621fbbd083e01844201363f00bf2041fd8bc0f8c5f2ff9f0002218462077e200fde18be31009f27c21017c407c43f885ee7c3f18840f7fe5e18220837bf8c041887bc78643071e06ffeffbbd2fc20ffffde0ba1f03a6c104110fbf0983deffc337c7ccfc3e1ffde3ffe0f6c200701fef78102000ffc0507bfcd0c3e0045d26022d8840e8bc200b80efc3e187e11045f1787d2703f087a006ba006f1de6b81e843cffc9c17421f0c40173a3f003e1fba2103e40fffc1fbdf0ec3bf0fa108c3efff7fef45ef0bfed047e17be1f8be2e107ce87be10be000f9dff7e0f83230804407b81ff3c808c80414831045e003e000861000410801a28860d148006c5f4efc2f047e00400e8c00f0fc1e10bf187de2e447f007d1f45ed0ba107fc2084a10889e000403f05ed80202045d1f3a90f038107e3177c2ef424d7c9c00fc51005e20441d745e093ffd87e11fc1ff7767ff801eefde0883c00ffe2f40110381f84012f4250f83d21c7e29023fe3211fc611fc412045f00c6027c440843d1941f18bbf0fffcf8c6210fc2f7f84103fbf0c451ef8117c3d37c241101defc5fff400effbe194220f340277a2ff7a2f001d077e31741f00002f9341f0844e83bb173a2ff422ffc5f1075dff03c10061200bce747ef93dff8003fffe00802117fdf0ff7ec800000bbdff782f7fff3781f07c22280a40fffd0f88007c62e7c5efffbc4700107c5ed7c60e849f2783f1003cfff5a07bffe0786f887d2fc01e947c11803f13e50fc7f1107a177c4ef79e0efddf12fe1747c007e00fc0200bffdf7dd0787f08480f807c3701df0b5fe7b610845ce8ffb083fb18443e8804187de0ff9b003a006c62f17e117b600f7e018c0308402ff84300801f0460df49e0043d0781e078dbf779c1006500801ff86207b22e0402f7fc02131dff420c93832147b007dfe77e10f3c40081f00403d88c218fe4f801e210df220c31fffb2840407c3c07c01f8801f8c81390200ffc7ffc9f0ec2510b7f1fbdf00bfde8f7e103c3dfc21f0c2130402dfd42183df17b80f14443fbe2d08020845f1f82300402093a3d102400be2287dee7c1d08480f1c2111801003a127ffe20bdeeffdef1c24ff8a1008a11f3fe07c7df0c24f80c0f13bde87ddf7c64efc20287ff17ffd003631fc3e1789e1e802ef824d8805f810200842e83ff0043ce8800f845ee83fd097a13141d3083ef886008c4010c831741dff05b388a51ffdc0781ef045f1781e103241f85f178e2190c000822ef8241081f18c61f8f7e0ffdd200020fba1e7c4407d2320bbdf741ef883d070201009f818f613fae6ead3fec1312c06db2e19192300f1e922ea0de5d3daed152806dae82ef1ecfafbfc0a26082bf9031adcc7e1d9ee1738f7f6d6261c142d25fe1f05c90ee4c8cf27f72af4c5d8f4e2ff1ffaef0ff50e0bc53506041832c5da07d91df9f41ffa120f16d31521170ef919ea0511f9f3170520ee21f30c1e071c0cdff00004f021fae101fbd2eb0cf7cbf514f005f3e7df1a202c0a27ebeb0425e62402e8d5b51f15ecf508eef01c23feee1d10fc1ee0daffc410e6fb160cfaf80300011eeb0ef81006d8140605171d28f3d0dde62e12ff1f142be7fd2107e513e8ea12161e02f231e9ea02083de2f0ea0810dd2bbff00aefd2fc0fc5ee19ebfff20913fc2a0bf5f4effefee3f8ced4000f0b1020f129cd091704010902f7e70c1413d40f03fdfbcf2ffff50024fb0e14eff821ca17ecdffd09180d2bfff1f5130521ebe2e01a160c0034eded10eee1c6fc17d7e211fd27f5f40c3407e5d512eaff0f13e81922f117eff916e6050418ea0e29f6251afff9ef09030619d41eea1af904f00c1ecef108ce1e23220707010b2e0d1c02e7fefdf21110200ce323f61fe5daef03efeaf3d6db0623f10e2ff1feecda16dadb15f62805fbfcf8e20201f2241adf0113ff0112e6fcee1f02f0f0092ee7f020fbfa2031171adc12e30123d8d1cf15ccf523e70ef4fffcffddf316f8f5def9e6f300f70ffff8e608ef01170af60e350d1cfffa09fee504e1d916e20015f2d2f710dd15ff16dfecf82c18cc0420cae4ebf2ebdbf8e8f6fd2ef31c2f1ae9f004ff031de5f417df1f080efff2f1f9180201f5e00ee4e6f504ebcae3cab206f21fffd81beddf0a3af3e01b13f3ea12f8f12b0a342df407e9f20100ea003818fd16032fe00b101edbf72ce5f70aed0d013c1306199f2cf10ceff6cd340b13d42adc08e9fe10d9d5d91402f5e2050e0d2721ded8071a16eb070a111608efea2308d40cfbfd103716c90aeffb1a00d4f8dfe91617dd30e2271d060f16d5e918011606db12fae902e1fdfe0010032b24fd18ca2eddeed9d90db8fe0dee1613070e39dbe412edf00104fae7d2f9fefc08311f21f8f20708f90503dcdf1fd50ae8cecad20a091df5d330f7f130dcf6e41adf17e1c744d4e612de18241d0ece0ef62525eaf4d7231e10d4f70cf2d90701f4c41d03dd1bef13d8371b02dcbe35e20618e5f304f4f118290704fc2620f3ec060fdc210d02fb07ccee02e8282002cefddd09e73913e503f9bb322414c206fc1918dff7fa03db04d3caf82917270be9d0faeee7e0fadbf0fafd27f41732050222fffefcbefcffde13320d33e9dfce0af31c1afde5d100fb06210dfb1eeef2d9f60f270712281d01242dfdd4ec27d6fa00e8d2d1e31c2637fd10d502e40c010425000d3afe12efe7e1ead8ecdaf81edffe1b1032fd131431f3f92fe7f8fe2feff609
Signing completed successfully
Signature length: 1267 bytes
Signature saved to falcon_sig.bin

=== Step 3: Verifying the signature ===

> node ./falcon-cli.js verify "test" 3a31b1f833477ffab8de020a00b499d491b778fecc17c85a9df6e3c2c0e1240d3a8f7f8f00a12df42415eadabd9c780d2628e83b8adfc3b8c10d5701e499675de81da9e7a4ad096356cc32106d825b7c7fe96ede5ccc9df46a47528a26728552a3f168cdda24bf1a4d9a7f619e270994cde272ba4c0a06c1124a73d249ddbafca515226c7b3da6652d1096722193e363a38946e16d66165df9cb6821f8cec2246ee658398cdaaa8f5db214d9426d886c21a464ccd8777b941a79973c95292f61dacd6da7bee2b341dc2f303311b0d7ab993c720e232d27620d0d23c9d49b48ec78610df429c99c50dd4453330d4ee2cc7b62e8b76b85b2f1a88fc2fbf2a4ff4d09da129e96ff04658cf936c7545f1326b667bbe8bc97eb91cb747001d657564967517d2dcc9cfb1ecc4b362b2d6d2b312c7097649c0a0c0738a0b6e96a1503db4d26ee1a6dd483c8e02aee05009cb779cf24677919309a322082ce94fde7b514509b2da75262b5df283a1691526b50b4527bc9d4929c8566f90d676689b747706e7764471fb3c0c7f3df64708fd89cf619d9700a3f1b8b139212440e37051f64f279be982edd9ddd6b4879548f4d84c2a28d066893c733cdb46389ca81137c4a8102afd43b2597d1b14e9be60d906351ce2122ad44f3b644a79699c9d502b495f7686ce73d2f6be7b54d74b748ff392c9997d06ae99807914c9cbafbe4e1456aeef459522536258c952720e4bcd7184a4668f0ac89ee2966f68cd033f69a5b8dcc9b71d64e2f8b74f1dbe2ed6691df54cf7614d238063d50f4705212d6f07517c322e8215b78b2cb09f6c25b64ab1addf22c4d86876b4150344df699478bd93278c3cd494c358affa6911be6bb7e364d877385c6c15e57b1d489fa8c8d7b34ee86ceb103a2b4f46a7a177ac77a12d561aed6c554f9152f69adb7bd9305d23c8427dfd917409e2178a238aa433af4199a11ffbd40cbf62c271c6b0592fed8ad546218ea3430041d4453acb42bf7b3cc84f1246bfca0bf9bea7bb6f49ba4050272e669d973d3acb84e756c95ca2f288a9ebf55146c761b230a31a441feaf50ef4a7f1924a8dfc8eec2447568b81c3eb65f0a832368b5de004efbdada77624e9e61032463b5ca8f38d1c5eb6fa2109cb6971a3bfd6027dab2bfd5b161fe0acb335cd72ca5dd50bb352d699bb977083685c98ed01b09c7263d0bd64a6133150317aa6be7163d3b671c33c746b868e45474cdb9c4d26fb3b3917ae899492900ee2a96bdcd6efe95d377131ebb30ab2e5896a1313ceed91581212d732a9f4b7af3247b04e77754d362a673247a3cf1b0cc64bbf6ca8b7e278c5522f8b03cefccf913a39d4c5e1d4b63957bcad7505d50209b41640dde1b49f1dc108634d4721bfed60d35c8da7c84c534f4e2ca1c9509c6555f988c5dadf959b87605014f27fed9e55621194f2cc9d37ddae26fa1f27efe9a46a5d393ed447ade966623efa50f75af4a3c15b56eec9ae8f2b08cf4a8d7b31dedfea4d631b7a8da64adf8e61454e66cf6cc97df043a63191a8eac5124f05cf2d2631f8991f1ae9d4380157c89c43fb61c160f122046d524fcc5538df5daa0cf242969eeb136675a25d6b5333b14be8af4c59a472128c4ff66887f019340a14665c04eed44d266ab798eee5f0a94d1ca64188036103e1efbe343d73e901638cea15b6f2c389fd43d5b965215f75720311701be91be7e053750941665ab34aa9b119d4f91fab175e6e732b5ec33b9c2f9b34c326631cafc814b72fd39e83e20dd60a25c38 0a11829e035bc88d9ed9208aa8ced63678d08441d4562cb19717bca9bcbaaa0057d02cf5a290af47924fbb79283888d6555737facbd10329b74ac49c9375ad77bdee01181ac8c022fef8627d57e84438e542840c22ac19bb96c02cde24468de201811f29181444529c9c048ed5195219cf53255cca73483e2d38b4110869bd7d5413a95506777d29fd7798a69f81593bd2911e22588dc997aa97453719a380804b6d5a0a6567bdcf7325ccf7bbd2a476454877c13ccbed0194214390d23b17182851540d2eba76af1653a0d43db0345b6e05b2afdd0620fe68ffa832ddc76f657e283a1d404099e7b5d6cdab16d9b8b5f2d587c4a0b0555cd6333be9399916ae6271ec3450966d514a6d1293ca49440f88cc9e9616c817d089447c30f235ae6d12bad4f53f2c5c59b99c6745872c0621dc374a02fa3b9e2f77f8e0d24c26da8a62de191b6cb889142b917f2401991da70a537ab9babca87f1cf6d7750a6bbd4604655a2c1fdca9f159460217e096b6fc3b5145a11ad9bcfa22247bba3002887b1ccd05c29a27bd40e4538097592d67a577b58bf8d082ec2318ef9a6251fd07bcdacb028b02145069709220140f4e0fa3582ed070e90a8370aa0f9a0a2384a8963d06c93884de85726f9114ab19d1fb72dde664dd572e849c196aeba3bebdc5564913a501bb585e15f32465b81151d66511683cdd42772c488390cdc7fb98eee23f5c3588222ad19d3d42d02ecd8066209519cd1788b4b03c1aa9923c9c24b7a956ab3e781e9bf4910da7b591a5e6540bdf6b0ec505f7d425b2062680854bf47d1cdde1ba01d1214afdb46d55058e24aa5a621e516a01833988d5ac61a05bbb91ee9e93cd8323d9853060de2ea291d7193f38467b0b4212b1065821da2efa0c365c89fca8e72bb10d325d09451d5e17f63d24560541f67a73ec38951443090f59829ef10da334178c293a1749d394fd15ec4378860f63ba044674689c4332a0c1a3bc0734023e1cc53bd6eaa0c9f05203e8a3674a87730a480470858442ee871457bd2d3b1c66343a853090a160a6633d949b34e0579ec6bb51120032b29581d5e14a392cc9ffca2289c4704daf585821b31b5e7431a2d86485ca72ebd40e1012e936f0246bd35eba0c964f8b4a6b7a2590bc15e58cb48c76a500020159e40982cf2e052d2673a9581e0a9171a08f2a016b081ff836467d42f524224b109b40bea1490dc0f970a200e6326b911b9ae9a2a0cff31c29a9e80ceae2aeadf3c4d3aff72db606e4d3e75364e4c83ba309510f114aeb15cc3b5fd81044dfd43e6ffd42c8a024c0b8427b99f2cf9773da5b246d245460d60a8946254b9c859d12e8c2809cd958c13c2b92108e1fabdb9202320d8219ea6e093ac60c709e227134ca48666286797794efd5e5182b582e26d99a4a4f5898dcb0bae97d7ebc2309a41dac8514fcbb6407903a64586a3b2d54880055d6c3a2aa2e8ed27683caa55592c9d187874a43448772991d3693b869f4a32e3b13c20257e56ed54921299051d77f45dde30ab31cad7bb143a137c1f480483100bc11df37b9b0c0ab20cfa02ee790e317437cec08174fdacd27b95ffa46cad6a371692a06e1a2754acef99f99b85e75a65319c91e998a0dc09ec4400bb10da3f99819a65eec77162570a5f911c0a3ab4fbcddbfa8b80c834f5a1ad5d45946a26029c2c785bfa37d0e2a0901be42587e558383d59ff2c4083fd65735fd04b369a7867b3a68c84d602487d0af440784609ad298d227642e40480a2b1cc6313ce969f195d5feb63d5b74c2e191a82ef992cf62dba985b435c44cea5310a6e7a750cd74581707f987fb2bb0f3d9269c3a7d1a3d169c9888471553f7b2d14eb0de898272c25273c631267ddeb32c828486481b1452555014e3ab7715342fe7f0dc05afb0845bcf468936bd8672ff8aa43d36d2a45017c48812a5b7372114a1c4f79317680498a0b950dc15af4022f30b49204a9fd08e0a819df705dafc1aada11626e0104618975a68016902b0182c0ec51ff872d20b4b16386aa1c7537c6ccc44eaec2a9730c2b787c7d3a290495ba1016c08098ff82320a091802a06639a41ab30fe796f86998429b1908f4ebf206ef88adfc2e82af02b4645453822897dc5eb904d5715e53133ed870a106d289a69e0acbd4ed5d543f4747d21d0a0c65ca461acd1ea1420bb16d3b3bc97a6a8385c30b7476b24460fab7518e205f87eeba049f43c79b98a9ed445301cbf79a0200412553a086be5d38ea174f1bc26c2731d5a1959689c9e2d13a2ad4fce16ed9344f45a37557a2b39cc01e1abe6de03742cd601062a3b43de5b2c888ec2dc131b35ed1277669f4b78f51249b725ce45f208a82b59aa0f55e4b143ed802f401f70fc54f286f8d230a39376199a0b4067615b94946fd89ace17774a5526ab1291494e70263c5bf33eb0da1a93ee13515d9628cf26eb5a29ea76b8d7fa4f4cdca705c44406be72d413928a5cf2603b96691c7836e7f2fcad7bb78a8bf9b353ae8b12280294e842
Verification result: Using key sizes: PK=1793 bytes, SK=2305 bytes, SIG=1538 bytes
Module reports: PK=1793 bytes, SK=2305 bytes, SIG=1462 bytes
Calling verify with parameters:
- sigPtr: 99512
- sig.length: 1267
- pkPtr: 100784
- msgPtr: 99496
- msg.length: 4
✅ Verification success

```
