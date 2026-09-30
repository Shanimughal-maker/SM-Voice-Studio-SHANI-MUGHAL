/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Key,
  ExternalLink,
  Copy,
  CheckCheck,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  DollarSign,
  AlertCircle,
  Save,
  Check,
  X,
  CreditCard,
  FileImage,
  Sparkles,
} from "lucide-react";
import {
  savePaymentSettingsToFirestore,
  subscribeAllPaymentRequests,
  subscribePaymentMethods,
  subscribePricingSettings,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PRICING,
  type PaymentMethodItem,
  type PaymentRequest,
  type PricingSettings,
  type User,
} from "../utils/firebase";

interface AdminPaymentPanelProps {
  currentUser: User | null;
}

export function AdminPaymentPanel({ currentUser }: AdminPaymentPanelProps) {
  // Authentication & Passcode
  const [adminPasscode, setAdminPasscode] = useState("");
  const isSuperAdminEmail = currentUser?.email === "chromebook160nb@gmail.com";
  const [isUnlocked, setIsUnlocked] = useState(isSuperAdminEmail);

  // Active Admin Sub-Tab: "requests" | "methods" | "licenses"
  const [activeAdminTab, setActiveAdminTab] = useState<"requests" | "methods" | "licenses">("requests");

  // Section G: Payment Requests State
  const [allRequests, setAllRequests] = useState<PaymentRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [planFilter, setPlanFilter] = useState<"all" | "threeday" | "monthly" | "quarterly" | "lifetime">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    url: string;
    tid: string;
    sender: string;
    amount: string;
  } | null>(null);

  // Section H: Payment Methods & Pricing State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(DEFAULT_PAYMENT_METHODS);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings>(DEFAULT_PRICING);
  const [pricingForm, setPricingForm] = useState<PricingSettings>(DEFAULT_PRICING);
  const [exchangeRateInput, setExchangeRateInput] = useState<number>(280);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string | null>(null);
  const [settingsErrorMsg, setSettingsErrorMsg] = useState<string | null>(null);

  // Method Add/Edit Modal
  const [editingMethod, setEditingMethod] = useState<PaymentMethodItem | null>(null);
  const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
  const [newMethodForm, setNewMethodForm] = useState<Omit<PaymentMethodItem, "id">>({
    name: "",
    accountNumber: "",
    accountTitle: "",
    instructions: "",
    enabled: true,
    badgeColor: "#d92027",
  });

  // Action & Rejection Feedback
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<PaymentRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // License Generator State
  const [genPlan, setGenPlan] = useState<"threeday" | "monthly" | "quarterly" | "lifetime">("threeday");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [copiedTid, setCopiedTid] = useState<string | null>(null);

  // Live Subscription: Payment Methods & Pricing from Firestore
  useEffect(() => {
    const unsubMethods = subscribePaymentMethods((methods) => {
      if (methods && methods.length > 0) {
        setPaymentMethods(methods);
      }
    });
    const unsubPricing = subscribePricingSettings((pricing) => {
      if (pricing) {
        setPricingSettings(pricing);
        setExchangeRateInput(pricing.exchangeRatePKR || 280);
      }
    });
    return () => {
      unsubMethods();
      unsubPricing();
    };
  }, []);

  // Live Subscription: All Payment Requests for Admin
  useEffect(() => {
    if (!isUnlocked && !isSuperAdminEmail) return;
    let isSubscribed = true;

    // First try real-time snapshot
    const unsub = subscribeAllPaymentRequests(
      (requests) => {
        if (isSubscribed) {
          setAllRequests(requests);
        }
      },
      () => {
        // Fallback to server endpoint if direct rules evaluation needs proxy
        fetchRequestsFromServer();
      }
    );

    // Initial server fetch to ensure memory cache is merged
    fetchRequestsFromServer();

    return () => {
      isSubscribed = false;
      unsub();
    };
  }, [isUnlocked, isSuperAdminEmail]);

  const fetchRequestsFromServer = async () => {
    setIsLoadingRequests(true);
    try {
      const idToken = await currentUser?.getIdToken();
      const res = await fetch("/api/admin/payment-requests", {
        headers: {
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          ...(adminPasscode ? { "x-admin-passcode": adminPasscode } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          setAllRequests(data.requests);
        }
      }
    } catch (e) {
      console.warn("Could not fetch server payment requests:", e);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode.trim()) {
      setIsUnlocked(true);
      fetchRequestsFromServer();
    }
  };

  // Section G: Approve Payment Action
  const handleApprove = async (requestId: string) => {
    setActionMessage(null);
    setApprovingId(requestId);
    try {
      const idToken = await currentUser?.getIdToken();
      const res = await fetch("/api/admin/approve-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          ...(adminPasscode ? { "x-admin-passcode": adminPasscode } : {}),
        },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve payment");
      }
      setActionMessage(`Payment approved! Plan successfully activated.`);
      fetchRequestsFromServer();
    } catch (err: any) {
      alert(err.message || "Failed to approve payment");
    } finally {
      setApprovingId(null);
    }
  };

  // Section G: Reject Payment Action
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    const reason = rejectionReasonInput.trim() || "Transaction ID unverified or incorrect payment.";
    try {
      const idToken = await currentUser?.getIdToken();
      const res = await fetch("/api/admin/reject-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          ...(adminPasscode ? { "x-admin-passcode": adminPasscode } : {}),
        },
        body: JSON.stringify({
          requestId: rejectingRequest.id,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject payment");
      }
      setActionMessage("Payment request marked as rejected.");
      setRejectingRequest(null);
      setRejectionReasonInput("");
      fetchRequestsFromServer();
    } catch (err: any) {
      alert(err.message || "Failed to reject payment");
    }
  };

  // Section H: Payment Methods Reordering
  const handleMoveMethod = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= paymentMethods.length) return;
    const updated = [...paymentMethods];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setPaymentMethods(updated);
  };

  // Section H: Toggle Method Enable/Disable
  const handleToggleMethod = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: m.enabled === false ? true : false } : m))
    );
  };

  // Section H: Delete Method
  const handleDeleteMethod = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove the payment method "${name}"?`)) {
      setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
    }
  };

  // Section H: Add New Method
  const handleCreateMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodForm.name.trim() || !newMethodForm.accountNumber.trim()) {
      alert("Name and Account Number are required.");
      return;
    }
    const newMethod: PaymentMethodItem = {
      id: "pm_" + Date.now(),
      name: newMethodForm.name.trim(),
      accountNumber: newMethodForm.accountNumber.trim(),
      accountTitle: newMethodForm.accountTitle.trim(),
      instructions: newMethodForm.instructions?.trim() || "",
      enabled: newMethodForm.enabled ?? true,
      badgeColor: newMethodForm.badgeColor || "#00a859",
    };
    setPaymentMethods((prev) => [...prev, newMethod]);
    setIsAddMethodOpen(false);
    setNewMethodForm({
      name: "",
      accountNumber: "",
      accountTitle: "",
      instructions: "",
      enabled: true,
      badgeColor: "#d92027",
    });
  };

  // Section H: Save Edited Method
  const handleSaveEditMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMethod) return;
    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === editingMethod.id ? editingMethod : m))
    );
    setEditingMethod(null);
  };

  // Section H: Save All Settings (Methods + Exchange Rate) to Firestore
  const handleSaveAllSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSuccessMsg(null);
    setSettingsErrorMsg(null);
    const updatedPricing: PricingSettings = {
      ...pricingSettings,
      exchangeRatePKR: Number(exchangeRateInput) || 280,
    };
    try {
      const idToken = await currentUser?.getIdToken();
      await savePaymentSettingsToFirestore(
        paymentMethods,
        updatedPricing,
        idToken,
        adminPasscode
      );
      setPricingSettings(updatedPricing);
      setSettingsSuccessMsg("Payment methods and exchange rate saved live to Firestore!");
      setTimeout(() => setSettingsSuccessMsg(null), 4000);
    } catch (err: any) {
      setSettingsErrorMsg(err?.message || "Failed to save settings to Firestore.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // License Key Generation Action
  const handleGenerateKey = async () => {
    setIsGeneratingKey(true);
    try {
      const idToken = await currentUser?.getIdToken();
      const res = await fetch("/api/admin/generate-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          ...(adminPasscode ? { "x-admin-passcode": adminPasscode } : {}),
        },
        body: JSON.stringify({ plan: genPlan }),
      });
      const data = await res.json();
      if (res.ok && data.key) {
        setGeneratedKey(data.key);
      }
    } catch (e: any) {
      alert(e.message || "Could not generate key");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  // Filter and Search Computation for Requests Table
  const pendingCount = useMemo(() => {
    return allRequests.filter((r) => r.status === "pending").length;
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    let list = [...allRequests];
    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    // Search query (email, transactionId, senderName)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.email?.toLowerCase().includes(q) ||
          r.transactionId?.toLowerCase().includes(q) ||
          r.senderName?.toLowerCase().includes(q) ||
          r.senderNumber?.includes(q) ||
          r.method?.toLowerCase().includes(q)
      );
    }
    // Ordering: Pending requests ALWAYS appear first, then newest first
    list.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    return list;
  }, [allRequests, statusFilter, searchQuery]);

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

  // Lockscreen gate if not admin
  if (!isUnlocked && !isSuperAdminEmail) {
    return (
      <div className="bg-[#0a0e1a]/90 border border-slate-800 rounded-2xl p-6 text-center max-w-md mx-auto shadow-2xl">
        <ShieldCheck className="w-10 h-10 text-amber-400 mx-auto mb-2" />
        <h4 className="text-base font-bold text-slate-100 font-cinematic">
          Studio Administration
        </h4>
        <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
          Access the Payment Requests Queue, Live Payment Methods Manager, and License Key Generator.
        </p>
        <form onSubmit={handleUnlock} className="flex gap-2">
          <input
            type="password"
            placeholder="Enter studio passcode..."
            value={adminPasscode}
            onChange={(e) => setAdminPasscode(e.target.value)}
            className="flex-1 bg-[#080b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/60"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0e1a] border border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 text-slate-200">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 font-cinematic">
              Admin Operations Center
            </h3>
            <span className="text-[11px] text-slate-400">
              Logged in as {currentUser?.email || "Studio Admin"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRequestsFromServer}
          disabled={isLoadingRequests}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-center shrink-0 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRequests ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveAdminTab("requests")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeAdminTab === "requests"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-[#0e1424] text-slate-300 hover:text-slate-100 border border-slate-800"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Requests</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px] animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveAdminTab("methods")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeAdminTab === "methods"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-[#0e1424] text-slate-300 hover:text-slate-100 border border-slate-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Payment Methods & Rates</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveAdminTab("licenses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeAdminTab === "licenses"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "bg-[#0e1424] text-slate-300 hover:text-slate-100 border border-slate-800"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Generate License Keys</span>
        </button>
      </div>

      {/* SECTION G: PAYMENT REQUESTS TABLE */}
      {activeAdminTab === "requests" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  statusFilter === "all"
                    ? "bg-slate-700 text-slate-100 font-bold"
                    : "bg-[#0e1424] text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({allRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  statusFilter === "pending"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                    : "bg-[#0e1424] text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Pending</span>
                {pendingCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                )}
                <span>({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("approved")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  statusFilter === "approved"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                    : "bg-[#0e1424] text-slate-400 hover:text-slate-200"
                }`}
              >
                Approved ({allRequests.filter((r) => r.status === "approved").length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("rejected")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  statusFilter === "rejected"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold"
                    : "bg-[#0e1424] text-slate-400 hover:text-slate-200"
                }`}
              >
                Rejected ({allRequests.filter((r) => r.status === "rejected").length})
              </button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search email, TID, sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#080b14] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080b14]/90">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CreditCard className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p>No payment requests found matching your filter.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0c111e]">
                    <th className="py-3 px-3.5">User Email</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Sender Info</th>
                    <th className="py-3 px-3">Transaction ID (TID)</th>
                    <th className="py-3 px-3 text-center">Receipt</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRequests.map((req) => {
                    const isPending = req.status === "pending";
                    const isApproved = req.status === "approved";
                    const isRejected = req.status === "rejected";
                    const isApproving = approvingId === req.id;

                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          isPending ? "bg-amber-500/[0.03]" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5 font-medium text-slate-200">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-100 max-w-[150px] truncate" title={req.email}>
                              {req.email || "No email"}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title={req.uid}>
                              {req.uid}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              req.plan === "lifetime"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : req.plan === "quarterly"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {req.plan}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-200">
                            ${req.amountUSD}
                          </span>
                          <span className="text-[10px] text-amber-400/90 block font-mono">
                            Rs. {req.amountPKR?.toLocaleString()} PKR
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {req.method}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-medium text-slate-200 block">
                            {req.senderName}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {req.senderNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-300 text-xs">
                              {req.transactionId}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(req.transactionId);
                                setCopiedTid(req.transactionId);
                                setTimeout(() => setCopiedTid(null), 2000);
                              }}
                              className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                              title="Copy Transaction ID"
                            >
                              {copiedTid === req.transactionId ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {req.screenshotUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedScreenshot({
                                  url: req.screenshotUrl,
                                  tid: req.transactionId,
                                  sender: `${req.senderName} (${req.senderNumber})`,
                                  amount: `Rs. ${req.amountPKR?.toLocaleString()} PKR`,
                                })
                              }
                              className="relative group rounded-lg overflow-hidden border border-slate-700 inline-block w-10 h-10 hover:border-amber-400 transition-all cursor-pointer"
                              title="Click to enlarge receipt"
                            >
                              <img
                                src={req.screenshotUrl}
                                alt="Receipt thumbnail"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-600">No img</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {formatDateTime(req.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Pending
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Approved
                            </span>
                          )}
                          {isRejected && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-bold"
                              title={req.rejectionReason || "Payment unverified"}
                            >
                              <XCircle className="w-3 h-3 text-rose-400" />
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApprove(req.id)}
                                disabled={isApproving}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                              >
                                {isApproving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingRequest(req);
                                  setRejectionReasonInput("Transaction ID not found / payment unverified");
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : isApproved ? (
                            <button
                              type="button"
                              disabled
                              className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-800/40 cursor-not-allowed"
                            >
                              Activated
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingRequest(req);
                                setRejectionReasonInput(req.rejectionReason || "");
                              }}
                              className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                            >
                              Edit Reason
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SECTION H: PAYMENT METHODS MANAGER & EXCHANGE RATE */}
      {activeAdminTab === "methods" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[#0d1322] border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  Live Currency Exchange Rate (USD to PKR)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Controls the live PKR prices displayed across the entire app for all customers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">1 USD = Rs.</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(Number(e.target.value))}
                  className="w-24 bg-[#080b14] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                />
                <span className="text-xs text-slate-300 font-medium">PKR</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div className="bg-[#080b14] p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Monthly ($2 USD):</span>
                <strong className="text-amber-300 font-mono text-xs">
                  Rs. {Math.round(2 * exchangeRateInput).toLocaleString()} PKR
                </strong>
              </div>
              <div className="bg-[#080b14] p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] block">3 Months ($5 USD):</span>
                <strong className="text-amber-300 font-mono text-xs">
                  Rs. {Math.round(5 * exchangeRateInput).toLocaleString()} PKR
                </strong>
              </div>
              <div className="bg-[#080b14] p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Lifetime ($10 USD):</span>
                <strong className="text-amber-300 font-mono text-xs">
                  Rs. {Math.round(10 * exchangeRateInput).toLocaleString()} PKR
                </strong>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Payment Accounts Configuration ({paymentMethods.length})
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add, edit, enable/disable, or reorder the account numbers shown on the customer Payment Modal.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMethodOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Payment Method</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllSettings}
                  disabled={isSavingSettings}
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save to Firestore</span>
                </button>
              </div>
            </div>

            {settingsSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{settingsSuccessMsg}</span>
              </div>
            )}
            {settingsErrorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{settingsErrorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              {paymentMethods.map((method, index) => {
                const isEnabled = method.enabled !== false;
                return (
                  <div
                    key={method.id}
                    className={`bg-[#0d1322] border rounded-xl p-4 transition-all ${
                      isEnabled
                        ? "border-slate-800 hover:border-slate-700"
                        : "border-slate-900 opacity-60 bg-[#090d16]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">
                            {method.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isEnabled
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {isEnabled ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 flex flex-wrap gap-4 pt-0.5">
                          <span>
                            Title: <strong className="text-slate-100">{method.accountTitle}</strong>
                          </span>
                          <span>
                            Number: <strong className="text-amber-300 font-mono tracking-wider">{method.accountNumber}</strong>
                          </span>
                        </div>
                        {method.instructions && (
                          <p className="text-[11px] text-slate-400 italic pt-0.5">
                            Note: {method.instructions}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveMethod(index, "up")}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                          title="Move Up in order"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveMethod(index, "down")}
                          disabled={index === paymentMethods.length - 1}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                          title="Move Down in order"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMethod(method)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer"
                          title="Edit Method"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleMethod(method.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            isEnabled
                              ? "bg-slate-800 text-slate-300 hover:text-amber-300"
                              : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          }`}
                        >
                          {isEnabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMethod(method.id, method.name)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Delete Method"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION: LICENSE KEYS GENERATOR */}
      {activeAdminTab === "licenses" && (
        <div className="p-5 bg-[#0d1322] border border-slate-800 rounded-xl space-y-4 animate-in fade-in duration-200">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" />
              Generate Single-Use Customer License Key
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Creates a secure cryptographic license key saved directly in the Firestore <code className="text-amber-300">licenses</code> collection. Customers can redeem it on the Accounts page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={genPlan}
              onChange={(e) => setGenPlan(e.target.value as any)}
              className="bg-[#080b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="threeday">3-Day License (100k Words)</option>
              <option value="monthly">Monthly License (30 Days)</option>
              <option value="quarterly">3 Months License (90 Days)</option>
              <option value="lifetime">Lifetime License (Unlimited Forever)</option>
            </select>
            <button
              type="button"
              onClick={handleGenerateKey}
              disabled={isGeneratingKey}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              {isGeneratingKey ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Generate Key</span>
            </button>
          </div>
          {generatedKey && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#080b14] border border-amber-500/40">
              <span className="font-mono text-xs sm:text-sm text-amber-300 font-bold tracking-wider select-all flex-1">
                {generatedKey}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#141b2c] hover:bg-[#1a233a] border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Key</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD PAYMENT METHOD */}
      {isAddMethodOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-100 font-cinematic">
                Add New Payment Method
              </h4>
              <button
                type="button"
                onClick={() => setIsAddMethodOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateMethod} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Method / Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank, SadaPay, Raast"
                  value={newMethodForm.name}
                  onChange={(e) => setNewMethodForm({ ...newMethodForm, name: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Account Number / IBAN</label>
                <input
                  type="text"
                  placeholder="e.g. 03001234567 or PK00MEZN..."
                  value={newMethodForm.accountNumber}
                  onChange={(e) => setNewMethodForm({ ...newMethodForm, accountNumber: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Account Title</label>
                <input
                  type="text"
                  placeholder="e.g. Zeeshan Akbar"
                  value={newMethodForm.accountTitle}
                  onChange={(e) => setNewMethodForm({ ...newMethodForm, accountTitle: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Buyer Instructions (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Send via Raast or bank app"
                  value={newMethodForm.instructions}
                  onChange={(e) => setNewMethodForm({ ...newMethodForm, instructions: e.target.value })}
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="newMethodEnabled"
                  type="checkbox"
                  checked={newMethodForm.enabled}
                  onChange={(e) => setNewMethodForm({ ...newMethodForm, enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 cursor-pointer accent-amber-500"
                />
                <label htmlFor="newMethodEnabled" className="text-slate-300 cursor-pointer select-none">
                  Enable immediately on customer payment modal
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMethodOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300"
                >
                  Add Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PAYMENT METHOD */}
      {editingMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0e1a] border border-amber-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-100 font-cinematic">
                Edit Payment Method
              </h4>
              <button
                type="button"
                onClick={() => setEditingMethod(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditMethod} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Method / Bank Name</label>
                <input
                  type="text"
                  value={editingMethod.name}
                  onChange={(e) => setEditingMethod({ ...editingMethod, name: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Account Number / IBAN</label>
                <input
                  type="text"
                  value={editingMethod.accountNumber}
                  onChange={(e) => setEditingMethod({ ...editingMethod, accountNumber: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Account Title</label>
                <input
                  type="text"
                  value={editingMethod.accountTitle}
                  onChange={(e) => setEditingMethod({ ...editingMethod, accountTitle: e.target.value })}
                  required
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Buyer Instructions</label>
                <input
                  type="text"
                  value={editingMethod.instructions || ""}
                  onChange={(e) => setEditingMethod({ ...editingMethod, instructions: e.target.value })}
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="editMethodEnabled"
                  type="checkbox"
                  checked={editingMethod.enabled !== false}
                  onChange={(e) => setEditingMethod({ ...editingMethod, enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 cursor-pointer accent-amber-500"
                />
                <label htmlFor="editMethodEnabled" className="text-slate-300 cursor-pointer select-none">
                  Enabled for customers
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMethod(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT PAYMENT DIALOG WITH REASON */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0e1a] border border-rose-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                Reject Payment Request
              </h4>
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              User <strong className="text-slate-200">{rejectingRequest.email}</strong> (TID: <span className="font-mono text-amber-300">{rejectingRequest.transactionId}</span>) will see this rejection reason in their My Payments list.
            </p>
            <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Reason for Rejection:
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g. Transaction ID not found on bank statement, or amount received was incorrect."
                  className="w-full bg-[#080b14] border border-slate-800 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-rose-500/60 leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SCREENSHOT LIGHTBOX ENLARGEMENT */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-3xl w-full max-h-[95vh] bg-[#0a0e1a] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-3.5 bg-[#0e1424] border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <FileImage className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200">
                  TID: <span className="font-mono text-amber-300">{selectedScreenshot.tid}</span>
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-400 hidden sm:inline">{selectedScreenshot.sender}</span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-amber-400 font-semibold hidden sm:inline">{selectedScreenshot.amount}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedScreenshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 p-1"
                >
                  <span>Open Original</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedScreenshot(null)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={selectedScreenshot.url}
                alt="Payment receipt proof"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
