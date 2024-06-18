import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../env-vars';

const algorithm = 'aes-256-cbc';

// Convert a hex string to a buffer.
//
// Note: hex strings don't start with 0x
export const hexStringToBuffer = (key: string): Buffer => {
  return Buffer.from(key, 'hex');
};

// Get the encryption key from the env and convert it to a buffer.
export const getKeyBufferFromEnv = (): Buffer => hexStringToBuffer(ENCRYPTION_KEY);

// Encrypts the given text using the given key.
// Store the IV with the encrypted text (prepended).
export const encrypt = (key: Buffer, text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Encrypts the given text using the env variable ENCRYPTION_KEY
// Store the IV with the encrypted text (prepended).
export const encryptFromEnv = (text: string): string => {
  const key = getKeyBufferFromEnv();
  return encrypt(key, text);
};

// Decrypts the given encrypted text using the given key.
// The IV is prepended to the encrypted text.
export const decrypt = (key: Buffer, encryptedText: string): string => {
  const [ivHex, encryptedHex] = encryptedText.split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString();
};

// Decrypts the given encrypted text using the env variable ENCRYPTION_KEY
// The IV is prepended to the encrypted text.
export const decryptFromEnv = (encryptedText: string): string => {
  const key = getKeyBufferFromEnv();
  return decrypt(key, encryptedText);
};
