// ======================== Agents Directory Component ========================
// Agents Component -> Fetches, filters, and displays a sortable list of all deployed AI agents.
// ||
// ||
// ||
// Functions/Methods -> Agents() -> Main component execution
// ||                 |
// ||                 |---> fetch()           -> Retrieves agent list from backend API
// ||                 |---> filteredAgents()  -> Filters and sorts agent data based on state
// ||                 |---> getRiskColor()    -> Maps risk level to Tailwind color classes
// ||                 |---> getStatusColor()  -> Maps online status to Tailwind color classes
// ||                 |---> navigate()        -> Routes to specific agent detail page
// ||                 |
// ||                 |---> Logic Flow -> Component render lifecycle:
// ||                                  |
// ||                                  |--- useEffect() -> Fetch /api/agents on mount
// ||                                  |--- Compute filteredAgents -> Filter by searchTerm -> Sort by sortBy
// ||                                  |--- Render Header -> Search bar, sort dropdown, back button
// ||                                  |--- Render Main Table
// ||                                  |    ├── IF loading -> Show loading pulse
// ||                                  |    ├── IF error   -> Show error message
// ||                                  |    └── ELSE       -> Map filteredAgents -> Render table rows
// ||                                  |        └── onClick -> Navigate to /superuser/agent/:id
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
export function Agents() {

  // ---------------------------------------------------------------
  // SECTION: STATE & HOOKS
  // ---------------------------------------------------------------
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy,     setSortBy]     = useState("name");
  const [dbAgents,   setDbAgents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  // ---------------------------------------------------------------
  // SECTION: EFFECTS
  // ---------------------------------------------------------------

  // Fetch -> Load all agents scoped to superuser on mount
  useEffect(() => {
    fetch("/api/agents", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to connect to backend");
        return res.json();
      })
      .then(data => { setDbAgents(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  // ---------------------------------------------------------------
  // SECTION: DERIVED DATA
  // ---------------------------------------------------------------

  // filteredAgents -> Filter by searchTerm (name, status, riskLevel) then sort by sortBy
  const filteredAgents = dbAgents
    .filter(agent =>
      (agent.name && agent.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      "Active".toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.riskLevel && agent.riskLevel.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "name")  return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "csat")  return (b.csat || 0) - (a.csat || 0);
      if (sortBy === "calls") return (b.callsHandled || 0) - (a.callsHandled || 0);
      return 0;
    });

  // ---------------------------------------------------------------
  // SECTION: HELPERS
  // ---------------------------------------------------------------

  // getRiskColor -> Tailwind classes for risk level badge
  const getRiskColor = (risk) => {
    const r = (risk || "Low").toLowerCase();
    if (r === "high")   return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (r === "medium") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  // getStatusColor -> Tailwind text color for agent status
  const getStatusColor = (status) => {
    switch (status) {
      case "Active":   return "text-emerald-400";
      case "On Break": return "text-amber-400";
      case "Offline":  return "text-slate-400";
      default:         return "text-emerald-400";
    }
  };

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#020617]">

      {/* ── Header -> Search + sort controls + back button ── */}
      <header className="glass-panel px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">

            {/* Back -> Navigate to superuser dashboard */}
            <button
              onClick={() => navigate("/superuser/dashboard")}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold brand-text-gradient">All Allotted Agents</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Search -> Filters by name, status, riskLevel */}
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />
            {/* Sort -> Controls filteredAgents sort order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="name">Sort by Name</option>
              <option value="csat">Sort by CSAT</option>
              <option value="calls">Sort by Calls</option>
            </select>
          </div>
        </div>
      </header>

      {/* ── Main Content -> Agent table ── */}
      <main className="p-6">
        <div className="glass-panel rounded-xl overflow-hidden">

          {/* Loading -> Pulse while fetching */}
          {loading && (
            <div className="p-10 text-center text-indigo-400 animate-pulse font-mono uppercase tracking-widest text-sm">
              Fetching Agent Nodes...
            </div>
          )}

          {/* Error -> Show message if fetch failed */}
          {error && (
            <div className="p-10 text-center text-rose-400 font-mono text-sm">
              ⚠️ Error: {error}. Check if Flask backend is running.
            </div>
          )}

          {!loading && !error && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  {["Agent Name", "Status", "Skill Level", "Risk Level", "Model", "CSAT", "Calls", "Actions"].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length > 0 ? filteredAgents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/superuser/agent/${agent.id}`)}  // Row click -> agent detail
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar -> First 2 chars of name */}
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-400">
                            {agent.name ? agent.name.substring(0, 2).toUpperCase() : "AI"}
                          </span>
                        </div>
                        <span className="font-medium text-white">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${getStatusColor("Active")}`}>Active</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">{agent.skillLevel || "N/A"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {/* Risk badge -> Color from getRiskColor() */}
                      <span className={`px-2 py-1 text-xs rounded-full border ${getRiskColor(agent.riskLevel)}`}>
                        {agent.riskLevel || "Low"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">{agent.model || "Unknown"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-white">{agent.csat}/5</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">{agent.callsHandled}</span>
                    </td>
                    <td className="px-6 py-4">
                      {/* stopPropagation -> Prevent row click firing twice */}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/superuser/agent/${agent.id}`); }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                )) : (
                  // Empty state -> No agents match search/filter
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500 text-sm">
                      No agents found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

export default Agents;