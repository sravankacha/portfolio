"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";

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
const LOG2_RESOLUTION = Math.log2(RESOLUTION);
const GEOMETRY_RESOLUTION = 256;  // mesh subdivision
const GEOMETRY_SIZE = 2000;        // mesh side length in world units
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

  varying vec3 v_position;
  varying vec2 v_coordinates;

  void main() {
    vec3 displacement = texture2D(u_displacementMap, uv).rgb * (u_geometrySize / u_size);
    vec3 pos = position + displacement;
    v_position = pos;
    v_coordinates = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Ocean fragment: fresnel + diffuse + HDR tone-map (lifted from david.li)
const oceanFS = /* glsl */ `
  precision highp float;
  uniform sampler2D u_normalMap;
  uniform sampler2D u_displacementMap;
  uniform sampler2D u_initialSpectrum;
  uniform sampler2D u_phaseTex;
  uniform sampler2D u_spectrumTex;
  uniform vec3 u_cameraPosition;
  uniform vec3 u_oceanColor;
  uniform vec3 u_skyColor;
  uniform vec3 u_sunDirection;
  uniform float u_exposure;
  uniform float u_alpha;

  varying vec3 v_position;
  varying vec2 v_coordinates;

  vec3 hdr(vec3 color, float exposure) {
    return 1.0 - exp(-color * exposure);
  }

  void main() {
    vec3 normal = texture2D(u_normalMap, v_coordinates).rgb;
    vec3 view = normalize(u_cameraPosition - v_position);
    float NdotV = max(dot(normal, view), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    vec3 sky = fresnel * u_skyColor;
    float diffuse = clamp(dot(normal, normalize(u_sunDirection)), 0.0, 1.0);
    vec3 water = (1.0 - fresnel) * u_oceanColor * u_skyColor * diffuse;
    vec3 color = sky + water;
    gl_FragColor = vec4(hdr(color, u_exposure), u_alpha);
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
  windX: 10,
  windZ: 10,
  size: 250,
  choppiness: 1.5,
};

export default function FFTOceanCanvas({
  params,
  transparent = false,
}: {
  params?: Partial<FFTParams>;
  transparent?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<FFTParams>({ ...DEFAULTS, ...params });
  paramsRef.current = { ...DEFAULTS, ...params };

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
      const camera = new THREE.PerspectiveCamera(60, 1, 1, 10000);
      // Match david.li camera: distance 1500 from orbit point (-200,0,600),
      // azimuth 0.4 rad, elevation 0.5 rad. Position works out to:
      //   x = 1500*cos(elev)*sin(-az) + orbit.x
      //   y = 1500*sin(elev) + orbit.y
      //   z = 1500*cos(elev)*cos(-az) + orbit.z
      const ORBIT = new THREE.Vector3(-200, 0, 600);
      const camDist = 1500;
      const az = 0.4;
      const elev = 0.5;
      camera.position.set(
        camDist * Math.cos(elev) * Math.sin(-az) + ORBIT.x,
        camDist * Math.sin(elev) + ORBIT.y,
        camDist * Math.cos(elev) * Math.cos(-az) + ORBIT.z,
      );
      camera.lookAt(ORBIT);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: transparent,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(new THREE.Color("#0a1828"), transparent ? 0 : 1);

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
        RESOLUTION,
        RESOLUTION,
        { ...baseOpts, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping },
      );
      const pingPhaseRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, baseOpts);
      const pongPhaseRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, baseOpts);
      const spectrumRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, baseOpts);
      const displacementRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, linOpts);
      const normalRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, linOpts);
      const pingFFTRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, baseOpts);
      const pongFFTRT = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, baseOpts);

      // -- Seed pingPhase with random phases [0, 2pi). gl_FragCoord-based so
      // we don't depend on the varying mechanic --
      {
        const seedMat = new THREE.ShaderMaterial({
          uniforms: {
            u_seed: { value: Math.random() * 1000 },
            u_res: { value: RESOLUTION },
          },
          vertexShader: fullscreenVS,
          fragmentShader: `
            precision highp float;
            void main() {
              // DEBUG: constant 3.14159 — TR should show medium gray (0.5)
              gl_FragColor = vec4(3.14159, 0.0, 0.0, 1.0);
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
        u_resolution: { value: RESOLUTION },
        u_size: { value: paramsRef.current.size },
      });
      const phaseMat = mkMat(phaseFS, {
        u_phases: { value: null },
        u_deltaTime: { value: 0 },
        u_resolution: { value: RESOLUTION },
        u_size: { value: paramsRef.current.size },
      });
      const spectrumMat = mkMat(spectrumFS, {
        u_phases: { value: null },
        u_initialSpectrum: { value: initialSpectrumRT.texture },
        u_size: { value: paramsRef.current.size },
        u_resolution: { value: RESOLUTION },
        u_choppiness: { value: paramsRef.current.choppiness },
      });
      const horizFFTMat = new THREE.ShaderMaterial({
        vertexShader: fullscreenVS,
        fragmentShader: "#define HORIZONTAL\n" + subtransformFSBase,
        uniforms: {
          u_input: { value: null },
          u_transformSize: { value: RESOLUTION },
          u_subtransformSize: { value: 2 },
        },
      });
      const vertFFTMat = new THREE.ShaderMaterial({
        vertexShader: fullscreenVS,
        fragmentShader: subtransformFSBase,
        uniforms: {
          u_input: { value: null },
          u_transformSize: { value: RESOLUTION },
          u_subtransformSize: { value: 2 },
        },
      });
      const normalMapMat = mkMat(normalMapFS, {
        u_displacementMap: { value: displacementRT.texture },
        u_resolution: { value: RESOLUTION },
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
      const oceanGeom = new THREE.PlaneGeometry(
        GEOMETRY_SIZE,
        GEOMETRY_SIZE,
        GEOMETRY_RESOLUTION - 1,
        GEOMETRY_RESOLUTION - 1,
      );
      oceanGeom.rotateX(-Math.PI / 2);

      const oceanMat = new THREE.ShaderMaterial({
        vertexShader: oceanVS,
        fragmentShader: oceanFS,
        uniforms: {
          u_displacementMap: { value: displacementRT.texture },
          u_normalMap: { value: normalRT.texture },
          u_initialSpectrum: { value: initialSpectrumRT.texture },
          u_phaseTex: { value: pingPhaseRT.texture },
          u_spectrumTex: { value: spectrumRT.texture },
          u_size: { value: paramsRef.current.size },
          u_geometrySize: { value: GEOMETRY_SIZE },
          u_cameraPosition: { value: new THREE.Vector3() },
          u_oceanColor: { value: new THREE.Color(0.004, 0.016, 0.047) },
          u_skyColor: { value: new THREE.Color(3.2, 9.6, 12.8) },
          u_sunDirection: {
            value: new THREE.Vector3(-1.0, 1.0, 1.0).normalize(),
          },
          u_exposure: { value: 0.35 },
          u_alpha: { value: transparent ? 0.97 : 1.0 },
        },
        transparent,
      });
      const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
      scene.add(oceanMesh);

      // -- Sizing --
      const resize = () => {
        const rect = container.getBoundingClientRect();
        const MAX = 4096;
        const w = Math.max(1, Math.min(Math.round(rect.width), MAX));
        const h = Math.max(1, Math.min(Math.round(rect.height), MAX));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
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
        const iterations = LOG2_RESOLUTION * 2;
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

        const dt = Math.min(clock.getDelta(), 1 / 30);

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
        oceanMat.uniforms.u_cameraPosition.value.copy(camera.position);
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);

        frameId = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(frameId);
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
  }, [transparent]);

  return <div ref={containerRef} className="ocean-canvas-host" />;
}

