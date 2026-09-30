/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  GEMINI_VOICES,
  TTS_MODELS,
  LANGUAGES,
  ACCENTS_BY_LANGUAGE,
  VOICE_STYLES,
  PACES,
  PREVIEW_SAMPLES,
  VOICE_METADATA,
  getVoiceLabel,
  buildPayload,
  splitSingleSpeakerScript,
  splitTwoSpeakerScript,
  mergePcmChunks,
  requestChunkAudio,
  sendServerTranslation,
  sendServerTranscription,
  executeWithQuotaRetry,
  cancellableSleep,
  type GeminiVoice,
} from "./utils/tts";
import {
  computeChunkHash,
  getCachedChunk,
  saveCachedChunk,
  clearAllCachedChunks,
  getCachedChunksCount,
} from "./utils/chunkStorage";
import {
  Key,
  Volume2,
  Play,
  Square,
  Download,
  Sparkles,
  Eye,
  EyeOff,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  Upload,
  Languages,
  FileAudio,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  X,
} from "lucide-react";
import {
  auth,
  ensureUserProfile,
  subscribeUserProfile,
  recordServerUsage,
  loadPricingSettings,
  loadPaymentMethods,
  subscribePaymentRequests,
  DEFAULT_PRICING,
  DEFAULT_PAYMENT_METHODS,
  type UserProfile,
  type User,
  type PlanType,
  type PricingSettings,
  type PaymentMethodItem,
  type PaymentRequest,
  onAuthStateChanged,
} from "./utils/firebase";
import { AuthScreen } from "./components/AuthScreen";
import { UsageHeader } from "./components/UsageHeader";
import { UpgradeModal } from "./components/UpgradeModal";
import { PricingSection } from "./components/PricingSection";
import { ManualPaymentModal } from "./components/ManualPaymentModal";
import { PaymentRequestsList } from "./components/PaymentRequestsList";
import { RedeemLicenseCard } from "./components/RedeemLicenseCard";
import { AdminPaymentPanel } from "./components/AdminPaymentPanel";

export default function App() {
  // Developer title check
  useEffect(() => {
    document.title = "SM Voice Studio – SHANI MUGHAL";
  }, []);

  // Firebase User Authentication & Quota State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // Pricing & Payments State
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(DEFAULT_PRICING);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(DEFAULT_PAYMENT_METHODS);
  const [userPaymentRequests, setUserPaymentRequests] = useState<PaymentRequest[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanType>("monthly");
  const [selectedPriceUSD, setSelectedPriceUSD] = useState<number>(2);
  const [selectedPricePKR, setSelectedPricePKR] = useState<number>(560);

  const userPendingPaymentsCount = useMemo(() => {
    return userPaymentRequests.filter((r) => r.status === "pending").length;
  }, [userPaymentRequests]);

  // Load pricing & payment methods settings on startup
  useEffect(() => {
    loadPricingSettings().then((p) => setPricingSettings(p));
    loadPaymentMethods().then((m) => setPaymentMethods(m));
  }, []);

  // Real-time listener for user's payment requests
  useEffect(() => {
    if (!currentUser) {
      setUserPaymentRequests([]);
      return;
    }
    const unsub = subscribePaymentRequests(
      currentUser.uid,
      (requests) => setUserPaymentRequests(requests)
    );
    return () => unsub();
  }, [currentUser]);

  // Monitor Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);
        } catch (e) {
          console.error("Error initializing user profile:", e);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for user profile & quota changes from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeUserProfile(
      currentUser.uid,
      (profile) => {
        if (profile) {
          setUserProfile(profile);
        }
      },
      (err) => {
        console.warn("User profile listener:", err);
      }
    );
    return () => unsub();
  }, [currentUser?.uid]);

  // Active tab: 'studio' | 'translate' | 'account'
  const [activeTab, setActiveTab] = useState<"studio" | "translate" | "account">("studio");

  // First-time dismissible note
  const [showFirstTimeNote, setShowFirstTimeNote] = useState<boolean>(() => {
    return localStorage.getItem("sm_hide_first_time_note") !== "true";
  });
  const handleDismissFirstTimeNote = () => {
    setShowFirstTimeNote(false);
    localStorage.setItem("sm_hide_first_time_note", "true");
  };

  // User API key management (OFF by default)
  const [typedApiKey, setTypedApiKey] = useState<string>("");
  const [activeUserApiKey, setActiveUserApiKey] = useState<string | null>(null);
  const [rememberKey, setRememberKey] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Check saved key on mount if user previously opted to remember
  useEffect(() => {
    const savedKey = localStorage.getItem("sm_gemini_user_key");
    if (savedKey) {
      setTypedApiKey(savedKey);
      setActiveUserApiKey(savedKey);
      setRememberKey(true);
    }
  }, []);

  const handleApplyKey = () => {
    const clean = typedApiKey.trim();
    if (!clean) {
      setActiveUserApiKey(null);
      localStorage.removeItem("sm_gemini_user_key");
      setErrorMessage("Please add your own Gemini API key to continue.");
      return;
    }
    setActiveUserApiKey(clean);
    setErrorMessage(null);
    if (rememberKey) {
      localStorage.setItem("sm_gemini_user_key", clean);
    } else {
      localStorage.removeItem("sm_gemini_user_key");
    }
  };

  const handleClearKey = () => {
    setTypedApiKey("");
    setActiveUserApiKey(null);
    localStorage.removeItem("sm_gemini_user_key");
    setErrorMessage(null);
  };

  const handleRememberToggle = (checked: boolean) => {
    setRememberKey(checked);
    if (checked && activeUserApiKey) {
      localStorage.setItem("sm_gemini_user_key", activeUserApiKey);
    } else {
      localStorage.removeItem("sm_gemini_user_key");
    }
  };

  // Studio Settings
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Auto-detect");
  const [selectedAccent, setSelectedAccent] = useState<string>("Standard");
  const [selectedStyle, setSelectedStyle] = useState<string>("Documentary");
  const [selectedPace, setSelectedPace] = useState<string>("Normal");
  const [selectedModel, setSelectedModel] = useState<string>(
    TTS_MODELS[0].id
  );
  const [waitBetweenChunks, setWaitBetweenChunks] = useState<number>(21000);
  const [chunkSize, setChunkSize] = useState<number>(800);
  const [savedProgressCount, setSavedProgressCount] = useState<number>(0);

  // Load count of cached chunks from IndexedDB
  useEffect(() => {
    getCachedChunksCount()
      .then((cnt) => setSavedProgressCount(cnt))
      .catch(() => {});
  }, []);

  // Clear saved progress
  const handleClearSavedProgress = async () => {
    try {
      await clearAllCachedChunks();
      setSavedProgressCount(0);
      setErrorMessage("Saved progress cleared.");
      setTimeout(() => {
        setErrorMessage((prev) =>
          prev === "Saved progress cleared." ? null : prev
        );
      }, 3000);
    } catch {
      setErrorMessage("Could not clear saved progress.");
    }
  };

  // Update accent when language changes
  useEffect(() => {
    const accents = ACCENTS_BY_LANGUAGE[selectedLanguage] || ["Standard"];
    setSelectedAccent(accents[0]);
  }, [selectedLanguage]);

  // Single vs Two-speaker mode
  const [isTwoSpeaker, setIsTwoSpeaker] = useState<boolean>(false);
  const [singleVoice, setSingleVoice] = useState<GeminiVoice>("Charon");
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [speaker1, setSpeaker1] = useState<{ name: string; voice: GeminiVoice }>({
    name: "Speaker1",
    voice: "Charon",
  });
  const [speaker1GenderFilter, setSpeaker1GenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [speaker2, setSpeaker2] = useState<{ name: string; voice: GeminiVoice }>({
    name: "Speaker2",
    voice: "Aoede",
  });
  const [speaker2GenderFilter, setSpeaker2GenderFilter] = useState<"All" | "Male" | "Female">("All");

  // Filtered voice lists based on gender filter
  const filteredVoices = useMemo(() => {
    if (genderFilter === "All") return GEMINI_VOICES;
    return GEMINI_VOICES.filter(
      (v) => VOICE_METADATA[v]?.gender === genderFilter
    );
  }, [genderFilter]);

  const speaker1FilteredVoices = useMemo(() => {
    if (speaker1GenderFilter === "All") return GEMINI_VOICES;
    return GEMINI_VOICES.filter(
      (v) => VOICE_METADATA[v]?.gender === speaker1GenderFilter
    );
  }, [speaker1GenderFilter]);

  const speaker2FilteredVoices = useMemo(() => {
    if (speaker2GenderFilter === "All") return GEMINI_VOICES;
    return GEMINI_VOICES.filter(
      (v) => VOICE_METADATA[v]?.gender === speaker2GenderFilter
    );
  }, [speaker2GenderFilter]);

  const handleGenderFilterChange = (newGender: "All" | "Male" | "Female") => {
    setGenderFilter(newGender);
    if (newGender !== "All") {
      const currentInfo = VOICE_METADATA[singleVoice];
      if (currentInfo && currentInfo.gender !== newGender) {
        const firstMatch = GEMINI_VOICES.find(
          (v) => VOICE_METADATA[v]?.gender === newGender
        );
        if (firstMatch) {
          setSingleVoice(firstMatch);
        }
      }
    }
  };

  const handleSpeaker1GenderFilterChange = (
    newGender: "All" | "Male" | "Female"
  ) => {
    setSpeaker1GenderFilter(newGender);
    if (newGender !== "All") {
      const currentInfo = VOICE_METADATA[speaker1.voice];
      if (currentInfo && currentInfo.gender !== newGender) {
        const firstMatch = GEMINI_VOICES.find(
          (v) => VOICE_METADATA[v]?.gender === newGender
        );
        if (firstMatch) {
          setSpeaker1((prev) => ({ ...prev, voice: firstMatch }));
        }
      }
    }
  };

  const handleSpeaker2GenderFilterChange = (
    newGender: "All" | "Male" | "Female"
  ) => {
    setSpeaker2GenderFilter(newGender);
    if (newGender !== "All") {
      const currentInfo = VOICE_METADATA[speaker2.voice];
      if (currentInfo && currentInfo.gender !== newGender) {
        const firstMatch = GEMINI_VOICES.find(
          (v) => VOICE_METADATA[v]?.gender === newGender
        );
        if (firstMatch) {
          setSpeaker2((prev) => ({ ...prev, voice: firstMatch }));
        }
      }
    }
  };

  // Script text in Studio tab
  const [scriptText, setScriptText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview state
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [previewSpeakerNum, setPreviewSpeakerNum] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Translate & Dub Tab state
  const [translateMode, setTranslateMode] = useState<"text" | "audio">("text");
  const [translateSourceText, setTranslateSourceText] = useState<string>("");
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [translateTargetLang, setTranslateTargetLang] = useState<string>("Spanish");
  const [translatedResultText, setTranslatedResultText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translateProgress, setTranslateProgress] = useState<string>("");
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // Key availability check
  const isKeyAvailable = Boolean(activeUserApiKey && activeUserApiKey.trim().length > 0);

  // Script stats
  const characterCount = scriptText.length;
  const wordCount = useMemo(() => {
    const trimmed = scriptText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [scriptText]);

  const estimatedChunks = useMemo(() => {
    if (!scriptText.trim()) return 0;
    if (isTwoSpeaker) {
      return splitTwoSpeakerScript(
        scriptText,
        speaker1.name,
        speaker2.name,
        chunkSize
      ).length;
    }
    return splitSingleSpeakerScript(scriptText, chunkSize).length;
  }, [scriptText, isTwoSpeaker, speaker1.name, speaker2.name, chunkSize]);

  const estimatedMinutes = useMemo(() => {
    if (wordCount === 0) return 0;
    return Math.max(1, Math.ceil(wordCount / 150));
  }, [wordCount]);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, [generatedAudioUrl]);

  // 1. Play Preview
  const handlePlayPreview = async (speakerNum?: 1 | 2 | React.MouseEvent) => {
    setErrorMessage(null);
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setIsPreviewPlaying(false);
      setPreviewSpeakerNum(null);
      return;
    }

    if (!isKeyAvailable) {
      setErrorMessage("Please add your own Gemini API key to continue.");
      return;
    }

    const currentSpeaker: 1 | 2 = typeof speakerNum === "number" ? speakerNum : 1;
    setPreviewSpeakerNum(currentSpeaker);
    setIsPreviewLoading(true);

    const sampleText =
      PREVIEW_SAMPLES[selectedLanguage] || PREVIEW_SAMPLES["English"];
    const payload = buildPayload(
      sampleText,
      selectedStyle,
      selectedLanguage,
      selectedAccent,
      selectedPace
    );

    const voiceToTest = isTwoSpeaker
      ? currentSpeaker === 2
        ? speaker2.voice
        : speaker1.voice
      : singleVoice;

    const idToken = await currentUser?.getIdToken();
    const { result: pcmResult, error: previewErr } =
      await executeWithQuotaRetry(() =>
        requestChunkAudio(
          selectedModel,
          activeUserApiKey,
          payload,
          false,
          voiceToTest,
          speaker1,
          speaker2,
          idToken
        )
      );

    setIsPreviewLoading(false);
    if (previewErr || !pcmResult) {
      setPreviewSpeakerNum(null);
      setErrorMessage(
        previewErr || "Failed to generate preview. Please check your API key."
      );
      return;
    }

    try {
      const previewBlob = mergePcmChunks(
        [pcmResult.pcmBytes],
        pcmResult.sampleRate
      );
      const previewUrl = URL.createObjectURL(previewBlob);

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const audio = new Audio(previewUrl);
      previewAudioRef.current = audio;
      audio.onplay = () => setIsPreviewPlaying(true);
      audio.onended = () => {
        setIsPreviewPlaying(false);
        setPreviewSpeakerNum(null);
        URL.revokeObjectURL(previewUrl);
      };
      audio.onerror = () => {
        setIsPreviewPlaying(false);
        setPreviewSpeakerNum(null);
        URL.revokeObjectURL(previewUrl);
      };
      await audio.play();
    } catch {
      setIsPreviewPlaying(false);
      setPreviewSpeakerNum(null);
      setErrorMessage("Unable to play preview audio.");
    }
  };

  // 2. Generate Voiceover with Chunking, Stop Support & Silent Retry
  const handleGenerateVoiceover = async () => {
    setErrorMessage(null);
    if (!isKeyAvailable) {
      setErrorMessage("Please add your own Gemini API key to continue.");
      return;
    }

    if (!scriptText.trim()) {
      setErrorMessage("Please paste or enter your script first.");
      return;
    }

    // Quota Enforcement Check
    const scriptChars = scriptText.trim().length;
    if (userProfile?.plan === "free") {
      const used = userProfile.charactersUsed || 0;
      const limit = userProfile.freeLimit || 10000;
      const remaining = Math.max(0, limit - used);
      if (remaining <= 0) {
        setErrorMessage(
          `Free plan quota limit reached (${used.toLocaleString()} / ${limit.toLocaleString()} characters used). Please upgrade to Pro to continue.`
        );
        return;
      }
      if (scriptChars > remaining) {
        setErrorMessage(
          `Your script has ${scriptChars.toLocaleString()} characters, but you only have ${remaining.toLocaleString()} free characters remaining in your quota. Please shorten your script or upgrade your plan.`
        );
        return;
      }
    } else if (
      userProfile?.plan === "pro_monthly" ||
      userProfile?.plan === "monthly" ||
      userProfile?.plan === "pro_3months" ||
      userProfile?.plan === "quarterly"
    ) {
      if (
        userProfile.planExpiresAt &&
        new Date(userProfile.planExpiresAt).getTime() < Date.now()
      ) {
        setErrorMessage(
          "Your Pro subscription plan has expired. Please renew your subscription to continue generating speech."
        );
        return;
      }
    }

    const chunks = isTwoSpeaker
      ? splitTwoSpeakerScript(scriptText, speaker1.name, speaker2.name, chunkSize)
      : splitSingleSpeakerScript(scriptText, chunkSize);

    if (chunks.length === 0) {
      setErrorMessage("Script contains no readable text.");
      return;
    }

    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
      setGeneratedAudioUrl(null);
    }

    isCancelledRef.current = false;
    setIsGenerating(true);
    setProgressPercent(0);

    const voiceKey = isTwoSpeaker
      ? `${speaker1.name}:${speaker1.voice}|${speaker2.name}:${speaker2.voice}`
      : singleVoice;

    // Check each chunk against IndexedDB cache for resume support
    const chunkHashes: string[] = [];
    const cachedChunks: ({ pcmBytes: Uint8Array; sampleRate: number } | null)[] = [];
    for (const chunk of chunks) {
      const hash = await computeChunkHash({
        text: chunk,
        voice: voiceKey,
        model: selectedModel,
        style: selectedStyle,
        language: selectedLanguage,
        accent: selectedAccent,
        pace: selectedPace,
      });
      chunkHashes.push(hash);
      const cached = await getCachedChunk(hash);
      cachedChunks.push(cached);
    }

    let alreadyDoneCount = cachedChunks.filter(Boolean).length;
    setProgressText(`Chunk 1 of ${chunks.length} (${alreadyDoneCount} already done)`);

    const pcmChunks: Uint8Array[] = [];
    let detectedSampleRate = 24000;

    for (let i = 0; i < chunks.length; i++) {
      if (isCancelledRef.current) {
        break;
      }

      const rawChunk = chunks[i];
      const hash = chunkHashes[i];
      const cached = cachedChunks[i];

      setProgressText(
        `Chunk ${i + 1} of ${chunks.length} (${alreadyDoneCount} already done)`
      );
      setProgressPercent(Math.round(((i + 1) / chunks.length) * 100));

      if (cached) {
        pcmChunks.push(cached.pcmBytes);
        if (cached.sampleRate) {
          detectedSampleRate = cached.sampleRate;
        }
        continue;
      }

      const payload = buildPayload(
        rawChunk,
        selectedStyle,
        selectedLanguage,
        selectedAccent,
        selectedPace
      );

      const idToken = await currentUser?.getIdToken();
      const { result: pcmResult, error: chunkErr } =
        await executeWithQuotaRetry(
          () =>
            requestChunkAudio(
              selectedModel,
              activeUserApiKey,
              payload,
              isTwoSpeaker,
              singleVoice,
              speaker1,
              speaker2,
              idToken
            ),
          () => isCancelledRef.current
        );

      if (isCancelledRef.current) {
        break;
      }

      if (chunkErr || !pcmResult) {
        if (chunkErr?.includes("Free limit reached")) {
          setErrorMessage("Free limit reached. Upgrade to continue.");
        } else {
          setErrorMessage(
            chunkErr || `Error processing chunk ${i + 1}. Please check your API key or quota.`
          );
        }
        break;
      }

      await saveCachedChunk(hash, pcmResult.pcmBytes, pcmResult.sampleRate);
      alreadyDoneCount++;
      setSavedProgressCount((prev) => prev + 1);
      pcmChunks.push(pcmResult.pcmBytes);
      if (pcmResult.sampleRate) {
        detectedSampleRate = pcmResult.sampleRate;
      }

      if (i < chunks.length - 1 && !isCancelledRef.current) {
        await cancellableSleep(waitBetweenChunks, () => isCancelledRef.current);
      }
    }

    if (pcmChunks.length > 0) {
      try {
        const mergedBlob = mergePcmChunks(pcmChunks, detectedSampleRate);
        const mergedUrl = URL.createObjectURL(mergedBlob);
        setGeneratedAudioUrl(mergedUrl);

        if (currentUser && alreadyDoneCount > 0) {
          const usedChars = Math.min(
            scriptChars,
            Math.round((alreadyDoneCount / chunks.length) * scriptChars)
          );
          if (usedChars > 0) {
            recordServerUsage(currentUser, usedChars);
            setUserProfile((prev) =>
              prev
                ? {
                    ...prev,
                    charactersUsed: (prev.charactersUsed || 0) + usedChars,
                  }
                : prev
            );
          }
        }
      } catch {
        setErrorMessage("Failed to assemble the merged audio file.");
      }
    }

    setIsGenerating(false);
    setProgressPercent(100);
    setProgressText("");
  };

  const handleStopGeneration = () => {
    isCancelledRef.current = true;
    setProgressText("Stopping generation...");
  };

  // Upload script file (.txt)
  const handleScriptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setScriptText(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Quick sample script
  const handleLoadSample = () => {
    if (isTwoSpeaker) {
      setScriptText(
        `Speaker1: [whispering] Do you hear that echo across the valley? Something massive is approaching the frozen ridge.\nSpeaker2: [cautiously] Yes, the ground is trembling beneath our feet. Keep your torches burning bright.\nSpeaker1: [dramatically] Look toward the horizon! The great mammoth herd has arrived, breaking through the ancient blizzard.\nSpeaker2: [in awe] In all my fifty years, I have never witnessed a migration of this magnitude.`
      );
    } else {
      setScriptText(
        `[slowly] Across the untamed plains of the late Pleistocene, the wind howls through a desolate canyon of ice and rock. [pause] For fifty thousand years, the great mammoth herds reigned supreme, their thunderous footsteps shaking the permafrost. [whispering] But deep inside the shadows, an unseen predator waits patiently. [pause] Keen eyes observe every subtle shift in the blowing snow. [dramatically] Survival here demands relentless focus. Every step could be the difference between enduring another harsh winter or vanishing forever into ancient legend. [pause] This is the story of the earth before mankind claimed the dawn.`
      );
    }
  };

  // 3. Translate & Dub Handler
  const handleTranslateAndDub = async () => {
    setErrorMessage(null);
    if (!isKeyAvailable) {
      setErrorMessage("Please add your own Gemini API key to continue.");
      return;
    }

    if (userProfile?.plan === "free") {
      const used = userProfile.charactersUsed || 0;
      const limit = userProfile.freeLimit || 10000;
      const remaining = Math.max(0, limit - used);
      if (remaining <= 0) {
        setErrorMessage(
          `Free plan quota limit reached (${used.toLocaleString()} / ${limit.toLocaleString()} characters used). Please upgrade to Pro to continue.`
        );
        return;
      }
    } else if (
      userProfile?.plan === "pro_monthly" ||
      userProfile?.plan === "monthly" ||
      userProfile?.plan === "pro_3months" ||
      userProfile?.plan === "quarterly"
    ) {
      if (
        userProfile.planExpiresAt &&
        new Date(userProfile.planExpiresAt).getTime() < Date.now()
      ) {
        setErrorMessage(
          "Your Pro subscription plan has expired. Please renew your subscription to continue."
        );
        return;
      }
    }

    let textToTranslate = "";
    setIsTranslating(true);
    setTranslateProgress("Initializing...");

    try {
      const idToken = await currentUser?.getIdToken();
      if (!idToken) {
        setErrorMessage("Please sign in to continue.");
        setIsTranslating(false);
        return;
      }

      if (translateMode === "audio") {
        if (!uploadedAudioFile) {
          setErrorMessage("Please select an audio file to translate.");
          setIsTranslating(false);
          return;
        }
        setTranslateProgress("Transcribing audio word for word...");
        const audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const b64 = res.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(uploadedAudioFile);
        });

        const transcript = await sendServerTranscription(
          idToken,
          activeUserApiKey || "",
          audioBase64,
          uploadedAudioFile.type || "audio/mp3"
        );
        textToTranslate = transcript.trim();
        if (!textToTranslate) {
          throw new Error("Could not extract speech transcript from the audio.");
        }
      } else {
        textToTranslate = translateSourceText.trim();
        if (!textToTranslate) {
          setErrorMessage("Please enter text to translate.");
          setIsTranslating(false);
          return;
        }
      }

      const translationPieces = splitSingleSpeakerScript(textToTranslate, 3000);
      const translatedPieces: string[] = [];

      for (let i = 0; i < translationPieces.length; i++) {
        setTranslateProgress(
          `Translating part ${i + 1} of ${translationPieces.length}...`
        );
        const piece = translationPieces[i];
        const translatedChunk = await sendServerTranslation(
          idToken,
          activeUserApiKey || "",
          piece,
          translateTargetLang
        );
        translatedPieces.push(translatedChunk);

        if (i < translationPieces.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      const fullTranslation = translatedPieces.join("\n\n");
      setTranslatedResultText(fullTranslation);
      setTranslateProgress("");
    } catch (err: any) {
      const msg = err?.message || "Translation failed.";
      if (msg.includes("Free limit reached")) {
        setErrorMessage("Free limit reached. Upgrade to continue.");
      } else {
        setErrorMessage(msg);
      }
      setTranslateProgress("");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleUseInVoiceover = () => {
    if (translatedResultText) {
      setScriptText(translatedResultText);
      if (LANGUAGES.includes(translateTargetLang as any)) {
        setSelectedLanguage(translateTargetLang);
      }
      setActiveTab("studio");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-cinematic text-lg font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
            SM Voice Studio
          </span>
          <span className="text-[11px] uppercase tracking-widest text-amber-500/70 font-medium">
            Loading studio session...
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={() => setIsAuthLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-sky-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col">
        {/* Top User & Usage Quota Bar */}
        <UsageHeader
          userEmail={currentUser.email}
          profile={userProfile}
          onSignOut={() => {
            setCurrentUser(null);
            setUserProfile(null);
          }}
          onUpgradeClick={() => setActiveTab("account")}
        />

        {/* Main Header with Developer Credit 1 */}
        <header className="text-center mb-6 sm:mb-8">
          <h1 className="font-cinematic text-3xl sm:text-4xl md:text-5xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
            SM Voice Studio
          </h1>
          <p className="text-xs sm:text-sm uppercase tracking-widest text-amber-500/90 font-medium mt-1">
            Developed by SHANI MUGHAL
          </p>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            Professional multi-speaker & cinematic voiceovers for 30+ minute
            narrations with auto-chunking, multi-lingual dubbing, and seamless WAV
            merging.
          </p>
        </header>

        {/* First-time dismissible note */}
        {showFirstTimeNote && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200/90 mb-5">
            <span className="flex-1">
              Free Google keys have small daily limits. Long scripts may need billing enabled on your key or several days.
            </span>
            <button
              type="button"
              onClick={handleDismissFirstTimeNote}
              className="text-amber-400 hover:text-amber-200 transition-colors p-1 rounded-md"
              title="Dismiss"
              aria-label="Dismiss note"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("studio")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all ${
              activeTab === "studio"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-[#101524] text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            Voice Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("translate")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === "translate"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-[#101524] text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            Translate & Dub
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === "account"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-[#101524] text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Plans & Account</span>
            {userPendingPaymentsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px] animate-pulse">
                {userPendingPaymentsCount}
              </span>
            )}
          </button>
        </div>

        {/* Main Card Container */}
        <main className="bg-[#101524]/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 sm:p-7 shadow-2xl shadow-black/60 flex flex-col gap-6">
          {/* Section 1: API Key Management */}
          <div className="bg-[#0a0e1a] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Your Gemini API key
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                {activeUserApiKey ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Your key is active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    No API key added
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={typedApiKey}
                  onChange={(e) => setTypedApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full bg-[#080b14] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors p-1"
                  aria-label="Toggle key visibility"
                >
                  {showApiKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyKey}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
                >
                  Apply Key
                </button>
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 transition-colors border border-slate-700/50 cursor-pointer"
                >
                  Clear Key
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <input
                  id="rememberKey"
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(e) => handleRememberToggle(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400/40 w-3.5 h-3.5 cursor-pointer accent-amber-500"
                />
                <label
                  htmlFor="rememberKey"
                  className="cursor-pointer select-none text-slate-400"
                >
                  Remember on this device
                </label>
              </div>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors font-medium"
                >
                  How to get a free key
                </a>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-slate-400">
                  Your key stays in your browser and is sent only to Google.
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: VOICE STUDIO */}
          {activeTab === "studio" && (
            <>
              {/* Controls Group */}
              <div className="space-y-4 bg-[#0a0e1a]/60 border border-slate-800/70 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Language
                    </label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Accent
                    </label>
                    <select
                      value={selectedAccent}
                      onChange={(e) => setSelectedAccent(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                    >
                      {(
                        ACCENTS_BY_LANGUAGE[selectedLanguage] || ["Standard"]
                      ).map((acc) => (
                        <option key={acc} value={acc}>
                          {acc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Voice Style
                    </label>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                    >
                      {VOICE_STYLES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Pace
                    </label>
                    <select
                      value={selectedPace}
                      onChange={(e) => setSelectedPace(e.target.value)}
                      disabled={isGenerating}
                      className="w-full bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                    >
                      {PACES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Mode:
                    </span>
                    <div className="inline-flex p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setIsTwoSpeaker(false)}
                        className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                          !isTwoSpeaker
                            ? "bg-amber-400 text-slate-950"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Single voice
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTwoSpeaker(true)}
                        className={`px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                          isTwoSpeaker
                            ? "bg-amber-400 text-slate-950"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Two speakers
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Model:
                      </span>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isGenerating}
                        className="bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                      >
                        {TTS_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Wait between chunks:
                    </span>
                    <select
                      value={waitBetweenChunks}
                      onChange={(e) => setWaitBetweenChunks(Number(e.target.value))}
                      disabled={isGenerating}
                      className="bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                    >
                      <option value={21000}>21 seconds (free tier)</option>
                      <option value={8000}>8 seconds (paid tier)</option>
                    </select>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Chunk size:
                      </span>
                      <select
                        value={chunkSize}
                        onChange={(e) => setChunkSize(Number(e.target.value))}
                        disabled={isGenerating}
                        className="bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                      >
                        <option value={800}>800 characters</option>
                        <option value={1500}>1500 characters</option>
                        <option value={2500}>2500 characters</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Voice Selection */}
                {!isTwoSpeaker ? (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                    <div className="sm:col-span-8 space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        Gemini Voice ({filteredVoices.length} available)
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={singleVoice}
                          onChange={(e) =>
                            setSingleVoice(e.target.value as GeminiVoice)
                          }
                          disabled={isGenerating}
                          className="flex-1 min-w-0 bg-[#0d1220] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                        >
                          {filteredVoices.map((v) => (
                            <option key={v} value={v}>
                              {getVoiceLabel(v)}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Gender:
                          </span>
                          <select
                            value={genderFilter}
                            onChange={(e) =>
                              handleGenderFilterChange(
                                e.target.value as "All" | "Male" | "Female"
                              )
                            }
                            disabled={isGenerating}
                            className="bg-[#0d1220] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                          >
                            <option value="All">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-4 flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handlePlayPreview(1)}
                        disabled={isGenerating || isPreviewLoading || !isKeyAvailable}
                        title={!isKeyAvailable ? "Please add your own Gemini API key to continue." : undefined}
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isPreviewPlaying
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : "bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/30"
                        } disabled:opacity-50`}
                      >
                        {isPreviewLoading ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Loading Preview...</span>
                          </>
                        ) : isPreviewPlaying ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Preview</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play Preview</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Speaker 1 */}
                      <div className="bg-[#080b14] border border-slate-800 rounded-lg p-3 space-y-2">
                        <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                          Speaker 1
                        </span>
                        <input
                          type="text"
                          value={speaker1.name}
                          onChange={(e) =>
                            setSpeaker1({ ...speaker1, name: e.target.value })
                          }
                          placeholder="Speaker1 label"
                          className="w-full bg-[#0d1220] border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={speaker1.voice}
                            onChange={(e) =>
                              setSpeaker1({
                                ...speaker1,
                                voice: e.target.value as GeminiVoice,
                              })
                            }
                            disabled={isGenerating}
                            className="flex-1 min-w-0 bg-[#0d1220] border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                          >
                            {speaker1FilteredVoices.map((v) => (
                              <option key={v} value={v}>
                                {getVoiceLabel(v)}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Gender:
                            </span>
                            <select
                              value={speaker1GenderFilter}
                              onChange={(e) =>
                                handleSpeaker1GenderFilterChange(
                                  e.target.value as "All" | "Male" | "Female"
                                )
                              }
                              disabled={isGenerating}
                              className="bg-[#0d1220] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                            >
                              <option value="All">All</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Speaker 2 */}
                      <div className="bg-[#080b14] border border-slate-800 rounded-lg p-3 space-y-2">
                        <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                          Speaker 2
                        </span>
                        <input
                          type="text"
                          value={speaker2.name}
                          onChange={(e) =>
                            setSpeaker2({ ...speaker2, name: e.target.value })
                          }
                          placeholder="Speaker2 label"
                          className="w-full bg-[#0d1220] border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={speaker2.voice}
                            onChange={(e) =>
                              setSpeaker2({
                                ...speaker2,
                                voice: e.target.value as GeminiVoice,
                              })
                            }
                            disabled={isGenerating}
                            className="flex-1 min-w-0 bg-[#0d1220] border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                          >
                            {speaker2FilteredVoices.map((v) => (
                              <option key={v} value={v}>
                                {getVoiceLabel(v)}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Gender:
                            </span>
                            <select
                              value={speaker2GenderFilter}
                              onChange={(e) =>
                                handleSpeaker2GenderFilterChange(
                                  e.target.value as "All" | "Male" | "Female"
                                )
                              }
                              disabled={isGenerating}
                              className="bg-[#0d1220] border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                            >
                              <option value="All">All</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayPreview(1)}
                        disabled={isGenerating || isPreviewLoading || !isKeyAvailable}
                        title={!isKeyAvailable ? "Please add your own Gemini API key to continue." : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isPreviewPlaying && previewSpeakerNum === 1
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : "bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/30"
                        } disabled:opacity-50`}
                      >
                        {isPreviewLoading && previewSpeakerNum === 1 ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : isPreviewPlaying && previewSpeakerNum === 1 ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Speaker 1</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Preview Speaker 1</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePlayPreview(2)}
                        disabled={isGenerating || isPreviewLoading || !isKeyAvailable}
                        title={!isKeyAvailable ? "Please add your own Gemini API key to continue." : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isPreviewPlaying && previewSpeakerNum === 2
                            ? "bg-amber-400 text-slate-950 font-bold"
                            : "bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/30"
                        } disabled:opacity-50`}
                      >
                        {isPreviewLoading && previewSpeakerNum === 2 ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : isPreviewPlaying && previewSpeakerNum === 2 ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Speaker 2</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Preview Speaker 2</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Script Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Script to Narrate
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={handleClearSavedProgress}
                      disabled={isGenerating}
                      className="text-slate-400 hover:text-amber-300 underline underline-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Clear stored chunk audio from browser IndexedDB"
                    >
                      Clear saved progress{savedProgressCount > 0 ? ` (${savedProgressCount})` : ""}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt"
                      onChange={handleScriptFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      Upload .txt script
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      disabled={isGenerating}
                      className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Sample
                    </button>
                    {scriptText && (
                      <button
                        type="button"
                        onClick={() => setScriptText("")}
                        disabled={isGenerating}
                        className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  disabled={isGenerating}
                  placeholder={
                    isTwoSpeaker
                      ? `Speaker1: Hello, are you ready to depart?\nSpeaker2: Yes, the preparations are complete. [pause]\nSpeaker1: [slowly] Then let us begin our journey.`
                      : `Paste your narration script here (supports 30+ minutes of narration). Use stage directions in brackets like [pause] or [slowly] to guide emotional pacing without being read aloud.`
                  }
                  rows={9}
                  className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 leading-relaxed resize-y min-h-[200px]"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-300">
                      {characterCount.toLocaleString()}{" "}
                      <span className="text-slate-400">characters</span>
                    </span>
                    <span className="font-mono text-slate-300">
                      {wordCount.toLocaleString()}{" "}
                      <span className="text-slate-400">words</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-amber-400/80" />
                      <span>
                        ~{estimatedChunks}{" "}
                        {estimatedChunks === 1 ? "chunk" : "chunks"} (~{chunkSize}{" "}
                        chars/chunk)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400/80" />
                      <span>~{estimatedMinutes} min audio</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons (Generate / Stop) */}
              <div className="pt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateVoiceover}
                  disabled={isGenerating || !scriptText.trim() || !isKeyAvailable}
                  title={!isKeyAvailable ? "Please add your own Gemini API key to continue." : undefined}
                  className="flex-1 py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base tracking-wide cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Generating Voiceover...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-current" />
                      <span>Generate Voiceover</span>
                    </>
                  )}
                </button>
                {isGenerating && (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="py-3.5 px-5 rounded-xl font-semibold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 transition-colors text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
              </div>

              {/* Progress Indicator */}
              {isGenerating && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="text-amber-400 font-medium">
                      {progressText}
                    </span>
                    <span className="font-mono text-slate-400">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message with Upgrade Button for Quota */}
              {errorMessage && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in ${
                    errorMessage.includes("Free limit reached")
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-200"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="font-semibold">{errorMessage}</span>
                  </div>
                  {errorMessage.includes("Free limit reached") && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("account")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upgrade</span>
                    </button>
                  )}
                </div>
              )}

              {/* Audio Player and Download */}
              {generatedAudioUrl && !isGenerating && (
                <div className="p-4 sm:p-5 bg-[#0a0e1a] border border-amber-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-slate-100">
                        Voiceover Ready
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      Merged continuous 16-bit PCM WAV
                    </span>
                  </div>
                  <audio
                    controls
                    src={generatedAudioUrl}
                    className="w-full accent-amber-500 h-10 rounded-lg"
                  />
                  <div className="flex justify-end pt-1">
                    <a
                      href={generatedAudioUrl}
                      download="sm-voice-studio-voiceover.wav"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/10 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Audio (.wav)
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: TRANSLATE & DUB */}
          {activeTab === "translate" && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-400 uppercase tracking-wider font-semibold">
                  Source:
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="translateMode"
                    checked={translateMode === "text"}
                    onChange={() => setTranslateMode("text")}
                    className="accent-amber-400"
                  />
                  <span>Paste text</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="translateMode"
                    checked={translateMode === "audio"}
                    onChange={() => setTranslateMode("audio")}
                    className="accent-amber-400"
                  />
                  <span>Upload audio file (MP3, WAV, M4A, OGG)</span>
                </label>
              </div>

              {translateMode === "text" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Source Script Text
                  </label>
                  <textarea
                    value={translateSourceText}
                    onChange={(e) => setTranslateSourceText(e.target.value)}
                    placeholder="Paste text to translate. Any [bracketed stage directions] will be preserved in place..."
                    rows={6}
                    className="w-full bg-[#0a0e1a] border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Upload Audio File
                  </label>
                  <div
                    onClick={() => audioFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl p-6 text-center cursor-pointer bg-[#0a0e1a] transition-colors"
                  >
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadedAudioFile(file);
                      }}
                      className="hidden"
                    />
                    <FileAudio className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs sm:text-sm text-slate-200 font-medium">
                      {uploadedAudioFile
                        ? uploadedAudioFile.name
                        : "Click to choose audio file (up to ~20MB)"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Gemini will transcribe word for word with punctuation, then translate.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0e1a] border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Target Language:
                  </span>
                  <select
                    value={translateTargetLang}
                    onChange={(e) => setTranslateTargetLang(e.target.value)}
                    className="bg-[#0d1220] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                  >
                    {LANGUAGES.filter((l) => l !== "Auto-detect").map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleTranslateAndDub}
                  disabled={isTranslating || !isKeyAvailable}
                  title={!isKeyAvailable ? "Please add your own Gemini API key to continue." : undefined}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isTranslating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>{translateProgress || "Processing..."}</span>
                    </>
                  ) : (
                    <span>Translate</span>
                  )}
                </button>
              </div>

              {errorMessage && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in ${
                    errorMessage.includes("Free limit reached")
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-200"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="font-semibold">{errorMessage}</span>
                  </div>
                  {errorMessage.includes("Free limit reached") && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("account")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upgrade</span>
                    </button>
                  )}
                </div>
              )}

              {translatedResultText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Translated Script ({translateTargetLang})
                    </label>
                    <button
                      type="button"
                      onClick={handleUseInVoiceover}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm cursor-pointer"
                    >
                      <span>Use in Voiceover</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={translatedResultText}
                    onChange={(e) => setTranslatedResultText(e.target.value)}
                    rows={8}
                    className="w-full bg-[#0a0e1a] border border-emerald-500/40 rounded-xl p-3.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-500/60 leading-relaxed font-normal"
                  />
                </div>
              )}

              <div className="text-[11px] text-slate-500 italic bg-[#0a0e1a]/40 border border-slate-800/60 rounded-lg p-3">
                Note: The dubbed voiceover is not timed to match the original audio or video.
              </div>
            </div>
          )}

          {/* TAB 3: PRICING & ACCOUNT */}
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Account Quick Details */}
              <div className="bg-[#0a0e1a] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
                    Signed in Account
                  </span>
                  <p className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
                    {currentUser?.email || "Studio Member"}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 break-all">
                    UID: {currentUser?.uid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser?.uid) {
                      navigator.clipboard.writeText(currentUser.uid);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors self-start sm:self-center shrink-0 cursor-pointer"
                >
                  Copy UID
                </button>
              </div>

              {/* 1. Redeem License Key */}
              <RedeemLicenseCard
                currentUser={currentUser}
                onRedeemSuccess={(newPlan, newExpiresAt) => {
                  setUserProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          plan: newPlan as any,
                          planExpiresAt: newExpiresAt,
                        }
                      : null
                  );
                }}
              />

              {/* 2. Pricing Plans Section */}
              <PricingSection
                pricing={pricingSettings}
                userProfile={userProfile}
                onBuyNow={(plan, priceUSD, pricePKR) => {
                  setSelectedPlanForPayment(plan);
                  setSelectedPriceUSD(priceUSD);
                  setSelectedPricePKR(pricePKR);
                  setIsPaymentModalOpen(true);
                }}
              />

              {/* 3. My Payments Status List */}
              <PaymentRequestsList requests={userPaymentRequests} />

              {/* 4. Admin Payment Approval & License Key Generator */}
              <AdminPaymentPanel currentUser={currentUser} />
            </div>
          )}
        </main>
      </div>

      {/* Manual Payment Verification Modal */}
      <ManualPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        selectedPlan={selectedPlanForPayment}
        priceUSD={selectedPriceUSD}
        pricePKR={selectedPricePKR}
        paymentMethods={paymentMethods}
        currentUser={currentUser}
        onPaymentSubmitted={() => {}}
      />

      {/* Upgrade Subscription Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        userProfile={userProfile}
        uid={currentUser?.uid}
        onChoosePlan={(plan) => {
          setSelectedPlanForPayment(plan);
          const rate = pricingSettings.exchangeRatePKR || 280;
          const usd =
            plan === "threeday"
              ? pricingSettings.threedayUSD
              : plan === "lifetime"
              ? pricingSettings.lifetimeUSD
              : plan === "quarterly"
              ? pricingSettings.quarterlyUSD
              : pricingSettings.monthlyUSD;
          setSelectedPriceUSD(usd);
          setSelectedPricePKR(Math.round(usd * rate));
          setIsPaymentModalOpen(true);
        }}
      />

      {/* Developer Credit 2 */}
      <footer className="relative z-10 py-4 text-center text-xs tracking-wider text-amber-500/70 border-t border-slate-800/80 bg-[#090d16]/90">
        Developed by SHANI MUGHAL
      </footer>
    </div>
  );
}
