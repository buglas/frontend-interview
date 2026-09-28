import { enuToLngLat } from "./scene";

function line(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function ring(coords: [number, number][]): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function ll(e: number, n: number): [number, number] {
  const p = enuToLngLat(e, n, 0);
  return [p.lng, p.lat];
}

/** 示意车道 / 路沿 / 路口，拓扑是 polyline，不是一张栅格贴图 */
export function buildHdMap() {
  const laneL = line([ll(-1.8, -25), ll(-1.8, 55), ll(-1.6, 78), ll(-1.6, 140)]);
  const laneC = line([ll(0, -25), ll(0, 55), ll(0.2, 78), ll(0.2, 140)]);
  const laneR = line([ll(1.8, -25), ll(1.8, 55), ll(2.0, 78), ll(2.0, 140)]);
  const curbL = line([ll(-7.4, -25), ll(-7.4, 140)]);
  const curbR = line([ll(7.4, -25), ll(7.4, 140)]);
  const stop = line([ll(-3.5, 52), ll(3.5, 52)]);
  const junction = ring([
    ll(-8, 48),
    ll(8, 48),
    ll(8, 72),
    ll(-8, 72),
    ll(-8, 48),
  ]);
  const crosswalk = ring([
    ll(-3.6, 53.2),
    ll(3.6, 53.2),
    ll(3.6, 57.4),
    ll(-3.6, 57.4),
    ll(-3.6, 53.2),
  ]);

  return {
    // 车道
    lanes: {
      type: "FeatureCollection" as const,
      features: [laneL, laneC, laneR],
    },
    // 路沿
    curbs: {
      type: "FeatureCollection" as const,
      features: [curbL, curbR],
    },
    // 停止线
    stop: { type: "FeatureCollection" as const, features: [stop] },
    // 路口
    junction: { type: "FeatureCollection" as const, features: [junction] },
    // 人行横道
    crosswalk: { type: "FeatureCollection" as const, features: [crosswalk] },
  };
}
