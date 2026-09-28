import type { CustomLayerInterface, Map } from "maplibre-gl";
import { asMatrix, isWebGL2, makeProgram } from "./gl";

export type PointCloudLayerOpts = {
  id: string;
  mercator: Float32Array;
  color: Float32Array;
  count: number;
  reuploadEveryFrame?: boolean;
  getDrawCount?: (zoom: number) => number;
  pointSize?: number;
};

const VS2 = `#version 300 es
uniform mat4 u_matrix;
uniform float u_size;
in vec3 a_pos;
in vec3 a_color;
out vec3 v_color;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
  gl_PointSize = u_size;
  v_color = a_color;
}`;

const FS2 = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (dot(c, c) > 1.0) discard;
  outColor = vec4(v_color, 0.92);
}`;

const VS1 = `
uniform mat4 u_matrix;
uniform float u_size;
attribute vec3 a_pos;
attribute vec3 a_color;
varying vec3 v_color;
void main() {
  gl_Position = u_matrix * vec4(a_pos, 1.0);
  gl_PointSize = u_size;
  v_color = a_color;
}`;

const FS1 = `
precision mediump float;
varying vec3 v_color;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (dot(c, c) > 1.0) discard;
  gl_FragColor = vec4(v_color, 0.92);
}`;

export function createPointCloudLayer(
  opts: PointCloudLayerOpts,
): CustomLayerInterface & { visible: boolean } {
  let map: Map;
  let gl: WebGLRenderingContext;
  let program: WebGLProgram;
  let posBuf: WebGLBuffer;
  let colBuf: WebGLBuffer;
  let uMatrix: WebGLUniformLocation | null;
  let uSize: WebGLUniformLocation | null;
  let aPos: number;
  let aColor: number;

  function upload(g: WebGLRenderingContext) {
    g.bindBuffer(g.ARRAY_BUFFER, posBuf);
    g.bufferData(g.ARRAY_BUFFER, opts.mercator, g.STATIC_DRAW);
    g.bindBuffer(g.ARRAY_BUFFER, colBuf);
    g.bufferData(g.ARRAY_BUFFER, opts.color, g.STATIC_DRAW);
  }

  const layer: CustomLayerInterface & { visible: boolean } = {
    id: opts.id,
    type: "custom",
    renderingMode: "3d",
    visible: true,
    onAdd(m, context) {
      map = m;
      gl = context;
      program = makeProgram(gl, isWebGL2(gl) ? VS2 : VS1, isWebGL2(gl) ? FS2 : FS1);
      aPos = gl.getAttribLocation(program, "a_pos");
      aColor = gl.getAttribLocation(program, "a_color");
      uMatrix = gl.getUniformLocation(program, "u_matrix");
      uSize = gl.getUniformLocation(program, "u_size");
      posBuf = gl.createBuffer()!;
      colBuf = gl.createBuffer()!;
      upload(gl);
    },
    render(context, matrix) {
      if (!layer.visible) return;
      const g = context;
      const n = opts.getDrawCount ? opts.getDrawCount(map.getZoom()) : opts.count;
      g.useProgram(program);
      if (opts.reuploadEveryFrame) upload(g);
      g.enable(g.BLEND);
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.bindBuffer(g.ARRAY_BUFFER, posBuf);
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, colBuf);
      g.enableVertexAttribArray(aColor);
      g.vertexAttribPointer(aColor, 3, g.FLOAT, false, 0, 0);
      g.uniformMatrix4fv(uMatrix, false, asMatrix(matrix));
      g.uniform1f(uSize, opts.pointSize ?? 2.4);
      g.drawArrays(g.POINTS, 0, Math.max(0, Math.min(n, opts.count)));
    },
    onRemove() {
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(colBuf);
      gl.deleteProgram(program);
    },
  };
  return layer;
}
