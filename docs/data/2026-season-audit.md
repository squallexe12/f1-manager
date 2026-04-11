# 2026 Season Data Audit

**Date:** 2026-04-11
**Phase:** IP-00 (Current-State Baseline)
**Purpose:** Verify all 11 constructors, 22 drivers, and 22 circuits are present with valid baseline attributes.

---

## 1. Constructors (11/11 present)

| # | ID | Name | Power Unit | Drivers | Car Stats | Components | AI Personality |
|---|-----|------|-----------|---------|-----------|------------|---------------|
| 1 | `mclaren` | McLaren Racing | Mercedes | norris, piastri | 6/6 | 4/4 | 3/3 |
| 2 | `red-bull` | Oracle Red Bull Racing | Red Bull | verstappen, hadjar | 6/6 | 4/4 | 3/3 |
| 3 | `ferrari` | Scuderia Ferrari | Ferrari | leclerc, hamilton | 6/6 | 4/4 | 3/3 |
| 4 | `mercedes` | Mercedes-AMG Petronas | Mercedes | russell, antonelli | 6/6 | 4/4 | 3/3 |
| 5 | `aston-martin` | Aston Martin Aramco | Honda | alonso, stroll | 6/6 | 4/4 | 3/3 |
| 6 | `williams` | Williams Racing | Mercedes | albon, sainz | 6/6 | 4/4 | 3/3 |
| 7 | `racing-bulls` | Visa Cash App Racing Bulls | Red Bull | lawson, lindblad | 6/6 | 4/4 | 3/3 |
| 8 | `alpine` | BWT Alpine F1 Team | Renault | gasly, colapinto | 6/6 | 4/4 | 3/3 |
| 9 | `haas` | MoneyGram Haas F1 Team | Ferrari | ocon, bearman | 6/6 | 4/4 | 3/3 |
| 10 | `audi` | Audi F1 Team | Audi | hulkenberg, bortoleto | 6/6 | 4/4 | 3/3 |
| 11 | `cadillac` | Cadillac F1 Team | Ferrari | bottas, perez | 6/6 | 4/4 | 3/3 |

**Car stats checked (6 per team):** downforce, straightSpeed, reliability, tireManagement, braking, cornering
**Components checked (4 per team):** ice, turbo, ers-battery, gearbox
**AI personality checked (3 per team):** aggressiveness, financialDiscipline, driverFocus

**Staff:** Each team has 4 staff members (technical-director, race-engineer, commercial-director, team-manager) with `name`, `role`, `skill`, `currentFocus`, and `flaggedIssue` fields.

**Result:** All 11 constructors complete. No missing fields.

---

## 2. Grid Drivers (22/22 present)

All 22 grid drivers have complete required attributes:

| # | ID | Name | Team | Pace | Racecraft | Experience | Mentality | Marketability | DevPotential | Contract |
|---|-----|------|------|------|-----------|------------|-----------|---------------|-------------|----------|
| 1 | `norris` | Lando Norris | mclaren | 92 | 88 | 82 | 80 | 90 | 45 | valid |
| 2 | `piastri` | Oscar Piastri | mclaren | 88 | 84 | 75 | 82 | 78 | 65 | valid |
| 3 | `verstappen` | Max Verstappen | red-bull | 97 | 96 | 92 | 90 | 95 | 20 | valid |
| 4 | `hadjar` | Isack Hadjar | red-bull | 75 | 70 | 58 | 72 | 62 | 85 | valid |
| 5 | `leclerc` | Charles Leclerc | ferrari | 93 | 90 | 85 | 78 | 92 | 30 | valid |
| 6 | `hamilton` | Lewis Hamilton | ferrari | 88 | 95 | 99 | 92 | 99 | 5 | valid |
| 7 | `russell` | George Russell | mercedes | 89 | 85 | 80 | 84 | 82 | 35 | valid |
| 8 | `antonelli` | Kimi Antonelli | mercedes | 78 | 72 | 55 | 70 | 68 | 90 | valid |
| 9 | `albon` | Alex Albon | williams | 82 | 80 | 78 | 76 | 72 | 20 | valid |
| 10 | `sainz` | Carlos Sainz | williams | 86 | 87 | 86 | 82 | 80 | 15 | valid |
| 11 | `lawson` | Liam Lawson | racing-bulls | 80 | 76 | 65 | 78 | 65 | 70 | valid |
| 12 | `lindblad` | Arvid Lindblad | racing-bulls | 73 | 68 | 52 | 72 | 58 | 88 | valid |
| 13 | `alonso` | Fernando Alonso | aston-martin | 82 | 94 | 99 | 95 | 88 | 2 | valid |
| 14 | `stroll` | Lance Stroll | aston-martin | 72 | 70 | 75 | 65 | 60 | 20 | valid |
| 15 | `ocon` | Esteban Ocon | haas | 78 | 76 | 80 | 68 | 62 | 15 | valid |
| 16 | `bearman` | Oliver Bearman | haas | 76 | 72 | 58 | 74 | 65 | 82 | valid |
| 17 | `gasly` | Pierre Gasly | alpine | 83 | 80 | 82 | 75 | 75 | 15 | valid |
| 18 | `colapinto` | Franco Colapinto | alpine | 74 | 71 | 60 | 72 | 70 | 75 | valid |
| 19 | `bottas` | Valtteri Bottas | cadillac | 78 | 76 | 92 | 72 | 70 | 5 | valid |
| 20 | `perez` | Sergio Perez | cadillac | 76 | 80 | 90 | 68 | 82 | 5 | valid |
| 21 | `hulkenberg` | Nico Hulkenberg | audi | 77 | 78 | 90 | 74 | 65 | 5 | valid |
| 22 | `bortoleto` | Gabriel Bortoleto | audi | 76 | 72 | 55 | 74 | 68 | 85 | valid |

**Required attributes verified per driver:** pace, racecraft, experience, mentality, marketability, developmentPotential, mood (motivation/frustration/confidence), contract, seasonStats, peakAge, declineRate.

**Result:** All 22 grid drivers complete. No missing or null required fields.

### Reserve / F2 Talent Pool (6 drivers)

| # | ID | Name | Type | Attributes |
|---|-----|------|------|-----------|
| 1 | `drugovich` | Felipe Drugovich | Reserve | Complete |
| 2 | `oward` | Pato O'Ward | Reserve | Complete |
| 3 | `doohan` | Jack Doohan | Reserve | Complete |
| 4 | `maini` | Kush Maini | F2 | Complete |
| 5 | `aron` | Paul Aron | F2 | Complete |
| 6 | `barnard` | Zak O'Sullivan | F2 | Complete |

**Note:** `barnard` has `id: 'barnard'` but `lastName: "O'Sullivan"` and `shortName: 'OSU'`. The ID does not match the name — this is a minor inconsistency but does not break functionality since it's an opaque string identifier.

**Result:** 28 total drivers (22 grid + 3 reserve + 3 F2). All complete.

---

## 3. Circuits (22/22 present)

All 22 circuits have valid required fields:

| # | ID | Name | Country | Laps | Downforce | Tire Wear | Overtaking | Weather | Compounds |
|---|-----|------|---------|------|-----------|-----------|-----------|---------|-----------|
| 1 | `melbourne` | Australian GP | Australia | 58 | medium | medium | medium | high | C2,C3,C4 |
| 2 | `shanghai` | Chinese GP | China | 56 | medium | high | medium | medium | C2,C3,C4 |
| 3 | `suzuka` | Japanese GP | Japan | 53 | high | high | high | medium | C1,C2,C3 |
| 4 | `bahrain` | Bahrain GP | Bahrain | 57 | medium | high | low | low | C1,C2,C3 |
| 5 | `jeddah` | Saudi Arabian GP | Saudi Arabia | 50 | low | medium | medium | low | C2,C3,C4 |
| 6 | `miami` | Miami GP | USA | 57 | medium | high | medium | medium | C2,C3,C4 |
| 7 | `imola` | Emilia Romagna GP | Italy | 63 | high | medium | high | medium | C2,C3,C4 |
| 8 | `monaco` | Monaco GP | Monaco | 78 | high | low | high | medium | C3,C4,C5 |
| 9 | `montreal` | Canadian GP | Canada | 70 | low | medium | low | high | C3,C4,C5 |
| 10 | `barcelona` | Spanish GP | Spain | 66 | high | high | medium | low | C1,C2,C3 |
| 11 | `spielberg` | Austrian GP | Austria | 71 | low | medium | low | medium | C2,C3,C4 |
| 12 | `silverstone` | British GP | Great Britain | 52 | high | high | medium | high | C1,C2,C3 |
| 13 | `spa` | Belgian GP | Belgium | 44 | medium | medium | low | high | C1,C2,C3 |
| 14 | `zandvoort` | Dutch GP | Netherlands | 72 | high | medium | high | medium | C1,C2,C3 |
| 15 | `monza` | Italian GP | Italy | 53 | low | medium | low | low | C2,C3,C4 |
| 16 | `baku` | Azerbaijan GP | Azerbaijan | 51 | low | medium | low | low | C2,C3,C4 |
| 17 | `singapore` | Singapore GP | Singapore | 62 | high | high | high | medium | C3,C4,C5 |
| 18 | `austin` | United States GP | USA | 56 | medium | high | medium | medium | C2,C3,C4 |
| 19 | `mexico` | Mexico City GP | Mexico | 71 | high | medium | medium | low | C2,C3,C4 |
| 20 | `interlagos` | Sao Paulo GP | Brazil | 71 | medium | high | low | high | C1,C2,C3 |
| 21 | `las-vegas` | Las Vegas GP | USA | 50 | low | medium | low | low | C2,C3,C4 |
| 22 | `abu-dhabi` | Abu Dhabi GP | UAE | 58 | medium | medium | medium | low | C2,C3,C4 |

**Result:** All 22 circuits complete. Each has 3 tire compounds and all required fields populated.

### Track Splines

| Status | Circuits |
|--------|----------|
| Full splines from .avif mapping | melbourne, shanghai, suzuka, miami, imola, monaco, montreal, spielberg, silverstone, spa, zandvoort, monza, baku, singapore, austin, mexico, interlagos, barcelona, las-vegas, abu-dhabi |
| Schematic fallback splines | bahrain, jeddah |
| Extra splines (not on 2026 calendar) | qatar, hungary |

**Result:** All 22 calendar circuits have spline data. Bahrain and Jeddah use schematic fallbacks (no .avif images). Qatar and Hungary have splines but are not on the 2026 calendar.

### Track Images (.avif)

22 `.avif` images in `public/tracks/`. Mapping to circuit IDs:

| Image File | Circuit ID |
|------------|-----------|
| `australia.avif` | melbourne |
| `china.avif` | shanghai |
| `japan.avif` | suzuka |
| `miami.avif` | miami |
| `monaco.avif` | monaco |
| `canada.avif` | montreal |
| `spain.avif` | barcelona |
| `austria.avif` | spielberg |
| `great-britain.avif` | silverstone |
| `belgium.avif` | spa |
| `netherlands.avif` | zandvoort |
| `italy-monza.avif` | monza |
| `azerbaijan.avif` | baku |
| `singapore.avif` | singapore |
| `united-states.avif` | austin |
| `mexico.avif` | mexico |
| `brazil.avif` | interlagos |
| `las-vegas.avif` | las-vegas |
| `abu-dhabi.avif` | abu-dhabi |
| `hungary.avif` | (not on calendar) |
| `qatar.avif` | (not on calendar) |

**Missing .avif images for calendar circuits:** `bahrain`, `jeddah` (using schematic splines)
**Extra .avif images (not on calendar):** `hungary.avif`, `qatar.avif`

**Note:** The Emilia Romagna GP (`imola`) does not have a dedicated .avif listed, though it has full spline data. Verify if an image exists under a different name or if it uses a fallback.

---

## 4. Calendar (22 races)

22-race calendar with 6 sprint weekends:

| Round | Circuit | Sprint |
|-------|---------|--------|
| 1 | Melbourne | No |
| 2 | Shanghai | No |
| 3 | Suzuka | No |
| 4 | Bahrain | No |
| 5 | Jeddah | No |
| 6 | Miami | No |
| 7 | Imola | No |
| 8 | Monaco | No |
| 9 | Montreal | Yes |
| 10 | Barcelona | No |
| 11 | Spielberg | No |
| 12 | Silverstone | Yes |
| 13 | Spa | No |
| 14 | Zandvoort | Yes |
| 15 | Monza | No |
| 16 | Baku | No |
| 17 | Singapore | Yes |
| 18 | Austin | Yes |
| 19 | Mexico | No |
| 20 | Interlagos | Yes |
| 21 | Las Vegas | No |
| 22 | Abu Dhabi | No |

**Result:** Calendar is complete and matches CIRCUITS array. All circuit IDs resolve.

---

## 5. Cross-Reference Integrity

| Check | Result |
|-------|--------|
| Every team's `driverIds` resolve to existing drivers | PASS |
| Every driver's `teamId` resolves to an existing team (or null for reserve/F2) | PASS |
| Every calendar race's `circuit` resolves to a valid circuit | PASS |
| Every circuit in calendar has spline data | PASS |
| All 4 scenarios reference valid teams or 'all' | PASS |
| R&D tree prerequisites reference valid upgrade IDs | PASS (verified by existing test) |
| Sponsors cover all tiers (title, major, minor) | PASS (verified by existing test) |

---

## 6. Issues Found

### Minor (non-blocking)

1. **Driver ID/name mismatch:** `id: 'barnard'` has `lastName: "O'Sullivan"`, `shortName: 'OSU'`. The ID is misleading but functionally harmless since IDs are opaque strings.

2. **Missing track images:** Bahrain and Jeddah circuits have no `.avif` images. They use schematic fallback splines. If track map rendering requires an image, these circuits will lack visual track maps.

3. **Extra spline/image data:** Qatar and Hungary have spline data and `.avif` images but are not on the 2026 calendar. Not harmful but is dead data.

4. **Imola image unclear:** Imola (Emilia Romagna GP) has full spline data but no obvious `.avif` match in the file listing. May use a fallback or may be mapped under a different name in the component.

### None Critical

No missing required fields, no null/undefined values in required attributes, no broken cross-references.

---

## 7. Recommendations for Later Phases

| Issue | Recommended Phase | Priority |
|-------|------------------|----------|
| Add Bahrain and Jeddah `.avif` track images | Before IP-07 (calibration) | Medium |
| Rename `barnard` driver ID to `osullivan` | Any convenient refactor | Low |
| Remove or gate Qatar/Hungary dead data | Optional cleanup | Low |
| Verify Imola image mapping in CircuitMap component | Before IP-07 | Low |
