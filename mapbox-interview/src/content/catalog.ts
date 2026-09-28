export type GroupId = "A" | "B" | "C" | "D" | "E" | "F";

export interface Question {
  id: string;
  group: GroupId;
  title: string;
  hasDemo: boolean;
  summary: string;
  points: string[];
  code?: string;
}

export const GROUP_LABEL: Record<GroupId, string> = {
  A: "A 坐标系与图层选型",
  B: "B 2D 图像标注",
  C: "C 3D 点云标注",
  D: "D BEV 与轨迹",
  E: "E 高精地图",
  F: "F 海量性能",
};

export const QUESTIONS: Question[] = [
  {
    id: "A1",
    group: "A",
    title: "车体 / 相机 / LiDAR / Mercator",
    hasDemo: true,
    summary:
      "30 秒：标注平台至少四套坐标——图像像素、相机/LiDAR 车体 ENU、WGS84 经纬、Web Mercator。外参是刚体变换，内参才进像素；上地图还要 fromLngLat。",
    points: [
      "ENU 东/北/上是米，不能当经纬度",
      "MercatorCoordinate 的 x/y 在 0–1，z 是相对地球周长的高度",
      "Custom Layer 顶点必须是 Mercator，不是 lng/lat",
      "翻车：投影东坐标 365000 塞进 setLngLat",
    ],
    code: `const ll = enuToLngLat(20, 5, 0);
const m = maplibregl.MercatorCoordinate.fromLngLat(
  [ll.lng, ll.lat],
  ll.alt,
);
// Custom Layer: gl_Position = u_matrix * vec4(m.x, m.y, m.z, 1.0);`,
  },
  {
    id: "A2",
    group: "A",
    title: "Canvas vs GeoJSON vs Custom Layer",
    hasDemo: true,
    summary:
      "30 秒：图像标注走 Canvas；几十条车道/轨迹走 GeoJSON layer；海量点云必须 Custom Layer + TypedArray。选型看基数，不看「会不会 3D」。",
    points: [
      "GeoJSON Point 每点一个 Feature，序列化/布局都会炸",
      "Custom Layer 和底图共享 WebGL 与相机矩阵",
      "2D 框不要画进地图，坐标系都对不上",
      "翻车：用 addSource 灌百万点",
    ],
    code: `map.addLayer({ type: "line", source: "lanes" }); // 车道 OK
map.addLayer(createPointCloudLayer({ mercator, color, count })); // 点云`,
  },
  {
    id: "B1",
    group: "B",
    title: "框 / 多边形 + hit-test",
    hasDemo: true,
    summary:
      "30 秒：几何存在图像坐标系。按下拖出框，点击做点在矩形/多边形内测试。命中用几何，不要用 DOM 叠一堆 div。",
    points: [
      "图像像素 ≠ CSS 像素（还有 object-fit 留白）",
      "框存 x1,y1,x2,y2；多边形存顶点数组",
      "先粗包围盒再精确包含，标注数量上千才需要空间索引",
      "翻车：把 canvas 鼠标坐标直接当标注",
    ],
    code: `const img = screenToImage(fit, mx, my);
boxes.push({ x1, y1, x2, y2 }); // 图像像素
hit = boxes.find(b => insideRect(img, b));`,
  },
  {
    id: "B2",
    group: "B",
    title: "缩放平移后坐标怎么存",
    hasDemo: true,
    summary:
      "30 秒：存原图像素或归一化 0–1。显示 = viewMatrix × 图像坐标。缩放只改视图，不改标注数据。",
    points: [
      "view：scale / pan，和标注数据分离",
      "归一化方便换分辨率；像素方便对标定规范",
      "翻车：把屏幕坐标存进 JSON，一缩放框就飞",
    ],
    code: `screen = image * scale + pan;
stored = { x: imgX / IMAGE_W, y: imgY / IMAGE_H };`,
  },
  {
    id: "C1",
    group: "C",
    title: "TypedArray 点云 Custom Layer",
    hasDemo: true,
    summary:
      "30 秒：LiDAR 是 Float32Array 的 xyz(+intensity)。MapLibre 里写成 CustomLayerInterface，gl.POINTS，禁止逐点 Mesh，禁止 GeoJSON。",
    points: [
      "顶点必须是 Mercator xyz",
      "color / intensity 同期 TypedArray",
      "renderingMode: '3d' 高度才有效",
      "切题 map.remove()，否则 WebGL 上下文泄漏",
    ],
    code: `render(gl, matrix) {
  gl.uniformMatrix4fv(u_matrix, false, matrix);
  gl.drawArrays(gl.POINTS, 0, count);
}`,
  },
  {
    id: "C2",
    group: "C",
    title: "3D 框与图像对齐",
    hasDemo: true,
    summary:
      "30 秒：3D 框活在车体/地图坐标。投到相机 = K[R|t]X。12 条棱两端都投成功就连成线框；AABB 只是角点 min/max。自车在相机后方，不投前视。对不齐先查外参和时间戳，再查内参。",
    points: [
      "同一时刻、同一坐标系，才能投得上",
      "深度 < 0 的角点/棱要丢弃或裁剪",
      "线框是投影后的 12 条线段，不是屏幕上的轴对齐矩形",
      "翻车：用屏幕框反推 3D 却忘了尺度（深度）",
    ],
    code: `u = fx * (x / y) + cx; // y 为前向深度
v = fy * (-z / y) + cy;
for (const [a, b] of boxEdges(box)) {
  const pa = projectToImage(a), pb = projectToImage(b);
  if (pa && pb) line(pa, pb); // 12 条棱 → 像素线框
}`,
  },
  {
    id: "C3",
    group: "C",
    title: "点云拾取",
    hasDemo: true,
    summary:
      "30 秒：不要 CPU 扫全部点。屏幕点击 → 经纬 → ENU，再用网格/八叉树只搜邻域。GPU id buffer 是进阶，面试说到网格即可过关。",
    points: [
      "queryRenderedFeatures 对 Custom Layer 的点无效",
      "半径用米，不要用像素当世界距离",
      "翻车：for 循环 50 万点做拾取",
    ],
    code: `const { e, n } = lngLatToEnu(lng, lat);
const hit = pickNearest(cloud, grid, e, n, 1.5);`,
  },
  {
    id: "D1",
    group: "D",
    title: "BEV：pitch=0 跟随自车",
    hasDemo: true,
    summary:
      "30 秒：BEV 是俯视相机，不是把 3D 压扁。MapLibre 里 setPitch(0)、锁定 bearing=航向、跟车 setCenter。正交感靠高 zoom + 低 pitch。",
    points: [
      "pitch=0 是俯视，60° 是透视街景",
      "跟随用 jumpTo/easeTo duration 0，不要每帧 new Map",
      "BEV 标注框是地面平面坐标，不是图像框",
    ],
    code: `map.jumpTo({
  center: [lng, lat],
  bearing: yawDeg,
  pitch: 0,
  zoom: 18,
});`,
  },
  {
    id: "D2",
    group: "D",
    title: "轨迹插值与多传感器同步",
    hasDemo: true,
    summary:
      "30 秒：统一时间轴 t。相机 10Hz 取最近帧，LiDAR 10Hz，GNSS 2Hz 要插值。不同步就会「车在路上、点云落在车后」。",
    points: [
      "轨迹线用 line layer，自车用一个 Feature 复用",
      "GNSS 低频必须插值，不要阶跃跳变",
      "翻车：各面板用自己的 Date.now()，没有公共 t",
    ],
    code: `const pose = interpolatePose(gnss, t);
const camFrame = Math.floor(t * 10) / 10;`,
  },
  {
    id: "E1",
    group: "E",
    title: "车道线 / 路沿 / 路口",
    hasDemo: true,
    summary:
      "30 秒：HD Map 是带语义的矢量拓扑：lane polyline、curb、stopline、junction polygon。用 line/fill/dasharray，不要拿一张卫星图冒充高精。",
    points: [
      "车道是拓扑，要能选中某一条 lane id",
      "路沿与车道中心线不是同一层",
      "dasharray 表示虚线，不是几何真断了",
      "翻车：把 HD Map 栅格化成一张大 PNG",
    ],
    code: `map.addLayer({ type: "line", paint: { "line-dasharray": [2, 1.4] } });
map.addLayer({ type: "fill", paint: { "fill-opacity": 0.12 } });`,
  },
  {
    id: "F1",
    group: "F",
    title: "50 万点：卡 vs 优化",
    hasDemo: true,
    summary:
      "30 秒：瓶颈在主线程 JSON/布局，不在「GPU 画 50 万个点」。Worker 生成、VBO 只上传一次、按 zoom 少画、切题销毁。GeoJSON 三万点已经该换方案。",
    points: [
      "错误：GeoJSON Point / 每帧 bufferData",
      "正确：Worker + 静态 buffer + 视距/zoom 抽稀",
      "map.remove() 释放上下文，show=false 不够",
      "加分：WASM 解码、WebGPU compute",
    ],
    code: `worker.postMessage({ count: 500_000 });
// onAdd 里 bufferData 一次
// render 里只 drawArrays，按 zoom 改 drawCount`,
  },
];

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function questionsByGroup(): { group: GroupId; label: string; items: Question[] }[] {
  return (Object.keys(GROUP_LABEL) as GroupId[]).map((group) => ({
    group,
    label: GROUP_LABEL[group],
    items: QUESTIONS.filter((q) => q.group === group),
  }));
}
