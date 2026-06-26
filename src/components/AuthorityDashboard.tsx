import React, { useState, useEffect } from "react";
import { Shield, Clock, Users, ChevronRight, CheckCircle2, UserCheck, AlertCircle, Sparkles } from "lucide-react";
import { IssueReport, IssueStatus, UserProfile } from "../types";

interface AuthorityDashboardProps {
  reports: IssueReport[];
  user: UserProfile;
  leaderboard: UserProfile[];
  onDispatch: (id: string, agencyUsername: string, workersCount: number) => Promise<void>;
  wards?: any[];
}

export default function AuthorityDashboard({ reports, user, leaderboard, onDispatch, wards = [] }: AuthorityDashboardProps) {
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>("All Wards"); // "All Wards" | "My Ward Only"
  const [selectedAgencyMap, setSelectedAgencyMap] = useState<{ [reportId: string]: string }>({});
  const [selectedWorkersMap, setSelectedWorkersMap] = useState<{ [reportId: string]: number }>({});
  const [isDispatchingId, setIsDispatchingId] = useState<string | null>(null);

  // Filter agencies from the leaderboard
  const agencies = leaderboard.filter((u) => u.role === "agency");
  console.log("AuthorityDashboard Debug:", { user, reportsCount: reports.length, agenciesCount: agencies.length, leaderboardCount: leaderboard.length });

  // Get all ward names owned by this authority user
  const myWardNames = (wards || [])
    .filter((w) => w.authorityUsername === user.username)
    .map((w) => w.name);

  // Determine which reports to show based on the authority's assigned ward jurisdiction
  const filteredReports = reports.filter((r) => {
    if (r.duplicateOf) return false;
    if (selectedWardFilter === "My Ward Only") {
      // Show issues that belong to the authority's marked ward zone
      const rWardLower = (r.assignedWard || "").trim().toLowerCase();
      const userWardLower = (user.ward || "").trim().toLowerCase();
      const myWardNamesLower = myWardNames.map((name) => (name || "").trim().toLowerCase());
      
      // Check if assignedWard exists, if not, maybe we should not filter it out?
      // For now, let's just check if it matches the user's ward or any of their managed wards
      const isMatch = (userWardLower && rWardLower === userWardLower) || 
                      (myWardNamesLower.length > 0 && myWardNamesLower.includes(rWardLower));
      
      // Debug logging
      console.log("AuthorityDashboard Filter Check:", { rId: r.id, rWard: r.assignedWard, userWard: user.ward, myWardNames, isMatch });
      return isMatch;
    }
    return true; // Show all
  });
  console.log("AuthorityDashboard Filter Result:", { selectedWardFilter, totalReports: reports.length, filteredCount: filteredReports.length });

  const handleDispatchSubmit = async (reportId: string) => {
    const agencyUsername = selectedAgencyMap[reportId];
    if (!agencyUsername) {
      alert("Please select a professional workforce agency to dispatch this ticker.");
      return;
    }
    
    // Find the agency to get default workersCount
    const agency = agencies.find(a => a.username === agencyUsername);
    const defaultCount = agency?.workersCount || 5;
    const workersCount = selectedWorkersMap[reportId] || defaultCount;

    setIsDispatchingId(reportId);
    try {
      await onDispatch(reportId, agencyUsername, workersCount);
      // Success is updated upstream via fetchAllData
    } catch (e) {
      console.error(e);
    } finally {
      setIsDispatchingId(null);
    }
  };

  return (
    <div id="authority-dashboard-card" className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600 block">
            <Shield size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-stone-900 font-sans tracking-tight">Authority {user.username} Triage Command</h2>
            <div className="text-xs text-stone-400 flex items-center gap-2">
              Corridor Zone: 
              <select
                value={user.ward || ""}
                onChange={(e) => {
                  // In a real app, this would update the user's active ward or filter reports
                  console.log("Ward changed to:", e.target.value);
                }}
                className="font-bold text-indigo-600 bg-transparent outline-none cursor-pointer"
              >
                {myWardNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {myWardNames.length === 0 && <option value={user.ward || "All Regions"}>{user.ward || "All Regions"}</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Ward Scope Selector */}
        <div className="flex bg-stone-150 p-1 rounded-xl text-xs font-semibold self-stretch md:self-auto gap-1">
          <button
            type="button"
            onClick={() => setSelectedWardFilter("My Ward Only")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedWardFilter === "My Ward Only"
                ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            📍 My Zone Reports
          </button>
          <button
            type="button"
            onClick={() => setSelectedWardFilter("All Wards")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedWardFilter === "All Wards"
                ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            🌐 All Districts
          </button>
        </div>
      </div>
      

      {/* Triage Tickets Feed */}
      <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="text-center py-10 bg-stone-50 border border-stone-100 rounded-2xl" id="auth-empty">
              <Shield className="mx-auto text-stone-300 mb-2" size={32} />
              <p className="text-xs font-bold text-stone-500">No active tickets routed to your corridor.</p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const isAssigned = report.status === "assigned" || report.status === "in_progress" || report.status === "resolved";
              const isCompleted = report.status === "resolved";

              return (
                <div
                  key={report.id}
                  id={`auth-ticket-${report.id}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isCompleted
                      ? "bg-emerald-50/20 border-emerald-150"
                      : report.status === "in_progress"
                      ? "bg-sky-50/20 border-sky-150"
                      : report.status === "assigned"
                      ? "bg-amber-50/10 border-amber-200"
                      : "bg-white border-stone-100 shadow-xs hover:border-stone-200"
                  }`}
                >
                  {/* Header info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-dashed border-stone-100 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-stone-800 font-mono text-[11px] bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                        #{report.id.slice(0, 6)}
                      </span>
                      <span className="font-bold text-stone-900">{report.category}</span>
                    </div>

                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : report.status === "in_progress"
                          ? "bg-sky-100 text-sky-800"
                          : report.status === "assigned"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {report.status === "submitted" ? "New Citizen Alert" : report.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Core Description Column */}
                    <div className="md:col-span-12 space-y-2">
                      <p className="text-xs text-stone-600 leading-relaxed font-medium">
                        <strong className="text-stone-700">Description:</strong> {report.description}
                      </p>

                      <div className="flex flex-wrap gap-2 text-[10px] text-stone-500 font-semibold">
                        <span className="bg-stone-100 px-2 py-0.5 rounded-md">
                          📍 {report.address || `Lat: ${report.latitude.toFixed(4)}, Lng: ${report.longitude.toFixed(4)}`}
                        </span>
                        {report.assignedWard && (
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold">
                            📂 Zone: {report.assignedWard}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dispatch Triage Actions */}
                  {!isAssigned && (
                    <div className="mt-4 pt-3 border-t border-stone-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="flex-1">
                        <label className="block text-[10px] font-extrabold text-stone-500 uppercase tracking-widest mb-1 font-mono">
                          Assign Professional Workforce Agency
                        </label>
                        <select
                          value={selectedAgencyMap[report.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedAgencyMap({ ...selectedAgencyMap, [report.id]: val });
                            const targetAgency = agencies.find(a => a.username === val);
                            if (targetAgency) {
                              setSelectedWorkersMap({ ...selectedWorkersMap, [report.id]: targetAgency.workersCount || 5 });
                            }
                          }}
                          className="w-full text-xs p-2 rounded-lg border border-stone-200 outline-none bg-white font-semibold text-stone-700 focus:border-indigo-400"
                        >
                          <option value="">-- Choose Agency to Dispatch --</option>
                          {agencies.map((agency) => (
                            <option key={agency.username} value={agency.username}>
                              🛠️ {agency.username} ({agency.workersCount || 5} Workers)
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDispatchSubmit(report.id)}
                        disabled={isDispatchingId === report.id}
                        className="self-stretch md:self-end py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <UserCheck size={14} />
                        {isDispatchingId === report.id ? "Dispatching..." : "Dispatch to Agency"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
      </div>

    </div>
  );
}
