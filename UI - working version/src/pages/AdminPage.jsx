import GlobalStyles from "../components/dashboard/GlobalStyles";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, FCard, SecTitle } from "../components/dashboard/UI";

const STATUS_COLOR = {
  active:    { color: "var(--grn)", bg: "var(--grnl)" },
  inactive:  { color: "var(--red)", bg: "rgba(255,71,87,0.1)" },
  completed: { color: "var(--grn)", bg: "var(--grnl)" },
  failed:    { color: "var(--red)", bg: "rgba(255,71,87,0.1)" },
};

function StatusPill({ status }) {
  const s = STATUS_COLOR[status] ?? { color: "var(--txt2)", bg: "var(--elev)" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.6px", padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <FCard style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--lbl)", marginBottom: 10 }}>
            {label}
          </p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "var(--txt)" }}>
            {value?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: "var(--purl)", border: "1px solid var(--bdr2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: "var(--pur2)",
        }}>
          {icon}
        </div>
      </div>
    </FCard>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats]               = useState({ totalUsers: 0, totalCalls: 0, creditsUsed: 0 });
  const [users, setUsers]               = useState([]);
  const [creditInputs, setCreditInputs] = useState({});
  const [loading, setLoading]           = useState(true);

  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        setStats(statsData);
        setUsers(usersData);
      } catch (err) {
        console.error("Admin fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const toggleStatus = async (id) => {
    await fetch(`/api/admin/users/${id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    setUsers((prev) =>
      prev.map((u) => u.id === id ? { ...u, is_active: u.is_active ? 0 : 1 } : u)
    );
  };

  const addCredits = async (id) => {
    const amount = parseInt(creditInputs[id] || 0);
    if (!amount || isNaN(amount)) return;
    await fetch(`/api/admin/users/${id}/credits`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setCreditInputs((prev) => ({ ...prev, [id]: "" }));
  };

  return (
    <>
      <GlobalStyles />
      <div style={{ padding: "38px 44px", maxWidth: 1100, margin: "0 auto" }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800 }}>Admin Panel</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", padding: "3px 10px", borderRadius: 20,
                background: "rgba(255,107,53,0.12)", color: "var(--org)",
                border: "1px solid rgba(255,107,53,0.25)",
              }}>
                Admin
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--txt2)" }}>
              Platform overview — manage users, monitor calls.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => navigate("/admin/dashboard")} style={{ gap: 10 }}>
              Admin Dashboard →
            </Btn>
            <Btn
              variant="secondary"
              onClick={handleLogout}
              style={{ color: "var(--red)", borderColor: "rgba(255,71,87,0.3)" }}
            >
              Logout
            </Btn>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
          <StatCard label="Total Users"  value={stats.totalUsers}  icon="◉" />
          <StatCard label="Total Calls"  value={stats.totalCalls}  icon="↗" />
          <StatCard label="Credits Used" value={stats.creditsUsed} icon="◎" />
        </div>

        {/* ── User Management ───────────────────────────────────────────── */}
        <FCard style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <SecTitle>◉ User Management</SecTitle>
            <Btn variant="secondary" style={{ fontSize: 12, padding: "8px 16px" }}>+ Add User</Btn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr", gap: 12, padding: "8px 14px", marginBottom: 4 }}>
            {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--lbl)" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <p style={{ color: "var(--txt2)", padding: "20px 14px" }}>Loading...</p>
          ) : users.map((u) => (
            <div
              key={u.id}
              style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr", gap: 12, padding: "12px 14px", borderRadius: 10, alignItems: "center", transition: "background 0.15s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--purl)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{u.name}</span>
              <span style={{ fontSize: 13, color: "var(--txt2)", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
              <span style={{ fontSize: 12, color: u.role === "admin" ? "var(--acc)" : "var(--txt2)", fontWeight: 600, textTransform: "uppercase" }}>{u.role}</span>
              <StatusPill status={u.is_active ? "active" : "inactive"} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  placeholder="Credits"
                  value={creditInputs[u.id] || ""}
                  onChange={(e) => setCreditInputs((p) => ({ ...p, [u.id]: e.target.value }))}
                  style={{ width: 70, padding: "5px 8px", fontSize: 12, background: "var(--elev)", border: "1px solid var(--bdr)", borderRadius: 7, color: "var(--txt)", outline: "none", fontFamily: "'Syne', sans-serif" }}
                />
                <Btn variant="secondary" onClick={() => addCredits(u.id)} style={{ fontSize: 11, padding: "6px 10px" }}>Add</Btn>
                <Btn
                  variant="ghost"
                  onClick={() => toggleStatus(u.id)}
                  style={{ fontSize: 11, padding: "6px 10px", color: u.is_active ? "var(--red)" : "var(--grn)" }}
                >
                  {u.is_active ? "Disable" : "Enable"}
                </Btn>
              </div>
            </div>
          ))}
        </FCard>

      </div>
    </>
  );
}