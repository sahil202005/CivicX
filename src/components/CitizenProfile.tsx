import React, { useState } from "react";
import { User, Mail, Phone, MapPin, Award, Save, Sparkles, Check, Bookmark, Target, Shield, Heart } from "lucide-react";
import { motion } from "motion/react";
import { UserProfile } from "../types";

interface CitizenProfileProps {
  user: UserProfile;
  wards: any[];
  onProfileUpdated: (updatedUser: UserProfile) => void;
  triggerToastAlert: (title: string, message: string, type?: "success" | "info" | "alert") => void;
}

const PRESET_AVATARS = [
  { char: "👤", name: "Default" },
  { char: "🕵️", name: "Civic Watcher" },
  { char: "👷", name: "Community Builder" },
  { char: "👩‍🎓", name: "Resident Graduate" },
  { char: "🎨", name: "Urban Designer" },
  { char: "🌱", name: "Eco Guardian" },
  { char: "🚀", name: "Smart Advocate" },
  { char: "🦁", name: "Neighborhood Lion" },
  { char: "🦊", name: "Cunning Reporter" },
  { char: "🐨", name: "Friendly Neighbor" },
  { char: "🦸", name: "Super Citizen" }
];

export default function CitizenProfile({
  user,
  wards,
  onProfileUpdated,
  triggerToastAlert
}: CitizenProfileProps) {
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [bio, setBio] = useState(user.bio || "");
  const [ward, setWard] = useState(user.ward || "");
  const [avatar, setAvatar] = useState(user.avatar || "👤");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-username": user.username
        },
        body: JSON.stringify({
          email,
          phone,
          bio,
          avatar,
          ward
        })
      });

      if (!res.ok) {
        throw new Error("Unable to synchronize profile parameters with server.");
      }

      const data = await res.json();
      onProfileUpdated(data.userProfile);
      triggerToastAlert("✨ Profile Synchronized", "Your citizen credentials have been updated securely.", "success");
    } catch (err: any) {
      triggerToastAlert("⚠️ Synchronization Error", err.message || "Failed to commit profile updates.", "alert");
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate XP Progress to next level (Each level is roughly 1000 XP)
  const xpInCurrentLevel = user.xp % 1000;
  const xpProgressPercent = Math.min(100, Math.floor((xpInCurrentLevel / 1000) * 100));
  const nextLevelXpNeeded = 1000 - xpInCurrentLevel;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="citizen-profile-view">
      {/* LEFT COLUMN - STATS CARD */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 flex flex-col items-center text-center relative overflow-hidden">
          {/* Decorative Background Blob */}
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-indigo-50 to-violet-50/50 -z-0" />
          
          {/* Avatar Display */}
          <div className="relative mt-4 mb-3 z-10">
            <span className="w-20 h-20 rounded-full bg-indigo-50 border-4 border-white shadow-md flex items-center justify-center text-4xl">
              {avatar}
            </span>
            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-1.5 shadow-xs">
              <Sparkles size={12} />
            </div>
          </div>

          <div className="z-10">
            <h3 className="text-base font-extrabold text-slate-800">{user.username}</h3>
            <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider font-mono">
              Level {user.level} {user.role === "citizen" ? "Citizen Activist" : user.role}
            </p>
          </div>

          {/* XP Progress Bar */}
          <div className="w-full mt-6 space-y-1.5 z-10 text-left">
            <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
              <span>XP PROGRESS ({user.xp} Total)</span>
              <span>{xpInCurrentLevel} / 1000 XP</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-500" 
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
            <p className="text-[9px] font-semibold text-slate-400 text-center">
              Earn {nextLevelXpNeeded} more XP to reach Level {user.level + 1}!
            </p>
          </div>

          {/* Quick Ranks Badge Grid */}
          <div className="grid grid-cols-2 gap-3 w-full mt-6 pt-5 border-t border-slate-100 z-10">
            <div className="bg-slate-50 p-3 rounded-xl flex flex-col items-center justify-center">
              <Shield size={16} className="text-indigo-500 mb-1" />
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Global Rank</span>
              <span className="text-sm font-black text-slate-800 font-mono">#{user.rank || "N/A"}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl flex flex-col items-center justify-center">
              <MapPin size={16} className="text-emerald-500 mb-1" />
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Ward Rank</span>
              <span className="text-sm font-black text-slate-800 font-mono">#{user.wardRank || 1}</span>
            </div>
          </div>
        </div>

        {/* EARNED BADGES DISPLAY */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-50 pb-3">
            <Award size={16} className="text-indigo-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono">Earned Badges ({user.badges?.length || 0})</h4>
          </div>
          
          {user.badges && user.badges.length > 0 ? (
            <div className="space-y-3">
              {user.badges.map((b) => (
                <div key={b.id} className="flex gap-3 p-2.5 rounded-xl border border-slate-50 bg-slate-50/20 hover:bg-indigo-50/10 transition">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                    {b.icon === "Check" ? "🎖️" : "⭐"}
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800">{b.name}</h5>
                    <p className="text-[10px] text-slate-500 font-semibold leading-normal">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs font-bold text-slate-400">No achievements recorded yet. Verify reports to earn special badges!</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN - EDIT FORM */}
      <form onSubmit={handleSaveProfile} className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
          <div className="flex items-center gap-2">
            <User size={16} className="text-indigo-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono">Update Profile Information</h4>
          </div>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md font-mono">
            Active Citizen File
          </span>
        </div>

        {/* EMOJI AVATAR SELECTOR */}
        <div className="space-y-2">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
            Choose Character Icon
          </label>
          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100">
            {PRESET_AVATARS.map((item) => (
              <button
                key={item.name}
                type="button"
                title={item.name}
                onClick={() => setAvatar(item.char)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer ${
                  avatar === item.char 
                    ? "bg-indigo-600 scale-110 shadow-xs text-white" 
                    : "hover:bg-slate-200 text-slate-700 bg-white"
                }`}
              >
                {item.char}
              </button>
            ))}
          </div>
        </div>

        {/* INPUT FIELDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. resident@muni.org"
                className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/30 font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
              Contact Phone
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555-0199"
                className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/30 font-semibold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* REGISTERED WARD SELECTION */}
        <div className="space-y-1">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
            Primary Assigned Ward Corridor
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-3.5 text-slate-400" />
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/30 font-semibold text-slate-800 appearance-none"
            >
              <option value="">Select Primary Ward Zone</option>
              {wards.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[9px] text-slate-400 font-medium">Changing your assigned ward updates where your default issue dashboard maps and AI chat routing points to.</p>
        </div>

        {/* BIOGRAPHY */}
        <div className="space-y-1">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
            Biography & Civic Interests
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself... e.g. Community organizer, local store owner, nature enthusiast interested in public street lighting safety."
            rows={4}
            className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/30 font-semibold text-slate-800 resize-none"
          />
        </div>

        {/* BUTTON ACTIONS */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 text-white font-bold text-xs py-2.5 px-5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? "Saving Settings..." : "Save Profile Details"}
          </button>
        </div>
      </form>
    </div>
  );
}
