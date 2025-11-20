/**
 * URL Tokens Example - Magic Links & Password Reset
 *
 * This example shows how to create secure, time-limited tokens for:
 * - Password reset links
 * - Email verification links
 * - Magic login links
 * - Invitation tokens
 */

import { encode, decode, isExpired, validateNotExpired, extractMetadata } from "cwc";

// IMPORTANT: Use environment variables in production!
const RESET_SECRET = process.env.RESET_SECRET || "password-reset-secret";
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || "magic-link-secret";
const INVITE_SECRET = process.env.INVITE_SECRET || "invite-secret";

// ============================================================================
// Password Reset Tokens
// ============================================================================

/**
 * Generate a password reset token
 */
export async function generatePasswordResetToken(userId: number, email: string): Promise<string> {
  const resetData = {
    userId,
    email,
    purpose: "password-reset",
    createdAt: Date.now(),
  };

  // Create token with 1-hour expiration
  const token = await encode(resetData, RESET_SECRET, {
    compression: "lz-string",
    includeTimestamp: true,
    ttl: 3600, // 1 hour
  });

  return token;
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(token: string) {
  try {
    // Check expiration first (fast)
    validateNotExpired(token);

    // Decode and validate
    const data = await decode<{
      userId: number;
      email: string;
      purpose: string;
      createdAt: number;
    }>(token, RESET_SECRET);

    // Additional validation
    if (data.purpose !== "password-reset") {
      throw new Error("Invalid token purpose");
    }

    return {
      valid: true,
      userId: data.userId,
      email: data.email,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid token",
    };
  }
}

/**
 * Example usage: Password reset flow
 */
async function passwordResetExample() {
  console.log("📧 Password Reset Example\n");

  // User requests password reset
  const userId = 123;
  const email = "user@example.com";

  const token = await generatePasswordResetToken(userId, email);
  const resetLink = `https://example.com/reset-password?token=${encodeURIComponent(token)}`;

  console.log("1. Generated reset link:");
  console.log(`   ${resetLink}`);
  console.log(`   Token length: ${token.length} characters\n`);

  // Later: User clicks the link
  const urlParams = new URLSearchParams(resetLink.split("?")[1]);
  const receivedToken = urlParams.get("token") || "";

  console.log("2. User clicked link, verifying token...");
  const verification = await verifyPasswordResetToken(receivedToken);

  if (verification.valid) {
    console.log("   ✅ Token valid!");
    console.log(`   User ID: ${verification.userId}`);
    console.log(`   Email: ${verification.email}`);
    console.log("   → Allow password reset\n");
  } else {
    console.log("   ❌ Token invalid!");
    console.log(`   Error: ${verification.error}\n`);
  }
}

// ============================================================================
// Magic Login Links
// ============================================================================

/**
 * Generate a magic login link token
 */
export async function generateMagicLinkToken(email: string, returnUrl?: string): Promise<string> {
  const linkData = {
    email,
    purpose: "magic-login",
    returnUrl: returnUrl || "/",
    createdAt: Date.now(),
  };

  // Create token with 15-minute expiration (short-lived)
  const token = await encode(linkData, MAGIC_LINK_SECRET, {
    compression: "lz-string",
    includeTimestamp: true,
    ttl: 900, // 15 minutes
  });

  return token;
}

/**
 * Verify a magic login token
 */
export async function verifyMagicLinkToken(token: string) {
  try {
    validateNotExpired(token);

    const data = await decode<{
      email: string;
      purpose: string;
      returnUrl: string;
      createdAt: number;
    }>(token, MAGIC_LINK_SECRET);

    if (data.purpose !== "magic-login") {
      throw new Error("Invalid token purpose");
    }

    return {
      valid: true,
      email: data.email,
      returnUrl: data.returnUrl,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid token",
    };
  }
}

/**
 * Example usage: Magic link login
 */
async function magicLinkExample() {
  console.log("✨ Magic Link Example\n");

  const email = "user@example.com";
  const returnUrl = "/dashboard";

  const token = await generateMagicLinkToken(email, returnUrl);
  const magicLink = `https://example.com/auth/magic?token=${encodeURIComponent(token)}`;

  console.log("1. Generated magic link:");
  console.log(`   ${magicLink}`);
  console.log(`   Expires in: 15 minutes\n`);

  // Check expiration status
  const metadata = extractMetadata(token);
  console.log("2. Token metadata:");
  console.log(`   Created: ${new Date(metadata.timestamp!).toISOString()}`);
  console.log(`   TTL: ${metadata.ttl} seconds`);
  console.log(`   Expired: ${isExpired(token) ? "Yes" : "No"}\n`);

  // Verify the token
  const verification = await verifyMagicLinkToken(token);

  if (verification.valid) {
    console.log("3. ✅ Magic link valid!");
    console.log(`   Email: ${verification.email}`);
    console.log(`   Redirect to: ${verification.returnUrl}\n`);
  }
}

// ============================================================================
// Invitation Tokens
// ============================================================================

/**
 * Generate an invitation token
 */
export async function generateInviteToken(
  invitedBy: number,
  invitedEmail: string,
  role: string,
  organizationId: number
): Promise<string> {
  const inviteData = {
    invitedBy,
    invitedEmail,
    role,
    organizationId,
    purpose: "invite",
    createdAt: Date.now(),
  };

  // Create token with 7-day expiration
  const token = await encode(inviteData, INVITE_SECRET, {
    compression: "lz-string",
    includeTimestamp: true,
    ttl: 604800, // 7 days
  });

  return token;
}

/**
 * Verify an invitation token
 */
export async function verifyInviteToken(token: string) {
  try {
    validateNotExpired(token);

    const data = await decode<{
      invitedBy: number;
      invitedEmail: string;
      role: string;
      organizationId: number;
      purpose: string;
      createdAt: number;
    }>(token, INVITE_SECRET);

    if (data.purpose !== "invite") {
      throw new Error("Invalid token purpose");
    }

    return {
      valid: true,
      ...data,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid token",
    };
  }
}

/**
 * Example usage: Team invitation
 */
async function inviteExample() {
  console.log("👥 Invitation Token Example\n");

  const invitedBy = 1;
  const invitedEmail = "newuser@example.com";
  const role = "developer";
  const organizationId = 42;

  const token = await generateInviteToken(invitedBy, invitedEmail, role, organizationId);

  const inviteLink = `https://example.com/join?token=${encodeURIComponent(token)}`;

  console.log("1. Generated invite link:");
  console.log(`   ${inviteLink}`);
  console.log(`   Valid for: 7 days\n`);

  const verification = await verifyInviteToken(token);

  if (verification.valid) {
    console.log("2. ✅ Invitation valid!");
    console.log(`   Invited: ${verification.invitedEmail}`);
    console.log(`   Role: ${verification.role}`);
    console.log(`   Organization: ${verification.organizationId}\n`);
  }
}

// ============================================================================
// Email Verification Tokens
// ============================================================================

/**
 * Generate an email verification token
 */
export async function generateEmailVerificationToken(
  userId: number,
  email: string
): Promise<string> {
  const verificationData = {
    userId,
    email,
    purpose: "email-verification",
    createdAt: Date.now(),
  };

  // Create token with 24-hour expiration
  const token = await encode(verificationData, RESET_SECRET, {
    compression: "lz-string",
    includeTimestamp: true,
    ttl: 86400, // 24 hours
  });

  return token;
}

/**
 * Verify an email verification token
 */
export async function verifyEmailVerificationToken(token: string) {
  try {
    validateNotExpired(token);

    const data = await decode<{
      userId: number;
      email: string;
      purpose: string;
      createdAt: number;
    }>(token, RESET_SECRET);

    if (data.purpose !== "email-verification") {
      throw new Error("Invalid token purpose");
    }

    return {
      valid: true,
      userId: data.userId,
      email: data.email,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid token",
    };
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  await passwordResetExample();
  console.log("─".repeat(60) + "\n");
  await magicLinkExample();
  console.log("─".repeat(60) + "\n");
  await inviteExample();
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}
