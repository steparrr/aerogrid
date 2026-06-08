import { describe, expect, it } from "vitest";

import { airportByIata } from "../data/indexes";
import {
  calculateBlockTime,
  calculateDistanceKm,
  projectToMap,
} from "./geography";

const fco = airportByIata.get("FCO")!;
const jfk = airportByIata.get("JFK")!;

describe("geography", () => {
  it("calculates a realistic and symmetric FCO-JFK distance", () => {
    const outbound = calculateDistanceKm(fco.coordinates, jfk.coordinates);
    const inbound = calculateDistanceKm(jfk.coordinates, fco.coordinates);

    expect(outbound).toBeGreaterThan(6_800);
    expect(outbound).toBeLessThan(7_100);
    expect(inbound).toBeCloseTo(outbound, 10);
    expect(calculateDistanceKm(fco.coordinates, fco.coordinates)).toBe(0);
  });

  it("calculates finite positive block times with a practical allowance", () => {
    const distanceKm = calculateDistanceKm(fco.coordinates, jfk.coordinates);
    const blockTimeHours = calculateBlockTime(distanceKm, 900);

    expect(blockTimeHours).toBeGreaterThan(distanceKm / 900);
    expect(blockTimeHours).toBeLessThan(distanceKm / 900 + 2);
    expect(Number.isFinite(blockTimeHours)).toBe(true);
  });

  it("projects coordinates to the expected equirectangular SVG positions", () => {
    expect(projectToMap({ lat: 90, lon: -180 })).toEqual({ x: 0, y: 0 });
    expect(projectToMap({ lat: 0, lon: 0 })).toEqual({ x: 500, y: 250 });
    expect(projectToMap({ lat: -90, lon: 180 })).toEqual({
      x: 1_000,
      y: 500,
    });
  });

  it("rejects invalid coordinates and block-time inputs", () => {
    expect(() =>
      calculateDistanceKm({ lat: Number.NaN, lon: 0 }, { lat: 0, lon: 0 }),
    ).toThrow(RangeError);
    expect(() => projectToMap({ lat: 91, lon: 0 })).toThrow(RangeError);
    expect(() => calculateBlockTime(-1, 900)).toThrow(RangeError);
    expect(() => calculateBlockTime(1_000, 0)).toThrow(RangeError);
  });

  it("keeps antipodal distances finite despite floating-point rounding", () => {
    const distance = calculateDistanceKm(
      { lat: 45, lon: 0 },
      { lat: -45, lon: 180 },
    );

    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThan(20_000);
  });
});
