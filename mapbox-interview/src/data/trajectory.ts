import { enuToLngLat } from "./scene";

export type PoseSample = {
  t: number;
  e: number;
  n: number;
  yaw: number;
};

/** 2Hz GNSS 示意采样，沿北向道路再过路口 */
export function gnssSamples(): PoseSample[] {
  const pts: PoseSample[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i * 0.5;
    const n = -8 + t * 7.2;
    const e = n > 55 ? (n - 55) * 0.04 : 0;
    const yaw = n > 55 ? 0.08 : 0;
    pts.push({ t, e, n, yaw });
  }
  return pts;
}

// 插值
export function interpolatePose(samples: PoseSample[], t: number): PoseSample {
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  let i = 1;
  while (i < samples.length && samples[i].t < t) i++;
  const a = samples[i - 1];
  const b = samples[i];
  const u = (t - a.t) / (b.t - a.t);
  return {
    t,
    e: a.e + (b.e - a.e) * u,
    n: a.n + (b.n - a.n) * u,
    yaw: a.yaw + (b.yaw - a.yaw) * u,
  };
}

// 按 Hz 采样
export function sampleAtHz(samples: PoseSample[], t: number, hz: number): PoseSample {
  const dt = 1 / hz;
  const snapped = Math.floor(t / dt) * dt; 
  return interpolatePose(samples, snapped);
}

// 轨迹线
export function trajectoryLine(samples: PoseSample[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: samples.map((p) => {
        const ll = enuToLngLat(p.e, p.n, 0);
        return [ll.lng, ll.lat];
      }),
    },
  };
}

export function poseToLngLat(p: PoseSample) {
  return enuToLngLat(p.e, p.n, 0);
}
