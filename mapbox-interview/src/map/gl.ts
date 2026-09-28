function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log ?? "compile");
  }
  return sh;
}

export function makeProgram(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error("program");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "link");
  }
  return p;
}

export function isWebGL2(gl: WebGLRenderingContext): gl is WebGL2RenderingContext {
  return "createVertexArray" in gl && typeof (gl as WebGL2RenderingContext).createVertexArray === "function";
}

export function asMatrix(matrix: unknown): Float32Array {
  if (matrix instanceof Float32Array) return matrix;
  if (Array.isArray(matrix)) return new Float32Array(matrix);
  if (matrix && typeof matrix === "object") {
    const rec = matrix as {
      defaultProjectionData?: { mainMatrix?: number[] };
      mainMatrix?: number[];
    };
    const m = rec.defaultProjectionData?.mainMatrix ?? rec.mainMatrix;
    if (m) return new Float32Array(m);
  }
  throw new Error("Mapbox custom layer matrix 无法解析");
}
