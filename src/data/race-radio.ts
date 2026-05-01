// src/data/race-radio.ts
import type { RadioTemplate } from '@/types/radio'

/**
 * Authored radio template library.
 *
 * Grouped by category for readability. Eligibility rules:
 *  - `archetypes` empty/missing → generic, any driver eligible
 *  - `archetypes: ['hot-headed']` → only hot-headed drivers (or those whose
 *    secondary archetype matches)
 *  - `minFrustration` / `maxFrustration` gate by Mood.frustration (0-100)
 *
 * Tokens: {driver}, {opponent}, {gap}, {compound}, {lap}, {laps_remaining},
 * {position}, {turn}. Token resolution happens in radio-picker.ts.
 *
 * Invariant: every (category, speaker) pair the engine emits must have ≥1
 * eligible template; every archetype must have ≥5 eligible templates.
 * Enforced by tests/data/race-radio.test.ts.
 */
export const RADIO_TEMPLATES: readonly RadioTemplate[] = [
  // ─── box_box (engineer) ──────────────────────────────────────────────
  { category: 'box_box', speaker: 'engineer', text: 'Box, box, box this lap. {compound} ready.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Box this lap. Confirm box.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Pit window open. Box this lap, {driver}.', tone: 'calm' },
  { category: 'box_box', speaker: 'engineer', text: 'OK {driver}, box now. {compound} on.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Box, box. Target lap plus three.', tone: 'flat' },
  { category: 'box_box', speaker: 'engineer', text: 'Pit, pit, pit. {compound} fitted.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'Box this lap, {driver}. Box this lap.', tone: 'urgent' },
  { category: 'box_box', speaker: 'engineer', text: 'In the lane, in the lane. {compound} on the car.', tone: 'urgent' },

  // ─── pit_confirm (driver) ────────────────────────────────────────────
  { category: 'pit_confirm', speaker: 'driver', text: 'Copy, box this lap.', tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Pit confirm. {compound}.', tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Box confirm. Good call.', tone: 'calm' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Negative, negative, one more lap.', archetypes: ['hot-headed'], tone: 'angry' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Copy.', archetypes: ['calm-pro'], tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Yeah, OK, copy that, copy that, box, box.', archetypes: ['rookie'], tone: 'urgent' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Understood. Pitting now.', archetypes: ['spiritual'], tone: 'calm' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Yeah copy, in the lane.', archetypes: ['veteran'], tone: 'flat' },
  { category: 'pit_confirm', speaker: 'driver', text: 'OK, OK, pitting, pitting.', archetypes: ['emotional'], tone: 'urgent' },
  { category: 'pit_confirm', speaker: 'driver', text: 'Pit confirm, copy, copy.', archetypes: ['rookie'], tone: 'flat' },

  // ─── overtake_done (driver) ──────────────────────────────────────────
  { category: 'overtake_done', speaker: 'driver', text: 'Got him. {opponent} done.', tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Yes! Through on {opponent}!', tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Easy. Eaaasy.', archetypes: ['hot-headed'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Clean move. P{position} now.', archetypes: ['calm-pro'], tone: 'calm' },
  { category: 'overtake_done', speaker: 'driver', text: 'There we go. There we go.', archetypes: ['veteran'], tone: 'flat' },
  { category: 'overtake_done', speaker: 'driver', text: 'Yes! Yes! Yes!', archetypes: ['emotional'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Get in there! Get in there!', archetypes: ['spiritual'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Still we rise. P{position}.', archetypes: ['spiritual'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Yeah! Yeah! Got past him!', archetypes: ['rookie'], tone: 'celebrate' },
  { category: 'overtake_done', speaker: 'driver', text: 'Job done. Next one.', archetypes: ['veteran'], tone: 'flat' },
  { category: 'overtake_done', speaker: 'driver', text: 'Take that. P{position}.', archetypes: ['hot-headed'], tone: 'celebrate' },

  // ─── overtake_failed (driver) ────────────────────────────────────────
  { category: 'overtake_failed', speaker: 'driver', text: 'He got me. {opponent} through.', tone: 'flat' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Lost it. Lost the position.', archetypes: ['emotional'], tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'No grip, no grip on the rears.', archetypes: ['hot-headed'], minFrustration: 40, tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Couldn\'t hold him. P{position}.', archetypes: ['calm-pro'], tone: 'flat' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Damn it. Damn it.', archetypes: ['emotional'], minFrustration: 50, tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'He sent it from miles back.', archetypes: ['hot-headed'], minFrustration: 50, tone: 'angry' },
  { category: 'overtake_failed', speaker: 'driver', text: 'It is what it is. Reset.', archetypes: ['spiritual'], tone: 'calm' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Sorry, sorry, I lost it there.', archetypes: ['rookie'], tone: 'flat' },
  { category: 'overtake_failed', speaker: 'driver', text: 'Same old. Move on.', archetypes: ['veteran'], tone: 'flat' },

  // ─── tire_complaint (driver) ─────────────────────────────────────────
  { category: 'tire_complaint', speaker: 'driver', text: 'Front-left is graining badly.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Rears are completely gone.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'I cannot keep this pace, the tyres are falling off a cliff.', tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'These tyres are done. Done.', archetypes: ['hot-headed'], minFrustration: 50, tone: 'angry' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Tyres are struggling. Need to manage.', archetypes: ['calm-pro'], tone: 'calm' },
  { category: 'tire_complaint', speaker: 'driver', text: 'No more tyres. Nothing left.', archetypes: ['veteran'], tone: 'flat' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Mate, the tyres are dying on me.', archetypes: ['emotional'], minFrustration: 40, tone: 'angry' },
  { category: 'tire_complaint', speaker: 'driver', text: 'Tyres feel… not great, not great.', archetypes: ['rookie'], tone: 'urgent' },
  { category: 'tire_complaint', speaker: 'driver', text: 'I have nothing in these tyres.', archetypes: ['spiritual'], tone: 'flat' },

  // ─── push_now (engineer) ─────────────────────────────────────────────
  { category: 'push_now', speaker: 'engineer', text: 'Push now {driver}, push now. Five laps.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'Mode push, mode push. Free air ahead.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'You have {gap} to {opponent}. Build the gap.', tone: 'calm' },
  { category: 'push_now', speaker: 'engineer', text: 'Overtake mode on. Overtake mode on.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'Hammer time, {driver}. Hammer time.', tone: 'urgent' },
  { category: 'push_now', speaker: 'engineer', text: 'Three laps maximum push. Then we manage.', tone: 'calm' },
  { category: 'push_now', speaker: 'engineer', text: 'Open it up. {opponent} is {gap} behind.', tone: 'urgent' },

  // ─── manage_tires (engineer) ─────────────────────────────────────────
  { category: 'manage_tires', speaker: 'engineer', text: 'Target plus three. Manage the rears.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Lift and coast turns 4 and 11.', tone: 'flat' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Five laps in this stint, then we evaluate.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Hold position. Save the tyres.', tone: 'flat' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Tyre management mode. Plus four target.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Long stint plan. Look after the fronts.', tone: 'calm' },
  { category: 'manage_tires', speaker: 'engineer', text: 'Cruise mode, {driver}. Bring them home.', tone: 'flat' },

  // ─── investigation (fia) ─────────────────────────────────────────────
  { category: 'investigation', speaker: 'fia', text: 'Car {driver} under investigation, incident at turn {turn}.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'The stewards are reviewing an incident involving car {driver}.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'Note: incident at turn {turn} involving car {driver}, under investigation after the race.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'Stewards noted: car {driver}, turn {turn}. To be reviewed.', tone: 'flat' },
  { category: 'investigation', speaker: 'fia', text: 'Incident involving car {driver} at turn {turn} — under investigation.', tone: 'flat' },

  // ─── penalty_5s (fia) ────────────────────────────────────────────────
  { category: 'penalty_5s', speaker: 'fia', text: '5-second time penalty applied to car {driver}.', tone: 'flat' },
  { category: 'penalty_5s', speaker: 'fia', text: 'Car {driver}: 5-second penalty for the incident at turn {turn}.', tone: 'flat' },
  { category: 'penalty_5s', speaker: 'fia', text: 'Stewards: 5-second penalty for car {driver}, to be served at the next stop.', tone: 'flat' },
  { category: 'penalty_5s', speaker: 'fia', text: '5-second penalty, car {driver}, at turn {turn}.', tone: 'flat' },

  // ─── penalty_drive_through (fia) ─────────────────────────────────────
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Drive-through penalty for car {driver}.', tone: 'urgent' },
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Car {driver} must serve a drive-through penalty.', tone: 'urgent' },
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Stewards: drive-through for car {driver}. To be served within three laps.', tone: 'urgent' },
  { category: 'penalty_drive_through', speaker: 'fia', text: 'Drive-through, car {driver}. Drive-through.', tone: 'urgent' },

  // ─── safety_car_deploy (fia) ─────────────────────────────────────────
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Safety car deployed. Safety car deployed.', tone: 'urgent' },
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Yellow flags sector 2. Safety car on track.', tone: 'urgent' },
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Safety car, safety car. No overtaking.', tone: 'urgent' },
  { category: 'safety_car_deploy', speaker: 'fia', text: 'Race neutralised. Safety car deployed.', tone: 'urgent' },

  // ─── safety_car_in (fia) ─────────────────────────────────────────────
  { category: 'safety_car_in', speaker: 'fia', text: 'Safety car in this lap. Safety car in.', tone: 'urgent' },
  { category: 'safety_car_in', speaker: 'fia', text: 'Green flag conditions next lap.', tone: 'flat' },
  { category: 'safety_car_in', speaker: 'fia', text: 'Safety car in. Restart line is the start-finish.', tone: 'urgent' },
  { category: 'safety_car_in', speaker: 'fia', text: 'Pit lane closed signal lifted. Safety car in.', tone: 'flat' },

  // ─── rain_incoming (engineer) ────────────────────────────────────────
  { category: 'rain_incoming', speaker: 'engineer', text: 'Rain in {laps_remaining} laps. Intermediate window opens.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Light rain reported turns 8 and 9. Be careful.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Weather front incoming. Inters ready in the box.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Spots of rain, sector 2. {laps_remaining} laps until heavier.', tone: 'urgent' },
  { category: 'rain_incoming', speaker: 'engineer', text: 'Rain coming, {driver}. Rain coming. Manage entries.', tone: 'urgent' },

  // ─── fastest_lap (engineer) ──────────────────────────────────────────
  { category: 'fastest_lap', speaker: 'engineer', text: 'Fastest lap! Fastest lap of the race, {driver}.', tone: 'celebrate' },
  { category: 'fastest_lap', speaker: 'engineer', text: 'Purple sectors, purple sectors. Mighty lap.', tone: 'celebrate' },
  { category: 'fastest_lap', speaker: 'engineer', text: 'New benchmark, {driver}. New benchmark.', tone: 'celebrate' },
  { category: 'fastest_lap', speaker: 'engineer', text: 'Quickest lap of the race. Beautiful work.', tone: 'celebrate' },

  // ─── final_lap (engineer) ────────────────────────────────────────────
  { category: 'final_lap', speaker: 'engineer', text: 'This is the last lap. Bring it home.', tone: 'urgent' },
  { category: 'final_lap', speaker: 'engineer', text: 'Final lap. P{position}. Smooth, smooth.', tone: 'calm' },
  { category: 'final_lap', speaker: 'engineer', text: 'Last lap mate. P{position}.', tone: 'urgent' },
  { category: 'final_lap', speaker: 'engineer', text: 'White lines on the lap board. Bring it home, {driver}.', tone: 'calm' },
  { category: 'final_lap', speaker: 'engineer', text: 'Final tour, P{position}. Manage everything.', tone: 'calm' },

  // ─── lights_out (engineer) ───────────────────────────────────────────
  { category: 'lights_out', speaker: 'engineer', text: 'Lights out. Good luck, mate.', tone: 'calm' },
  { category: 'lights_out', speaker: 'engineer', text: 'And we are racing. Heads down.', tone: 'urgent' },
  { category: 'lights_out', speaker: 'engineer', text: 'Lights out and away we go.', tone: 'celebrate' },
  { category: 'lights_out', speaker: 'engineer', text: 'Green light. Race is on, {driver}.', tone: 'urgent' },
  { category: 'lights_out', speaker: 'engineer', text: 'Clean start, clean start. Eyes up.', tone: 'calm' },

  // ─── driver_frustration (driver) ─────────────────────────────────────
  { category: 'driver_frustration', speaker: 'driver', text: 'Leave me alone, I know what I\'m doing.', archetypes: ['hot-headed'], minFrustration: 60, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'I\'m doing the best I can, mate.', archetypes: ['emotional'], minFrustration: 50, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'This is not acceptable. Not acceptable.', archetypes: ['hot-headed'], minFrustration: 70, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'What is he doing. WHAT is he doing.', archetypes: ['emotional', 'hot-headed'], minFrustration: 60, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Same story every weekend.', archetypes: ['veteran'], minFrustration: 55, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Guys, the car is undriveable.', archetypes: ['emotional'], minFrustration: 60, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Need to focus. Just need to focus.', archetypes: ['spiritual'], minFrustration: 40, tone: 'flat' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Reset. Lap by lap.', archetypes: ['spiritual'], minFrustration: 30, tone: 'calm' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Sorry guys. Sorry. I\'ll get it back.', archetypes: ['rookie'], minFrustration: 40, tone: 'flat' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Mate, talk me through it. Talk me through it.', archetypes: ['rookie'], minFrustration: 50, tone: 'urgent' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Done with this. Done.', archetypes: ['veteran'], minFrustration: 65, tone: 'angry' },
  { category: 'driver_frustration', speaker: 'driver', text: 'Why are we doing this strategy?', archetypes: ['calm-pro'], minFrustration: 45, tone: 'flat' },

  // ─── box_opposite (engineer) ─────────────────────────────────────────
  { category: 'box_opposite', speaker: 'engineer', text: 'Box opposite. Box opposite. Cover {opponent}.', tone: 'urgent' },
  { category: 'box_opposite', speaker: 'engineer', text: '{opponent} pitted. We stay out, we stay out.', tone: 'calm' },
  { category: 'box_opposite', speaker: 'engineer', text: 'Opposite strategy to {opponent}. We commit.', tone: 'flat' },
  { category: 'box_opposite', speaker: 'engineer', text: '{opponent} in the pits. Track position is ours.', tone: 'calm' },

  // ─── stay_out (engineer) ─────────────────────────────────────────────
  { category: 'stay_out', speaker: 'engineer', text: 'Negative box, stay out, stay out.', tone: 'urgent' },
  { category: 'stay_out', speaker: 'engineer', text: 'We extend this stint. {laps_remaining} laps remaining.', tone: 'flat' },
  { category: 'stay_out', speaker: 'engineer', text: 'Stay out, stay out. Plan B.', tone: 'urgent' },
  { category: 'stay_out', speaker: 'engineer', text: 'Track is yours. {laps_remaining} more on these tyres.', tone: 'calm' },

  // ─── gap_call (engineer) — used for context lines, not a primary emit ─
  { category: 'gap_call', speaker: 'engineer', text: 'Gap to {opponent} {gap}.', tone: 'flat' },
  { category: 'gap_call', speaker: 'engineer', text: '{opponent} behind, {gap}, closing.', tone: 'urgent' },
  { category: 'gap_call', speaker: 'engineer', text: '{opponent} ahead {gap}. Steady.', tone: 'flat' },
  { category: 'gap_call', speaker: 'engineer', text: 'Gap stable, {gap} to {opponent}.', tone: 'calm' },
] as const
