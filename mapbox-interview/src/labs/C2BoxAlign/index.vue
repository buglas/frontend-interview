<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { Map } from "maplibre-gl";
import LabMap from "../shared/LabMap.vue";
import { generateCloud } from "@/data/pointCloud";
import { createPointCloudLayer } from "@/map/pointCloudLayer";
import { createBoxLayer } from "@/map/boxLayer";
import { addHdMapLayers } from "@/map/addHdMap";
import {
  CAMERA,
  EGO_BOX,
  IMAGE_H,
  IMAGE_W,
  OTHER_VEHICLES,
  drawProjectedBox,
  drawSyntheticCamera,
  projectedAabb,
} from "@/data/camera";

const OTHER_COLORS = ["#e3942b", "#ef476f", "#e9c46a", "#2a9d8f"];
const OTHER_GL = [
  [0.89, 0.58, 0.17],
  [0.94, 0.28, 0.44],
  [0.91, 0.77, 0.42],
  [0.16, 0.62, 0.56],
] as const;

const cloud = generateCloud(40_000);
const notice = ref(
  "地图：青框是自车，彩色框是他车（车体 ENU）。左下角：同一他车经 K[R|t] 投影成 12 条棱。自车不投前视。",
);
const cam = ref<HTMLCanvasElement | null>(null);

const setup = (map: Map) => {
  addHdMapLayers(map, "c2");
  map.addLayer(
    createPointCloudLayer({
      id: "c2-cloud",
      mercator: cloud.mercator,
      color: cloud.color,
      count: cloud.count,
      pointSize: 2,
    }),
  );
  map.addLayer(createBoxLayer("c2-ego", EGO_BOX, [0.24, 0.56, 0.82]));
  OTHER_VEHICLES.forEach((box, i) => {
    map.addLayer(createBoxLayer(`c2-box-${i}`, box, [...OTHER_GL[i]]));
  });
};

function paintCam() {
  const el = cam.value;
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  // 获取画布的边界矩形
  const rect = el.getBoundingClientRect();
  // 获取设备像素比
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 设置画布尺寸
  el.width = Math.floor(rect.width * dpr);
  el.height = Math.floor(rect.height * dpr);
  // 设置画布的缩放比例
  ctx.scale(dpr, dpr);

  // 画布尺寸与图像尺寸的比例，取最小的比值，以便将图像完全绘制在画布上
  const scale = Math.min(rect.width / IMAGE_W, rect.height / IMAGE_H);
  const ox = (rect.width - IMAGE_W * scale) / 2;
  const oy = (rect.height - IMAGE_H * scale) / 2;
  
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // 绘制合成相机图像
  drawSyntheticCamera(ctx, IMAGE_W, IMAGE_H, 0, { decoys: false });
  
  OTHER_VEHICLES.forEach((box, i) => {
    const color = OTHER_COLORS[i];
    // 绘制投影框
    drawProjectedBox(ctx, box, CAMERA, { color, lineWidth: 3 });
  });
  ctx.restore();
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  paintCam();
  ro = new ResizeObserver(paintCam);
  if (cam.value) ro.observe(cam.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <LabMap :setup="setup" :notice="notice" :zoom="18" :pitch="50">
    <template #toolbar>
      <span>相机 fx={{ CAMERA.fx }}  pitch={{ CAMERA.pitch }}  roll={{ CAMERA.roll }}  自车 ENU ({{ EGO_BOX.e }}, {{ EGO_BOX.n }})  他车 {{ OTHER_VEHICLES.length }} 辆</span>
    </template>
    <template #overlay>
      <div class="c2-pip">
        <canvas ref="cam" />
        <span class="cap">前视 1280×720 · 他车 3D 线框</span>
      </div>
    </template>
  </LabMap>
</template>

<style scoped>
.c2-pip {
  width: 360px;
  height: 228px;
  border: 1px solid #e3942b;
  border-radius: 8px;
  overflow: hidden;
  background: #0a0e14;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.c2-pip canvas {
  width: 100%;
  height: 204px;
  display: block;
}
.c2-pip .cap {
  display: block;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #f3d5a3;
}
</style>
