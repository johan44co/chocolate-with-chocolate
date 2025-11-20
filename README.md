# 🍫 CWC (Chocolate With Chocolate)

> **Double-layer encoding**: Compression + Encryption = Secure, compact tokens

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-272%20passing-brightgreen.svg)](#)

**CWC** is a modern, secure token encoding library that combines compression and encryption into a single, elegant API. Perfect for secure client-side storage, encrypted cookies, magic links, and more.

## Why CWC?

Developers often make critical mistakes with client-side data:
- ❌ Storing sensitive data in localStorage **without encryption**
- ❌ Not compressing payloads (bloated tokens)
- ❌ Using insecure patterns (reusing IVs, wrong encryption order)
- ❌ No versioning or key rotation support

**CWC solves this** with a dead-simple API that does everything correctly by default.

### Key Features

- 🔐 **Secure by default**: AES-GCM-256 encryption with unique IVs
- 📦 **Smart compression**: Brotli, LZ-String, Zlib, or auto-select
- 🌐 **Cross-platform**: Works in Node.js and browsers
- 🔄 **Key rotation**: Built-in support for rotating encryption keys
- ⏱️ **TTL support**: Token expiration and validation
- 🎯 **TypeScript-first**: Full type safety with strict mode
- 🪶 **Lightweight**: ~37 KB ESM, tree-shakeable
- 🎨 **Zero dependencies**: Pure JavaScript (except lz-string)

## Installation

```bash
npm install cwc
# or
yarn add cwc
# or
pnpm add cwc
```

## Quick Start

```typescript
import { encode, decode } from 'cwc';

// Encode data
const token = await encode({ userId: 123, role: 'admin' }, 'your-secret-key');
console.log(token); // "Q29tcHJlc3NlZCAmIEVuY3J5cHRlZCE..."

// Decode data
const data = await decode(token, 'your-secret-key');
console.log(data); // { userId: 123, role: 'admin' }
```

That's it! CWC handles compression, encryption, metadata, and encoding automatically.

## Table of Contents

- [Core API](#core-api)
- [Advanced Features](#advanced-features)
  - [Key Rotation](#key-rotation)
  - [TTL & Expiration](#ttl--expiration)
  - [Custom Metadata](#custom-metadata)
  - [Streaming Large Payloads](#streaming-large-payloads)
  - [Auto-Compression](#auto-compression)
- [Use Cases](#use-cases)
- [Security Best Practices](#security-best-practices)
- [API Reference](#api-reference)
- [Browser Support](#browser-support)
- [Performance](#performance)
- [Examples](#examples)

## Core API

### `encode(data, secret, options?)`

Encodes data into a secure CWC token.

**Process**: `data → JSON → compress → encrypt → metadata → base64url`

```typescript
const token = await encode(
  { message: 'Hello, World!' },
  'my-secret-key',
  {
    compression: 'brotli',      // 'brotli' | 'lz-string' | 'zlib' | 'none'
    algorithm: 'aes-gcm-256',   // Currently only AES-GCM-256
    includeTimestamp: true,      // Add creation timestamp
    ttl: 3600,                   // Time-to-live in seconds
  }
);
```

### `decode(token, secret)`

Decodes a CWC token back to the original data.

**Process**: `base64url → metadata → decrypt → decompress → JSON → data`

```typescript
const data = await decode(token, 'my-secret-key');
```

**Note**: Throws if token is invalid, corrupted, or decrypted with wrong key.

### `extractMetadata(token)`

Extract token metadata without decrypting (useful for checking expiration).

```typescript
const metadata = extractMetadata(token);
console.log(metadata);
// {
//   version: 1,
//   algorithm: 'aes-gcm-256',
//   compression: 'brotli',
//   timestamp: 1700000000000,
//   ttl: 3600
// }
```

## Advanced Features

### Key Rotation

Safely rotate encryption keys without losing access to old tokens.

```typescript
import { rotateKey, decodeWithKeyFallback } from 'cwc';

// Rotate a single token
const oldToken = await encode(data, 'old-key');
const newToken = await rotateKey(oldToken, 'old-key', 'new-key');

// During rotation period, support both keys
const { data, keyIndex } = await decodeWithKeyFallback(
  token,
  ['new-key', 'old-key-1', 'old-key-2']
);

console.log(`Decoded with key ${keyIndex}`);
```

**Batch rotation:**

```typescript
import { rotateKeys } from 'cwc';

const oldTokens = [token1, token2, token3];
const newTokens = await rotateKeys(oldTokens, 'old-key', 'new-key');
```

### TTL & Expiration

Built-in token expiration support with validation helpers.

```typescript
import { 
  encode, 
  isExpired, 
  getRemainingTime, 
  validateNotExpired 
} from 'cwc';

// Create token with TTL
const token = await encode(
  { sessionId: 'abc123' },
  'secret',
  { includeTimestamp: true, ttl: 3600 } // 1 hour
);

// Check expiration
if (isExpired(token)) {
  console.log('Token has expired');
}

// Get remaining time
const remaining = getRemainingTime(token);
console.log(`Expires in ${remaining / 1000} seconds`);

// Validate before use
try {
  validateNotExpired(token);
  const data = await decode(token, 'secret');
} catch (error) {
  console.error('Token expired:', error.message);
}
```

**Check if expiring soon:**

```typescript
import { willExpireSoon } from 'cwc';

if (willExpireSoon(token, 5 * 60 * 1000)) { // 5 minutes
  console.log('Token will expire soon, consider refreshing');
}
```

### Custom Metadata

Add application-specific metadata to tokens (stored in encrypted payload).

```typescript
import { encodeWithMetadata, decodeWithMetadata } from 'cwc';

// Encode with custom metadata
const token = await encodeWithMetadata(
  { balance: 1000 },
  { userId: 'u123', sessionId: 's456', role: 'admin' },
  'secret'
);

// Decode with metadata
const { data, meta } = await decodeWithMetadata(token, 'secret');
console.log(data); // { balance: 1000 }
console.log(meta); // { userId: 'u123', sessionId: 's456', role: 'admin' }
```

**Type-safe metadata:**

```typescript
import { createTypedMetadata } from 'cwc';

const userToken = createTypedMetadata({
  userId: 'string',
  role: 'string',
  loginAt: 'number'
});

const token = await userToken.encode(
  { name: 'Alice' },
  { userId: 'u123', role: 'admin', loginAt: Date.now() },
  'secret'
);

// Validates metadata schema automatically
const result = await userToken.decode(token, 'secret');
```

### Streaming Large Payloads

Split large payloads into chunks for memory-efficient processing.

```typescript
import { encodeStream, decodeStream, shouldStream } from 'cwc';

const largeData = { items: Array(10000).fill({/*...*/}) };

// Check if streaming is recommended
if (shouldStream(largeData)) {
  // Encode into chunks
  const chunks = await encodeStream(
    largeData,
    'secret',
    {},
    1024 * 1024 // 1MB chunks
  );

  console.log(`Created ${chunks.length} chunks`);

  // Store or transmit chunks independently
  // ...

  // Reassemble
  const decoded = await decodeStream(chunks, 'secret');
}
```

### Auto-Compression

Intelligent compression algorithm selection based on payload characteristics.

```typescript
import { selectCompressionAlgorithm, analyzePayload } from 'cwc';

const data = { text: 'Some data...' };

// Auto-select best algorithm
const algorithm = selectCompressionAlgorithm(data);
console.log(`Best algorithm: ${algorithm}`);

const token = await encode(data, 'secret', { compression: algorithm });

// Detailed analysis
const json = JSON.stringify(data);
const analysis = analyzePayload(json);
console.log(analysis);
// {
//   size: 1234,
//   entropy: 0.65,
//   likelyCompressed: false,
//   recommended: 'lz-string'
// }
```

## Use Cases

### 1. Secure localStorage/sessionStorage

```typescript
import { encode, decode } from 'cwc';

// Store sensitive data securely
const userData = { userId: 123, email: 'user@example.com' };
const token = await encode(userData, 'user-secret-key');
localStorage.setItem('user', token);

// Retrieve and decode
const token = localStorage.getItem('user');
if (token) {
  const data = await decode(token, 'user-secret-key');
}
```

### 2. Encrypted Cookies

```typescript
import { encode, decode } from 'cwc';

// Server-side (Node.js)
const sessionData = { userId: 123, role: 'admin' };
const token = await encode(sessionData, process.env.COOKIE_SECRET);
res.cookie('session', token, { httpOnly: true, secure: true });

// Decode cookie
const token = req.cookies.session;
const data = await decode(token, process.env.COOKIE_SECRET);
```

### 3. Magic Links / Password Reset Tokens

```typescript
import { encode, decode } from 'cwc';

// Generate password reset token
const resetData = { 
  userId: 123, 
  email: 'user@example.com',
  purpose: 'password-reset'
};

const token = await encode(
  resetData,
  process.env.RESET_SECRET,
  { includeTimestamp: true, ttl: 3600 } // 1 hour expiry
);

const resetLink = `https://example.com/reset?token=${token}`;

// Validate token
const token = req.query.token;
try {
  validateNotExpired(token);
  const data = await decode(token, process.env.RESET_SECRET);
  // Process password reset...
} catch (error) {
  return res.status(400).json({ error: 'Invalid or expired token' });
}
```

### 4. Offline PWA State

```typescript
import { encode, decode } from 'cwc';

// Save offline state
const appState = { cart: [...], preferences: {...} };
const token = await encode(appState, 'pwa-encryption-key');
await db.put('offline-state', token);

// Restore state
const token = await db.get('offline-state');
const state = await decode(token, 'pwa-encryption-key');
```

## Security Best Practices

### ✅ DO

- **Use strong secrets**: Minimum 32 characters, randomly generated
- **Store secrets securely**: Use environment variables, never hardcode
- **Rotate keys regularly**: Implement key rotation for long-lived tokens
- **Use TTL**: Always set expiration for security-sensitive tokens
- **Validate on decode**: Check expiration and integrity
- **Use HTTPS**: Always transmit tokens over secure connections
- **HttpOnly cookies**: Prevent XSS attacks in browser contexts

### ❌ DON'T

- **Don't reuse secrets**: Use different secrets for different purposes
- **Don't store secrets in code**: Use environment variables or secret managers
- **Don't skip TTL**: Even if tokens are encrypted, add expiration
- **Don't trust client-side timestamps**: Always validate server-side
- **Don't store passwords**: Hash passwords separately, never encrypt them in tokens
- **Don't expose tokens in URLs**: Use POST requests or headers instead

### Secret Management

```typescript
// ✅ Good: Environment variables
const token = await encode(data, process.env.ENCRYPTION_KEY);

// ✅ Good: Different secrets for different purposes
const sessionToken = await encode(data, process.env.SESSION_SECRET);
const resetToken = await encode(data, process.env.RESET_SECRET);

// ❌ Bad: Hardcoded secret
const token = await encode(data, 'my-secret-key');

// ❌ Bad: Same secret everywhere
```

### Key Derivation

For password-based secrets, CWC automatically uses PBKDF2:

```typescript
// String secrets are automatically derived using PBKDF2
const token = await encode(data, 'user-password');

// For direct key control, use Uint8Array (32 bytes)
const key = crypto.getRandomValues(new Uint8Array(32));
const token = await encode(data, key);
```

## API Reference

### Core Functions

#### `encode<T>(data: T, secret: KeyMaterial, options?: EncodeOptions): Promise<string>`

Encodes data into a secure token.

**Parameters:**
- `data`: Any JSON-serializable data
- `secret`: String (PBKDF2-derived) or Uint8Array (32 bytes)
- `options`: Optional encoding configuration

**Returns:** URL-safe base64 token

#### `decode<T>(token: string, secret: KeyMaterial): Promise<T>`

Decodes a token back to original data.

**Parameters:**
- `token`: CWC token string
- `secret`: Must match the encoding secret

**Returns:** Decoded data

**Throws:** Error if token is invalid or secret is wrong

### Metadata Functions

#### `extractMetadata(token: string): TokenMetadata`

Extract metadata without decrypting.

#### `validateToken(token: string): boolean`

Check if token format is valid (doesn't verify secret).

### Key Rotation Functions

#### `rotateKey(token, oldSecret, newSecret, options?): Promise<string>`

Re-encode a token with a new key.

#### `rotateKeys(tokens, oldSecret, newSecret, options?): Promise<string[]>`

Batch rotate multiple tokens.

#### `decodeWithKeyFallback(token, secrets): Promise<{data, keyIndex}>`

Try multiple keys during rotation period.

#### `validateKeyRotation(token, oldSecret, newSecret): Promise<boolean>`

Test if rotation will succeed.

### TTL Functions

#### `isExpired(token: string): boolean`

Check if token has expired.

#### `validateNotExpired(token: string): void`

Throw error if token is expired.

#### `getRemainingTime(token: string): number | null`

Get milliseconds until expiration.

#### `getExpirationTime(token: string): number | null`

Get expiration timestamp.

#### `willExpireSoon(token: string, durationMs: number): boolean`

Check if expires within duration.

#### `getTTLPercentageElapsed(token: string): number | null`

Get percentage of TTL elapsed (0-100).

### Custom Metadata Functions

#### `encodeWithMetadata(data, metadata, secret, options?): Promise<string>`

Encode with custom metadata fields.

#### `decodeWithMetadata(token, secret): Promise<{data, meta}>`

Decode and extract custom metadata.

#### `updateMetadata(token, metadata, secret, options?): Promise<string>`

Update metadata without changing data.

#### `createTypedMetadata(schema): {encode, decode}`

Create type-safe encoder/decoder pair.

### Streaming Functions

#### `encodeStream(data, secret, options?, chunkSize?): Promise<EncodedChunk[]>`

Split data into encrypted chunks.

#### `decodeStream(chunks, secret): Promise<T>`

Reassemble chunks into original data.

#### `shouldStream(data, threshold?): boolean`

Check if data should be streamed.

#### `estimateChunkCount(data, chunkSize?): number`

Estimate number of chunks.

### Auto-Compression Functions

#### `selectCompressionAlgorithm(data, preferCrossPlatform?): CompressionAlgorithm`

Auto-select best compression algorithm.

#### `analyzePayload(json, preferCrossPlatform?): PayloadAnalysis`

Analyze payload characteristics.

#### `compareCompressionAlgorithms(data): Map<CompressionAlgorithm, number>`

Score all compression algorithms.

#### `getBestCompressionAlgorithm(data): CompressionAlgorithm`

Get highest-scoring algorithm.

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Node.js**: 18.0.0+
- **Requires**: Web Crypto API or Node.js crypto module

**Polyfills**: Not required for modern environments.

## Performance

### Benchmarks (approximate)

| Operation | Size | Time |
|-----------|------|------|
| Encode (small) | 100B | ~1ms |
| Encode (medium) | 10KB | ~5ms |
| Encode (large) | 1MB | ~50ms |
| Decode (small) | 100B | ~1ms |
| Decode (medium) | 10KB | ~5ms |
| Decode (large) | 1MB | ~45ms |

### Compression Ratios

| Algorithm | Speed | Ratio | Best For |
|-----------|-------|-------|----------|
| none | ⚡⚡⚡⚡⚡ | 1.0x | Already compressed data |
| lz-string | ⚡⚡⚡⚡ | 2-4x | Small/medium payloads, browser |
| zlib | ⚡⚡⚡ | 3-5x | Medium payloads, Node.js |
| brotli | ⚡⚡ | 4-6x | Large payloads, best compression |

**Recommendation**: Use auto-compression selection for optimal results.

## Examples

See the [examples](./examples/) directory for complete working examples:

- **[browser-localstorage.html](./examples/browser-localstorage.html)** - Secure browser storage
- **[node-server.ts](./examples/node-server.ts)** - Express.js session management
- **[url-tokens.ts](./examples/url-tokens.ts)** - Magic links and password reset
- **[key-rotation.ts](./examples/key-rotation.ts)** - Key rotation strategies

## TypeScript

CWC is written in TypeScript with full type definitions.

```typescript
import type { 
  TokenMetadata, 
  EncodeOptions,
  CompressionAlgorithm,
  KeyMaterial 
} from 'cwc';

// Full type inference
const data: UserData = await decode<UserData>(token, secret);

// Type-safe options
const options: EncodeOptions = {
  compression: 'brotli',
  ttl: 3600
};
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting PRs.

### Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Build
yarn build

# Run demo
node demo.js
```

## License

MIT © 2024

## FAQ

**Q: Is CWC production-ready?**  
A: Yes! CWC has 272 passing tests covering all features and edge cases.

**Q: Can I use CWC in the browser?**  
A: Yes, CWC works in both Node.js and modern browsers via Web Crypto API.

**Q: How is this different from JWT?**  
A: JWTs are signed (integrity) but not encrypted. CWC encrypts data for confidentiality. JWTs are better for public claims, CWC for sensitive data.

**Q: Should I use CWC for passwords?**  
A: No, always hash passwords with bcrypt/argon2. CWC is for encrypted data storage/transmission.

**Q: What's the maximum token size?**  
A: Practical limit is ~1MB for single tokens. Use streaming for larger payloads.

**Q: Can tokens be decoded without the secret?**  
A: No, tokens are encrypted with AES-GCM-256. Only metadata (non-sensitive) can be extracted without decryption.

**Q: How do I migrate from localStorage to CWC?**  
A: Encode existing data with `encode()`, store result. Decode with `decode()` when retrieving.

---

**Made with 🍫 by the CWC team**
