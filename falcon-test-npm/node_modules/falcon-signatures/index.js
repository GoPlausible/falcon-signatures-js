/**
 * Falcon Signatures - JavaScript library for Falcon post-quantum cryptography signatures
 */
import ModuleFactory from './falcon.js';

/**
 * Falcon - A class for Falcon post-quantum cryptography signature operations
 */
class Falcon {
  /**
   * Create a new Falcon instance
   */
  constructor() {
    this._module = null;
    this._initialized = false;
    this._initPromise = this._init();
  }

  /**
   * Initialize the Falcon WebAssembly module
   * @private
   */
  async _init() {
    if (this._initialized) return;
    
    try {
      this._module = await ModuleFactory();
      
      // Get key and signature sizes from the module
      this._PK_LEN = this._module._get_pk_size();
      this._SK_LEN = this._module._get_sk_size();
      this._SIG_MAX = this._module._get_sig_max_size();
      
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize Falcon module:', error);
      throw new Error('Failed to initialize Falcon module');
    }
  }

  /**
   * Ensure that the module is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await this._initPromise;
    }
  }

  /**
   * Convert a hex string to a Uint8Array
   * @param {string} hex - Hex string to convert
   * @returns {Uint8Array} The resulting byte array
   */
  static hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  }

  /**
   * Convert a Uint8Array to a hex string
   * @param {Uint8Array} bytes - Byte array to convert
   * @returns {string} The resulting hex string
   */
  static bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Generate a Falcon keypair
   * @returns {Promise<Object>} An object containing the public and private keys as Uint8Arrays
   * @throws {Error} If key generation fails
   */
  async keypair() {
    await this._ensureInitialized();

    const pkPtr = this._module._malloc(this._PK_LEN);
    const skPtr = this._module._malloc(this._SK_LEN);

    try {
      const res = this._module._simple_keygen(skPtr, pkPtr);
      if (res !== 0) throw new Error(`Keygen failed with error code: ${res}`);

      // Create a copy of the keys to avoid issues with memory being freed
      const pk = new Uint8Array(this._module.HEAPU8.buffer, pkPtr, this._PK_LEN).slice();
      const sk = new Uint8Array(this._module.HEAPU8.buffer, skPtr, this._SK_LEN).slice();

      return { 
        publicKey: pk, 
        secretKey: sk
      };
    } finally {
      // Free allocated memory
      this._module._free(pkPtr);
      this._module._free(skPtr);
    }
  }

  /**
   * Sign a message with a secret key
   * @param {Uint8Array|string} message - The message to sign (string or Uint8Array)
   * @param {Uint8Array|string} secretKey - The secret key (Uint8Array or hex string)
   * @returns {Promise<Uint8Array>} The signature
   * @throws {Error} If signing fails
   */
  async sign(message, secretKey) {
    await this._ensureInitialized();

    // Convert message to Uint8Array if it's a string
    const msg = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    
    // Convert secretKey to Uint8Array if it's a hex string
    const sk = typeof secretKey === 'string' ? Falcon.hexToBytes(secretKey) : secretKey;

    // Verify the secret key length
    if (sk.length !== this._SK_LEN) {
      throw new Error(`Invalid secret key length: ${sk.length}, expected ${this._SK_LEN}`);
    }

    // Allocate memory for message and secret key
    const msgPtr = this._module._malloc(msg.length);
    const skPtr = this._module._malloc(this._SK_LEN);
    
    // Copy message and secret key to WebAssembly memory
    this._module.HEAPU8.set(msg, msgPtr);
    this._module.HEAPU8.set(sk, skPtr);

    // Allocate memory for signature and signature length
    const sigPtr = this._module._malloc(this._SIG_MAX);
    const sigLenPtr = this._module._malloc(4);
    
    // Initialize the signature length pointer with the buffer size
    this._module.setValue(sigLenPtr, this._SIG_MAX, "i32");

    try {
      // The C function signature is:
      // int simple_sign(uint8_t *sig, size_t *sig_len, const uint8_t *sk, const uint8_t *msg, size_t msg_len)
      const res = this._module._simple_sign(sigPtr, sigLenPtr, skPtr, msgPtr, msg.length);
      
      if (res !== 0) {
        throw new Error(`Sign failed with error code: ${res}`);
      }
      
      // Get signature length and copy signature from WebAssembly memory
      const sigLen = this._module.getValue(sigLenPtr, "i32");
      
      // Create a copy of the signature to avoid issues with memory being freed
      return new Uint8Array(this._module.HEAPU8.buffer, sigPtr, sigLen).slice();
    } finally {
      // Free allocated memory
      this._module._free(msgPtr);
      this._module._free(skPtr);
      this._module._free(sigPtr);
      this._module._free(sigLenPtr);
    }
  }

  /**
   * Verify a signature
   * @param {Uint8Array|string} message - The message (string or Uint8Array)
   * @param {Uint8Array|string} signature - The signature (Uint8Array or hex string)
   * @param {Uint8Array|string} publicKey - The public key (Uint8Array or hex string)
   * @returns {Promise<boolean>} True if the signature is valid, false otherwise
   * @throws {Error} If verification fails with an error
   */
  async verify(message, signature, publicKey) {
    await this._ensureInitialized();

    // Convert message to Uint8Array if it's a string
    const msg = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    
    // Convert signature and publicKey to Uint8Array if they're hex strings
    const sig = typeof signature === 'string' ? Falcon.hexToBytes(signature) : signature;
    const pk = typeof publicKey === 'string' ? Falcon.hexToBytes(publicKey) : publicKey;

    // Verify the public key length
    if (pk.length !== this._PK_LEN) {
      throw new Error(`Invalid public key length: ${pk.length}, expected ${this._PK_LEN}`);
    }

    // Allocate memory for message, signature, and public key
    const msgPtr = this._module._malloc(msg.length);
    const sigPtr = this._module._malloc(sig.length);
    const pkPtr = this._module._malloc(this._PK_LEN);
    
    // Copy message, signature, and public key to WebAssembly memory
    this._module.HEAPU8.set(msg, msgPtr);
    this._module.HEAPU8.set(sig, sigPtr);
    this._module.HEAPU8.set(pk, pkPtr);

    try {
      // The C function signature is:
      // int simple_verify(const uint8_t *sig, size_t sig_len, const uint8_t *pk, const uint8_t *msg, size_t msg_len)
      const res = this._module._simple_verify(sigPtr, sig.length, pkPtr, msgPtr, msg.length);
      return res === 0;
    } finally {
      // Free allocated memory
      this._module._free(msgPtr);
      this._module._free(sigPtr);
      this._module._free(pkPtr);
    }
  }
}

// Export the Falcon class
export default Falcon;
