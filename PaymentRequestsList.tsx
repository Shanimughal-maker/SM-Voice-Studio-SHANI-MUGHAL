/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Clock, CheckCircle2, XCircle, FileText, ExternalLink } from "lucide-react";
import type { PaymentRequest } from "../utils/firebase";

interface PaymentRequestsListProps {
  requests: PaymentRequest[];
}

export function PaymentRequestsList({ requests }: PaymentRequestsListProps) {
  if (requests.length === 0) {
    return (
      <div className="bg-[#0a0e1a] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p>No payment requests submitted yet.</p>
        <p className="text-slate-500 text-[11px] mt-1">
          When you purchase a plan via manual payment, your status and receipt will appear here.
        </p>
      </div>
    );
  }

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-[#0a0e1a] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold text-slate-100 font-cinematic tracking-wide">
          My Payment Requests
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {requests.length} total
        </span>
      </div>

      <div className="divide-y divide-slate-800/80">
        {requests.map((req) => {
          const isPending = req.status === "pending";
          const isApproved = req.status === "approved";
          const isRejected = req.status === "rejected";

          return (
            <div
              key={req.id}
              className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-200 capitalize">
                    {req.plan} Plan
                  </span>
                  <span className="text-slate-400 font-mono">
                    (${req.amountUSD} / Rs. {req.amountPKR?.toLocaleString()} PKR)
                  </span>

                  {/* Status Badge */}
                  {isPending && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                      <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                      Pending Review
                    </span>
                  )}
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Approved
                    </span>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      Rejected
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                  <span>
                    Method: <strong className="text-slate-300">{req.method}</strong>
                  </span>
                  <span>
                    TID: <strong className="text-slate-300 font-mono uppercase">{req.transactionId}</strong>
                  </span>
                  <span>{formatDateTime(req.createdAt)}</span>
                </div>

                {/* Subtext description for status */}
                {isPending && (
                  <p className="text-[11px] text-amber-300/80 italic mt-0.5">
                    Under review, usually approved within a few hours. Your plan will activate automatically.
                  </p>
                )}
                {isRejected && (
                  <p className="text-[11px] text-rose-400 font-medium mt-0.5">
                    Reason: {req.rejectionReason || "Verification failed. Please contact support or resubmit."}
                  </p>
                )}
              </div>

              {/* Screenshot Preview Link */}
              {req.screenshotUrl && (
                <a
                  href={req.screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0 self-start sm:self-center"
                >
                  <span>View Receipt</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
