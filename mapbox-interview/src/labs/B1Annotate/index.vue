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

// 框
type Box = { id: number; x1: number; y1: number; x2: number; y2: number };
// 多边形
type Poly = { id: number; points: { x: number; y: number }[] };

const canvas = ref<HTMLCanvasElement | null>(null);
// 提示信息
const notice = ref("拖出框，或切到多边形点击加点、双击闭合。点选走几何 hit-test。");
// 模式
const mode = ref<"box" | "poly" | "select">("box");
// 框
const boxes = shallowRef<Box[]>([]);  
// 多边形
const polys = shallowRef<Poly[]>([]);
// 选中
const selected = ref<string>("");
// 缩放比例
let fit: CanvasFit | null = null;
// 框
let drawing: Box | null = null;
// 多边形
let polyDraft: { x: number; y: number }[] = [];
// 下一个ID
let nextId = 1;
let ro: ResizeObserver | undefined;

// 判断点是否在框内
function inBox(x: number, y: number, b: Box) {
  const x1 = Math.min(b.x1, b.x2);
  const x2 = Math.max(b.x1, b.x2);
  const y1 = Math.min(b.y1, b.y2);
  const y2 = Math.max(b.y1, b.y2);
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

// 判断点是否在多边形内
function inPoly(x: number, y: number, pts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    // 判断点是否在多边形内,使用射线法,如果射线与多边形相交,则点在多边形内,否则点在多边形外
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

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
  fit = fitContain(rect.width, rect.height, IMAGE_W, IMAGE_H);
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.save();
  ctx.translate(fit.ox, fit.oy);
  ctx.scale(fit.scale, fit.scale);
  drawSyntheticCamera(ctx, IMAGE_W, IMAGE_H);
  ctx.restore();

  const drawBox = (b: Box, color: string) => {
    if (!fit) return;
    const a = imageToScreen(fit, b.x1, b.y1);
    const c = imageToScreen(fit, b.x2, b.y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, c.x - a.x, c.y - a.y);
  };
  for (const b of boxes.value) {
    drawBox(b, selected.value === `b${b.id}` ? "#6aa84f" : "#e3942b");
  }
  if (drawing) drawBox(drawing, "#3d8fd1");

  const drawPoly = (pts: { x: number; y: number }[], color: string, close: boolean) => {
    if (!fit || pts.length === 0) return;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const s = imageToScreen(fit!, p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    if (close) ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  for (const p of polys.value) {
    drawPoly(p.points, selected.value === `p${p.id}` ? "#6aa84f" : "#8ecae6", true);
  }
  drawPoly(polyDraft, "#3d8fd1", false);
}

function imgPt(ev: PointerEvent) {
  if (!fit || !canvas.value) return null;
  const r = canvas.value.getBoundingClientRect();
  return screenToImage(fit, ev.clientX - r.left, ev.clientY - r.top);
}

function onDown(ev: PointerEvent) {
  const p = imgPt(ev);
  if (!p || !fit) return;
  if (mode.value === "box") {
    drawing = { id: -1, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
  } else if (mode.value === "select") {
    const hitB = [...boxes.value].reverse().find((b) => inBox(p.x, p.y, b));
    const hitP = [...polys.value].reverse().find((poly) => inPoly(p.x, p.y, poly.points));
    selected.value = hitB ? `b${hitB.id}` : hitP ? `p${hitP.id}` : "";
    notice.value = selected.value
      ? `命中 ${selected.value}（图像坐标 ${p.x.toFixed(0)}, ${p.y.toFixed(0)}）`
      : `未命中。当前鼠标图像坐标 ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`;
    redraw();
  }
}

function onMove(ev: PointerEvent) {
  if (!drawing) return;
  const p = imgPt(ev);
  if (!p) return;
  drawing.x2 = p.x;
  drawing.y2 = p.y;
  redraw();
}

function onUp() {
  if (!drawing) return;
  if (Math.abs(drawing.x2 - drawing.x1) > 4 && Math.abs(drawing.y2 - drawing.y1) > 4) {
    boxes.value = [...boxes.value, { ...drawing, id: nextId++ }];
    notice.value = `框已存图像像素 (${drawing.x1.toFixed(0)}, ${drawing.y1.toFixed(0)})–(${drawing.x2.toFixed(0)}, ${drawing.y2.toFixed(0)})`;
  }
  drawing = null;
  redraw();
}

function onClick(ev: PointerEvent) {
  if (mode.value !== "poly") return;
  const p = imgPt(ev);
  if (!p) return;
  polyDraft = [...polyDraft, p];
  redraw();
}

function onDbl() {
  if (mode.value !== "poly" || polyDraft.length < 3) return;
  polys.value = [...polys.value, { id: nextId++, points: polyDraft }];
  notice.value = `多边形 ${polyDraft.length} 个顶点，存在图像坐标系。`;
  polyDraft = [];
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
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @click="onClick"
      @dblclick.prevent="onDbl"
    />
    <template #toolbar>
      <button type="button" :class="{ active: mode === 'box' }" @click="mode = 'box'">框</button>
      <button type="button" :class="{ active: mode === 'poly' }" @click="mode = 'poly'">多边形</button>
      <button type="button" :class="{ active: mode === 'select' }" @click="mode = 'select'">点选</button>
      <span>{{ IMAGE_W }}×{{ IMAGE_H }} 图像坐标</span>
    </template>
  </LabCanvas2d>
</template>
