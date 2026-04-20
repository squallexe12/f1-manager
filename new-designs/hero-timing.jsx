// Hero strip + timing tower + weather/battles

const { useState: useS1, useMemo: useM1 } = React;

// Hero strip — lap card + leader broadcast card + gap card
function HeroStrip({ lap, totalLaps }) {
  const g = window.RACE_DATA;
  const leader = g.timing[0];
  const second = g.timing[1];
  const team = teamOf(leader.team);
  const segs = Array.from({ length: totalLaps }, (_, i) => {
    if (i < lap - 1) return "done";
    if (i === lap - 1) return "now";
    return "";
  });
  return (
    <div className="hero">
      <div className="lap-card">
        <div className="label lap-k">Current Lap</div>
        <div className="lap-huge mono">
          <span>{String(lap).padStart(2, "0")}</span>
          <span className="of">/{totalLaps}</span>
        </div>
        <div className="lap-bar">
          {segs.map((s, i) => <div key={i} className={`lap-bar-seg ${s}`} />)}
        </div>
        <div className="lap-meta">
          <span>{lap} COMPLETED</span>
          <span>{totalLaps - lap} REMAINING</span>
        </div>
      </div>

      <div className="broadcast">
        <div className="broadcast-pos">1</div>
        <div className="broadcast-body">
          <div className="broadcast-name">
            <span className="broadcast-first">{leader.first}</span>
            <span className="broadcast-last">{leader.last.toUpperCase()}</span>
            <span className="broadcast-num mono">#{leader.num}</span>
          </div>
          <div className="broadcast-facts">
            <div><div className="bf-k">LAST</div><div className="bf-v mono">{leader.last1}</div></div>
            <div><div className="bf-k">BEST</div><div className="bf-v mono" style={{color:"var(--sig-purple)"}}>{leader.best}</div></div>
            <div><div className="bf-k">TYRE</div><div className="bf-v mono"><span className={`tr-tire-${leader.tire.toLowerCase()}`}>{leader.tire}</span> · {leader.stint}L</div></div>
            <div><div className="bf-k">PITS</div><div className="bf-v mono">{leader.pit}</div></div>
            <div><div className="bf-k">S1 / S2 / S3</div><div className="bf-v mono" style={{letterSpacing:"0.05em"}}>
              <span style={{color:"var(--sig-green)"}}>26.4</span> / <span style={{color:"var(--sig-purple)"}}>26.1</span> / <span style={{color:"var(--sig-amber)"}}>26.6</span>
            </div></div>
          </div>
        </div>
        <div className="broadcast-team-bar" style={{"--team-color": team.color, "--team-dark": team.dark, background: team.dark}}>
          <div className="bt-code" style={{color: team.color}}>{leader.team}</div>
          <div className="bt-label">{team.name}</div>
        </div>
      </div>

      <div className="gap-next">
        <div className="label gn-k">Gap to P2 · {second.code}</div>
        <div className="gn-v mono"><span className="sign">+</span>2.431<span className="suffix">s</span></div>
        <div className="gn-delta closing"><span className="gn-arrow">▼</span> CLOSING · −0.12 / LAP · CATCH L54</div>
      </div>
    </div>
  );
}

// Timing tower
function TimingTower({ timing }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="ph-title"><span className="ph-dot"></span>Live Timing</div>
        <div className="ph-sub">20 CARS · TRACK</div>
      </div>
      <div className="timing">
        {timing.map(t => {
          const team = teamOf(t.team);
          const isPurple = t.code === "VSK"; // leader's last is fastest-ish
          return (
            <div key={t.code} className={`timing-row ${t.status === "PLAYER" ? "is-player" : ""}`}>
              <div className={`tr-pos ${t.pos === 1 ? "leader" : ""}`}>{t.pos}</div>
              <div className="tr-team" style={{background: team.color, "--team": team.color}}></div>
              <div className="tr-code">{t.code}</div>
              <div className="tr-name-group">
                <div className="tr-last">{t.last1 === "—" ? "NO TIME" : t.last1}</div>
                <div className="tr-meta">
                  <span className={`tr-tire-${t.tire.toLowerCase()}`}>{t.tire}</span>
                  <span>·</span>
                  <span>L{t.stint}</span>
                  <span>·</span>
                  <span>{t.pit} STOP{t.pit !== 1 ? "S" : ""}</span>
                </div>
              </div>
              <div className={`tr-gap ${t.pos === 1 ? "leader" : ""} ${t.gap === "DNF" ? "dnf" : ""}`}>
                {t.gap}
              </div>
              <div className={`tr-lap ${isPurple && t.pos === 1 ? "purple" : ""}`}>{t.best}</div>
              <div className={`tr-status ${t.status === "PIT" ? "pit" : t.status === "DNF" ? "dnf" : ""}`}>
                {t.status === "PIT" ? "◉ PIT" : t.status === "DNF" ? "DNF" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Weather / conditions panel
function WeatherPanel() {
  const w = window.RACE_DATA.weather;
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="ph-title">Conditions</div>
        <div className="ph-sub">SECTOR · {w.condition.toUpperCase()}</div>
      </div>
      <div className="weather-grid">
        <div className="w-cell"><div className="k">Air Temp</div><div className="v mono">{w.air}<span className="u">°C</span></div></div>
        <div className="w-cell"><div className="k">Track Temp</div><div className="v mono" style={{color:"var(--sig-amber)"}}>{w.track}<span className="u">°C</span></div></div>
        <div className="w-cell"><div className="k">Humidity</div><div className="v mono">{w.humidity}<span className="u">%</span></div></div>
        <div className="w-cell"><div className="k">Wind</div><div className="v mono" style={{fontSize:"12px"}}>{w.wind}</div></div>
        <div className="w-cell"><div className="k">Rain Prob</div><div className="v mono">{w.rainProb}<span className="u">%</span></div></div>
        <div className="w-cell"><div className="k">Grip</div><div className="v mono" style={{color:"var(--sig-green)"}}>HIGH</div></div>
      </div>
    </div>
  );
}

// Battles mini-panel
function BattlesPanel() {
  const b = window.RACE_DATA.battles;
  const tmap = Object.fromEntries(window.RACE_DATA.timing.map(t => [t.code, t]));
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="ph-title">Battles</div>
        <div className="ph-sub">{b.length} ACTIVE</div>
      </div>
      <div className="battles">
        {b.map((bt, i) => {
          const lt = tmap[bt.leader], ct = tmap[bt.chaser];
          return (
            <div key={i} className="battle">
              <div className="battle-drv">
                <div className="battle-team" style={{background: teamOf(lt?.team).color}}/>
                <div className="battle-code">{bt.leader}</div>
                <div className="mono" style={{fontSize:"10px",color:"var(--ink-dim)"}}>P{lt?.pos}</div>
              </div>
              <div className="battle-gap">
                <div>{bt.gap.toFixed(2)}s</div>
                <div className={`bg-delta ${bt.status === "HOLDING" ? "growing" : ""}`}>
                  {bt.status === "CLOSING" ? `▼ ${bt.delta.toFixed(2)}/L` : "■ HOLDING"}
                </div>
              </div>
              <div className="battle-drv right">
                <div className="mono" style={{fontSize:"10px",color:"var(--ink-dim)"}}>P{ct?.pos}</div>
                <div className="battle-code">{bt.chaser}</div>
                <div className="battle-team" style={{background: teamOf(ct?.team).color}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Commentary feed
function FeedPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="ph-title"><span className="ph-dot"></span>Race Feed</div>
        <div className="ph-sub">LIVE · ENG</div>
      </div>
      <div className="feed">
        {window.RACE_DATA.commentary.map((c, i) => (
          <div key={i} className="feed-item">
            <div className="feed-lap"><span className="fl-pfx">L</span>{c.lap}</div>
            <div className={`feed-tag ${c.type}`}>{c.type}</div>
            <div className="feed-text">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { HeroStrip, TimingTower, WeatherPanel, BattlesPanel, FeedPanel });
