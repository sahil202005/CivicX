import React, { useState, useEffect } from "react";
import { Sparkles, Award, Shield, AlertTriangle, TrendingUp, RefreshCw, Layers, History, Trophy, Clock } from "lucide-react";
import { UserProfile, HotspotPrediction, AuditRecord } from "../types";
import { getLevelName } from "../utils";

interface ImpactPanelProps {
  user: UserProfile;
  leaderboard: UserProfile[];
  hotspots: HotspotPrediction[];
  auditTrail: AuditRecord[];
  activeWorkspace?: "citizen" | "authority" | "agency";
}

export default function ImpactPanel({
  user,
  leaderboard,
  hotspots,
  auditTrail,
  activeWorkspace
}: ImpactPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"gamification" | "hotspots" | "audit">("gamification");
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    console.log("ImpactPanel: activeWorkspace:", activeWorkspace, "user.ward:", user.ward);
    if (activeWorkspace === "citizen") {
      const ward = user.ward || "All Regions";
      console.log("Fetching announcement for citizen in ward:", ward);
      fetch(`/api/announcement/${encodeURIComponent(ward)}`)
        .then(res => res.json())
        .then(data => {
          console.log("Announcement data received:", data);
          if (data.announcement) {
            setAnnouncement(data.announcement.text);
          } else if (ward !== "All Regions") {
             // Try fetching "All Regions" as fallback
             fetch(`/api/announcement/All Regions`)
              .then(res => res.json())
              .then(data => {
                if (data.announcement) setAnnouncement(data.announcement.text);
              });
          }
        });
    }
  }, [activeWorkspace, user.ward]);

  if (!user) {
    return (
      <div id="impact-panel-card" className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center justify-center space-y-2">
          <span className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-[11px] text-stone-400 font-mono">Syncing citizen stats...</p>
        </div>
      </div>
    );
  }

  // Calculate XP threshold
  const getNextLevelXp = () => user.level * 1000;
  const getXpProgressPct = () => {
    const minXp = (user.level - 1) * 1000;
    const currentLevelProgress = user.xp - minXp;
    return Math.min(100, Math.max(0, (currentLevelProgress / 1000) * 100));
  };

  return (
    <div id="impact-panel-card" className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm flex flex-col justify-between">
      <div>
        {activeWorkspace === "citizen" && announcement && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium mb-4">
              <strong>📢 Announcement:</strong> {announcement}
            </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Layers size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-sans tracking-tight">Impact & Predictive AI</h2>
              <p className="text-xs text-stone-400">Citizen gamification, predictive risk hotspots, and public audit records</p>
            </div>
          </div>

          {/* Sub tabs selectors */}
          <div className="flex gap-1.5 border border-stone-150 p-1 rounded-xl bg-stone-50/50" id="impact-sub-tabs">
            <button
              type="button"
              onClick={() => setActiveSubTab("gamification")}
              className={`py-1 px-3 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                activeSubTab === "gamification"
                  ? "bg-white text-stone-800 shadow-xs font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              🏆 Level (XP)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("hotspots")}
              className={`py-1 px-3 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                activeSubTab === "hotspots"
                  ? "bg-white text-stone-800 shadow-xs font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              🔮 Predictive AI
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("audit")}
              className={`py-1 px-3 text-[10px] font-bold rounded-lg transition-all capitalize cursor-pointer ${
                activeSubTab === "audit"
                  ? "bg-white text-stone-800 shadow-xs font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              📜 Open Ledger
            </button>
          </div>
        </div>

        {/* Dynamic sub tab contents nested block */}
        <div>
          {/* Sub Tab A: Citizen Gamification */}
          {activeSubTab === "gamification" && (
            <div className="space-y-4" id="section-gamification">
              {/* User stats card overview */}
              <div className="bg-gradient-to-br from-indigo-50 to-stone-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row justify-between items-start md:items-center p-5 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                      <Trophy size={14} />
                    </span>
                    <span className="text-sm font-bold text-stone-800 tracking-tight">{user.username} (You)</span>
                  </div>
                  {user.email && (
                    <span className="text-[10px] text-stone-40 w-full block font-semibold text-stone-500 font-mono -mt-1 leading-none">{user.email}</span>
                  )}
                  <div className="pt-1">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400 block font-mono">Rank {getLevelName(user.level)} (Lvl {user.level})</span>
                    <span className="text-2xl font-black text-stone-900">{user.xp} <strong className="text-xs font-normal text-stone-500">Total XP points</strong></span>
                  </div>

                  {user.ward && (
                    <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100/60 text-xs space-y-1 mt-1 shrink-0">
                      <div className="font-bold text-stone-700 flex items-center gap-1">
                        <span>📍 Ward Juris:</span>
                        <span className="text-indigo-600 font-extrabold">{user.ward}</span>
                      </div>
                      <div className="flex gap-2.5 text-[10px] font-mono text-stone-500">
                        <span>👑 Ward Standing: <strong className="text-indigo-600 font-bold">Rank #{user.wardRank || 1}</strong></span>
                        <span className="text-stone-3 w-px h-3 bg-stone-200" />
                        <span>🌐 Capital City: <strong className="text-stone-700">Rank #{user.rank}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* progress bar */}
                  <div className="w-52 pt-1">
                    <div className="flex justify-between items-center text-[9px] text-stone-400 font-mono mb-1">
                      <span>{getLevelName(user.level)} (Lvl {user.level})</span>
                      <span>{user.xp % 1000} / 1000 XP for next level</span>
                    </div>
                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${getXpProgressPct()}%` }} />
                    </div>
                  </div>
                </div>

                {/* mini badges drawer */}
                <div className="space-y-1 w-full md:w-auto">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-700 block font-mono">🏆 Earned Achievement Badges:</span>
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {user.badges.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 p-1.5 px-3 rounded-lg bg-white border border-indigo-100/50 shadow-xs max-w-sm">
                        <Award size={14} className="text-amber-500 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-stone-800 block leading-tight">{b.name}</span>
                          <span className="text-[9px] text-stone-400 block leading-none">{b.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Missions tracker tray */}
              <div className="bg-stone-100/50 p-4 border border-stone-150 rounded-xl space-y-2 mt-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">🎯 Active Monthly Civic Missions</span>
                <div className="space-y-2">
                  <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-700">Verify Regional Alerts</span>
                    <span className="font-mono text-[10px] text-stone-500">2/3 (+150 XP)</span>
                  </div>

                  <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-700">First Vision Filing</span>
                    <span className="font-mono text-[10px] text-emerald-600 font-bold">Claimed ✓</span>
                  </div>
                </div>
              </div>

              {/* Public leaderboards lists */}
              <div className="space-y-6">
                {activeWorkspace !== "agency" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-stone-700 uppercase tracking-tight block font-sans">👥 Community Creator Leaderboard (Top Citizens)</span>
                    </div>
                    <div className="border border-stone-100 rounded-xl overflow-hidden divide-y divide-stone-50 max-h-[250px] overflow-y-auto">
                      {leaderboard
                        .filter((u) => {
                          const isCitizen = u.role === "citizen";
                          const isNotSystemUser = u.username !== "citizen" && u.username !== "roads";
                          const isWardMatch = activeWorkspace === "citizen" ? (u.ward === user.ward) : true;
                          
                          return isCitizen && isNotSystemUser && isWardMatch;
                        })
                        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                        .map((leader, index) => (
                          <div key={leader.username} className="flex items-center justify-between p-2.5 px-4 text-xs hover:bg-stone-50 transition-colors bg-white/40">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[10px] text-stone-400 w-4 font-bold text-center">#{index + 1}</span>
                              <span className="text-xl">{leader.avatar || "👤"}</span>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-stone-700">{leader.username}</span>
                                  {index === 0 && <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[8px] font-bold scale-90 p-0.5 px-1 rounded uppercase tracking-wide">🏆 Top Citizen</span>}
                                </div>
                                {leader.ward && (
                                  <span className="text-[9.5px] text-stone-400 font-mono">
                                    📍 {leader.ward} (Ward Rank: <strong className="text-stone-600 font-bold">#{leader.wardRank || 1}</strong>)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-[10px] text-stone-400">{getLevelName(leader.level)}</span>
                              <span className="font-bold text-stone-800">{leader.xp} XP</span>
                            </div>
                          </div>
                        ))}
                      {leaderboard.filter((u) => u.role === "citizen" && u.username !== "citizen" && u.username !== "roads").length === 0 && (
                        <div className="p-4 text-center text-[10.5px] text-stone-400 font-mono">
                          No custom citizen accounts have submitted tickets yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-sm font-bold text-stone-700 uppercase tracking-tight block mb-3 font-sans">🛠️ Professional Agency Leaderboard (Efficiency Ranks)</span>
                  <div className="border border-stone-100 rounded-xl overflow-hidden divide-y divide-stone-50 animate-fade-in">
                    {leaderboard
                      .filter((u) => u.role === "agency" && u.username !== "agency") // Only custom/active workforces
                      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                      .map((agency, index) => (
                        <div key={agency.username} className="flex items-center justify-between p-2.5 px-4 text-xs hover:bg-stone-50 transition-colors bg-sky-50/30">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-stone-400 w-4 font-bold text-center">#{index + 1}</span>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-stone-700">🛠️ {agency.username}</span>
                                {index === 0 && <span className="bg-sky-100 border border-sky-200 text-sky-850 text-[8px] font-bold scale-90 p-0.5 px-1 rounded uppercase tracking-wide font-mono">⚡ Most Efficient</span>}
                              </div>
                              <span className="text-[9.5px] text-stone-400 font-mono">
                                Completed: <strong className="text-indigo-600 font-bold">{agency.tasksCompletedCount || 0} tasks</strong> &middot; Avg: <strong className="text-emerald-600 font-bold">{(agency.averageCompletionTimeHrs || 0).toFixed(1)} hrs</strong>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-[10px] text-stone-400">{getLevelName(agency.level || 1)}</span>
                            <span className="font-bold text-stone-800">{agency.xp || 0} XP</span>
                          </div>
                        </div>
                      ))}
                    {leaderboard.filter((u) => u.role === "agency" && u.username !== "agency").length === 0 && (
                      <div className="p-4 text-center text-[10.5px] text-stone-400 font-mono">
                        No custom agency crews registered. Run tasks to check performance.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab B: Predictive AI Hotspots */}
          {activeSubTab === "hotspots" && (
            <div className="space-y-4 font-sans text-xs" id="section-predictive-ai">
              <div className="bg-indigo-900 text-white p-4 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                  <TrendingUp size={14} className="text-indigo-300 stroke-2" />
                  <span>PREDICTIVE AI ENGAGED: CRITICAL EXTRAPOLATION MODELS</span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-indigo-200">
                  By aggregating historical GPS tagging coordinates, seasonal storm drainage patterns, and road friction data grids, our machine learning forecasts infrastructure breach risks to optimize municipal crew routing.
                </p>
              </div>

              {/* Hotspot prediction cards list */}
              <div className="space-y-3">
                {hotspots.map((hot) => (
                  <div key={hot.id} className="p-3 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors flex flex-col md:flex-row gap-3">
                    {/* circular risk index gauge with color */}
                    <div className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-orange-700 font-mono leading-none">{hot.riskScore}%</span>
                      <span className="text-[8px] text-orange-500 font-bold uppercase tracking-wider scale-90 leading-none mt-0.5 font-mono">RISK</span>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 font-sans tracking-tight">{hot.category} Cluster : {hot.address}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-500 font-bold rounded-full font-mono border border-slate-100 capitalize">⚠️ Trend: {hot.trend}</span>
                          <span className="text-[9.5px] font-mono text-slate-400">({hot.incidentCount} incidents)</span>
                        </div>
                      </div>
                      <p className="text-[10.5px] leading-normal text-slate-500 italic font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <strong className="text-slate-600 block text-[9.5px] uppercase tracking-wider not-italic font-sans font-bold">Proactive Intervention Recommendations:</strong>
                        {hot.recommendedAction}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub Tab C: Open Audit Ledger */}
          {activeSubTab === "audit" && (
            <div className="space-y-3 font-mono text-xs" id="section-open-ledger font-mono">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">📜 Transparency Audit Trail Ledger:</span>
                <span className="text-[9px] text-slate-400 block italic font-sans flex items-center gap-1">
                   Real-time Blockchain-backed Event log <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                </span>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden overflow-y-auto max-h-[360px] divide-y divide-slate-100 text-[10.5px]" id="audit-ledger-container">
                {auditTrail.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-slate-50 transition-colors space-y-1 font-mono">
                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span className="font-bold text-indigo-600">👤 Actor: {log.actor}</span>
                      <span className="flex items-center gap-1"><Clock size={9} /> {new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-semibold text-slate-800 text-[11px] font-sans tracking-tight">{log.action}</div>
                    <p className="text-slate-500 leading-normal font-sans text-xs italic">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
