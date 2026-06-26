import React, { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, Sparkles, RefreshCw, Layers, CheckCircle2, Siren, ArrowRight, BookOpen, Bot } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IssueReport, GlobalStats, UserProfile, HotspotPrediction, AuditRecord, IssueStatus } from "./types";
import StatCards from "./components/StatCards";
import ReportForm from "./components/ReportForm";
import CommunityFeed from "./components/CommunityFeed";
import AuthorityDashboard from "./components/AuthorityDashboard";
import AgencyDashboard from "./components/AgencyDashboard";
import ImpactPanel from "./components/ImpactPanel";
import CityMap from "./components/CityMap";
import AnnouncementManager from "./components/AnnouncementManager";
import CivicChatBot from "./components/CivicChatBot";
import CitizenProfile from "./components/CitizenProfile";
import { getLevelName } from "./utils";

export default function App() {
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [hotspots, setHotspots] = useState<HotspotPrediction[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditRecord[]>([]);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // Shared GIS Location and selection states
  const [latitude, setLatitude] = useState(18.5204);
  const [longitude, setLongitude] = useState(73.8567);
  const [address, setAddress] = useState("MG Road, Pune, Maharashtra, 411001, India");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local login screen tab selection state
  const [loginTab, setLoginTab] = useState<"citizen" | "authority" | "agency">("citizen");

  // active selected role workspace tab
  const [activeWorkspace, setActiveWorkspace] = useState<"citizen" | "authority" | "agency">("citizen");

  // User Session Management states
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("civic_username"));
  const [citizenAuthMode, setCitizenAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authWard, setAuthWard] = useState("");
  const [authWorkersCount, setAuthWorkersCount] = useState<number>(5);
  const [availableWards, setAvailableWards] = useState<any[]>([]);
  const [isCustomWard, setIsCustomWard] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Authority Admin Passcode states
  const [isAuthorityUnlocked, setIsAuthorityUnlocked] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  // OTP Verification and Toast Alerts states
  const [otpSession, setOtpSession] = useState<{ pending: boolean; code: string; email: string; inputCode: string; callback?: () => void } | null>(null);
  const [otpError, setOtpError] = useState("");
  const [toastAlert, setToastAlert] = useState<{ title: string; message: string; visible: boolean; type?: "success" | "info" | "alert" } | null>(null);
  const [citizenMessages, setCitizenMessages] = useState<Array<{ id: string; timestamp: string; title: string; text: string; read: boolean }>>([
    {
      id: "m-welcome",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: "Security Activation Alert",
      text: "🔒 Verification complete. Secure resident corridor channel established with Civic Ledger Hub.",
      read: true
    }
  ]);
  const [citizenTab, setCitizenTab] = useState<"feed" | "messages" | "profile">("feed");
  const [isChatOpen, setIsChatOpen] = useState(false);

  const triggerToastAlert = (title: string, message: string, type: "success" | "info" | "alert" = "info") => {
    setToastAlert({ title, message, visible: true, type });
    // Sound alert using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.log("Audio alert playback blocked or unavailable");
    }
  };

  // Fetch all starting parameters from Express API endpoints
  const fetchAllData = async (silent = false) => {
    if (!username) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setErrorMsg(null);
    try {
      const headersInit: HeadersInit = {
        "x-username": username || ""
      };

      // Helper to parse responses safely to avoid any Unexpected token '<' errors
      const safeParseJson = async (res: Response, filename: string) => {
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error(`Received invalid non-JSON format for ${filename}:`, text.slice(0, 300));
          throw new Error(`Server returned invalid response structure for ${filename}. Please try refreshing.`);
        }
        return await res.json();
      };

      const [reportsRes, statsRes, auditRes] = await Promise.all([
        fetch("/api/reports", { headers: headersInit }),
        fetch("/api/stats", { headers: headersInit }),
        fetch("/api/audit", { headers: headersInit })
      ]);

      if (!reportsRes.ok || !statsRes.ok || !auditRes.ok) {
        throw new Error("Failed to load initial data from Express backend endpoints.");
      }

      const reportData = await safeParseJson(reportsRes, "/api/reports");
      const statsData = await safeParseJson(statsRes, "/api/stats");
      const auditData = await safeParseJson(auditRes, "/api/audit");

      setReports(reportData);
      setStats(statsData.globalStats);
      setHotspots(statsData.hotspots);
      setLeaderboard(statsData.leaderboard);
      
      // Select the logged-in user profile from the returned leaderboard data
      let matched = username ? statsData.leaderboard.find(
        (u: UserProfile) => u.username.toLowerCase() === username.toLowerCase()
      ) : null;
      
      if (matched) {
        setUser(matched);
        if (matched.role) {
          setActiveWorkspace(matched.role);
        }
      } else {
        // Fallback: If not found in returned leaderboard data, attempt to query the profile directly
        try {
          const userRes = await fetch("/api/users", { headers: headersInit });
          if (userRes.ok) {
            const userData = await safeParseJson(userRes, "/api/users");
            if (userData && userData.userProfile) {
              setUser(userData.userProfile);
              if (userData.userProfile.role) {
                setActiveWorkspace(userData.userProfile.role);
              }
              setLeaderboard(prev => [...prev, userData.userProfile]);
              matched = userData.userProfile;
            }
          }
        } catch (e) {
          console.error("Direct user profile query recovery failed:", e);
        }

        // If still not registered or matched, create a robust local provisional session
        // rather than kicking the resident out of their session.
        if (!matched) {
          const fallbackProfile: UserProfile = {
            username: username,
            xp: 0,
            level: 1,
            ward: "Civic Hub Corridor",
            badges: [{ id: "fallback-rec", name: "Charter Citizen", icon: "User", description: "Your profile is active in your browser session." }],
            rank: statsData.leaderboard.length + 1,
            wardRank: 1,
            role: "citizen"
          };
          setUser(fallbackProfile);
        }
      }
      setAuditTrail(auditData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An network connection incident occurred.");
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (username && user) {
      fetchAllData();
      const ward = user.ward || "All Regions";
      fetch(`/api/announcement/${encodeURIComponent(ward)}`)
        .then(res => res.json())
        .then(data => {
          setAnnouncement(data.announcement ? data.announcement.text : null);
        });
    } else {
      setLoading(false);
    }
  }, [username, user?.ward]);

  const prevReportsRef = React.useRef<IssueReport[]>([]);

  useEffect(() => {
    if (reports.length > 0 && prevReportsRef.current.length > 0 && username) {
      reports.forEach(newRep => {
        const oldRep = prevReportsRef.current.find(r => r.id === newRep.id);
        if (oldRep && oldRep.status !== newRep.status) {
          const isOwner = (newRep.reportedBy || "").toLowerCase() === username.toLowerCase();
          if (isOwner) {
            let title = "📋 Ticket Status Update";
            let desc = `Your report for "${newRep.description.slice(0, 30)}..." changed from ${oldRep.status} to ${newRep.status}.`;
            if (newRep.status === "dispatched") {
              title = "🚨 Dispatch Action Initiated";
              desc = `Your incident card has been handed over to the field agency crew for resolution in ${newRep.assignedWard}.`;
            } else if (newRep.status === "resolved") {
              title = "✅ Incident Resolution Confirmed";
              desc = `Congratulations! Your reported incident has been verified and successfully resolved. 100 XP granted!`;
            } else if (newRep.status === "rejected") {
              title = "⚠️ Incident Card Rejected";
              desc = `Your report was reviewed and marked as invalid: ${newRep.rejectionReason || "No explanation provided."}`;
            }

            triggerToastAlert(title, desc, "alert");
            
            setCitizenMessages(prev => [
              {
                id: `msg-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title,
                text: desc,
                read: false
              },
              ...prev
            ]);
          }
        }
      });
    }
    prevReportsRef.current = reports;
  }, [reports, username]);

  // Dynamic on-mount geolocation loader to center map exactly at user's current coordinates
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          setLatitude(lat);
          setLongitude(lng);
          console.log("Automatically identified current user location coordinate:", lat, lng);
          
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
              {
                headers: {
                  "Accept-Language": "en",
                  "User-Agent": "CivicLedgerDispatchApp/1.0 (sahilbidwai20@gmail.com)"
                }
              }
            );
            if (res.ok) {
              const contentType = res.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                const addressVal = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                
                // Keep the layout pristine by shortening the display name to 3 subsegments
                const parts = addressVal.split(",");
                if (parts.length > 3) {
                  setAddress(parts.slice(0, 3).join(",").trim());
                } else {
                  setAddress(addressVal);
                }
              }
            }
          } catch (err) {
            console.warn("Home coordinate reverse geocoding failed, using GPS label fallback:", err);
            setAddress(`GPS position: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        },
        (error) => {
          console.log("Interactive on-mount geolocation permission declined or pending:", error.message);
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  const fetchWards = async () => {
    try {
      const res = await fetch("/api/wards", {
        headers: { "x-username": username || "" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.wards) {
          setAvailableWards(data.wards);
          if (data.wards.length > 0) {
            setAuthWard(data.wards[0].name);
            setIsCustomWard(false);
          } else {
            setAuthWard("");
            setIsCustomWard(true);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load initial wards", e);
    }
  };

  useEffect(() => {
    fetchWards();
  }, [username]);

  // Citizen submission API proxy
  const handleReportSubmit = async (reportData: {
    photo: string;
    description: string;
    latitude: number;
    longitude: number;
    address: string;
    category?: string;
    ward?: string;
  }) => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-username": username || ""
        },
        body: JSON.stringify(reportData)
      });

      if (!res.ok) {
        throw new Error("Failed to submit civic report card.");
      }

      const output = await res.json();
      await fetchAllData(true);

      const wardName = reportData.ward || user?.ward || "Local Ward";
      const messageText = `📋 Live Ticket: Incident registered successfully in ${wardName}. Handled under automatic routing SLA protocol.`;
      triggerToastAlert("🚨 Civic Incident Registered", messageText, "success");
      setCitizenMessages(prev => [
        {
          id: `msg-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          title: "Incident Submission Received",
          text: messageText,
          read: false
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ecosystem reporting submission failed.");
    }
  };

  // Upvote community endorsement
  const handleUpvote = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${id}/upvote`, { 
        method: "POST",
        headers: { "x-username": username || "" }
      });
      if (!res.ok) throw new Error("Could not cast community verification upvote.");
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Add supplementary text evidence
  const handleAddEvidence = async (id: string, text: string) => {
    try {
      const res = await fetch(`/api/reports/${id}/evidence`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-username": username || ""
        },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error("Evidence compilation failed.");
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Mark resolved peer verification
  const handleResolveCommunity = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${id}/resolve-community`, { 
        method: "POST",
        headers: { "x-username": username || "" }
      });
      if (!res.ok) throw new Error("Marker completion endorsement failed.");
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Operations Authority state mutations
  const handleUpdateStatus = async (id: string, updatePayload: { status?: IssueStatus; crewName?: string; estimatedHours?: number }) => {
    try {
      const res = await fetch(`/api/reports/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload)
      });
      if (!res.ok) throw new Error("Authority dispatcher action failed.");
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDispatchTask = async (reportId: string, agencyUsername: string, workersCount?: number) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username || ""
        },
        body: JSON.stringify({ agencyUsername, workersCount })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Agency dispatch alert transmission failed.");
      }
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Unable to dispatch task.");
    }
  };

  const handleCompleteTask = async (reportId: string, resolvedPhoto: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username || ""
        },
        body: JSON.stringify({ resolvedPhoto })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Task resolution proof submission failed.");
      }
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to complete task.");
    }
  };

  const handleAcceptTask = async (reportId: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username || ""
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to accept task.");
      }
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to accept task.");
    }
  };

  const handleRejectTask = async (reportId: string, reason: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": username || ""
        },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to reject task.");
      }
      await fetchAllData(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to reject task.");
    }
  };

  // Dynamic Login Authentication handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) {
      setLoginError("Email/Username and password are required.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to activate citizen profile. Please check credentials.");
      }

      const data = await res.json();
      const confirmedUsername = data.userProfile.username;

      // OTP Verification flow for Citizen
      if (data.userProfile.role === "citizen") {
        const targetEmail = data.userProfile.email || authEmail.trim();
        const otpRes = await fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail })
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) {
          throw new Error(otpData.error || "Failed to dispatch OTP from backend.");
        }
        
        const generatedOtp = otpData.otp;
        setOtpSession({
          pending: true,
          code: generatedOtp,
          email: targetEmail,
          inputCode: "",
          callback: () => {
            localStorage.setItem("civic_username", confirmedUsername);
            localStorage.setItem("civic_user_role", "citizen");
            setUsername(confirmedUsername);
            setAuthEmail("");
            setAuthPassword("");
            triggerToastAlert("🔒 OTP Verified Successfully!", "Welcome back to Pune Civic Ledger.");
          }
        });
        triggerToastAlert("📬 Secure OTP Dispatched", `Your 2FA validation key is: ${generatedOtp}`, "success");
      } else {
        localStorage.setItem("civic_username", confirmedUsername);
        localStorage.setItem("civic_user_role", data.userProfile.role || loginTab);
        setUsername(confirmedUsername);
        setAuthEmail("");
        setAuthPassword("");
      }
    } catch (err: any) {
      setLoginError(err.message || "Credential sync failure.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Dynamic Register Authentication handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = authEmail.trim();
    const cleanUsername = authUsername.trim().replace(/\s+/g, "");
    const finalWardVal = loginTab === "authority" ? "Municipal Control HQ" : authWard;

    if (!cleanEmail || !cleanUsername || !authPassword || (!finalWardVal && loginTab !== "authority")) {
      setLoginError("All fields are required to register.");
      return;
    }
    if (cleanUsername.length < 3) {
      setLoginError("Handles must contain at least 3 characters.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUsername,
          password: authPassword,
          ward: finalWardVal,
          role: loginTab, // Sends the chosen role!
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed registers.");
      }

      const data = await res.json();
      const confirmedUsername = data.userProfile.username;

      // OTP Verification Simulation for Citizens
      if (loginTab === "citizen") {
        const otpRes = await fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail })
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) {
          throw new Error(otpData.error || "Failed to dispatch registry OTP from backend.");
        }
        const generatedOtp = otpData.otp;
        setOtpSession({
          pending: true,
          code: generatedOtp,
          email: cleanEmail,
          inputCode: "",
          callback: () => {
            localStorage.setItem("civic_username", confirmedUsername);
            localStorage.setItem("civic_user_role", "citizen");
            setUsername(confirmedUsername);
            setAuthEmail("");
            setAuthUsername("");
            setAuthPassword("");
            triggerToastAlert("🎉 Registry Complete!", "Pune Civic Ledger profile is active & verified.");
          }
        });
        triggerToastAlert("📬 Secure OTP Dispatched", `Your Secure Registration OTP is: ${generatedOtp}`, "success");
      } else {
        localStorage.setItem("civic_username", confirmedUsername);
        localStorage.setItem("civic_user_role", loginTab);
        setUsername(confirmedUsername);
        setAuthEmail("");
        setAuthUsername("");
        setAuthPassword("");
      }
    } catch (err: any) {
      setLoginError(err.message || "Registration failure.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout dynamic session
  const handleLogout = () => {
    localStorage.removeItem("civic_username");
    localStorage.removeItem("authority_unlocked");
    localStorage.removeItem("civic_user_role");
    setIsAuthorityUnlocked(false);
    setActiveWorkspace("citizen");
    setUsername(null);
    setUser(null);
  };

  // Authority passcode validation at login
  const handleAuthorityUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim() === "admin123") {
      localStorage.setItem("authority_unlocked", "true");
      setIsAuthorityUnlocked(true);
      setActiveWorkspace("authority");
      localStorage.setItem("civic_username", "Authority Admin");
      localStorage.setItem("civic_user_role", "authority");
      setUsername("Authority Admin");
      setPasscodeInput("");
      setPasscodeError("");
    } else {
      setPasscodeError("Invalid password. Command center remains secure.");
    }
  };

  // Lock authority dashboard and return to login screen
  const handleLockAuthority = () => {
    localStorage.removeItem("authority_unlocked");
    localStorage.removeItem("civic_username");
    localStorage.removeItem("civic_user_role");
    setIsAuthorityUnlocked(false);
    setActiveWorkspace("citizen");
    setUsername(null);
    setUser(null);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 animate-fade-in" id="main-applet-root">
      {/* Dynamic Sound-enabled Push Notification Message Alert Toast */}
      {toastAlert && toastAlert.visible && (
        <div className="fixed top-4 right-4 z-[99999] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 max-w-sm w-full animate-bounce-in flex gap-3.5 items-start">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5 animate-pulse">
            <Siren size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <h4 className="text-xs font-bold font-sans tracking-tight text-slate-100">{toastAlert.title}</h4>
              <button
                onClick={() => setToastAlert(prev => prev ? { ...prev, visible: false } : null)}
                className="text-slate-400 hover:text-white text-xs font-bold leading-none p-1 hover:bg-white/10 rounded-full transition"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal font-semibold font-mono">{toastAlert.message}</p>
          </div>
        </div>
      )}

      {/* Dynamic Security OTP Verification Modal Overlay */}
      {otpSession && otpSession.pending && (
        <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-stone-150 shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck size={24} className="animate-pulse text-indigo-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-stone-900 font-sans">Two-Factor Security Verification</h3>
              <p className="text-xs text-stone-400 font-semibold leading-relaxed">
                We have generated a secure verification OTP for <span className="text-stone-700 font-bold">{otpSession.email}</span>. Verify identity to complete sign-in.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpSession.inputCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setOtpSession(prev => prev ? { ...prev, inputCode: val } : null);
                  }}
                  placeholder="Enter 6-digit OTP"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-indigo-400 outline-none transition"
                />
              </div>
              
              {otpError && (
                <p className="text-[10px] text-rose-600 font-bold animate-pulse">⚠️ {otpError}</p>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOtpSession(null);
                  setOtpError("");
                  setIsLoggingIn(false);
                }}
                className="flex-1 py-2.5 text-xs text-stone-500 font-bold hover:bg-stone-50 border border-stone-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!otpSession) return;
                  if (!otpSession.inputCode) {
                    setOtpError("Please input the 6-digit verification code.");
                    return;
                  }
                  try {
                    const verifyRes = await fetch("/api/verify-otp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: otpSession.email,
                        code: otpSession.inputCode
                      })
                    });
                    const verifyData = await verifyRes.json();
                    if (verifyRes.ok && verifyData.verified) {
                      setOtpError("");
                      const cb = otpSession.callback;
                      setOtpSession(null);
                      if (cb) cb();
                    } else {
                      setOtpError(verifyData.error || "Invalid OTP validation code.");
                    }
                  } catch (err: any) {
                    setOtpError(err.message || "Failed to verify OTP.");
                  }
                }}
                className="flex-1 py-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Verify OTP
              </button>
            </div>

            {/* Simulated Mobile SMS Notification alert directly on verification screen */}
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-left space-y-1">
              <span className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider block font-mono">📲 SIMULATED SMS RECEIVER:</span>
              <p className="text-[11px] text-amber-900 leading-normal font-medium">
                <strong>SMS ALERT:</strong> Your secure validation code is <span className="bg-white/80 px-1.5 py-0.5 rounded text-amber-900 border border-amber-200 font-mono font-extrabold text-xs select-all">{otpSession.code}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global Header Bar */}
      <header className="bg-white border-b border-slate-100 py-4 px-6 sticky top-0 z-40 shadow-xs animate-slide-down" id="navigation-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 rounded-xl text-white">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight font-sans">
                CivicX
              </h1>
              <p className="text-xs text-slate-500">
                Civic Issue Reporting & Triage Platform
              </p>
            </div>
          </div>

          {/* Quick Stats Toolbar / Refresh actions */}
          {username && (
            <div className="flex flex-wrap items-center gap-3">
              {activeWorkspace === "citizen" ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-150 rounded-xl text-xs font-black text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  <span>👤 Citizen Hub Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-150 rounded-xl text-xs font-black text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>🏛️ Authority Command Active</span>
                </div>
              )}

              {/* Secure Authority re-lock option */}
              {isAuthorityUnlocked && activeWorkspace === "authority" && (
                <button
                  type="button"
                  onClick={handleLockAuthority}
                  className="py-1.5 px-2.5 bg-rose-50 border border-rose-150 text-rose-700 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition cursor-pointer"
                  title="Lock administrative authority dashboard"
                >
                  🔒 Lock & Exit Command
                </button>
              )}

              {/* Manual reloading pull */}
              <button
                type="button"
                onClick={() => { setRefreshing(true); fetchAllData(); }}
                disabled={refreshing}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 bg-white rounded-xl transition-all cursor-pointer"
                title="Manual refresh database records"
                id="btn-manual-sync"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>

              {/* Dynamic user profile pill and exit button */}
              {user && (
                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-800 block">👤 {user.username}</span>
                    <span className="text-[9px] text-indigo-600 block font-mono">{getLevelName(user.level)} (Lv. {user.level}) • {user.xp} XP</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-1 px-2 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-lg text-[9px] font-bold transition-all hover:bg-rose-50 cursor-pointer"
                    title="Log out of active session profile"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6" id="workspace-main">
        {!username ? (
          /* Multi-user Activation Screen */
          <div className="max-w-4xl mx-auto my-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch" id="login-deck-frame">
            {/* Left promo banner */}
            <div className="md:col-span-5 bg-gradient-to-br from-indigo-700 to-indigo-950 rounded-3xl p-8 text-white flex flex-col justify-between space-y-8 relative overflow-hidden" id="login-hero-card">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
              <div className="space-y-4 relative z-10">
                <span className="p-2.5 bg-indigo-600/50 backdrop-blur-md rounded-2xl text-white inline-block border border-indigo-400/20">
                  <ShieldAlert size={24} />
                </span>
                <h2 className="text-xl font-extrabold tracking-tight leading-tight">CivicX</h2>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Welcome to our municipal citizen reporting system. Register a custom handle to log local service alerts, endorse peer concerns for bonus XP, and inspect live workforce dispatch crew logs.
                </p>
              </div>

              <div className="space-y-3 relative z-10 border-t border-indigo-400/20 pt-6">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-indigo-200">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  <span>Sub-district Core Active</span>
                </div>
              </div>
            </div>

            {/* Right form card */}
            <div className="md:col-span-7 bg-white border border-slate-100 rounded-3xl p-8 flex flex-col justify-start space-y-6 shadow-xs animate-fade-in" id="login-form-card">
              {/* Role Selector Tabs - Citizens, Authority, Workers */}
              <div className="flex flex-wrap border border-slate-200 rounded-2xl p-1 bg-slate-100 text-xs font-semibold gap-1" id="view-mode-tabs-login">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("citizen");
                    setLoginError("");
                  }}
                  className={`flex-1 min-w-[100px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer font-extrabold ${
                    loginTab === "citizen"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-550 hover:text-slate-800"
                  }`}
                >
                  👤 Citizen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("authority");
                    setLoginError("");
                  }}
                  className={`flex-1 min-w-[100px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer font-extrabold ${
                    loginTab === "authority"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-555 hover:text-slate-800"
                  }`}
                >
                  🏛️ Authority
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("agency");
                    setLoginError("");
                  }}
                  className={`flex-1 min-w-[100px] py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer font-extrabold ${
                    loginTab === "agency"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-555 hover:text-slate-800"
                  }`}
                >
                  🛠️ Work Force
                </button>
              </div>

              <div className="space-y-5 flex-1 flex flex-col justify-between">
                {/* Dynamic sub-tab picker for Login or Register */}
                <div className="flex border-b border-slate-100 pb-2 gap-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setCitizenAuthMode("login");
                      setLoginError("");
                    }}
                    className={`pb-1 px-1 transition-all border-b-2 cursor-pointer ${
                      citizenAuthMode === "login"
                        ? "border-indigo-600 text-indigo-700 font-extrabold"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    🔑 Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCitizenAuthMode("register");
                      setLoginError("");
                    }}
                    className={`pb-1 px-1 transition-all border-b-2 cursor-pointer ${
                      citizenAuthMode === "register"
                        ? "border-indigo-600 text-indigo-700 font-extrabold"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    📝 Create Account
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-md font-bold text-slate-800">
                    {loginTab === "citizen" 
                      ? (citizenAuthMode === "login" ? "Welcome Back, Citizen" : "Secure Citizen Registry")
                      : loginTab === "authority"
                      ? (citizenAuthMode === "login" ? "Authority Command Station" : "Register Authority Account")
                      : (citizenAuthMode === "login" ? "Workforce Operations Access" : "Register Work Force Crew")
                    }
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    {citizenAuthMode === "login" 
                      ? "Enter credentials to synchronize status boards, active triage maps and live leaderboards."
                      : "Establish municipal keys with specified jurisdiction Ward corridors below to authorize actions."
                    }
                  </p>
                </div>



                {/* Secure Authentication Inputs Form */}
                <form 
                  onSubmit={citizenAuthMode === "login" ? handleLoginSubmit : handleRegisterSubmit} 
                  className="space-y-3 animate-fade-in" 
                  id="credentials-form"
                >
                  <div className="space-y-2.5">
                    {/* Ward selector (Always for Register, allows matching area maps) */}
                    {citizenAuthMode === "register" && loginTab !== "authority" && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                          District Ward Corridor Boundary Assigned
                        </label>
                        <div className="space-y-2">
                          <select
                            value={authWard}
                            onChange={(e) => setAuthWard(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/40 font-semibold text-slate-800"
                            required
                          >
                            <option value="">Select a Ward</option>
                            {availableWards.map((w: any) => (
                              <option key={w.name} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Email/Username input */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        Email Address {citizenAuthMode === "login" && "or Username"}
                      </label>
                      <input
                        type="text"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder={citizenAuthMode === "login" ? "e.g. civicknight99@civic.org" : "e.g. operational@muni.gov"}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/40 font-semibold text-slate-800"
                        required
                      />
                    </div>

                    {/* Username handle name Input */}
                    {citizenAuthMode === "register" && (
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                          Handle/Account Username Name
                        </label>
                        <input
                          type="text"
                          value={authUsername}
                          onChange={(e) => setAuthUsername(e.target.value.replace(/\s+/g, ""))}
                          placeholder="e.g. MayorWest"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/40 font-semibold text-slate-800"
                          required
                        />
                      </div>
                    )}

                    {/* Password Input */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        Password Credentials
                      </label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition bg-slate-50/40 font-mono text-slate-800"
                        required
                      />
                    </div>


                  </div>

                  {loginError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1.5 animate-pulse">⚠️ {loginError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 bg-slate-900 border border-slate-900 hover:bg-indigo-650 hover:border-indigo-650 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-4"
                  >
                    {isLoggingIn ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                        <span>Verifying Security Ledger Identity Keys...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {citizenAuthMode === "login" 
                            ? "Authorize Active Session" 
                            : `Register as ${loginTab === "citizen" ? "Citizen" : loginTab === "authority" ? "Authority" : "Worker Agency"}`
                          }
                        </span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl max-w-lg mx-auto text-center space-y-3 my-20" id="error-fallback">
            <Siren size={32} className="mx-auto text-rose-500 animate-bounce" />
            <h3 className="text-sm font-bold">Inbound Network Incident</h3>
            <p className="text-xs leading-normal">{errorMsg}</p>
            <button
              type="button"
              onClick={() => fetchAllData()}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition"
            >
              Re-establish Connection
            </button>
          </div>
        ) : (loading || !user) ? (
          <div className="flex flex-col items-center justify-center my-32 space-y-3" id="main-spinner">
            <span className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-400 animate-pulse font-mono">
              Connecting as {
                user?.role === "authority" ? "municipal authority" : 
                user?.role === "agency" ? "workforce agency" : 
                user?.role === "citizen" ? "citizen" : 
                localStorage.getItem("civic_user_role") === "authority" ? "municipal authority" :
                localStorage.getItem("civic_user_role") === "agency" ? "workforce agency" :
                localStorage.getItem("civic_user_role") === "citizen" ? "citizen" :
                loginTab === "authority" ? "municipal authority" :
                loginTab === "agency" ? "workforce agency" :
                "citizen"
              } {username}...
            </p>
          </div>
        ) : (
          <div className="space-y-6" id="loaded-content-portal">
            {/* User Jurisdiction Overview */}
            {activeWorkspace === "citizen" && availableWards.length > 0 && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">My Assigned Jurisdiction</h3>
                    <p className="text-sm font-semibold text-indigo-700">{user?.ward || "Not assigned"}</p>
                  </div>
                  <div className="text-right">
                     <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Jurisdictions</h3>
                     <p className="text-[10px] text-slate-600 font-medium">{availableWards.length} Zones Active</p>
                  </div>
                </div>
                {announcement && (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 text-xs font-medium">
                    <strong>📢 Announcement:</strong> {announcement}
                  </div>
                )}
              </div>
            )}

            {/* Top Level Summary Statistics */}
            {stats && (
              <StatCards
                stats={
                  activeWorkspace === "citizen" && user
                    ? {
                        totalSubmitted: reports.filter((r) => r.assignedWard === user.ward).length,
                        totalResolved: reports.filter((r) => r.assignedWard === user.ward && r.status === "resolved").length,
                        credibilityThresholdMet: reports.filter((r) => r.assignedWard === user.ward && r.credibilityScore >= 50).length,
                        averageSlaResolutionTimeHrs: stats.averageSlaResolutionTimeHrs,
                        activeWorkCrews: stats.activeWorkCrews,
                        totalXPPremiumGranted: stats.totalXPPremiumGranted,
                      }
                    : stats
                }
                topCitizen={
                  activeWorkspace === "citizen" && user
                    ? leaderboard.filter((u) => u.ward === user.ward && u.role === "citizen")[0]
                    : leaderboard.find((u) => u.role === "citizen")
                }
              />
            )}
            {activeWorkspace === "authority" && (
              <AnnouncementManager user={user!} />
            )}

            {/* Split layout: Interactive panels */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="split-deck">
              {/* Left Column: Flow submission tools */}
              <div className="col-span-1 lg:col-span-5 space-y-6">
                {/* Citizen View: Report form if chosen */}
                <AnimatePresence mode="wait">
                  {activeWorkspace === "citizen" ? (
                    <motion.div
                      key="citizen-left"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                      id="citizen-left-col"
                    >
                      <ReportForm
                        onSubmit={handleReportSubmit}
                        user={user!}
                        wards={availableWards}
                        latitude={latitude}
                        setLatitude={setLatitude}
                        longitude={longitude}
                        setLongitude={setLongitude}
                        address={address}
                        setAddress={setAddress}
                      />
                      <ImpactPanel
                        user={user!}
                        leaderboard={leaderboard}
                        hotspots={hotspots}
                        auditTrail={auditTrail}
                        activeWorkspace={activeWorkspace}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="non-citizen-left"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                      id="non-citizen-left-col"
                    >
                      <ImpactPanel
                        user={user!}
                        leaderboard={leaderboard}
                        hotspots={hotspots}
                        auditTrail={auditTrail}
                        activeWorkspace={activeWorkspace}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Column: Interactive GIS Map & Reporting feed/Verification logs */}
              <div className="col-span-1 lg:col-span-7 space-y-6" id="feed-column">
                {/* Live GIS Map is a key persistent anchor of our full view */}
                <CityMap
                  reports={reports}
                  leaderboard={leaderboard}
                  selectedReportId={selectedReportId}
                  onSelectReport={setSelectedReportId}
                  onMapClickCoord={(lat, lng, addr) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setAddress(addr);
                  }}
                  isAuthority={activeWorkspace === "authority"}
                  user={user}
                  onWardCreated={() => { fetchAllData(true); fetchWards(); }}
                  latitude={latitude}
                  longitude={longitude}
                  hotspots={hotspots}
                />

                <AnimatePresence mode="wait">
                  {activeWorkspace === "citizen" ? (
                    <motion.div
                      key="feed-right"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                      id="citizen-right-col"
                    >
                      {/* Dynamic Tab Switcher for Citizens */}
                      <div className="flex border-b border-slate-150 pb-2 mb-3 gap-6 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setCitizenTab("feed")}
                          className={`pb-1 transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                            citizenTab === "feed"
                              ? "border-indigo-600 text-indigo-700 font-extrabold"
                              : "border-transparent text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          📢 Community Validation Feed
                        </button>
                        <button
                          type="button"
                          onClick={() => setCitizenTab("profile")}
                          className={`pb-1 transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                            citizenTab === "profile"
                              ? "border-indigo-600 text-indigo-700 font-extrabold"
                              : "border-transparent text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          👤 My Profile Card
                        </button>
                        <button
                          type="button"
                          onClick={() => setCitizenTab("messages")}
                          className={`pb-1 transition-all border-b-2 cursor-pointer flex items-center gap-1.5 relative ${
                            citizenTab === "messages"
                              ? "border-indigo-600 text-indigo-700 font-extrabold"
                              : "border-transparent text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          📩 Secure Message Inbox
                          {citizenMessages.some(m => !m.read) && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-2" />
                          )}
                        </button>
                      </div>

                      {citizenTab === "feed" ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 size={16} className="text-indigo-600" />
                            <div>
                              <h2 className="text-sm font-bold text-slate-850">Community Validation Feed</h2>
                              <p className="text-[10px] text-slate-400">Review nearby alerts, endorse reports, and add critical updates</p>
                            </div>
                          </div>
                          <CommunityFeed
                            reports={activeWorkspace === "citizen" ? reports.filter(r => r.assignedWard === user?.ward) : reports}
                            selectedReportId={selectedReportId}
                            onUpvote={handleUpvote}
                            onAddEvidence={handleAddEvidence}
                            onResolveCommunity={handleResolveCommunity}
                            currentUsername={username || "CitizenResident"}
                          />
                        </>
                      ) : citizenTab === "profile" ? (
                        <CitizenProfile
                          user={user!}
                          wards={availableWards}
                          onProfileUpdated={(updatedUser) => {
                            setUser(updatedUser);
                            setLeaderboard(prev => prev.map(u => u.username.toLowerCase() === updatedUser.username.toLowerCase() ? updatedUser : u));
                          }}
                          triggerToastAlert={triggerToastAlert}
                        />
                      ) : (
                        <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                            <div>
                              <h2 className="text-sm font-bold text-slate-800">📩 Personal Message Alerts</h2>
                              <p className="text-[10px] text-slate-400">Encrypted notification broadcasts & system SMS validations</p>
                            </div>
                            <button
                              onClick={() => {
                                setCitizenMessages(prev => prev.map(m => ({ ...m, read: true })));
                              }}
                              className="text-[10px] text-indigo-600 hover:underline font-bold"
                            >
                              Mark all read
                            </button>
                          </div>

                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                            {citizenMessages.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-6">Your personal security inbox is clean and empty.</p>
                            ) : (
                              citizenMessages.map((msg) => (
                                <div 
                                  key={msg.id} 
                                  onClick={() => {
                                    setCitizenMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
                                  }}
                                  className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                                    msg.read 
                                      ? "bg-stone-50/55 border-stone-150 text-stone-750" 
                                      : "bg-indigo-50/30 border-indigo-100 text-indigo-950 font-semibold shadow-[0_0_8px_rgba(99,102,241,0.04)]"
                                  }`}
                                >
                                  {!msg.read && (
                                    <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                                  )}
                                  <div className="flex justify-between items-center mb-1">
                                    <h4 className="text-xs font-extrabold flex items-center gap-1">
                                      {msg.title}
                                    </h4>
                                    <span className="text-[9px] font-mono text-stone-400 font-medium">{msg.timestamp}</span>
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-stone-600 font-mono">{msg.text}</p>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Ward-specific bulletin details */}
                          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100 mt-4 space-y-1">
                            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide block font-mono">📢 WARD BULLETIN BROADCASTS:</span>
                            <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                              {announcement || "No bulletins currently broadcast in your region corridor. Stay safe!"}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : activeWorkspace === "authority" ? (
                    <motion.div
                      key="auth-right"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                      id="authority-right-col"
                    >
                      <AuthorityDashboard
                        reports={reports}
                        user={user!}
                        leaderboard={leaderboard}
                        onDispatch={handleDispatchTask}
                        wards={availableWards}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="agency-right"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-4"
                      id="agency-right-col"
                    >
                      <AgencyDashboard
                        reports={reports}
                        user={user!}
                        onCompleteTask={handleCompleteTask}
                        onAcceptTask={handleAcceptTask}
                        onRejectTask={handleRejectTask}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Flowchart Schematic Footer Diagram - matching the user's provided attachment for cognitive synergy */}
            <footer className="mt-12 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4 text-xs text-slate-500 leading-normal" id="global-footer">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 rounded bg-indigo-50 border border-indigo-100 font-extrabold text-indigo-700 font-sans tracking-wide">FLOW CHART SYNERGY</span>
                  <span className="text-slate-800 font-extrabold text-xs">Platform Operational Lifespans Pipeline</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest bg-slate-50 p-1 px-1.5 rounded">Process Map Sync Loop</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2" id="footer-schematic">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[9px] font-bold text-indigo-600 font-mono block">1. REPORT phase</span>
                  <p className="text-[10.5px] font-semibold text-slate-800 font-sans">Citizen Submission</p>
                  <p className="text-[9.5px] text-slate-400">Capture visual photo drops, GPS coords tags, and descriptive reviews.</p>
                </div>
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 space-y-1">
                  <span className="text-[9px] font-bold text-orange-600 font-mono block">2. AI TRIAGE phase</span>
                  <p className="text-[10.5px] font-semibold text-slate-800 font-sans">Gemini Auto-Classification</p>
                  <p className="text-[9.5px] text-slate-400">Vision mapping, threat routing, and local deduplication matches.</p>
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-150 space-y-1">
                  <span className="text-[9px] font-bold text-emerald-600 font-mono block">3. VALIDATE phase</span>
                  <p className="text-[10.5px] font-semibold text-slate-800 font-sans">Community Verification</p>
                  <p className="text-[9.5px] text-slate-400">Upvotes, supplemental evidence appending, and peer verification triggers.</p>
                </div>
                <div className="bg-rose-50/30 p-3 rounded-xl border border-rose-100 space-y-1">
                  <span className="text-[9px] font-bold text-rose-600 font-mono block">4. RESOLVE phase</span>
                  <p className="text-[10.5px] font-semibold text-slate-800 font-sans">Authority Workflows</p>
                  <p className="text-[9.5px] text-slate-400">SLA timer tracking, field crew dispatch logs, and senior escalations.</p>
                </div>
                <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100 space-y-1">
                  <span className="text-[9px] font-bold text-indigo-600 font-mono block">5. IMPACT phase</span>
                  <p className="text-[10.5px] font-semibold text-slate-800 font-sans">Ecosystem Feedback</p>
                  <p className="text-[9.5px] text-slate-400">Gamification levels, machine predictability, audit ledger trails.</p>
                </div>
              </div>
            </footer>
          </div>
        )}
      </main>

      {/* Floating AI Chatbot Widget */}
      {activeWorkspace === "citizen" && user && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" id="floating-chatbot-container">
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-[360px] sm:w-[420px] shadow-2xl rounded-2xl overflow-hidden border border-slate-150 bg-white"
              >
                <CivicChatBot
                  user={user}
                  latitude={latitude}
                  longitude={longitude}
                  address={address}
                  onReportSubmitted={() => {
                    fetchAllData(true);
                  }}
                  onClose={() => setIsChatOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 border border-indigo-500/30"
            id="floating-chatbot-toggle"
            title="Talk to Ward AI Assistant"
          >
            {isChatOpen ? (
              <span className="text-xl font-bold font-sans w-6 h-6 flex items-center justify-center">×</span>
            ) : (
              <Bot size={24} className="animate-pulse" />
            )}
          </button>
        </div>
      )}

    </div>
  );
}
