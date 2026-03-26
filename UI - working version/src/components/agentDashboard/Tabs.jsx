import { StatusPie, SentimentPie, DailyLine, HourlyHeat, CategoryBubble, SankeyChart } from "./Charts";
import CallTable from "./CallTable";
import { fmtDate, fmt } from "../../utils/agentHelpers";

const chartRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const chartCard = {
  background: "var(--bg2)",
  border: "1px solid var(--bdr)",
  borderRadius: 12,
  padding: 16,
};

const chartTitle = {
  fontSize: 11, fontWeight: 700, color: "var(--txt2)",
  textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px",
};

export function OverviewTab({ stats, calls, chartsReady }) {
  if (!chartsReady) return null;
  return (
    <>
      <div style={chartRow}>
        <DailyLine stats={stats} />
        <HourlyHeat stats={stats} />
      </div>
      <div style={chartRow}>
        <StatusPie stats={stats} />
        <SentimentPie stats={stats} />
        <CategoryBubble stats={stats} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <SankeyChart stats={stats} />
      </div>
      <div style={chartCard}>
        <p style={chartTitle}>Recent Calls</p>
        <CallTable calls={calls.slice(0, 8)} />
      </div>
    </>
  );
}

export function CallsTab({ calls }) {
  return (
    <div style={chartCard}>
      <p style={chartTitle}>All Calls ({calls.length})</p>
      <CallTable calls={calls} full />
    </div>
  );
}

export function AnalyticsTab({ stats, chartsReady }) {
  if (!chartsReady) return null;
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <DailyLine stats={stats} />
      </div>
      <div style={chartRow}>
        <SankeyChart stats={stats} />
        <HourlyHeat stats={stats} />
      </div>
      <div style={chartRow}>
        <StatusPie stats={stats} />
        <SentimentPie stats={stats} />
        <CategoryBubble stats={stats} />
      </div>
    </>
  );
}

export function SettingsTab({ profile }) {
  if (!profile) return null;
  return (
    <div style={chartCard}>
      <p style={chartTitle}>Agent Profile</p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {[
          ["Name",              profile.name],
          ["Email",             profile.email],
          ["Phone",             profile.phone],
          ["Country",           profile.countryCode],
          ["Model Variant",     profile.modelVariant],
          ["Skill Level",       profile.skillLevel],
          ["Risk Level",        profile.riskLevel],
          ["Avg Latency",       `${profile.avgLatencyMs ?? "—"} ms`],
          ["Workload",          `${profile.workload ?? "—"}%`],
          ["Hallucination Rate",`${profile.hallucinationRate ?? "—"}%`],
          ["Member Since",      fmtDate(profile.memberSince)],
          ["Status",            profile.isActive ? "Active" : "Inactive"],
        ].map(([k, v]) => (
          <div key={k} style={{
            display: "flex", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid var(--bdr)",
          }}>
            <span style={{ fontSize: 12, color: "var(--txt2)", fontWeight: 600 }}>{k}</span>
            <span style={{ fontSize: 12, color: "var(--txt)", textAlign: "right" }}>{v || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}