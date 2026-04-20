// Circuit map with animated car positions along the track path

const { useRef: useR2, useEffect: useE2, useState: useS2 } = React;

function CircuitMap({ lap, totalLaps, paused, speed }) {
  const g = window.RACE_DATA;
  const pathRef = useR2(null);
  const [positions, setPositions] = useS2(g.initialPositions);
  const rafRef = useR2();

  // Animate car positions — each car advances at different speed based on pos
  useE2(() => {
    if (paused) return;
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(50, t - last) / 1000;
      last = t;
      setPositions(prev => prev.map((p, i) => {
        // leaders slightly faster, degrading by position; add a little jitter
        const base = 0.008 * speed * (1 - i * 0.004);
        const j = (Math.sin(t / 1200 + i) + 1) * 0.0005;
        return (p + (base + j) * dt * 8) % 1;
      }));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, speed]);

  // Resolve positions along path
  const [coords, setCoords] = useS2([]);
  useE2(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    setCoords(positions.map(p => {
      const pt = path.getPointAtLength(p * len);
      return { x: pt.x, y: pt.y };
    }));
  }, [positions]);

  return (
    <div className="panel track">
      <div className="panel-head" style={{background:"transparent", borderBottom:"none", padding:"0 0 12px 0"}}>
        <div className="ph-title">◉ {g.circuit.name.toUpperCase()}</div>
        <div className="ph-sub">4.655 KM · {totalLaps} LAPS · LAP REC {g.circuit.lapRecord}</div>
      </div>
      <svg viewBox="0 0 800 400" className="track-svg">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Asphalt */}
        <path ref={pathRef} d={g.circuit.path} className="track-asphalt"/>
        {/* Racing line */}
        <path d={g.circuit.path} className="track-racing"/>
        {/* Sector 1 marker */}
        <path d="M 80 280 C 80 180, 140 120, 240 120 L 300 120"
              className="track-sector" stroke="var(--sig-red)"/>
        <path d="M 300 120 L 420 120 C 500 120, 540 160, 540 220 L 540 250"
              className="track-sector" stroke="var(--sig-amber)"/>
        <path d="M 540 250 C 540 290, 560 310, 600 310 L 680 310 C 720 310, 740 290, 740 250 L 740 200 C 740 160, 720 140, 680 140 L 620 140 C 600 140, 580 160, 580 180 L 580 200 C 580 220, 600 240, 620 240 L 660 240 C 680 240, 680 270, 660 280 L 220 320 C 140 330, 80 320, 80 280"
              className="track-sector" stroke="var(--sig-green)"/>
        {/* Start line */}
        <line x1="80" y1="270" x2="80" y2="300" className="track-start"/>
        <text x="60" y="260" className="track-turn-label">START</text>
        <text x="250" y="110" className="track-turn-label">T1</text>
        <text x="440" y="110" className="track-turn-label">T4</text>
        <text x="760" y="210" className="track-turn-label">T7</text>
        <text x="610" y="260" className="track-turn-label">T9</text>
        <text x="200" y="340" className="track-turn-label">T12</text>

        {/* DRS zone marker */}
        <path d="M 200 320 L 400 120" stroke="var(--sig-cyan)" strokeWidth="1" strokeDasharray="2 4" opacity="0.3" fill="none"/>

        {/* Cars */}
        {coords.map((c, i) => {
          if (!c) return null;
          const driver = g.timing[i];
          if (!driver) return null;
          const team = teamOf(driver.team);
          const isPlayer = driver.status === "PLAYER";
          return (
            <g key={i} style={{transition: "transform .2s linear"}}>
              <circle cx={c.x} cy={c.y} r={isPlayer ? 7 : 5}
                className={`car-dot ${isPlayer ? "player" : ""}`}
                style={{fill: team.color, "--team": team.color}}
                filter={isPlayer ? "url(#glow)" : undefined}/>
              {isPlayer && (
                <text x={c.x} y={c.y - 11} className="car-label">{driver.code}</text>
              )}
              {driver.pos <= 3 && !isPlayer && (
                <text x={c.x} y={c.y - 9} className="car-label" style={{fontSize:"7px",fill:"var(--ink-mute)"}}>{driver.code}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="track-legend">
        <span><span className="tl-swatch" style={{background:"var(--sig-red)"}}></span>Sector 1</span>
        <span><span className="tl-swatch" style={{background:"var(--sig-amber)"}}></span>Sector 2</span>
        <span><span className="tl-swatch" style={{background:"var(--sig-green)"}}></span>Sector 3</span>
        <span style={{marginLeft:"auto", color:"var(--sig-cyan)"}}>◆ DRS Zone 1</span>
        <span style={{color:"var(--sig-red)"}}>● Player Car</span>
      </div>
    </div>
  );
}

// Driver commands + tire strategy (main strategy panel)
function DriverCommand({ driver, onCmd, activeCmd }) {
  const team = teamOf(window.RACE_DATA.player.teamId);
  const wear = driver.wear;
  const compound = driver.tire;

  return (
    <div className="strategy-driver" style={{"--team": team.color}}>
      <div className="sd-head">
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div className="mono" style={{fontSize:"22px",fontWeight:800,color:"var(--ink-hi)",letterSpacing:"-0.04em"}}>#{driver.num}</div>
          <div>
            <div className="sd-name">{driver.name}</div>
            <div className="sd-pos">P{driver.pos} · {driver.mood}</div>
          </div>
        </div>
        <div className={`sd-tire ${compound}`}>{compound}</div>
      </div>

      <div className="sd-tire-stats">
        <div className="sd-tire-stat"><span className="k">Tyre Age</span><span className="v">{driver.tireAge} laps</span></div>
        <div className="sd-wear-bar"><div className="sd-wear-fill" style={{width: `${wear}%`}}/></div>
        <div className="sd-tire-stat"><span className="k">Wear</span><span className="v">{wear}%</span></div>
        <div className="sd-fuel-bar"><div className="sd-fuel-fill" style={{width: `${driver.fuel}%`}}/></div>
        <div className="sd-tire-stat"><span className="k">Fuel</span><span className="v">{driver.fuel}% · {(driver.fuel * 0.95).toFixed(1)}kg</span></div>
      </div>

      <div className="cmd-grid">
        <button className={`cmd-btn ${activeCmd === "ATTACK" ? "active attack" : ""}`} onClick={() => onCmd("ATTACK")}>Push</button>
        <button className={`cmd-btn ${activeCmd === "STANDARD" ? "active" : ""}`} onClick={() => onCmd("STANDARD")}>Standard</button>
        <button className={`cmd-btn ${activeCmd === "CONSERVE" ? "active conserve" : ""}`} onClick={() => onCmd("CONSERVE")}>Conserve</button>
        <button className={`cmd-btn ${activeCmd === "PIT" ? "active" : ""}`} onClick={() => onCmd("PIT")} style={{background:"var(--sig-amber)",color:"var(--bg-void)",borderColor:"var(--sig-amber)"}}>◉ Box</button>
      </div>

      <div className="radio-line">{driver.radio}</div>
    </div>
  );
}

function StrategyPanel() {
  const g = window.RACE_DATA;
  const [cmds, setCmds] = useS2({ [g.player.drivers[0].code]: "ATTACK", [g.player.drivers[1].code]: "STANDARD" });
  const [selectedPlan, setSelectedPlan] = useS2("PLAN A");

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="ph-title"><span className="ph-dot"></span>Driver Command</div>
          <div className="ph-sub">2 CARS</div>
        </div>
        <div className="strategy-grid">
          {g.player.drivers.map(d => (
            <DriverCommand key={d.code} driver={d}
              activeCmd={cmds[d.code]}
              onCmd={(c) => setCmds({...cmds, [d.code]: c})}/>
          ))}
        </div>
      </div>

      <div className="panel" style={{marginTop:"14px"}}>
        <div className="panel-head">
          <div className="ph-title">Strategy Options · {g.player.drivers[0].code}</div>
          <div className="ph-sub">PIT WINDOW L38–L45</div>
        </div>
        <div className="plan-list">
          {g.strategies.map(p => (
            <div key={p.name} className="plan" onClick={() => setSelectedPlan(p.name)}
              style={{background: selectedPlan === p.name ? "var(--bg-raised)" : undefined}}>
              <div className="plan-mark">
                {p.name.split(" ")[1]}
                <span className="plan-sub">{p.name.split(" ")[0]}</span>
              </div>
              <div className="plan-body">
                <div className="plan-head">
                  <span className="plan-pit">PIT L{p.pitLap}</span>
                  <span className={`plan-cpd ${p.compound}`}>{p.compound === "S" ? "SOFT" : p.compound === "M" ? "MEDIUM" : "HARD"}</span>
                </div>
                <div className="plan-note">{p.note}</div>
              </div>
              <div>
                <div className={`plan-delta ${p.delta < 0 ? "neg" : "pos"}`}>
                  {p.delta >= 0 ? "+" : ""}{p.delta.toFixed(1)}s
                </div>
                <span className="plan-risk">RISK {p.risk}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { CircuitMap, StrategyPanel });
