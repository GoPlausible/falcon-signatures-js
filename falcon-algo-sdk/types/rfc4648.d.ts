declare module 'rfc4648' {
  export const base32: {
    parse(input: string, opts?: { loose?: boolean }): Uint8Array;
    stringify(input: Uint8Array, opts?: { pad?: boolean }): string;
  };
}
