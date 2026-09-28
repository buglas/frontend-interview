import type { Enu } from "./scene";

export const IMAGE_W = 1280;
export const IMAGE_H = 720;

// 焦距归一化的相机：外参（相机在世界里的位置朝向）+ 内参（针孔投影到像素)，焦距默认为1
// e: 东向距离
// n: 北向距离
// u: 高度
// yaw: 航向（绕上轴）
// pitch: 俯仰（绕右轴；右手系，正 = 抬头。实车前视常见 pitch < 0，略低头）
// roll: 侧倾（绕前轴；右手系，正 = 右侧下沉。实车接近 0）
// fx，fy: 一种缩放量
// cx: 中心点x坐标
// cy: 中心点y坐标
export const CAMERA = {
  e: 0,
  n: 0,
  u: 1.4,
  yaw: 0,
  pitch: 0,
  roll: 0,
  fx: 820,
  fy: 820,
  cx: IMAGE_W / 2,
  cy: IMAGE_H / 2,
};

export type CameraIntrinsics = typeof CAMERA;

/** 车体系：x 右、y 前、z 上。yaw=0 朝北。欧拉顺序 yaw → pitch → roll。 */
export function worldToCamera(p: Enu, cam: CameraIntrinsics) {
  const de = p.e - cam.e;
  const dn = p.n - cam.n;
  const du = p.u - cam.u;
  const cYaw = Math.cos(cam.yaw);
  const sYaw = Math.sin(cam.yaw);
  const x1 = cYaw * de - sYaw * dn;
  const y1 = sYaw * de + cYaw * dn;
  const z1 = du;
  const cPitch = Math.cos(cam.pitch);
  const sPitch = Math.sin(cam.pitch);
  const x2 = x1;
  const y2 = cPitch * y1 - sPitch * z1;
  const z2 = sPitch * y1 + cPitch * z1;
  const cRoll = Math.cos(cam.roll);
  const sRoll = Math.sin(cam.roll);
  const x = cRoll * x2 + sRoll * z2;
  const y = y2;
  const z = -sRoll * x2 + cRoll * z2;
  return { x, y, z };
}

export function projectToImage(
  p: Enu,
  cam: CameraIntrinsics = CAMERA,
): { u: number; v: number; depth: number } | null {
  // 将世界坐标转换为相机坐标
  const c = worldToCamera(p, cam);
  // 如果相机前方距离小于0.2,则返回null
  if (c.y < 0.2) return null;
  // 计算像素坐标，2D相机图像坐标
  const u = cam.fx * (c.x / c.y) + cam.cx;
  const v = cam.fy * (-c.z / c.y) + cam.cy;
  return { u, v, depth: c.y };
}

export type Box3 = {
  e: number;
  n: number;
  u: number;
  l: number;
  w: number;
  h: number;
  yaw: number;
};

/** 自车：中心在 ENU 原点，朝北，与 CAMERA 外参一致。 */
export const EGO_BOX: Box3 = {
  e: 0,
  n: 0,
  u: 0.75,
  l: 4.6,
  w: 1.9,
  h: 1.5,
  yaw: 0,
};

/** 周围他车。前三辆对齐 pointCloud 车辆簇，带轻微航向差。 
 * e: 东向距离
 * n: 北向距离
 * u: 高度
 * l: 长度
 * w: 宽度
 * h: 高度
 * yaw: 航向
*/
export const OTHER_VEHICLES: Box3[] = [
  { e: 0.4, n: 18, u: 0.8, l: 4.4, w: 1.8, h: 1.6, yaw: 0.06 },
  { e: -3.2, n: 42, u: 0.8, l: 4.6, w: 1.9, h: 1.6, yaw: -0.08 },
  { e: 3.1, n: 70, u: 0.75, l: 4.5, w: 1.8, h: 1.5, yaw: 0.1 },
  { e: -3.0, n: 28, u: 0.8, l: 4.5, w: 1.8, h: 1.55, yaw: -0.04 },
];

export const SAMPLE_BOX: Box3 = OTHER_VEHICLES[0];

// 框的顶点,它车在自车坐标系里的顶点位置
export function boxCorners(box: Box3): Enu[] {
  const hx = box.w / 2;
  const hy = box.l / 2;
  const hz = box.h / 2;
  const c = Math.cos(box.yaw);
  const s = Math.sin(box.yaw);
  //其它车的包围盒的8个顶点,基于其自身中心点的本地坐标系(x:右,y:前,z:上)
  const local = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ];
  // 将本地坐标转换为基于自车的坐标
  return local.map(([x, y, z]) => ({
    e: box.e + c * x - s * y,
    n: box.n + s * x + c * y,
    u: box.u + z,
  }));
}

/** 框的棱,12条棱 */
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

// 框的棱,12条棱,每条棱由两个顶点组成 
export function boxEdges(box: Box3): [Enu, Enu][] {
  const cs = boxCorners(box);
  return EDGES.map(([a, b]) => [cs[a], cs[b]]);
}

// 投影框的AABB
export function projectedAabb(box: Box3, cam: CameraIntrinsics = CAMERA) {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  let any = false;
  for (const p of boxCorners(box)) {
    const pix = projectToImage(p, cam);
    if (!pix) continue;
    any = true;
    minU = Math.min(minU, pix.u);
    minV = Math.min(minV, pix.v);
    maxU = Math.max(maxU, pix.u);
    maxV = Math.max(maxV, pix.v);
  }
  if (!any) return null;
  return { x1: minU, y1: minV, x2: maxU, y2: maxV };
}

/** 把 3D 框的 12 条棱投到2d相机图像上 */
export function drawProjectedBox(
  ctx: CanvasRenderingContext2D,
  box: Box3,
  cam: CameraIntrinsics = CAMERA,
  style: { color?: string; lineWidth?: number } = {},
) {
  ctx.save();
  ctx.strokeStyle = style.color ?? "#e3942b";
  ctx.lineWidth = style.lineWidth ?? 3;
  for (const [a, b] of boxEdges(box)) {
    const pa = projectToImage(a, cam);
    const pb = projectToImage(b, cam);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.u, pa.v);
    ctx.lineTo(pb.u, pb.v);
    ctx.stroke();
  }
  ctx.restore();
}

export type SyntheticCameraOpts = { decoys?: boolean };

// 绘制合成相机
export function drawSyntheticCamera(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t = 0,
  opts: SyntheticCameraOpts = {},
) {
  ctx.fillStyle = "#1a2430";
  ctx.fillRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  sky.addColorStop(0, "#243044");
  sky.addColorStop(1, "#1a2430");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.45);
  ctx.fillStyle = "#2a3340";
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h);
  ctx.lineTo(w * 0.45, h * 0.46);
  ctx.lineTo(w * 0.55, h * 0.46);
  ctx.lineTo(w * 0.95, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e8edf4";
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.48);
  ctx.lineTo(w * 0.5, h * 0.98);
  ctx.stroke();
  ctx.setLineDash([]);
  if (opts.decoys !== false) {
    const bounce = Math.sin(t * 1.7) * 8;
    ctx.fillStyle = "#3d8fd1";
    roundRect(ctx, w * 0.42, h * 0.52 + bounce, w * 0.16, h * 0.18, 6);
    ctx.fill();
    ctx.fillStyle = "#e3942b";
    roundRect(ctx, w * 0.58, h * 0.62, w * 0.14, h * 0.16, 6);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(8, 8, 220, 36);
  ctx.fillStyle = "#cfd6df";
  ctx.font = "13px sans-serif";
  ctx.fillText("合成前视相机  1280×720", 16, 32);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
