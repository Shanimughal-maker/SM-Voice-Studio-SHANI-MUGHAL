/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Sparkles,
  Check,
  Zap,
  Crown,
  Clock,
  X,
} from "lucide-react";
import type { UserProfile } from "../utils/firebase";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  uid?: string;
  onChoosePlan?: (plan: "threeday" | "monthly" | "quarterly" | "lifetime") => void;
}

export function UpgradeModal({
  isOpen,
  onClose,
  userProfile,
  onChoosePlan,
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const currentPlan = (userProfile?.plan || "free").toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl text-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Premium Speech Quota</span>
          </div>
          <h2 className="font-cinematic text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
            Upgrade Your Studio Plan
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Unlock high-fidelity Gemini TTS voiceovers, 30 natural voices, stage direction controls, and full Translate & Dub studio access.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Plan 1: 3-Day */}
          <div className="bg-[#0d1220] border border-cyan-500/30 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  3-Day Pass
                </span>
                {currentPlan === "threeday" && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-cyan-300">$1</span>
                <span className="text-xs text-slate-400">/ 3 days</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>100,000 words usage cap</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Valid for 3 full days</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>All 30 HD voices</span>
                </li>
              </ul>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChoosePlan?.("threeday");
                }}
                className="w-full py-2 rounded-lg text-xs font-bold bg-[#14232c] hover:bg-[#1a2f3a] border border-cyan-500/40 text-cyan-300 transition-all cursor-pointer"
              >
                Choose 3-Day ($1)
              </button>
            </div>
          </div>

          {/* Plan 2: Monthly (Popular) */}
          <div className="bg-gradient-to-b from-[#141b2d] to-[#0d1322] border-2 border-amber-500/60 rounded-xl p-5 flex flex-col justify-between relative shadow-lg shadow-amber-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
              Popular
            </div>
            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Monthly
                </span>
                {(currentPlan === "pro_monthly" || currentPlan === "monthly") && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-amber-300">$2</span>
                <span className="text-xs text-slate-400">/ 30 days</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                <li className="flex items-center gap-2 font-medium text-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Unlimited speech</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Valid for 30 days</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Full Translate & Dub</span>
                </li>
              </ul>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChoosePlan?.("monthly");
                }}
                className="w-full py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-sm"
              >
                Choose Monthly ($2)
              </button>
            </div>
          </div>

          {/* Plan 3: 3 Months */}
          <div className="bg-[#0d1220] border border-amber-500/30 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  3 Months
                </span>
                {(currentPlan === "pro_3months" || currentPlan === "quarterly") && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-amber-300">$5</span>
                <span className="text-xs text-slate-400">/ 90 days</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-medium text-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Unlimited speech</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Valid for full 90 days</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Priority generation</span>
                </li>
              </ul>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChoosePlan?.("quarterly");
                }}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-[#171f33] hover:bg-[#1f2942] border border-amber-500/40 text-amber-300 transition-all cursor-pointer"
              >
                Choose 3 Months ($5)
              </button>
            </div>
          </div>

          {/* Plan 4: Lifetime (Best Value) */}
          <div className="bg-gradient-to-b from-[#1b1528] to-[#0d1220] border-2 border-amber-400/70 rounded-xl p-5 flex flex-col justify-between relative shadow-lg shadow-amber-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
              Best Value
            </div>
            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Lifetime Pass
                </span>
                {currentPlan === "lifetime" && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-slate-100">$10</span>
                <span className="text-xs text-slate-400">/ forever</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2 font-medium text-amber-300">
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Unlimited voiceover forever</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No monthly subscriptions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Commercial rights</span>
                </li>
              </ul>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChoosePlan?.("lifetime");
                }}
                className="w-full py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-sm"
              >
                Choose Lifetime ($10)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
