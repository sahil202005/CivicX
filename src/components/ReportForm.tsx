import React, { useState, useRef } from "react";
import { Camera, MapPin, Upload, Sparkles, Check, Info, Mic, MicOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";

interface ReportFormProps {
  onSubmit: (reportData: {
    photo: string;
    description: string;
    latitude: number;
    longitude: number;
    address: string;
    category?: string;
    ward?: string;
  }) => Promise<void>;
  user: UserProfile;
  wards: any[];
  latitude: number;
  setLatitude: (lat: number) => void;
  longitude: number;
  setLongitude: (lng: number) => void;
  address: string;
  setAddress: (addr: string) => void;
}

export default function ReportForm({
  onSubmit,
  user,
  wards,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  address,
  setAddress
}: ReportFormProps) {
  const [description, setDescription] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [selectedWard, setSelectedWard] = useState<string>(user.ward || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  // Microphone voice report simulation state
  const [isListening, setIsListening] = useState(false);
  const [voiceTimer, setVoiceTimer] = useState<any>(null);

  // Status logs shown during the AI Triage phase to make the pipeline cognitive
  const [triageSteps, setTriageSteps] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop uploader handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedPhoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Simulated Voice to Text Translation trigger
  const handleVoiceDescriptionInput = () => {
    if (isListening) {
      if (voiceTimer) clearTimeout(voiceTimer);
      setIsListening(false);
      return;
    }

    setIsListening(true);
    setDescription("Listening to speech input... [Vocal Decibels Detected]");

    // Preset transcript maps
    const presetsTranscripts: { [key: string]: string } = {
      "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop":
        "Urgent potholes warning! Asphalt is starting to split in 3 different spots here. It looks really deep and cars are swerving wildly near the intersection.",
      "https://images.unsplash.com/photo-1542013936693-8848e574047e?q=80&w=600&auto=format&fit=crop":
        "Active water main blowout. Gushing gallons of high pressure water that is fast flooding the lower sidewalk ramp. We need emergency shutdown crews.",
      "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?q=80&w=600&auto=format&fit=crop":
        "The light pole in this alley corner is completely dead. It's fully dark at tonight and feels very sketchy, please send Dept. of Transportation electricians.",
      "https://images.unsplash.com/photo-1525909002-1b0570d860d4?q=80&w=600&auto=format&fit=crop":
        "Graffiti taggers marked the public recreational park walls. Big spray-painted colors covering about 6 feet, looks like some toxic oil paint defacement."
    };

    const spokenResult = presetsTranscripts[selectedPhoto] || "Critical civic concern: Massive garbage dumping piling up and blocking the main crosswalk path. Needs immediate cleanup.";

    const timer = setTimeout(() => {
      setDescription(spokenResult);
      setIsListening(false);
    }, 2800);

    setVoiceTimer(timer);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    setTriageSteps([]);

    // Simulate multi-tier AI Triage pipeline reporting to explain flowchart visually to users
    const runAIStageLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setTriageSteps((prev) => [...prev, msg]);
          resolve();
        }, delay);
      });
    };

    await runAIStageLog("🤖 Initiating AI Triage Vision Engine...", 300);
    await runAIStageLog("👁️ Reading image structures & textures...", 600);
    await runAIStageLog("🗺️ Cross-checking with existing active reports in local database...", 800);
    await runAIStageLog("⚡ Classifying severity & resolving optimal department routing...", 800);

    try {
      await onSubmit({
        photo: selectedPhoto,
        description,
        latitude,
        longitude,
        address,
        category: category || undefined,
        ward: selectedWard
      });

      // Reset
      setDescription("");
      setSelectedPhoto("");
      setCategory("");
      setSubmissionFeedback("+150 XP! Incident submitted and triaged successfully by Gemini.");
      setTimeout(() => setSubmissionFeedback(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setTriageSteps([]);
    }
  };

  return (
    <div id="report-form-card" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
          <Camera size={18} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight">Citizen Report Filing</h2>
          <p className="text-xs text-slate-400">File city issues for real-time AI classification & triage</p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Step 1: Upload or Choose image */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            1. Report Image Component (Upload or Pick Simulation Presets)
          </label>

          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              dragActive ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200 hover:border-slate-300"
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {selectedPhoto ? (
              <div className="relative h-32 w-full rounded-lg overflow-hidden flex items-center justify-center bg-slate-50">
                <img
                  src={selectedPhoto}
                  alt="Incident Preview"
                  className="h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white rounded-md p-1 px-2 text-[10px] flex items-center gap-1 font-mono">
                  <Check size={10} className="text-emerald-400" /> Geotagged
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2">
                <Upload size={24} className="text-slate-400 mb-1" />
                <span className="text-xs text-slate-600 font-medium">Drag & drop photo or click to browse</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Supports PNG, JPG (sent to Gemini Vision)</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Issue Category Selector */}
        <div>
          <label htmlFor="report-category" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            2. Report Category (Set Or Change Context Independently)
          </label>
          <div className="relative">
            <select
              id="report-category"
              value={category}
              onChange={(e) => {
                const val = e.target.value;
                setCategory(val);
                
                if (val) {
                  const mapping: { [key: string]: { desc: string; url: string } } = {
                    "Pothole": {
                      desc: "Deep pothole in middle of high-traffic lane.",
                      url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop"
                    },
                    "Water Leak": {
                      desc: "Burst main hydrant or curb valve flooding road.",
                      url: "https://images.unsplash.com/photo-1542013936693-8848e574047e?q=80&w=600&auto=format&fit=crop"
                    },
                    "Street Light": {
                      desc: "Completely dark public street pole walkway.",
                      url: "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?q=80&w=600&auto=format&fit=crop"
                    },
                    "Graffiti": {
                      desc: "Fresh paint defacement on historic cement boundary.",
                      url: "https://images.unsplash.com/photo-1525909002-1b0570d860d4?q=80&w=600&auto=format&fit=crop"
                    },
                    "Trash/Debris": {
                      desc: "Large bulk roadside garbage dumping and debris blocking the path.",
                      url: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?q=80&w=600&auto=format&fit=crop"
                    },
                    "Other": {
                      desc: "General municipal hazard requiring investigation and inspection.",
                      url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=600&auto=format&fit=crop"
                    }
                  };
                  
                  const target = mapping[val];
                  if (target) {
                    setDescription(target.desc);
                    if (!selectedPhoto || (!selectedPhoto.startsWith("data:image/") && !selectedPhoto.startsWith("dataImage"))) {
                      setSelectedPhoto(target.url);
                    }
                  }
                } else {
                  setDescription("");
                  setSelectedPhoto("");
                }
              }}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50/50 font-semibold text-slate-700 focus:border-indigo-400 focus:bg-white transition-all appearance-none"
            >
              <option value="">🔮 Let Gemini Auto-Classify (Based on Description)</option>
              <option value="Pothole">🧱 Pothole / Street Damage</option>
              <option value="Water Leak">💧 Water Leak / Pipe Burst</option>
              <option value="Street Light">💡 Street Light Bulbs / Dark Corner</option>
              <option value="Graffiti">🎨 Graffiti Defacement</option>
              <option value="Trash/Debris">🗑️ Trash / Bulk Roadside Dumping</option>
              <option value="Other">❓ Other Municipal Concern</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <span className="text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* New Step: Registered Zone Selector */}
        <div>
          <label htmlFor="report-zone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            2.1 Registered Zone (Select Jurisdiction)
          </label>
          <div className="relative">
            <select
              id="report-zone"
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none bg-slate-50/50 font-semibold text-slate-700 focus:border-indigo-400 focus:bg-white transition-all appearance-none"
            >
              {wards.map((w: any) => (
                <option key={w.name} value={w.name}>
                  {w.name} {w.authorityUsername ? `(Authority: ${w.authorityUsername})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
              <span className="text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Step 3: Interactive Coordinates Tagging map */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              3. GPS Location Coordinate Mapping
            </label>
            <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-full border border-indigo-100/40">
              <MapPin size={10} />
              <span className="font-semibold">{latitude.toFixed(6)}°, {longitude.toFixed(6)}°</span>
            </div>
          </div>

          {/* Location details card instructing client to use the primary Leaflet map */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-indigo-100/60 rounded-lg text-indigo-600 shrink-0 mt-0.5 animate-pulse">
                <MapPin size={16} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wide block">Focal Address Context (Zone: {user.ward})</span>
                <span className="text-xs text-slate-700 font-medium leading-relaxed block">{address || "Acquiring street address location..."}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-55 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                GPS Coordinates Lock
              </span>
              <span className="text-[10px] text-slate-450 italic text-slate-400">
                Click map on right to relocate pin
              </span>
            </div>
          </div>
        </div>

        {/* Step 3: Issue Description Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="issue-description" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              3. Issue Details or Voice Input Context
            </label>
            <button
              type="button"
              onClick={handleVoiceDescriptionInput}
              className={`p-1.5 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                isListening
                  ? "bg-rose-100 border border-rose-350 text-rose-700 font-bold"
                  : "bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100"
              }`}
              title="Speak report (Voice-to-text NLP simulation)"
            >
              {isListening ? (
                <>
                  <MicOff size={12} className="text-rose-600 animate-pulse" />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <Mic size={12} className="text-indigo-600" />
                  <span>🎙️ Speak Report</span>
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <textarea
              id="issue-description"
              rows={3}
              placeholder="Provide details of the hazard (e.g. 'Massive asphalt pocket splitting on Union lane...')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 pr-10 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 transition-colors bg-slate-50/50 resize-hidden"
              required
            />

            {/* Vocal simulation waves graphic */}
            <AnimatePresence>
              {isListening && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-100 rounded-full"
                >
                  <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                  <span className="w-1 h-2 bg-rose-505 rounded-full animate-bounce [animation-delay:0.5s]" />
                  <span className="text-[9px] font-mono font-semibold text-rose-600">LIVE COGNITIVE SYNC</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Submitting animation drawer representing the triage system */}
        <AnimatePresence>
          {isSubmitting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-indigo-900/5 border border-indigo-100 rounded-xl overflow-hidden"
            >
              <div className="p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 justify-center">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-indigo-700">Triage Pipeline Running</span>
                </div>
                <div className="font-mono text-[10px] text-indigo-900 space-y-1 bg-white/50 p-2.5 rounded-lg border border-indigo-150 max-h-[140px] overflow-y-auto">
                  {triageSteps.map((step, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={idx}
                      className="flex items-center gap-1"
                    >
                      <span className="text-indigo-400 select-none">&gt;</span> {step}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit action */}
        <button
          type="submit"
          id="btn-report-submit"
          disabled={isSubmitting || !description.trim()}
          className={`w-full py-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-all outline-hidden cursor-pointer ${
            isSubmitting || !description.trim()
              ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          }`}
        >
          <Sparkles size={14} />
          {isSubmitting ? "Running AI Triage..." : "Submit to Triage Pipeline"}
        </button>

        {/* Success message popup */}
        {submissionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 font-medium text-center flex items-center justify-center gap-1.5"
          >
            <Check size={14} className="text-emerald-500 shrink-0" />
            <span>{submissionFeedback}</span>
          </motion.div>
        )}
      </form>
    </div>
  );
}
