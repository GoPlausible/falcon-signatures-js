declare module 'falcon-signatures' {
  export default class Falcon {
    constructor();
    _ensureInitialized(): Promise<void>;
    keypair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }>;
    sign(message: Uint8Array | Buffer, secretKey: Uint8Array): Promise<Uint8Array>;
    verify(message: Uint8Array | Buffer, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
    static bytesToHex(bytes: Uint8Array): string;
    static hexToBytes(hex: string): Uint8Array;
  }
}
