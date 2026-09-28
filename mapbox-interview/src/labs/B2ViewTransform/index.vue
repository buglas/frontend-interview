<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import LabCanvas2d from "../shared/LabCanvas2d.vue";
import { drawSyntheticCamera, IMAGE_H, IMAGE_W } from "@/data/camera";
import {
  fitContain,
  imageToScreen,
  screenToImage,
  type CanvasFit,
} from "@/render/useCanvas2d";

type Box = {
  id: number;
  img: { x1: number; y1: number; x2: number; y2: number };
  screen?: { x1: number; y1: number; x2: number; y2: number };
};

const canvas = ref<HTMLCanvasElement | null>(null);
const notice = ref("滚轮缩放、拖动画布。正确模式存图像坐标；错误模式存屏幕坐标，一缩放就飞。");
const storeScreen = ref(false);
const boxes = shallowRef<Box[]>([
  { id: 1, img: { x1: 520, y1: 360, x2: 740, y2: 520 } },
  { id: 2, img: { x1: 760, y1: 430, x2: 960, y2: 560 } },
]);
let viewScale = 1;
let panX = 0;
let panY = 0;
let fit: CanvasFit | null = null;
let drag: { x: number; y: number; panX: number; panY: number } | null = null;
let drawing: { x1: number; y1: number; x2: number; y2: number } | null = null;
let nextId = 3;
let ro: ResizeObserver | undefined;

function redraw() {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;
  const rect = el.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.max(1, Math.floor(rect.width * dpr));
  el.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fit = fitContain(rect.width, rect.height, IMAGE_W, IMAGE_H, viewScale, panX, panY);
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.translate(fit.ox, fit.oy);
  ctx.scale(fit.scale, fit.scale);
  drawSyntheticCamera(ctx, IMAGE_W, IMAGE_H);
  ctx.restore();

  const stroke = (x1: number, y1: number, x2: number, y2: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  };
  for (const b of boxes.value) {
    if (storeScreen.value && b.screen) {
      stroke(b.screen.x1, b.screen.y1, b.screen.x2, b.screen.y2, "#ef476f");
    } else if (fit) {
      const a = imageToScreen(fit, b.img.x1, b.img.y1);
      const c = imageToScreen(fit, b.img.x2, b.img.y2);
      stroke(a.x, a.y, c.x, c.y, "#e3942b");
    }
  }
  if (drawing && fit) {
    const a = imageToScreen(fit, drawing.x1, drawing.y1);
    const c = imageToScreen(fit, drawing.x2, drawing.y2);
    stroke(a.x, a.y, c.x, c.y, "#3d8fd1");
  }
}

function imgPt(ev: PointerEvent) {
  if (!fit || !canvas.value) return null;
  const r = canvas.value.getBoundingClientRect();
  return {
    img: screenToImage(fit, ev.clientX - r.left, ev.clientY - r.top),
    scr: { x: ev.clientX - r.left, y: ev.clientY - r.top },
  };
}

function onWheel(ev: WheelEvent) {
  ev.preventDefault();
  viewScale = Math.min(4, Math.max(0.4, viewScale * (ev.deltaY > 0 ? 0.9 : 1.1)));
  redraw();
}

function onDown(ev: PointerEvent) {
  if (ev.button === 1 || ev.shiftKey) {
    drag = { x: ev.clientX, y: ev.clientY, panX, panY };
    return;
  }
  const p = imgPt(ev);
  if (!p) return;
  drawing = { x1: p.img.x, y1: p.img.y, x2: p.img.x, y2: p.img.y };
}

function onMove(ev: PointerEvent) {
  if (drag) {
    panX = drag.panX + (ev.clientX - drag.x);
    panY = drag.panY + (ev.clientY - drag.y);
    redraw();
    return;
  }
  if (!drawing) return;
  const p = imgPt(ev);
  if (!p) return;
  drawing.x2 = p.img.x;
  drawing.y2 = p.img.y;
  redraw();
}

function onUp(ev: PointerEvent) {
  if (drag) {
    drag = null;
    return;
  }
  if (!drawing || !fit) return;
  const p = imgPt(ev);
  if (p && Math.abs(drawing.x2 - drawing.x1) > 4) {
    const a = imageToScreen(fit, drawing.x1, drawing.y1);
    const c = imageToScreen(fit, drawing.x2, drawing.y2);
    boxes.value = [
      ...boxes.value,
      {
        id: nextId++,
        img: { ...drawing },
        screen: { x1: a.x, y1: a.y, x2: c.x, y2: c.y },
      },
    ];
  }
  drawing = null;
  redraw();
}

function toggleWrong() {
  storeScreen.value = !storeScreen.value;
  notice.value = storeScreen.value
    ? "错误：用创建时的屏幕坐标重绘。缩放/平移后框钉在屏幕上，和图像脱节。"
    : "正确：始终用图像坐标 × 当前 view 矩阵重绘。";
  redraw();
}

onMounted(() => {
  redraw();
  ro = new ResizeObserver(redraw);
  if (canvas.value) ro.observe(canvas.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <LabCanvas2d :notice="notice">
    <canvas
      ref="canvas"
      class="anno-canvas"
      @wheel.prevent="onWheel"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
    />
    <template #toolbar>
      <span>滚轮缩放 · Shift 拖平移</span>
      <button type="button" :class="{ active: storeScreen }" @click="toggleWrong">
        {{ storeScreen ? "错误：存屏幕坐标" : "正确：存图像坐标" }}
      </button>
    </template>
  </LabCanvas2d>
</template>
