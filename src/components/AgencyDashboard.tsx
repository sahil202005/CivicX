import React, { useState, useRef } from "react";
import { Wrench, CheckCircle2, RefreshCw, Upload, Image as ImageIcon, Sparkles, Clock, Calendar, Compass } from "lucide-react";
import { IssueReport, UserProfile } from "../types";

interface AgencyDashboardProps {
  reports: IssueReport[];
  user: UserProfile;
  onCompleteTask: (id: string, resolvedPhoto: string) => Promise<void>;
  onAcceptTask: (id: string) => Promise<void>;
  onRejectTask: (id: string, reason: string) => Promise<void>;
}

export default function AgencyDashboard({ reports, user, onCompleteTask, onAcceptTask, onRejectTask }: AgencyDashboardProps) {
  const [activeTab, setActiveTab ] = useState<"active" | "completed">("active");
  const [completionPhotoMap, setCompletionPhotoMap] = useState<{ [id: string]: string }>({});
  const [isUploadingMap, setIsUploadingMap] = useState<{ [id: string]: boolean }>({});
  const [isSubmittingMap, setIsSubmittingMap] = useState<{ [id: string]: boolean }>({});
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  
  // Accept/Reject action states
  const [isAcceptingMap, setIsAcceptingMap] = useState<{ [id: string]: boolean }>({});
  const [isRejectingMap, setIsRejectingMap] = useState<{ [id: string]: boolean }>({});
  const [showRejectInputMap, setShowRejectInputMap] = useState<{ [id: string]: boolean }>({});
  const [rejectReasonMap, setRejectReasonMap] = useState<{ [id: string]: string }>({});

  const fileInputRefMap = useRef<{ [id: string]: HTMLInputElement | null }>({});

  // Filter tasks assigned to this active agency
  const myReports = reports.filter((r) => r.assignedAgency === user.username);
  const activeTasks = myReports.filter((r) => r.status === "in_progress" || r.status === "assigned");
  const completedTasks = myReports.filter((r) => r.status === "resolved");

  const processFile = (file: File, reportId: string) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file as completion proof.");
      return;
    }

    setIsUploadingMap((prev) => ({ ...prev, [reportId]: true }));
    const reader = new FileReader();
    reader.onloadend = () => {
      setCompletionPhotoMap((prev) => ({ ...prev, [reportId]: reader.result as string }));
      setIsUploadingMap((prev) => ({ ...prev, [reportId]: false }));
    };
    reader.onerror = () => {
      alert("Failed reading file. Please try again.");
      setIsUploadingMap((prev) => ({ ...prev, [reportId]: false }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveId(id);
    } else if (e.type === "dragleave") {
      setDragActiveId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], id);
    }
  };

  const handleSubmitComplete = async (id: string) => {
    const photo = completionPhotoMap[id];
    if (!photo) {
      alert("Please upload a resolution proof photo before finalizing assignment.");
      return;
    }

    setIsSubmittingMap((prev) => ({ ...prev, [id]: true }));
    try {
      await onCompleteTask(id, photo);
      // Success will refresh the reports list upstream
    } catch (e) {
      console.error(e);
      alert("Failed to submit and lock resolution.");
    } finally {
      setIsSubmittingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAccept = async (reportId: string) => {
    setIsAcceptingMap((prev) => ({ ...prev, [reportId]: true }));
    try {
      await onAcceptTask(reportId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAcceptingMap((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const handleRejectSubmit = async (reportId: string) => {
    const reason = rejectReasonMap[reportId] || "";
    if (!reason.trim()) {
      alert("Please provide a reason for rejecting the dispatch.");
      return;
    }
    setIsRejectingMap((prev) => ({ ...prev, [reportId]: true }));
    try {
      await onRejectTask(reportId, reason);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRejectingMap((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  return (
    <div id="agency-dashboard-card" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
      
      {/* Header operations bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-sky-50 text-sky-600">
            <Wrench size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Workforce Agency Operations</h2>
            <p className="text-xs text-slate-400">Claims dispatch queue, recommended SLAs & visual completion proofs</p>
          </div>
        </div>

        {/* Workspace Active state switches */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "active"
                ? "bg-white text-sky-700 shadow-xs font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            📋 Dispatched Queue ({activeTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "completed"
                ? "bg-white text-sky-700 shadow-xs font-extrabold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ✅ My Completed ({completedTasks.length})
          </button>
        </div>
      </div>

      {/* Stats row for performance metrics */}
      <div className="grid grid-cols-2 gap-4 bg-sky-50/20 p-4 rounded-xl border border-sky-100">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-widest block font-mono">My Resolved Contracts</span>
          <span className="text-xl font-bold text-slate-800 block">{user.tasksCompletedCount || 0} tasks completed</span>
        </div>
        <div className="space-y-1 border-l border-sky-100 pl-4">
          <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-widest block font-mono">Average SLA Completion Time</span>
          <span className="text-xl font-bold text-slate-800 block">
            {user.averageCompletionTimeHrs ? `${user.averageCompletionTimeHrs.toFixed(1)} hours` : "N/A"}
          </span>
        </div>
      </div>

      {/* Items panel body */}
      <div className="space-y-4">
        {activeTab === "active" ? (
          activeTasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-2xl">
              <CheckCircle2 className="mx-auto text-slate-300 mb-2" size={32} />
              <p className="text-xs font-bold text-slate-500">Your dispatch queue is fully clear!</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                No tickets are currently active or assigned to your crew. Wards will assign tickets as citizens make alerts!
              </p>
            </div>
          ) : (
            activeTasks.map((report) => (
              <div
                key={report.id}
                id={`agency-task-${report.id}`}
                className={`p-4 rounded-xl border transition-all space-y-4 ${
                  report.status === "assigned"
                    ? "border-amber-200 bg-amber-50/5 hover:border-amber-300"
                    : "border-sky-100 bg-sky-50/5 hover:border-sky-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      #{report.id.slice(0, 6)}
                    </span>
                    <span className="font-extrabold text-slate-900 text-xs">{report.category}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                      report.status === "assigned"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-sky-100 text-sky-800"
                    }`}>
                      {report.status === "assigned" ? "Assigned (Pending Accept)" : "Accepted & In Progress"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200 font-mono">
                    <Clock size={11} className="shrink-0" />
                    <span>SLA Suggested Max Timer: {report.aiCompletionTimerHrs} Hrs</span>
                  </div>
                </div>

                {/* Report parameters */}
                <div className="bg-white p-3 rounded-lg border border-slate-100 space-y-2 text-xs">
                  <p className="text-slate-600 leading-normal font-medium">
                    <strong className="text-slate-700">Citizen Description:</strong> {report.description}
                  </p>
                  <p className="text-slate-400 text-[10px] font-medium font-mono">
                    📍 Destination: {report.address} | Severity Alert: {report.severity}
                  </p>
                </div>

                {report.status === "assigned" ? (
                  /* Accept/Reject Interactive Decision Panel */
                  <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5 text-xs">
                      <span className="text-lg">📢</span>
                      <div className="flex-1 space-y-1">
                        <p className="font-bold text-amber-900">Task Dispatched to Crew</p>
                        <p className="text-amber-700 text-[11px]">
                          Please accept this task to authorize field operations, or reject it with a formal municipal reason.
                        </p>
                      </div>
                    </div>

                    {showRejectInputMap[report.id] ? (
                      <div className="space-y-3 pt-2 border-t border-amber-200/40">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold text-amber-800 uppercase tracking-widest font-mono">
                            Reason for Rejecting Dispatch *
                          </label>
                          <input
                            type="text"
                            value={rejectReasonMap[report.id] || ""}
                            onChange={(e) => setRejectReasonMap(prev => ({ ...prev, [report.id]: e.target.value }))}
                            placeholder="e.g. Out of jurisdictional coverage, equipment mismatch, crew exhausted..."
                            className="w-full text-xs p-2.5 rounded-xl border border-amber-200 focus:border-amber-400 outline-none transition bg-white font-medium text-slate-800 focus:ring-1 focus:ring-amber-300"
                          />
                        </div>
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setShowRejectInputMap(prev => ({ ...prev, [report.id]: false }))}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold text-slate-500 hover:bg-slate-100 transition whitespace-nowrap cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectSubmit(report.id)}
                            disabled={isRejectingMap[report.id]}
                            className="px-4 py-1.5 rounded-lg text-[11px] font-extrabold bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
                          >
                            {isRejectingMap[report.id] ? "Rejecting..." : "Confirm Reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 pt-2 border-t border-amber-200/40">
                        <button
                          type="button"
                          onClick={() => setShowRejectInputMap(prev => ({ ...prev, [report.id]: true }))}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Reject Task
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`, '_blank')}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Compass size={12} />
                          Directions
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccept(report.id)}
                          disabled={isAcceptingMap[report.id]}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition font-sans flex items-center gap-1.5 cursor-pointer"
                        >
                          {isAcceptingMap[report.id] ? "Accepting..." : "Accept & Start Job"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Interactive Drag and Drop resolution proof module for in_progress tasks */
                  <>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
                        Submit Photographic Integrity Proof
                      </label>

                      {completionPhotoMap[report.id] ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50/10 p-2 flex flex-col items-center justify-center space-y-2">
                          <img
                            src={completionPhotoMap[report.id]}
                            alt="Submitted proof preview"
                            className="max-h-48 rounded-lg object-contain w-full bg-white border"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => setCompletionPhotoMap((prev) => {
                              const updated = { ...prev };
                              delete updated[report.id];
                              return updated;
                            })}
                            className="p-1 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={11} /> Reset Proof Photo
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragEnter={(e) => handleDrag(e, report.id)}
                          onDragOver={(e) => handleDrag(e, report.id)}
                          onDragLeave={(e) => handleDrag(e, report.id)}
                          onDrop={(e) => handleDrop(e, report.id)}
                          onClick={() => fileInputRefMap.current[report.id]?.click()}
                          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                            dragActiveId === report.id
                              ? "border-sky-500 bg-sky-50/80"
                              : "border-slate-200 hover:border-sky-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <input
                            ref={(el) => { fileInputRefMap.current[report.id] = el; }}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, report.id)}
                            className="hidden"
                          />
                          <div className="p-2.5 rounded-full bg-slate-100 text-slate-500">
                            {isUploadingMap[report.id] ? (
                              <RefreshCw size={20} className="animate-spin" />
                            ) : (
                              <Upload size={20} />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {isUploadingMap[report.id] ? "Reading photo..." : "Drag & Drop completion photo here"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Or click here to browser files</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Resolution Trigger */}
                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSubmitComplete(report.id)}
                        disabled={!completionPhotoMap[report.id] || isSubmittingMap[report.id]}
                        className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                      >
                        <CheckCircle2 size={14} />
                        {isSubmittingMap[report.id] ? "Completing contract..." : "Submit Photo Proof & Finalize"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )
        ) : (
          completedTasks.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-slate-100 rounded-xl">
              <ImageIcon className="mx-auto text-slate-350 mb-2" size={24} />
              <p className="text-xs font-semibold text-slate-500">No completed resolutions on block.</p>
            </div>
          ) : (
            completedTasks.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/10 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-50 mb-2">
                  <span className="font-extrabold text-slate-800 font-mono">#{report.id.slice(0, 6)}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase font-mono">
                    Done & Resolved
                  </span>
                </div>

                <p className="text-slate-600 font-medium">
                  <strong>Description:</strong> {report.description}
                </p>

                {report.completionPhoto && (
                  <div className="rounded-lg overflow-hidden border max-h-40 flex items-center justify-center bg-white">
                    <img
                      src={report.completionPhoto}
                      alt="Completed job"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="text-[10px] text-slate-400 font-mono font-bold">
                  📍 Address: {report.address}
                </div>
              </div>
            ))
          )
        )}
      </div>

    </div>
  );
}
