// ======================== Superuser Overview Page ========================
// SuperuserPage Component -> Main landing page/portal for superuser accounts, providing navigation to other modules.
// ||
// ||
// ||
// Functions/Methods -> SuperuserPage() -> Main component execution
// ||                 |
// ||                 |---> handleLogout() -> Clear local storage and redirect to login
// ||                 |---> navigate() -> Route to different dashboard sections
// ||                 |
// ||                 |---> Logic Flow -> Component render lifecycle:
// ||                                  |
// ||                                  |--- Render GlobalStyles
// ||                                  |--- Render Layout Container (Flex row)
// ||                                  |    ├── Render Sidebar (Fixed left)
// ||                                  |    │   ├── Render Logo & Branding
// ||                                  |    │   ├── Render Superuser Badge
// ||                                  |    │   ├── Render Navigation Menu (Overview, Dashboard, Agents, Analytics)
// ||                                  |    │   └── Render Logout Button -> triggers handleLogout()
// ||                                  |    └── Render Main Content Area (Margin left)
// ||                                  |        ├── Render Header (Title & Description)
// ||                                  |        └── Render Quick Action Cards Grid
// ||                                  |            ├── Dashboard Card -> navigates to /superuser/dashboard
// ||                                  |            ├── Agents Card -> navigates to /superuser/agents
// ||                                  |            └── Analytics Card -> navigates to /superuser/analytics
// ||
// ======================================================================

// ---------------------------------------------------------------
// SECTION: IMPORTS
// ---------------------------------------------------------------
import GlobalStyles from "../components/dashboard/GlobalStyles";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------
// SECTION: MAIN COMPONENT / EXPORT
// ---------------------------------------------------------------
export default function SuperuserPage() {
  const navigate = useNavigate();

  // ---------------------------------------------------------------
  // SECTION: EVENT HANDLERS
  // ---------------------------------------------------------------
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // ---------------------------------------------------------------
  // SECTION: RENDER
  // ---------------------------------------------------------------
  return (
    <>
      <GlobalStyles />
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside style={{
          position: "fixed", left: 0, top: 0,
          height: "100vh", width: 240,
          background: "var(--bg2)",
          borderRight: "1px solid var(--bdr)",
          display: "flex", flexDirection: "column",
          zIndex: 100,
        }}>
          {/* Logo */}
          <div style={{ padding: "22px 18px 17px", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: "linear-gradient(135deg, var(--pur), var(--acc))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0,
              }}>
                SR
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: "var(--txt)" }}>
                SR<br />
                <span style={{ color: "var(--txt2)", fontWeight: 500 }}>Comsoft Ai</span>
              </span>
            </div>
          </div>

          {/* Superuser badge */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--bdr)" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "1px",
              textTransform: "uppercase", padding: "4px 12px", borderRadius: 20,
              background: "rgba(124,92,255,0.12)", color: "var(--pur2)",
              border: "1px solid var(--bdr2)",
            }}>
              Superuser
            </span>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "Overview",  icon: "◈", active: true  },
              { label: "Dashboard", icon: "⬡", active: false, action: () => navigate("/superuser/dashboard") },
              { label: "Agents",    icon: "◉", active: false, action: () => navigate("/superuser/agents") },
              { label: "Analytics", icon: "↗", active: false, action: () => navigate("/superuser/analytics") },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 9, width: "100%",
                  border: `1px solid ${item.active ? "var(--bdr2)" : "transparent"}`,
                  background: item.active ? "var(--purl)" : "transparent",
                  color: item.active ? "var(--pur2)" : "var(--txt2)",
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 13.5, fontWeight: 500,
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = "var(--purl)";
                    e.currentTarget.style.color = "var(--txt)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--txt2)";
                  }
                }}
              >
                <span style={{ width: 18, textAlign: "center", fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Sign out */}
          <div style={{ padding: "14px 10px", borderTop: "1px solid var(--bdr)" }}>
            <button
              onClick={handleLogout}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 9, width: "100%",
                border: "1px solid transparent",
                background: "transparent", color: "var(--red)",
                fontFamily: "'Syne', sans-serif",
                fontSize: 13.5, fontWeight: 500,
                cursor: "pointer", textAlign: "left",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,71,87,0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ width: 18, textAlign: "center", fontSize: 15 }}>⎋</span>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main style={{ marginLeft: 240, flex: 1, padding: "38px 44px" }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800 }}>Superuser Panel</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase", padding: "3px 10px", borderRadius: 20,
                background: "rgba(124,92,255,0.12)", color: "var(--pur2)",
                border: "1px solid var(--bdr2)",
              }}>
                Superuser
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--txt2)" }}>
              Team overview — monitor agents and performance.
            </p>
          </div>

          {/* Quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { icon: "⬡", title: "Go to Dashboard", desc: "Full 3D analytics dashboard", action: () => navigate("/superuser/dashboard") },
              { icon: "◉", title: "View Agents",      desc: "All agents allocated to your team", action: () => navigate("/superuser/agents") },
              { icon: "↗", title: "Call Analytics",   desc: "Deep dive into call data", action: () => navigate("/superuser/analytics") },
            ].map((card) => (
              <div
                key={card.title}
                onClick={card.action}
                style={{
                  background: "var(--card)", border: "1px solid var(--bdr)",
                  borderRadius: 16, padding: 24, cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--card-h)";
                  e.currentTarget.style.borderColor = "var(--bdr2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--card)";
                  e.currentTarget.style.borderColor = "var(--bdr)";
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: "var(--purl)", border: "1px solid var(--bdr2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, color: "var(--pur2)", marginBottom: 14,
                }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--txt)", marginBottom: 6 }}>{card.title}</p>
                <p style={{ fontSize: 13, color: "var(--txt2)" }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}