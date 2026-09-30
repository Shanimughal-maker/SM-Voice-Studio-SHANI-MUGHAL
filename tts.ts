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
export type VoiceGender = "Male" | "Female";

export interface VoiceMetadata {
  name: GeminiVoice;
  gender: VoiceGender;
  character: string;
  label: string;
}

export const VOICE_METADATA: Record<GeminiVoice, VoiceMetadata> = {
  // Male (16)
  Puck: { name: "Puck", gender: "Male", character: "Upbeat", label: "Puck – Male, Upbeat" },
  Charon: { name: "Charon", gender: "Male", character: "Informative", label: "Charon – Male, Informative" },
  Fenrir: { name: "Fenrir", gender: "Male", character: "Excitable", label: "Fenrir – Male, Excitable" },
  Orus: { name: "Orus", gender: "Male", character: "Firm", label: "Orus – Male, Firm" },
  Enceladus: { name: "Enceladus", gender: "Male", character: "Breathy", label: "Enceladus – Male, Breathy" },
  Iapetus: { name: "Iapetus", gender: "Male", character: "Clear", label: "Iapetus – Male, Clear" },
  Umbriel: { name: "Umbriel", gender: "Male", character: "Easy-going", label: "Umbriel – Male, Easy-going" },
  Algenib: { name: "Algenib", gender: "Male", character: "Gravelly", label: "Algenib – Male, Gravelly" },
  Algieba: { name: "Algieba", gender: "Male", character: "Smooth", label: "Algieba – Male, Smooth" },
  Schedar: { name: "Schedar", gender: "Male", character: "Even", label: "Schedar – Male, Even" },
  Achird: { name: "Achird", gender: "Male", character: "Friendly", label: "Achird – Male, Friendly" },
  Zubenelgenubi: { name: "Zubenelgenubi", gender: "Male", character: "Casual", label: "Zubenelgenubi – Male, Casual" },
  Sadachbia: { name: "Sadachbia", gender: "Male", character: "Lively", label: "Sadachbia – Male, Lively" },
  Sadaltager: { name: "Sadaltager", gender: "Male", character: "Knowledgeable", label: "Sadaltager – Male, Knowledgeable" },
  Alnilam: { name: "Alnilam", gender: "Male", character: "Firm", label: "Alnilam – Male, Firm" },
  Rasalgethi: { name: "Rasalgethi", gender: "Male", character: "Informative", label: "Rasalgethi – Male, Informative" },

  // Female (14)
  Zephyr: { name: "Zephyr", gender: "Female", character: "Bright", label: "Zephyr – Female, Bright" },
  Kore: { name: "Kore", gender: "Female", character: "Firm", label: "Kore – Female, Firm" },
  Leda: { name: "Leda", gender: "Female", character: "Youthful", label: "Leda – Female, Youthful" },
  Aoede: { name: "Aoede", gender: "Female", character: "Breezy", label: "Aoede – Female, Breezy" },
  Callirrhoe: { name: "Callirrhoe", gender: "Female", character: "Easy-going", label: "Callirrhoe – Female, Easy-going" },
  Autonoe: { name: "Autonoe", gender: "Female", character: "Bright", label: "Autonoe – Female, Bright" },
  Despina: { name: "Despina", gender: "Female", character: "Smooth", label: "Despina – Female, Smooth" },
  Erinome: { name: "Erinome", gender: "Female", character: "Clear", label: "Erinome – Female, Clear" },
  Laomedeia: { name: "Laomedeia", gender: "Female", character: "Upbeat", label: "Laomedeia – Female, Upbeat" },
  Achernar: { name: "Achernar", gender: "Female", character: "Soft", label: "Achernar – Female, Soft" },
  Gacrux: { name: "Gacrux", gender: "Female", character: "Mature", label: "Gacrux – Female, Mature" },
  Pulcherrima: { name: "Pulcherrima", gender: "Female", character: "Forward", label: "Pulcherrima – Female, Forward" },
  Vindemiatrix: { name: "Vindemiatrix", gender: "Female", character: "Gentle", label: "Vindemiatrix – Female, Gentle" },
  Sulafat: { name: "Sulafat", gender: "Female", character: "Warm", label: "Sulafat – Female, Warm" },
};

export const getVoiceLabel = (voice: GeminiVoice): string => {
  return VOICE_METADATA[voice]?.label || `${voice}`;
};

export const TEXT_MODEL = "gemini-3.8-flash";

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

export const PREVIEW_SAMPLES: Record<string, string> = {
  English: "[slowly] Welcome to SM Voice Studio. This is how this voice sounds.",
  "Urdu (experimental)": "[slowly] خوش آمدید۔ یہ ایس ایم وائس اسٹوڈیو کی آواز ہے۔",
  Hindi: "[slowly] एसएम वॉयस स्टूडियो में आपका स्वागत है। यह आवाज ऐसी सुनाई देती है।",
  Arabic: "[slowly] مرحبًا بكم في استوديو إس إم الصوتي. هذا هو صوت هذا النموذج.",
  Spanish: "[slowly] Bienvenidos a SM Voice Studio. Así es como suena esta voz.",
  French: "[slowly] Bienvenue à SM Voice Studio. Voici comment sonne cette voix.",
  German: "[slowly] Willkommen bei SM Voice Studio. So klingt diese Stimme.",
  Italian: "[slowly] Benvenuti su SM Voice Studio. Ecco come suona questa voce.",
  "Portuguese (Brazil)": "[slowly] Bem-vindo ao SM Voice Studio. É assim que soa esta voz.",
  Bengali: "[slowly] এস এম ভয়েস স্টুডিওতে স্বাগতম। এই ভয়েসটি এমন শোনায়।",
  Russian: "[slowly] Добро пожаловать в SM Voice Studio. Так звучит этот голос.",
  Japanese: "[slowly] SM Voice Studioへようこそ。この音声のサンプルです。",
  Korean: "[slowly] SM Voice Studio에 오신 것을 환영합니다. 목소리 샘플입니다.",
  Turkish: "[slowly] SM Voice Studio'ya hoş geldiniz. Bu ses böyle duyuluyor.",
  Indonesian: "[slowly] Selamat datang di SM Voice Studio. Seperti inilah suara ini terdengar.",
  Dutch: "[slowly] Welkom bij SM Voice Studio. Zo klinkt deze stem.",
  Polish: "[slowly] Witamy w SM Voice Studio. Tak brzmi ten głos.",
  Romanian: "[slowly] Bun venit la SM Voice Studio. Așa sună această voce.",
  Ukrainian: "[slowly] Ласкаво просимо до SM Voice Studio. Так звучить цей голос.",
  Vietnamese: "[slowly] Chào mừng bạn đến với SM Voice Studio. Đây là giọng đọc mẫu.",
  Thai: "[slowly] ยินดีต้อนรับสู่ SM Voice Studio นี่คือเสียงตัวอย่าง",
  Marathi: "[slowly] एसएम व्हॉइस स्टुडिओमध्ये आपले स्वागत आहे.",
  Tamil: "[slowly] எஸ்எம் வாய்ஸ் ஸ்டுடியோவிற்கு வரவேற்கிறோம்.",
  Telugu: "[slowly] ఎస్ఎమ్ వాయిస్ స్టూడియోకి స్వాగతం.",
  "Auto-detect": "[slowly] Welcome to SM Voice Studio. This is how this voice sounds.",
};

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

export function splitSingleSpeakerScript(
  text: string,
  targetLength: number = 800
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const rawSentences: string[] = [];
  const sentencePattern = /[^.!?\n]+(?:[.!?]+(?:['"\)\]]+)?|\n+|$)/g;
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
      const sentenceChunks = splitSingleSpeakerScript(lineBody, targetLength - speakerPrefix.length);
      for (const sc of sentenceChunks) {
        processedLines.push(speakerPrefix ? `${speakerPrefix}${sc}` : sc);
      }
    }
  }

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

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function parseSampleRate(mimeType?: string): number {
  if (!mimeType) return 24000;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match && match[1]) {
    const rate = parseInt(match[1], 10);
    if (!isNaN(rate) && rate > 0) return rate;
  }
  return 24000;
}

export function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // 'RIFF' chunk descriptor
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'

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

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // 'data' subchunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'

  view.setUint32(40, dataLength, true);
  return new Uint8Array(buffer);
}

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

export async function sendGeminiRequest(
  model: string,
  userApiKey: string | null,
  body: any
): Promise<any> {
  const cleanKey = userApiKey?.trim();
  if (!cleanKey) {
    throw new Error("Please add your own Gemini API key to continue.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(cleanKey)}`;
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

export async function requestChunkAudio(
  model: string,
  userApiKey: string | null,
  payloadText: string,
  isTwoSpeaker: boolean,
  singleVoice: string,
  speaker1: { name: string; voice: string },
  speaker2: { name: string; voice: string },
  idToken?: string | null
): Promise<{ pcmBytes: Uint8Array; sampleRate: number }> {
  const cleanKey = userApiKey?.trim();
  if (!cleanKey) {
    throw new Error("Please add your own Gemini API key to continue.");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  const res = await fetch("/api/generate-speech", {
    method: "POST",
    headers,
    body: JSON.stringify({
      apiKey: cleanKey,
      idToken,
      text: payloadText,
      model,
      isTwoSpeaker,
      singleVoice,
      speaker1,
      speaker2,
    }),
  });
  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = await res.json();
      errDetail = errJson.error || res.statusText;
    } catch {
      errDetail = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errDetail);
  }
  const data = await res.json();
  if (!data.audioData) {
    throw new Error("No audio returned from server function.");
  }
  const sampleRate = parseSampleRate(data.mimeType || "audio/L16;rate=24000");
  const pcmBytes = base64ToUint8Array(data.audioData);
  return { pcmBytes, sampleRate };
}

export async function sendServerTranslation(
  idToken: string,
  apiKey: string,
  text: string,
  targetLang: string
): Promise<string> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    throw new Error("Please add your own Gemini API key to continue.");
  }
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      apiKey: cleanKey,
      idToken,
      text,
      targetLang,
    }),
  });
  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = await res.json();
      errDetail = errJson.error || res.statusText;
    } catch {
      errDetail = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errDetail);
  }
  const data = await res.json();
  return data.translatedText || "";
}

export async function sendServerTranscription(
  idToken: string,
  apiKey: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    throw new Error("Please add your own Gemini API key to continue.");
  }
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      apiKey: cleanKey,
      idToken,
      audioBase64,
      mimeType,
    }),
  });
  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = await res.json();
      errDetail = errJson.error || res.statusText;
    } catch {
      errDetail = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errDetail);
  }
  const data = await res.json();
  return data.transcript || "";
}

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

  if (
    rawMsg.includes("Free limit reached") ||
    lowerMsg.includes("free limit reached")
  ) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: false,
      isQuotaError: true,
      isModelUnavailable: false,
      retryDelaySeconds: 0,
      message: "Free limit reached. Upgrade to continue.",
    };
  }

  if (
    rawMsg.includes("Please add your own Gemini API key to continue") ||
    lowerMsg.includes("please add your own gemini api key to continue") ||
    rawMsg.includes("Enter your Gemini API key to start") ||
    lowerMsg.includes("enter your gemini api key to start")
  ) {
    return {
      isLimitZero: false,
      isDailyQuotaExhausted: false,
      isQuotaError: false,
      isModelUnavailable: false,
      retryDelaySeconds: 0,
      message: "Please add your own Gemini API key to continue.",
    };
  }

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

  return {
    isLimitZero: false,
    isDailyQuotaExhausted: false,
    isQuotaError: false,
    isModelUnavailable: false,
    retryDelaySeconds: delay,
    message: rawMsg,
  };
}

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
      if (parsed.isLimitZero) {
        return { error: parsed.message };
      }
      if (parsed.isDailyQuotaExhausted) {
        return { error: parsed.message };
      }
      if (parsed.isModelUnavailable) {
        return { error: parsed.message };
      }
      if (parsed.retryDelaySeconds === 0) {
        return { error: parsed.message };
      }
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
