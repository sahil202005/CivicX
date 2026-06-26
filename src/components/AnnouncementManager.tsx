import React, { useState, useEffect } from "react";
import { Sparkles, Globe, MapPin } from "lucide-react";

interface AnnouncementManagerProps {
  user: any;
}

export default function AnnouncementManager({ user }: AnnouncementManagerProps) {
  const [announcement, setAnnouncement] = useState<string>("");
  const [targetWard, setTargetWard] = useState<string>("All Regions");
  const [availableWards, setAvailableWards] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Load all wards to target
  useEffect(() => {
    fetch("/api/wards")
      .then(res => res.json())
      .then(data => {
        if (data && data.wards) {
          setAvailableWards(data.wards);
        }
      })
      .catch(err => console.error("Error loading wards for announcement manager:", err));
  }, []);

  // Fetch announcement for chosen target ward
  useEffect(() => {
    fetch(`/api/announcement/${encodeURIComponent(targetWard)}`)
      .then(res => res.json())
      .then(data => {
        setAnnouncement(data.announcement ? data.announcement.text : "");
      })
      .catch(err => console.error("Error loading ward announcement:", err));
  }, [targetWard]);

  const handleUpdateAnnouncement = async () => {
    const response = await fetch("/api/announcement", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-username": user?.username },
      body: JSON.stringify({ text: announcement, ward: targetWard })
    });
    const result = await response.json();
    if (response.ok) {
      setIsEditing(false);
      alert(`Announcement for "${targetWard}" updated!`);
    } else {
      alert("Failed to update announcement: " + (result.error || "Unknown error"));
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-800">
          <Sparkles size={18} className="text-amber-600 animate-pulse" />
          <h3 className="font-bold text-sm">Jurisdiction Announcements Portal</h3>
        </div>

        {/* Ward Target Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Target Ward:</span>
          <select
            value={targetWard}
            onChange={(e) => {
              setTargetWard(e.target.value);
              setIsEditing(false);
            }}
            className="text-xs p-1.5 px-3 rounded-lg border border-amber-200 outline-none bg-amber-50/50 text-amber-900 font-semibold focus:border-amber-400"
          >
            <option value="All Regions">🌍 All Regions (Global)</option>
            {user?.ward && user.ward !== "Municipal Control HQ" && (
              <option value={user.ward}>📍 My Ward: {user.ward}</option>
            )}
            {availableWards.map((w: any) => (
              <option key={w.id} value={w.name}>📍 {w.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={announcement} 
            onChange={e => setAnnouncement(e.target.value)}
            className="w-full p-3 rounded-xl border text-sm border-amber-200 focus:ring-2 focus:ring-amber-300 outline-none bg-stone-50/50 text-stone-800 min-h-[80px]"
            placeholder={`Type important civic alert or update for ${targetWard}...`}
          />
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setIsEditing(false)} 
              className="text-xs text-stone-500 hover:text-stone-700 font-bold px-3 py-1.5 rounded-lg border border-stone-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdateAnnouncement} 
              className="bg-amber-600 text-white p-1.5 px-4 rounded-lg text-xs font-bold hover:bg-amber-700 transition"
            >
              Broadcast Alert
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
          <div className="space-y-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 block font-mono">
              ACTIVE BROADCAST: {targetWard}
            </span>
            <p className="text-sm text-amber-900 font-medium leading-relaxed">
              {announcement || "No active bulletins published for this jurisdiction corridor."}
            </p>
          </div>
          <button 
            onClick={() => setIsEditing(true)} 
            className="text-xs bg-white border border-amber-200 text-amber-800 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-100/50 transition shrink-0"
          >
            Edit Announcement
          </button>
        </div>
      )}
    </div>
  );
}
