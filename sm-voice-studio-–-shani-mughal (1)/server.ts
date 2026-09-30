/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Applet Config
let firebaseConfig: any = {};
try {
  const cfgRaw = fs.readFileSync(path.resolve(__dirname, "firebase-applet-config.json"), "utf8");
  firebaseConfig = JSON.parse(cfgRaw);
} catch (e) {
  console.warn("Could not read firebase-applet-config.json:", e);
}

// Initialize Firebase Admin SDK using Server Credentials
let adminApp: App;
if (!getApps().length) {
  // Support explicit service account JSON key via environment variable,
  // or fall back to Google Cloud Application Default Credentials (ADC)
  const serviceAccountKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (serviceAccountKey) {
    try {
      const creds = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        credential: cert(creds),
        projectId: firebaseConfig.projectId || creds.project_id,
      });
      console.log("Firebase Admin initialized with provided service account credentials.");
    } catch (e) {
      console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON, falling back to ADC:", e);
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  } else {
    adminApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized with Application Default Credentials (ADC).");
  }
} else {
  adminApp = getApps()[0];
}

// Initialize Firestore Admin with the custom database ID from config
const adminDb = firebaseConfig.firestoreDatabaseId
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(adminApp);

adminDb.settings({ ignoreUndefinedProperties: true });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON parsing with 50MB payload limit (needed for audio transcription uploads)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server Secret for signing session unlock tokens
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "sm-voice-studio-session-secret-" +
    (process.env.APP_PASSCODE || "shani-mughal-secret-2026");

// Verified Admin email configured in secrets (defaults to chromebook160nb@gmail.com)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "chromebook160nb@gmail.com").trim().toLowerCase();

// Token creation (30 days validity)
function createSessionToken(expiresInDays = 30): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      unlocked: true,
      exp: Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// Token validation
function verifySessionToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.unlocked) return false;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return false; // token expired
    }
    return true;
  } catch {
    return false;
  }
}

// Rate limiting & lockout tracking for failed unlock attempts
interface RateLimitRecord {
  failedAttempts: number;
  lockUntil: number;
}
const ipRateLimits = new Map<string, RateLimitRecord>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown-ip";
}

// Clean up stale rate limits every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRateLimits.entries()) {
    if (record.lockUntil < now && record.failedAttempts === 0) {
      ipRateLimits.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// Helper: Verify Firebase Auth ID token (dual-layer: admin SDK + identitytoolkit)
async function verifyFirebaseToken(
  req: express.Request
): Promise<{ uid: string; email?: string; email_verified?: boolean } | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) return null;

  // 1. Try Firebase Admin verifyIdToken
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded?.uid) {
      return {
        uid: decoded.uid,
        email: decoded.email,
        email_verified: Boolean(decoded.email_verified),
      };
    }
  } catch (adminAuthErr) {
    // 2. Fallback: Verify via Firebase identitytoolkit lookup REST API
    try {
      if (firebaseConfig.apiKey) {
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: token }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const user = data.users?.[0];
          if (user?.localId) {
            return {
              uid: user.localId,
              email: user.email,
              email_verified: Boolean(user.emailVerified),
            };
          }
        }
      }
    } catch (lookupErr) {
      console.warn("Identity lookup verification warning:", lookupErr);
    }
  }
  return null;
}

// Helper: Check admin authorization (verified ADMIN_EMAIL or studio passcode)
function checkIsAdmin(
  req: express.Request,
  authUser: { uid: string; email?: string; email_verified?: boolean } | null
): boolean {
  const passcode = req.headers["x-admin-passcode"] || req.body?.adminPasscode;
  const defaultPasscode = "Shani Mughal From Sargodha";
  const cleanPasscode = typeof passcode === "string" ? passcode.trim().toLowerCase() : "";
  const isPasscodeValid =
    cleanPasscode === defaultPasscode.toLowerCase() ||
    (process.env.APP_PASSCODE && cleanPasscode === process.env.APP_PASSCODE.toLowerCase());
  if (isPasscodeValid) return true;

  if (
    authUser?.email &&
    authUser.email.toLowerCase() === ADMIN_EMAIL &&
    authUser.email_verified === true
  ) {
    return true;
  }
  return false;
}

interface ServerUserProfile {
  email: string;
  plan: string;
  charactersUsed: number;
  planWordsUsed: number;
  freeLimit: number;
  planExpiresAt: string | null;
}

// Word count helper
function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// Fetch user profile using firebase-admin SDK with server credentials
async function fetchUserProfile(uid: string, userEmail: string = ""): Promise<ServerUserProfile> {
  try {
    const userRef = adminDb.collection("users").doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
      const data = snap.data();
      let expiresAt: string | null = null;
      if (data?.planExpiresAt) {
        if (typeof data.planExpiresAt === "string") {
          expiresAt = data.planExpiresAt;
        } else if (typeof data.planExpiresAt?.toDate === "function") {
          expiresAt = data.planExpiresAt.toDate().toISOString();
        } else {
          expiresAt = new Date(data.planExpiresAt).toISOString();
        }
      }

      return {
        email: data?.email || userEmail || "",
        plan: data?.plan || "free",
        charactersUsed: Number(data?.charactersUsed) || 0,
        planWordsUsed: Number(data?.planWordsUsed) || 0,
        freeLimit: Number(data?.freeLimit) || 10000,
        planExpiresAt: expiresAt,
      };
    }

    // Initialize initial document with free plan if not exists
    const initialDoc = {
      email: userEmail || "",
      plan: "free",
      charactersUsed: 0,
      planWordsUsed: 0,
      freeLimit: 10000,
      planExpiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    await userRef.set(initialDoc, { merge: true });
    return {
      email: userEmail || "",
      plan: "free",
      charactersUsed: 0,
      planWordsUsed: 0,
      freeLimit: 10000,
      planExpiresAt: null,
    };
  } catch (err) {
    console.warn("fetchUserProfile error via Admin SDK:", err);
    return {
      email: userEmail || "",
      plan: "free",
      charactersUsed: 0,
      planWordsUsed: 0,
      freeLimit: 10000,
      planExpiresAt: null,
    };
  }
}

// Pricing and payment methods in-memory fallback
let currentPricing = {
  freeLimit: 10000,
  threedayUSD: 1,
  threedayDurationDays: 3,
  threedayUsageCapWords: 100000,
  monthlyUSD: 2,
  monthlyDurationDays: 30,
  quarterlyUSD: 5,
  quarterlyDurationDays: 90,
  lifetimeUSD: 10,
  exchangeRatePKR: 280,
};

let currentPaymentMethods = [
  {
    id: "jazzcash",
    name: "JazzCash",
    accountNumber: "03494519013",
    accountTitle: "Zeeshan Akbar",
    instructions: "Send via JazzCash mobile app or retail agent to 03494519013",
    enabled: true,
    badgeColor: "#d92027",
  },
  {
    id: "easypaisa",
    name: "Easypaisa",
    accountNumber: "03144248857",
    accountTitle: "Zeeshan Akbar",
    instructions: "Send via Easypaisa mobile app to 03144248857",
    enabled: true,
    badgeColor: "#00a859",
  },
  {
    id: "nayapay",
    name: "NayaPay",
    accountNumber: "03144248857",
    accountTitle: "Zeeshan Akbar",
    instructions: "Send via NayaPay app or Raast ID to 03144248857",
    enabled: true,
    badgeColor: "#f37021",
  },
];

// In-memory set to prevent duplicate Transaction IDs (TIDs)
const processedTransactionIds = new Set<string>();

// Pre-seeded fallback licenses
interface ServerLicense {
  id: string;
  key: string;
  plan: "threeday" | "monthly" | "quarterly" | "lifetime";
  status: "unused" | "active" | "revoked";
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

const localLicenses = new Map<string, ServerLicense>([
  [
    "SM-3DAY-PASS-2026",
    {
      id: "lic-3day-01",
      key: "SM-3DAY-PASS-2026",
      plan: "threeday",
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "SM-LIFETIME-PRO-2026",
    {
      id: "lic-lifetime-01",
      key: "SM-LIFETIME-PRO-2026",
      plan: "lifetime",
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "SM-QUARTERLY-90DAY-01",
    {
      id: "lic-quarterly-01",
      key: "SM-QUARTERLY-90DAY-01",
      plan: "quarterly",
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "SM-MONTHLY-30DAY-01",
    {
      id: "lic-monthly-01",
      key: "SM-MONTHLY-30DAY-01",
      plan: "monthly",
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "SM-MONTHLY-30DAY-02",
    {
      id: "lic-monthly-02",
      key: "SM-MONTHLY-30DAY-02",
      plan: "monthly",
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
]);

const localPaymentRequests = new Map<string, any>();

// Access Rules Enforcement
function checkQuotaAccess(
  profile: ServerUserProfile,
  textLength: number,
  wordCount: number = 0
): { allowed: boolean; error?: string } {
  const plan = (profile.plan || "free").toLowerCase();
  if (plan === "lifetime") {
    return { allowed: true };
  }

  // 3-Day Plan Server-Side Enforcement
  if (plan === "threeday") {
    const expiry = profile.planExpiresAt ? new Date(profile.planExpiresAt).getTime() : NaN;
    const isExpired = isNaN(expiry) || expiry <= Date.now();
    const wordsUsed = Number(profile.planWordsUsed) || 0;
    const usageCap = Number(currentPricing.threedayUsageCapWords) || 100000;
    if (isExpired || wordsUsed >= usageCap || wordsUsed + wordCount > usageCap) {
      return {
        allowed: false,
        error: "Your 3-Day plan has ended. Upgrade to continue.",
      };
    }
    return { allowed: true };
  }

  const isProPlan =
    plan === "monthly" ||
    plan === "quarterly" ||
    plan === "pro_monthly" ||
    plan === "pro_3months";

  if (isProPlan) {
    if (profile.planExpiresAt) {
      const expiry = new Date(profile.planExpiresAt).getTime();
      if (!isNaN(expiry) && expiry > Date.now()) {
        return { allowed: true };
      }
    }
  }

  const used = Number(profile.charactersUsed) || 0;
  const limit = Number(profile.freeLimit) || 10000;
  if (used + textLength <= limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: "Free limit reached. Upgrade to continue.",
  };
}

// Atomically increment charactersUsed and planWordsUsed using Admin SDK
async function commitAtomicUsage(
  uid: string,
  charactersCount: number,
  wordsCount: number = 0
): Promise<boolean> {
  if (charactersCount <= 0 && wordsCount <= 0) return true;
  try {
    const userRef = adminDb.collection("users").doc(uid);
    const updates: Record<string, any> = {};
    if (charactersCount > 0) {
      updates.charactersUsed = FieldValue.increment(charactersCount);
    }
    if (wordsCount > 0) {
      updates.planWordsUsed = FieldValue.increment(wordsCount);
    }
    await userRef.set(updates, { merge: true });
    return true;
  } catch (err) {
    console.warn("Failed to commit atomic usage via Admin SDK:", err);
    return false;
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Passcode Unlock Studio
app.post("/api/unlock", (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const rateLimit = ipRateLimits.get(ip) || { failedAttempts: 0, lockUntil: 0 };

  if (rateLimit.lockUntil > now) {
    const remainingSeconds = Math.ceil((rateLimit.lockUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: "Too many attempts. Try again in 30 seconds.",
      lockoutRemaining: remainingSeconds,
    });
  }

  const { passcode } = req.body || {};
  if (!passcode || typeof passcode !== "string" || !passcode.trim()) {
    return res.status(400).json({
      success: false,
      error: "Please enter the passcode.",
    });
  }

  const envPasscode = process.env.APP_PASSCODE;
  const defaultPasscode = "Shani Mughal From Sargodha";
  const cleanAttempt = passcode.trim().replace(/\s+/g, " ").toLowerCase();
  const cleanEnv = envPasscode ? envPasscode.trim().replace(/\s+/g, " ").toLowerCase() : "";
  const cleanDefault = defaultPasscode.trim().replace(/\s+/g, " ").toLowerCase();

  const isMatch = (cleanEnv && cleanAttempt === cleanEnv) || cleanAttempt === cleanDefault;

  if (isMatch) {
    ipRateLimits.delete(ip);
    const token = createSessionToken(30);
    return res.json({
      success: true,
      token,
      expiresInDays: 30,
    });
  } else {
    const newFailures = rateLimit.failedAttempts + 1;
    if (newFailures >= 5) {
      ipRateLimits.set(ip, {
        failedAttempts: newFailures,
        lockUntil: now + 30000,
      });
      return res.status(429).json({
        success: false,
        error: "Too many attempts. Try again in 30 seconds.",
        lockoutRemaining: 30,
      });
    } else {
      ipRateLimits.set(ip, {
        failedAttempts: newFailures,
        lockUntil: 0,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid passcode. Please try again.",
        failedAttempts: newFailures,
      });
    }
  }
});

// 2. Secure Gemini TTS Speech Generation
app.post("/api/generate-speech", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const { apiKey, text, model, isTwoSpeaker, singleVoice, speaker1, speaker2 } = req.body || {};
  const cleanKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!cleanKey) {
    return res.status(400).json({ error: "Please add your own Gemini API key to continue." });
  }

  const scriptText = typeof text === "string" ? text : "";
  if (!scriptText) {
    return res.status(400).json({ error: "Missing script text." });
  }

  const textLength = scriptText.length;
  const wordCount = countWords(scriptText);

  // Step 1: Load user profile & enforce quota using Admin SDK BEFORE calling Gemini
  const profile = await fetchUserProfile(authUser.uid, authUser.email || "");
  const quotaCheck = checkQuotaAccess(profile, textLength, wordCount);
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      error: quotaCheck.error || "Free limit reached. Upgrade to continue.",
      code: "QUOTA_EXCEEDED",
      charactersUsed: profile.charactersUsed,
      planWordsUsed: profile.planWordsUsed,
      freeLimit: profile.freeLimit,
    });
  }

  // Step 2: Build speech config
  let speechConfig: any;
  if (isTwoSpeaker) {
    speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          {
            speaker: speaker1?.name || "Speaker1",
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speaker1?.voice || "Charon" },
            },
          },
          {
            speaker: speaker2?.name || "Speaker2",
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speaker2?.voice || "Aoede" },
            },
          },
        ],
      },
    };
  } else {
    speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: singleVoice || "Charon" },
      },
    };
  }

  const requestBody = {
    contents: [{ parts: [{ text: scriptText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig,
    },
  };

  const selectedModel = model || "gemini-3.1-flash-tts-preview";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    selectedModel
  )}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  // Step 3: Call Gemini API (server never stores or logs the user's API key)
  try {
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!geminiRes.ok) {
      let errMsg = "Gemini API request failed.";
      try {
        const errJson = await geminiRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch {
        errMsg = `HTTP ${geminiRes.status}: ${geminiRes.statusText}`;
      }
      errMsg = errMsg.replace(new RegExp(cleanKey, "g"), "[REDACTED]");
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    const geminiData = await geminiRes.json();
    const part = geminiData.candidates?.[0]?.content?.parts?.[0];
    const inlineData = part?.inlineData;
    if (!inlineData?.data) {
      return res.status(502).json({ error: "No audio returned from Gemini API." });
    }

    // Step 4: Atomically increment charactersUsed and planWordsUsed using firebase-admin SDK
    await commitAtomicUsage(authUser.uid, textLength, wordCount);

    return res.json({
      success: true,
      audioData: inlineData.data,
      mimeType: inlineData.mimeType,
      charactersDeducted: textLength,
      wordsDeducted: wordCount,
    });
  } catch (err: any) {
    const safeMsg = (err?.message || "Generation error").replace(new RegExp(cleanKey, "g"), "[REDACTED]");
    return res.status(500).json({ error: safeMsg });
  }
});

// 3. Secure Translation Function with Quota Enforcement
app.post("/api/translate", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const { apiKey, text, targetLang } = req.body || {};
  const cleanKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!cleanKey) {
    return res.status(400).json({ error: "Please add your own Gemini API key to continue." });
  }

  const textToTranslate = typeof text === "string" ? text.trim() : "";
  if (!textToTranslate) {
    return res.status(400).json({ error: "Missing text to translate." });
  }

  const textLength = textToTranslate.length;
  const wordCount = countWords(textToTranslate);

  // Enforce Quota via Admin SDK
  const profile = await fetchUserProfile(authUser.uid, authUser.email || "");
  const quotaCheck = checkQuotaAccess(profile, textLength, wordCount);
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      error: quotaCheck.error || "Free limit reached. Upgrade to continue.",
      code: "QUOTA_EXCEEDED",
      charactersUsed: profile.charactersUsed,
      planWordsUsed: profile.planWordsUsed,
      freeLimit: profile.freeLimit,
    });
  }

  const prompt = `Translate the following text into ${targetLang || "English"}. STRICT RULE: Keep any [bracketed stage directions] like [pause], [slowly], or [dramatically] completely unchanged and untranslated in their exact positions. Return ONLY the translated text without commentary or quotation marks.\n\nText:\n${textToTranslate}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!geminiRes.ok) {
      let errMsg = "Translation failed.";
      try {
        const errJson = await geminiRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch {
        errMsg = `HTTP ${geminiRes.status}: ${geminiRes.statusText}`;
      }
      errMsg = errMsg.replace(new RegExp(cleanKey, "g"), "[REDACTED]");
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    const geminiData = await geminiRes.json();
    const translatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Atomically increment usage via Admin SDK
    await commitAtomicUsage(authUser.uid, textLength, wordCount);

    return res.json({
      success: true,
      translatedText,
      charactersDeducted: textLength,
      wordsDeducted: wordCount,
    });
  } catch (err: any) {
    const safeMsg = (err?.message || "Translation error").replace(new RegExp(cleanKey, "g"), "[REDACTED]");
    return res.status(500).json({ error: safeMsg });
  }
});

// 4. Secure Audio Transcription with Quota Enforcement
app.post("/api/transcribe", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const { apiKey, audioBase64, mimeType } = req.body || {};
  const cleanKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!cleanKey) {
    return res.status(400).json({ error: "Please add your own Gemini API key to continue." });
  }

  if (!audioBase64) {
    return res.status(400).json({ error: "Missing audio data for transcription." });
  }

  const transcribeBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "audio/mp3",
              data: audioBase64,
            },
          },
          {
            text: "Transcribe this audio word for word with accurate punctuation. Preserve any natural pauses as stage directions in brackets like [pause]. Return only the raw transcription without introduction.",
          },
        ],
      },
    ],
  };

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transcribeBody),
    });

    if (!geminiRes.ok) {
      let errMsg = "Transcription failed.";
      try {
        const errJson = await geminiRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch {
        errMsg = `HTTP ${geminiRes.status}: ${geminiRes.statusText}`;
      }
      errMsg = errMsg.replace(new RegExp(cleanKey, "g"), "[REDACTED]");
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    const geminiData = await geminiRes.json();
    const transcript = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    const transcriptLength = transcript.length;
    const wordCount = countWords(transcript);

    // Check & record quota via Admin SDK
    const profile = await fetchUserProfile(authUser.uid, authUser.email || "");
    const quotaCheck = checkQuotaAccess(profile, transcriptLength, wordCount);
    if (!quotaCheck.allowed) {
      return res.status(403).json({
        error: quotaCheck.error || "Free limit reached. Upgrade to continue.",
        code: "QUOTA_EXCEEDED",
        charactersUsed: profile.charactersUsed,
        planWordsUsed: profile.planWordsUsed,
        freeLimit: profile.freeLimit,
      });
    }

    await commitAtomicUsage(authUser.uid, transcriptLength, wordCount);

    return res.json({
      success: true,
      transcript,
      charactersDeducted: transcriptLength,
      wordsDeducted: wordCount,
    });
  } catch (err: any) {
    const safeMsg = (err?.message || "Transcription error").replace(new RegExp(cleanKey, "g"), "[REDACTED]");
    return res.status(500).json({ error: safeMsg });
  }
});

// 5. Record Quota Usage (Compatibility endpoint)
app.post("/api/record-usage", (req, res) => {
  const { charactersCount } = req.body || {};
  const count = typeof charactersCount === "number" ? Math.max(0, charactersCount) : 0;
  return res.json({
    success: true,
    recordedCharacters: count,
    timestamp: new Date().toISOString(),
  });
});

// 6. Settings endpoint: returns pricing & payment methods
app.get("/api/settings", async (_req, res) => {
  try {
    const [methodsDoc, pricingDoc] = await Promise.all([
      adminDb.collection("settings").doc("paymentMethods").get(),
      adminDb.collection("settings").doc("pricing").get(),
    ]);

    if (methodsDoc.exists && Array.isArray(methodsDoc.data()?.methods)) {
      currentPaymentMethods = methodsDoc.data()!.methods;
    }
    if (pricingDoc.exists && pricingDoc.data()) {
      currentPricing = { ...currentPricing, ...pricingDoc.data() };
    }
  } catch (e) {
    console.warn("Could not load settings via admin SDK, using memory cache:", e);
  }

  return res.json({
    pricing: currentPricing,
    paymentMethods: currentPaymentMethods,
  });
});

// Admin save settings endpoint (Payment methods & USD/PKR exchange rate)
app.post("/api/admin/settings", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { methods, pricing } = req.body || {};

  try {
    if (Array.isArray(methods)) {
      currentPaymentMethods = methods;
      await adminDb.collection("settings").doc("paymentMethods").set({ methods }, { merge: true });
    }

    if (pricing && typeof pricing === "object") {
      currentPricing = { ...currentPricing, ...pricing };
      await adminDb.collection("settings").doc("pricing").set(pricing, { merge: true });
    }

    return res.json({
      success: true,
      message: "Settings successfully updated and saved live to Firestore via Admin SDK.",
      methods: currentPaymentMethods,
      pricing: currentPricing,
    });
  } catch (err: any) {
    console.error("Failed to save settings via Admin SDK:", err);
    return res.status(500).json({ error: err?.message || "Failed to save settings to Firestore." });
  }
});

// 7. Redeem License Key (Transaction-based Atomic Redemption via firebase-admin SDK)
// Validates key, ensures unused inside a transaction, updates license and user doc atomically
app.post("/api/redeem-license", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const { key } = req.body || {};
  const rawKey = typeof key === "string" ? key.trim().toUpperCase() : "";
  if (!rawKey) {
    return res.status(400).json({ error: "Please enter a license key to redeem." });
  }

  try {
    // 1. Locate the license document by key
    const querySnapshot = await adminDb
      .collection("licenses")
      .where("key", "==", rawKey)
      .limit(1)
      .get();

    let licenseRef: FirebaseFirestore.DocumentReference;

    if (!querySnapshot.empty) {
      licenseRef = querySnapshot.docs[0].ref;
    } else if (localLicenses.has(rawKey)) {
      // Seed fallback license if present in local map
      const localLic = localLicenses.get(rawKey)!;
      if (localLic.status !== "unused") {
        return res.status(400).json({
          error: "This license key has already been redeemed or is no longer valid.",
        });
      }
      licenseRef = adminDb.collection("licenses").doc(localLic.id);
      await licenseRef.set({
        id: localLic.id,
        key: localLic.key,
        plan: localLic.plan,
        status: "unused",
        redeemedBy: null,
        redeemedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      return res.status(404).json({
        error: "Invalid license key. Please check the code and try again.",
      });
    }

    const userRef = adminDb.collection("users").doc(authUser.uid);

    let targetPlan = "monthly";
    let planExpiresAt: string | null = null;
    let activatedPlanName = "monthly";

    // 2. Perform Atomic Firestore Transaction so license CANNOT be redeemed twice
    await adminDb.runTransaction(async (transaction) => {
      const licenseDoc = await transaction.get(licenseRef);
      if (!licenseDoc.exists) {
        throw new Error("LICENSE_NOT_FOUND");
      }

      const licData = licenseDoc.data();
      if (licData?.status !== "unused") {
        throw new Error("LICENSE_ALREADY_REDEEMED");
      }

      activatedPlanName = licData?.plan || "monthly";
      const now = new Date();

      if (activatedPlanName === "lifetime") {
        targetPlan = "lifetime";
        planExpiresAt = null;
      } else if (activatedPlanName === "threeday") {
        targetPlan = "threeday";
        const durationDays = currentPricing.threedayDurationDays || 3;
        const exp = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        planExpiresAt = exp.toISOString();
      } else if (activatedPlanName === "quarterly" || (activatedPlanName as any) === "pro_3months") {
        targetPlan = "quarterly";
        const durationDays = currentPricing.quarterlyDurationDays || 90;
        const exp = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        planExpiresAt = exp.toISOString();
      } else {
        targetPlan = "monthly";
        const durationDays = currentPricing.monthlyDurationDays || 30;
        const exp = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        planExpiresAt = exp.toISOString();
      }

      // Mark license active
      transaction.update(licenseRef, {
        status: "active",
        redeemedBy: authUser.uid,
        redeemedAt: FieldValue.serverTimestamp(),
      });

      // Update user plan, planExpiresAt, and reset planWordsUsed to 0
      transaction.set(
        userRef,
        {
          plan: targetPlan,
          planExpiresAt: planExpiresAt,
          planWordsUsed: 0,
          email: authUser.email || "",
        },
        { merge: true }
      );
    });

    // Update in-memory fallback map
    if (localLicenses.has(rawKey)) {
      const lic = localLicenses.get(rawKey)!;
      lic.status = "active";
      lic.redeemedBy = authUser.uid;
      lic.redeemedAt = new Date().toISOString();
    }

    return res.json({
      success: true,
      plan: targetPlan,
      planExpiresAt,
      message: `License key successfully redeemed! Your ${activatedPlanName} plan is now active.`,
    });
  } catch (err: any) {
    if (err.message === "LICENSE_ALREADY_REDEEMED") {
      return res.status(400).json({
        error: "This license key has already been redeemed or is no longer valid.",
      });
    }
    if (err.message === "LICENSE_NOT_FOUND") {
      return res.status(404).json({
        error: "Invalid license key. Please check the code and try again.",
      });
    }
    console.error("License redemption transaction error:", err);
    return res.status(500).json({ error: "Failed to redeem license key. Please try again." });
  }
});

// 8. Submit Manual Payment Request
app.post("/api/create-payment-request", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const {
    plan,
    amountUSD,
    amountPKR,
    method,
    senderName,
    senderNumber,
    transactionId,
    screenshotUrl,
  } = req.body || {};

  const cleanTID = typeof transactionId === "string" ? transactionId.trim().toUpperCase() : "";
  if (!cleanTID) {
    return res.status(400).json({ error: "Transaction ID (TID) is required." });
  }
  if (!senderName || !senderNumber || !screenshotUrl) {
    return res.status(400).json({ error: "All payment proof fields and screenshot are required." });
  }

  // Memory duplicate check
  if (processedTransactionIds.has(cleanTID)) {
    return res.status(409).json({
      error: "A payment request with this Transaction ID (TID) has already been submitted.",
    });
  }

  try {
    // Firestore duplicate check via Admin SDK
    const existingSnap = await adminDb
      .collection("paymentRequests")
      .where("transactionId", "==", cleanTID)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      processedTransactionIds.add(cleanTID);
      return res.status(409).json({
        error: "A payment request with this Transaction ID (TID) has already been submitted.",
      });
    }

    processedTransactionIds.add(cleanTID);
    const requestId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const nowIso = new Date().toISOString();

    const defaultUSD =
      plan === "threeday" ? 1 : plan === "lifetime" ? 10 : plan === "quarterly" ? 5 : 2;
    const defaultPKR = defaultUSD * (currentPricing.exchangeRatePKR || 280);

    const requestData = {
      uid: authUser.uid,
      email: authUser.email || req.body?.email || "",
      plan: plan || "monthly",
      amountUSD: Number(amountUSD) || defaultUSD,
      amountPKR: Number(amountPKR) || defaultPKR,
      method: method || "JazzCash",
      senderName: String(senderName).trim(),
      senderNumber: String(senderNumber).trim(),
      transactionId: cleanTID,
      screenshotUrl: String(screenshotUrl),
      status: "pending",
      createdAt: nowIso,
      reviewedAt: null,
      rejectionReason: null,
    };

    localPaymentRequests.set(requestId, { id: requestId, ...requestData });

    // Save to Firestore via Admin SDK
    await adminDb.collection("paymentRequests").doc(requestId).set({
      ...requestData,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      requestId,
      message: "Payment request submitted successfully! It is now under review and will be approved within a few hours.",
    });
  } catch (err: any) {
    console.error("Payment request creation error via Admin SDK:", err);
    return res.status(500).json({ error: "Failed to submit payment request." });
  }
});

// 9. Admin Approve Payment (Transaction-based Atomic Approval via firebase-admin SDK)
// Ensures the payment cannot be approved twice, sets users/{uid}.plan and planExpiresAt, resets planWordsUsed = 0
app.post("/api/admin/approve-payment", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId." });
  }

  const reqRef = adminDb.collection("paymentRequests").doc(requestId);

  try {
    let targetPlan = "monthly";
    let planExpiresAt: string | null = null;
    let targetUid = "";

    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(reqRef);
      if (!snap.exists) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      const paymentData = snap.data();
      if (paymentData?.status === "approved") {
        throw new Error("REQUEST_ALREADY_APPROVED");
      }

      targetUid = paymentData?.uid;
      if (!targetUid) {
        throw new Error("REQUEST_MISSING_UID");
      }

      const requestedPlan = paymentData?.plan || "monthly";
      const now = new Date();

      if (requestedPlan === "lifetime") {
        targetPlan = "lifetime";
        planExpiresAt = null;
      } else if (requestedPlan === "threeday") {
        targetPlan = "threeday";
        const durationDays = currentPricing.threedayDurationDays || 3;
        planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      } else if (requestedPlan === "quarterly" || requestedPlan === "pro_3months") {
        targetPlan = "quarterly";
        const durationDays = currentPricing.quarterlyDurationDays || 90;
        planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        targetPlan = "monthly";
        const durationDays = currentPricing.monthlyDurationDays || 30;
        planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const userRef = adminDb.collection("users").doc(targetUid);

      // Atomically approve the payment request
      transaction.update(reqRef, {
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        plan: targetPlan,
      });

      // Atomically update user plan, planExpiresAt, and reset planWordsUsed to 0
      transaction.set(
        userRef,
        {
          plan: targetPlan,
          planExpiresAt: planExpiresAt,
          planWordsUsed: 0,
        },
        { merge: true }
      );
    });

    // Update local memory cache if present
    if (localPaymentRequests.has(requestId)) {
      const p = localPaymentRequests.get(requestId);
      p.status = "approved";
      p.reviewedAt = new Date().toISOString();
    }

    return res.json({
      success: true,
      message: `Payment approved! User ${targetUid} upgraded to ${targetPlan}.`,
      plan: targetPlan,
      planExpiresAt,
    });
  } catch (err: any) {
    if (err.message === "REQUEST_ALREADY_APPROVED") {
      return res.status(400).json({ error: "This request has already been approved." });
    }
    if (err.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "Payment request not found." });
    }
    console.error("Payment approval transaction error:", err);
    return res.status(500).json({ error: err.message || "Failed to approve payment." });
  }
});

// 10. Admin Reject Payment (Transaction-based via firebase-admin SDK)
app.post("/api/admin/reject-payment", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { requestId, reason } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId." });
  }

  const rejectionReason = String(reason || "Invalid transaction details or unverified payment.").trim();
  const reqRef = adminDb.collection("paymentRequests").doc(requestId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(reqRef);
      if (!snap.exists) {
        throw new Error("REQUEST_NOT_FOUND");
      }

      const data = snap.data();
      if (data?.status === "approved") {
        throw new Error("CANNOT_REJECT_APPROVED");
      }

      transaction.update(reqRef, {
        status: "rejected",
        rejectionReason,
        reviewedAt: FieldValue.serverTimestamp(),
      });
    });

    if (localPaymentRequests.has(requestId)) {
      const p = localPaymentRequests.get(requestId);
      p.status = "rejected";
      p.rejectionReason = rejectionReason;
      p.reviewedAt = new Date().toISOString();
    }

    return res.json({
      success: true,
      message: "Payment request rejected.",
    });
  } catch (err: any) {
    if (err.message === "CANNOT_REJECT_APPROVED") {
      return res.status(400).json({ error: "Cannot reject an already approved payment." });
    }
    if (err.message === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "Payment request not found." });
    }
    console.error("Payment rejection error:", err);
    return res.status(500).json({ error: err.message || "Failed to reject payment." });
  }
});

// 11. Admin Generate License Key (firebase-admin SDK write)
app.post("/api/admin/generate-license", async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { plan } = req.body || {};
  let targetPlan: "threeday" | "monthly" | "quarterly" | "lifetime" = "monthly";
  if (plan === "lifetime") targetPlan = "lifetime";
  else if (plan === "threeday") targetPlan = "threeday";
  else if (plan === "quarterly" || plan === "pro_3months") targetPlan = "quarterly";
  else targetPlan = "monthly";

  const randomCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  const licenseKey = `SM-${targetPlan.toUpperCase()}-${randomCode}`;
  const licId = "lic_" + Date.now();
  const nowIso = new Date().toISOString();

  const newLicense: ServerLicense = {
    id: licId,
    key: licenseKey,
    plan: targetPlan,
    status: "unused",
    redeemedBy: null,
    redeemedAt: null,
    createdAt: nowIso,
  };

  localLicenses.set(licenseKey, newLicense);

  try {
    await adminDb.collection("licenses").doc(licId).set({
      id: licId,
      key: licenseKey,
      plan: targetPlan,
      status: "unused",
      redeemedBy: null,
      redeemedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      key: licenseKey,
      plan: targetPlan,
      message: "New license key generated successfully!",
    });
  } catch (err: any) {
    console.error("Error generating license in Firestore via Admin SDK:", err);
    return res.status(500).json({ error: "Failed to save generated license to Firestore." });
  }
});

// 12. Admin List Payment Requests (firebase-admin SDK read)
app.get(["/api/admin/payment-requests", "/api/admin/pending-payments"], async (req, res) => {
  const authUser = await verifyFirebaseToken(req);
  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const map = new Map<string, any>();

  // Add in-memory requests
  for (const reqItem of localPaymentRequests.values()) {
    map.set(reqItem.id || reqItem.transactionId, reqItem);
  }

  // Load live from Firestore via Admin SDK
  try {
    const snap = await adminDb.collection("paymentRequests").get();
    for (const docSnap of snap.docs) {
      const f = docSnap.data();
      const id = docSnap.id;
      let createdAtStr = "";
      if (f.createdAt) {
        if (typeof f.createdAt === "string") createdAtStr = f.createdAt;
        else if (typeof f.createdAt.toDate === "function") createdAtStr = f.createdAt.toDate().toISOString();
        else createdAtStr = new Date(f.createdAt).toISOString();
      }

      let reviewedAtStr: string | null = null;
      if (f.reviewedAt) {
        if (typeof f.reviewedAt === "string") reviewedAtStr = f.reviewedAt;
        else if (typeof f.reviewedAt.toDate === "function") reviewedAtStr = f.reviewedAt.toDate().toISOString();
        else reviewedAtStr = new Date(f.reviewedAt).toISOString();
      }

      map.set(id, {
        id,
        uid: f.uid || "",
        email: f.email || "",
        plan: f.plan || "monthly",
        amountUSD: Number(f.amountUSD) || 0,
        amountPKR: Number(f.amountPKR) || 0,
        method: f.method || "",
        senderName: f.senderName || "",
        senderNumber: f.senderNumber || "",
        transactionId: f.transactionId || "",
        screenshotUrl: f.screenshotUrl || "",
        status: f.status || "pending",
        createdAt: createdAtStr,
        reviewedAt: reviewedAtStr,
        rejectionReason: f.rejectionReason || null,
      });
    }
  } catch (e) {
    console.warn("Could not query Firestore payment requests via Admin SDK:", e);
  }

  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return res.json({
    requests: list,
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SM Voice Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
