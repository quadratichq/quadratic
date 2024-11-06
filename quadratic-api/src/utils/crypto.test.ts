import crypto from 'crypto';
import { decrypt, encrypt, hash } from './crypto';

// Convert a hex string to a buffer.
//
// Note: hex strings don't start with 0x
const hexStringToBuffer = (key: string): Buffer => {
  return Buffer.from(key, 'hex');
};

describe('Encryption and Decryption', () => {
  const keyBytes = crypto.randomBytes(32);
  const key = hexStringToBuffer(keyBytes.toString('hex'));
  const text = 'Hello, world!';

  it('should hash a value', () => {
    const hashed = hash(text);
    const expected = '315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3';

    expect(hashed).toEqual(expected);
  });

  it('should convert a hex to a buffer', () => {
    const hex = keyBytes.toString('hex');
    const buffer = hexStringToBuffer(hex);

    expect(buffer).toEqual(keyBytes);
  });

  it('should encrypt and decrypt the text correctly', () => {
    const encryptedText = encrypt(key, text);
    const decryptedText = decrypt(key, encryptedText);

    expect(decryptedText).toBe(text);
  });

  it('should produce different encrypted outputs for the same input text', () => {
    const encryptedText1 = encrypt(key, text);
    const encryptedText2 = encrypt(key, text);

    expect(encryptedText1).not.toBe(encryptedText2);
  });

  it('should fail to decrypt with a wrong key', () => {
    const wrongKey = crypto.randomBytes(32);
    const encryptedText = encrypt(key, text);

    expect(() => decrypt(wrongKey, encryptedText)).toThrow();
  });

  it('should fail to decrypt with a tampered encrypted text', () => {
    const encryptedText = encrypt(key, text);
    const tamperedText = encryptedText + 'abc123';

    expect(() => decrypt(key, tamperedText)).toThrow();
  });
});
