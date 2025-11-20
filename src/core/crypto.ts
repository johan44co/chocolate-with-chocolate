/**
 * Cryptographic operations using AES-GCM
 * Cross-platform implementation for Node.js and browsers
 */

import type { KeyMaterial, EncryptedPayload } from "../types.js";
import { randomBytes, sliceBytes, stringToBytes } from "../utils/buffers.js";

/**
 * AES-GCM parameters
 */
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits (recommended for AES-GCM)
const TAG_LENGTH = 16; // 128 bits (default for AES-GCM)
const SALT_LENGTH = 16; // 128 bits for PBKDF2

/**
 * PBKDF2 parameters for key derivation
 */
const PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
const PBKDF2_HASH = "SHA-256" as const;

/**
 * Derive a 256-bit key from a string password using PBKDF2
 * @param password - Password string
 * @param salt - Salt for key derivation (16 bytes)
 * @returns Derived key (32 bytes)
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = stringToBytes(password);

  // Browser environment (Web Crypto API)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
      "deriveBits",
    ]);

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      keyMaterial,
      KEY_LENGTH * 8 // bits
    );

    return new Uint8Array(derivedBits);
  }

  // Node.js environment
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    try {
      const crypto = await import("crypto");
      return await new Promise<Uint8Array>((resolve, reject) => {
        crypto.pbkdf2(
          Buffer.from(passwordBytes),
          Buffer.from(salt),
          PBKDF2_ITERATIONS,
          KEY_LENGTH,
          PBKDF2_HASH.toLowerCase().replace("-", ""),
          (err: NodeJS.ErrnoException | null, derivedKey: Buffer) => {
            if (err) reject(err);
            else resolve(new Uint8Array(derivedKey));
          }
        );
      });
    } catch {
      throw new Error("Node.js crypto module not available");
    }
  }

  throw new Error("No crypto implementation available");
}

/**
 * Process key material into a valid 256-bit key
 * @param secret - String password or direct key bytes
 * @returns Key bytes and salt (if derived from password)
 */
async function processKeyMaterial(secret: KeyMaterial): Promise<{
  key: Uint8Array;
  salt?: Uint8Array;
}> {
  // If already a Uint8Array, validate and use directly
  if (secret instanceof Uint8Array) {
    if (secret.length !== KEY_LENGTH) {
      throw new Error(
        `Key must be exactly ${String(KEY_LENGTH)} bytes (${String(KEY_LENGTH * 8)} bits)` as const
      );
    }
    return { key: secret };
  }

  // If string, derive key using PBKDF2
  if (typeof secret === "string") {
    if (secret.length === 0) {
      throw new Error("Password cannot be empty");
    }

    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKeyFromPassword(secret, salt);
    return { key, salt };
  }

  throw new Error("Secret must be a string or Uint8Array");
}

/**
 * Encrypt data using AES-GCM
 * @param plaintext - Data to encrypt
 * @param secret - Encryption key (string or Uint8Array)
 * @returns Encrypted payload with IV and optional salt
 */
export async function encrypt(
  plaintext: Uint8Array,
  secret: KeyMaterial
): Promise<EncryptedPayload & { salt?: Uint8Array }> {
  const { key, salt } = await processKeyMaterial(secret);
  const iv = randomBytes(IV_LENGTH);

  // Browser environment (Web Crypto API)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: ALGORITHM }, false, [
      "encrypt",
    ]);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH * 8,
      },
      cryptoKey,
      plaintext
    );

    const result: EncryptedPayload & { salt?: Uint8Array } = {
      iv,
      ciphertext: new Uint8Array(ciphertext),
    };

    if (salt) {
      result.salt = salt;
    }

    return result;
  }

  // Node.js environment
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    try {
      const crypto = await import("crypto");
      const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key), Buffer.from(iv));

      const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);

      const authTag = cipher.getAuthTag();

      // Combine encrypted data with auth tag
      const ciphertext = new Uint8Array(encrypted.length + authTag.length);
      ciphertext.set(encrypted, 0);
      ciphertext.set(authTag, encrypted.length);

      const result: EncryptedPayload & { salt?: Uint8Array } = {
        iv,
        ciphertext,
      };

      if (salt) {
        result.salt = salt;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }

  throw new Error("No crypto implementation available");
}

/**
 * Decrypt data using AES-GCM
 * @param encrypted - Encrypted payload with IV
 * @param secret - Decryption key (string or Uint8Array)
 * @param salt - Salt for key derivation (required if secret is string)
 * @returns Decrypted plaintext
 * @throws {Error} If decryption fails or authentication fails
 */
export async function decrypt(
  encrypted: EncryptedPayload,
  secret: KeyMaterial,
  salt?: Uint8Array
): Promise<Uint8Array> {
  let key: Uint8Array;

  // Process key material
  if (secret instanceof Uint8Array) {
    if (secret.length !== KEY_LENGTH) {
      throw new Error(
        `Key must be exactly ${String(KEY_LENGTH)} bytes (${String(KEY_LENGTH * 8)} bits)` as const
      );
    }
    key = secret;
  } else if (typeof secret === "string") {
    if (!salt) {
      throw new Error("Salt is required for password-based decryption");
    }
    key = await deriveKeyFromPassword(secret, salt);
  } else {
    throw new Error("Secret must be a string or Uint8Array");
  }

  const { iv, ciphertext } = encrypted;

  // Validate IV length
  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid IV length: expected ${String(IV_LENGTH)}, got ${String(iv.length)}` as const
    );
  }

  // Browser environment (Web Crypto API)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const cryptoKey = await crypto.subtle.importKey("raw", key, { name: ALGORITHM }, false, [
        "decrypt",
      ]);

      const plaintext = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv,
          tagLength: TAG_LENGTH * 8,
        },
        cryptoKey,
        ciphertext
      );

      return new Uint8Array(plaintext);
    } catch {
      throw new Error("Decryption failed: invalid key or corrupted data");
    }
  }

  // Node.js environment
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    try {
      const crypto = await import("crypto");

      // Split ciphertext and auth tag
      if (ciphertext.length < TAG_LENGTH) {
        throw new Error("Invalid ciphertext: too short");
      }

      const encryptedData = sliceBytes(ciphertext, 0, ciphertext.length - TAG_LENGTH);
      const authTag = sliceBytes(ciphertext, ciphertext.length - TAG_LENGTH);

      const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key), Buffer.from(iv));

      decipher.setAuthTag(Buffer.from(authTag));

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData)),
        decipher.final(),
      ]);

      return new Uint8Array(decrypted);
    } catch {
      throw new Error("Decryption failed: invalid key or corrupted data");
    }
  }

  throw new Error("No crypto implementation available");
}

/**
 * Validate that a key is the correct length
 * @param key - Key to validate
 * @returns true if valid
 */
export function isValidKey(key: Uint8Array): boolean {
  return key.length === KEY_LENGTH;
}

/**
 * Generate a random encryption key
 * @returns Random 256-bit key
 */
export function generateKey(): Uint8Array {
  return randomBytes(KEY_LENGTH);
}

/**
 * Get the required key length in bytes
 * @returns Key length (32 bytes for AES-256)
 */
export function getKeyLength(): number {
  return KEY_LENGTH;
}

/**
 * Get the IV length in bytes
 * @returns IV length (12 bytes for AES-GCM)
 */
export function getIvLength(): number {
  return IV_LENGTH;
}
