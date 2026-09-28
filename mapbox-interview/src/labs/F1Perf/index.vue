<script setup lang="ts">
/**
 * F1 海量点云：卡 vs 优化。
 * 瓶颈通常在主线程 JSON/布局和每帧 bufferData，不在「GPU 画 50 万个点」。
 * 正确路径：Worker 生成 + Transferable 零拷贝 + 静态 VBO 只上传一次 + 按 zoom 抽稀。
 */
import { onBeforeUnmount, ref } from "vue";
import type { Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { addHdMapLayers } from "@/map/addHdMap";
import { cloudToGeoJSON, generateCloud, type CloudData } from "@/data/pointCloud";
import { createPointCloudLayer } from "@/map/pointCloudLayer";

/** 
 * geojson：circle 布局卡主线程；
 * reupload：每帧上传打满带宽；
 * opt：静态 VBO + LOD。 
 * */
type Mode = "geojson" | "reupload" | "opt";

const fps = ref(0);
const mode = ref<Mode>("opt");
const ready = ref(false);
const notice = ref("Worker 正在生成 50 万点（不堵主线程）。完成后默认走静态 VBO。");

/** Worker 未完成前先用 8k 点占位，避免首屏空白。 */
const preview = generateCloud(8_000, 7);

/** 50 万点就绪后替换 preview；
 * TypedArray 由 Worker Transferable 过来。 
 * */
// 点云数据
let cloud: CloudData | null = null;
// 地图
let map: Map | null = null;
// 帧数
let frames = 0;
// 帧数
let lastFps = performance.now();
// 是否活着
let live = false;
// 请求动画帧
let raf = 0;
// 渲染事件
let onRender: (() => void) | null = null;

const worker = new Worker(new URL("../../workers/genPoints.worker.ts", import.meta.url), {
  type: "module",
});

/** 切模式必须真正 remove layer/source，visibility:none 不会释放布局索引和 VBO。 */
function stripCloud(m: Map) {
  if (m.getLayer("f1-cloud")) m.removeLayer("f1-cloud");
  if (m.getLayer("f1-geo")) m.removeLayer("f1-geo");
  if (m.getSource("f1-geo")) m.removeSource("f1-geo");
}

function applyMode(next: Mode) {
  if (!map) return;
  mode.value = next;
  stripCloud(map);
  const data = cloud ?? preview;
  if (next === "geojson") {
    // 故意只灌 2 万 Point：每个 Feature 要走 JSON + 布局 + 拾取索引，万级已卡，五十万会直接卡死
    const n = cloud ? 20_000 : preview.count;
    map.addSource("f1-geo", { type: "geojson", data: cloudToGeoJSON(data, n) });
    map.addLayer({
      id: "f1-geo",
      type: "circle",
      source: "f1-geo",
      paint: { "circle-radius": 2.2, "circle-color": "#ef476f", "circle-opacity": 0.7 },
    });
    notice.value = `错误：GeoJSON ${n.toLocaleString()} 个 Point。布局/序列化在主线程，50 万这条路直接卡死。`;
  } else if (next === "reupload") {
    // Custom Layer 能画，但每帧 bufferData 把 CPU→GPU 带宽打满；数据没变却当动态
    map.addLayer(
      createPointCloudLayer({
        id: "f1-cloud",
        mercator: data.mercator,
        color: data.color,
        count: data.count,
        reuploadEveryFrame: true,
        pointSize: 2,
      }),
    );
    notice.value = `错误：每帧 bufferData ${data.count.toLocaleString()} 点。GPU 画得动，PCIe 上传才是瓶颈。`;
  } else {
    // onAdd 上传一次 STATIC_DRAW；render 只绑 VBO + drawArrays；低 zoom 少画前缀点
    map.addLayer(
      createPointCloudLayer({
        id: "f1-cloud",
        mercator: data.mercator,
        color: data.color,
        count: data.count,
        pointSize: 2,
        getDrawCount: (z) => {
          if (z >= 17.5) return data.count;
          if (z >= 16) return Math.floor(data.count * 0.35);
          return Math.floor(data.count * 0.12);
        },
      }),
    );
    notice.value = `正确：Worker 生成 + 静态 VBO + 按 zoom 抽稀。当前 ${data.count.toLocaleString()} 点。`;
  }
}

/** 点云 Custom Layer 默认不持续动画，主动 triggerRepaint 才能稳定测 FPS。 */
function loop() {
  if (!live || !map) return;
  map.triggerRepaint();
  raf = requestAnimationFrame(loop);
}

const setup = (m: Map) => {
  map = m;
  addHdMapLayers(m, "f1");
  // 用地图自己的 render 事件计帧，比单独 rAF 更贴近真实绘制
  onRender = () => {
    frames++;
    const now = performance.now();
    if (now - lastFps > 500) {
      fps.value = Math.round((frames * 1000) / (now - lastFps));
      frames = 0;
      lastFps = now;
    }
  };
  m.on("render", onRender);
  live = true;
  raf = requestAnimationFrame(loop);
  applyMode("opt");
  // 生成放 Worker，主线程不被 50 万点坐标变换堵住
  worker.postMessage({ count: 500_000 });
  worker.onmessage = (e: MessageEvent<CloudData>) => {
    cloud = e.data;
    ready.value = true;
    applyMode(mode.value);
    notice.value = `50 万点已到主线程（Transferable）。当前模式 ${mode.value}，FPS ${fps.value}。`;
  };
  return () => {
    live = false;
    cancelAnimationFrame(raf);
    if (onRender) m.off("render", onRender);
  };
};

onBeforeUnmount(() => {
  live = false;
  cancelAnimationFrame(raf);
  worker.terminate();
});
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="17.4" :pitch="50">
    <template #toolbar>
      <span>FPS {{ fps }}</span>
      <span>{{ ready ? "50万已就绪" : "Worker 生成中…" }}</span>
      <button type="button" :class="{ active: mode === 'geojson' }" @click="applyMode('geojson')">
        错误 GeoJSON
      </button>
      <button type="button" :class="{ active: mode === 'reupload' }" @click="applyMode('reupload')">
        错误 每帧上传
      </button>
      <button type="button" :class="{ active: mode === 'opt' }" @click="applyMode('opt')">
        正确 静态 VBO
      </button>
    </template>
  </LabMap>
</template>
