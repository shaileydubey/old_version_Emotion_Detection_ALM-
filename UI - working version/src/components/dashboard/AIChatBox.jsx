import React, { useState, useEffect, useRef } from "react";

/**
 * Component: AIChatBox
 * * DESIGN PATTERN: Functional Component with Hooks.
 * ARCHITECTURE: Frontend Client (React) communicating with a Backend (Flask/Python).
 * PURPOSE: Provides a "Chat-over-Data" interface, translating natural language into 
 * SQL queries via a remote neural engine to fetch real-time call center metrics.
 */
export function AIChatBox() {
  // --- 💾 STATE HOOKS: THE COMPONENT'S REACTION SYSTEM ---
  
  // query [Type: string]: Reactive state bound to the <input> element. 
  // Captures the user's natural language question.
  const [query, setQuery] = useState("");
  
  // answer [Type: string]: Storage for the AI's final synthesized output.
  // Using a single string here assumes the backend handles the text formatting.
  const [answer, setAnswer] = useState("");
  
  // loading [Type: boolean]: Semantic flag used for "Conditional Rendering."
  // When true, it triggers CSS animations to signal the user to wait for the API.
  const [loading, setLoading] = useState(false);
  
  // isOpen [Type: boolean]: UI State to handle the "Floating Action Button" (FAB) pattern.
  // Toggles the entire chat widget between a compact button and a full sidebar/modal.
  const [isOpen, setIsOpen] = useState(false);
  
  // --- 📍 REFERENCE HOOKS: STICKY UI CONTROL ---

  // messagesEndRef: A "pointer" to an invisible div. 
  // It allows us to manually manipulate the DOM without causing a full React re-render.
  const messagesEndRef = useRef(null);

  // --- ⚙️ LOGIC FUNCTIONS: BEHAVIOR & API ---

  /**
   * Function: scrollToBottom
   * ACCESSIBILITY: Ensures that as the AI "speaks," the user doesn't have to manually scroll.
   * METHOD: scrollIntoView() is a native browser API used for smooth navigation.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Effect Hook: Lifecycle synchronization
   * TRIGGER: Fires every time the 'answer' text changes or the window is opened.
   * PURPOSE: Keeps the chat synchronized with the scroll position.
   */
  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [answer, loading, isOpen]);

  /**
   * Function: handleAsk (The "Neural" Bridge)
   * PATTERN: Async/Await for non-blocking I/O.
   * FLOW: 1. Prevent empty submits -> 2. Set UI to 'loading' -> 3. Post data -> 4. Parse JSON -> 5. Handle Errors.
   */
  const handleAsk = async () => {
    // Edge case handling: avoid unnecessary API calls for whitespace
    if (!query.trim()) return; 
    
    setLoading(true);
    setAnswer(""); // RESET: Clear previous state to prevent visual confusion for the user.
    
    try {
      // NETWORKING: Fetching from a local Flask instance. 
      // Note: 'localhost:5000' would typically be an environment variable in production.
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      
      const data = await res.json();
      
      // ERROR BOUNDARY: Uses logical OR to prioritize 'answer' but fallback to 'error' if the query failed.
      setAnswer(data.answer || data.error);
    } catch (e) {
      // CATCH: Handles network-level failures (e.g., Backend Server is Down).
      setAnswer("Failed to connect to Neural Engine. Is the Flask backend running?");
    }
    setLoading(false); // FINALLY: End the loading state regardless of success or failure.
  };

  // --- 🎨 RENDER LOGIC: UI COMPOSITION ---

  // UI STATE 1: CLOSED
  // Uses a fixed-position FAB (Floating Action Button) with Tailwind glassmorphism effects.
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.4)] z-[99999] transition-all hover:scale-105 border border-indigo-400/30"
      >
        <span className="font-black text-sm tracking-[0.2em] uppercase">Open Neural Engine</span>
      </button>
    );
  }

  // UI STATE 2: OPEN (The Chat Window)
  return (
    <div className="fixed bottom-6 right-6 w-[25vw] min-w-[400px] h-[75vh] bg-slate-950/95 backdrop-blur-3xl border border-indigo-500/40 rounded-3xl shadow-[0_0_80px_-20px_rgba(99,102,241,0.6)] z-[99999] overflow-hidden">
      
      {/* 🟢 HEADER: Visual confirmation of 'Online' status via animate-pulse */}
      <div className="absolute top-0 left-0 right-0 h-[70px] px-5 bg-gradient-to-br from-indigo-900/40 to-slate-900/60 flex items-center justify-between border-b border-indigo-500/20 z-10">
        <div>
          <h4 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Neural SQL
          </h4>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-full transition-all text-2xl font-light leading-none">×</button>
      </div>

      {/* 🔵 CONTENT AREA: Scrollable message history zone */}
      <div className="absolute top-[70px] bottom-[90px] left-0 right-0 overflow-y-auto scrollbar-visible bg-slate-900/20 p-5">
        <div className="flex flex-col gap-5 pb-4">
          
          {/* SYSTEM MESSAGE: Hardcoded reassurance of the system's capabilities. */}
          <div className="bg-slate-800/40 p-4 rounded-2xl border border-indigo-500/10 self-start max-w-[90%]">
            <p className="text-[10px] text-indigo-500 font-bold mb-2 tracking-widest uppercase">System Ready</p>
            <p className="text-sm text-slate-300 font-medium">Authentication successful. I can query agent stats and call logs directly.</p>
          </div>
          
          {/* AI MESSAGE: Using 'whitespace-pre-wrap' to preserve SQL formatting or line breaks from the model. */}
          {answer && (
            <div className="bg-indigo-600/10 p-5 rounded-2xl border border-indigo-500/30 self-start w-full shadow-lg">
              <p className="text-[10px] text-indigo-400 font-bold mb-3 tracking-widest uppercase italic">Synthesized Result</p>
              <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">{answer}</p>
            </div>
          )}

          {/* LOADER: Skeleton-style bars to indicate active data fetching. */}
          {loading && (
            <div className="flex flex-col gap-3 p-2">
              <div className="h-3 w-48 bg-indigo-500/20 rounded-full animate-pulse"></div>
              <div className="h-3 w-64 bg-indigo-500/10 rounded-full animate-pulse delay-75"></div>
            </div>
          )}

          {/* SCROLL TARGET: Important for the scrollToBottom logic to function. */}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* 🟡 INPUT BAR: The Footer containing the interactive text field */}
      <div className="absolute bottom-0 left-0 right-0 h-[90px] p-5 border-t border-slate-800 bg-slate-950/90 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10">
        <div className="relative group h-full flex items-center">
          <input 
            type="text" 
            value={query}
            // UX PATTERN: Allowing 'Enter' to submit mimics standard chat behavior.
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="w-full h-full bg-[#030712] border border-indigo-500/20 group-hover:border-indigo-500/50 rounded-2xl py-3 pl-5 pr-14 text-sm text-white focus:border-indigo-400 outline-none transition-all shadow-inner placeholder:text-slate-600"
          />
          <button 
            onClick={handleAsk}
            disabled={loading} // UX: Prevent 'double-tapping' which causes duplicate API calls.
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600/20 text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-xl transition-all"
          >
            {/* SVG Action Icon: Right-facing arrows represent 'Send' or 'Next' */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}