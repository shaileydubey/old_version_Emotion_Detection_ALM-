// ======================== useAgentDashboard Hook ========================
// useAgentDashboard -> Custom hook managing all agent dashboard data fetching,
//                     filter state, polling, and chart readiness flag.
// ||
// ||
// ||
// Functions/Methods -> useAgentDashboard() -> Main hook execution
// ||                 |
// ||                 |---> apiFetch()  -> Reusable fetch helper with Bearer token
// ||                 |---> buildQS()  -> useCallback -> Build query string from active filters
// ||                 |---> loadAll()  -> useCallback -> Parallel fetch all 4 agent endpoints
// ||                 |---> useEffect() -> Trigger loadAll on filter/token change
// ||                 |---> useEffect() -> Polling -> Auto-refresh every 30s
// ||                 |
// ||                 |---> Logic Flow -> Hook execution:
// ||                                  |
// ||                                  |--- apiFetch()  -> GET url -> Attach Authorization header
// ||                                  |--- buildQS()   -> Append date_from, date_to, channel if set
// ||                                  |--- loadAll()
// ||                                  |    ├── setLoading(true) + setChartsReady(false)
// ||                                  |    ├── Promise.all -> profile, call-stats, calls, csat
// ||                                  |    ├── Set all state on success
// ||                                  |    ├── console.error on failure
// ||                                  |    └── setLoading(false) -> setTimeout 150ms -> setChartsReady(true)
// ||                                  |--- useEffect() -> loadAll() on mount + filter change
// ||                                  |--- useEffect() -> setInterval 30s -> clearInterval on unmount
// ||                                  |--- Return -> All state + setters + refresh exposed to consumer
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------
// SECTION: HELPERS
// ---------------------------------------------------------------

// apiFetch -> GET request with Bearer token header
const apiFetch = (url, token) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

// ---------------------------------------------------------------
// SECTION: MAIN HOOK
// ---------------------------------------------------------------
export default function useAgentDashboard() {

  // ---------------------------------------------------------------
  // SECTION: STATE & AUTH
  // ---------------------------------------------------------------
  const token   = localStorage.getItem("token");
  const userObj = JSON.parse(localStorage.getItem("user") || "{}");

  const [profile,     setProfile]     = useState(null);
  const [stats,       setStats]       = useState(null);
  const [calls,       setCalls]       = useState([]);
  const [csatData,    setCsatData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [dateRange,   setDateRange]   = useState({ from: null, to: null });
  const [channel,     setChannel]     = useState("all");
  const [chartsReady, setChartsReady] = useState(false);  // Delays chart render by 150ms

  // ---------------------------------------------------------------
  // SECTION: QUERY BUILDER
  // ---------------------------------------------------------------

  // buildQS -> Constructs query string from active filter state
  const buildQS = useCallback(() => {
    const p = new URLSearchParams();
    if (dateRange.from)    p.set("date_from", dateRange.from);
    if (dateRange.to)      p.set("date_to",   dateRange.to);
    if (channel !== "all") p.set("channel",   channel);
    return p.toString();
  }, [dateRange, channel]);

  // ---------------------------------------------------------------
  // SECTION: DATA FETCH
  // ---------------------------------------------------------------

  // loadAll -> Parallel fetch profile, stats, calls, csat -> Set all state
  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setChartsReady(false);
    const qs = buildQS();
    try {
      const [prof, st, cl, cs] = await Promise.all([
        apiFetch("/api/agent/profile",               token),
        apiFetch(`/api/agent/call-stats?${qs}`,      token),
        apiFetch(`/api/agent/calls?${qs}&limit=100`, token),
        apiFetch(`/api/agent/csat?${qs}`,            token),
      ]);
      setProfile(prof);
      setStats(st);
      setCalls(Array.isArray(cl) ? cl : []);  // Guard -> Fallback to empty array
      setCsatData(cs);
    } catch (e) {
      console.error("Agent dashboard load error:", e);
    } finally {
      setLoading(false);
      setTimeout(() => setChartsReady(true), 150);  // Delay -> Let DOM settle before charts render
    }
  }, [token, buildQS]);

  // ---------------------------------------------------------------
  // SECTION: EFFECTS
  // ---------------------------------------------------------------

  // Trigger -> Re-fetch on filter change or mount
  useEffect(() => { loadAll(); }, [loadAll]);

  // Polling -> Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);  // Cleanup -> Stop polling on unmount
  }, [loadAll]);

  // ---------------------------------------------------------------
  // SECTION: RETURN
  // ---------------------------------------------------------------
  return {
    token, userObj, profile, stats, calls, csatData,
    loading, chartsReady,
    dateRange, setDateRange,
    channel, setChannel,
    refresh: loadAll,
  };
}