import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const NAV = [
  { id: "overview",   icon: "▤", label: "Overview"     },
  { id: "calls",      icon: "📞", label: "Call History" },
  { id: "analytics",  icon: "📊", label: "Analytics"    },
  { id: "settings",   icon: "⚙", label: "Settings"     },
];

function IVRCard({ token }) {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/agent/ivr-status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setNodes(d.nodes || []));
  }, [token]);

  const max = Math.max(...nodes.map((n) => n.hits), 1);

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--bdr)",
      borderRadius: 10, padding: "10px 12px",
      margin: "0 10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>🌐</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--txt2)" }}>IVR Activity</span>
        <span style={{ fontSize: 10, color: "var(--txt2)", marginLeft: "auto" }}>24h</span>
      </div>
      {nodes.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--txt2)", textAlign: "center", margin: "8px 0" }}>No IVR data</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {nodes.map((n, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: "var(--txt)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                  {n.node || "Unknown"}
                </span>
                <span style={{ color: "var(--txt2)" }}>{n.hits}</span>
              </div>
              <div style={{ height: 4, background: "var(--bdr)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${(n.hits / max) * 100}%`,
                  background: "var(--pur)",
                  borderRadius: 2,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ activeTab, setActiveTab, profile, token }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : "AG";

  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: "var(--bg2)",
      borderRight: "1px solid var(--bdr)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
      overflowY: "auto",
    }}>

      {/* Profile */}
      <div style={{
        padding: "20px 16px 14px",
        borderBottom: "1px solid var(--bdr)",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--purl)", color: "var(--pur2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, letterSpacing: "0.04em",
        }}>
          {initials}
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--txt)", margin: "10px 0 2px", textAlign: "center" }}>
          {profile?.name || "Agent"}
        </p>
        <p style={{ fontSize: 11, color: "var(--txt2)", margin: 0, textAlign: "center" }}>
          {profile?.email || ""}
        </p>
        <span style={{
          marginTop: 8, fontSize: 11, fontWeight: 600,
          padding: "3px 10px", borderRadius: 20,
          background: profile?.isActive ? "rgba(0,212,160,0.12)" : "var(--bg2)",
          color: profile?.isActive ? "var(--grn)" : "var(--txt2)",
          border: `1px solid ${profile?.isActive ? "rgba(0,212,160,0.25)" : "var(--bdr)"}`,
        }}>
          {profile?.isActive ? "● Active" : "○ Offline"}
        </span>

        {/* Profile stats grid */}
        <div style={{ width: "100%", marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            ["Skill",  profile?.skillLevel  || "—"],
            ["Model",  profile?.modelVariant || "—"],
            ["CSAT",   profile?.csat != null ? Number(profile.csat).toFixed(1) : "—"],
            ["Risk",   profile?.riskLevel   || "—"],
          ].map(([k, v]) => (
            <div key={k} style={{
              background: "var(--bg)", borderRadius: 6, padding: "6px 8px",
            }}>
              <span style={{ display: "block", fontSize: 10, color: "var(--txt2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--txt)", marginTop: 1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 9, width: "100%",
                border: `1px solid ${isActive ? "var(--bdr2)" : "transparent"}`,
                background: isActive ? "var(--purl)" : "transparent",
                color: isActive ? "var(--pur2)" : "var(--txt2)",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "var(--purl)"; e.currentTarget.style.color = "var(--txt)"; } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--txt2)"; } }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* IVR Card */}
      <IVRCard token={token} />

      {/* Bottom */}
      <div style={{ marginTop: "auto", padding: "12px 10px", borderTop: "1px solid var(--bdr)", display: "flex", flexDirection: "column", gap: 2 }}>
        <button
          onClick={() => navigate("/agent")}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--txt2)", textAlign: "left" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--purl)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          ← Back to Agent Page
        </button>
        <button
          onClick={handleLogout}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--red)", textAlign: "left" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,71,87,0.08)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          ⏻ Logout
        </button>
      </div>
    </aside>
  );
}