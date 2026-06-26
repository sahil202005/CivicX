import React, { useState } from "react";
import { ThumbsUp, PlusCircle, CheckCircle2, ShieldCheck, MapPin, AlertCircle, Clock, Link2, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IssueReport } from "../types";

interface CommunityFeedProps {
  reports: IssueReport[];
  onUpvote: (id: string) => Promise<void>;
  onAddEvidence: (id: string, text: string) => Promise<void>;
  onResolveCommunity: (id: string) => Promise<void>;
  selectedReportId?: string | null;
  currentUsername?: string;
}

export default function CommunityFeed({
  reports,
  onUpvote,
  onAddEvidence,
  onResolveCommunity,
  selectedReportId,
  currentUsername = "CitizenResident"
}: CommunityFeedProps) {
  const [filter, setFilter] = useState<"all" | "submitted" | "active" | "in_progress" | "resolved">("all");
  const [evidenceInputs, setEvidenceInputs] = useState<{ [id: string]: string }>({});
  const [activeEvidenceForm, setActiveEvidenceForm] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter reports
  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const slides = [];
  for (let i = 0; i < filteredReports.length; i += 2) {
    slides.push(filteredReports.slice(i, i + 2));
  }

  // Reset index when filter changes
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [filter]);

  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % slides.length);

  // Calculate hours remaining for SLA clock
  const getSlaTimeText = (dueDateStr: string, status: string) => {
    if (status === "resolved") return "SLA Complete";
    const due = new Date(dueDateStr).getTime();
    const diffMs = due - Date.now();
    const diffHrs = diffMs / 3600000;

    if (diffHrs < 0) {
      return `Overdue by ${Math.abs(Math.floor(diffHrs))}h (Escalated)`;
    }
    return `${Math.floor(diffHrs)}h remaining`;
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-emerald-100 text-emerald-800 border-emerald-250";
      case "in_progress":
        return "bg-sky-50 text-sky-700 border-sky-150 animate-pulse";
      case "active":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const handleEvidenceSubmit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = evidenceInputs[id]?.trim();
    if (!val) return;

    onAddEvidence(id, val);
    setEvidenceInputs((prev) => ({ ...prev, [id]: "" }));
    setActiveEvidenceForm(null);
  };

  return (
    <div id="community-feed-container" className="space-y-4">
      {/* Filtering Selector tabs */}
      <div className="flex border-b border-slate-100 pb-2 overflow-x-auto gap-2 no-scrollbar" id="feed-filters">
        {(["all", "submitted", "active", "in_progress", "resolved"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
              filter === tab
                ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                : "text-slate-500 border border-transparent hover:bg-slate-50"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 border border-slate-100 rounded-xl" id="feed-empty">
            <ShieldCheck className="mx-auto text-slate-400 mb-2" size={28} />
            <p className="text-xs font-semibold text-slate-500">No incident cards found in this filter.</p>
            <p className="text-[10px] text-slate-400 mt-1">Submit a report to populate the platform's feed.</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {slides[currentIndex].map((report) => {
                  const isSelected = selectedReportId === report.id;
                  const hasUpvoted = report.upvotedBy?.some(u => u.toLowerCase() === currentUsername.toLowerCase()) || false;
                  return (
                    <div
                      key={report.id}
                      id={`report-card-${report.id}`}
                      className={`p-5 rounded-xl border bg-white shadow-xs transition-all relative overflow-hidden ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/5"
                          : report.escalated
                          ? "border-rose-300 ring-1 ring-rose-100 bg-rose-50/5"
                          : "border-slate-100"
                      }`}
                    >
                    {/* Duplicate alert indicator frame matching flowchart */}
                    {report.duplicateOf && (
                      <div className="absolute top-0 inset-x-0 bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex items-center justify-between gap-2 z-10">
                        <span className="text-[10px] font-bold text-yellow-800 flex items-center gap-1">
                          <Link2 size={10} className="stroke-2" />
                          🤖 AI Deduplication: Auto-merged with parent issue #{report.duplicateOf}
                        </span>
                        <span className="text-[9px] font-medium text-yellow-600 italic">Dispatches combined to reduce redundancy</span>
                      </div>
                    )}

                    <div className={`flex flex-col md:flex-row gap-4 ${report.duplicateOf ? "pt-6" : ""}`}>
                      {/* Image panel */}
                      {report.photo && (
                        <div className="w-full md:w-32 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center">
                          <img
                            src={report.photo}
                            alt={report.category}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // Safe graceful placeholder fallback if any image load issue arises
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1473163928189-364b2c4e1135?q=80&w=600&auto=format&fit=crop";
                            }}
                          />
                        </div>
                      )}

                      {/* Content details frame */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {/* Department designation */}
                            <span className="text-[10px] font-bold text-indigo-600 tracking-wide uppercase font-mono block">
                              🏛️ {report.department}
                            </span>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-0.5 font-sans">
                              {report.category}
                              <span className="text-[9px] px-1.5 bg-slate-50 text-slate-500 font-mono font-medium rounded border border-slate-100">
                                #{report.id}
                              </span>
                            </h3>
                          </div>

                          {/* Filter Status Badge */}
                          <div className="flex gap-1.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadgeClass(report.severity)}`}>
                              {report.severity} Priority
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadgeClass(report.status)}`}>
                              {report.status}
                            </span>
                          </div>
                        </div>

                        {/* Primary user description log */}
                        <p className="text-xs text-slate-600 leading-normal">{report.description}</p>

                        {/* Gemini Summary Triage review if available */}
                        {report.actionSummary && (
                          <div className="bg-slate-50/80 border border-slate-100 p-2.5 rounded-lg text-[11px] leading-normal text-slate-600 flex gap-2 items-start mt-1">
                            <Sparkles size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-slate-800 text-[10px] font-semibold uppercase block tracking-wider font-mono">Gemini AI Action Summary:</strong>
                              {report.actionSummary}
                              {report.estimatedHoursToFix && (
                                <span className="text-slate-400 text-[9px] font-mono block mt-0.5">Est. Engineering Labor: {report.estimatedHoursToFix} hours</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Geographic address details */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <MapPin size={11} className="text-slate-300" />
                          <span className="truncate">{report.address}</span>
                        </div>

                        {/* Supplemental Community evidence cards, if logged */}
                        {report.evidence.length > 0 && (
                          <div className="bg-slate-50/40 p-2 rounded-lg border border-slate-100 space-y-1 mt-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">🗣️ Supplemental Community Evidence Logs:</span>
                            {report.evidence.map((ev, index) => (
                              <div key={index} className="text-[10px] text-slate-600 italic leading-relaxed border-l-2 border-indigo-200 pl-2">
                                {ev}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Live timers & action panel */}
                        <div className="pt-2 flex flex-wrap items-center justify-between border-t border-slate-50 gap-2 mt-2">
                          {/* credibility score and timer */}
                          <div className="flex items-center gap-4">
                            {/* SLA stopwatch timer */}
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <Clock size={11} className={report.escalated ? "text-rose-500 animate-spin" : "text-slate-400"} />
                              <span className={report.escalated ? "text-rose-600 font-bold" : ""}>
                                {getSlaTimeText(report.slaDueAt, report.status)}
                              </span>
                            </div>

                            {/* Credibility score bubble */}
                            <span className="text-[10px] text-slate-500 font-mono">
                               Credibility Value: <strong className={report.credibilityScore >= 20 ? "text-emerald-600 font-semibold" : "text-slate-600"}>{report.credibilityScore}pts</strong>
                            </span>
                          </div>

                          {/* community actions */}
                          {report.status !== "resolved" && (
                            <div className="flex items-center gap-1.5">
                              {/* Upvote button */}
                              <button
                                type="button"
                                disabled={hasUpvoted}
                                onClick={() => !hasUpvoted && onUpvote(report.id)}
                                className={`p-1 px-2 text-[10px] rounded-md border transition-all flex items-center gap-1 ${
                                  hasUpvoted
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold cursor-not-allowed"
                                    : "border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-slate-50 cursor-pointer"
                                }`}
                                title={hasUpvoted ? "You have already verified this ticket" : "Confirm presence & elevate ticket priority status"}
                              >
                                <ThumbsUp size={11} className={hasUpvoted ? "fill-emerald-600 stroke-emerald-700" : ""} />
                                <span>{hasUpvoted ? "Verified" : "Verify"} ({report.upvotes})</span>
                              </button>

                              {/* Add evidence trigger */}
                              <button
                                type="button"
                                onClick={() => setActiveEvidenceForm(activeEvidenceForm === report.id ? null : report.id)}
                                className="p-1 px-2 text-[10px] rounded-md border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <PlusCircle size={11} />
                                <span>Evidence</span>
                              </button>

                              {/* Verify resolved (Community peer validation) */}
                              {!report.resolvedByCommunity && (
                                <button
                                  type="button"
                                  onClick={() => onResolveCommunity(report.id)}
                                  className="p-1 px-2 text-[10px] rounded-md bg-emerald-50 border border-emerald-150 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Verify resolution as a peer"
                                >
                                  <CheckCircle2 size={11} />
                                  <span>Mark Fixed</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Add evidence nested inline form drawer */}
                        <AnimatePresence>
                          {activeEvidenceForm === report.id && (
                            <motion.form
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              onSubmit={(e) => handleEvidenceSubmit(report.id, e)}
                              className="p-2 border-t border-slate-100 mt-2 space-y-1.5 overflow-hidden"
                            >
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Add descriptive evidence or update parameters:</span>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder="Provide update (e.g. 'Street pavement completely flooded as of 4pm')"
                                  value={evidenceInputs[report.id] || ""}
                                  onChange={(e) => setEvidenceInputs({ ...evidenceInputs, [report.id]: e.target.value })}
                                  className="flex-1 p-1.5 border border-slate-200 px-2 text-[11px] rounded-lg outline-hidden bg-slate-50 focus:border-indigo-400"
                                  required
                                />
                                <button
                                  type="submit"
                                  className="p-1.5 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-medium hover:bg-indigo-750 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <PlusCircle size={10} /> Submit
                                </button>
                              </div>
                            </motion.form>
                          )}
                        </AnimatePresence>

                      </div>
                    </div>
                  </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
            {slides.length > 1 && (
              <div className="flex items-center justify-between mt-4 p-2 bg-slate-50 rounded-lg">
                <button 
                  onClick={handlePrev} 
                  className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[10px] font-bold text-slate-400 font-mono">Page {currentIndex + 1} / {slides.length}</span>
                <button 
                  onClick={handleNext} 
                  className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
