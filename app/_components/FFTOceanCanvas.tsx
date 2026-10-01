"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";
import type { SkyState } from "./ocean/sky";

/**
 * Tessendorf FFT ocean — ported from david.li/waves to Three.js.
 *
 * Key architectural points (lifted directly from david.li):
 *   - JONSWAP-style spectrum with capillary tail (KM=370, CM=0.23, Omega=0.84)
 *   - Phase ping-pong: store phase per-cell, increment by omega*deltaTime each
 *     frame (more stable than recomputing h_tilde from h0 each frame)
 *   - Pack (dispX + i*height) into RG and hZ into BA — one RGBA Stockham FFT
 *     produces dispX/height/dispZ all at once
 *   - Geometry is much larger than the FFT patch; displacement tiles across
 *     it via fract() in UV (mesh = 2000 units, patch = 250)
 *   - Normal map computed as a separate pass via cross-products on the
 *     displacement gradient
 *   - Fragment is just fresnel + diffuse + HDR tone-map; the heavy lifting
 *     is all in the simulation
 */

const THREE_CDN = "https://esm.sh/three@0.180.0";
async function loadThree(): Promise<typeof THREENS> {
  return new Function("u", "return import(u)")(THREE_CDN);
}

// Tuning knobs (mirror david.li's defaults)
const RESOLUTION = 256;           // FFT grid (david uses 512; 256 keeps perf high)
const GEOMETRY_RESOLUTION = 256;  // mesh subdivision
const GEOMETRY_SIZE = 4000;        // mesh side length in world units
const PATCH_SIZE = 250;            // FFT patch size in world units

// ===================== Shaders =====================

// Standard "position" attribute name so Three.js auto-binds correctly and
// can compute a bounding sphere (no silent frustum-cull). We don't use a
// varying — every fragment shader recomputes uv from gl_FragCoord.
const fullscreenVS = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Pierson-Moskowitz / JONSWAP spectrum w/ capillary tail. Output: h0 packed
// as (re, im, 0, 0). v_coordinates is in [0,1]; coord = uv*resolution - 0.5
// gives integer cell index, n,m wrap to [-N/2, N/2) standard FFT layout.
const initialSpectrumFS = /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  const float G = 9.81;
  const float KM = 370.0;
  const float CM = 0.23;

  uniform vec2 u_wind;
  uniform float u_resolution;
  uniform float u_size;

  float sqr(float x) { return x * x; }
  float omega(float k) { return sqrt(G * k * (1.0 + sqr(k / KM))); }
  float tanhFn(float x) {
    return (1.0 - exp(-2.0 * x)) / (1.0 + exp(-2.0 * x));
  }

  void main() {
    vec2 coords = gl_FragCoord.xy - 0.5;
    float n = (coords.x < u_resolution * 0.5) ? coords.x : coords.x - u_resolution;
    float m = (coords.y < u_resolution * 0.5) ? coords.y : coords.y - u_resolution;
    vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;
    float k = length(waveVector);

    float U10 = length(u_wind);
    float Omega = 0.84;
    float kp = G * sqr(Omega / U10);

    float c = omega(k) / max(k, 1e-6);
    float cp = omega(kp) / kp;

    float Lpm = exp(-1.25 * sqr(kp / max(k, 1e-6)));
    float gammaJ = 1.7;
    float sigma = 0.08 * (1.0 + 4.0 * pow(Omega, -3.0));
    float Gamma = exp(-sqr(sqrt(k / kp) - 1.0) / (2.0 * sqr(sigma)));
    float Jp = pow(gammaJ, Gamma);
    float Fp = Lpm * Jp * exp(-Omega / sqrt(10.0) * (sqrt(k / kp) - 1.0));
    float alphap = 0.006 * sqrt(Omega);
    float Bl = 0.5 * alphap * cp / c * Fp;

    float z0 = 0.000037 * sqr(U10) / G * pow(U10 / cp, 0.9);
    float uStar = 0.41 * U10 / log(10.0 / z0);
    float alpham = 0.01 * ((uStar < CM) ? (1.0 + log(uStar / CM)) : (1.0 + 3.0 * log(uStar / CM)));
    float Fm = exp(-0.25 * sqr(k / KM - 1.0));
    float Bh = 0.5 * alpham * CM / c * Fm * Lpm;

    float a0 = log(2.0) / 4.0;
    float am = 0.13 * uStar / CM;
    float Delta = tanhFn(a0 + 4.0 * pow(c / cp, 2.5) + am * pow(CM / c, 2.5));

    float cosPhi = dot(normalize(u_wind), normalize(waveVector));
    float S = (1.0 / (2.0 * PI)) * pow(k, -4.0) * (Bl + Bh)
              * (1.0 + Delta * (2.0 * cosPhi * cosPhi - 1.0));

    float dk = 2.0 * PI / u_size;
    float h = sqrt(S / 2.0) * dk;
    if (waveVector.x == 0.0 && waveVector.y == 0.0) h = 0.0; // no DC

    gl_FragColor = vec4(h, 0.0, 0.0, 0.0);
  }
`;

// Phase update: increment by omega(k) * deltaTime, modulo 2pi
const phaseFS = /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  const float G = 9.81;
  const float KM = 370.0;

  uniform sampler2D u_phases;
  uniform float u_deltaTime;
  uniform float u_resolution;
  uniform float u_size;

  float omega(float k) {
    return sqrt(G * k * (1.0 + k * k / (KM * KM)));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 coords = gl_FragCoord.xy - 0.5;
    float n = (coords.x < u_resolution * 0.5) ? coords.x : coords.x - u_resolution;
    float m = (coords.y < u_resolution * 0.5) ? coords.y : coords.y - u_resolution;
    vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;

    float phase = texture2D(u_phases, uv).r;
    float deltaPhase = omega(length(waveVector)) * u_deltaTime;
    phase = mod(phase + deltaPhase, 2.0 * PI);

    gl_FragColor = vec4(phase, 0.0, 0.0, 0.0);
  }
`;

// Spectrum: combines initial h0 + phase + choppiness, packs (hX + i*h, hZ)
const spectrumFS = /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;
  const float G = 9.81;
  const float KM = 370.0;

  uniform float u_size;
  uniform float u_resolution;
  uniform sampler2D u_phases;
  uniform sampler2D u_initialSpectrum;
  uniform float u_choppiness;

  vec2 mulC(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.y * b.x + a.x * b.y);
  }
  vec2 mulI(vec2 z) { return vec2(-z.y, z.x); }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 coords = gl_FragCoord.xy - 0.5;
    float n = (coords.x < u_resolution * 0.5) ? coords.x : coords.x - u_resolution;
    float m = (coords.y < u_resolution * 0.5) ? coords.y : coords.y - u_resolution;
    vec2 waveVector = (2.0 * PI * vec2(n, m)) / u_size;

    float phase = texture2D(u_phases, uv).r;
    vec2 phaseVec = vec2(cos(phase), sin(phase));

    vec2 h0 = texture2D(u_initialSpectrum, uv).rg;
    // conj(h0(-k)): h0 lookup at the symmetric position, flip imag
    vec2 h0Star = texture2D(u_initialSpectrum, vec2(1.0 - uv + 1.0 / u_resolution)).rg;
    h0Star.y *= -1.0;

    vec2 h = mulC(h0, phaseVec) + mulC(h0Star, vec2(phaseVec.x, -phaseVec.y));

    float kLen = length(waveVector);
    vec2 hX = (kLen > 1e-6) ? -mulI(h * (waveVector.x / kLen)) * u_choppiness : vec2(0.0);
    vec2 hZ = (kLen > 1e-6) ? -mulI(h * (waveVector.y / kLen)) * u_choppiness : vec2(0.0);

    if (waveVector.x == 0.0 && waveVector.y == 0.0) {
      h = vec2(0.0); hX = vec2(0.0); hZ = vec2(0.0);
    }

    // Pack: (hX + i*h) in RG, hZ in BA. After one RGBA FFT, R=dispX,
    // G=height, B=dispZ_real, A=~0
    gl_FragColor = vec4(hX + mulI(h), hZ);
  }
`;

// Stockham FFT butterfly — operates on two complex pairs (RG, BA) in parallel.
// Same fragment, compiled with HORIZONTAL or VERTICAL define.
const subtransformFSBase = /* glsl */ `
  precision highp float;
  const float PI = 3.14159265359;

  uniform sampler2D u_input;
  uniform float u_transformSize;
  uniform float u_subtransformSize;

  vec2 mulC(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.y * b.x + a.x * b.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_transformSize;
    #ifdef HORIZONTAL
    float index = uv.x * u_transformSize - 0.5;
    #else
    float index = uv.y * u_transformSize - 0.5;
    #endif

    float evenIndex = floor(index / u_subtransformSize) * (u_subtransformSize * 0.5)
                    + mod(index, u_subtransformSize * 0.5);

    #ifdef HORIZONTAL
    vec4 even = texture2D(u_input, vec2(evenIndex + 0.5, gl_FragCoord.y) / u_transformSize);
    vec4 odd  = texture2D(u_input, vec2(evenIndex + u_transformSize * 0.5 + 0.5, gl_FragCoord.y) / u_transformSize);
    #else
    vec4 even = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + 0.5) / u_transformSize);
    vec4 odd  = texture2D(u_input, vec2(gl_FragCoord.x, evenIndex + u_transformSize * 0.5 + 0.5) / u_transformSize);
    #endif

    float twArg = -2.0 * PI * (index / u_subtransformSize);
    vec2 twiddle = vec2(cos(twArg), sin(twArg));

    vec2 outA = even.xy + mulC(twiddle, odd.xy);
    vec2 outB = even.zw + mulC(twiddle, odd.zw);
    gl_FragColor = vec4(outA, outB);
  }
`;

// Normal map: cross-product gradient on the displacement field
const normalMapFS = /* glsl */ `
  precision highp float;
  uniform sampler2D u_displacementMap;
  uniform float u_resolution;
  uniform float u_size;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float texel = 1.0 / u_resolution;
    float texelSize = u_size / u_resolution;

    vec3 center = texture2D(u_displacementMap, uv).rgb;
    vec3 right  = vec3(texelSize, 0.0, 0.0) + texture2D(u_displacementMap, uv + vec2(texel, 0.0)).rgb - center;
    vec3 left   = vec3(-texelSize, 0.0, 0.0) + texture2D(u_displacementMap, uv + vec2(-texel, 0.0)).rgb - center;
    vec3 top    = vec3(0.0, 0.0, -texelSize) + texture2D(u_displacementMap, uv + vec2(0.0, -texel)).rgb - center;
    vec3 bottom = vec3(0.0, 0.0, texelSize) + texture2D(u_displacementMap, uv + vec2(0.0, texel)).rgb - center;

    vec3 tr = cross(right, top);
    vec3 tl = cross(top, left);
    vec3 bl = cross(left, bottom);
    vec3 br = cross(bottom, right);

    gl_FragColor = vec4(normalize(tr + tl + bl + br), 1.0);
  }
`;

// Ocean vertex: position + displacement (scaled by mesh/patch ratio). Direct
// port of david.li's OCEAN_VERTEX_SOURCE — uv is sampled in [0,1] and the
// displacement value is scaled up by (geometrySize/size).
const oceanVS = /* glsl */ `
  precision highp float;
  uniform float u_size;
  uniform float u_geometrySize;
  uniform sampler2D u_displacementMap;
  uniform float u_tiling; // 1 = one patch stretched over the mesh (david.li); n = true-scale tiles
  uniform float u_worldUv; // voyage: sample the repeating patch by world position, in meters

  varying vec3 v_position;
  varying vec2 v_coordinates;

  void main() {
    vec2 tuv = u_worldUv > 0.5 ? vec2(position.x, -position.z) / u_size : uv * u_tiling;
    float scale = u_worldUv > 0.5 ? 1.0 : u_geometrySize / u_size / u_tiling;
    vec3 displacement = texture2D(u_displacementMap, tuv).rgb * scale;
    vec3 pos = position + displacement;
    v_position = pos;
    v_coordinates = tuv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Ocean fragment: fresnel + diffuse + HDR tone-map (lifted from david.li)
// Time-of-day sky shared by the voyage sky dome and the water's reflections,
// so the horizon line matches exactly. Colors come from ocean/sky.ts.
// d = view direction, S = direction to the sun (or moon).
export const DUSK_SKY = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uBand;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uDisc;
  uniform float uDiscSize;
  uniform float uStars;
  vec3 duskSky(vec3 d, vec3 S) {
    float e = max(d.y, 0.0);
    float t = pow(e, 0.35);
    vec3 c = mix(uHorizon, uBand, smoothstep(0.0, 0.55, t));
    c = mix(c, uZenith, smoothstep(0.5, 1.0, t));
    float s = max(dot(d, S), 0.0);
    c += uGlow * pow(s, 14.0) * (1.0 - t * 0.6);
    c += uDisc * pow(s, uDiscSize);
    return c;
  }
  // stars only in the dome (not reflected), so they don't sparkle on the water
  vec3 starfield(vec3 d) {
    if (uStars <= 0.0 || d.y <= 0.02) return vec3(0.0);
    vec3 q = d * 260.0;
    vec3 cell = floor(q);
    float h = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    vec3 f = fract(q) - 0.5;
    float star = smoothstep(0.08, 0.0, length(f)) * step(0.985, h);
    return vec3(0.9, 0.95, 1.0) * star * uStars * smoothstep(0.02, 0.2, d.y) * (0.5 + 2.0 * fract(h * 97.0));
  }
  vec3 duskTone(vec3 c) { return 1.0 - exp(-c * 1.15); }
`;

const oceanFS = /* glsl */ `
  precision highp float;
  uniform sampler2D u_normalMap;
  uniform vec3 u_cameraPosition;
  uniform vec3 u_oceanColor;
  uniform vec3 u_skyColor;
  uniform vec3 u_sunDirection;
  uniform float u_exposure;
  uniform float u_alpha;
  uniform vec3 u_fogColor;
  uniform float u_fogNear;
  uniform float u_fogFar;
  uniform float u_depth; // 0 = david.li shading; 1 = voyage: deeper color, crest glow, whitecaps

  varying vec3 v_position;
  varying vec2 v_coordinates;

  vec3 hdr(vec3 color, float exposure) {
    return 1.0 - exp(-color * exposure);
  }

  ${DUSK_SKY}
  uniform vec3 uDeep;
  uniform vec3 uCrest;
  uniform vec3 uFoam;

  // Voyage at dusk: deep water mirrors the sunset sky; a glitter path runs to the sun
  vec4 shadeDusk(vec3 N, vec3 V) {
    vec3 S = normalize(u_sunDirection);
    float NdotV = max(dot(N, V), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 refl = duskSky(R, S);
    // body color: dark sea, a little teal light through thin crests
    float h = v_position.y;
    vec3 body = uDeep * (0.35 + 0.65 * max(dot(N, S), 0.0))
              + uCrest * smoothstep(0.0, 3.0, h) * (1.0 - fres);
    vec3 color = mix(body, refl, fres);
    // breaking crests catch the last light
    float steep = 1.0 - N.y;
    float foam = smoothstep(0.42, 0.68, steep) * smoothstep(1.6, 3.2, h);
    float dist = length(u_cameraPosition.xz - v_position.xz);
    foam *= 1.0 - smoothstep(250.0, 900.0, dist);
    color = mix(color, uFoam, clamp(foam, 0.0, 0.85));
    // haze into the sky dome's horizon color at this bearing
    vec3 toward = normalize(vec3(-V.x, 0.0, -V.z));
    float fog = smoothstep(u_fogNear, u_fogFar, dist);
    color = mix(color, duskSky(toward, S), fog);
    return vec4(duskTone(color), u_alpha);
  }

  void main() {
    vec3 normal = texture2D(u_normalMap, v_coordinates).rgb;
    vec3 view = normalize(u_cameraPosition - v_position);
    if (u_depth > 0.0) {
      gl_FragColor = shadeDusk(normal, view);
      return;
    }
    float NdotV = max(dot(normal, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    vec3 sky = fresnel * u_skyColor;
    float diffuse = clamp(dot(normal, normalize(u_sunDirection)), 0.0, 1.0);
    vec3 water = (1.0 - fresnel) * u_oceanColor * u_skyColor * diffuse;
    vec3 color = sky + water;
    vec3 outColor = hdr(color, u_exposure);
    // haze toward the horizon so the mesh edge melts into the sky
    float fog = smoothstep(u_fogNear, u_fogFar, length(u_cameraPosition.xz - v_position.xz));
    gl_FragColor = vec4(mix(outColor, u_fogColor, fog), u_alpha);
  }
`;

// ===================== Component =====================

export type FFTParams = {
  windX: number;
  windZ: number;
  size: number;
  choppiness: number;
};

const DEFAULTS: FFTParams = {
  windX: 12,
  windZ: 12,
  size: 250,
  choppiness: 2.3,
};

/** Lets a caller add objects to the ocean scene and steer the wind. */
export type OceanSceneHook = (ctx: {
  THREE: typeof THREENS;
  scene: THREENS.Scene;
  camera: THREENS.PerspectiveCamera;
  renderer: THREENS.WebGLRenderer;
  setWind: (x: number, z: number) => void;
  /** Water surface height (m) at world (x, z) for the current frame. */
  sampleHeight: (x: number, z: number) => number;
  /** Repaint sky and water for a time of day (see ocean/sky.ts). */
  setSky: (sky: SkyState) => void;
}) => { tick: (t: number, dt: number) => void; dispose: () => void };

/** Maps between world space (y up, patch centered at the origin) and canvas pixels. */
export type OceanView = {
  width: number;
  height: number;
  project: (x: number, y: number, z: number) => [number, number];
  /** Pixel to the point on the y=0 plane under it, or null if it misses. */
  ground: (px: number, py: number) => [number, number] | null;
};

export default function FFTOceanCanvas({
  params,
  transparent = false,
  variant = "backdrop",
  onView,
  sceneHook,
}: {
  params?: Partial<FFTParams>;
  transparent?: boolean;
  /** backdrop: endless sea filling the screen. specimen: one patch floating on the page. */
  variant?: "backdrop" | "specimen" | "voyage";
  onView?: (view: OceanView) => void;
  /** voyage: add objects (the ship) to the scene; read once at mount */
  sceneHook?: OceanSceneHook;
}) {
  const specimen = variant === "specimen";
  const voyage = variant === "voyage";
  const sceneHookRef = useRef(sceneHook);
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<FFTParams>({ ...DEFAULTS, ...params });
  useEffect(() => {
    paramsRef.current = { ...DEFAULTS, ...params };
  }, [params]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      let THREE: typeof THREENS;
      try {
        THREE = await loadThree();
      } catch (e) {
        console.error("[FFTOcean] three load failed:", e);
        return;
      }
      if (cancelled || !containerRef.current) return;

      // david.li runs a 512 grid; voyage matches it on desktop, phones keep 256
      const mobile = window.matchMedia("(max-width: 768px)").matches;
      const RES = voyage && !mobile ? 512 : RESOLUTION;
      const LOG2_RES = Math.log2(RES);

      // Fullscreen quad scene used for every render-to-texture pass
      const quadScene = new THREE.Scene();
      const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quadGeom = new THREE.BufferGeometry();
      // 3-component position so Three's auto-bound `position` attribute works
      const quadVerts = new Float32Array([
        -1, -1, 0,
         1, -1, 0,
        -1,  1, 0,
         1,  1, 0,
      ]);
      quadGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(quadVerts, 3),
      );
      quadGeom.setIndex(
        new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1),
      );
      quadGeom.computeBoundingSphere();
      const quadMesh = new THREE.Mesh(quadGeom);
      quadMesh.frustumCulled = false;
      quadScene.add(quadMesh);

      const renderPass = (
        target: THREENS.WebGLRenderTarget | null,
        material: THREENS.ShaderMaterial,
      ) => {
        quadMesh.material = material;
        renderer.setRenderTarget(target);
        renderer.render(quadScene, quadCamera);
      };

      // -- Scene --
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(specimen ? 28 : voyage ? 42 : 60, 1, 1, 12000);
      // Steeper downward look so the horizon sits above the viewport — the
      // visible frame is filled with water instead of a sliver of sky.
      const ORBIT = new THREE.Vector3(0, 0, -200);
      const camDist = 700;
      const az = 0.0;
      const elev = 0.78;
      camera.position.set(
        camDist * Math.cos(elev) * Math.sin(-az) + ORBIT.x,
        camDist * Math.sin(elev) + ORBIT.y,
        camDist * Math.cos(elev) * Math.cos(-az) + ORBIT.z,
      );
      camera.lookAt(ORBIT);
      if (voyage) {
        // standing on a low cliff: horizon sits high in the frame, open sea below
        // looking down on the water like david.li's demo, horizon near the top edge
        camera.position.set(0, 60, 0);
        camera.lookAt(0, 0, -260);
      }
      if (specimen) {
        // A three-quarter view of a single patch, like a specimen on a table
        const s = paramsRef.current.size;
        const d = s * 3.05;
        const az = -0.62, el = 0.5;
        camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
        camera.lookAt(0, -s * 0.04, 0);
      }

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: transparent || specimen,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(new THREE.Color("#0a1828"), transparent || specimen ? 0 : 1);

      const gl = renderer.getContext() as WebGL2RenderingContext;
      // WebGL2 ships with float render targets but we still need this for filtering
      gl.getExtension("OES_texture_float_linear");
      gl.getExtension("EXT_color_buffer_float");

      // -- Render targets --
      const baseOpts: THREENS.RenderTargetOptions = {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      };
      const linOpts: THREENS.RenderTargetOptions = {
        ...baseOpts,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        // david.li uses CLAMP_TO_EDGE for displacement + normal — sampling is
        // in [0,1] so wrap mode doesn't actually matter for visible output
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
      };

      const initialSpectrumRT = new THREE.WebGLRenderTarget(
        RES,
        RES,
        { ...baseOpts, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping },
      );
      const pingPhaseRT = new THREE.WebGLRenderTarget(RES, RES, baseOpts);
      const pongPhaseRT = new THREE.WebGLRenderTarget(RES, RES, baseOpts);
      const spectrumRT = new THREE.WebGLRenderTarget(RES, RES, baseOpts);
      const displacementRT = new THREE.WebGLRenderTarget(RES, RES, linOpts);
      const normalRT = new THREE.WebGLRenderTarget(
        RES,
        RES,
        voyage
          ? { ...linOpts, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }
          : linOpts,
      );
      if (voyage) {
        for (const t of [displacementRT.texture, normalRT.texture]) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
        }
        normalRT.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      const pingFFTRT = new THREE.WebGLRenderTarget(RES, RES, baseOpts);
      const pongFFTRT = new THREE.WebGLRenderTarget(RES, RES, baseOpts);

      // -- Seed pingPhase with random phases [0, 2pi). gl_FragCoord-based so
      // we don't depend on the varying mechanic --
      {
        const seedMat = new THREE.ShaderMaterial({
          uniforms: {
            u_seed: { value: Math.random() * 1000 },
            u_res: { value: RES },
          },
          vertexShader: fullscreenVS,
          // Random starting phase per wave — the spectrum itself is deterministic,
          // so these phases are the only source of randomness in the sea state.
          fragmentShader: `
            precision highp float;
            uniform float u_seed;
            float hash(vec2 p) {
              p = fract(p * vec2(123.34, 456.21) + u_seed);
              p += dot(p, p + 45.32);
              return fract(p.x * p.y);
            }
            void main() {
              gl_FragColor = vec4(hash(gl_FragCoord.xy) * 6.28318530718, 0.0, 0.0, 1.0);
            }
          `,
        });
        renderPass(pingPhaseRT, seedMat);
        seedMat.dispose();
      }

      // -- Materials --
      const mkMat = (fs: string, uniforms: Record<string, { value: unknown }>) =>
        new THREE.ShaderMaterial({
          vertexShader: fullscreenVS,
          fragmentShader: fs,
          uniforms,
        });

      const initialSpectrumMat = mkMat(initialSpectrumFS, {
        u_wind: { value: new THREE.Vector2() },
        u_resolution: { value: RES },
        u_size: { value: paramsRef.current.size },
      });
      const phaseMat = mkMat(phaseFS, {
        u_phases: { value: null },
        u_deltaTime: { value: 0 },
        u_resolution: { value: RES },
        u_size: { value: paramsRef.current.size },
      });
      const spectrumMat = mkMat(spectrumFS, {
        u_phases: { value: null },
        u_initialSpectrum: { value: initialSpectrumRT.texture },
        u_size: { value: paramsRef.current.size },
        u_resolution: { value: RES },
        u_choppiness: { value: paramsRef.current.choppiness },
      });
      const horizFFTMat = new THREE.ShaderMaterial({
        vertexShader: fullscreenVS,
        fragmentShader: "#define HORIZONTAL\n" + subtransformFSBase,
        uniforms: {
          u_input: { value: null },
          u_transformSize: { value: RES },
          u_subtransformSize: { value: 2 },
        },
      });
      const vertFFTMat = new THREE.ShaderMaterial({
        vertexShader: fullscreenVS,
        fragmentShader: subtransformFSBase,
        uniforms: {
          u_input: { value: null },
          u_transformSize: { value: RES },
          u_subtransformSize: { value: 2 },
        },
      });
      const normalMapMat = mkMat(normalMapFS, {
        u_displacementMap: { value: displacementRT.texture },
        u_resolution: { value: RES },
        u_size: { value: paramsRef.current.size },
      });

      // -- Compute spectrum once for the current wind --
      const setWindUniform = () => {
        initialSpectrumMat.uniforms.u_wind.value.set(
          paramsRef.current.windX,
          paramsRef.current.windZ,
        );
      };
      setWindUniform();
      renderPass(initialSpectrumRT, initialSpectrumMat);

      // -- Ocean mesh --
      // Specimen: exactly one FFT patch, so displacement maps 1:1 onto the mesh
      const geometrySize = specimen ? paramsRef.current.size : GEOMETRY_SIZE;
      let oceanGeom: THREENS.BufferGeometry;
      if (voyage) {
        // Radial grid around the (fixed) camera: rings spaced exponentially, so
        // vertices are ~1 m apart near the ship and stretch out toward the horizon.
        const NA = mobile ? 260 : 520, NR = mobile ? 220 : 420;
        const R0 = 40, R1 = 4200, A0 = -1.45, A1 = 1.45; // radians either side of -z
        const pos = new Float32Array(NA * NR * 3);
        for (let r = 0; r < NR; r++) {
          const rad = R0 * Math.pow(R1 / R0, r / (NR - 1));
          for (let a = 0; a < NA; a++) {
            const ang = A0 + ((A1 - A0) * a) / (NA - 1);
            const i = (r * NA + a) * 3;
            pos[i] = Math.sin(ang) * rad;
            pos[i + 2] = -Math.cos(ang) * rad;
          }
        }
        const index = new Uint32Array((NA - 1) * (NR - 1) * 6);
        let k = 0;
        for (let r = 0; r < NR - 1; r++)
          for (let a = 0; a < NA - 1; a++) {
            const i0 = r * NA + a, i1 = i0 + 1, i2 = i0 + NA, i3 = i2 + 1;
            // counter-clockwise seen from above, so the faces point up
            index[k++] = i0; index[k++] = i1; index[k++] = i2;
            index[k++] = i1; index[k++] = i3; index[k++] = i2;
          }
        oceanGeom = new THREE.BufferGeometry();
        oceanGeom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        oceanGeom.setIndex(new THREE.BufferAttribute(index, 1));
        oceanGeom.computeBoundingSphere();
      } else {
        oceanGeom = new THREE.PlaneGeometry(
          geometrySize,
          geometrySize,
          GEOMETRY_RESOLUTION - 1,
          GEOMETRY_RESOLUTION - 1,
        );
        oceanGeom.rotateX(-Math.PI / 2);
      }

      // Time-of-day colors, shared by the water and the sky dome (voyage only)
      const skyUniforms = {
        uZenith: { value: new THREE.Vector3() },
        uBand: { value: new THREE.Vector3() },
        uHorizon: { value: new THREE.Vector3() },
        uGlow: { value: new THREE.Vector3() },
        uDisc: { value: new THREE.Vector3() },
        uDiscSize: { value: 2400 },
        uStars: { value: 0 },
        uDeep: { value: new THREE.Vector3() },
        uCrest: { value: new THREE.Vector3() },
        uFoam: { value: new THREE.Vector3() },
      };
      const oceanMat = new THREE.ShaderMaterial({
        vertexShader: oceanVS,
        fragmentShader: oceanFS,
        uniforms: {
          u_displacementMap: { value: displacementRT.texture },
          u_normalMap: { value: normalRT.texture },
          u_size: { value: paramsRef.current.size },
          u_geometrySize: { value: geometrySize },
          // voyage tiles the patch at real scale so waves stay wave-sized near a low camera
          u_tiling: { value: 1 },
          u_worldUv: { value: voyage ? 1 : 0 },
          u_cameraPosition: { value: new THREE.Vector3() },
          u_oceanColor: { value: new THREE.Color(0.004, 0.016, 0.047) },
          // a low camera sees mostly grazing reflections; voyage dims the sky so they don't blow out
          u_skyColor: { value: new THREE.Color(3.2, 9.6, 12.8) },
          u_sunDirection: {
            // voyage: a setting sun just above the horizon, ahead and to the right
            value: voyage
              ? new THREE.Vector3(0.5, 0.06, -0.86).normalize()
              : new THREE.Vector3(-1.0, 1.0, 1.0).normalize(),
          },
          u_exposure: { value: voyage ? 0.27 : 0.35 }, // voyage sits under text; a touch deeper
          u_alpha: { value: transparent ? 0.97 : 1.0 },
          u_fogColor: { value: new THREE.Color(0xdbe9f1) },
          u_fogNear: { value: voyage ? 1100 : 1e6 },
          u_fogFar: { value: voyage ? 3800 : 2e6 },
          u_depth: { value: voyage ? 1 : 0 },
          ...skyUniforms,
        },
        transparent,
      });
      const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
      scene.add(oceanMesh);

      // Read the simulated height under a world point straight from the displacement
      // target (one texel; cheap enough for a handful of probes per frame).
      const probe = new Uint16Array(4);
      const tiling = voyage ? geometrySize / paramsRef.current.size : 1;
      const sampleHeight = (x: number, z: number) => {
        const size = paramsRef.current.size;
        const u = voyage ? x / size : ((x + geometrySize / 2) / geometrySize) * tiling;
        const v = voyage ? -z / size : ((-z + geometrySize / 2) / geometrySize) * tiling;
        const tx = Math.floor((u - Math.floor(u)) * RES);
        const ty = Math.floor((v - Math.floor(v)) * RES);
        try {
          renderer.readRenderTargetPixels(displacementRT, tx, ty, 1, 1, probe);
        } catch {
          return 0;
        }
        return THREE.DataUtils.fromHalfFloat(probe[1]) * (voyage ? 1 : geometrySize / size / tiling);
      };

      // Voyage: daylight sky and whatever the caller sails on the water
      let hook: ReturnType<OceanSceneHook> | null = null;
      if (voyage) {
        // Sky dome around the camera, shaded with the same dusk function as the water
        const skyMat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          uniforms: { u_sun: { value: oceanMat.uniforms.u_sunDirection.value }, ...skyUniforms },
          vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
              vDir = normalize(position);
              vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              gl_Position = p.xyww; // pin to the far plane
            }
          `,
          fragmentShader: /* glsl */ `
            uniform vec3 u_sun;
            varying vec3 vDir;
            ${DUSK_SKY}
            void main() {
              vec3 d = normalize(vDir);
              gl_FragColor = vec4(duskTone(duskSky(d, normalize(u_sun)) + starfield(d)), 1.0);
            }
          `,
        });
        const skyDome = new THREE.Mesh(new THREE.SphereGeometry(8000, 48, 24), skyMat);
        skyDome.position.copy(camera.position);
        skyDome.renderOrder = -1;
        skyDome.frustumCulled = false;
        scene.add(skyDome);
        renderer.setClearColor(0x0b1020, 1);
        hook =
          sceneHookRef.current?.({
            THREE,
            scene,
            camera,
            renderer,
            setWind: (x, z) => {
              paramsRef.current = { ...paramsRef.current, windX: x, windZ: z };
            },
            sampleHeight,
            setSky: (k) => {
              const u = skyUniforms;
              u.uZenith.value.fromArray(k.zenith);
              u.uBand.value.fromArray(k.band);
              u.uHorizon.value.fromArray(k.horizon);
              u.uGlow.value.fromArray(k.glow);
              u.uDisc.value.fromArray(k.disc);
              u.uDiscSize.value = k.discSize;
              u.uStars.value = k.stars;
              u.uDeep.value.fromArray(k.deep);
              u.uCrest.value.fromArray(k.crest);
              u.uFoam.value.fromArray(k.foam);
              (oceanMat.uniforms.u_sunDirection.value as THREENS.Vector3).fromArray(k.lightDir).normalize();
            },
          }) ?? null;
      }

      // -- Sizing --
      const resize = () => {
        const rect = container.getBoundingClientRect();
        const MAX = 4096;
        const w = Math.max(1, Math.min(Math.round(rect.width), MAX));
        const h = Math.max(1, Math.min(Math.round(rect.height), MAX));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        const v = new THREE.Vector3();
        const ray = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        onViewRef.current?.({
          width: w,
          height: h,
          project: (x, y, z) => {
            v.set(x, y, z).project(camera);
            return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
          },
          ground: (px, py) => {
            ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), camera);
            const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
            return hit ? [hit.x, hit.z] : null;
          },
        });
      };
      container.appendChild(renderer.domElement);
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      window.addEventListener("resize", resize);

      // -- 2D inverse FFT helper --
      // david's loop layout: log2(N)*2 iterations total. First half horiz,
      // second half vert. Source = spectrum on i=0. Output = displacement
      // on i=iterations-1. Even i writes to pingFFT, odd to pongFFT.
      const runFFT = () => {
        const iterations = LOG2_RES * 2;
        let mat = horizFFTMat;
        for (let i = 0; i < iterations; i++) {
          let target: THREENS.WebGLRenderTarget;
          let inputTex: THREENS.Texture;
          if (i === 0) {
            target = pingFFTRT;
            inputTex = spectrumRT.texture;
          } else if (i === iterations - 1) {
            target = displacementRT;
            inputTex = iterations % 2 === 0 ? pingFFTRT.texture : pongFFTRT.texture;
          } else if (i % 2 === 1) {
            target = pongFFTRT;
            inputTex = pingFFTRT.texture;
          } else {
            target = pingFFTRT;
            inputTex = pongFFTRT.texture;
          }
          if (i === iterations / 2) mat = vertFFTMat;
          mat.uniforms.u_input.value = inputTex;
          mat.uniforms.u_subtransformSize.value = Math.pow(
            2,
            (i % (iterations / 2)) + 1,
          );
          renderPass(target, mat);
        }
      };

      // -- Main loop --
      const clock = new THREE.Clock();
      let frameId = 0;
      let pingPhase = true;
      // Phases advance linearly by omega(k) * dt and are wrapped mod 2π in
      // the shader, so a single large dt on the first frame is equivalent to
      // running ~600 small steps. This warm-starts the simulation so the user
      // sees a developed wave field instantly on page load.
      let warmupRemaining = 10.0;
      let lastWindKey =
        paramsRef.current.windX + paramsRef.current.windZ * 13 +
        paramsRef.current.size * 17;

      const tick = () => {
        const p = paramsRef.current;
        const windKey = p.windX + p.windZ * 13 + p.size * 17;
        if (windKey !== lastWindKey) {
          setWindUniform();
          initialSpectrumMat.uniforms.u_size.value = p.size;
          phaseMat.uniforms.u_size.value = p.size;
          spectrumMat.uniforms.u_size.value = p.size;
          normalMapMat.uniforms.u_size.value = p.size;
          oceanMat.uniforms.u_size.value = p.size;
          renderPass(initialSpectrumRT, initialSpectrumMat);
          lastWindKey = windKey;
        }

        let dt = Math.min(clock.getDelta(), 1 / 30);
        if (warmupRemaining > 0) {
          dt += warmupRemaining;
          warmupRemaining = 0;
        }

        // 1) phase ping-pong
        phaseMat.uniforms.u_phases.value = pingPhase
          ? pingPhaseRT.texture
          : pongPhaseRT.texture;
        phaseMat.uniforms.u_deltaTime.value = dt;
        renderPass(pingPhase ? pongPhaseRT : pingPhaseRT, phaseMat);
        pingPhase = !pingPhase;

        // 2) spectrum
        spectrumMat.uniforms.u_phases.value = pingPhase
          ? pingPhaseRT.texture
          : pongPhaseRT.texture;
        spectrumMat.uniforms.u_choppiness.value = p.choppiness;
        renderPass(spectrumRT, spectrumMat);

        // 3) FFT -> displacement
        runFFT();

        // 4) normal map
        renderPass(normalRT, normalMapMat);

        // 5) render scene
        hook?.tick(clock.elapsedTime, dt);
        oceanMat.uniforms.u_cameraPosition.value.copy(camera.position);
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);

        frameId = visible ? requestAnimationFrame(tick) : 0;
      };
      // Pause the simulation while the canvas is scrolled out of view
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        const was = visible;
        visible = e.isIntersecting;
        if (visible && !was) {
          clock.getDelta();
          frameId = requestAnimationFrame(tick);
        }
      });
      io.observe(container);
      tick();

      cleanup = () => {
        cancelAnimationFrame(frameId);
        hook?.dispose();
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("resize", resize);
        [
          initialSpectrumRT,
          pingPhaseRT,
          pongPhaseRT,
          spectrumRT,
          displacementRT,
          normalRT,
          pingFFTRT,
          pongFFTRT,
        ].forEach((rt) => rt.dispose());
        quadGeom.dispose();
        oceanGeom.dispose();
        oceanMat.dispose();
        initialSpectrumMat.dispose();
        phaseMat.dispose();
        spectrumMat.dispose();
        horizFFTMat.dispose();
        vertFFTMat.dispose();
        normalMapMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent, specimen, voyage]);

  return <div ref={containerRef} className="ocean-canvas-host" />;
}

