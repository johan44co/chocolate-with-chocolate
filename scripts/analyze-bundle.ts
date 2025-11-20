#!/usr/bin/env node
/**
 * Bundle Size Analysis Tool
 * Analyzes minified + gzipped bundle sizes and tracks against targets
 */

import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { minify } from "terser";
import { resolve } from "node:path";

interface SizeReport {
  file: string;
  raw: number;
  minified: number;
  gzipped: number;
  brotli?: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Analyze bundle size
 */
async function analyzeBundle(filePath: string): Promise<SizeReport> {
  const fullPath = resolve(filePath);
  const code = readFileSync(fullPath, "utf-8");

  // Raw size
  const rawSize = statSync(fullPath).size;

  // Minify
  const minified = await minify(code, {
    compress: {
      passes: 2,
      dead_code: true,
      drop_console: false,
      drop_debugger: true,
      pure_funcs: ["console.log"],
    },
    mangle: true,
    module: true,
    format: {
      comments: false,
    },
  });

  const minifiedCode = minified.code || code;
  const minifiedSize = Buffer.byteLength(minifiedCode, "utf-8");

  // Gzip
  const gzipped = gzipSync(minifiedCode, { level: 9 });
  const gzippedSize = gzipped.length;

  return {
    file: filePath,
    raw: rawSize,
    minified: minifiedSize,
    gzipped: gzippedSize,
  };
}

/**
 * Check if size meets target
 */
function checkTarget(size: number, target: number): { pass: boolean; percentage: number } {
  const percentage = (size / target) * 100;
  return {
    pass: size <= target,
    percentage,
  };
}

/**
 * Main analysis
 */
async function main() {
  console.log("\n📦 CWC Bundle Size Analysis\n");
  console.log("=".repeat(80));

  const targets = [
    { file: "dist/index.js", target: 50 * 1024, description: "ESM Bundle" },
    { file: "dist/index.cjs", target: 50 * 1024, description: "CJS Bundle" },
  ];

  const reports: SizeReport[] = [];
  let allPassed = true;

  for (const { file, target, description } of targets) {
    try {
      const report = await analyzeBundle(file);
      reports.push(report);

      console.log(`\n${description} (${file}):`);
      console.log(`  Raw Size:      ${formatBytes(report.raw).padStart(10)}`);
      console.log(
        `  Minified:      ${formatBytes(report.minified).padStart(10)} (${((report.minified / report.raw) * 100).toFixed(1)}% of raw)`
      );
      console.log(
        `  Gzipped:       ${formatBytes(report.gzipped).padStart(10)} (${((report.gzipped / report.raw) * 100).toFixed(1)}% of raw)`
      );

      const check = checkTarget(report.gzipped, target);
      const status = check.pass ? "✅ PASS" : "❌ FAIL";
      const targetStr = formatBytes(target);

      console.log(`  Target:        ${targetStr.padStart(10)}`);
      console.log(`  Status:        ${status} (${check.percentage.toFixed(1)}% of target)`);

      if (!check.pass) {
        allPassed = false;
        const excess = report.gzipped - target;
        console.log(`  Excess:        ${formatBytes(excess)} over target`);
      }
    } catch (error) {
      console.error(`\n❌ Error analyzing ${file}:`, (error as Error).message);
      allPassed = false;
    }
  }

  console.log("\n" + "=".repeat(80));

  // Summary
  if (reports.length > 0) {
    const totalGzipped = reports.reduce((sum, r) => sum + r.gzipped, 0);
    const totalRaw = reports.reduce((sum, r) => sum + r.raw, 0);
    const compressionRatio = ((1 - totalGzipped / totalRaw) * 100).toFixed(1);

    console.log("\n📊 Summary:");
    console.log(`  Total Raw:       ${formatBytes(totalRaw)}`);
    console.log(`  Total Gzipped:   ${formatBytes(totalGzipped)}`);
    console.log(`  Compression:     ${compressionRatio}% reduction`);
  }

  console.log("\n🎯 Size Targets:");
  console.log("  Target: <50KB per bundle (minified + gzipped)");
  console.log("  Goal: Keep library lightweight and fast to load");

  if (allPassed) {
    console.log("\n✅ All bundles meet size targets!\n");
    process.exit(0);
  } else {
    console.log("\n❌ Some bundles exceed size targets\n");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
