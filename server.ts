import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { store, User, type FamilyRole } from "./server/store.js";
import { checkDbHealth, initDatabase } from "./server/db.js";
import { createRateLimiter } from "./server/rateLimiter.js";
import { logger } from "./server/logger.js";
import { GoogleGenAI } from "@google/genai";
import { determineKinship } from "./server/kinship.js";
import { processFamilyChat } from "./server/aiChatService.js";

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production";

// Enforce SECRET_KEY in production
if (IS_PROD && !process.env.SECRET_KEY) {
  logger.error("FATAL: SECRET_KEY environment variable is required in production mode.");
  process.exit(1);
}

const SECRET_KEY = process.env.SECRET_KEY || "rootline-dev-session-secret-key-2026";
const COOKIE_NAME = "session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const configuredSameSite = process.env.COOKIE_SAMESITE?.toLowerCase();
const COOKIE_SAMESITE = (configuredSameSite || "lax") as "lax" | "none" | "strict";

if (!["lax", "none", "strict"].includes(COOKIE_SAMESITE)) {
  throw new Error("COOKIE_SAMESITE must be one of: lax, none, strict");
}
if (IS_PROD && COOKIE_SAMESITE === "none" && !process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is required when using SameSite=None in production");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength: number, minLength = 0): value is string {
  return typeof value === "string" && value.trim().length >= minLength && value.length <= maxLength;
}

function isId(value: unknown): value is string {
  return isText(value, 64, 1) && /^[a-zA-Z0-9_-]+$/.test(value);
}

function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== "string" || password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long." };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one letter and one number." };
  }
  return { valid: true };
}

// Simple JWT-like HMAC token without external native dependencies
function createSessionToken(userId: string, passwordVersion: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      pv: passwordVersion,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    })
  ).toString("base64url");
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", SECRET_KEY).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifySessionToken(token: string): { sub: string; pv: number; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(`${header}.${payload}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AuthRequest extends Request {
  user?: User;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const token = cookieToken;

  if (!token) {
    return next();
  }

  const payload = verifySessionToken(token);
  if (!payload || !payload.sub) {
    return next();
  }

  const user = store.findUserById(payload.sub);
  if (!user || !user.is_active || user.password_version !== payload.pv) {
    return next();
  }

  req.user = user;
  next();
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ detail: "Not authenticated" });
  }
  next();
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SAMESITE === "none" || IS_PROD,
    sameSite: COOKIE_SAMESITE,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function createExpressApp() {
  const app = express();
  app.enable("trust proxy");

  function getBaseUrl(req: express.Request): string {
    if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    return `${proto}://${host}`;
  }

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : []),
  ].filter(Boolean) as string[];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || !IS_PROD) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(authMiddleware);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (IS_PROD) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  // Health checks
  app.get("/health", async (req, res) => {
    const database = await checkDbHealth();
    res.status(database.connected ? 200 : 503).json({
      status: database.connected ? "ok" : "degraded",
      database: database.type,
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth routes
  // Rate limiters for defense against brute-force & denial of service (Fixes Issue 32)
  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please try again in 15 minutes.",
  });

  const passwordResetLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Too many password reset requests. Please wait before trying again.",
  });

  const contactLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many contact messages sent. Please try again later.",
  });

  app.post("/auth/register", authLimiter, (req, res) => {
    try {
      const { name, email, password } = isRecord(req.body) ? req.body : {};
      if (!isText(name, 120, 1) || !isText(email, 254, 3) || !isText(password, 128, 1) || !EMAIL_RE.test(email.trim())) {
        return res.status(422).json({ detail: "Name, email, and password are required." });
      }

      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(422).json({ detail: pwdCheck.reason });
      }

      const existing = store.findUserByEmail(email);
      if (existing) {
        return res.status(400).json({ detail: "Unable to create an account with these details" });
      }

      const user = store.createUser(name, email, password);
      const token = createSessionToken(user.id, user.password_version);
      setSessionCookie(res, token);

      return res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_active: user.is_active,
          created_at: user.created_at,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Registration failed" });
    }
  });

  app.post("/auth/login", authLimiter, (req, res) => {
    try {
      const { email, password } = isRecord(req.body) ? req.body : {};
      if (!isText(email, 254, 3) || !isText(password, 128, 1) || !EMAIL_RE.test(email.trim())) {
        return res.status(400).json({ detail: "Incorrect email or password" });
      }

      const user = store.findUserByEmail(email);
      if (!user || !user.hashed_password) {
        return res.status(401).json({ detail: "Incorrect email or password" });
      }

      const valid = bcrypt.compareSync(password, user.hashed_password);
      if (!valid) {
        return res.status(401).json({ detail: "Incorrect email or password" });
      }

      if (!user.is_active) {
        return res.status(403).json({ detail: "This account has been deactivated" });
      }

      const token = createSessionToken(user.id, user.password_version);
      setSessionCookie(res, token);

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_active: user.is_active,
          created_at: user.created_at,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Login failed" });
    }
  });

  app.post("/auth/logout", (req: AuthRequest, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.json({ message: "Logged out successfully" });
  });

  app.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
    const user = req.user!;
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  });

  async function sendPasswordResetEmail(toEmail: string, resetToken: string, req: Request) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USERNAME;
    // Strip all spaces from SMTP_PASSWORD / Google App Password
    const pass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
    const from = process.env.EMAIL_FROM || user || "noreply@rootline.example";
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: toEmail,
      subject: "Reset your Rootline password",
      text: `You requested a password reset for your Rootline account. Please use the following link within 60 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `<p>You requested a password reset for your Rootline account.</p><p><a href="${resetUrl}">Click here to reset your password</a> (valid for 60 minutes).</p><p>Or copy and paste this URL into your browser:</p><p>${resetUrl}</p><p>If you did not request this, you can safely ignore this email.</p>`,
    });
  }

  async function sendFamilyInvitationEmail(params: {
    toEmail: string;
    inviterName: string;
    familyName: string;
    invitationToken: string;
    message?: string | null;
    req: Request;
  }) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USERNAME;
    const pass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
    const from = process.env.EMAIL_FROM || user || "noreply@rootline.example";
    const baseUrl = process.env.FRONTEND_URL || `${params.req.protocol}://${params.req.get("host")}`;
    const inviteUrl = `${baseUrl}/invite/accept?token=${params.invitationToken}`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const customMsg = params.message
      ? `<p style="font-style: italic; color: #4B5563; border-left: 3px solid #1C4B3C; padding-left: 12px; margin: 16px 0;">"${params.message}"</p>`
      : "";

    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: `${params.inviterName} invited you to join their family tree on Rootline`,
      text: `${params.inviterName} has invited you to collaborate on ${params.familyName} on Rootline.\n\n${
        params.message ? `"${params.message}"\n\n` : ""
      }Accept your invitation here:\n${inviteUrl}\n\nThis link will expire in 7 days.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #1C1F1D; background: #F7F5F0; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 28px;">
            <h2 style="color: #1C4B3C; margin: 0; font-size: 20px; letter-spacing: 0.15em; font-weight: 700;">ROOTLINE</h2>
            <p style="color: #6B7280; font-size: 13px; margin-top: 4px;">Family Tree & Genealogy Collaboration</p>
          </div>
          <div style="background: #FFFFFF; padding: 28px; border-radius: 8px; border: 1px solid #E7E2D6; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h3 style="margin-top: 0; color: #111827; font-size: 18px; font-weight: 600;">You're Invited!</h3>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              <strong>${params.inviterName}</strong> has invited you to collaborate on <strong>${params.familyName}</strong> on Rootline.
            </p>
            ${customMsg}
            <div style="margin: 28px 0; text-align: center;">
              <a href="${inviteUrl}" style="background-color: #1C4B3C; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">Accept Invitation</a>
            </div>
            <p style="color: #6B7280; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
              Or copy and paste this link into your browser:<br/>
              <span style="color: #1C4B3C; word-break: break-all;">${inviteUrl}</span>
            </p>
          </div>
          <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 24px;">
            This invitation is valid for 7 days. If you were not expecting this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }

  // Password Reset with Transparent Email Handling (Fixes Issue 3)
  app.post("/auth/forgot-password", passwordResetLimiter, async (req, res) => {
    const { email } = isRecord(req.body) ? req.body : {};
    const isSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USERNAME);

    if (!isText(email, 254, 3) || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ detail: "Email is required" });
    }

    const user = store.findUserByEmail(email);
    let rawToken: string | null = null;
    if (user) {
      rawToken = crypto.randomBytes(32).toString("hex");
      // Invalidate any previous unexpired tokens and store new token (Fixes Issue 12)
      store.createResetToken(user.id, rawToken);
    }

    if (isSmtpConfigured) {
      if (rawToken && user) {
        sendPasswordResetEmail(user.email, rawToken, req).catch((err) => {
          logger.error("Failed to send password reset email:", err);
        });
      }
      return res.json({
        message: "If an account exists for that email, a reset link has been sent.",
        email_sent: true,
      });
    }

    // When SMTP is not configured, do not falsely claim email was sent (Fixes Issue 3)
    // Security hardening: In production, never expose raw reset tokens in API responses or logs
    if (rawToken) {
      if (!IS_PROD) {
        logger.info(`Password reset link generated for ${email}: /reset-password?token=${rawToken}`);
        return res.json({
          message: "Password reset link generated (SMTP not configured on this server; check server logs).",
          reset_url: `/reset-password?token=${rawToken}`,
          email_sent: false,
        });
      } else {
        logger.warn(`Password reset requested for ${email} but SMTP is not configured in production.`);
        return res.json({
          message: "If an account exists for that email, a reset link has been sent.",
          email_sent: false,
        });
      }
    }

    return res.json({
      message: "If an account exists for that email, a reset link has been sent.",
      email_sent: false,
    });
  });

  // Functional Contact Message Submission (Fixes Issue 28)
  app.post("/api/contact", contactLimiter, async (req, res) => {
    const { name, email, subject, message } = isRecord(req.body) ? req.body : {};
    if (!isText(email, 254, 3) || !isText(message, 5000, 1)) {
      return res.status(400).json({ detail: "Email and message are required." });
    }

    if (!EMAIL_RE.test(email.trim()) || (name !== undefined && !isText(name, 120)) || (subject !== undefined && !isText(subject, 200))) {
      return res.status(400).json({ detail: "Please provide a valid email address." });
    }

    logger.info(`Contact Form submission from: ${name || "Anonymous"} <${email}> | Subject: ${subject || "General Inquiry"}`);

    const isSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USERNAME);
    if (isSmtpConfigured) {
      try {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || "587", 10);
        const user = process.env.SMTP_USERNAME;
        const pass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");
        const targetEmail = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || user;

        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });

        await transporter.sendMail({
          from: user,
          to: targetEmail,
          replyTo: email,
          subject: `[Rootline Contact] ${subject || "New Inquiry from " + (name || email)}`,
          text: `Name: ${name || "N/A"}\nEmail: ${email}\nSubject: ${subject || "General Inquiry"}\n\nMessage:\n${message}`,
        });
      } catch (mailErr) {
        logger.error("Contact Mail Error:", mailErr);
      }
    }

    return res.json({
      success: true,
      message: "Thank you for reaching out! Your message has been received.",
    });
  });

  // Atomic Token Consumption (Fixes Issue 11)
  app.post("/auth/reset-password", passwordResetLimiter, (req, res) => {
    const { token, new_password } = isRecord(req.body) ? req.body : {};
    if (!isText(token, 256, 32) || !isText(new_password, 128, 1)) {
      return res.status(400).json({ detail: "This reset link is invalid or has expired" });
    }

    const pwdCheck = validatePasswordStrength(new_password);
    if (!pwdCheck.valid) {
      return res.status(422).json({ detail: pwdCheck.reason });
    }

    // Atomic claim test-and-set prevents concurrent reuse of the same token
    const resetRow = store.claimResetToken(token);
    if (!resetRow) {
      return res.status(400).json({ detail: "This reset link is invalid, expired, or has already been used" });
    }

    const user = store.findUserById(resetRow.user_id);
    if (!user) {
      return res.status(400).json({ detail: "This reset link is invalid or has expired" });
    }

    store.updateUserPassword(user.id, new_password);

    return res.json({ message: "Password updated. You can now log in." });
  });

  // Google OAuth with Browser-Bound Cookie State & HMAC Signature (Fixes Issue 1 & Stateless Multi-Process OAuth)
  app.get("/auth/google/login", (req, res) => {
    const rawState = crypto.randomBytes(32).toString("hex");
    const sig = crypto.createHmac("sha256", SECRET_KEY).update(rawState).digest("hex");
    const cookieValue = `${rawState}.${sig}`;

    res.cookie("oauth_state", cookieValue, {
      httpOnly: true,
      secure: COOKIE_SAMESITE === "none" || IS_PROD,
      sameSite: COOKIE_SAMESITE,
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: "/",
    });

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/google/callback`;

    if (googleClientId) {
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        googleClientId
      )}&response_type=code&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&state=${encodeURIComponent(rawState)}`;
      return res.redirect(googleAuthUrl);
    }

    if (IS_PROD) {
      return res.status(503).json({ detail: "Google OAuth is not configured on this server." });
    }

    // In local development or testing without live Google credentials, route to callback with signed state
    return res.redirect(`/auth/google/callback?state=${rawState}&code=dev_code`);
  });

  app.get("/auth/google/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const oauthCookie = req.cookies?.oauth_state;

    // Verify state is present and bound to this browser's cookie
    if (!state || !oauthCookie) {
      res.clearCookie("oauth_state", { path: "/" });
      return res.status(400).json({
        detail: "OAuth state missing or expired. Login must be initiated from this browser.",
      });
    }

    const [cookieState, cookieSig] = oauthCookie.split(".");
    if (!cookieState || !cookieSig) {
      res.clearCookie("oauth_state", { path: "/" });
      return res.status(400).json({ detail: "Invalid OAuth state format." });
    }

    const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(cookieState).digest("hex");
    if (
      cookieSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieSig), Buffer.from(expectedSig))
    ) {
      res.clearCookie("oauth_state", { path: "/" });
      return res.status(400).json({ detail: "OAuth state signature verification failed." });
    }

    if (cookieState !== state) {
      res.clearCookie("oauth_state", { path: "/" });
      return res.status(400).json({
        detail: "OAuth state mismatch. Potential cross-site login attack detected.",
      });
    }

    res.clearCookie("oauth_state", { path: "/" });

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/google/callback`;

    let profileEmail = "demo@rootline.example";
    let profileName = "Demo User";
    let profileGoogleId = "google-demo-id";
    let emailVerified = true;

    if (googleClientId && googleClientSecret && code && code !== "dev_code") {
      try {
        const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }).toString(),
        });

        if (!tokenResp.ok) {
          const errText = await tokenResp.text();
          logger.error("Google token exchange failed:", errText);
          return res.status(400).json({ detail: "Failed to exchange authorization code with Google." });
        }

        const tokenData = (await tokenResp.json()) as any;
        const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userInfoResp.ok) {
          logger.error("Failed to fetch Google user profile");
          return res.status(400).json({ detail: "Failed to fetch profile information from Google." });
        }

        const profile = (await userInfoResp.json()) as any;

        // Security Hardening: Explicitly verify that the Google email is verified before linking
        emailVerified = Boolean(profile.email_verified === true || profile.verified_email === true);
        if (!emailVerified) {
          logger.warn(`Rejected unverified Google account linking for email: ${profile.email}`);
          return res.status(403).json({
            detail: "Your Google email is not verified. Please verify your email with Google before signing in.",
          });
        }

        profileEmail = profile.email;
        profileName = profile.name || profile.email.split("@")[0];
        profileGoogleId = profile.sub || profile.id;
      } catch (err: any) {
        logger.error("Google OAuth error:", err);
        return res.status(500).json({ detail: "Google authentication failed." });
      }
    } else {
      if (IS_PROD) {
        return res.status(503).json({ detail: "Google OAuth is not configured on this server." });
      }
      // Dev/test mode: link to verified seed user
      const existingUser = store.findUserByEmail("rootline.seed@example.com");
      if (existingUser) {
        profileEmail = existingUser.email;
        profileName = existingUser.name;
        profileGoogleId = "google-dev-seed-id";
      }
    }

    if (!emailVerified) {
      return res.status(403).json({
        detail: "Your Google email is not verified. Please verify your email with Google before signing in.",
      });
    }

    let user = store.findUserByEmail(profileEmail);
    if (!user) {
      user = store.createUser(profileName, profileEmail);
    }
    if (!user.google_id) {
      user.google_id = profileGoogleId;
    }

    const token = createSessionToken(user.id, user.password_version);
    setSessionCookie(res, token);
    // In a split deployment the browser starts on Vercel, while OAuth
    // finishes on Render. Return to the frontend origin instead of the API
    // origin so the user lands in the real application.
    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/+$/, "");
    return res.redirect(`${frontendUrl || `${req.protocol}://${req.get("host")}`}/dashboard`);
  });

  // People endpoints with Multi-Family Collaboration & Activity Tracking
  app.get("/people", requireAuth, (req: AuthRequest, res) => {
    try {
      const familyId = (req.query.family_id as string) || req.user!.id;
      const access = store.checkFamilyAccess(req.user!.id, familyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }

      const fullPhotos = req.query.include_photos === "full";
      const people = store.getPeopleForOwner(familyId, { fullPhoto: fullPhotos });
      return res.json(people);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to list people" });
    }
  });

  // Dedicated Streaming Photo Endpoint (Fixes Issues 5 & 6)
  app.get("/people/:id/photo", requireAuth, (req: AuthRequest, res) => {
    const rawId = req.params.id;
    const personId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!isId(personId)) return res.status(400).send("Invalid person ID");
    const person = store.people.get(personId);
    if (!person || !person.photo_url) {
      return res.status(404).send("Photo not found");
    }
    if (!store.checkFamilyAccess(req.user!.id, person.owner_id)) {
      return res.status(403).send("Access denied");
    }

    if (person.photo_url.startsWith("data:")) {
      const match = person.photo_url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "private, max-age=86400");
        return res.send(buffer);
      }
    }

    if (person.photo_url.startsWith("http")) {
      return res.redirect(person.photo_url);
    }

    return res.status(404).send("Photo format not recognized");
  });

  app.post("/people", requireAuth, (req: AuthRequest, res) => {
    try {
      if (!isRecord(req.body)) return res.status(422).json({ detail: "Invalid person payload" });
      const body = req.body as Record<string, any>;
      const {
        name,
        gender,
        date_of_birth,
        date_of_death,
        place_of_birth,
        occupation,
        bio,
        address,
        phone,
        photo_url,
        relation_type,
        related_to_id,
        family_id: reqFamilyId,
        partner_id,
        family_relationship,
        partner_status,
        new_family,
      } = body;

      if (!isText(name, 120, 1)) {
        return res.status(422).json({ detail: "Name is required" });
      }
      if ((bio !== undefined && !isText(bio, 5000)) || (address !== undefined && !isText(address, 500)) ||
          (phone !== undefined && !isText(phone, 50)) || (photo_url !== undefined && !isText(photo_url, 900000)) ||
          (related_to_id !== undefined && related_to_id !== null && !isId(related_to_id)) ||
          (partner_id !== undefined && partner_id !== null && !isId(partner_id))) {
        return res.status(422).json({ detail: "One or more person fields are invalid or too long" });
      }

      let targetFamilyId = (req.query.family_id as string) || null;
      if (!targetFamilyId && related_to_id) {
        const relatedPerson = store.people.get(related_to_id);
        if (relatedPerson) {
          targetFamilyId = relatedPerson.owner_id;
        }
      }
      if (!targetFamilyId) {
        targetFamilyId = req.user!.id;
      }

      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }
      if (access.role === "viewer") {
        return res.status(403).json({ detail: "Viewers have read-only access and cannot edit this family tree." });
      }

      const person = store.createPerson(
        targetFamilyId,
        {
          name,
          gender,
          date_of_birth,
          date_of_death,
          place_of_birth,
          occupation,
          bio,
          address,
          phone,
          photo_url,
        },
        {
          relation_type,
          related_to_id,
          family_id: reqFamilyId,
          partner_id,
          family_relationship,
          partner_status,
          new_family,
        },
        { id: req.user!.id, name: req.user!.name }
      );

      return res.status(201).json(person);
    } catch (err: any) {
      return res.status(400).json({ detail: err.message || "Failed to create person" });
    }
  });

  app.post("/people/link", requireAuth, (req: AuthRequest, res) => {
    try {
      const { first_person_id, second_person_id, relationship_status } = req.body;
      if (!isId(first_person_id) || !isId(second_person_id) || (relationship_status !== undefined && !isText(relationship_status, 64, 1))) {
        return res.status(400).json({ detail: "Both person IDs are required" });
      }

      const p1 = store.people.get(first_person_id);
      if (!p1) return res.status(404).json({ detail: "Person not found" });

      const targetFamilyId = p1.owner_id;
      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }
      if (access.role === "viewer") {
        return res.status(403).json({ detail: "Viewers have read-only access and cannot edit this family tree." });
      }

      const result = store.linkPeople(
        targetFamilyId,
        first_person_id,
        second_person_id,
        relationship_status,
        { id: req.user!.id, name: req.user!.name }
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ detail: err.message || "Failed to link people" });
    }
  });

  app.get("/people/:id", requireAuth, (req: AuthRequest, res) => {
    const rawId = req.params.id;
    const personId = Array.isArray(rawId) ? rawId[0] : rawId;
    const rawPerson = store.people.get(personId);
    if (!rawPerson) {
      return res.status(404).json({ detail: "Person not found" });
    }

    const access = store.checkFamilyAccess(req.user!.id, rawPerson.owner_id);
    if (!access) {
      return res.status(403).json({ detail: "Access denied to this person." });
    }

    const person = store.getPerson(personId, rawPerson.owner_id);
    if (!person) {
      return res.status(404).json({ detail: "Person not found" });
    }
    return res.json(store.serializePerson(person, { fullPhoto: true }));
  });

  app.patch("/people/:id", requireAuth, (req: AuthRequest, res) => {
    try {
      const rawId = req.params.id;
      const personId = Array.isArray(rawId) ? rawId[0] : rawId;
      const rawPerson = store.people.get(personId);
      if (!rawPerson) {
        return res.status(404).json({ detail: "Person not found" });
      }

      const access = store.checkFamilyAccess(req.user!.id, rawPerson.owner_id);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this person." });
      }
      if (access.role === "viewer") {
        return res.status(403).json({ detail: "Viewers have read-only access and cannot edit this family tree." });
      }
      if (!isRecord(req.body) || Object.keys(req.body).length === 0 ||
          (req.body.name !== undefined && !isText(req.body.name, 120, 1)) ||
          (req.body.bio !== undefined && !isText(req.body.bio, 5000)) ||
          (req.body.address !== undefined && !isText(req.body.address, 500)) ||
          (req.body.phone !== undefined && !isText(req.body.phone, 50)) ||
          (req.body.photo_url !== undefined && !isText(req.body.photo_url, 900000))) {
        return res.status(422).json({ detail: "Invalid or oversized person update" });
      }

      const updated = store.updatePerson(personId, rawPerson.owner_id, req.body, {
        id: req.user!.id,
        name: req.user!.name,
      });
      return res.json(updated);
    } catch (err: any) {
      const status = err.message === "Person not found" ? 404 : 400;
      return res.status(status).json({ detail: err.message || "Failed to update person" });
    }
  });

  app.delete("/people/:id", requireAuth, (req: AuthRequest, res) => {
    try {
      const rawId = req.params.id;
      const personId = Array.isArray(rawId) ? rawId[0] : rawId;
      const rawPerson = store.people.get(personId);
      if (!rawPerson) {
        return res.status(404).json({ detail: "Person not found" });
      }

      const access = store.checkFamilyAccess(req.user!.id, rawPerson.owner_id);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this person." });
      }
      if (access.role === "viewer") {
        return res.status(403).json({ detail: "Viewers have read-only access and cannot edit this family tree." });
      }

      const result = store.deletePerson(personId, rawPerson.owner_id, {
        id: req.user!.id,
        name: req.user!.name,
      });
      return res.json(result);
    } catch (err: any) {
      const status = err.message === "Person not found" ? 404 : 400;
      return res.status(status).json({ detail: err.message || "Failed to delete person" });
    }
  });

  // =========================================================================
  // Phase 1: Family Invitation & Collaboration Endpoints
  // =========================================================================

  // =========================================================================
  // Tree Sharing & Access Control API (Viewer & Editor Permissions)
  // =========================================================================

  app.get("/api/family/current", requireAuth, (req: AuthRequest, res) => {
    try {
      const requestedId = (req.query.family_id as string) || req.user!.id;
      const userTrees = store.getUserTrees(req.user!.id);

      let currentFamily = userTrees.owned.family;
      let currentRole: FamilyRole = userTrees.owned.role;
      let treeOwner = { id: req.user!.id, name: req.user!.name, email: req.user!.email };

      if (requestedId !== userTrees.owned.family.id) {
        const sharedMatch = userTrees.shared.find((s) => s.family.id === requestedId);
        if (sharedMatch) {
          currentFamily = sharedMatch.family;
          currentRole = sharedMatch.role;
          treeOwner = sharedMatch.owner;
        }
      }

      return res.json({
        family: currentFamily,
        role: currentRole,
        owner: treeOwner,
        availableFamilies: [
          { family: userTrees.owned.family, role: userTrees.owned.role },
          ...userTrees.shared.map((s) => ({ family: s.family, role: s.role })),
        ],
        trees: userTrees,
      });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to get family information" });
    }
  });

  const handleGetMyTrees = (req: AuthRequest, res: any) => {
    try {
      const trees = store.getUserTrees(req.user!.id);
      return res.json(trees);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to get user trees" });
    }
  };

  app.get("/api/families/my-trees", requireAuth, handleGetMyTrees);
  app.get("/families/my-trees", requireAuth, handleGetMyTrees);
  app.get("/api/family/my-trees", requireAuth, handleGetMyTrees);

  const handleGetShares = (req: AuthRequest, res: any) => {
    try {
      const rawFamilyId = req.params.id;
      const familyId = Array.isArray(rawFamilyId) ? rawFamilyId[0] : rawFamilyId;

      const access = store.checkFamilyAccess(req.user!.id, familyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }

      const sharesData = store.getFamilyShares(req.user!.id, familyId);
      return res.json(sharesData);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to get tree shares" });
    }
  };

  app.get("/api/families/:id/shares", requireAuth, handleGetShares);
  app.get("/families/:id/shares", requireAuth, handleGetShares);

  const handleAddShare = (req: AuthRequest, res: any) => {
    try {
      const rawFamilyId = req.params.id;
      const familyId = Array.isArray(rawFamilyId) ? rawFamilyId[0] : rawFamilyId;
      const { email, permission = "viewer" } = isRecord(req.body) ? req.body : {};

      if (!isText(email, 254, 3) || !EMAIL_RE.test(email.trim()) || (permission !== "viewer" && permission !== "editor")) {
        return res.status(400).json({ detail: "Email is required" });
      }

      if (!store.isFamilyOwner(req.user!.id, familyId)) {
        return res.status(403).json({ detail: "Only the tree owner can share this family tree." });
      }

      const result = store.createOrUpdateTreeShare({
        ownerId: req.user!.id,
        familyId,
        email,
        permission,
      });

      return res.status(201).json({
        message: `Successfully shared tree with ${result.recipient.name} as ${result.share.permission}.`,
        share: result.share,
        recipient: result.recipient,
      });
    } catch (err: any) {
      const status = err.message.includes("does not have a Rootline account")
        ? 404
        : err.message.includes("owner")
        ? 403
        : 400;
      return res.status(status).json({ detail: err.message || "Failed to share tree" });
    }
  };

  app.post("/api/families/:id/shares", requireAuth, handleAddShare);
  app.post("/families/:id/shares", requireAuth, handleAddShare);

  const handleUpdateShare = (req: AuthRequest, res: any) => {
    try {
      const rawFamilyId = req.params.id;
      const familyId = Array.isArray(rawFamilyId) ? rawFamilyId[0] : rawFamilyId;
      const rawShareId = req.params.shareId;
      const shareId = Array.isArray(rawShareId) ? rawShareId[0] : rawShareId;
      const { permission } = isRecord(req.body) ? req.body : {};

      if (permission !== "viewer" && permission !== "editor") {
        return res.status(400).json({ detail: "Permission ('viewer' | 'editor') is required" });
      }

      if (!store.isFamilyOwner(req.user!.id, familyId)) {
        return res.status(403).json({ detail: "Only the tree owner can change share permissions." });
      }

      const updated = store.updateTreeShare(req.user!.id, familyId, shareId, permission);
      return res.json({
        message: "Share permission updated successfully.",
        share: updated,
      });
    } catch (err: any) {
      const status = err.message.includes("owner") ? 403 : 400;
      return res.status(status).json({ detail: err.message || "Failed to update share permission" });
    }
  };

  app.patch("/api/families/:id/shares/:shareId", requireAuth, handleUpdateShare);
  app.patch("/families/:id/shares/:shareId", requireAuth, handleUpdateShare);

  const handleDeleteShare = (req: AuthRequest, res: any) => {
    try {
      const rawFamilyId = req.params.id;
      const familyId = Array.isArray(rawFamilyId) ? rawFamilyId[0] : rawFamilyId;
      const rawShareId = req.params.shareId;
      const shareId = Array.isArray(rawShareId) ? rawShareId[0] : rawShareId;

      if (!store.isFamilyOwner(req.user!.id, familyId)) {
        return res.status(403).json({ detail: "Only the tree owner can remove access to this tree." });
      }

      store.deleteTreeShare(req.user!.id, familyId, shareId);
      return res.json({ message: "Access removed successfully." });
    } catch (err: any) {
      const status = err.message.includes("owner") ? 403 : 400;
      return res.status(status).json({ detail: err.message || "Failed to remove share access" });
    }
  };

  app.delete("/api/families/:id/shares/:shareId", requireAuth, handleDeleteShare);
  app.delete("/families/:id/shares/:shareId", requireAuth, handleDeleteShare);

  // =========================================================================
  // Phase 2: Change History / Family Activity Log Endpoints
  // =========================================================================

  app.get("/api/family/history", requireAuth, (req: AuthRequest, res) => {
    try {
      const familyId = (req.query.family_id as string) || req.user!.id;
      const access = store.checkFamilyAccess(req.user!.id, familyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family history." });
      }

      const category = (req.query.category as string) || "all";
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 30;

      const history = store.getActivityHistory(familyId, { category, page, limit });
      return res.json(history);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to get activity history" });
    }
  });

  // =========================================================================
  // Phase 3: Family Statistics Dashboard Endpoint
  // =========================================================================

  app.get("/api/family/statistics", requireAuth, (req: AuthRequest, res) => {
    try {
      const familyId = (req.query.family_id as string) || req.user!.id;
      const access = store.checkFamilyAccess(req.user!.id, familyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family statistics." });
      }

      const stats = store.calculateFamilyStatistics(familyId);
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to calculate family statistics" });
    }
  });

  // =========================================================================
  // Phase 6: "How Are We Related?" with AI Kinship Explanation
  // =========================================================================

  app.post("/api/ai/relationship-explain", requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const person1_id = body.person1_id || body.person_a_id;
      const person2_id = body.person2_id || body.person_b_id;
      const question = body.question;
      const targetFamilyId = body.family_id || req.user!.id;

      if (!isId(person1_id) || !isId(person2_id) || !isId(targetFamilyId) || (question !== undefined && !isText(question, 2000))) {
        return res.status(422).json({ detail: "Invalid relationship request." });
      }

      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }

      if (!person1_id || !person2_id) {
        return res.status(400).json({ detail: "Both person IDs are required." });
      }

      const people = store.getPeopleForOwner(targetFamilyId);
      const peopleMap = new Map(people.map((p) => [p.id, p]));
      const p1 = peopleMap.get(person1_id);
      const p2 = peopleMap.get(person2_id);

      if (!p1 || !p2) {
        return res.status(404).json({ detail: "One or both selected family members were not found." });
      }

      const kinship = determineKinship(person1_id, person2_id, people);

      // Build rich path details with disambiguating dates
      const buildPersonDisambiguation = (person: any) => {
        const dates = [person.date_of_birth ? `b. ${person.date_of_birth}` : null, person.date_of_death ? `d. ${person.date_of_death}` : null]
          .filter(Boolean)
          .join(" – ");
        return dates ? `${person.name} (${dates})` : person.name;
      };

      if (!kinship) {
        const noPathExplanation = `No direct ancestral, descendant, or marital link was found between ${buildPersonDisambiguation(
          p1
        )} and ${buildPersonDisambiguation(p2)} in the current family records.`;

        const noPathResult = {
          related: false,
          title: "No Direct Path Recorded",
          path: [],
          steps: [],
          generationDiff: 0,
          commonAncestors: [],
          explanation: noPathExplanation,
          kinship: {
            related: false,
            title: "No Direct Path Recorded",
            path: [],
            steps: [],
            generationDiff: 0,
            commonAncestors: [],
          },
        };
        return res.json(noPathResult);
      }

      const detailedPath = (kinship.path || []).map((id) => {
        const p = peopleMap.get(id);
        const dob = p?.date_of_birth || "";
        const dod = p?.date_of_death || "";
        return {
          id,
          name: p?.name || id,
          date_of_birth: dob,
          date_of_death: dod,
          gender: p?.gender || "",
          photo_url: p?.photo_url || "",
          label: dob || dod ? `${p?.name || id} (${[dob ? `b. ${dob}` : "", dod ? `d. ${dod}` : ""].filter(Boolean).join(" - ")})` : p?.name || id,
        };
      });

      let aiExplanation = kinship.explanation;
      const genAI = getGenAI();

      if (genAI) {
        try {
          const p1Desc = buildPersonDisambiguation(p1);
          const p2Desc = buildPersonDisambiguation(p2);
          const disambiguatedChain = detailedPath.map((node) => node.label).join(" → ");

          const prompt = `You are Rootline's genealogy storyteller.
Explain the relationship between two family members concisely and warmly in 2 to 3 natural sentences based STRICTLY on these verified facts.
CRITICAL CONSTRAINT: You must NEVER invent, assume, or alter any kinship ties. If individuals have the same name, use their birth/death years to clearly distinguish who is who so the user is never confused.
- Person 1: ${p1Desc}
- Person 2: ${p2Desc}
- Verified Relationship Title: ${kinship.title}
- Exact Chain of Connection: ${disambiguatedChain}
- Generational Difference: ${kinship.generationDiff} (${
            kinship.generationDiff === 0
              ? "same generation"
              : kinship.generationDiff > 0
              ? `${kinship.generationDiff} generation(s) down`
              : `${Math.abs(kinship.generationDiff)} generation(s) up`
          })
${kinship.commonAncestors.length ? `- Shared Ancestor(s): ${kinship.commonAncestors.join(", ")}` : ""}
${question ? `- Specific User Question: "${question}"` : ""}

Respond with a warm, conversational 2-3 sentence explanation. Do not use Markdown titles, bullet points, or disclaimers.`;

          const response = await genAI.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
          });

          if (response.text && response.text.trim().length > 0) {
            aiExplanation = response.text.trim();
          }
        } catch (aiErr: any) {
          logger.warn("Gemini API call failed, falling back to deterministic explanation:", aiErr);
        }
      }

      const responsePayload = {
        related: kinship.related,
        title: kinship.title,
        path: detailedPath,
        raw_path_ids: kinship.path,
        steps: kinship.steps,
        generationDiff: kinship.generationDiff,
        commonAncestors: kinship.commonAncestors,
        explanation: aiExplanation,
        is_ai_enhanced: !!genAI,
        kinship: {
          related: kinship.related,
          title: kinship.title,
          path: detailedPath,
          raw_path_ids: kinship.path,
          steps: kinship.steps,
          generationDiff: kinship.generationDiff,
          commonAncestors: kinship.commonAncestors,
        },
      };

      return res.json(responsePayload);
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to explain relationship" });
    }
  });

  // =========================================================================
  // Family & Kinship AI Chatbot (Gemini + Groq Dual-Provider with Isolation)
  // =========================================================================

  // Send message to Family AI Chatbot
  app.post("/api/ai/chat", requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const rawMessage = body.message;
      const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
      const targetFamilyId = body.family_id || req.user!.id;
      const preferredProvider = body.preferred_provider || "auto";
      const person1Id = body.person1_id || body.person_a_id || null;
      const person2Id = body.person2_id || body.person_b_id || null;

      if (!isText(message, 4000, 1) || !isId(targetFamilyId) || !["auto", "gemini", "groq"].includes(String(preferredProvider)) ||
          (person1Id !== null && !isId(person1Id)) || (person2Id !== null && !isId(person2Id))) {
        return res.status(400).json({ detail: "Message text is required." });
      }
      const safeProvider = preferredProvider as "auto" | "gemini" | "groq";
      const safePerson1Id = person1Id as string | null;
      const safePerson2Id = person2Id as string | null;

      // Strict family access check
      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied: You do not have permission to view or query this family tree." });
      }

      // Retrieve previous chat history for isolation
      const existingHistory = store.getChatHistory(req.user!.id, targetFamilyId);
      const historyContext = existingHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Record user's message in persistent isolated thread
      store.addChatMessage(req.user!.id, targetFamilyId, {
        role: "user",
        content: message,
      });

      // Process query with dual-provider engine and family tree context
      const chatResponse = await processFamilyChat({
        message,
        history: historyContext,
        familyId: targetFamilyId,
        userId: req.user!.id,
        preferredProvider: safeProvider,
        person1Id: safePerson1Id,
        person2Id: safePerson2Id,
      });

      // Record assistant's response in persistent isolated thread
      const savedAssistantMessage = store.addChatMessage(req.user!.id, targetFamilyId, {
        role: "assistant",
        content: chatResponse.message,
        provider: chatResponse.provider,
        model: chatResponse.model,
        failoverOccurred: chatResponse.failoverOccurred,
        failoverDetails: chatResponse.failoverDetails,
      });

      return res.json({
        message: savedAssistantMessage,
        provider: chatResponse.provider,
        model: chatResponse.model,
        failoverOccurred: chatResponse.failoverOccurred,
        failoverDetails: chatResponse.failoverDetails,
        detectedKinship: chatResponse.detectedKinship,
        familySummary: chatResponse.familySummary,
      });
    } catch (err: any) {
      logger.error("Error in Family AI Chat endpoint:", err);
      return res.status(500).json({ detail: err.message || "Failed to process chat message." });
    }
  });

  // Get isolated chat history for a family
  app.get("/api/ai/chat/history", requireAuth, (req: AuthRequest, res) => {
    try {
      const targetFamilyId = (req.query.family_id as string) || req.user!.id;
      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }

      const history = store.getChatHistory(req.user!.id, targetFamilyId);
      return res.json({ messages: history });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to retrieve chat history" });
    }
  });

  // Clear chat history for a family
  app.delete("/api/ai/chat/history", requireAuth, (req: AuthRequest, res) => {
    try {
      const targetFamilyId = (req.query.family_id as string) || (req.body?.family_id as string) || req.user!.id;
      const access = store.checkFamilyAccess(req.user!.id, targetFamilyId);
      if (!access) {
        return res.status(403).json({ detail: "Access denied to this family tree." });
      }

      store.clearChatHistory(req.user!.id, targetFamilyId);
      return res.json({ ok: true, message: "Chat history cleared successfully." });
    } catch (err: any) {
      return res.status(500).json({ detail: err.message || "Failed to clear chat history" });
    }
  });

  return app;
}

async function startServer() {
  // Initialize PostgreSQL database & schema if configured
  try {
    const dbConnected = await initDatabase();
    if (dbConnected) {
      await store.initFromDatabase();
      logger.info("Database loaded and synchronized successfully.");
    } else if (IS_PROD) {
      throw new Error("DATABASE_URL must be configured and reachable in production.");
    } else {
      logger.info("Operating in in-memory mode (no DATABASE_URL or Postgres connection).");
    }
  } catch (dbErr) {
    logger.error("Failed to initialize database:", dbErr);
  }

  const app = await createExpressApp();

  // Vite middleware in dev; static file serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Rootline server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start the server when run directly
if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    logger.error("Failed to start server:", err);
    process.exit(1);
  });
}
