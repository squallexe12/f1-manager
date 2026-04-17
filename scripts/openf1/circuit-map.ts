// ---------------------------------------------------------------------------
// Circuit name mapping — OpenF1 uses circuit_short_name (e.g. "Sakhir"); our
// static data uses short IDs (e.g. "bahrain"). This table is the single
// source of truth for that translation.
// ---------------------------------------------------------------------------

export const OPENF1_CIRCUIT_MAP: Record<string, string> = {
  sakhir: 'bahrain',
  jeddah: 'jeddah',
  melbourne: 'melbourne',
  suzuka: 'suzuka',
  shanghai: 'shanghai',
  miami: 'miami',
  imola: 'imola',
  monaco: 'monaco',
  montreal: 'montreal',
  barcelona: 'barcelona',
  spielberg: 'spielberg',
  'red bull ring': 'spielberg',
  silverstone: 'silverstone',
  'spa-francorchamps': 'spa',
  spa: 'spa',
  zandvoort: 'zandvoort',
  monza: 'monza',
  baku: 'baku',
  singapore: 'singapore',
  austin: 'austin',
  'mexico city': 'mexico',
  mexico: 'mexico',
  interlagos: 'interlagos',
  'sao paulo': 'interlagos',
  'las vegas': 'las-vegas',
  lusail: 'losail',
  losail: 'losail',
  'yas marina': 'yas-marina',
  abu_dhabi: 'yas-marina',
}

export function mapOpenF1CircuitName(name: string): string | null {
  if (!name) return null
  const key = name.toLowerCase().trim()
  return OPENF1_CIRCUIT_MAP[key] ?? null
}
