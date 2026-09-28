import { onBeforeUnmount, onMounted, type Ref } from "vue";

export type CanvasFit = {
  cssW: number;
  cssH: number;
  dpr: number;
  imgW: number;
  imgH: number;
  scale: number;
  ox: number;
  oy: number;
};

export function fitContain(
  cssW: number,
  cssH: number,
  imgW: number,
  imgH: number,
  viewScale = 1,
  panX = 0,
  panY = 0,
): CanvasFit {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(cssW / imgW, cssH / imgH) * viewScale;
  const ox = (cssW - imgW * scale) / 2 + panX;
  const oy = (cssH - imgH * scale) / 2 + panY;
  return { cssW, cssH, dpr, imgW, imgH, scale, ox, oy };
}

export function screenToImage(fit: CanvasFit, sx: number, sy: number) {
  return {
    x: (sx - fit.ox) / fit.scale,
    y: (sy - fit.oy) / fit.scale,
  };
}

export function imageToScreen(fit: CanvasFit, x: number, y: number) {
  return {
    x: x * fit.scale + fit.ox,
    y: y * fit.scale + fit.oy,
  };
}

export function useBackingCanvas(
  canvas: Ref<HTMLCanvasElement | null | undefined>,
  onResize: (ctx: CanvasRenderingContext2D, fit: { cssW: number; cssH: number; dpr: number }) => void,
) {
  let ro: ResizeObserver | undefined;

  function layout() {
    const el = canvas.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.max(1, Math.floor(rect.width * dpr));
    el.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize(ctx, { cssW: rect.width, cssH: rect.height, dpr });
  }

  onMounted(() => {
    layout();
    ro = new ResizeObserver(layout);
    if (canvas.value) ro.observe(canvas.value);
  });

  onBeforeUnmount(() => ro?.disconnect());

  return { layout };
}
