import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

const demos: Record<string, Component> = {
  A1: defineAsyncComponent(() => import("./A1Coords/index.vue")),
  A2: defineAsyncComponent(() => import("./A2Layers/index.vue")),
  B1: defineAsyncComponent(() => import("./B1Annotate/index.vue")),
  B2: defineAsyncComponent(() => import("./B2ViewTransform/index.vue")),
  C1: defineAsyncComponent(() => import("./C1PointCloud/index.vue")),
  C2: defineAsyncComponent(() => import("./C2BoxAlign/index.vue")),
  C3: defineAsyncComponent(() => import("./C3Pick/index.vue")),
  D1: defineAsyncComponent(() => import("./D1Bev/index.vue")),
  D2: defineAsyncComponent(() => import("./D2Sync/index.vue")),
  E1: defineAsyncComponent(() => import("./E1HdMap/index.vue")),
  F1: defineAsyncComponent(() => import("./F1Perf/index.vue")),
};

export function labComponent(id: string): Component {
  return demos[id] ?? demos.A1;
}
