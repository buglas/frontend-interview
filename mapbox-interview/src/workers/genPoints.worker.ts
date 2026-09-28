/// <reference lib="webworker" />
import { generateCloud } from "../data/pointCloud";

self.onmessage = (e: MessageEvent<{ count: number }>) => {
  const cloud = generateCloud(e.data.count);
  (self as DedicatedWorkerGlobalScope).postMessage(cloud, [
    cloud.mercator.buffer,
    cloud.color.buffer,
    cloud.enu.buffer,
  ]);
};
