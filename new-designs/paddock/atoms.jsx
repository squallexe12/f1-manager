// Shared atoms & helpers

const { useState, useEffect, useMemo, useRef } = React;

function teamOf(teamId) {
  return window.RACE_DATA.teams.find(t => t.id === teamId) || { color: "#666", dark: "#222", name: "" };
}

// Small wordmark
function Mark() {
  return (
    <div className="brand">
      <div className="brand-mark">P</div>
      <div className="brand-text">
        <div className="b1">PITWALL / STRATEGY</div>
        <div className="b2">COMMAND · SEASON 26 · R07</div>
      </div>
    </div>
  );
}

// Flag / marquee ticker
function FlagStrip({ flag = "GREEN", weather }) {
  const tickerItems = [
    ["LAP", "34/57"],
    ["LEADER", "V. STERN · NV"],
    ["FASTEST", "1:18.402 (VSK)"],
    ["GAP", "+2.431 · CLOSING"],
    ["SC", "NO"],
    ["DRS", "ENABLED"],
    ["VSC", "DEPLOYED L23-24"],
    ["TYRES", "S · M · H AVAILABLE"],
    ["TRACK", "41°C · RISING"],
    ["WIND", "6 KM/H NE"],
    ["FUEL", "BALANCED"],
    ["PIT LANE", "OPEN"],
  ];
  const block = (
    <>
      {tickerItems.map(([k, v], i) => (
        <span key={i}><span className="tk-lap">{k}</span><span className="tk-dot"/>{v}</span>
      ))}
    </>
  );
  return (
    <div className="flag-strip">
      <div className={`flag-marker ${flag === "YELLOW" ? "yellow" : flag === "RED" ? "red" : ""}`}>
        {flag} FLAG
      </div>
      <div className="ticker">
        <div className="ticker-track">{block}{block}</div>
      </div>
      <div className="flag-right">
        <span className="fr-item"><span className="fr-k">AIR</span><span className="fr-v">{weather.air}°</span></span>
        <span className="fr-item"><span className="fr-k">TRK</span><span className="fr-v">{weather.track}°</span></span>
        <span className="fr-item"><span className="fr-k">RAIN</span><span className="fr-v">{weather.rainProb}%</span></span>
      </div>
    </div>
  );
}

// Sim speed control
function SimSpeed({ speed, setSpeed, paused, setPaused }) {
  const speeds = [1, 2, 5, 15];
  return (
    <>
      <button className={`sim-btn ${paused ? "danger" : ""}`} onClick={() => setPaused(!paused)}>
        {paused ? "▶ RESUME" : "❚❚ PAUSE"}
      </button>
      <div className="sim-group">
        {speeds.map(s => (
          <button key={s}
            className={`sim-btn ${s === speed ? "active" : ""}`}
            onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
    </>
  );
}

// Top bar (applies everywhere)
function TopBar({ speed, setSpeed, paused, setPaused }) {
  const g = window.RACE_DATA;
  return (
    <div className="topbar">
      <Mark/>
      <div className="topbar-center">
        <div className="stat"><div className="k">Race</div><div className="v">MONTERRA GP</div></div>
        <div className="stat"><div className="k">Phase</div><div className="v accent blink">LIVE</div></div>
        <div className="stat"><div className="k">Session</div><div className="v">RACE</div></div>
        <div className="stat"><div className="k">Budget</div><div className="v green">$112.4M</div></div>
        <div className="stat"><div className="k">WCC</div><div className="v">P3</div></div>
      </div>
      <div className="topbar-right">
        <SimSpeed speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused}/>
      </div>
    </div>
  );
}

window.TopBar = TopBar;
window.FlagStrip = FlagStrip;
window.teamOf = teamOf;
