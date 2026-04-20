// Pre-race and post-race and start screens

function PreRaceView() {
  const g = window.RACE_DATA;
  const c = g.circuit;
  return (
    <div className="pre-wrap">
      <div className="pre-left">
        <div>
          <div className="pre-round">ROUND {c.round} / {c.totalRounds} · RACE WEEKEND</div>
          <div className="pre-name">{c.name.toUpperCase()}</div>
          <div className="pre-loc" style={{marginTop:"8px"}}>{c.country} · {c.length} KM · {c.laps} LAPS</div>
        </div>
        <div className="pre-stats">
          <div className="pre-stat"><div className="k">Lap Record</div><div className="v mono">{c.lapRecord}</div></div>
          <div className="pre-stat"><div className="k">Air</div><div className="v mono">{g.weather.air}<span className="u">°C</span></div></div>
          <div className="pre-stat"><div className="k">Track</div><div className="v mono">{g.weather.track}<span className="u">°C</span></div></div>
          <div className="pre-stat"><div className="k">Rain</div><div className="v mono">{g.weather.rainProb}<span className="u">%</span></div></div>
        </div>
        <div className="pre-cta">
          <button className="btn-primary">ENTER RACE <span className="arrow">→</span></button>
          <button className="btn-ghost">Run Practice</button>
          <button className="btn-ghost">Edit Strategy</button>
        </div>
      </div>

      <div className="pre-right">
        <div className="pre-drivers">
          {g.player.drivers.map(d => (
            <div key={d.code} className="pre-driver" style={{"--team": teamOf(g.player.teamId).color}}>
              <div className="pre-num">{String(d.num).padStart(2,"0")}</div>
              <div className="pre-driver-body">
                <div className="pre-driver-name">{d.name}</div>
                <div className="pre-driver-code">{d.code} · NOVARA RACING</div>
              </div>
              <div className="pre-grid">P{d.pos}<span className="sub">GRID</span></div>
            </div>
          ))}
        </div>
        <div className="pre-grid-strip">
          <div className="pre-grid-title">Starting Grid · Front 10</div>
          <div className="grid-positions">
            {g.timing.slice(0, 10).map(t => (
              <div key={t.code} className={`grid-slot ${t.status === "PLAYER" ? "is-player" : ""}`}
                style={{"--team": teamOf(t.team).color}}>
                <div className="gs-pos">P{t.pos}</div>
                <div className="gs-code">{t.code}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StartScreen() {
  const [lights, setLights] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => {
      setLights(l => (l >= 5 ? 0 : l + 1));
    }, 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="start-screen">
      <div className="start-box">
        <div className="start-flag">◉ RACE SESSION · LIGHTS OUT IMMINENT</div>
        <div className="start-title">GRAND PRIX</div>
        <div className="start-sub">MONTERRA · 57 LAPS · CLEAR</div>
        <div className="gantry">
          {Array.from({length: 5}, (_, i) => (
            <div key={i} className={`light ${i < lights ? "on" : ""}`}></div>
          ))}
        </div>
        <button className="btn-primary" style={{marginTop:"8px",fontSize:"16px",padding:"18px 32px"}}>
          START RACE SIMULATION <span className="arrow">→</span>
        </button>
        <div className="label label-dim" style={{marginTop:"4px"}}>
          Sim will advance at 1× · adjust speed from command bar once live
        </div>
      </div>
    </div>
  );
}

function PostRaceView() {
  const g = window.RACE_DATA;
  const podium = g.timing.slice(0, 3);
  const points = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return (
    <div className="post-wrap">
      <div>
        <div className="post-hero">
          <div className="post-flag">◆ CHEQUERED FLAG · ROUND 07</div>
          <div className="post-title">MONTERRA GRAND PRIX</div>
          <div className="label" style={{marginTop:"10px"}}>57 LAPS · 1H 28M 04.915 · WINNER V. STERN · NOVARA RACING</div>

          <div className="post-podium">
            {[podium[1], podium[0], podium[2]].map((t, i) => {
              const realPos = t.pos;
              const team = teamOf(t.team);
              return (
                <div key={t.code} className={`podium-slot p${realPos}`}
                  style={{"--team": team.color, marginTop: realPos === 1 ? "0" : realPos === 2 ? "18px" : "32px"}}>
                  <div className="podium-pos">{realPos}</div>
                  <div className="podium-name">{t.first} {t.last}</div>
                  <div className="podium-team">{team.name}</div>
                  <div className="podium-time mono">
                    {realPos === 1 ? "1:28:04.915" : realPos === 2 ? "+2.431" : "+6.019"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="post-table">
          <div className="post-table-row head">
            <div>POS</div><div>DRIVER · TEAM</div><div style={{textAlign:"right"}}>GAP</div><div style={{textAlign:"right"}}>POINTS</div>
          </div>
          {g.timing.slice(0, 10).map((t, i) => {
            const team = teamOf(t.team);
            return (
              <div key={t.code} className="post-table-row" style={{background: t.status === "PLAYER" ? "oklch(0.20 0.03 25 / 0.35)" : undefined}}>
                <div className="display" style={{fontSize:"16px",fontWeight:800,color: t.pos === 1 ? "var(--sig-red)" : "var(--ink-hi)"}}>{t.pos}</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"3px",height:"18px",background: team.color}}/>
                  <span className="display" style={{fontSize:"14px",color:"var(--ink-hi)",fontWeight:700}}>{t.last.toUpperCase()}</span>
                  <span style={{color:"var(--ink-dim)",fontSize:"10px",letterSpacing:"0.12em"}}>{t.team}</span>
                </div>
                <div style={{textAlign:"right",color:"var(--ink-body)"}}>{t.gap}</div>
                <div style={{textAlign:"right",color:"var(--sig-green)",fontWeight:700}}>+{points[i] || 0}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="post-side">
        <div className="post-card fastest-card">
          <h4>Fastest Lap</h4>
          <div className="fastest-time mono">1:18.402</div>
          <div className="fastest-name">V. STERN · #16</div>
          <div className="fastest-lap">SET ON LAP 28 · +1 POINT</div>
        </div>

        <div className="post-card">
          <h4>Player Summary</h4>
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            <div className="post-points-row"><span className="name">V. STERN (P1)</span><span className="pts">+26 PTS</span></div>
            <div className="post-points-row"><span className="name">S. RASK (P19)</span><span className="pts" style={{color:"var(--ink-dim)"}}>+0 PTS</span></div>
            <div className="post-points-row"><span className="name">Total Race</span><span className="pts">+26 PTS</span></div>
            <div className="post-points-row"><span className="name">Constructor Rank</span><span className="pts">↑ P3</span></div>
          </div>
        </div>

        <div className="post-card">
          <h4>Driver Of The Day</h4>
          <div className="display" style={{fontSize:"20px",color:"var(--ink-hi)",fontWeight:700}}>C. RUELA</div>
          <div className="label" style={{marginTop:"4px"}}>HALCYON · P13 FROM P18</div>
        </div>

        <div className="post-card">
          <h4>Next Round</h4>
          <div className="display" style={{fontSize:"18px",color:"var(--ink-hi)",fontWeight:700}}>IMOLA COAST</div>
          <div className="label" style={{marginTop:"4px"}}>R08 · IN 14 DAYS</div>
          <button className="btn-primary" style={{marginTop:"14px",width:"100%",justifyContent:"center",fontSize:"12px",padding:"12px"}}>
            RETURN TO PADDOCK <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PreRaceView, StartScreen, PostRaceView });
