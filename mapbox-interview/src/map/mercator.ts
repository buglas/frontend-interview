/** Web Mercator 与 Mapbox `MercatorCoordinate` 同口径，可在 Worker 里用 */
// EARTH_CIRCUMFERENCE 地球周长，单位米
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;

export function mercatorXfromLng(lng: number): number {
  return (180 + lng) / 360;
}

export function mercatorYfromLat(lat: number): number {
  const y =
    (180 -
      (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) /
    360;
  return y;
}

export function mercatorZfromAltitude(altitude: number, lat: number): number {
  return (altitude / EARTH_CIRCUMFERENCE) * Math.cos((lat * Math.PI) / 180);
}

export function lngLatAltToMercator(
  lng: number,
  lat: number,
  alt = 0,
): { x: number; y: number; z: number } {
  return {
    x: mercatorXfromLng(lng),
    y: mercatorYfromLat(lat),
    z: mercatorZfromAltitude(alt, lat),
  };
}

export function meterInMercatorCoordinateUnits(lat: number): number {
  return Math.cos((lat * Math.PI) / 180) / EARTH_CIRCUMFERENCE;
}
