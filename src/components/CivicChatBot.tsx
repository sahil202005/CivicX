import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Check, AlertCircle, RefreshCw, HelpCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  isComplaint?: boolean;
  detectedCategory?: string;
  detectedDescription?: string;
  ticketSubmitted?: boolean;
  ticketId?: string;
}

interface CivicChatBotProps {
  user?: UserProfile | null;
  latitude: number;
  longitude: number;
  address: string;
  onReportSubmitted: () => void;
  onClose?: () => void;
}

const QUICK_QUESTIONS = [
  { label: "📍 What is my assigned ward?", text: "What is my assigned ward and how is it used?" },
  { label: "📋 How do I file an incident?", text: "How do I report a pothole or other civic problems?" },
  { label: "⚡ Explain SLA fix times", text: "What are the SLA response times for fixing issues?" },
  { label: "⭐ How do XP & Levels work?", text: "How does the XP and leveling system work?" }
];

export default function CivicChatBot({
  user,
  latitude,
  longitude,
  address,
  onReportSubmitted,
  onClose
}: CivicChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: `Hello ${user?.username || "Guest"}! I am your Civic AI Assistant. I can help answer questions about our smart city rules, XP system, or SLAs. \n\nYou can also describe any local problem (e.g., "the street light on Main Street is broken" or "there's a trash pile near the park"), and I will help you submit an official ticket directly to your registered ward: **${user?.ward || "Ward I - Central Corridor"}**.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submittingTicketId, setSubmittingTicketId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          ward: user?.ward || "Ward I - Central Corridor",
          username: user?.username || "Guest"
        })
      });

      if (!res.ok) {
        throw new Error("Chat assistant was unable to process query.");
      }

      const data = await res.json();
      
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isComplaint: data.isComplaint,
        detectedCategory: data.detectedCategory,
        detectedDescription: data.detectedDescription || textToSend
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "I apologize, but I ran into a connection glitch. Please check your network and try chatting again shortly.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileTicket = async (msgId: string, category: string, desc: string) => {
    setSubmittingTicketId(msgId);

    try {
      // Prepare report data mapping to user's current GPS position or defaults
      const reportPayload = {
        description: desc || "Complaint registered via Smart Civic AI Assistant chat.",
        latitude: latitude || 18.5204,
        longitude: longitude || 73.8567,
        address: address || "GPS location tagged via Civic Assistant",
        category: category || "Other",
        ward: user?.ward || "Ward I - Central Corridor"
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-username": user?.username || "Guest"
        },
        body: JSON.stringify(reportPayload)
      });

      if (!res.ok) {
        throw new Error("Could not log ticket from chat bot.");
      }

      const data = await res.json();
      
      // Update the specific message to indicate ticket has been created
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, ticketSubmitted: true, ticketId: data.report?.id || `rep-${Date.now()}` }
            : m
        )
      );

      // Trigger the parent refresh to update map and feeds!
      onReportSubmitted();
    } catch (err) {
      console.error("Ticket generation from chatbot failed:", err);
    } finally {
      setSubmittingTicketId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[520px] overflow-hidden" id="civic-chatbot-card">
      {/* Header */}
      <div className="bg-slate-50/60 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 p-1.5 rounded-xl text-indigo-600">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 font-mono tracking-wider uppercase">Ward AI Assistant</h3>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Connected to {user?.ward || "Local Corridor"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100/60 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
            Gemini 3.5 Ready
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Close chat"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/20">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.sender === "user" 
                  ? "bg-indigo-600 text-white" 
                  : "bg-slate-200 text-slate-700"
              }`}>
                {msg.sender === "user" ? <User size={13} /> : <Bot size={13} />}
              </div>

              {/* Bubble Body */}
              <div className="space-y-1.5">
                <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-2xs ${
                  msg.sender === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-white border border-slate-100 text-slate-850 rounded-tl-none"
                }`}>
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>

                {/* Submitting Official Tickets from inside the Chat */}
                {msg.sender === "bot" && msg.isComplaint && !msg.ticketSubmitted && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-indigo-50/75 border border-indigo-100 p-3 rounded-2xl text-xs text-indigo-950 flex flex-col gap-2 shadow-3xs"
                  >
                    <div className="flex items-start gap-1.5">
                      <Sparkles size={14} className="text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold">Automated Ward Triage Detected</p>
                        <p className="text-[10px] text-indigo-700/80">I can automatically register this under category: <strong>{msg.detectedCategory}</strong> and route it immediately to <strong>{user?.ward || "Ward I - Central Corridor"}</strong>.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submittingTicketId !== null}
                      onClick={() => handleFileTicket(msg.id, msg.detectedCategory || "Other", msg.detectedDescription || msg.text)}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs disabled:opacity-50"
                    >
                      {submittingTicketId === msg.id ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          Filing Ticket...
                        </>
                      ) : (
                        <>
                          <Check size={12} />
                          File Ticket in {user?.ward || "Local Corridor"}
                        </>
                      )}
                    </button>
                  </motion.div>
                )}

                {msg.sender === "bot" && msg.ticketSubmitted && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-900 flex items-center gap-2"
                  >
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Official Ticket Filed Successfully!</p>
                      <p className="text-[10px] text-emerald-700">Ticket ID: <span className="font-mono font-bold bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">{msg.ticketId}</span> is now active in your ward feed.</p>
                    </div>
                  </motion.div>
                )}

                {/* Timestamp */}
                <p className="text-[8px] font-bold text-slate-400 font-mono text-right tracking-wider uppercase px-1">
                  {msg.timestamp}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Loading bubble */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5 max-w-[85%] mr-auto"
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <Bot size={13} />
              </div>
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions if thread is short or prompt is empty */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.text)}
              className="text-[10px] font-bold bg-white text-slate-600 border border-slate-200/80 hover:border-indigo-400 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input controls form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="p-3 border-t border-slate-100 bg-white flex gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question or describe a neighborhood problem..."
          className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none transition font-semibold text-slate-800 bg-slate-50/40"
          required
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition shrink-0 disabled:opacity-40 cursor-pointer flex items-center justify-center shadow-xs"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
