// ======================== AgentDashboard ========================
// AgentDashboard -> Root page component for the agent dashboard. Orchestrates
//                  tab state, data fetching via hook, and sub-component rendering.
// ||
// ||
// ||
// Functions/Methods -> AgentDashboard() -> Main component
// ||                 | Loader()         -> Spinner UI shown while data is loading
// ||                 |
// ||                 |---> renderTab() -> Switch on activeTab -> Return correct tab component
// ||                 |
// ||                 |---> Logic Flow -> Component render:
// ||                                  |
// ||                                  |--- useState()         -> activeTab (default "overview")
// ||                                  |--- useAgentDashboard() -> Destructure all data + filter state
// ||                                  |--- renderTab()
// ||                                  |    ├── IF loading -> Return <Loader />
// ||                                  |    ├── "overview"  -> <OverviewTab  stats, calls, chartsReady />
// ||                                  |    ├── "calls"     -> <CallsTab     calls />
// ||                                  |    ├── "analytics" -> <AnalyticsTab stats, chartsReady />
// ||                                  |    ├── "settings"  -> <SettingsTab  profile />
// ||                                  |    └── default     -> null
// ||                                  |--- Render Sidebar  -> Pass activeTab + setActiveTab + profile + token
// ||                                  |--- Render Header   -> Pass profile, csatData, filters, stats, fmtDur
// ||                                  |--- Render <main>   -> Inject renderTab() output
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import GlobalStyles from "../../components/dashboard/GlobalStyles";
import useAgentDashboard from "../../hooks/useAgentDashboard";
import { fmtDur } from "../../utils/agentHelpers";
import Sidebar from "../../components/agentDashboard/Sidebar";
import Header  from "../../components/agentDashboard/Header";
import { OverviewTab, CallsTab, AnalyticsTab, SettingsTab } from "../../components/agentDashboard/Tabs";
import { useState } from "react";

// ---------------------------------------------------------------
// SECTION: LOADER
// ---------------------------------------------------------------

// Loader -> Spinner shown while dashboard data is fetching
function Loader() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{
        width: 28, height: 28,
        border: "2.5px solid var(--bdr2)",
        borderTopColor: "var(--pur)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 13, color: "var(--txt2)" }}>Loading dashboard…</span>
    </div>
  );
}

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
export default function AgentDashboard() {

  // ---------------------------------------------------------------
  // SECTION: STATE & HOOKS
  // ---------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("overview");  // Default -> overview tab

  const {
    token, profile, stats, calls, csatData,
    loading, chartsReady,
    dateRange, setDateRange,
    channel, setChannel,
  } = useAgentDashboard();

  // ---------------------------------------------------------------
  // SECTION: TAB RENDERER
  // ---------------------------------------------------------------

  // renderTab -> Returns correct tab component based on activeTab
  const renderTab = () => {
    if (loading) return <Loader />;  // Guard -> Show spinner until data is ready
    switch (activeTab) {
      case "overview":  return <OverviewTab  stats={stats}   calls={calls}   chartsReady={chartsReady} />;
      case "calls":     return <CallsTab     calls={calls} />;
      case "analytics": return <AnalyticsTab stats={stats}   chartsReady={chartsReady} />;
      case "settings":  return <SettingsTab  profile={profile} />;
      default:          return null;
    }
  };

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  return (
    <>
      <GlobalStyles />
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>

        {/* ── Sidebar -> Tab nav + profile + IVR card ── */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          profile={profile}
          token={token}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Header -> KPI row + filters + CSAT badge ── */}
          <Header
            activeTab={activeTab}
            profile={profile}
            csatData={csatData}
            dateRange={dateRange}
            setDateRange={setDateRange}
            channel={channel}
            setChannel={setChannel}
            stats={stats}
            fmtDur={fmtDur}
          />

          {/* ── Main -> Active tab content ── */}
          <main style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {renderTab()}
          </main>

        </div>
      </div>
    </>
  );
}