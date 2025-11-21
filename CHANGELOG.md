# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-11-21

### ✨ Features

- **Browser Example**: Replace simulated crypto functions with actual CWC library import
  - Now uses import map to load CWC from local build
  - Includes LZ-String compression via CDN
  - Demonstrates real encode/decode with TTL and metadata
  - Tokens now compatible with CWC library (previously incompatible)
  - Added explanatory comments about import map and compression choices

### 📝 Documentation

- **README**: Fix test count badge (272 → 346 tests)
- **README**: Clarify compression fallback behavior (Brotli → LZ-String in browsers)
- **README**: Update compression table to show browser-specific limitations
- **README**: Update FAQ with correct test count
- **CONTRIBUTING**: Update contact email

### 🔧 Improvements

- Browser example now demonstrates actual library usage instead of simplified implementation
- Better documentation of cross-platform compression behavior
- Clearer guidance on using import maps for browser deployments

## [1.0.1] - 2025-11-20

### 🐛 Bug Fixes

- Fix `decodeWithMetadata` export conflict - resolve naming collision between cwc.js and customMetadata.js versions
- Improve browser test type definitions and assertions
- Fix lz-string dynamic import for browser module loading
- Improve Node.js 18 compatibility with crypto module typing
- Fix browser test timeouts for CI environments
- Enhance error handling in crypto operations

### 🧪 Tests

- Add comprehensive streaming utility edge case tests
- Add empty chunks handling in streaming tests
- Improve browser test coverage and type safety
- Add randomBytes tests for Node.js 18 compatibility

### ⚡ Performance

- Optimize CI/browser tests with browser caching
- Single browser instance in tests, increased worker threads
- Increase Playwright test timeouts for stability

### 📝 Documentation

- Fix package name references (cwc → chocolate-with-chocolate)
- Update repository references in CONTRIBUTING.md

### 🔧 Maintenance

- Remove NODE_AUTH_TOKEN from npm publish step
- Improve test reliability and consistency

## [1.0.0] - 2025-11-20

### 🎉 Initial Release

The first stable release of Chocolate With Chocolate (CWC) - a secure, compressed, encrypted token format for web applications.

### ✨ Features

#### Core Functionality
- **Secure Encryption**: AES-GCM-256 authenticated encryption
- **Compression**: Multiple algorithms (Brotli, LZ-String, Zlib, None)
- **Cross-Platform**: Works in Node.js 18+ and all modern browsers
- **Dual Package**: ESM and CommonJS support
- **TypeScript**: Full type definitions included
- **Zero Dependencies**: No runtime dependencies

#### Advanced Features
- **Key Rotation**: Seamless key rotation with fallback support
- **TTL Validation**: Token expiration with time-to-live
- **Custom Metadata**: Application-specific metadata fields
- **Streaming Support**: Handle large payloads via chunking
- **Auto-Compression**: Intelligent compression algorithm selection

#### Security Features
- Cryptographically secure random IVs (never reused)
- PBKDF2 key derivation with 100,000 iterations
- Authentication tags prevent tampering
- Timing attack resistant
- No plaintext leakage in tokens
- Comprehensive security audit with 24 tests

### 📦 Package Details

- **Bundle Size**: 
  - ESM: 5.85KB gzipped (37.38KB raw)
  - CJS: 5.79KB gzipped (39.41KB raw)
  - Total: 11.64KB gzipped
- **Test Coverage**: 79.94% statements, 313 tests passing
- **Browser Support**: Chrome, Firefox, Safari (latest)
- **Node.js Support**: 18.x, 20.x, 22.x

### 🔧 API

#### Core API
```typescript
import { encode, decode } from 'chocolate-with-chocolate';

const token = await encode(data, secret);
const data = await decode(token, secret);
```

#### Key Rotation
```typescript
import { rotateKey, decodeWithKeyFallback } from 'chocolate-with-chocolate';

const newToken = await rotateKey(oldToken, oldSecret, newSecret);
const data = await decodeWithKeyFallback(token, [key1, key2, key3]);
```

#### TTL Validation
```typescript
import { isExpired, validateNotExpired, getRemainingTime } from 'chocolate-with-chocolate';

const expired = isExpired(token);
validateNotExpired(token); // throws if expired
const ms = getRemainingTime(token);
```

#### Custom Metadata
```typescript
import { encodeWithMetadata, decodeWithMetadata } from 'chocolate-with-chocolate';

const token = await encodeWithMetadata(data, secret, { userId: '123' });
const { data, metadata } = await decodeWithMetadata(token, secret);
```

#### Streaming
```typescript
import { encodeStream, decodeStream } from 'chocolate-with-chocolate';

const chunks = await encodeStream(largeData, secret, { chunkSize: 10240 });
const data = await decodeStream(chunks, secret);
```

### 📚 Documentation

- Comprehensive README with examples
- Full API documentation with JSDoc
- 4 complete usage examples
- Security best practices guide
- Contributing guidelines

### 🧪 Testing

- 313 tests passing across 12 test suites
- Browser compatibility tests (Playwright)
- Security audit with 24 dedicated tests
- Performance benchmarks
- GitHub Actions CI/CD

### 🎯 Use Cases

- Secure localStorage/sessionStorage
- Encrypted cookies
- URL tokens (magic links, password reset)
- Compressed data sharing
- Offline PWA state
- Client state hydration
- Encrypted user drafts/settings

### 🙏 Credits

Built with a focus on security, performance, and developer experience.

---

## [Unreleased]

### Planned
- CLI tool for encode/decode operations
- Browser extension for debugging tokens
- Framework integrations (React, Vue, Express)
- Deno and Bun support
- WebAssembly optimization

---

[1.0.0]: https://github.com/johan44co/chocolate-with-chocolate/releases/tag/v1.0.0
