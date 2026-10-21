import {
  advanceCamera,
  beginDrag,
  createCamera,
  dragBy,
  endDrag,
  isCameraSettled,
} from './portal-camera.js';
import { PATTERN_SIZE, createLayers } from './portal-layers.js';
import { advanceMotion, createMotionState } from './portal-motion.js';
import { createPattern } from './portal-pattern.js';
import { packLayerColor, packLayerOffsets, packLayerShape } from './portal-uniforms.js';
import { computeRenderSize } from './render-size.js';

// 30 fps is smooth for the slow drift and halves GPU/battery cost on 60 Hz displays.
// Camera movement after a drag renders at the full display rate so it follows the pointer.
const FRAME_INTERVAL_MS = 1000 / 30;
const FRAME_TOLERANCE_MS = 2;

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export function createFragmentShader(layerCount) {
  return `#version 300 es
precision highp float;
precision highp int;
precision mediump sampler2D;

#define LAYER_COUNT ${layerCount}

const int PATTERN_MASK = ${PATTERN_SIZE - 1};
const float GRAIN_TEXEL = 3.0;
const vec3 BASE_COLOR = vec3(0.016, 0.052, 0.062);

uniform vec2 uResolution;
uniform float uPixelScale;
uniform sampler2D uPattern;
uniform vec4 uLayerShape[LAYER_COUNT];
uniform vec3 uLayerColor[LAYER_COUNT];
uniform vec2 uLayerOffset[LAYER_COUNT];

out vec4 fragColor;

void main() {
  vec2 position = gl_FragCoord.xy / uPixelScale - 0.5 * uResolution;
  float radius = length(position) / max(0.5 * length(uResolution), 1.0);

  // Masking with a power-of-two size wraps negative texel indices as well.
  ivec2 grainTexel = ivec2(floor(position / GRAIN_TEXEL)) & ivec2(PATTERN_MASK);
  float grain = texelFetch(uPattern, grainTexel, 0).b;
  vec3 color = BASE_COLOR * (0.45 + 0.9 * grain * grain);

  for (int index = 0; index < LAYER_COUNT; index++) {
    vec4 shape = uLayerShape[index];
    vec2 local = vec2(
      shape.x * position.x - shape.y * position.y,
      shape.y * position.x + shape.x * position.y
    ) + uLayerOffset[index];

    // Unfiltered texel lookups keep every particle a crisp, rotated block of square pixels.
    ivec2 texel = ivec2(floor(local / shape.z)) & ivec2(PATTERN_MASK);
    vec4 particle = texelFetch(uPattern, texel, 0);
    color += uLayerColor[index] * particle.r * step(particle.g, shape.w);
  }

  color *= 1.0 - 0.35 * smoothstep(0.55, 1.3, radius);
  fragColor = vec4(min(color, vec3(1.0)), 1.0);
}
`;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Portal shader failed to compile: ${log}`);
  }
  return shader;
}

function uploadPattern(gl, pattern) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    pattern.size,
    pattern.size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pattern.data,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
}

function createResources(gl, layers, pattern) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, createFragmentShader(layers.length));
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Portal shader failed to link: ${log}`);
  }

  // A single oversized triangle covers the viewport without a diagonal seam.
  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.useProgram(program);
  uploadPattern(gl, pattern);
  gl.uniform1i(gl.getUniformLocation(program, 'uPattern'), 0);
  gl.uniform4fv(gl.getUniformLocation(program, 'uLayerShape'), packLayerShape(layers));
  gl.uniform3fv(gl.getUniformLocation(program, 'uLayerColor'), packLayerColor(layers));

  return {
    program,
    vertexArray,
    uniforms: {
      resolution: gl.getUniformLocation(program, 'uResolution'),
      pixelScale: gl.getUniformLocation(program, 'uPixelScale'),
      layerOffset: gl.getUniformLocation(program, 'uLayerOffset'),
    },
  };
}

/**
 * Renders the procedural portal background into the canvas. Returns null when WebGL2 or the
 * shader is unavailable so callers can keep the static CSS fallback.
 */
export function createPortalRenderer(canvas, { layers = createLayers(), onFailure = () => {} } = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) {
    return null;
  }

  const pattern = createPattern();
  let resources;
  try {
    resources = createResources(gl, layers, pattern);
  } catch (error) {
    console.warn(error);
    return null;
  }

  const win = canvas.ownerDocument.defaultView;
  const offsetBuffer = new Float32Array(layers.length * 2);
  let motion = createMotionState(layers);
  let camera = createCamera();
  let pixelScale = 1;
  let animating = false;
  let frameRequest = 0;
  let lastFrameTime = null;

  const needsFrames = () => animating || !isCameraSettled(camera);

  function draw() {
    if (!resources || gl.isContextLost()) {
      return;
    }
    const { program, vertexArray, uniforms } = resources;
    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.resolution, canvas.width / pixelScale, canvas.height / pixelScale);
    gl.uniform1f(uniforms.pixelScale, pixelScale);
    gl.uniform2fv(uniforms.layerOffset, packLayerOffsets(layers, motion.drift, camera, offsetBuffer));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const size = computeRenderSize(bounds.width, bounds.height, win.devicePixelRatio);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    pixelScale = size.scale;
    draw();
  }

  function frame(now) {
    frameRequest = 0;
    if (!needsFrames()) {
      return;
    }
    frameRequest = win.requestAnimationFrame(frame);
    const cameraMoving = !isCameraSettled(camera);
    if (
      !cameraMoving &&
      lastFrameTime !== null &&
      now - lastFrameTime < FRAME_INTERVAL_MS - FRAME_TOLERANCE_MS
    ) {
      return;
    }
    const deltaSeconds = lastFrameTime === null ? 0 : (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    if (animating) {
      motion = advanceMotion(motion, layers, deltaSeconds);
    }
    camera = advanceCamera(camera, deltaSeconds);
    draw();
  }

  function startLoop() {
    if (frameRequest === 0 && resources && needsFrames()) {
      lastFrameTime = null;
      frameRequest = win.requestAnimationFrame(frame);
    }
  }

  function stopLoop() {
    if (frameRequest !== 0) {
      win.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stopLoop();
    resources = null;
  });

  canvas.addEventListener('webglcontextrestored', () => {
    try {
      resources = createResources(gl, layers, pattern);
    } catch (error) {
      console.warn(error);
      onFailure(error);
      return;
    }
    resize();
    startLoop();
  });

  new win.ResizeObserver(resize).observe(canvas);
  resize();

  return {
    setAnimating(value) {
      animating = Boolean(value);
      if (needsFrames()) {
        startLoop();
      } else {
        stopLoop();
        draw();
      }
    },
    beginDrag(timeMs) {
      camera = beginDrag(camera, timeMs);
      startLoop();
    },
    dragBy(deltaX, deltaY, timeMs) {
      camera = dragBy(camera, deltaX, deltaY, timeMs);
      startLoop();
    },
    endDrag(timeMs) {
      camera = endDrag(camera, timeMs);
      startLoop();
    },
  };
}
