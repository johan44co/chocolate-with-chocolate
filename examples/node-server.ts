/**
 * Node.js Server Example - Express Session Management with CWC
 *
 * This example shows how to use CWC for secure, encrypted session management
 * in an Express.js application.
 */

import express from "express";
import cookieParser from "cookie-parser";
import { encode, decode, isExpired, validateNotExpired } from "chocolate-with-chocolate";

const app = express();
const PORT = 3000;

// IMPORTANT: In production, use environment variables!
const SESSION_SECRET = process.env.SESSION_SECRET || "your-super-secret-key-change-this";

// Middleware
app.use(express.json());
app.use(cookieParser());

// ============================================================================
// Session Management Middleware
// ============================================================================

/**
 * Create an encrypted session token
 */
async function createSession(userId: number, email: string, role: string) {
  const sessionData = {
    userId,
    email,
    role,
    createdAt: Date.now(),
  };

  // Encode with 24-hour TTL
  const token = await encode(sessionData, SESSION_SECRET, {
    compression: "lz-string", // Good for small session data
    includeTimestamp: true,
    ttl: 86400, // 24 hours in seconds
  });

  return token;
}

/**
 * Verify and decode session token
 */
async function verifySession(token: string) {
  try {
    // Check expiration first (fast, no decryption)
    validateNotExpired(token);

    // Decode session data
    const sessionData = await decode<{
      userId: number;
      email: string;
      role: string;
      createdAt: number;
    }>(token, SESSION_SECRET);

    return sessionData;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid session: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Authentication middleware
 */
async function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies.session;

  if (!token) {
    return res.status(401).json({ error: "No session token" });
  }

  try {
    const sessionData = await verifySession(token);
    // Attach session to request
    (req as any).session = sessionData;
    next();
  } catch (error) {
    res.clearCookie("session");
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Invalid session",
    });
  }
}

/**
 * Role-based authorization middleware
 */
function requireRole(role: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = (req as any).session;

    if (session.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /login - Create encrypted session
 */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Simulate user authentication (replace with real DB check)
  if (email === "admin@example.com" && password === "admin") {
    const token = await createSession(1, email, "admin");

    res.cookie("session", token, {
      httpOnly: true, // Prevent XSS
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      maxAge: 86400000, // 24 hours
      sameSite: "strict",
    });

    return res.json({
      message: "Logged in successfully",
      sessionLength: token.length,
    });
  }

  if (email === "user@example.com" && password === "user") {
    const token = await createSession(2, email, "user");

    res.cookie("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
      sameSite: "strict",
    });

    return res.json({
      message: "Logged in successfully",
      sessionLength: token.length,
    });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

/**
 * GET /profile - Get current user (requires auth)
 */
app.get("/profile", authenticate, (req, res) => {
  const session = (req as any).session;
  res.json({
    userId: session.userId,
    email: session.email,
    role: session.role,
    sessionAge: Date.now() - session.createdAt,
  });
});

/**
 * GET /admin - Admin only route
 */
app.get("/admin", authenticate, requireRole("admin"), (req, res) => {
  res.json({ message: "Welcome to admin panel" });
});

/**
 * POST /logout - Clear session
 */
app.post("/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ message: "Logged out successfully" });
});

/**
 * GET /session/info - Get session info without authentication
 */
app.get("/session/info", async (req, res) => {
  const token = req.cookies.session;

  if (!token) {
    return res.json({ hasSession: false });
  }

  try {
    // Check if expired
    const expired = isExpired(token);

    if (expired) {
      res.clearCookie("session");
      return res.json({
        hasSession: false,
        expired: true,
      });
    }

    const session = await verifySession(token);
    const age = Date.now() - session.createdAt;
    const ageHours = Math.floor(age / (1000 * 60 * 60));
    const ageMinutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

    res.json({
      hasSession: true,
      expired: false,
      email: session.email,
      role: session.role,
      age: `${ageHours}h ${ageMinutes}m`,
      tokenSize: token.length,
    });
  } catch (error) {
    res.clearCookie("session");
    res.json({
      hasSession: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`🍫 CWC Session Example Server`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("");
  console.log("📚 Try these requests:");
  console.log("");
  console.log("# Login as admin");
  console.log(`curl -X POST http://localhost:${PORT}/login \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"email":"admin@example.com","password":"admin"}\' \\');
  console.log("  -c cookies.txt");
  console.log("");
  console.log("# Get profile (authenticated)");
  console.log(`curl http://localhost:${PORT}/profile -b cookies.txt`);
  console.log("");
  console.log("# Access admin route");
  console.log(`curl http://localhost:${PORT}/admin -b cookies.txt`);
  console.log("");
  console.log("# Get session info");
  console.log(`curl http://localhost:${PORT}/session/info -b cookies.txt`);
  console.log("");
  console.log("# Logout");
  console.log(`curl -X POST http://localhost:${PORT}/logout -b cookies.txt`);
  console.log("");
});

// ============================================================================
// Advanced: Session Refresh
// ============================================================================

/**
 * POST /refresh - Refresh session (extend TTL)
 */
app.post("/refresh", authenticate, async (req, res) => {
  const session = (req as any).session;

  // Create new token with fresh TTL
  const newToken = await createSession(session.userId, session.email, session.role);

  res.cookie("session", newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400000,
    sameSite: "strict",
  });

  res.json({ message: "Session refreshed" });
});

// ============================================================================
// Export for testing
// ============================================================================

export { app, createSession, verifySession };
