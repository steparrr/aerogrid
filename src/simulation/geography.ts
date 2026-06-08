import type { Coordinates } from "../domain/types";

const EARTH_RADIUS_KM = 6_371;
const BLOCK_TIME_ALLOWANCE_HOURS = 0.75;

function assertCoordinates({ lat, lon }: Coordinates) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new RangeError("Coordinates must contain valid latitude and longitude");
  }
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function calculateDistanceKm(
  origin: Coordinates,
  destination: Coordinates,
) {
  assertCoordinates(origin);
  assertCoordinates(destination);

  const latitudeDelta = toRadians(destination.lat - origin.lat);
  const longitudeDelta = toRadians(destination.lon - origin.lon);
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const normalizedHaversine = Math.min(1, Math.max(0, haversine));

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(normalizedHaversine));
}

export function calculateBlockTime(distanceKm: number, cruiseSpeedKmh: number) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0 ||
    !Number.isFinite(cruiseSpeedKmh) ||
    cruiseSpeedKmh <= 0
  ) {
    throw new RangeError("Distance and cruise speed must be finite and valid");
  }

  return distanceKm / cruiseSpeedKmh + BLOCK_TIME_ALLOWANCE_HOURS;
}

export function projectToMap(coordinates: Coordinates) {
  assertCoordinates(coordinates);

  return {
    x: ((coordinates.lon + 180) / 360) * 1_000,
    y: ((90 - coordinates.lat) / 180) * 500,
  };
}
