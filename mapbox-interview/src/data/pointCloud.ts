import { lngLatAltToMercator } from "../map/mercator";
import { enuToLngLat } from "./scene";

export type CloudData = {
  count: number;
  mercator: Float32Array;
  color: Float32Array;
  enu: Float32Array;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function heightColor(u: number, out: Float32Array, i: number) {
  const t = Math.min(1, Math.max(0, (u + 0.2) / 10));
  out[i] = 0.15 + t * 0.85;
  out[i + 1] = 0.55 - t * 0.2;
  out[i + 2] = 0.95 - t * 0.7;
}

/** 沿北向走廊生成合成 LiDAR 点：地面、路沿、两侧立面、几辆车 */
export function generateCloud(count: number, seed = 20260829): CloudData {
  //mercator: Mercator 坐标系中的 x/y/z 值
  const mercator = new Float32Array(count * 3);
  //color: 颜色值
  const color = new Float32Array(count * 3);
  //enu: ENU 坐标系中的 x/y/z 值
  const enu = new Float32Array(count * 3);
  //rand: 随机数生成器
  const rand = mulberry32(seed);
  //vehicles: 车辆信息
  //e: 东向坐标,n: 北向坐标,l: 长度,w: 宽度,h: 高度
  const vehicles = [
    { e: 0.4, n: 18, l: 4.4, w: 1.8, h: 1.5 },
    { e: -3.2, n: 42, l: 4.6, w: 1.9, h: 1.6 },
    { e: 3.1, n: 70, l: 4.5, w: 1.8, h: 1.5 },
  ];
  // 遍历点云数据
  for (let i = 0; i < count; i++) {
    const roll = rand();
    let e = 0;
    let n = 0;
    let u = 0;
    if (roll < 0.62) {
      n = rand() * 160 - 20;
      e = (rand() - 0.5) * 14;
      u = (rand() - 0.5) * 0.12;
    } else if (roll < 0.78) {
      n = rand() * 160 - 20;
      e = (rand() > 0.5 ? 1 : -1) * (7.2 + rand() * 0.4);
      u = rand() * 0.35;
    } else if (roll < 0.93) {
      n = rand() * 160 - 20;
      e = (rand() > 0.5 ? 1 : -1) * (8.5 + rand() * 6);
      u = rand() * 12;
    } else {
      const v = vehicles[Math.floor(rand() * vehicles.length)];
      e = v.e + (rand() - 0.5) * v.w;
      n = v.n + (rand() - 0.5) * v.l;
      u = rand() * v.h;
    }
    enu[i * 3] = e;
    enu[i * 3 + 1] = n;
    enu[i * 3 + 2] = u;
    const ll = enuToLngLat(e, n, u);
    const m = lngLatAltToMercator(ll.lng, ll.lat, ll.alt);
    mercator[i * 3] = m.x;
    mercator[i * 3 + 1] = m.y;
    mercator[i * 3 + 2] = m.z;
    heightColor(u, color, i * 3);
  }

  return { count, mercator, color, enu };
}

export function cloudToGeoJSON(cloud: CloudData, maxPoints: number) {
  const n = Math.min(cloud.count, maxPoints);
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let i = 0; i < n; i++) {
    const ll = enuToLngLat(cloud.enu[i * 3], cloud.enu[i * 3 + 1], cloud.enu[i * 3 + 2]);
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [ll.lng, ll.lat] },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

export type GridIndex = Map<string, number[]>;

// 构建ENU网格
export function buildEnuGrid(cloud: CloudData, cell = 2): GridIndex {
  const grid: GridIndex = new Map();
  // 遍历点云数据
  for (let i = 0; i < cloud.count; i++) {
    // 获取ENU坐标
    const e = cloud.enu[i * 3];
    const n = cloud.enu[i * 3 + 1];
    const key = `${Math.floor(e / cell)}_${Math.floor(n / cell)}`;
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }
  return grid;
}

// 网格邻域拾取
// cloud: 点云数据
// grid: 网格索引
// e: 东向坐标
// n: 北向坐标
// radius: 半径
// cell: 网格单元大小
// 返回命中点索引和距离
export function pickNearest(
  cloud: CloudData,
  grid: GridIndex,
  e: number,
  n: number,
  radius: number,
  cell = 2,
): { index: number; dist: number } | null {
  // 计算半径的平方
  const r2 = radius * radius;
  // 初始化最佳索引和距离
  let best = -1;
  let bestD = r2;
  // 计算网格索引
  const c0 = Math.floor(e / cell);
  const r0 = Math.floor(n / cell);
  // 计算扫描范围
  const span = Math.ceil(radius / cell);
  // 遍历网格
  for (let ge = c0 - span; ge <= c0 + span; ge++) {
    for (let gn = r0 - span; gn <= r0 + span; gn++) {
      const bucket = grid.get(`${ge}_${gn}`);
      if (!bucket) continue;
      // 遍历网格桶
      for (const i of bucket) {
        // 计算距离
        const de = cloud.enu[i * 3] - e;
        const dn = cloud.enu[i * 3 + 1] - n;
        const d = de * de + dn * dn;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  if (best < 0) return null;
  return { index: best, dist: Math.sqrt(bestD) };
}
