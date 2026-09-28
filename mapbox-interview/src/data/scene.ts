/** 上海闵行一带示意路口，非真实采集路段 
 * 原点是闵行示意路口 ORIGIN（约 121.40°E, 31.18°N, 8m）。
 * 输入 e/n/u 是相对这个点的东、北、上，单位米。
 * 输出是 WGS84 经纬高，单位°/m。
*/

export const ORIGIN = {
  lng: 121.4018,
  lat: 31.1752,
  alt: 8,
  label: "示意路口（闵行一带，非真实采集）",
};

// 1纬度 ≈ 111_320 m
const METERS_PER_DEG_LAT = 111_320;

// 1° 经度的米数=111320×cos(lat)
export function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export type LngLatAlt = { lng: number; lat: number; alt: number };
export type Enu = { e: number; n: number; u: number };

/*
enuToLngLat 把**车体/当地 ENU（米）**换成 MapLibre 能吃的 WGS84 经纬高。
原点是闵行示意路口 ORIGIN（约 121.40°E, 31.18°N, 8m）。
输入 e/n/u 是相对这个点的东、北、上，单位米。
输出是 WGS84 经纬高，单位°/m。
*/
export function enuToLngLat(e: number, n: number, u = 0): LngLatAlt {
  return {
    lng: ORIGIN.lng + e / metersPerDegLng(ORIGIN.lat),
    lat: ORIGIN.lat + n / METERS_PER_DEG_LAT,
    alt: ORIGIN.alt + u,
  };
}

export function lngLatToEnu(lng: number, lat: number, alt = ORIGIN.alt): Enu {
  return {
    e: (lng - ORIGIN.lng) * metersPerDegLng(ORIGIN.lat),
    n: (lat - ORIGIN.lat) * METERS_PER_DEG_LAT,
    u: alt - ORIGIN.alt,
  };
}

export function yawToBearing(yawRad: number): number {
  return (yawRad * 180) / Math.PI;
}
