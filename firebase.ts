/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocFromServer,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with custom database ID specified in config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Firestore Error Logging & Diagnostic Interface
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Please check your Firebase configuration: client appears offline.");
    }
  }
}
testConnection();

// User Subscription & Quota Interface
export type UserPlan =
  | "free"
  | "threeday"
  | "monthly"
  | "quarterly"
  | "pro_monthly"
  | "pro_3months"
  | "lifetime";

export interface UserProfile {
  email: string;
  plan: UserPlan | string;
  charactersUsed: number;
  planWordsUsed?: number;
  freeLimit: number;
  planExpiresAt: string | null;
  createdAt: any;
}

// Ensure User Document in Firestore with in-flight deduplication
const inFlightEnsureProfiles = new Map<string, Promise<UserProfile>>();

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  if (inFlightEnsureProfiles.has(user.uid)) {
    return inFlightEnsureProfiles.get(user.uid)!;
  }

  const promise = (async () => {
    const userDocRef = doc(db, "users", user.uid);
    const path = `users/${user.uid}`;
    let snap;
    try {
      snap = await getDoc(userDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (snap && snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Default initial profile for new signup
    const initialProfile: UserProfile = {
      email: user.email || "",
      plan: "free",
      charactersUsed: 0,
      planWordsUsed: 0,
      freeLimit: 10000,
      planExpiresAt: null,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(userDocRef, initialProfile, { merge: true });
      return initialProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  })();

  inFlightEnsureProfiles.set(user.uid, promise);
  try {
    return await promise;
  } finally {
    inFlightEnsureProfiles.delete(user.uid);
  }
}

// Subscribe to User Profile in real time
export function subscribeUserProfile(
  uid: string,
  onProfileChange: (profile: UserProfile | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const userDocRef = doc(db, "users", uid);
  const path = `users/${uid}`;
  return onSnapshot(
    userDocRef,
    (snap) => {
      if (snap.exists()) {
        onProfileChange(snap.data() as UserProfile);
      } else {
        onProfileChange(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Record usage via server endpoint
export async function recordServerUsage(
  user: User,
  charactersCount: number
): Promise<{ success: boolean; recordedCharacters: number }> {
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/record-usage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.uid,
        charactersCount,
      }),
    });
    if (!res.ok) {
      throw new Error(`Usage recording failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn("Could not record server usage:", err);
    return { success: false, recordedCharacters: 0 };
  }
}

// License Keys & Payments Types
export type PlanType = "threeday" | "monthly" | "quarterly" | "lifetime";

export interface License {
  id: string;
  key: string;
  plan: PlanType;
  status: "unused" | "active" | "revoked";
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt?: string;
}

export interface PaymentRequest {
  id: string;
  uid: string;
  email: string;
  plan: PlanType;
  amountUSD: number;
  amountPKR: number;
  method: string;
  senderName: string;
  senderNumber: string;
  transactionId: string;
  screenshotUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

export interface PricingSettings {
  freeLimit: number;
  threedayUSD: number;
  threedayDurationDays: number;
  threedayUsageCapWords: number;
  monthlyUSD: number;
  monthlyDurationDays: number;
  quarterlyUSD: number;
  quarterlyDurationDays: number;
  lifetimeUSD: number;
  exchangeRatePKR: number;
}

export interface PaymentMethodItem {
  id: string;
  name: string;
  accountNumber: string;
  accountTitle: string;
  instructions?: string;
  enabled?: boolean;
  badgeColor?: string;
}

export const DEFAULT_PRICING: PricingSettings = {
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

export const DEFAULT_PAYMENT_METHODS: PaymentMethodItem[] = [
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

// Upload payment screenshot (image only, max 5MB, user's folder)
export async function uploadPaymentScreenshot(
  file: File,
  uid: string
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Screenshot must be under 5 MB in size.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files (JPG, PNG, WEBP) are supported.");
  }

  try {
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
    const fileRef = storageRef(
      storage,
      `payment_screenshots/${uid}/${Date.now()}_${cleanName}`
    );
    const snap = await uploadBytes(fileRef, file);
    return await getDownloadURL(snap.ref);
  } catch (storageErr) {
    console.warn("Storage upload fallback to base64 data url:", storageErr);
    // Safe reliable fallback: convert to compressed base64 data URL
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Subscribe to current user's payment requests in real-time
export function subscribePaymentRequests(
  uid: string,
  onUpdate: (requests: PaymentRequest[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const reqCol = collection(db, "paymentRequests");
  const q = query(
    reqCol,
    where("uid", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PaymentRequest[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<PaymentRequest, "id">),
      }));
      onUpdate(items);
    },
    (err) => {
      console.warn("Payment requests snapshot warning:", err);
      try {
        const simpleQ = query(reqCol, where("uid", "==", uid));
        return onSnapshot(simpleQ, (s2) => {
          const list = s2.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PaymentRequest, "id">),
          }));
          list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          onUpdate(list);
        });
      } catch (err2) {
        if (onError) onError(err2);
      }
    }
  );
}

// Load Pricing Settings from Firestore with fallback to defaults
export async function loadPricingSettings(): Promise<PricingSettings> {
  try {
    const docRef = doc(db, "settings", "pricing");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        freeLimit: Number(data.freeLimit) || DEFAULT_PRICING.freeLimit,
        threedayUSD: Number(data.threedayUSD) || DEFAULT_PRICING.threedayUSD,
        threedayDurationDays: Number(data.threedayDurationDays) || DEFAULT_PRICING.threedayDurationDays,
        threedayUsageCapWords: Number(data.threedayUsageCapWords) || DEFAULT_PRICING.threedayUsageCapWords,
        monthlyUSD: Number(data.monthlyUSD) || DEFAULT_PRICING.monthlyUSD,
        monthlyDurationDays: Number(data.monthlyDurationDays) || DEFAULT_PRICING.monthlyDurationDays,
        quarterlyUSD: Number(data.quarterlyUSD) || DEFAULT_PRICING.quarterlyUSD,
        quarterlyDurationDays: Number(data.quarterlyDurationDays) || DEFAULT_PRICING.quarterlyDurationDays,
        lifetimeUSD: Number(data.lifetimeUSD) || DEFAULT_PRICING.lifetimeUSD,
        exchangeRatePKR:
          Number(data.exchangeRatePKR) || DEFAULT_PRICING.exchangeRatePKR,
      };
    }
  } catch (e) {
    console.warn("Could not load pricing settings from Firestore:", e);
  }
  return DEFAULT_PRICING;
}

// Live real-time subscription for Pricing Settings & Exchange Rate
export function subscribePricingSettings(
  onUpdate: (pricing: PricingSettings) => void
): Unsubscribe {
  const docRef = doc(db, "settings", "pricing");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate({
          freeLimit: Number(data.freeLimit) || DEFAULT_PRICING.freeLimit,
          threedayUSD: Number(data.threedayUSD) || DEFAULT_PRICING.threedayUSD,
          threedayDurationDays: Number(data.threedayDurationDays) || DEFAULT_PRICING.threedayDurationDays,
          threedayUsageCapWords: Number(data.threedayUsageCapWords) || DEFAULT_PRICING.threedayUsageCapWords,
          monthlyUSD: Number(data.monthlyUSD) || DEFAULT_PRICING.monthlyUSD,
          monthlyDurationDays: Number(data.monthlyDurationDays) || DEFAULT_PRICING.monthlyDurationDays,
          quarterlyUSD: Number(data.quarterlyUSD) || DEFAULT_PRICING.quarterlyUSD,
          quarterlyDurationDays: Number(data.quarterlyDurationDays) || DEFAULT_PRICING.quarterlyDurationDays,
          lifetimeUSD: Number(data.lifetimeUSD) || DEFAULT_PRICING.lifetimeUSD,
          exchangeRatePKR:
            Number(data.exchangeRatePKR) || DEFAULT_PRICING.exchangeRatePKR,
        });
      } else {
        onUpdate(DEFAULT_PRICING);
      }
    },
    (err) => {
      console.warn("Pricing subscription error:", err);
      onUpdate(DEFAULT_PRICING);
    }
  );
}

// Load Payment Methods from Firestore with fallback to defaults
export async function loadPaymentMethods(): Promise<PaymentMethodItem[]> {
  try {
    const docRef = doc(db, "settings", "paymentMethods");
    const snap = await getDoc(docRef);
    if (snap.exists() && Array.isArray(snap.data()?.methods)) {
      return snap.data()?.methods;
    }
  } catch (e) {
    console.warn("Could not load payment methods from Firestore:", e);
  }
  return DEFAULT_PAYMENT_METHODS;
}

// Live real-time subscription for Payment Methods
export function subscribePaymentMethods(
  onUpdate: (methods: PaymentMethodItem[]) => void
): Unsubscribe {
  const docRef = doc(db, "settings", "paymentMethods");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists() && Array.isArray(snap.data()?.methods)) {
        onUpdate(snap.data()?.methods);
      } else {
        onUpdate(DEFAULT_PAYMENT_METHODS);
      }
    },
    (err) => {
      console.warn("Payment methods subscription error:", err);
      onUpdate(DEFAULT_PAYMENT_METHODS);
    }
  );
}

// Live real-time subscription for ALL payment requests (for Admin Panel)
export function subscribeAllPaymentRequests(
  onUpdate: (requests: PaymentRequest[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const reqCol = collection(db, "paymentRequests");
  return onSnapshot(
    reqCol,
    (snapshot) => {
      const items: PaymentRequest[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<PaymentRequest, "id">),
      }));
      items.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      onUpdate(items);
    },
    (err) => {
      console.warn("All payment requests subscription warning:", err);
      if (onError) onError(err);
    }
  );
}

// Save Payment Methods & Exchange Rate to Firestore doc settings/paymentMethods and settings/pricing
export async function savePaymentSettingsToFirestore(
  methods: PaymentMethodItem[],
  pricing: PricingSettings,
  idToken?: string,
  passcode?: string
): Promise<void> {
  try {
    const methodsRef = doc(db, "settings", "paymentMethods");
    await setDoc(methodsRef, { methods }, { merge: true });
    const pricingRef = doc(db, "settings", "pricing");
    await setDoc(pricingRef, pricing, { merge: true });
    return;
  } catch (clientErr) {
    console.warn("Direct Firestore settings write failed, attempting server proxy:", clientErr);
  }

  // Fallback to server endpoint
  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(passcode ? { "x-admin-passcode": passcode } : {}),
    },
    body: JSON.stringify({ methods, pricing }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to save settings.");
  }
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged,
  type User,
};
