/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Firebase Applet Config
let firebaseConfig: any = {};
const configCandidates = [
  path.resolve(__dirname, "firebase-applet-config.json"),
  path.resolve(process.cwd(), "firebase-applet-config.json"),
  path.resolve(__dirname, "..", "firebase-applet-config.json"),
];
for (const candidate of configCandidates) {
  try {
    if (fs.existsSync(candidate)) {
      firebaseConfig = JSON.parse(fs.readFileSync(candidate, "utf8"));
      break;
    }
  } catch (e) {
    console.warn("Could not read firebase-applet-config.json:", e);
  }
}

// Initialize Firebase Admin SDK
if (!getApps().length && firebaseConfig.projectId) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (e) {
    console.warn("Firebase admin initialization warning:", e);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON parsing with 50MB payload limit (needed for audio transcription uploads)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
async function verifyFirebaseToken(req: express.Request): Promise<{ uid: string; email?: string; emailVerified?: boolean } | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) return null;

  // 1. Try Firebase Admin verifyIdToken
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded?.uid) {
      return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified === true };
    }
  } catch {
    // Fallback: Verify via Firebase identitytoolkit lookup REST API
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
            return { uid: user.localId, email: user.email, emailVerified: user.emailVerified === true };
          }
        }
      }
    } catch (lookupErr) {
      console.warn("Identity lookup verification warning:", lookupErr);
    }
  }

  return null;
}

interface ServerUserProfile {
  email: string;
  plan: string;
  charactersUsed: number;
  planWordsUsed: number;
  freeLimit: number;
  planExpiresAt: string | null;
}

function parseFirestoreDocFields(fields: any): ServerUserProfile {
  return {
    email: fields?.email?.stringValue || "",
    plan: fields?.plan?.stringValue || "free",
    charactersUsed: parseInt(fields?.charactersUsed?.integerValue ?? fields?.charactersUsed?.doubleValue ?? "0", 10),
    planWordsUsed: parseInt(fields?.planWordsUsed?.integerValue ?? fields?.planWordsUsed?.doubleValue ?? "0", 10),
    freeLimit: parseInt(fields?.freeLimit?.integerValue ?? fields?.freeLimit?.doubleValue ?? "10000", 10),
    planExpiresAt: fields?.planExpiresAt?.stringValue || fields?.planExpiresAt?.timestampValue || null,
  };
}

// Count words on the server by splitting the text on whitespace
function countWords(text: string): number {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

async function fetchUserProfile(uid: string, token: string): Promise<ServerUserProfile> {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${uid}`;
  try {
    const res = await fetch(docUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return parseFirestoreDocFields(data.fields);
    }

    // If document does not exist yet (404), initialize it with 10,000 free characters
    if (res.status === 404) {
      const createUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users?documentId=${uid}`;
      const initialDoc = {
        fields: {
          email: { stringValue: "" },
          plan: { stringValue: "free" },
          charactersUsed: { integerValue: "0" },
          planWordsUsed: { integerValue: "0" },
          freeLimit: { integerValue: "10000" },
          planExpiresAt: { nullValue: null },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      };

      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(initialDoc),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        return parseFirestoreDocFields(createData.fields);
      }
    }
  } catch (err) {
    console.warn("fetchUserProfile error:", err);
  }

  return {
    email: "",
    plan: "free",
    charactersUsed: 0,
    planWordsUsed: 0,
    freeLimit: 10000,
    planExpiresAt: null,
  };
}

// Access Rules Enforcement:
// - Lifetime: unlimited
// - 3-Day ("threeday"): allowed only if not expired AND planWordsUsed + requestWords <= 100,000 words
// - Monthly / Quarterly (pro_monthly / pro_3months): unlimited if planExpiresAt is in the future
// - Otherwise (free or expired): allow only if charactersUsed + textLength <= freeLimit (10,000)
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

// Atomically increment charactersUsed and planWordsUsed in Firestore transaction/transform
async function commitAtomicUsage(
  uid: string,
  token: string,
  charactersCount: number,
  wordsCount: number = 0
): Promise<boolean> {
  if (charactersCount <= 0 && wordsCount <= 0) return true;

  const commitUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:commit`;
  const docPath = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${uid}`;

  const fieldTransforms: any[] = [];
  if (charactersCount > 0) {
    fieldTransforms.push({
      fieldPath: "charactersUsed",
      increment: {
        integerValue: String(charactersCount),
      },
    });
  }
  if (wordsCount > 0) {
    fieldTransforms.push({
      fieldPath: "planWordsUsed",
      increment: {
        integerValue: String(wordsCount),
      },
    });
  }

  try {
    const res = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        writes: [
          {
            transform: {
              document: docPath,
              fieldTransforms,
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Atomic usage commit warning:", res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Failed to commit atomic usage:", err);
    return false;
  }
}

// API Routes

// 2. Secure Gemini TTS Speech Generation
// Enforces token verification, quota check, Gemini dispatch with user's ephemeral key, and atomic Firestore deduction
app.post("/api/generate-speech", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

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

  // Step 1: Load user profile & enforce quota BEFORE calling Gemini
  const profile = await fetchUserProfile(authUser.uid, token);
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

    // Step 4: Atomically increment charactersUsed and planWordsUsed in Firestore ONLY AFTER Gemini succeeds
    await commitAtomicUsage(authUser.uid, token, textLength, wordCount);

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
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

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

  // Enforce Quota
  const profile = await fetchUserProfile(authUser.uid, token);
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

    // Atomically increment charactersUsed and planWordsUsed after success
    await commitAtomicUsage(authUser.uid, token, textLength, wordCount);

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
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

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

    // Check & record quota for the transcribed speech characters & words
    const profile = await fetchUserProfile(authUser.uid, token);
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

    await commitAtomicUsage(authUser.uid, token, transcriptLength, wordCount);

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
  const { charactersCount, userId } = req.body || {};
  const count = typeof charactersCount === "number" ? Math.max(0, charactersCount) : 0;
  return res.json({
    success: true,
    recordedCharacters: count,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// LICENSE KEYS & MANUAL PAYMENT ENDPOINTS
// ==========================================

// In-memory set to prevent duplicate Transaction IDs (TIDs)
const processedTransactionIds = new Set<string>();

// Pre-seeded licenses for fallback & immediate redemption
interface ServerLicense {
  id: string;
  key: string;
  plan: "threeday" | "monthly" | "quarterly" | "lifetime";
  status: "unused" | "active" | "revoked";
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

const localLicenses = new Map<string, ServerLicense>();

// In-memory payment requests cache / store
const localPaymentRequests = new Map<string, any>();

// Helper to convert JS object to Firestore REST fields
function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === "string") {
      fields[key] = { stringValue: val };
    } else if (typeof val === "number") {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === "boolean") {
      fields[key] = { booleanValue: val };
    } else if (val instanceof Date) {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((item) => {
            if (typeof item === "object") {
              return { mapValue: { fields: toFirestoreFields(item) } };
            }
            return { stringValue: String(item) };
          }),
        },
      };
    } else if (typeof val === "object") {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

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

// 6. Settings endpoint: returns pricing & payment methods
app.get("/api/settings", async (_req, res) => {
  return res.json({
    pricing: currentPricing,
    paymentMethods: currentPaymentMethods,
  });
});

// Admin save settings endpoint (Payment methods & USD/PKR exchange rate)
app.post("/api/admin/settings", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  const authUser = await verifyFirebaseToken(req);

  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { methods, pricing } = req.body || {};

  if (Array.isArray(methods)) {
    currentPaymentMethods = methods;
    if (token) {
      try {
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/settings/paymentMethods`;
        await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fields: {
              methods: {
                arrayValue: {
                  values: methods.map((m: any) => ({
                    mapValue: {
                      fields: toFirestoreFields(m),
                    },
                  })),
                },
              },
            },
          }),
        });
      } catch (e) {
        console.warn("Could not patch paymentMethods:", e);
      }
    }
  }

  if (pricing && typeof pricing === "object") {
    currentPricing = { ...currentPricing, ...pricing };
    if (token) {
      try {
        const patchPricingUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/settings/pricing`;
        await fetch(patchPricingUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fields: toFirestoreFields(pricing),
          }),
        });
      } catch (e) {
        console.warn("Could not patch pricing:", e);
      }
    }
  }

  return res.json({
    success: true,
    message: "Settings successfully updated and saved live to Firestore.",
    methods: currentPaymentMethods,
    pricing: currentPricing,
  });
});

// 7. Redeem License Key (Server Function)
// Validates key, ensures unused, marks active with redeemedBy = uid, updates users/{uid} plan & planExpiresAt
app.post("/api/redeem-license", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

  const authUser = await verifyFirebaseToken(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
  }

  const { key } = req.body || {};
  const rawKey = typeof key === "string" ? key.trim().toUpperCase() : "";
  if (!rawKey) {
    return res.status(400).json({ error: "Please enter a license key to redeem." });
  }

  // 1. Check in Firestore licenses collection first
  let matchedLicense: ServerLicense | null = null;
  let licenseDocId: string | null = null;

  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
    const qRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "licenses" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "key" },
              op: "EQUAL",
              value: { stringValue: rawKey },
            },
          },
          limit: 1,
        },
      }),
    });

    if (qRes.ok) {
      const qData = await qRes.json();
      if (Array.isArray(qData) && qData[0]?.document) {
        const docObj = qData[0].document;
        const parts = docObj.name.split("/");
        licenseDocId = parts[parts.length - 1];
        const f = docObj.fields;
        matchedLicense = {
          id: licenseDocId || "",
          key: f?.key?.stringValue || "",
          plan: f?.plan?.stringValue || "monthly",
          status: f?.status?.stringValue || "unused",
          redeemedBy: f?.redeemedBy?.stringValue || null,
          redeemedAt: f?.redeemedAt?.stringValue || null,
          createdAt: f?.createdAt?.timestampValue || f?.createdAt?.stringValue || "",
        };
      }
    }
  } catch (err) {
    console.warn("Firestore license query warning:", err);
  }

  // Fallback to local memory licenses if not in Firestore
  if (!matchedLicense && localLicenses.has(rawKey)) {
    matchedLicense = localLicenses.get(rawKey)!;
    licenseDocId = matchedLicense.id;
  }

  if (!matchedLicense) {
    return res.status(404).json({ error: "Invalid license key. Please check the code and try again." });
  }

  if (matchedLicense.status !== "unused") {
    return res.status(400).json({
      error: "This license key has already been redeemed or is no longer valid.",
    });
  }

  // 2. Calculate new plan and expiry
  const now = new Date();
  let targetPlan = "monthly";
  let planExpiresAt: string | null = null;

  if (matchedLicense.plan === "lifetime") {
    targetPlan = "lifetime";
    planExpiresAt = null;
  } else if (matchedLicense.plan === "threeday") {
    targetPlan = "threeday";
    const durationDays = currentPricing.threedayDurationDays || 3;
    const exp = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    planExpiresAt = exp.toISOString();
  } else if (matchedLicense.plan === "quarterly" || (matchedLicense.plan as any) === "pro_3months") {
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

  const redeemedAtStr = now.toISOString();

  // 3. Mark license as active in Firestore and memory
  matchedLicense.status = "active";
  matchedLicense.redeemedBy = authUser.uid;
  matchedLicense.redeemedAt = redeemedAtStr;
  localLicenses.set(rawKey, matchedLicense);

  try {
    if (licenseDocId) {
      const updateLicUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/licenses/${licenseDocId}?updateMask.fieldPaths=status&updateMask.fieldPaths=redeemedBy&updateMask.fieldPaths=redeemedAt`;
      await fetch(updateLicUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "active" },
            redeemedBy: { stringValue: authUser.uid },
            redeemedAt: { timestampValue: redeemedAtStr },
          },
        }),
      });
    }
  } catch (licErr) {
    console.warn("Failed to update license doc:", licErr);
  }

  // 4. Update user plan, planExpiresAt, and reset planWordsUsed to 0 in users/{uid}
  try {
    const updateUserUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${authUser.uid}?updateMask.fieldPaths=plan&updateMask.fieldPaths=planExpiresAt&updateMask.fieldPaths=planWordsUsed`;
    await fetch(updateUserUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fields: {
          plan: { stringValue: targetPlan },
          planExpiresAt: planExpiresAt ? { timestampValue: planExpiresAt } : { nullValue: null },
          planWordsUsed: { integerValue: "0" },
        },
      }),
    });
  } catch (userErr) {
    console.warn("Failed to update user doc in Firestore:", userErr);
  }

  return res.json({
    success: true,
    plan: targetPlan,
    planExpiresAt,
    message: `License key successfully redeemed! Your ${matchedLicense.plan} plan is now active.`,
  });
});

// 8. Submit Manual Payment Request
// Rejects duplicate Transaction IDs, writes to paymentRequests collection with status "pending"
app.post("/api/create-payment-request", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  if (!token) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

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

  // Check duplicate Transaction ID (TID)
  if (processedTransactionIds.has(cleanTID)) {
    return res.status(409).json({
      error: "A payment request with this Transaction ID (TID) has already been submitted.",
    });
  }

  // Also query Firestore paymentRequests for duplicate TID
  try {
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
    const qRes = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "paymentRequests" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "transactionId" },
              op: "EQUAL",
              value: { stringValue: cleanTID },
            },
          },
          limit: 1,
        },
      }),
    });

    if (qRes.ok) {
      const qData = await qRes.json();
      if (Array.isArray(qData) && qData[0]?.document) {
        processedTransactionIds.add(cleanTID);
        return res.status(409).json({
          error: "A payment request with this Transaction ID (TID) has already been submitted.",
        });
      }
    }
  } catch (checkErr) {
    console.warn("TID duplicate query warning:", checkErr);
  }

  // Mark TID in memory to guarantee no race condition
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

  // Create in Firestore paymentRequests collection
  try {
    const createUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paymentRequests?documentId=${requestId}`;
    await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(requestData),
      }),
    });
  } catch (saveErr) {
    console.warn("Firestore payment request save warning:", saveErr);
  }

  return res.json({
    success: true,
    requestId,
    message: "Payment request submitted successfully! It is now under review and will be approved within a few hours.",
  });
});

// Helper: Check admin authorization (verified admin email only; set the ADMIN_EMAIL secret to change the admin)
function checkIsAdmin(_req: express.Request, authUser: { uid: string; email?: string; emailVerified?: boolean } | null): boolean {
  const adminEmail = (process.env.ADMIN_EMAIL || "chromebook160nb@gmail.com").trim().toLowerCase();
  if (!authUser?.email || authUser.emailVerified !== true) return false;
  return authUser.email.trim().toLowerCase() === adminEmail;
}

// 9. Admin Approve Payment
// Marks request "approved", sets users/{uid}.plan and planExpiresAt (threeday: +3 days, monthly: +30 days, quarterly: +90 days, lifetime: null), resets planWordsUsed = 0, cannot be applied twice
app.post("/api/admin/approve-payment", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  const authUser = await verifyFirebaseToken(req);

  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId." });
  }

  // Load payment request
  let paymentReq: any = localPaymentRequests.get(requestId);
  if (!paymentReq && token) {
    try {
      const getUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paymentRequests/${requestId}`;
      const gRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (gRes.ok) {
        const docObj = await gRes.json();
        paymentReq = {
          id: requestId,
          uid: docObj.fields?.uid?.stringValue,
          plan: docObj.fields?.plan?.stringValue || "monthly",
          status: docObj.fields?.status?.stringValue || "pending",
        };
      }
    } catch (e) {
      console.warn("Could not fetch payment request:", e);
    }
  }

  if (!paymentReq) {
    return res.status(404).json({ error: "Payment request not found." });
  }

  if (paymentReq.status === "approved") {
    return res.status(400).json({ error: "This request has already been approved." });
  }

  // Calculate plan & expiry
  const now = new Date();
  let targetPlan = "monthly";
  let planExpiresAt: string | null = null;

  if (paymentReq.plan === "lifetime") {
    targetPlan = "lifetime";
    planExpiresAt = null;
  } else if (paymentReq.plan === "threeday") {
    targetPlan = "threeday";
    const durationDays = currentPricing.threedayDurationDays || 3;
    planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (paymentReq.plan === "quarterly" || paymentReq.plan === "pro_3months") {
    targetPlan = "quarterly";
    const durationDays = currentPricing.quarterlyDurationDays || 90;
    planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  } else {
    targetPlan = "monthly";
    const durationDays = currentPricing.monthlyDurationDays || 30;
    planExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const reviewedAtIso = now.toISOString();

  // Update paymentRequests document to approved
  paymentReq.status = "approved";
  paymentReq.reviewedAt = reviewedAtIso;
  localPaymentRequests.set(requestId, paymentReq);

  if (token) {
    try {
      const updateReqUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paymentRequests/${requestId}?updateMask.fieldPaths=status&updateMask.fieldPaths=reviewedAt`;
      await fetch(updateReqUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "approved" },
            reviewedAt: { timestampValue: reviewedAtIso },
          },
        }),
      });

      // Update user plan, planExpiresAt, and reset planWordsUsed to 0 in users/{uid}
      const updateUserUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${paymentReq.uid}?updateMask.fieldPaths=plan&updateMask.fieldPaths=planExpiresAt&updateMask.fieldPaths=planWordsUsed`;
      await fetch(updateUserUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: {
            plan: { stringValue: targetPlan },
            planExpiresAt: planExpiresAt ? { timestampValue: planExpiresAt } : { nullValue: null },
            planWordsUsed: { integerValue: "0" },
          },
        }),
      });
    } catch (err) {
      console.warn("Failed to commit approval in Firestore:", err);
    }
  }

  return res.json({
    success: true,
    message: `Payment approved! User ${paymentReq.uid} upgraded to ${targetPlan}.`,
    plan: targetPlan,
    planExpiresAt,
  });
});

// 10. Admin Reject Payment
app.post("/api/admin/reject-payment", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
  const authUser = await verifyFirebaseToken(req);

  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const { requestId, reason } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId." });
  }

  let paymentReq: any = localPaymentRequests.get(requestId);
  const rejectionReason = String(reason || "Invalid transaction details or unverified payment.").trim();
  const reviewedAtIso = new Date().toISOString();

  if (paymentReq) {
    paymentReq.status = "rejected";
    paymentReq.rejectionReason = rejectionReason;
    paymentReq.reviewedAt = reviewedAtIso;
    localPaymentRequests.set(requestId, paymentReq);
  }

  if (token) {
    try {
      const updateReqUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paymentRequests/${requestId}?updateMask.fieldPaths=status&updateMask.fieldPaths=rejectionReason&updateMask.fieldPaths=reviewedAt`;
      await fetch(updateReqUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: {
            status: { stringValue: "rejected" },
            rejectionReason: { stringValue: rejectionReason },
            reviewedAt: { timestampValue: reviewedAtIso },
          },
        }),
      });
    } catch (err) {
      console.warn("Failed to commit rejection in Firestore:", err);
    }
  }

  return res.json({
    success: true,
    message: "Payment request rejected.",
  });
});

// 11. Admin Generate License Key
app.post("/api/admin/generate-license", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.body?.idToken || null);
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

  if (token) {
    try {
      const createUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/licenses?documentId=${licId}`;
      await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields(newLicense),
        }),
      });
    } catch (err) {
      console.warn("Could not save generated license to Firestore:", err);
    }
  }

  return res.json({
    success: true,
    key: licenseKey,
    plan: targetPlan,
    message: "New license key generated successfully!",
  });
});

// 12. Admin List Payment Requests (with filters and pending first)
app.get(["/api/admin/payment-requests", "/api/admin/pending-payments"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.query?.idToken as string || null);
  const authUser = await verifyFirebaseToken(req);

  if (!checkIsAdmin(req, authUser)) {
    return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
  }

  const map = new Map<string, any>();

  // Add local in-memory requests
  for (const reqItem of localPaymentRequests.values()) {
    map.set(reqItem.id || reqItem.transactionId, reqItem);
  }

  // If token is available, query Firestore paymentRequests
  if (token) {
    try {
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery`;
      const qRes = await fetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "paymentRequests" }],
          },
        }),
      });

      if (qRes.ok) {
        const qData = await qRes.json();
        if (Array.isArray(qData)) {
          for (const item of qData) {
            if (item.document) {
              const d = item.document;
              const parts = d.name.split("/");
              const id = parts[parts.length - 1];
              const f = d.fields;
              const reqItem = {
                id,
                uid: f?.uid?.stringValue || "",
                email: f?.email?.stringValue || "",
                plan: f?.plan?.stringValue || "monthly",
                amountUSD: parseInt(f?.amountUSD?.integerValue ?? f?.amountUSD?.doubleValue ?? "0", 10),
                amountPKR: parseInt(f?.amountPKR?.integerValue ?? f?.amountPKR?.doubleValue ?? "0", 10),
                method: f?.method?.stringValue || "",
                senderName: f?.senderName?.stringValue || "",
                senderNumber: f?.senderNumber?.stringValue || "",
                transactionId: f?.transactionId?.stringValue || "",
                screenshotUrl: f?.screenshotUrl?.stringValue || "",
                status: f?.status?.stringValue || "pending",
                createdAt: f?.createdAt?.timestampValue || f?.createdAt?.stringValue || "",
                reviewedAt: f?.reviewedAt?.timestampValue || f?.reviewedAt?.stringValue || null,
                rejectionReason: f?.rejectionReason?.stringValue || null,
              };
              map.set(id, reqItem);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not query Firestore payment requests:", e);
    }
  }

  const list = Array.from(map.values());
  // Sort pending first, then by createdAt desc
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
    const { createServer: createViteServer } = await import("vite");
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

// On Vercel the app is exported and run as a serverless function (see api/index.ts).
if (!process.env.VERCEL) {
  startServer();
}

export default app;
