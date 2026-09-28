<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import maplibregl, { type Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { addHdMapLayers } from "@/map/addHdMap";
import { gnssSamples, interpolatePose, poseToLngLat, trajectoryLine } from "@/data/trajectory";
import { yawToBearing } from "@/data/scene";

// 获取gnss数据
const samples = gnssSamples();
// 获取最大时间
const tMax = samples[samples.length - 1].t;
// 时间
const t = ref(0);
// 是否播放
const playing = ref(false);
// 是否是鸟瞰
const bev = ref(true);
const notice = ref("pitch=0 + 跟随自车 = BEV。切到 60° 是街景透视，不是鸟瞰。");
let map: Map | null = null;
let marker: maplibregl.Marker | null = null;
// 请求动画帧
let raf = 0;
// 上次时间
let lastTs = 0;

// 应用姿势
function applyPose() {
  if (!map) return;
  // 插值姿势
  const pose = interpolatePose(samples, t.value);
  // 转换为经纬度
  const ll = poseToLngLat(pose);
  // 转换为方位角
  const bearing = yawToBearing(pose.yaw);
  // 添加标记
  if (!marker) marker = new maplibregl.Marker({ color: "#e3942b" }).setLngLat([ll.lng, ll.lat]).addTo(map);
  else marker.setLngLat([ll.lng, ll.lat]);
  map.jumpTo({
    center: [ll.lng, ll.lat],
    bearing,
    pitch: bev.value ? 0 : 60,
    zoom: bev.value ? 18.2 : 17.2,
  });
}

// 设置地图
const setup = (m: Map) => {
  map = m;
  // 添加高清地图图层
  addHdMapLayers(m, "d1");
  // 添加轨迹源
  m.addSource("d1-traj", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [trajectoryLine(samples)] },
  });
  // 添加轨迹图层
  m.addLayer({
    id: "d1-traj",
    type: "line",
    source: "d1-traj",
    paint: { "line-color": "#3d8fd1", "line-width": 2 },
  });
  applyPose();
};

// 请求动画帧
function tick(now: number) {
  // 如果不在播放，则返回
  if (!playing.value) return;
  // 计算时间差
  const dt = lastTs ? (now - lastTs) / 1000 : 0;
  console.log(dt);
  // 更新上次时间
  lastTs = now;
  // 更新时间
  t.value += dt;
  // 如果时间大于最大时间，则重置时间
  if (t.value > tMax) t.value = 0;
  applyPose();
  raf = requestAnimationFrame(tick);
}

// 切换播放
function togglePlay() {
  playing.value = !playing.value;
  lastTs = 0;
  if (playing.value) raf = requestAnimationFrame(tick);
  else cancelAnimationFrame(raf);
}

function toggleBev() {
  bev.value = !bev.value;
  notice.value = bev.value
    ? "BEV：pitch=0，相机在头顶往下看。"
    : "透视：pitch=60，这是街景，不是标注用的 BEV。";
  applyPose();
}

function onSlide(ev: Event) {
  t.value = Number((ev.target as HTMLInputElement).value);
  applyPose();
}

onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="18" :pitch="0">
    <template #toolbar>
      <button type="button" @click="togglePlay">{{ playing ? "暂停" : "回放" }}</button>
      <input type="range" min="0" :max="tMax" step="0.05" :value="t" @input="onSlide" />
      <span>t={{ t.toFixed(2) }}s</span>
      <button type="button" :class="{ active: bev }" @click="toggleBev">
        {{ bev ? "BEV pitch=0" : "透视 pitch=60" }}
      </button>
    </template>
  </LabMap>
</template>
