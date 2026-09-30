/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Check, Sparkles, Zap, Crown, ArrowRight, Clock } from "lucide-react";
import type { PlanType, PricingSettings, UserProfile } from "../utils/firebase";

interface PricingSectionProps {
  pricing: PricingSettings;
  userProfile: UserProfile | null;
  onBuyNow: (plan: PlanType, priceUSD: number, pricePKR: number) => void;
}

export function PricingSection({
  pricing,
  userProfile,
  onBuyNow,
}: PricingSectionProps) {
  const currentPlan = (userProfile?.plan || "free").toLowerCase();
  const rate = pricing.exchangeRatePKR || 280;
  const threedayUSD = pricing.threedayUSD || 1;
  const threedayPKR = Math.round(threedayUSD * rate);
  const monthlyUSD = pricing.monthlyUSD || 2;
  const monthlyPKR = Math.round(monthlyUSD * rate);
  const quarterlyUSD = pricing.quarterlyUSD || 5;
  const quarterlyPKR = Math.round(quarterlyUSD * rate);
  const lifetimeUSD = pricing.lifetimeUSD || 10;
  const lifetimePKR = Math.round(lifetimeUSD * rate);

  return (
    <div className="space-y-6">
      <div className="text-center max-w-xl mx-auto">
        <h2 className="font-cinematic text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
          Studio Plans & Pricing
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
          Select a plan to generate studio voiceovers. Converted live at 1 USD = Rs. {rate} PKR.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* 1. Free Plan */}
        <div className="bg-[#0a0e1a] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Free
              </span>
              {currentPlan === "free" && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Current
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-2xl font-bold text-slate-100">Free</span>
            </div>
            <span className="text-xs text-slate-500 block mb-4">Rs. 0 PKR</span>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>10,000 characters (one-time)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>All 30 Gemini HD voices</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Single & Dual-speaker mode</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>16-bit PCM WAV download</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80">
            <span className="block text-center text-xs text-slate-500 font-medium py-1">
              Free with signup
            </span>
          </div>
        </div>

        {/* 2. 3-Day Plan */}
        <div className="bg-[#0a0e1a] border border-cyan-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-cyan-500/50">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                3-Day
              </span>
              {currentPlan === "threeday" && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-cyan-300">
                ${threedayUSD}
              </span>
              <span className="text-xs text-slate-400">/ 3 days</span>
            </div>
            <span className="text-xs text-cyan-400/90 font-mono font-medium block mb-4">
              Rs. {threedayPKR.toLocaleString()} PKR
            </span>
            <ul className="space-y-2 text-xs text-slate-200">
              <li className="flex items-center gap-2 font-medium text-cyan-200">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>100,000 words usage cap</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Valid for full 3 days</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>All 30 natural voices</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full Translate & Dub access</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onBuyNow("threeday", threedayUSD, threedayPKR)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#14232c] hover:bg-[#1a2f3a] border border-cyan-500/40 text-cyan-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Monthly Plan (Highlighted as "Popular") */}
        <div className="bg-gradient-to-b from-[#141b2d] to-[#0a0e1a] border-2 border-amber-500/60 rounded-2xl p-5 flex flex-col justify-between relative shadow-xl shadow-amber-500/10 transition-all hover:border-amber-400">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
            Popular
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 mt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Monthly
              </span>
              {(currentPlan === "pro_monthly" || currentPlan === "monthly") && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-amber-300">
                ${monthlyUSD}
              </span>
              <span className="text-xs text-slate-400">/ 30 days</span>
            </div>
            <span className="text-xs text-amber-400/90 font-mono font-medium block mb-4">
              Rs. {monthlyPKR.toLocaleString()} PKR
            </span>
            <ul className="space-y-2 text-xs text-slate-200">
              <li className="flex items-center gap-2 font-medium text-amber-200">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Unlimited speech</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Valid for full 30 days</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>All 30 voices & accents</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full Translate & Dub access</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onBuyNow("monthly", monthlyUSD, monthlyPKR)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. 3 Months Plan */}
        <div className="bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-amber-500/50">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                3 Months
              </span>
              {(currentPlan === "pro_3months" || currentPlan === "quarterly") && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-amber-300">
                ${quarterlyUSD}
              </span>
              <span className="text-xs text-slate-400">/ 90 days</span>
            </div>
            <span className="text-xs text-amber-400/80 font-mono font-medium block mb-4">
              Rs. {quarterlyPKR.toLocaleString()} PKR
            </span>
            <ul className="space-y-2 text-xs text-slate-200">
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
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Full Translate & Dub access</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onBuyNow("quarterly", quarterlyUSD, quarterlyPKR)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#141b2c] hover:bg-[#1a233a] border border-amber-500/40 text-amber-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5. Lifetime Plan (Highlighted as "Best Value") */}
        <div className="bg-gradient-to-b from-[#1b1528] to-[#0a0e1a] border-2 border-amber-400/80 rounded-2xl p-5 flex flex-col justify-between relative shadow-xl shadow-amber-500/10 transition-all hover:border-amber-300">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
            Best Value
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 mt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Lifetime
              </span>
              {currentPlan === "lifetime" && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-slate-100">
                ${lifetimeUSD}
              </span>
              <span className="text-xs text-slate-400">/ forever</span>
            </div>
            <span className="text-xs text-slate-400 font-mono font-medium block mb-4">
              Rs. {lifetimePKR.toLocaleString()} PKR
            </span>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2 font-medium text-amber-300">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Unlimited voiceover forever</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>No recurring fees or renewals</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Commercial broadcast rights</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>All future studio features</span>
              </li>
            </ul>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onBuyNow("lifetime", lifetimeUSD, lifetimePKR)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5"
            >
              <span>Buy Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
