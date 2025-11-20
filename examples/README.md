# CWC Examples

Practical examples demonstrating how to use CWC in various scenarios.

## 📂 Examples

### 1. [browser-localstorage.html](./browser-localstorage.html)

**Interactive browser demo** showing secure localStorage usage.

**Features:**
- Save encrypted user data to localStorage
- Load and decrypt data
- Inspect raw encrypted tokens
- Real-time encryption/decryption

**How to run:**
```bash
# Open in browser
open browser-localstorage.html
```

**Use cases:**
- Secure client-side storage
- Encrypted user preferences
- Offline PWA state
- Session persistence

---

### 2. [node-server.ts](./node-server.ts)

**Express.js server** with encrypted session management.

**Features:**
- Encrypted cookie-based sessions
- Authentication middleware
- Role-based authorization
- Session refresh
- Automatic expiration

**How to run:**
```bash
# Install dependencies
npm install express cookie-parser

# Run with tsx or ts-node
npx tsx node-server.ts

# Or compile first
tsc node-server.ts && node node-server.js
```

**Endpoints:**
- `POST /login` - Create session
- `GET /profile` - Get user info (authenticated)
- `GET /admin` - Admin only (requires role)
- `POST /logout` - Clear session
- `GET /session/info` - Check session status
- `POST /refresh` - Refresh session TTL

**Use cases:**
- Web application sessions
- API authentication
- Multi-tenant systems
- Microservices authentication

---

### 3. [url-tokens.ts](./url-tokens.ts)

**URL-based tokens** for magic links, password resets, and invitations.

**Features:**
- Password reset tokens (1 hour TTL)
- Magic login links (15 min TTL)
- Team invitations (7 day TTL)
- Email verification tokens (24 hour TTL)

**How to run:**
```bash
npx tsx url-tokens.ts
```

**Token types:**
- **Password Reset**: Short-lived, single-use
- **Magic Links**: No-password authentication
- **Invitations**: Team/org invites
- **Email Verification**: Confirm email ownership

**Use cases:**
- Password recovery flows
- Passwordless authentication
- User onboarding
- Email verification
- Secure share links

---

### 4. [key-rotation.ts](./key-rotation.ts)

**Six key rotation strategies** for maintaining security.

**Strategies:**
1. **Simple Rotation**: Batch re-encode all tokens
2. **Graceful Rotation**: Multi-key support during transition
3. **Time-Based**: Rotate based on token age
4. **Validated**: Test before applying rotation
5. **Progressive**: Batch rotation for large datasets
6. **Versioned**: Track key versions

**How to run:**
```bash
npx tsx key-rotation.ts
```

**Best practices:**
- Rotate keys every 90 days
- Support multiple keys during transition
- Validate before rotating
- Use progressive rotation for scale
- Implement key versioning

**Use cases:**
- Scheduled key rotation
- Security incident response
- Compliance requirements
- Zero-downtime rotation

---

## 🚀 Quick Start

### Install CWC

```bash
npm install chocolate-with-chocolate
# or
yarn add chocolate-with-chocolate
```

### Basic Usage

```typescript
import { encode, decode } from 'chocolate-with-chocolate';

// Encode
const token = await encode({ userId: 123 }, 'secret-key');

// Decode
const data = await decode(token, 'secret-key');
```

## 🔐 Security Checklist

When using these examples in production:

- [ ] Use environment variables for secrets
- [ ] Never hardcode encryption keys
- [ ] Always use HTTPS
- [ ] Set appropriate TTL for tokens
- [ ] Implement key rotation
- [ ] Validate tokens server-side
- [ ] Use httpOnly cookies
- [ ] Handle expiration gracefully
- [ ] Log security events
- [ ] Test in staging first

## 📚 More Resources

- [Main README](../README.md) - Full documentation
- [API Reference](../README.md#api-reference) - Complete API docs
- [Security Best Practices](../README.md#security-best-practices) - Security guide
- [Contributing](../CONTRIBUTING.md) - How to contribute

## 💡 Custom Examples

Want to add your own example? See [CONTRIBUTING.md](../CONTRIBUTING.md)!

---

**Made with 🍫 by the CWC team**
