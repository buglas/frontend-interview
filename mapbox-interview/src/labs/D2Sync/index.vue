<script setup lang="ts">
/**
 * D2 轨迹插值与多传感器同步。
 * 产品层必须有一个公共时钟 t：相机 10Hz 取最近帧，LiDAR 10Hz 换 sweep，
 * GNSS 2Hz 必须插值。各面板自己走 Date.now() 就会出现「车在路上、框落在车后」。
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import maplibregl, { type Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { addHdMapLayers } from "@/map/addHdMap";
import { createBoxLayer } from "@/map/boxLayer";
import {
  gnssSamples,
  interpolatePose,
  poseToLngLat,
  sampleAtHz,
  trajectoryLine,
} from "@/data/trajectory";
import {
  CAMERA,
  IMAGE_H,
  IMAGE_W,
  OTHER_VEHICLES,
  drawProjectedBox,
  drawSyntheticCamera,
  projectedAabb,
} from "@/data/camera";
import { yawToBearing } from "@/data/scene";

// 他车 3D 框颜色与线框
const OTHER_COLORS = ["#e3942b", "#ef476f", "#e9c46a", "#2a9d8f"];
const OTHER_GL = [
  [0.89, 0.58, 0.17],
  [0.94, 0.28, 0.44],
  [0.91, 0.77, 0.42],
  [0.16, 0.62, 0.56],
] as const;

// 轨迹数据
const samples = gnssSamples();

// 轨迹数据的最大时间
const tMax = samples[samples.length - 1].t;

/** 公共逻辑时钟。地图、相机、LiDAR 都应从这个 t 取各自最近样本，而不是各自 Date.now()。 */
const t = ref(0);
const playing = ref(false);
/** 
 * true：各传感器对齐公共 t；
 * false：GNSS 阶跃 + 相机走独立时钟，用来演示不同步翻车。 
 * */
const sync = ref(true);
const notice = ref("同步：相机外参跟公共 t，投影框和车上位置一致。关掉后 GNSS 阶跃、相机走另一套时钟，框会超前或滞后。");
const clocks = ref("");
const cam = ref<HTMLCanvasElement | null>(null);
let map: Map | null = null;
let marker: maplibregl.Marker | null = null;
let raf = 0;
let lastTs = 0;
/** 未同步时相机自己的时钟；tick 里按 1.15× 走，模拟相机时钟漂移。 */
let unsyncCam = 0;
let ro: ResizeObserver | undefined;

/** 地图上自车位姿：同步时对 GNSS 连续插值；不同步时钉到 2Hz 采样点，车会一跳一跳。 */
function poseFor() {
  if (sync.value) return interpolatePose(samples, t.value);
  return sampleAtHz(samples, t.value, 2);
}

/** 相机帧时刻：同步时按 10Hz 取最近帧 floor(t*10)/10；不同步时用独立时钟 unsyncCam。 */
function camTime() {
  if (sync.value) return Math.floor(t.value * 10) / 10;
  return Math.floor(unsyncCam * 10) / 10;
}

/** 把 1280×720 前视画面画进画中画：按 camTime 取位姿，再把 3D 他车框投影到像素。 */
function paintCam() {
  const el = cam.value;
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  const rect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.max(1, Math.floor(rect.width * dpr));
  el.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 保持相机分辨率比例，居中缩放进 PIP 画布
  const scale = Math.min(rect.width / IMAGE_W, rect.height / IMAGE_H);
  const ox = (rect.width - IMAGE_W * scale) / 2;
  const oy = (rect.height - IMAGE_H * scale) / 2;
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  // 相机外参跟 camTime 走，不同步时会和地图上的 GNSS 位姿错开
  const pose = interpolatePose(samples, camTime());
  const camPose = { ...CAMERA, e: pose.e, n: pose.n, yaw: pose.yaw };
  drawSyntheticCamera(ctx, IMAGE_W, IMAGE_H, camTime(), { decoys: false });
  OTHER_VEHICLES.forEach((box, i) => {
    const color = OTHER_COLORS[i];
    drawProjectedBox(ctx, box, camPose, { color, lineWidth: 3 });
    const aabb = projectedAabb(box, camPose);
    if (!aabb) return;
    const range = Math.hypot(box.e - camPose.e, box.n - camPose.n);
    ctx.fillStyle = color;
    ctx.font = "20px sans-serif";
    ctx.fillText(`前方 ${Math.round(range)}m`, aabb.x1, Math.max(48, aabb.y1 - 8));
  });
  ctx.fillStyle = "#e3942b";
  ctx.font = "24px sans-serif";
  ctx.fillText(`camera frame t=${camTime().toFixed(1)}s`, 24, 70);
  ctx.restore();
}

/** 同一帧里刷新地图自车、时钟条、相机画面，保证「一次 apply = 一套 t」。 */
function apply() {
  if (!map) return;
  // 获取自车位姿
  const pose = poseFor();
  // 转换为经纬度
  const ll = poseToLngLat(pose);
  // 创建自车标记
  if (!marker) marker = new maplibregl.Marker({ color: "#e3942b" }).setLngLat([ll.lng, ll.lat]).addTo(map);
  else marker.setLngLat([ll.lng, ll.lat]);
  map.jumpTo({
    center: [ll.lng, ll.lat],
    bearing: yawToBearing(pose.yaw),
    pitch: 0,
    zoom: 18,
  });
  // LiDAR 示意：同样 10Hz 取最近 sweep。对照 cam / gnss 时间戳看是否对齐
  const lidarT = Math.floor(t.value * 10) / 10;
  clocks.value = `clock ${t.value.toFixed(2)}s · cam ${camTime().toFixed(1)} · lidar ${lidarT.toFixed(1)} · gnss ${pose.t.toFixed(2)}`;
  paintCam();
}

const setup = (m: Map) => {
  map = m;
  addHdMapLayers(m, "d2");
  m.addSource("d2-traj", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [trajectoryLine(samples)] },
  });
  m.addLayer({
    id: "d2-traj",
    type: "line",
    source: "d2-traj",
    paint: { "line-color": "#3d8fd1", "line-width": 4 },
  });
  // 他车 3D 框：地图 Custom Layer 与相机投影共用同一套 OTHER_VEHICLES
  OTHER_VEHICLES.forEach((box, i) => {
    m.addLayer(createBoxLayer(`d2-box-${i}`, box, [...OTHER_GL[i]]));
  });
  apply();
};

function tick(now: number) {
  if (!playing.value) return;
  const dt = lastTs ? (now - lastTs) / 1000 : 0;
  lastTs = now;
  // 公共 t 增加 dt 秒
  t.value += dt;
  // 1.15× 让相机时钟相对公共 t 漂移，关掉同步后投影框会超前
  unsyncCam += dt * 1.15;
  if (t.value > tMax) t.value = 0;
  apply();
  raf = requestAnimationFrame(tick);
}

function togglePlay() {
  playing.value = !playing.value;
  lastTs = 0;
  if (playing.value) raf = requestAnimationFrame(tick);
  else cancelAnimationFrame(raf);
}

function toggleSync() {
  sync.value = !sync.value;
  // 从当前公共 t 重新分叉，避免切换瞬间相机时间跳变过大
  unsyncCam = t.value;
  notice.value = sync.value
    ? "同步：相机外参跟公共 t，投影框和车上位置一致。"
    : "不同步：GNSS 阶跃到 2Hz 采样点，相机走另一套时钟，投影框会超前或滞后。";
  apply();
}

onMounted(() => {
  paintCam();
  ro = new ResizeObserver(paintCam);
  if (cam.value) ro.observe(cam.value);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
});
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="18" :pitch="0">
    <template #toolbar>
      <button type="button" @click="togglePlay">{{ playing ? "暂停" : "回放" }}</button>
      <button type="button" :class="{ active: sync }" @click="toggleSync">
        {{ sync ? "已同步" : "未同步" }}
      </button>
      <span>{{ clocks }}</span>
    </template>
    <template #overlay>
      <div class="d2-pip">
        <canvas ref="cam" />
        <span class="cap">前视 1280×720 · 他车 3D 线框</span>
      </div>
    </template>
  </LabMap>
</template>

<style scoped>
.d2-pip {
  width: 360px;
  height: 228px;
  border: 1px solid #e3942b;
  border-radius: 8px;
  overflow: hidden;
  background: #0a0e14;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.d2-pip canvas {
  width: 100%;
  height: 204px;
  display: block;
}
.d2-pip .cap {
  display: block;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #f3d5a3;
}
</style>
