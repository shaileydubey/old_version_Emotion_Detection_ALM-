// ======================== AdminSettings Component ========================
// Admin Settings -> User management panel
// Connects to:
//   GET    /api/admin/users          — fetch all users
//   PUT    /api/admin/users/:id/status — toggle active/inactive
//   PUT    /api/admin/users/:id/credits — add credits
//   GET    /api/admin/stats          — header KPI cards
// Matches AdminDashboard glassmorphism style exactly
// =========================================================================

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------
const ROLE_COLORS = {
  admin:     "border-purple-500 text-purple-400 bg-purple-500/10",
  superuser: "border-indigo-500 text-indigo-400 bg-indigo-500/10",
  agent:     "border-cyan-500 text-cyan-400 bg-cyan-500/10",
  user:      "border-gray-500 text-gray-400 bg-gray-500/10",
};

const STATUS_COLORS = {
  active:   "border-emerald-500 text-emerald-400 bg-emerald-500/10",
  inactive: "border-red-500 text-red-400 bg-red-500/10",
};

// ---------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------
function StatCard({ label, value, color = "text-indigo-400" }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value ?? "—"}</span>
    </div>
  );
}

function CreditsModal({ user, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    const n = parseInt(amount);
    if (!n || n <= 0) { setError("Enter a valid positive number."); return; }
    setError("");
    setSaving(true);
    await onSave(user.id, n);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-card rounded-3xl p-8 w-full max-w-md border border-white/20 shadow-[0_0_60px_rgba(99,102,241,0.25)]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Add Credits</h3>
            <p className="text-xs text-gray-400 mt-1">User: <span className="text-indigo-400 font-semibold">{user.name}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 mb-6">
          <label className="text-xs text-purple-400 uppercase font-bold tracking-wider">Credit Amount</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="e.g. 100"
            className="input-field bg-[#020617]/50 text-sm py-3"
            autoFocus
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all
              ${saving
                ? "bg-indigo-600/40 cursor-not-allowed"
                : "bg-[#6366F1] hover:bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              }`}
          >
            {saving ? "Saving..." : "Add Credits"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl">
      <div className={`glass-card rounded-3xl p-8 w-full max-w-sm border shadow-2xl text-center
        ${danger ? "border-red-500/30" : "border-emerald-500/30"}`}>
        <div className="text-4xl mb-4">{danger ? "⚠️" : "✅"}</div>
        <p className="text-white font-semibold text-base mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all
              ${danger
                ? "bg-red-500/80 hover:bg-red-500 border border-red-500/50"
                : "bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-500/50"
              }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------
export default function AdminSettings() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [users,        setUsers]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast,        setToast]        = useState("");
  const [creditsModal, setCreditsModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token}`,
  };

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Fetch users + stats ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setError("");
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users", { headers: authHeaders }),
        fetch("/api/admin/stats", { headers: authHeaders }),
      ]);
      if (!usersRes.ok) throw new Error(`Users API: ${usersRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats API: ${statsRes.status}`);
      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Polling every 30s ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Toggle user active/inactive ───────────────────────────────
  const toggleStatus = (user) => {
    const action = user.is_active ? "deactivate" : "activate";
    setConfirmModal({
      danger:    user.is_active,
      message:   `${action.charAt(0).toUpperCase() + action.slice(1)} user "${user.name}"?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/users/${user.id}/status`, {
            method: "PUT",
            headers: authHeaders,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setUsers(prev =>
            prev.map(u => u.id === user.id ? { ...u, is_active: data.is_active } : u)
          );
          showToast(`User "${user.name}" ${data.is_active ? "activated" : "deactivated"}.`);
        } catch {
          setError("Failed to update user status.");
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // ── Add credits ───────────────────────────────────────────────
  const handleAddCredits = async (userId, amount) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method:  "PUT",
        headers: authHeaders,
        body:    JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Added ${amount} credits successfully.`);
      setCreditsModal(null);
    } catch {
      setError("Failed to add credits.");
      setCreditsModal(null);
    }
  };

  // ── Filtered users ────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch =
      (u.name  || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q);
    const matchRole   = roleFilter   === "All" || u.role === roleFilter;
    const matchStatus = statusFilter === "All"
      || (statusFilter === "Active"   &&  u.is_active)
      || (statusFilter === "Inactive" && !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const roles = ["All", "admin", "superuser", "agent", "user"];

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-indigo-400 font-mono text-sm tracking-widest uppercase animate-pulse">
            Loading Users...
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-[#020617] text-white font-sans p-6 flex flex-col gap-6">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[300] px-5 py-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 text-sm font-bold shadow-2xl backdrop-blur-md">
          ✓ {toast}
        </div>
      )}

      {/* ── Header ── */}
      <header className="glass-card flex justify-between items-center px-6 py-4 rounded-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-all"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gradient">Admin Settings</h1>
        </div>
        <button
          onClick={fetchAll}
          className="px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
        >
          ↻ Refresh
        </button>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div className="px-5 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex justify-between items-center">
          ⚠ {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users"  value={stats.totalUsers}  color="text-indigo-400" />
          <StatCard label="Total Agents" value={stats.totalAgents} color="text-purple-400" />
          <StatCard label="Total Calls"  value={stats.totalCalls}  color="text-emerald-400" />
          <StatCard label="Credits Used" value={stats.creditsUsed} color="text-amber-400" />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="glass-card rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#020617]/50 border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <span className="text-gray-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="bg-transparent outline-none text-sm text-white placeholder-gray-600 flex-1"
          />
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400 uppercase font-bold tracking-wider">Role</span>
          <div className="flex gap-1 bg-[#020617]/50 rounded-xl p-1 border border-white/10">
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  roleFilter === r
                    ? "bg-[#6366F1] text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400 uppercase font-bold tracking-wider">Status</span>
          <div className="flex gap-1 bg-[#020617]/50 rounded-xl p-1 border border-white/10">
            {["All", "Active", "Inactive"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s
                    ? s === "Active"
                      ? "bg-emerald-600 text-white"
                      : s === "Inactive"
                        ? "bg-red-600 text-white"
                        : "bg-[#6366F1] text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <span className="ml-auto text-xs text-gray-600 font-mono">{filtered.length} users</span>
      </div>

      {/* ── Users Table ── */}
      <div className="glass-card rounded-2xl overflow-hidden">

        {/* Table Header */}
        <div className="grid grid-cols-[2fr_2.5fr_1fr_1fr_1.5fr] gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          {["Name", "Email", "Role", "Status", "Actions"].map(h => (
            <span key={h} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500 italic">
            {search ? "No users match your search." : "No users found."}
          </div>
        ) : filtered.map(user => (
          <div
            key={user.id}
            className="grid grid-cols-[2fr_2.5fr_1fr_1fr_1.5fr] gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/[0.03] transition-all items-center"
            style={{ opacity: user.is_active ? 1 : 0.55 }}
          >
            {/* Name */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
              >
                {(user.name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">{user.name}</p>
                <p className="text-[10px] text-gray-600 font-mono">ID: {user.id}</p>
              </div>
            </div>

            {/* Email */}
            <span className="text-sm text-gray-400 font-mono truncate">{user.email}</span>

            {/* Role badge */}
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
              {user.role}
            </span>

            {/* Status badge */}
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit ${user.is_active ? STATUS_COLORS.active : STATUS_COLORS.inactive}`}>
              {user.is_active ? "Active" : "Inactive"}
            </span>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleStatus(user)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  user.is_active
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                }`}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => setCreditsModal(user)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                + Credits
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
      {creditsModal && (
        <CreditsModal
          user={creditsModal}
          onClose={() => setCreditsModal(null)}
          onSave={handleAddCredits}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}