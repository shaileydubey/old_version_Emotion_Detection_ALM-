import { useState, useRef, useEffect } from "react";
import { channelIcon } from "../../utils/agentHelpers";

function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const presets = [
    { label: "Today",    days: 0  },
    { label: "Last 7d",  days: 7  },
    { label: "Last 30d", days: 30 },
    { label: "Last 90d", days: 90 },
  ];

  const applyPreset = (days) => {
    const to   = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    onChange({ from: days === 0 ? to : from, to });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          border: "1px solid var(--bdr2)",
          background: "var(--bg2)", cursor: "pointer",
          fontSize: 12, color: "var(--txt)",
        }}
      >
        📅 {from || "Start"} → {to || "End"}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
          background: "var(--bg2)", border: "1px solid var(--bdr2)",
          borderRadius: 10, padding: "14px", minWidth: 280,
        }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                style={{
                  padding: "4px 10px", borderRadius: 6,
                  border: "1px solid var(--bdr2)",
                  background: "var(--bg)", cursor: "pointer",
                  fontSize: 12, color: "var(--txt2)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="date" value={from || ""}
              onChange={(e) => onChange({ from: e.target.value, to })}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "var(--bg)", fontSize: 12, color: "var(--txt)", outline: "none" }}
            />
            <span style={{ color: "var(--txt2)", fontSize: 12 }}>to</span>
            <input
              type="date" value={to || ""}
              onChange={(e) => onChange({ from, to: e.target.value })}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "var(--bg)", fontSize: 12, color: "var(--txt)", outline: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function KPIRow({ kpis, fmtDur }) {
  const cards = [
    { label: "Total Calls",  value: kpis?.total      ?? "—"                                           },
    { label: "Resolved",     value: kpis?.resolved    ?? "—", color: "#1D9E75"                        },
    { label: "Escalated",    value: kpis?.escalated   ?? "—", color: "#E24B4A"                        },
    { label: "Avg Duration", value: fmtDur(kpis?.avgDuration)                                         },
    { label: "Total Cost",   value: kpis?.totalCost != null ? `$${Number(kpis.totalCost).toFixed(2)}` : "—" },
  ];

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "16px 24px", borderBottom: "1px solid var(--bdr)" }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          flex: "1 1 110px",
          background: "var(--bg2)",
          border: "1px solid var(--bdr)",
          borderRadius: 10, padding: "12px 14px",
        }}>
          <span style={{ display: "block", fontSize: 10, color: "var(--txt2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {c.label}
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: c.color || "var(--txt)", lineHeight: 1 }}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Header({ activeTab, profile, csatData, dateRange, setDateRange, channel, setChannel, stats, fmtDur }) {
  return (
    <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--bdr)" }}>

      {/* Top bar */}
      <div style={{
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--txt)", margin: 0 }}>
            {{ overview: "Dashboard", calls: "Call History", analytics: "Analytics", settings: "Settings" }[activeTab] || "Dashboard"}
          </h1>
          <p style={{ fontSize: 12, color: "var(--txt2)", margin: "2px 0 0" }}>
            {profile?.name || "Agent"} · {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {/* Channel filter */}
          <div style={{
            display: "flex", gap: 4,
            background: "var(--bg)", borderRadius: 8, padding: 3,
            border: "1px solid var(--bdr)",
          }}>
            {["all", "voice", "chat", "email"].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                  background: channel === ch ? "var(--bg2)" : "transparent",
                  color: channel === ch ? "var(--txt)" : "var(--txt2)",
                  fontWeight: channel === ch ? 600 : 400,
                  boxShadow: channel === ch ? "0 0 0 1px var(--bdr2)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {ch === "all" ? "All" : `${channelIcon[ch]} ${ch.charAt(0).toUpperCase() + ch.slice(1)}`}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />

          {/* CSAT badge */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "6px 14px", borderRadius: 10,
            border: "1px solid var(--bdr2)",
            background: "var(--bg)",
            minWidth: 70,
          }}>
            <span style={{ fontSize: 10, color: "var(--txt2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Avg CSAT</span>
            <span style={{
              fontSize: 22, fontWeight: 700, lineHeight: 1,
              color: csatData?.csat >= 4 ? "#1D9E75" : csatData?.csat >= 3 ? "#BA7517" : "#E24B4A",
            }}>
              {csatData?.csat != null ? Number(csatData.csat).toFixed(1) : "—"}
            </span>
          </div>

        </div>
      </div>

      {/* KPI row — only on overview and analytics */}
      {(activeTab === "overview" || activeTab === "analytics") && (
        <KPIRow kpis={stats?.kpis} fmtDur={fmtDur} />
      )}

    </div>
  );
}