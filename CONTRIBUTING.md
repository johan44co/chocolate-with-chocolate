# Contributing to CWC

Thank you for your interest in contributing to CWC! 🍫

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn (recommended) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/cwc.git
cd cwc

# Install dependencies
yarn install

# Run tests
yarn test

# Build
yarn build
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Changes

- Write your code following the existing style
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass: `yarn test`
- Build successfully: `yarn build`

### 3. Commit

We use conventional commits:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update README"
git commit -m "test: add tests for feature"
git commit -m "chore: update dependencies"
```

### 4. Submit Pull Request

- Push your branch to GitHub
- Create a Pull Request
- Fill out the PR template
- Wait for review

## Code Style

### TypeScript

- Use TypeScript strict mode
- No `any` types
- Explicit return types on functions
- Use `const` over `let`
- Prefer arrow functions for callbacks

```typescript
// ✅ Good
export function encode<T>(data: T, secret: KeyMaterial): Promise<string> {
  const json = JSON.stringify(data);
  // ...
}

// ❌ Bad
export function encode(data: any, secret: any) {
  var json = JSON.stringify(data);
  // ...
}
```

### Documentation

- Add JSDoc comments to all public functions
- Include `@param`, `@returns`, `@throws`
- Provide usage examples

```typescript
/**
 * Encode data into a secure CWC token
 * 
 * @param data - Data to encode
 * @param secret - Encryption secret
 * @param options - Optional encoding configuration
 * @returns URL-safe base64 token
 * 
 * @example
 * ```ts
 * const token = await encode({ userId: 123 }, 'secret');
 * ```
 */
export async function encode<T>(
  data: T,
  secret: KeyMaterial,
  options?: EncodeOptions
): Promise<string> {
  // Implementation
}
```

### Testing

- Write tests for all new features
- Test both success and error cases
- Use descriptive test names
- Aim for high coverage

```typescript
describe('Feature', () => {
  it('should work correctly with valid input', async () => {
    const result = await myFunction(validInput);
    expect(result).toEqual(expectedOutput);
  });

  it('should throw error with invalid input', async () => {
    await expect(myFunction(invalidInput)).rejects.toThrow();
  });
});
```

## Project Structure

```
cwc/
├── src/
│   ├── core/           # Core functionality (crypto, compression)
│   ├── utils/          # Utility functions
│   ├── types.ts        # TypeScript type definitions
│   ├── cwc.ts          # Main API
│   └── index.ts        # Public exports
├── tests/              # Test files
├── examples/           # Usage examples
├── dist/               # Build output
└── docs/               # Additional documentation
```

## What to Contribute

### Bug Fixes

Found a bug? Please:
1. Check if it's already reported in Issues
2. Create a new issue if not
3. Submit a PR with a fix

### New Features

Before implementing a new feature:
1. Open an issue to discuss
2. Wait for approval
3. Implement with tests and docs

### Documentation

- Fix typos
- Improve clarity
- Add examples
- Translate to other languages

### Tests

- Improve test coverage
- Add edge case tests
- Performance tests

## Security

Found a security vulnerability? Please **DO NOT** open a public issue.

Email security@example.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Release Process

(For maintainers only)

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run `yarn build && yarn test`
4. Commit: `git commit -m "chore: release v1.0.0"`
5. Tag: `git tag v1.0.0`
6. Push: `git push && git push --tags`
7. Publish: `yarn publish`

## Questions?

- 💬 Open a Discussion
- 🐛 Report bugs in Issues
- 📧 Email: support@example.com

Thank you for contributing! 🙏
