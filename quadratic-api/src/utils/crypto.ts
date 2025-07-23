import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { ENCRYPTION_KEY } from '../env-vars';

// Use the same algorithm and IV for all encryption and decryption.
const algorithm = 'aes-256-cbc';

// Get the encryption key from the env and convert it to a buffer.
const encryption_key = Buffer.from(ENCRYPTION_KEY, 'hex');

export const hash = (text: string): string => {
  const hash = crypto.createHash('sha256');
  hash.update(text);

  return hash.digest('hex');
};

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
  return encrypt(encryption_key, text);
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
  return decrypt(encryption_key, encryptedText);
};

/**
 * Generate SSH key pair using the actual ssh-keygen command
 *
 * @param options Configuration options
 * @returns Promise with the private and public keys as strings
 */
export const generateSshKeys = async (
  options: {
    bits?: number;
    comment?: string;
    passphrase?: string;
    type?: 'rsa' | 'ed25519' | 'ecdsa';
    outputDir?: string;
  } = {}
): Promise<{ privateKey: string; publicKey: string }> => {
  const {
    bits = 4096,
    comment = `nodejs-generated-${Date.now()}`,
    passphrase = '',
    type = 'rsa',
    outputDir = os.tmpdir(),
  } = options;

  // Create unique filenames for this run
  const unique = crypto.randomUUID().replace(/-/g, '');
  const privateKeyPath = path.join(outputDir, `id_${type}_${unique}`);
  const publicKeyPath = `${privateKeyPath}.pub`;

  // Build the ssh-keygen command
  const cmd = [
    'ssh-keygen',
    '-t',
    type,
    '-b',
    bits,
    '-C',
    `"${comment}"`,
    '-f',
    privateKeyPath,
    '-N',
    `"${passphrase}"`,
  ].join(' ');

  try {
    // Execute ssh-keygen
    await promisify(exec)(cmd);

    // Read the generated files
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

    // Clean up temporary files
    fs.unlinkSync(privateKeyPath);
    fs.unlinkSync(publicKeyPath);

    return { privateKey, publicKey };
  } catch (error: unknown) {
    console.error(JSON.stringify({ message: 'Error generating SSH keys', error }));
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate SSH keys: ${errorMessage}`);
  }
};
