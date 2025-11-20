/**
 * Key Rotation Strategies Example
 *
 * This example demonstrates various key rotation strategies for maintaining
 * security while preserving access to existing tokens.
 */

import {
  encode,
  decode,
  rotateKey,
  rotateKeys,
  decodeWithKeyFallback,
  validateKeyRotation,
  getRotationAge,
  extractMetadata,
} from "chocolate-with-chocolate";

// ============================================================================
// Strategy 1: Simple Key Rotation
// ============================================================================

/**
 * Basic key rotation: re-encode all tokens with new key
 */
async function simpleRotationExample() {
  console.log("🔄 Strategy 1: Simple Key Rotation\n");

  const oldKey = "old-encryption-key-2023";
  const newKey = "new-encryption-key-2024";

  // Existing tokens in database
  const tokens = [
    await encode({ userId: 1, name: "Alice" }, oldKey),
    await encode({ userId: 2, name: "Bob" }, oldKey),
    await encode({ userId: 3, name: "Charlie" }, oldKey),
  ];

  console.log(`1. Current tokens (${tokens.length}):`, {
    length0: tokens[0]?.length,
    length1: tokens[1]?.length,
    length2: tokens[2]?.length,
  });

  // Rotate all tokens in batch
  console.log("\n2. Rotating all tokens to new key...");
  const newTokens = await rotateKeys(tokens, oldKey, newKey);

  console.log(`   ✅ Rotated ${newTokens.length} tokens`);

  // Verify new tokens
  const data0 = await decode(newTokens[0]!, newKey);
  const data1 = await decode(newTokens[1]!, newKey);

  console.log("\n3. Verified new tokens:");
  console.log(`   Token 0:`, data0);
  console.log(`   Token 1:`, data1);

  // Old tokens no longer work with new key
  try {
    await decode(tokens[0]!, newKey);
  } catch {
    console.log("\n4. ✅ Old tokens cannot be decoded with new key (as expected)\n");
  }
}

// ============================================================================
// Strategy 2: Graceful Key Rotation (Multi-Key Support)
// ============================================================================

/**
 * Graceful rotation: Support multiple keys during transition period
 */
async function gracefulRotationExample() {
  console.log("🔄 Strategy 2: Graceful Key Rotation (Multi-Key)\n");

  const oldKey = "key-v1";
  const newKey = "key-v2";

  // Simulate mixed environment: some tokens still use old key
  const oldToken1 = await encode({ userId: 1, data: "old" }, oldKey);
  const oldToken2 = await encode({ userId: 2, data: "old" }, oldKey);
  const newToken1 = await encode({ userId: 3, data: "new" }, newKey);
  const newToken2 = await encode({ userId: 4, data: "new" }, newKey);

  console.log("1. Mixed token environment:");
  console.log("   - 2 tokens with old key");
  console.log("   - 2 tokens with new key");

  // During transition: support both keys
  const keys = [newKey, oldKey]; // Try new key first for performance

  console.log("\n2. Decoding tokens with fallback...");

  const result1 = await decodeWithKeyFallback(oldToken1, keys);
  console.log(`   Old token 1: decoded with key ${result1.keyIndex} (${keys[result1.keyIndex]})`);

  const result2 = await decodeWithKeyFallback(newToken1, keys);
  console.log(`   New token 1: decoded with key ${result2.keyIndex} (${keys[result2.keyIndex]})`);

  // Gradually rotate old tokens as they're accessed
  console.log("\n3. Rotate-on-access strategy:");
  console.log("   If decoded with old key → rotate to new key");

  if (result1.keyIndex > 0) {
    console.log(`   Token used old key, rotating...`);
    const rotatedToken = await rotateKey(oldToken1, oldKey, newKey);
    console.log(`   ✅ Rotated token: ${rotatedToken.substring(0, 20)}...`);
  }

  console.log("\n4. After transition period:");
  console.log("   - Remove old key from fallback list");
  console.log("   - Only new key supported\n");
}

// ============================================================================
// Strategy 3: Time-Based Key Rotation
// ============================================================================

/**
 * Time-based rotation: Rotate keys based on token age
 */
async function timeBasedRotationExample() {
  console.log("🔄 Strategy 3: Time-Based Key Rotation\n");

  const currentKey = "current-key";
  const newKey = "rotated-key";

  // Create token with timestamp
  const token = await encode({ userId: 123, sessionId: "abc" }, currentKey, {
    includeTimestamp: true,
  });

  console.log("1. Token created with timestamp");

  // Check token age
  const age = getRotationAge(token);
  const ageHours = age / (1000 * 60 * 60);

  console.log(`   Age: ${age}ms (${ageHours.toFixed(2)} hours)`);

  // Rotation policy: rotate tokens older than 30 days
  const ROTATION_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  console.log("\n2. Rotation policy: 30 days");

  if (age > ROTATION_THRESHOLD) {
    console.log("   ⚠️  Token exceeds rotation threshold");
    console.log("   → Rotating to new key...");

    const rotatedToken = await rotateKey(token, currentKey, newKey);
    console.log(`   ✅ Rotated: ${rotatedToken.substring(0, 30)}...`);
  } else {
    const daysUntilRotation = (ROTATION_THRESHOLD - age) / (1000 * 60 * 60 * 24);
    console.log(`   ✅ Token is fresh (${daysUntilRotation.toFixed(0)} days until rotation)`);
  }

  console.log();
}

// ============================================================================
// Strategy 4: Validated Key Rotation
// ============================================================================

/**
 * Validated rotation: Test rotation before applying
 */
async function validatedRotationExample() {
  console.log("🔄 Strategy 4: Validated Key Rotation\n");

  const oldKey = "production-key-2023";
  const newKey = "production-key-2024";

  const tokens = [
    await encode({ id: 1 }, oldKey),
    await encode({ id: 2 }, oldKey),
    await encode({ id: 3 }, oldKey),
  ];

  console.log("1. Validating rotation before applying...");

  // Validate each token can be rotated
  const validationResults = await Promise.all(
    tokens.map((token) => validateKeyRotation(token, oldKey, newKey))
  );

  const allValid = validationResults.every((valid) => valid);

  console.log(`   Tokens validated: ${validationResults.length}`);
  console.log(`   All valid: ${allValid ? "✅ Yes" : "❌ No"}`);

  if (allValid) {
    console.log("\n2. ✅ Validation passed, proceeding with rotation...");
    const rotatedTokens = await rotateKeys(tokens, oldKey, newKey);
    console.log(`   Successfully rotated ${rotatedTokens.length} tokens\n`);
  } else {
    console.log("\n2. ❌ Validation failed, aborting rotation\n");
  }
}

// ============================================================================
// Strategy 5: Progressive Key Rotation
// ============================================================================

/**
 * Progressive rotation: Rotate in batches to avoid overload
 */
async function progressiveRotationExample() {
  console.log("🔄 Strategy 5: Progressive Key Rotation (Batched)\n");

  const oldKey = "legacy-key";
  const newKey = "current-key";

  // Simulate large number of tokens
  const totalTokens = 50;
  const batchSize = 10;

  console.log(`1. Rotating ${totalTokens} tokens in batches of ${batchSize}`);

  // Generate tokens
  const allTokens = await Promise.all(
    Array.from({ length: totalTokens }, (_, i) => encode({ id: i }, oldKey))
  );

  // Rotate in batches
  const batches = Math.ceil(totalTokens / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, totalTokens);
    const batch = allTokens.slice(start, end);

    console.log(`\n   Batch ${i + 1}/${batches}: Rotating tokens ${start}-${end - 1}...`);

    const rotatedBatch = await rotateKeys(batch, oldKey, newKey);

    console.log(`   ✅ Completed (${rotatedBatch.length} tokens)`);

    // In production: save to database, add delay to prevent overload
    // await delay(1000);
  }

  console.log(`\n2. ✅ Progressive rotation complete (${totalTokens} tokens)\n`);
}

// ============================================================================
// Strategy 6: Key Version Management
// ============================================================================

/**
 * Key versioning: Track which key was used for each token
 */
async function keyVersioningExample() {
  console.log("🔄 Strategy 6: Key Version Management\n");

  // Key registry
  const keyRegistry = {
    v1: "key-version-1-retired",
    v2: "key-version-2-current",
    v3: "key-version-3-future",
  };

  const currentVersion = "v2";

  // Create token with version in metadata
  const token = await encode({ userId: 123 }, keyRegistry[currentVersion]!, {
    includeTimestamp: true,
  });

  console.log("1. Token created with key version:", currentVersion);

  // In a real app, store version alongside token in DB
  // Example: { token, keyVersion: 'v2' }

  console.log("\n2. Decoding with version-aware fallback:");

  // Try keys in order: current, previous, legacy
  const keyPriority = [
    keyRegistry.v2, // Current
    keyRegistry.v1, // Legacy support
  ];

  const result = await decodeWithKeyFallback(token, keyPriority as string[]);
  console.log(`   Decoded with key index: ${result.keyIndex}`);
  console.log(`   Data:`, result.data);

  console.log("\n3. Key lifecycle:");
  console.log("   v1: Retired (only for decoding old tokens)");
  console.log("   v2: Current (for all new tokens)");
  console.log("   v3: Staged (for future rotation)\n");
}

// ============================================================================
// Best Practices Summary
// ============================================================================

function printBestPractices() {
  console.log("📚 Key Rotation Best Practices\n");
  console.log("✅ DO:");
  console.log("   • Rotate keys regularly (e.g., every 90 days)");
  console.log("   • Support multiple keys during transition");
  console.log("   • Validate rotation before applying");
  console.log("   • Use timestamps to track token age");
  console.log("   • Implement progressive rotation for large datasets");
  console.log("   • Log rotation events for audit trail");
  console.log("   • Test rotation in staging first");
  console.log("");
  console.log("❌ DON'T:");
  console.log("   • Rotate all keys simultaneously without testing");
  console.log("   • Delete old keys immediately after rotation");
  console.log("   • Forget to update key in all services");
  console.log("   • Ignore rotation failures");
  console.log("   • Use predictable key generation");
  console.log("");
  console.log("🔐 Security Notes:");
  console.log("   • Store keys in secure vault (not code)");
  console.log("   • Use different keys for different purposes");
  console.log("   • Implement key access controls");
  console.log("   • Monitor for suspicious rotation activity");
  console.log("   • Have emergency rotation procedure");
  console.log("");
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  await simpleRotationExample();
  console.log("═".repeat(60) + "\n");

  await gracefulRotationExample();
  console.log("═".repeat(60) + "\n");

  await timeBasedRotationExample();
  console.log("═".repeat(60) + "\n");

  await validatedRotationExample();
  console.log("═".repeat(60) + "\n");

  await progressiveRotationExample();
  console.log("═".repeat(60) + "\n");

  await keyVersioningExample();
  console.log("═".repeat(60) + "\n");

  printBestPractices();
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  simpleRotationExample,
  gracefulRotationExample,
  timeBasedRotationExample,
  validatedRotationExample,
  progressiveRotationExample,
  keyVersioningExample,
};
