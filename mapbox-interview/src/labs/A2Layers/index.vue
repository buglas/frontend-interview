<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { CustomLayerInterface, Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { addHdMapLayers } from "@/map/addHdMap";
import { generateCloud, cloudToGeoJSON } from "@/data/pointCloud";
import { createPointCloudLayer } from "@/map/pointCloudLayer";
import {
  CAMERA,
  IMAGE_H,
  IMAGE_W,
  OTHER_VEHICLES,
  drawProjectedBox,
  drawSyntheticCamera,
} from "@/data/camera";

const OTHER_COLORS = ["#e3942b", "#ef476f", "#e9c46a", "#2a9d8f"];

const notice = ref(
  "车道走 GeoJSON line（几十条）。点云走 Custom Layer。左下角小窗是 Canvas 图像标注，坐标系不进地图。",
);
const showCloud = ref(true);
const showGeo = ref(false);
const pip = ref<HTMLCanvasElement | null>(null);

const cloud = generateCloud(12_000);
let map: Map | null = null;
let cloudLayer: (CustomLayerInterface & { visible: boolean }) | null = null;
let ro: ResizeObserver | undefined;

const setup = (m: Map) => {
  map = m;
  // 高清地图层
  addHdMapLayers(m, "a2");
  // 点云 Custom Layer
  cloudLayer = createPointCloudLayer({
    id: "a2-cloud",
    mercator: cloud.mercator,
    color: cloud.color,
    count: cloud.count,
    pointSize: 2.2,
  });
  m.addLayer(cloudLayer);
};

function toggleCloud() {
  if (!map || !cloudLayer) return;
  showCloud.value = !showCloud.value;
  cloudLayer.visible = showCloud.value;
  map.triggerRepaint();
}

function toggleGeo() {
  if (!map) return;
  showGeo.value = !showGeo.value;
  if (showGeo.value) {
    if (!map.getSource("a2-geo-pts")) {
      map.addSource("a2-geo-pts", {
        type: "geojson",
        data: cloudToGeoJSON(cloud, 4000),
      });
      map.addLayer({
        id: "a2-geo-pts",
        type: "circle",
        source: "a2-geo-pts",
        paint: { "circle-radius": 3, "circle-color": "#ef476f" },
      });
    } else {
      map.setLayoutProperty("a2-geo-pts", "visibility", "visible");
    }
    notice.value =
      "错误路径：仅 4000 个 GeoJSON Point 就开始卡布局。50 万点这条路走不通，必须 Custom Layer。";
  } else if (map.getLayer("a2-geo-pts")) {
    map.setLayoutProperty("a2-geo-pts", "visibility", "none");
    notice.value = "已关掉 GeoJSON 点。车道仍用 line layer，点云用 TypedArray。";
  }
}

function paintPip() {
  const el = pip.value;
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  const rect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.floor(rect.width * dpr);
  el.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);

  const scale = Math.min(rect.width / IMAGE_W, rect.height / IMAGE_H);
  const ox = (rect.width - IMAGE_W * scale) / 2;
  const oy = (rect.height - IMAGE_H * scale) / 2;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  drawSyntheticCamera(ctx, IMAGE_W, IMAGE_H, 0, { decoys: false });

  OTHER_VEHICLES.forEach((box, i) => {
    const color = OTHER_COLORS[i];
    drawProjectedBox(ctx, box, CAMERA, { color, lineWidth: 3 });
  });
  ctx.restore();
}

onMounted(() => {
  //模拟canvas图像标注
  paintPip();
  ro = new ResizeObserver(paintPip);
  if (pip.value) ro.observe(pip.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="17.6" :pitch="45">
    <template #toolbar>
      <button type="button" :class="{ active: showCloud }" @click="toggleCloud">点云 Custom Layer</button>
      <button type="button" :class="{ active: showGeo }" @click="toggleGeo">错误：GeoJSON 点</button>
      <span>车道 = line · 点云 = gl.POINTS · 图像框 = Canvas</span>
    </template>
    <template #overlay>
      <div class="a2-pip">
        <canvas ref="pip" />
        <span class="cap">前视 1280×720 · 他车 3D 线框</span>
      </div>
    </template>
  </LabMap>
</template>

<style scoped>
.a2-pip {
  width: 360px;
  height: 228px;
  border: 1px solid #e3942b;
  border-radius: 8px;
  overflow: hidden;
  background: #0a0e14;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.a2-pip canvas {
  width: 100%;
  height: 204px;
  display: block;
}
.a2-pip .cap {
  display: block;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #f3d5a3;
}
</style>
