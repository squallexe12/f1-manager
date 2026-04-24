window.FACTORY_DATA = {
  team: { name: "NOVARA RACING", color: "#E63946", round: 7, cap: 135, spent: 92.6 },
  car: {
    rating: 86,
    axes: [
      { k: "DOWNFORCE", v: 88 },
      { k: "POWER",     v: 81 },
      { k: "BRAKING",   v: 84 },
      { k: "TRACTION",  v: 90 },
      { k: "RELIABILITY", v: 79 },
      { k: "DRIVEABILITY", v: 86 },
    ],
  },
  pu: [
    { k: "ICE",         used: 3, limit: 4 },
    { k: "TURBO",       used: 3, limit: 4 },
    { k: "MGU-H",       used: 4, limit: 4 },
    { k: "MGU-K",       used: 2, limit: 4 },
    { k: "ERS BATTERY", used: 2, limit: 3 },
    { k: "GEARBOX",     used: 3, limit: 4 },
  ],
  aero: { wtUsed: 112, wtLimit: 240, cfdUsed: 1780, cfdLimit: 3200 },
  upgrades: {
    CHASSIS: [
      { id:"c1", name:"Front Wing v3",   status:"available",  desc:"Revised flap cascades for reduced turbulence and rebalanced rake behaviour.", delta:{ DOWNFORCE:+4, DRAG:-1 }, cost: 6.2, races: 3, prog: 0, td: true },
      { id:"c2", name:"Floor Upgrade",   status:"in-progress", desc:"New floor package with redesigned diffuser fences. Target +0.18s/lap.", delta:{ DOWNFORCE:+6, DRAG:+1 }, cost: 9.0, races: 4, prog: 62 },
      { id:"c3", name:"Sidepod Venturi", status:"queued",     desc:"Revised sidepod inlets to channel cleaner air toward rear suspension.", delta:{ DOWNFORCE:+3, COOLING:+2 }, cost: 7.4, races: 3, prog: 0 },
      { id:"c4", name:"Rear Wing",       status:"complete",   desc:"Low-drag spec commissioned for Baku, retained as a backup spec.", delta:{ DRAG:-3, TOP_SPEED:+2 }, cost: 5.0, races: 2, prog: 100 },
      { id:"c5", name:"Monocoque Retune", status:"locked",    desc:"Structural stiffness program. Requires sign-off from FIA crash re-test.", delta:{ DOWNFORCE:+3, WEIGHT:-1 }, cost: 18.0, races: 6, prog: 0 },
    ],
    "POWER UNIT": [
      { id:"p1", name:"PU Efficiency",  status:"available", desc:"Improved energy recovery software and calibration.", delta:{ ENERGY:+3, RELIABILITY:+1 }, cost: 4.6, races: 2, prog: 0 },
      { id:"p2", name:"Battery Topology", status:"queued",  desc:"Longer usable battery window through a revised layout.", delta:{ ENERGY:+4, WEIGHT:-1 }, cost: 7.8, races: 3, prog: 0 },
      { id:"p3", name:"Turbo Reshape", status:"available", desc:"Redesigned compressor housing — bench-tested +3kW peak.", delta:{ POWER:+3, HEAT:+1 }, cost: 5.4, races: 3, prog: 0 },
      { id:"p4", name:"ICE Friction",  status:"complete",  desc:"Coatings program complete — reliability trend up three rounds.", delta:{ RELIABILITY:+3, HEAT:-1 }, cost: 3.8, races: 2, prog: 100 },
      { id:"p5", name:"Adaptive Engine Map", status:"locked", desc:"Driver-selectable maps for quali + race unlocked after wind-tunnel pass.", delta:{ POWER:+2, DRIVEABILITY:+2 }, cost: 6.2, races: 3, prog: 0 },
    ],
    "ACTIVE AERO": [
      { id:"a1", name:"Straight Mode v2", status:"available", desc:"Refines our DRS-aero posture for DRS-dependent straight-line speed.", delta:{ TOP_SPEED:+4, DRAG:-2 }, cost: 6.8, races: 3, prog: 0 },
      { id:"a2", name:"S-Duct Rework",    status:"queued",    desc:"Redirects cockpit airflow to feed rear beam wing cleanly.", delta:{ DOWNFORCE:+2, DRAG:-1 }, cost: 5.2, races: 2, prog: 0 },
      { id:"a3", name:"Wing Stall Trigger", status:"queued",  desc:"Adaptive stall for corner-entry stability above 240 km/h.", delta:{ TOP_SPEED:+3, STABILITY:+2 }, cost: 6.4, races: 3, prog: 0 },
      { id:"a4", name:"DRS Flap Actuator",  status:"complete", desc:"Faster actuator cuts DRS activation delay by 42ms.", delta:{ TOP_SPEED:+1 }, cost: 2.8, races: 1, prog: 100 },
      { id:"a5", name:"Adaptive Plenum",    status:"locked",   desc:"Air-on-demand plenum — unlocks after Straight Mode v2 ships.", delta:{ POWER:+2, DRAG:-1 }, cost: 7.6, races: 4, prog: 0 },
    ],
  },
  queue: [
    { id:"c2", name:"Floor Upgrade",   branch:"CHASSIS",     eta: 3, pct: 62 },
    { id:"c3", name:"Sidepod Venturi", branch:"CHASSIS",     eta: 7, pct: 0 },
    { id:"p2", name:"Battery Topology", branch:"POWER UNIT", eta: 9, pct: 0 },
    { id:"a2", name:"S-Duct Rework",   branch:"ACTIVE AERO", eta: 11, pct: 0 },
  ],
};
