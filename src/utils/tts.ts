/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GEMINI_VOICES = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Puck",
  "Pulcherrima",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
] as const;

export type GeminiVoice = (typeof GEMINI_VOICES)[number];

export const TEXT_MODEL = "gemini-3.6-flash";

export const TTS_MODELS = [
  { id: "gemini-3.1-flash-tts-preview", name: "Gemini 3.1 Flash TTS (Default)" },
  { id: "gemini-2.5-flash-preview-tts", name: "Gemini 2.5 Flash TTS" },
  { id: "gemini-2.5-pro-preview-tts", name: "Gemini 2.5 Pro TTS" },
] as const;

export const MODELS = TTS_MODELS;
export type TTSModelId = (typeof TTS_MODELS)[number]["id"];

export const LANGUAGES = [
  "Auto-detect",
  "English",
  "Urdu (experimental)",
  "Hindi",
  "Arabic",
  "Bengali",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese (Brazil)",
  "Dutch",
  "Polish",
  "Romanian",
  "Russian",
  "Ukrainian",
  "Turkish",
  "Indonesian",
  "Vietnamese",
  "Thai",
  "Japanese",
  "Korean",
  "Marathi",
  "Tamil",
  "Telugu",
] as const;

export const ACCENTS_BY_LANGUAGE: Record<string, string[]> = {
  English: ["Neutral American", "British", "Indian", "Australian", "Pakistani"],
  "Urdu (experimental)": ["Pakistani", "Indian Standard"],
  Hindi: ["Standard North Indian", "Regional"],
  Arabic: ["Modern Standard Arabic", "Egyptian", "Gulf", "Levantine"],
  Bengali: ["Standard Bangladeshi", "West Bengal"],
  Spanish: ["Neutral", "Mexican", "Castilian"],
  French: ["France", "Canadian"],
  German: ["Germany Standard", "Austrian", "Swiss"],
  Italian: ["Standard Italian"],
  "Portuguese (Brazil)": ["Brazilian", "European"],
  Dutch: ["Netherlands Standard", "Belgian Flemish"],
  Polish: ["Standard Polish"],
  Romanian: ["Standard Romanian"],
  Russian: ["Standard Russian"],
  Ukrainian: ["Standard Ukrainian"],
  Turkish: ["Standard Turkish"],
  Indonesian: ["Standard Indonesian"],
  Vietnamese: ["Standard Vietnamese (Northern)", "Southern"],
  Thai: ["Standard Thai"],
  Japanese: ["Standard Japanese (Tokyo)"],
  Korean: ["Standard Korean (Seoul)"],
  Marathi: ["Standard Marathi"],
  Tamil: ["Standard Tamil (Indian)", "Sri Lankan"],
  Telugu: ["Standard Telugu"],
  "Auto-detect": ["Standard"],
};

export const VOICE_STYLES = [
  "Storytelling",
  "News anchor",
  "Documentary",
  "Dramatic / Cinematic",
  "Calm and soothing",
  "Energetic / Upbeat",
  "Whisper",
  "Serious / Authoritative",
  "Friendly conversational",
  "Audiobook",
  "Motivational",
  "Advertisement",
] as const;

export const PACES = ["Normal", "Slow", "Fast"] as const;

export const SYSTEM_CONTEXT_PREFIX =
  "System Context: You are narrating a prehistoric survival documentary. The following text contains stage directions inside brackets. STRICTLY DO NOT read any bracketed words out loud. Use them exclusively to guide your emotional tone, pacing, and pauses. Text to narrate: ";

// Preview sample sentences in native scripts where appropriate
export const PREVIEW_SAMPLES: Record<string, string> = {
  English: "[slowly] Welcome to SM Voice Studio. This is how this voice sounds.",
  "Urdu (experimental)":
    "[slowly] ایس ایم وائس اسٹوڈیو میں خوش آمدید۔ یہ آواز اس طرح سنائی دیتی ہے۔",
  Hindi:
    "[slowly] एसएम वॉयस स्टूडियो में आपका स्वागत है। यह आवाज इस तरह सुनाई देती है।",
  Arabic:
    "[slowly] مرحبًا بكم في إس إم فويس ستوديو. هكذا يبدو هذا الصوت.",
  Spanish:
    "[slowly] Bienvenidos a SM Voice Studio. Así es como suena esta voz.",
  French:
    "[slowly] Bienvenue à SM Voice Studio. Voici comment sonne cette voix.",
  German:
    "[slowly] Willkommen bei SM Voice Studio. So klingt diese Stimme.",
  Italian:
    "[slowly] Benvenuti su SM Voice Studio. Ecco come suona questa voce.",
  "Portuguese (Brazil)":
    "[slowly] Bem-vindo ao SM Voice Studio. É assim que soa esta voz.",
  Bengali:
    "[slowly] এসএম ভয়েস স্টুডিওতে স্বাগতম। এই কণ্ঠস্বরটি এমন শোনায়।",
  Russian:
    "[slowly] Добро пожаловать в SM Voice Studio. Так звучит этот голос.",
  Japanese:
    "[slowly] SM Voice Studioへようこそ。この声はこのように聞こえます。",
  Korean:
    "[slowly] SM Voice Studio에 오신 것을 환영합니다. 이 목소리는 이렇게 들립니다.",
  Turkish:
    "[slowly] SM Voice Studio'ya hoş geldiniz. Bu ses böyle duyuluyor.",
  Indonesian:
    "[slowly] Selamat datang di SM Voice Studio. Seperti inilah suara ini terdengar.",
  Dutch:
    "[slowly] Welkom bij SM Voice Studio. Zo klinkt deze stem.",
  Polish:
    "[slowly] Witamy w SM Voice Studio. Tak brzmi ten głos.",
  Romanian:
    "[slowly] Bun venit la SM Voice Studio. Așa sună această voce.",
  Ukrainian:
    "[slowly] Ласкаво просимо до SM Voice Studio. Ось так звучить цей голос.",
  Vietnamese:
    "[slowly] Chào mừng bạn đến với SM Voice Studio. Đây là giọng đọc mẫu.",
  Thai:
    "[slowly] ยินดีต้อนรับสู่ SM Voice Studio นี่คือเสียงตัวอย่าง.",
  Marathi:
    "[slowly] एसएम व्हॉइस स्टुडिओमध्ये आपले स्वागत आहे. हा आवाज असा ऐकू येतो.",
  Tamil:
    "[slowly] எஸ்எம் வாய்ஸ் ஸ்டுடியோவிற்கு வரவேற்கிறோம். இந்த குரல் இப்படித்தான் ஒலிக்கும்.",
  Telugu:
    "[slowly] ఎస్ఎమ్ వాయిస్ స్టూడియోకు స్వాగతం. ఈ వాయిస్ ఇలా వినిపిస్తుంది.",
  "Auto-detect":
    "[slowly] Welcome to SM Voice Studio. This is how this voice sounds.",
};

/**
 * Builds the exact required style directive and payload for Gemini TTS.
 * PAYLOAD = PREFIX + "[Delivery style: {style}. Language: {language}. Accent: {accent}. Pace: {pace}. This directive overrides any default tone.] " + chunk_text
 */
export function buildPayload(
  chunkText: string,
  style: string,
  language: string,
  accent: string,
  pace: string
): string {
  const directive = `[Delivery style: ${style}. Language: ${language}. Accent: ${accent}. Pace: ${pace}. This directive overrides any default tone.] `;
  return SYSTEM_CONTEXT_PREFIX + directive + chunkText;
}

/**
 * Splits text into chunks of about targetLength (default 800 characters),
 * always cutting at natural sentence endings (. ! ? and Urdu/Hindi/Arabic equivalents).
 * If a single sentence exceeds targetLength, it is split at word boundaries.
 */
export function splitSingleSpeakerScript(
  text: string,
  targetLength: number = 800
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Match sentences ending in punctuation (. ! ? and Urdu ۔, Hindi ।, Arabic ؟, etc.),
  // followed by optional quotes/brackets or newlines
  const rawSentences: string[] = [];
  const sentencePattern = /[^.!?۔।॥؟\n]+(?:[.!?۔।॥؟]+(?:['"”’\)\]]+)?|\n+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(trimmed)) !== null) {
    const s = match[0].trim();
    if (s.length > 0) {
      rawSentences.push(s);
    }
  }

  if (rawSentences.length === 0) {
    rawSentences.push(trimmed);
  }

  // Handle sentences that by themselves exceed targetLength by splitting at word boundaries
  const safePieces: string[] = [];
  for (const sentence of rawSentences) {
    if (sentence.length <= targetLength) {
      safePieces.push(sentence);
    } else {
      const words = sentence.split(/\s+/).filter(Boolean);
      let piece = "";
      for (const w of words) {
        if (!piece) {
          piece = w;
        } else if ((piece + " " + w).length <= targetLength) {
          piece += " " + w;
        } else {
          safePieces.push(piece);
          piece = w;
        }
      }
      if (piece) {
        safePieces.push(piece);
      }
    }
  }

  // Combine pieces into chunks of up to ~targetLength
  const chunks: string[] = [];
  let currentChunk = "";

  for (const piece of safePieces) {
    if (!currentChunk) {
      currentChunk = piece;
    } else if ((currentChunk + " " + piece).length <= targetLength) {
      currentChunk += " " + piece;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = piece;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Two-speaker dialogue chunking:
 * Chunks at line boundaries (about 800 characters per chunk) and never breaks a line away from its speaker label.
 * If one line is longer than 800 characters, splits it at a sentence ending and repeats the speaker label.
 */
export function splitTwoSpeakerScript(
  text: string,
  speaker1Name: string,
  speaker2Name: string,
  targetLength: number = 800
): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const processedLines: string[] = [];

  for (const line of lines) {
    // Check if line starts with Speaker1 or Speaker2 prefix
    let speakerPrefix = "";
    let lineBody = line;

    const s1Prefix = `${speaker1Name}:`;
    const s2Prefix = `${speaker2Name}:`;

    if (line.toLowerCase().startsWith(s1Prefix.toLowerCase())) {
      speakerPrefix = `${speaker1Name}: `;
      lineBody = line.slice(s1Prefix.length).trim();
    } else if (line.toLowerCase().startsWith(s2Prefix.toLowerCase())) {
      speakerPrefix = `${speaker2Name}: `;
      lineBody = line.slice(s2Prefix.length).trim();
    }

    if (line.length <= targetLength) {
      processedLines.push(line);
    } else {
      // Split overlong line at sentence endings and repeat speaker label
      const sentenceChunks = splitSingleSpeakerScript(lineBody, targetLength - speakerPrefix.length);
      for (const sc of sentenceChunks) {
        processedLines.push(speakerPrefix ? `${speakerPrefix}${sc}` : sc);
      }
    }
  }

  // Now group lines into chunks of up to targetLength
  const chunks: string[] = [];
  let current = "";

  for (const line of processedLines) {
    if (!current) {
      current = line;
    } else if ((current + "\n" + line).length <= targetLength) {
      current += "\n" + line;
    } else {
      chunks.push(current);
      current = line;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Converts a base64 string into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Parses the sample rate from audio mimeType string.
 */
export function parseSampleRate(mimeType?: string): number {
  if (!mimeType) return 24000;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const rate = parseInt(match[1], 10);
    if (!isNaN(rate) && rate > 0) return rate;
  }
  return 24000;
}

/**
 * Generates a valid 44-byte standard RIFF WAV header for 16-bit Mono PCM audio.
 */
export function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // 'RIFF' chunk descriptor
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  // File size - 8 = 36 + dataLength
  view.setUint32(4, 36 + dataLength, true);

  // 'WAVE' format
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // 'fmt ' subchunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  // Subchunk1Size = 16 for PCM
  view.setUint32(16, 16, true);
  // AudioFormat = 1 (linear PCM)
  view.setUint16(20, 1, true);
  // NumChannels = 1 (mono)
  view.setUint16(22, 1, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate = SampleRate * NumChannels * BitsPerSample / 8 (sampleRate * 1 * 2)
  view.setUint32(28, sampleRate * 2, true);
  // BlockAlign = NumChannels * BitsPerSample / 8 (2 bytes per sample for 16-bit mono)
  view.setUint16(32, 2, true);
  // BitsPerSample = 16
  view.setUint16(34, 16, true);

  // 'data' subchunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  // Subchunk2Size (data size in bytes)
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
}

/**
 * Merges multiple raw 16-bit mono PCM chunks into a single playable WAV Blob.
 */
export function mergePcmChunks(chunks: Uint8Array[], sampleRate: number): Blob {
  const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const wavHeader = createWavHeader(totalLength, sampleRate);

  const merged = new Uint8Array(wavHeader.byteLength + totalLength);
  merged.set(wavHeader, 0);

  let offset = wavHeader.byteLength;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([merged], { type: "audio/wav" });
}

/**
 * Cancellable sleep that checks cancellation every 200ms
 */
export async function cancellableSleep(
  ms: number,
  isCancelled?: () => boolean
): Promise<void> {
  const step = 200;
  let elapsed = 0;
  while (elapsed < ms) {
    if (isCancelled && isCancelled()) {
      break;
    }
    const waitTime = Math.min(step, ms - elapsed);
    await new Promise((r) => setTimeout(r, waitTime));
    elapsed += waitTime;
  }
}

/**
 * Direct browser dispatch function:
 * Every request goes directly from the browser to the Gemini REST API using the key typed by the visitor.
 * If no key is provided, throws: "Enter your Gemini API key to start. You can get a free key from aistudio.google.com/apikey"
 */
export async function sendGeminiRequest(
  model: string,
  userApiKey: string | null,
  body: any
): Promise<any> {
  const cleanKey = userApiKey?.trim();
  if (!cleanKey) {
    throw new Error(
      "Enter your Gemini API key to start. You can get a free key from aistudio.google.com/apikey"
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    cleanKey
  )}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errDetail = "";
    try {
      const errJson = await response.json();
      const msg = errJson.error?.message || "";
      const status = errJson.error?.status || "";
      const details = JSON.stringify(errJson.error?.details || "");
      errDetail = `${msg} ${status} ${details}`.trim() || response.statusText;
    } catch {
      errDetail = response.statusText || `HTTP ${response.status}`;
    }
    throw new Error(`API error (${response.status}): ${errDetail}`);
  }

  return await response.json();
}

/**
 * Request audio generation for a single chunk (Single or Two-speaker).
 */
export async function requestChunkAudio(
  model: string,
  userApiKey: string | null,
  payloadText: string,
  isTwoSpeaker: boolean,
  singleVoice: string,
  speaker1: { name: string; voice: string },
  speaker2: { name: string; voice: string }
): Promise<{ pcmBytes: Uint8Array; sampleRate: number }> {
  let speechConfig: any;

  if (isTwoSpeaker) {
    speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [
          {
            speaker: speaker1.name,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speaker1.voice },
            },
          },
          {
            speaker: speaker2.name,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speaker2.voice },
            },
          },
        ],
      },
    };
  } else {
    speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: singleVoice },
      },
    };
  }

  const requestBody = {
    contents: [{ parts: [{ text: payloadText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig,
    },
  };

  const data = await sendGeminiRequest(model, userApiKey, requestBody);
  const part = data.candidates?.[0]?.content?.parts?.[0];
  const inlineData = part?.inlineData;

  if (!inlineData?.data) {
    throw new Error("No audio returned from Gemini API");
  }

  const sampleRate = parseSampleRate(inlineData.mimeType);
  const pcmBytes = base64ToUint8Array(inlineData.data);
  return { pcmBytes, sampleRate };
}

/**
 * Parses an error from Gemini API or the backend proxy.
 * Checks for:
 * - "limit: 0" (free tier limit 0 error): do not retry
 * - Model unavailable or not found: do not retry
 * - 429 / quota error: parse delay "Please retry in X s" (clamped 8 to 60 seconds)
 */
export function parseGeminiError(rawError: any): {
  isLimitZero: boolean;
  isDailyQuotaExhausted: boolean;
  isQuotaError: boolean;
  isModelUnavailable: boolean;
  retryDelaySeconds: number;
  message: string;
} {
  const rawMsg = String(rawError?.message || rawError || "");
  const lowerMsg = rawMsg.toLowerCase();

  // Missing API Key
  if (
    rawMsg.includes("Enter your Gemini API key to start") ||
    lowerMsg.includes("enter your gemini api key to start")
  ) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: false,
      isQuotaError: false,
      isModelUnavailable: false,
      retryDelaySeconds: 0,
      message:
        "Enter your Gemini API key to start. You can get a free key from aistudio.google.com/apikey",
    };
  }

  // 1. Quota error: limit: 0 (free tier limit 0)
  if (lowerMsg.includes("limit: 0") || lowerMsg.includes("limit:0")) {
    return {
      isLimitZero: true,
      isDailyQuotaExhausted: false,
      isQuotaError: false,
      isModelUnavailable: false,
      retryDelaySeconds: 0,
      message:
        "This model has no free quota for your key. Choose another model or enable billing in Google AI Studio.",
    };
  }

  // Parse delay from "Please retry in X s" (clamped at least 8, at most 65 seconds)
  let delay = 8;
  const match = rawMsg.match(
    /(?:Please\s+)?retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*s?/i
  );
  if (match && match[1]) {
    const parsed = parseFloat(match[1]);
    if (!isNaN(parsed)) {
      delay = Math.min(65, Math.max(8, Math.ceil(parsed)));
    }
  }

  // 2. Specific Quota Errors: "exceeded your current quota", "free_tier_requests", or "RESOURCE_EXHAUSTED"
  const isQuotaMention =
    lowerMsg.includes("exceeded your current quota") ||
    lowerMsg.includes("free_tier_requests") ||
    lowerMsg.includes("resource_exhausted");

  if (isQuotaMention) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: false,
      isQuotaError: true,
      isModelUnavailable: false,
      retryDelaySeconds: delay,
      message:
        "Free quota reached (probably the daily limit). Your finished chunks are saved. Press Generate again later to continue, or enable billing in Google AI Studio.",
    };
  }

  // 3. Daily quota error: "PerDay" or "per day"
  if (rawMsg.includes("PerDay") || lowerMsg.includes("per day")) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: true,
      isQuotaError: false,
      isModelUnavailable: false,
      retryDelaySeconds: 0,
      message:
        "Daily quota finished. Try again tomorrow or enable billing in Google AI Studio.",
    };
  }

  // 4. Model unavailable or not found
  if (
    lowerMsg.includes("not found") ||
    lowerMsg.includes("not supported") ||
    lowerMsg.includes("not available") ||
    lowerMsg.includes("is not allowed") ||
    rawMsg.includes("404")
  ) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: false,
      isQuotaError: false,
      isModelUnavailable: true,
      retryDelaySeconds: 0,
      message: "This model is not available. Please choose another model.",
    };
  }

  // 5. Other 429 / general errors
  return {
    isLimitZero: false,
    isDailyQuotaExhausted: false,
    isQuotaError: false,
    isModelUnavailable: false,
    retryDelaySeconds: delay,
    message: rawMsg,
  };
}

/**
 * Executes a Gemini request with smart quota retry logic:
 * - If error contains "limit: 0", does NOT retry. Returns specific quota instruction.
 * - If error mentions quota ("exceeded your current quota", "free_tier_requests", "RESOURCE_EXHAUSTED"):
 *   waits for "Please retry in X s" (8-65s) and retries ONCE. If it fails again, returns
 *   "Free quota reached (probably the daily limit). Your finished chunks are saved. Press Generate again later to continue, or enable billing in Google AI Studio."
 * - If error contains "PerDay" or "per day", does NOT retry. Returns daily quota message.
 * - If model is unavailable or not found, does NOT retry. Returns specific model message.
 * - For any other 429 error, waits parsed delay (min 8s, max 60s), retries up to 2 times invisibly.
 * - If it still fails, returns the error message to display as ONE plain line.
 */
export async function executeWithQuotaRetry<T>(
  action: () => Promise<T>,
  isCancelled?: () => boolean
): Promise<{ result?: T; error?: string }> {
  let quotaRetryCount = 0;
  let genericRetryCount = 0;

  while (true) {
    if (isCancelled && isCancelled()) {
      return { error: "" };
    }

    try {
      const result = await action();
      return { result };
    } catch (err: any) {
      const parsed = parseGeminiError(err);

      // If limit: 0, do NOT retry. Stop immediately.
      if (parsed.isLimitZero) {
        return { error: parsed.message };
      }

      // If daily quota finished, do NOT retry. Stop immediately.
      if (parsed.isDailyQuotaExhausted) {
        return { error: parsed.message };
      }

      // If model unavailable or not found, do NOT retry. Stop immediately.
      if (parsed.isModelUnavailable) {
        return { error: parsed.message };
      }

      // If non-retryable error (e.g. missing key), stop immediately.
      if (parsed.retryDelaySeconds === 0) {
        return { error: parsed.message };
      }

      // If quota error ("exceeded your current quota", "free_tier_requests", or "RESOURCE_EXHAUSTED"):
      // Retry ONCE after waiting the parsed delay (8 to 65s)
      if (parsed.isQuotaError) {
        if (quotaRetryCount >= 1) {
          return { error: parsed.message };
        }
        quotaRetryCount++;
        const waitMs = parsed.retryDelaySeconds * 1000;
        await cancellableSleep(waitMs, isCancelled);
        if (isCancelled && isCancelled()) {
          return { error: "" };
        }
        continue;
      }

      // For generic 429 / transient errors: maximum 2 retries
      if (genericRetryCount >= 2) {
        return { error: parsed.message };
      }

      genericRetryCount++;
      const waitMs = parsed.retryDelaySeconds * 1000;
      await cancellableSleep(waitMs, isCancelled);
      if (isCancelled && isCancelled()) {
        return { error: "" };
      }
    }
  }
}
