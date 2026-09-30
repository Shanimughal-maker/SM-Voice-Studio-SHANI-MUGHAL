/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { type UserProfile, fbSignOut, auth } from "../utils/firebase";
import {
  Sparkles,
  LogOut,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
} from "lucide-react";

interface UsageHeaderProps {
  userEmail?: string | null;
  profile: UserProfile | null;
  onSignOut?: () => void;
  onUpgradeClick?: () => void;
}

export function UsageHeader({ userEmail, profile, onSignOut, onUpgradeClick }: UsageHeaderProps) {
  const handleLogout = async () => {
    try {
      await fbSignOut(auth);
      onSignOut?.();
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  const plan = (profile?.plan || "free").toLowerCase();
  const charactersUsed = profile?.charactersUsed || 0;
  const freeLimit = profile?.freeLimit || 10000;
  const percentUsed = Math.min(100, Math.round((charactersUsed / freeLimit) * 100));
  const isQuotaFull = plan === "free" && charactersUsed >= freeLimit;

  // 3-Day Plan stats
  const planWordsUsed = profile?.planWordsUsed || 0;
  const threedayCap = 100000;
  const percentWordsUsed = Math.min(100, Math.round((planWordsUsed / threedayCap) * 100));

  // Format expiry date
  const formatExpiryDate = (isoOrDate: string | null) => {
    if (!isoOrDate) return "N/A";
    try {
      const d = new Date(isoOrDate);
      if (isNaN(d.getTime())) return isoOrDate;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(isoOrDate);
    }
  };

  const isThreedayExpired =
    plan === "threeday" &&
    profile?.planExpiresAt &&
    new Date(profile.planExpiresAt).getTime() < Date.now();
  const isThreedayCapReached = plan === "threeday" && planWordsUsed >= threedayCap;
  const isThreedayEnded = plan === "threeday" && (isThreedayExpired || isThreedayCapReached);

  const isProExpired =
    (plan === "pro_monthly" || plan === "monthly" || plan === "pro_3months" || plan === "quarterly") &&
    profile?.planExpiresAt &&
    new Date(profile.planExpiresAt).getTime() < Date.now();

  const getPlanBadge = () => {
    switch (plan) {
      case "lifetime":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold tracking-wider uppercase">
            <Crown className="w-3 h-3 text-amber-400" />
            Lifetime
          </span>
        );
      case "threeday":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold tracking-wider uppercase">
            <Clock className="w-3 h-3 text-cyan-400" />
            3-Day Plan
          </span>
        );
      case "quarterly":
      case "pro_3months":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-bold tracking-wider uppercase">
            <Zap className="w-3 h-3 text-purple-400" />
            3 Months
          </span>
        );
      case "monthly":
      case "pro_monthly":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-bold tracking-wider uppercase">
            <Zap className="w-3 h-3 text-sky-400" />
            Monthly
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium tracking-wider uppercase">
            Free Plan
          </span>
        );
    }
  };

  const shouldShowUpgrade =
    plan === "free" || isThreedayEnded || isProExpired;

  return (
    <div className="w-full bg-[#0a0e1a]/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 mb-6 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: User identity & plan badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold">
            {userEmail ? userEmail.slice(0, 2).toUpperCase() : "SM"}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-xs">
                {userEmail || "Signed in user"}
              </span>
              {getPlanBadge()}
            </div>
          </div>
        </div>

        {/* Right: Upgrade & Sign out buttons */}
        <div className="flex items-center justify-end gap-2">
          {shouldShowUpgrade && onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Upgrade</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 text-xs font-medium transition-all cursor-pointer shadow-sm"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Usage Bar Section */}
      <div className="mt-3 pt-3 border-t border-slate-800/70">
        {plan === "free" ? (
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-slate-300">
                Free plan:{" "}
                <strong className={isQuotaFull ? "text-red-400" : "text-amber-300"}>
                  {charactersUsed.toLocaleString()}
                </strong>{" "}
                / {freeLimit.toLocaleString()} characters used
              </span>
              <span
                className={`text-[11px] ${
                  isQuotaFull ? "text-red-400 font-bold" : "text-slate-400"
                }`}
              >
                {percentUsed}%
              </span>
            </div>
            {/* Visual Progress Track */}
            <div className="w-full h-2 rounded-full bg-[#101524] border border-slate-800/80 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isQuotaFull
                    ? "bg-red-500"
                    : percentUsed > 80
                    ? "bg-gradient-to-r from-amber-400 to-orange-500"
                    : "bg-gradient-to-r from-amber-500 to-amber-300"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            {isQuotaFull && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Free limit reached (10,000 characters). Upgrade to continue.
                </span>
              </div>
            )}
          </div>
        ) : plan === "threeday" ? (
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-slate-300">
                3-Day plan:{" "}
                <strong className={isThreedayEnded ? "text-red-400" : "text-cyan-300"}>
                  {planWordsUsed.toLocaleString()}
                </strong>{" "}
                / 100,000 words used, expires on {formatExpiryDate(profile?.planExpiresAt || null)}
              </span>
              <span
                className={`text-[11px] ${
                  isThreedayEnded ? "text-red-400 font-bold" : "text-slate-400"
                }`}
              >
                {percentWordsUsed}%
              </span>
            </div>
            {/* Visual Progress Track */}
            <div className="w-full h-2 rounded-full bg-[#101524] border border-slate-800/80 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isThreedayEnded
                    ? "bg-red-500"
                    : percentWordsUsed > 80
                    ? "bg-gradient-to-r from-cyan-400 to-orange-500"
                    : "bg-gradient-to-r from-cyan-500 to-cyan-300"
                }`}
                style={{ width: `${percentWordsUsed}%` }}
              />
            </div>
            {isThreedayEnded && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Your 3-Day plan has ended. Upgrade to continue.
                </span>
              </div>
            )}
          </div>
        ) : plan === "lifetime" ? (
          <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Lifetime:</strong> Unlimited character generation enabled.
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {plan === "pro_3months" || plan === "quarterly" ? "3 Months:" : "Monthly:"}{" "}
                {isProExpired ? (
                  <span className="text-red-400 font-semibold">
                    Expired on {formatExpiryDate(profile?.planExpiresAt || null)}
                  </span>
                ) : (
                  <span className="text-amber-300 font-medium">
                    active until {formatExpiryDate(profile?.planExpiresAt || null)}
                  </span>
                )}
              </span>
            </div>
            {!isProExpired && (
              <span className="text-[11px] text-slate-400">Unlimited audio generation</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
