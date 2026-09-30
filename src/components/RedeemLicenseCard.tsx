/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Key, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { User } from "../utils/firebase";

interface RedeemLicenseCardProps {
  currentUser: User | null;
  onRedeemSuccess?: (plan: string, expiresAt: string | null) => void;
}

export function RedeemLicenseCard({
  currentUser,
  onRedeemSuccess,
}: RedeemLicenseCardProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanKey = licenseKey.trim().toUpperCase();
    if (!cleanKey) {
      setErrorMessage("Please enter a valid license key.");
      return;
    }

    if (!currentUser) {
      setErrorMessage("Please sign in to redeem your license key.");
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/redeem-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ key: cleanKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to redeem license key.");
      }

      setSuccessMessage(data.message || "License key redeemed successfully!");
      setLicenseKey("");
      onRedeemSuccess?.(data.plan, data.planExpiresAt);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to redeem license key. Please check the code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Key className="w-4 h-4" />
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-100 font-cinematic tracking-wide">
          Redeem License Key
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Have a lifetime or subscription license key? Enter your code below to activate your plan instantly.
      </p>

      <form onSubmit={handleRedeem} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            placeholder="e.g. SM-LIFETIME-PRO-2026 or SM-MONTHLY-XXXX"
            className="flex-1 bg-[#080b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono uppercase tracking-wider"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !licenseKey.trim()}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/10 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Redeem Key</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
}
