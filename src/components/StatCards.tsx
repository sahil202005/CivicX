import React from "react";
import { Shield, Sparkles, CheckCircle, Users2, Clock, Crown } from "lucide-react";
import { GlobalStats, UserProfile } from "../types";
import { getLevelName } from "../utils";

interface StatCardsProps {
  stats: GlobalStats;
  topCitizen?: UserProfile;
}

export default function StatCards({ stats, topCitizen }: StatCardsProps) {
  const items = [
    {
      id: "stat-submitted",
      title: "Total Incidents Filed",
      value: stats.totalSubmitted,
      desc: "Logged via Citizen App",
      icon: Shield,
      color: "text-slate-600 bg-slate-50",
      border: "border-slate-100"
    },
    {
      id: "stat-resolved",
      title: "Incidents Resolved",
      value: stats.totalResolved,
      desc: "By Field Crews & Citizens",
      icon: CheckCircle,
      color: "text-emerald-600 bg-emerald-50",
      border: "border-emerald-100"
    },
    {
      id: "stat-cred",
      title: "Active Verified Alerts",
      value: stats.credibilityThresholdMet,
      desc: "Passed Credibility Limit",
      icon: Sparkles,
      color: "text-amber-600 bg-amber-50",
      border: "border-amber-100"
    },
    {
      id: "stat-sla",
      title: "Avg. Resolution Time",
      value: `${stats.averageSlaResolutionTimeHrs}h`,
      desc: "SLA Response Standard",
      icon: Clock,
      color: "text-blue-600 bg-blue-50",
      border: "border-blue-100"
    },
    {
      id: "stat-crews",
      title: "Active Field Crews",
      value: stats.activeWorkCrews,
      desc: "Fully Dispatched Units",
      icon: Users2,
      color: "text-indigo-600 bg-indigo-50",
      border: "border-indigo-100"
    },
    {
      id: "stat-top-citizen",
      title: "Top Citizen",
      value: topCitizen ? topCitizen.username : "N/A",
      desc: topCitizen ? `${getLevelName(topCitizen.level)} (Lvl ${topCitizen.level}) (${topCitizen.xp} XP)` : "No activity yet",
      icon: Crown,
      color: "text-purple-600 bg-purple-50",
      border: "border-purple-100"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6" id="stats-container">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            id={item.id}
            key={item.id}
            className={`p-4 rounded-xl border bg-white shadow-xs flex flex-col justify-between transition-all duration-200 ${item.border}`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.title}</span>
              <span className={`p-1.5 rounded-lg ${item.color}`}>
                <Icon size={16} />
              </span>
            </div>
            <div>
              <div className="text-xl font-bold font-sans text-slate-900 tracking-tight truncate" title={String(item.value)}>{item.value}</div>
              <div className="text-xs text-slate-400 mt-1 truncate" title={item.desc}>{item.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
