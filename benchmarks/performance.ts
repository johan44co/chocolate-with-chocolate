import { encode, decode } from "../src/index.js";
import { performance } from "node:perf_hooks";
import type { CompressionAlgorithm } from "../src/types.js";

interface BenchmarkResult {
  operation: string;
  payloadSize: number;
  compression: CompressionAlgorithm;
  iterations: number;
  avgTimeMs: number;
  opsPerSecond: number;
  tokenSize?: number;
  compressionRatio?: number;
}

/**
 * Generate test data of specified size
 */
function generateTestData(size: number): Record<string, unknown> {
  const textSize = Math.floor(size * 0.7);
  const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
    .repeat(Math.ceil(textSize / 57))
    .substring(0, textSize);

  const arraySize = Math.floor((size * 0.3) / 20);
  const array = Array(arraySize)
    .fill(0)
    .map((_, i) => ({ id: i, value: `item-${i}` }));

  return {
    text,
    items: array,
    timestamp: Date.now(),
    metadata: { type: "benchmark", version: "1.0" },
  };
}

/**
 * Measure performance of encode operation
 */
async function benchmarkEncode(
  payloadSize: number,
  compression: CompressionAlgorithm,
  iterations: number
): Promise<BenchmarkResult> {
  const data = generateTestData(payloadSize);
  const secret = "benchmark-secret-key-12345";

  // Warmup
  await encode(data, secret, { compression });

  const start = performance.now();
  let lastToken = "";

  for (let i = 0; i < iterations; i++) {
    lastToken = await encode(data, secret, { compression });
  }

  const end = performance.now();
  const totalTimeMs = end - start;
  const avgTimeMs = totalTimeMs / iterations;
  const opsPerSecond = 1000 / avgTimeMs;

  const jsonSize = JSON.stringify(data).length;
  const tokenSize = lastToken.length;
  const compressionRatio = jsonSize / tokenSize;

  return {
    operation: "encode",
    payloadSize,
    compression,
    iterations,
    avgTimeMs,
    opsPerSecond,
    tokenSize,
    compressionRatio,
  };
}

/**
 * Measure performance of decode operation
 */
async function benchmarkDecode(
  payloadSize: number,
  compression: CompressionAlgorithm,
  iterations: number
): Promise<BenchmarkResult> {
  const data = generateTestData(payloadSize);
  const secret = "benchmark-secret-key-12345";

  // Create token once
  const token = await encode(data, secret, { compression });

  // Warmup
  await decode(token, secret);

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await decode(token, secret);
  }

  const end = performance.now();
  const totalTimeMs = end - start;
  const avgTimeMs = totalTimeMs / iterations;
  const opsPerSecond = 1000 / avgTimeMs;

  return {
    operation: "decode",
    payloadSize,
    compression,
    iterations,
    avgTimeMs,
    opsPerSecond,
    tokenSize: token.length,
  };
}

/**
 * Measure round-trip performance
 */
async function benchmarkRoundTrip(
  payloadSize: number,
  compression: CompressionAlgorithm,
  iterations: number
): Promise<BenchmarkResult> {
  const data = generateTestData(payloadSize);
  const secret = "benchmark-secret-key-12345";

  // Warmup
  const token = await encode(data, secret, { compression });
  await decode(token, secret);

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const t = await encode(data, secret, { compression });
    await decode(t, secret);
  }

  const end = performance.now();
  const totalTimeMs = end - start;
  const avgTimeMs = totalTimeMs / iterations;
  const opsPerSecond = 1000 / avgTimeMs;

  return {
    operation: "round-trip",
    payloadSize,
    compression,
    iterations,
    avgTimeMs,
    opsPerSecond,
  };
}

/**
 * Format result for display
 */
function formatResult(result: BenchmarkResult): string {
  const parts = [
    `${result.operation.padEnd(12)}`,
    `${(result.payloadSize / 1024).toFixed(1)}KB`.padEnd(8),
    `${result.compression.padEnd(10)}`,
    `${result.avgTimeMs.toFixed(3)}ms`.padEnd(12),
    `${result.opsPerSecond.toFixed(0)} ops/s`.padEnd(15),
  ];

  if (result.tokenSize) {
    parts.push(`token: ${(result.tokenSize / 1024).toFixed(1)}KB`.padEnd(15));
  }

  if (result.compressionRatio) {
    parts.push(`ratio: ${result.compressionRatio.toFixed(2)}x`);
  }

  return parts.join(" | ");
}

/**
 * Run comprehensive benchmark suite
 */
async function runBenchmarks() {
  console.log("\n🎯 CWC Performance Benchmarks\n");
  console.log("=".repeat(120));
  console.log(
    "Operation    | Size    | Compression | Avg Time    | Throughput     | Token Size     | Ratio"
  );
  console.log("=".repeat(120));

  const sizes = [1024, 10 * 1024, 100 * 1024, 1024 * 1024]; // 1KB, 10KB, 100KB, 1MB
  const compressions: CompressionAlgorithm[] = ["brotli", "lz-string", "none"];
  const results: BenchmarkResult[] = [];

  for (const size of sizes) {
    // Adjust iterations based on payload size
    const iterations = size <= 10 * 1024 ? 100 : size <= 100 * 1024 ? 50 : 10;

    for (const compression of compressions) {
      // Encode benchmark
      const encodeResult = await benchmarkEncode(size, compression, iterations);
      console.log(formatResult(encodeResult));
      results.push(encodeResult);

      // Decode benchmark
      const decodeResult = await benchmarkDecode(size, compression, iterations);
      console.log(formatResult(decodeResult));
      results.push(decodeResult);

      // Round-trip benchmark
      const roundTripResult = await benchmarkRoundTrip(size, compression, iterations);
      console.log(formatResult(roundTripResult));
      results.push(roundTripResult);

      console.log("-".repeat(120));
    }
  }

  console.log("\n📊 Summary Statistics\n");

  // Best compression ratios
  const encodeResults = results.filter((r) => r.operation === "encode" && r.compressionRatio);
  const bestCompression = encodeResults.reduce((best, curr) =>
    (curr.compressionRatio || 0) > (best.compressionRatio || 0) ? curr : best
  );

  console.log(
    `Best Compression: ${bestCompression.compression} at ${(bestCompression.compressionRatio || 0).toFixed(2)}x (${(bestCompression.payloadSize / 1024).toFixed(0)}KB payload)`
  );

  // Fastest operations
  const fastestEncode = results
    .filter((r) => r.operation === "encode")
    .reduce((fastest, curr) => (curr.avgTimeMs < fastest.avgTimeMs ? curr : fastest));

  const fastestDecode = results
    .filter((r) => r.operation === "decode")
    .reduce((fastest, curr) => (curr.avgTimeMs < fastest.avgTimeMs ? curr : fastest));

  console.log(
    `Fastest Encode: ${fastestEncode.avgTimeMs.toFixed(3)}ms (${(fastestEncode.payloadSize / 1024).toFixed(0)}KB, ${fastestEncode.compression})`
  );
  console.log(
    `Fastest Decode: ${fastestDecode.avgTimeMs.toFixed(3)}ms (${(fastestDecode.payloadSize / 1024).toFixed(0)}KB, ${fastestDecode.compression})`
  );

  // Throughput analysis
  const highThroughput = results
    .filter((r) => r.payloadSize === 1024)
    .reduce((best, curr) => (curr.opsPerSecond > best.opsPerSecond ? curr : best));

  console.log(
    `Highest Throughput: ${highThroughput.opsPerSecond.toFixed(0)} ops/s (${highThroughput.operation}, ${highThroughput.compression})`
  );

  console.log("\n✅ Benchmarks complete!\n");

  return results;
}

// Run benchmarks
runBenchmarks().catch(console.error);
