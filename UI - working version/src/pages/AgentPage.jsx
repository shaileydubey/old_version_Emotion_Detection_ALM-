// ======================== Settings Component ========================
// Settings -> Superuser agent management page. Full CRUD + bulk stop/resume.
//             All changes persist to DB via FastAPI backend.
// ||
// ||
// ||
// Functions/Methods -> RiskBadge()      -> Colored badge for agent risk level
// ||                 | StatusBadge()    -> Colored badge for agent active/stopped status
// ||                 | FormField()      -> Labeled form field wrapper
// ||                 | AgentModal()     -> Add / edit agent modal with form + validation
// ||                 | ConfirmDialog()  -> Generic confirm/cancel dialog (danger or success)
// ||                 | Settings()       -> Main component
// ||                 |
// ||                 |---> fetchAgents()  -> GET /api/agents -> Populate table
// ||                 |---> handleSave()   -> POST (add) or PUT (edit) agent -> Update state
// ||                 |---> removeAgent()  -> Show confirm -> DELETE /api/agents/:id
// ||                 |---> toggleAgent()  -> PUT /api/agents/:id -> Flip is_active
// ||                 |---> stopAll()      -> Confirm -> PUT all active agents is_active=false
// ||                 |---> resumeAll()    -> Confirm -> PUT all stopped agents is_active=true
// ||                 |---> showToast()    -> Set toast message -> Auto-clear after 3s
// ||                 |
// ||                 |---> Logic Flow -> Component render lifecycle:
// ||                                  |
// ||                                  |--- useEffect() -> fetchAgents on mount
// ||                                  |--- filtered    -> agents filtered by search term
// ||                                  |--- activeCount / stoppedCount -> Derived from is_active
// ||                                  |--- Render Header -> Back + title + refresh + add button
// ||                                  |--- Render Stats Row -> Total, Active, Stopped counts
// ||                                  |--- Render Controls -> Search + Stop All + Resume All
// ||                                  |--- Render Table
// ||                                  |    ├── IF loading  -> Loading text
// ||                                  |    ├── IF no match -> Empty state text
// ||                                  |    └── ELSE        -> Map filtered -> Agent rows
// ||                                  |--- Render AgentModal  -> IF modal state set
// ||                                  |--- Render ConfirmDialog -> IF confirm state set
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------
// SECTION: CONSTANTS & HELPERS
// ---------------------------------------------------------------

// RISK_COLORS -> Style map for risk level badges
const RISK_COLORS = {
  high:   { bg: "rgba(239,68,68,0.1)",  color: "#EF4444", border: "rgba(239,68,68,0.3)"  },
  medium: { bg: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "rgba(245,158,11,0.3)" },
  low:    { bg: "rgba(16,185,129,0.1)", color: "#10B981", border: "rgba(16,185,129,0.3)" },
};

// STATUS_COLORS -> Style map for active/stopped status badges
const STATUS_COLORS = {
  active:  { bg: "rgba(16,185,129,0.1)",  color: "#10B981", border: "rgba(16,185,129,0.3)"  },
  stopped: { bg: "rgba(239,68,68,0.1)",   color: "#EF4444", border: "rgba(239,68,68,0.3)"   },
};

// RiskBadge -> Pill badge colored by risk level
function RiskBadge({ level }) {
  const l = (level || "low").toLowerCase();
  const s = RISK_COLORS[l] || RISK_COLORS.low;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.6px", padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {level || "Low"}
    </span>
  );
}

// StatusBadge -> Pill badge for active or stopped state
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.active;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.6px", padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status === "stopped" ? "Stopped" : "Active"}
    </span>
  );
}

// EMPTY_FORM -> Default blank state for add agent form
const EMPTY_FORM = {
  name:             "",
  model_variant:    "",
  skill_level:      "",
  risk_level:       "Low",
  csat_score:       "",
  avg_latency_ms:   "",
  workload_percent: "",
};

const SKILL_OPTIONS  = ["Junior", "Mid", "Senior", "Expert"];
const RISK_OPTIONS   = ["Low", "Medium", "High"];
const MODEL_OPTIONS  = ["GPT-4o", "GPT-4", "Claude-3", "Gemini-Pro", "Custom"];

// inputStyle -> Shared style for all form inputs and selects
const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10, color: "#fff",
  fontSize: 13, padding: "10px 14px",
  outline: "none", width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
};

// ---------------------------------------------------------------
// SECTION: SUB-COMPONENTS
// ---------------------------------------------------------------

// FormField -> Label + input wrapper used in AgentModal
function FormField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// AgentModal -> Add or edit agent form modal
// isEdit -> true when agent.id exists (edit mode), false for add mode
function AgentModal({ agent, onClose, onSave }) {

  // Pre-populate -> Use existing agent data in edit mode, blank form in add mode
  const [form, setForm] = useState(() => agent ? {
    id:               agent.id,
    name:             agent.name             || "",
    model_variant:    agent.model_variant    || "",
    skill_level:      agent.skill_level      || "",
    risk_level:       agent.risk_level       || "Low",
    csat_score:       agent.csat_score       ?? "",
    avg_latency_ms:   agent.avg_latency_ms   ?? "",
    workload_percent: agent.workload_percent ?? "",
  } : EMPTY_FORM);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const isEdit = !!agent?.id;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));  // Field updater helper

  // handleSave -> Validate -> Call onSave -> Show error if failed
  const handleSave = async () => {
    if (!form.name.trim()) { setError("Agent name is required."); return; }
    setError("");
    setSaving(true);
    const success = await onSave(form, isEdit);
    setSaving(false);
    if (!success) setError("Failed to save. Please try again.");
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}  // Close on backdrop click
    >
      <div style={{
        background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 20, padding: 32, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
            {isEdit ? "Edit Agent" : "Add New Agent"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {/* Error -> Inline validation or save failure message */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#EF4444",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FormField label="Agent Name">
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Support Bot Alpha"
            />
          </FormField>

          <FormField label="Model Variant">
            <select style={inputStyle} value={form.model_variant} onChange={e => set("model_variant", e.target.value)}>
              <option value="">Select model</option>
              {MODEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Skill Level">
            <select style={inputStyle} value={form.skill_level} onChange={e => set("skill_level", e.target.value)}>
              <option value="">Select level</option>
              {SKILL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Risk Level">
            <select style={inputStyle} value={form.risk_level} onChange={e => set("risk_level", e.target.value)}>
              {RISK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="CSAT Score (0–5)">
            <input
              style={inputStyle} type="number" min="0" max="5" step="0.1"
              value={form.csat_score}
              onChange={e => set("csat_score", e.target.value)}
              placeholder="4.2"
            />
          </FormField>

          <FormField label="Avg Latency (ms)">
            <input
              style={inputStyle} type="number"
              value={form.avg_latency_ms}
              onChange={e => set("avg_latency_ms", e.target.value)}
              placeholder="320"
            />
          </FormField>

          <FormField label="Workload (%)">
            <input
              style={inputStyle} type="number" min="0" max="100"
              value={form.workload_percent}
              onChange={e => set("workload_percent", e.target.value)}
              placeholder="75"
            />
          </FormField>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "#94a3b8",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
            color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Saving..." : isEdit ? "Update Agent" : "Add Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ConfirmDialog -> Generic confirm modal with danger (red) or success (green) styling
function ConfirmDialog({ message, onConfirm, onCancel, danger = true }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0f172a",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
        borderRadius: 16, padding: 28, maxWidth: 380, width: "92%", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{danger ? "⚠️" : "✅"}</div>
        <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600, marginBottom: 20 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{
            padding: "9px 20px", borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent", color: "#94a3b8",
            cursor: "pointer", fontSize: 13,
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            padding: "9px 20px", borderRadius: 9, border: "none",
            background: danger ? "rgba(239,68,68,0.8)" : "rgba(16,185,129,0.8)",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
export default function Settings() {

  // ---------------------------------------------------------------
  // SECTION: STATE & HOOKS
  // ---------------------------------------------------------------
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [agents,  setAgents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [modal,   setModal]   = useState(null);   // null | { type: "add" | "edit", agent? }
  const [confirm, setConfirm] = useState(null);   // null | { message, danger, onConfirm }
  const [search,  setSearch]  = useState("");
  const [toast,   setToast]   = useState("");

  // ---------------------------------------------------------------
  // SECTION: HELPERS
  // ---------------------------------------------------------------

  // authHeaders -> Reused for all fetch calls
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // showToast -> Display success message -> Auto-dismiss after 3s
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ---------------------------------------------------------------
  // SECTION: EFFECTS
  // ---------------------------------------------------------------
  useEffect(() => { fetchAgents(); }, []);  // Fetch on mount

  // ---------------------------------------------------------------
  // SECTION: DATA FETCH
  // ---------------------------------------------------------------

  // fetchAgents -> GET /api/agents -> Populate agents state
  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/agents", { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load agents. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // SECTION: DERIVED DATA
  // ---------------------------------------------------------------

  // filtered -> Search across name, model_variant, skill_level (snake_case from DB)
  const filtered = agents.filter(a => {
    const q = search.toLowerCase();
    return (
      (a.name          || "").toLowerCase().includes(q) ||
      (a.model_variant || "").toLowerCase().includes(q) ||
      (a.skill_level   || "").toLowerCase().includes(q)
    );
  });

  // ---------------------------------------------------------------
  // SECTION: EVENT HANDLERS
  // ---------------------------------------------------------------

  // handleSave -> POST (add) or PUT (edit) agent -> Update local state on success
  const handleSave = async (form, isEdit) => {
    try {
      const method = isEdit ? "PUT"  : "POST";
      const url    = isEdit ? `/api/agents/${form.id}` : "/api/agents";

      // Payload -> Parse numerics, null-out empty strings
      const payload = {
        name:             form.name.trim(),
        model_variant:    form.model_variant    || null,
        skill_level:      form.skill_level      || null,
        risk_level:       form.risk_level       || "Low",
        csat_score:       form.csat_score       !== "" ? parseFloat(form.csat_score)       : null,
        avg_latency_ms:   form.avg_latency_ms   !== "" ? parseInt(form.avg_latency_ms)     : null,
        workload_percent: form.workload_percent !== "" ? parseFloat(form.workload_percent) : null,
      };

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (isEdit) {
        setAgents(prev => prev.map(a => a.id === form.id ? { ...a, ...payload } : a));  // Update in place
        showToast("Agent updated successfully.");
      } else {
        setAgents(prev => [...prev, data]);  // Append new agent
        showToast("Agent created successfully.");
      }

      setModal(null);
      return true;
    } catch (err) {
      console.error("Save agent error:", err);
      return false;  // Signals AgentModal to show error
    }
  };

  // removeAgent -> Show confirm dialog -> DELETE /api/agents/:id on confirm
  const removeAgent = (agent) => {
    setConfirm({
      danger: true,
      message: `Remove agent "${agent.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/agents/${agent.id}`, {
            method: "DELETE",
            headers: authHeaders,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setAgents(prev => prev.filter(a => a.id !== agent.id));  // Remove from list
          showToast(`Agent "${agent.name}" removed.`);
        } catch {
          setError("Failed to delete agent.");
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  // toggleAgent -> Flip is_active for a single agent -> Persist to DB
  const toggleAgent = async (agent) => {
    const newActive = agent.is_active === false ? true : false;
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ ...agent, is_active: newActive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: newActive } : a));
      showToast(`Agent "${agent.name}" ${newActive ? "resumed" : "stopped"}.`);
    } catch {
      setError("Failed to update agent status.");
    }
  };

  // stopAll -> Confirm -> Bulk PUT is_active=false for all active agents
  const stopAll = () => {
    setConfirm({
      danger: true,
      message: "Stop all agents? They will no longer process calls.",
      onConfirm: async () => {
        try {
          await Promise.all(
            agents
              .filter(a => a.is_active !== false)  // Only active agents
              .map(a => fetch(`/api/agents/${a.id}`, {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify({ ...a, is_active: false }),
              }))
          );
          setAgents(prev => prev.map(a => ({ ...a, is_active: false })));
          showToast("All agents stopped.");
        } catch {
          setError("Failed to stop all agents.");
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  // resumeAll -> Confirm -> Bulk PUT is_active=true for all stopped agents
  const resumeAll = () => {
    setConfirm({
      danger: false,
      message: "Resume all agents? They will start processing calls.",
      onConfirm: async () => {
        try {
          await Promise.all(
            agents
              .filter(a => a.is_active === false)  // Only stopped agents
              .map(a => fetch(`/api/agents/${a.id}`, {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify({ ...a, is_active: true }),
              }))
          );
          setAgents(prev => prev.map(a => ({ ...a, is_active: true })));
          showToast("All agents resumed.");
        } catch {
          setError("Failed to resume all agents.");
        } finally {
          setConfirm(null);
        }
      },
    });
  };

  // ---------------------------------------------------------------
  // SECTION: DERIVED COUNTS
  // ---------------------------------------------------------------
  const activeCount  = agents.filter(a => a.is_active !== false).length;
  const stoppedCount = agents.filter(a => a.is_active === false).length;

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", fontFamily: "'Inter', sans-serif", padding: "32px 40px" }}>

      {/* ── Toast -> Success notification, auto-dismisses ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 2000,
          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)",
          borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600,
          color: "#10B981", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* ── Header -> Back + title + refresh + add agent ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button
              onClick={() => navigate("/superuser/dashboard")}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "6px 10px", color: "#94a3b8", cursor: "pointer", fontSize: 13,
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>Agent Settings</h1>
          </div>
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Manage, configure and control all AI agents. Changes sync to database instantly.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={fetchAgents}
            style={{
              padding: "10px 16px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent", color: "#94a3b8",
              cursor: "pointer", fontSize: 12, fontWeight: 600,
            }}
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => setModal({ type: "add" })}
            style={{
              padding: "11px 22px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(99,102,241,0.35)",
            }}
          >
            + Add New Agent
          </button>
        </div>
      </div>

      {/* ── Error Banner -> Dismissible ── */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 10, padding: "12px 18px", marginBottom: 20,
          fontSize: 13, color: "#EF4444", display: "flex", justifyContent: "space-between",
        }}>
          {error}
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ── Stats Row -> Total, Active, Stopped counts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Agents", value: agents.length, color: "#6366F1" },
          { label: "Active",       value: activeCount,   color: "#10B981" },
          { label: "Stopped",      value: stoppedCount,  color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "20px 24px",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
              {s.label}
            </p>
            <p style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Controls -> Search + bulk stop/resume ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, model, skill..."
          style={{ ...inputStyle, maxWidth: 300 }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={stopAll} style={{
            padding: "9px 18px", borderRadius: 9,
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.08)", color: "#EF4444",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>
            ⏹ Stop All
          </button>
          <button onClick={resumeAll} style={{
            padding: "9px 18px", borderRadius: 9,
            border: "1px solid rgba(16,185,129,0.3)",
            background: "rgba(16,185,129,0.08)", color: "#10B981",
            cursor: "pointer", fontSize: 12, fontWeight: 700,
          }}>
            ▶ Resume All
          </button>
        </div>
      </div>

      {/* ── Table -> Agent rows ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16, overflow: "hidden",
      }}>
        {/* Table header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
          gap: 12, padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}>
          {["Name", "Model", "Skill", "CSAT", "Latency", "Workload", "Status", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Loading state */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6366F1" }}>
            Loading agents from database...
          </div>
        ) : filtered.length === 0 ? (
          // Empty state -> Different message for search vs no agents
          <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>
            {search ? "No agents match your search." : "No agents yet. Click '+ Add New Agent' to create one."}
          </div>
        ) : filtered.map(agent => {
          const isActive = agent.is_active !== false;
          return (
            <div
              key={agent.id}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
                gap: 12, padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                alignItems: "center",
                opacity: isActive ? 1 : 0.6,  // Dim -> Stopped agents
                transition: "all 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Avatar -> First 2 chars of agent name */}
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: "#818CF8",
                }}>
                  {(agent.name || "?").substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{agent.name}</p>
                  <RiskBadge level={agent.risk_level} />
                </div>
              </div>

              <span style={{ fontSize: 12, color: "#94a3b8" }}>{agent.model_variant    || "—"}</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{agent.skill_level      || "—"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
                {agent.csat_score != null ? Number(agent.csat_score).toFixed(1) : "—"}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {agent.avg_latency_ms   != null ? `${agent.avg_latency_ms}ms`   : "—"}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {agent.workload_percent != null ? `${agent.workload_percent}%`  : "—"}
              </span>
              <StatusBadge status={isActive ? "active" : "stopped"} />

              {/* Actions -> Edit, Stop/Resume, Remove */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setModal({ type: "edit", agent })}
                  style={{
                    padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)",
                    color: "#818CF8", cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                {/* Stop/Resume -> Label + color flip based on isActive */}
                <button
                  onClick={() => toggleAgent(agent)}
                  style={{
                    padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: `1px solid ${isActive ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    background: isActive ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                    color: isActive ? "#EF4444" : "#10B981",
                    cursor: "pointer",
                  }}
                >
                  {isActive ? "Stop" : "Resume"}
                </button>
                <button
                  onClick={() => removeAgent(agent)}
                  style={{
                    padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                    border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
                    color: "#EF4444", cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modals -> Conditionally rendered ── */}
      {modal && (
        <AgentModal
          agent={modal.type === "edit" ? modal.agent : null}  // null = add mode
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}