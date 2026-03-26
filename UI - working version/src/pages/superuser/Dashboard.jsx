// ======================== Dashboard Component ========================
// Dashboard Component -> Main analytics hub orchestrating data fetching, filtering, and sub-component rendering.
// ||
// ||
// ||
// Functions/Methods -> Dashboard() -> Main component execution
// ||                 |
// ||                 |---> handleRefresh() -> useCallback -> Reset date -> Trigger re-fetch
// ||                 |---> useEffect() -> Polling interval -> Auto-refresh every 30s
// ||                 |---> useEffect() -> Fetch agent & sankey data on filter change
// ||                 |---> handleAgentClick() -> Navigate -> Agent detail page
// ||                 |---> handleDownload() -> Export dashboard -> PDF or Excel
// ||                 |
// ||                 |---> Logic Flow -> Component render lifecycle:
// ||                                  |
// ||                                  |--- handleRefresh() -> Defined first (useCallback)
// ||                                  |--- useEffect() -> Polling -> setInterval 30s
// ||                                  |--- useEffect() -> Fetch /api/agents & /api/sankey
// ||                                  |--- IF loading is true
// ||                                  |    └── Return loading spinner UI
// ||                                  |--- IF error exists
// ||                                  |    └── Return error message UI
// ||                                  |--- ELSE
// ||                                  |    ├── Render Sidebar
// ||                                  |    ├── Render Header -> Pass filter states & actions
// ||                                  |    ├── Render Main Content -> Infographics, BubbleChart, SankeyChart, RiskPanel, KPIPanel
// ||                                  |    └── Render AIChatBox
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import {
  Header,
  Sidebar,
  Infographics,
  SankeyChart,
  RiskPanel,
  KPIPanel,
  BubbleChart,
} from "../../components/dashboard/fulldashboard";
import { AIChatBox } from "../../components/dashboard/AIChatBox";

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
export function Dashboard() {
  // ---------------------------------------------------------------
  // SECTION: STATE & HOOKS
  // ---------------------------------------------------------------
  const navigate = useNavigate();

  const [selectedTimeFilter, setSelectedTimeFilter] = useState("Daily");
  const [selectedDate,       setSelectedDate]       = useState(new Date().toISOString().split("T")[0]);
  const [selectedChannel,    setSelectedChannel]    = useState("All");
  const [selectedShift,      setSelectedShift]      = useState("All");
  const [dbAgents,           setDbAgents]           = useState([]);
  const [dbSankey,           setDbSankey]           = useState({ nodes: [], links: [] });
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);

  // ---------------------------------------------------------------
  // SECTION: EVENT HANDLERS
  // ---------------------------------------------------------------

  // handleRefresh -> Must be defined before useEffect that depends on it
  const handleRefresh = useCallback(() => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  }, []);

  // ---------------------------------------------------------------
  // SECTION: EFFECTS
  // ---------------------------------------------------------------

  // Polling -> Auto-refresh dashboard every 30 seconds
  useEffect(() => {
    const interval = setInterval(handleRefresh, 30000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Data fetch -> Re-runs on any filter change or date update from polling
  useEffect(() => {
    setLoading(true);

    const params = new URLSearchParams({
      period:  selectedTimeFilter,
      date:    selectedDate,
      channel: selectedChannel,
      shift:   selectedShift,
    }).toString();

    Promise.all([
      fetch(`/api/agents?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then((res) => {
        if (!res.ok) throw new Error(`Agents API failed: ${res.status}`);
        return res.json();
      }),
      fetch(`/api/sankey?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then((res) => {
        if (!res.ok) throw new Error(`Sankey API failed: ${res.status}`);
        return res.json();
      }),
    ])
      .then(([agentsData, sankeyData]) => {
        setDbAgents(agentsData || []);
        setDbSankey(sankeyData || { nodes: [], links: [] });
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ API Error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [selectedTimeFilter, selectedDate, selectedChannel, selectedShift]);

  // handleAgentClick -> Navigate to agent detail page
  const handleAgentClick = (agent) => {
    if (agent?.id) navigate(`/superuser/agent/${agent.id}`);
  };

  // handleDownload -> Export dashboard as PDF or Excel
  const handleDownload = async (format) => {
    const dashboard = document.getElementById("dashboard-content");
    if (!dashboard) return;

    if (format === "pdf") {
      const canvas    = await html2canvas(dashboard, { scale: 2, useCORS: true });
      const imgData   = canvas.toDataURL("image/png");
      const pdf       = new jsPDF("l", "mm", "a4");
      const imgWidth  = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`Intelligence-Report-${selectedDate}.pdf`);
    } else if (format === "excel") {
      const wb = XLSX.utils.book_new();
      const kpiData = [
        ["Metric", "Value"],
        ["Total Agents",      dbAgents.length],
        ["Avg CSAT",          (dbAgents.reduce((s, a) => s + (a.csat || 0), 0) / (dbAgents.length || 1)).toFixed(2)],
        ["Total Calls",       dbAgents.reduce((s, a) => s + (a.callsHandled || 0), 0)],
        ["Total Escalations", dbAgents.reduce((s, a) => s + (a.escalations || 0), 0)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), "KPIs");

      const agentData = [
        ["Name", "Risk Level", "CSAT", "Calls Handled", "Escalations", "Avg Latency (ms)", "Workload %"],
        ...dbAgents.map(a => [a.name, a.riskLevel, a.csat, a.callsHandled, a.escalations, a.avgLatency, a.workload]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agentData), "Agents");
      XLSX.writeFile(wb, `Call-Center-Data-${selectedDate}.xlsx`);
    }
  };

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-indigo-400 font-mono text-sm tracking-widest uppercase">
            Connecting to SQL Stream...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-rose-400 font-mono p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl max-w-lg text-center">
          <p className="text-lg font-bold mb-2">⚠ Backend Connection Failed</p>
          <p className="text-sm text-rose-300">{error}</p>
          <p className="text-xs text-slate-500 mt-4">
            Make sure backend is running on port 5000.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex h-screen overflow-hidden">
      {/* ── Main Sidebar ── */}
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top Header Controls ── */}
        <Header
          selectedTimeFilter={selectedTimeFilter} setSelectedTimeFilter={setSelectedTimeFilter}
          selectedDate={selectedDate}             setSelectedDate={setSelectedDate}
          selectedChannel={selectedChannel}       setSelectedChannel={setSelectedChannel}
          selectedShift={selectedShift}           setSelectedShift={setSelectedShift}
          onRefresh={handleRefresh}
          onDownload={handleDownload}
        />

        {/* ── Dashboard Content Area ── */}
        <main
          id="dashboard-content"
          className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
        >
          <Infographics />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <BubbleChart agents={dbAgents} onAgentClick={handleAgentClick} />
              <SankeyChart data={dbSankey} />
            </div>
            <div>
              <RiskPanel agents={dbAgents} onAgentClick={handleAgentClick} />
            </div>
          </div>
          <KPIPanel agents={dbAgents} />
        </main>

        {/* ── Floating Chat Overlay ── */}
        <AIChatBox />
      </div>
    </div>
  );
}

export default Dashboard;