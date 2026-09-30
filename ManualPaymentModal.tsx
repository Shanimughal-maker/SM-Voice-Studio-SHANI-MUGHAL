/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  X,
  Copy,
  CheckCheck,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  uploadPaymentScreenshot,
  type PaymentMethodItem,
  type PlanType,
  type User,
} from "../utils/firebase";

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: PlanType;
  priceUSD: number;
  pricePKR: number;
  paymentMethods: PaymentMethodItem[];
  currentUser: User | null;
  onPaymentSubmitted?: () => void;
}

export function ManualPaymentModal({
  isOpen,
  onClose,
  selectedPlan,
  priceUSD,
  pricePKR,
  paymentMethods,
  currentUser,
  onPaymentSubmitted,
}: ManualPaymentModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter only enabled payment methods
  const activeMethods = paymentMethods.filter((m) => m.enabled !== false);
  const displayMethods = activeMethods.length > 0 ? activeMethods : paymentMethods;

  // Form states
  const [selectedMethod, setSelectedMethod] = useState<string>(
    displayMethods[0]?.name || "JazzCash"
  );
  const [senderName, setSenderName] = useState<string>("");
  const [senderNumber, setSenderNumber] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyNumber = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Screenshot file size must be less than 5 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (JPG, PNG, or WEBP).");
      return;
    }
    setErrorMessage(null);
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentUser) {
      setErrorMessage("Please sign in before submitting payment proof.");
      return;
    }

    if (!senderName.trim() || !senderNumber.trim() || !transactionId.trim()) {
      setErrorMessage("Please complete all payment proof fields.");
      return;
    }

    if (!screenshotFile) {
      setErrorMessage("Please upload a screenshot of your payment receipt.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload screenshot to Firebase Storage (under payment_screenshots/{uid}/)
      const screenshotUrl = await uploadPaymentScreenshot(
        screenshotFile,
        currentUser.uid
      );

      // 2. Submit payment request to server function (enforces uniqueness of TID & creates doc)
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/create-payment-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          amountUSD: priceUSD,
          amountPKR: pricePKR,
          method: selectedMethod,
          senderName: senderName.trim(),
          senderNumber: senderNumber.trim(),
          transactionId: transactionId.trim().toUpperCase(),
          screenshotUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit payment request.");
      }

      setSuccessMessage(
        "Payment proof submitted successfully! Your account will be upgraded as soon as verified (usually within 1-2 hours)."
      );
      onPaymentSubmitted?.();
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Error submitting payment proof. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const planTitle =
    selectedPlan === "lifetime"
      ? "Lifetime Access"
      : selectedPlan === "threeday"
      ? "3-Day Plan (100k Words)"
      : selectedPlan === "quarterly"
      ? "3 Months (Quarterly) Plan"
      : "Monthly Plan";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-5 sm:p-7 shadow-2xl text-slate-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-lg mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manual Payment Verification</span>
          </div>
          <h2 className="font-cinematic text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
            Payment: {planTitle}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-lg font-bold text-slate-100 font-mono">
              ${priceUSD} USD
            </span>
            <span className="text-slate-400 text-sm">=</span>
            <span className="text-lg font-bold text-amber-400 font-mono">
              Rs. {pricePKR.toLocaleString()} PKR
            </span>
          </div>
        </div>

        {/* Step 1: Send payment accounts */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Step 1: Send Exact Amount to Any Account Below
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {displayMethods.map((method) => {
              const isCopied = copiedId === method.id;
              return (
                <div
                  key={method.id}
                  className="bg-[#0e1424] border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-amber-300">
                        {method.name}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate">
                      Title:{" "}
                      <strong className="text-slate-200">
                        {method.accountTitle}
                      </strong>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-100 mt-1 block tracking-wider">
                      {method.accountNumber}
                    </span>
                    {method.instructions && (
                      <p className="text-[10px] text-slate-400/90 mt-1.5 line-clamp-2">
                        {method.instructions}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyNumber(method.id, method.accountNumber)
                    }
                    className="mt-3 w-full py-1.5 px-2 rounded-lg bg-[#141b2c] hover:bg-[#1a233a] border border-slate-700 text-slate-300 hover:text-slate-100 text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
            <strong>Instructions:</strong> Send the exact amount{" "}
            <span className="font-bold underline">
              Rs. {pricePKR.toLocaleString()} PKR
            </span>{" "}
            to any account above, then fill the form below and upload a screenshot of your payment.
          </div>
        </div>

        {/* Step 2: Payment Proof Form */}
        {successMessage ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-100">
              Payment Proof Received!
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
              {successMessage}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors cursor-pointer"
            >
              Done & View Status
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitProof} className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Step 2: Enter Payment Details & Proof
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Payment Method Used
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
                >
                  {displayMethods.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.accountNumber})
                    </option>
                  ))}
                  <option value="Other Bank Transfer">Other Bank Transfer</option>
                </select>
              </div>
              {/* Sender Full Name */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Sender Account Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Muhammad Ali"
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              {/* Sender Account / Mobile Number */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Sender Account / Mobile Number
                </label>
                <input
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="e.g. 03001234567"
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                />
              </div>
              {/* Transaction ID */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Transaction ID (TID / Trx ID)
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                  placeholder="e.g. 12948291038"
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono uppercase"
                />
              </div>
            </div>

            {/* Screenshot Upload Field */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">
                Upload Payment Screenshot (Max 5 MB, Image only)
              </label>
              <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/40 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#080b14]/60 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {screenshotPreview ? (
                  <div className="flex items-center gap-3 w-full">
                    <img
                      src={screenshotPreview}
                      alt="Payment proof preview"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 font-medium truncate">
                        {screenshotFile?.name}
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        Image selected – Click to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-amber-400" />
                    <span className="text-xs text-slate-300 font-medium">
                      Click to upload receipt screenshot
                    </span>
                    <span className="text-[10px] text-slate-500">
                      PNG, JPG, or WEBP up to 5 MB
                    </span>
                  </>
                )}
              </label>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading Proof & Submitting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Submit Payment Proof</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
