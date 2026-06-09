import type { NpcAirline } from "../domain/types";

const MIN_BIAS = 0.75;
const MAX_BIAS = 1.25;
const MAX_DAILY_CHANGE = 0.025;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hashString(value: string) {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function deterministicChange(key: string) {
  const unitValue = (hashString(key) % 10_001) / 10_000;
  return (unitValue * 2 - 1) * MAX_DAILY_CHANGE;
}

function normalizeBias(value: number) {
  return Number.isFinite(value) ? clamp(value, MIN_BIAS, MAX_BIAS) : 1;
}

function roundBias(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function processNpcDay(
  npcAirlines: readonly NpcAirline[],
  date: string,
): NpcAirline[] {
  return npcAirlines.map((airline) => ({
    ...airline,
    priceBias: roundBias(
      clamp(
        normalizeBias(airline.priceBias) +
          deterministicChange(`${date}:${airline.id}:price`),
        MIN_BIAS,
        MAX_BIAS,
      ),
    ),
    frequencyBias: roundBias(
      clamp(
        normalizeBias(airline.frequencyBias) +
          deterministicChange(`${date}:${airline.id}:frequency`),
        MIN_BIAS,
        MAX_BIAS,
      ),
    ),
  }));
}
