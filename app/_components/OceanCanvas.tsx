"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";

/**
 * Vanilla-Three.js Gerstner-wave ocean.
 *
 * Three.js is NOT bundled. At runtime we dynamic-import it from esm.sh via a
 * Function() trick so neither webpack nor turbopack tries to resolve "three"
 * at build time. The browser fetches Three from the CDN only when this
 * component actually mounts (i.e. only when the ocean theme is active).
 *
 * Same shader runs in the page background and on /lab/waves; when `params`
 * is passed the uniforms are live-updated each frame.
 */

export type WaveParams = {
  steepness1: number;
  steepness2: number;
  steepness3: number;
  speed: number;
  sunAzimuth: number; // degrees
  sunElevation: number; // degrees
};

const DEFAULT_PARAMS: WaveParams = {
  steepness1: 0.2,
  steepness2: 0.14,
  steepness3: 0.1,
  speed: 1,
  sunAzimuth: 35,
  sunElevation: 40,
};

const THREE_CDN = "https://esm.sh/three@0.180.0";

// Bundler-invisible dynamic import: `Function` body isn't statically analyzed
// by webpack/turbopack, so they don't try to resolve "three" at build time.
async function loadThree(): Promise<typeof THREENS> {
  return new Function("u", "return import(u)")(THREE_CDN);
}

const vertexShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSteepness1;
  uniform float uSteepness2;
  uniform float uSteepness3;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

  // 2D hash + value noise — used to break up the Gerstner regularity
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * (vnoise(p) - 0.5);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  vec3 gerstner(
    vec3 pos, vec2 direction, float steepness, float wavelength, float waveSpeed,
    inout vec3 tangent, inout vec3 binormal
  ) {
    float k = 6.28318530718 / wavelength;
    float c = sqrt(9.8 / k) * waveSpeed;
    vec2 d = normalize(direction);
    float f = k * dot(d, pos.xz) - c * uTime;
    float a = steepness / k;
    tangent  += vec3(-d.x*d.x*(steepness*sin(f)),  d.x*(steepness*cos(f)), -d.x*d.y*(steepness*sin(f)));
    binormal += vec3(-d.x*d.y*(steepness*sin(f)),  d.y*(steepness*cos(f)), -d.y*d.y*(steepness*sin(f)));
    return vec3(d.x*a*cos(f), a*sin(f), d.y*a*cos(f));
  }

  void main() {
    vec3 pos = position;
    vec3 tangent  = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    // Eight Gerstner waves spanning a wind cone — directions and wavelengths
    // chosen to feel statistically random rather than tiled
    float s1 = uSteepness1 * 1.3;
    float s2 = uSteepness2 * 1.3;
    float s3 = uSteepness3 * 1.3;

    vec3 d1 = gerstner(pos, vec2( 1.00,  0.12), s1 * 1.00, 6.20, uSpeed * 1.00, tangent, binormal);
    vec3 d2 = gerstner(pos, vec2( 0.73,  0.62), s1 * 0.80, 4.10, uSpeed * 1.20, tangent, binormal);
    vec3 d3 = gerstner(pos, vec2( 0.31,  0.95), s2 * 0.85, 2.70, uSpeed * 1.45, tangent, binormal);
    vec3 d4 = gerstner(pos, vec2(-0.42,  0.91), s2 * 0.70, 1.95, uSpeed * 1.70, tangent, binormal);
    vec3 d5 = gerstner(pos, vec2(-0.81,  0.27), s3 * 0.90, 1.35, uSpeed * 1.95, tangent, binormal);
    vec3 d6 = gerstner(pos, vec2( 0.55, -0.71), s3 * 0.75, 0.95, uSpeed * 2.20, tangent, binormal);
    vec3 d7 = gerstner(pos, vec2( 0.92,  0.34), s3 * 0.55, 0.62, uSpeed * 2.55, tangent, binormal);
    vec3 d8 = gerstner(pos, vec2(-0.18,  0.97), s3 * 0.40, 0.38, uSpeed * 2.90, tangent, binormal);

    vec3 sumD = d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8;

    // High-frequency noise for surface chop — breaks the periodic look
    float n = fbm(pos.xz * 0.9 + vec2(uTime * 0.6, uTime * 0.4));
    sumD.y += n * 0.18;

    vec3 displaced = pos + sumD;
    vec3 normal = normalize(cross(binormal, tangent));
    vWaveHeight = sumD.y;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uSunDirection;
  uniform vec3 uCameraPos;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyColor;
  uniform float uAlpha;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uSunDirection);
    vec3 H = normalize(L + V);

    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);

    // Lambert with moderate falloff
    float diffuseT = pow(NdotL, 1.8);
    vec3 baseColor = mix(uDeepColor, uShallowColor, diffuseT * 0.85);

    // Crest brightening — wave tops always pick up a cyan halo
    float crest = smoothstep(0.15, 0.7, vWaveHeight);
    baseColor = mix(baseColor, uShallowColor, crest * 0.35);

    // Subsurface — sun glow piercing wave backs
    float sss = pow(max(dot(-V, L), 0.0), 2.5) * smoothstep(0.0, 0.5, vWaveHeight);

    // Tight sun glint + broader crest rim (the cyan sparkle)
    float spec = pow(max(dot(N, H), 0.0), 70.0);
    float rim  = pow(max(dot(N, H), 0.0), 8.0) * 1.1;

    vec3 finalColor = baseColor
      + spec * vec3(1.0, 0.96, 0.86) * 2.2
      + rim * vec3(0.80, 0.98, 1.0)
      + sss * vec3(0.30, 0.70, 0.90);

    // Very mild fog — keep contrast even at far distances
    float distance = length(uCameraPos - vWorldPos);
    float fog = 1.0 - exp(-distance * 0.002);
    finalColor = mix(finalColor, uSkyColor, fog * 0.08);

    gl_FragColor = vec4(finalColor, uAlpha);
  }
`;

export default function OceanCanvas({
  params,
  transparent = true,
}: {
  params?: WaveParams;
  transparent?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // paramsRef stays mutable so the animation loop reads the latest values
  // without re-running the heavy useEffect on every prop change.
  const paramsRef = useRef<WaveParams>(params ?? DEFAULT_PARAMS);
  paramsRef.current = params ?? DEFAULT_PARAMS;

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
        console.error("[OceanCanvas] failed to load three from CDN:", e);
        return;
      }
      if (cancelled || !containerRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
      // Steep 3/4 view: high above, looking down ~55°. Plane is big enough
      // that the horizon line sits near the top of the frame.
      camera.position.set(0, 16, 14);
      camera.lookAt(0, 0, -6);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: transparent,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(new THREE.Color("#88b6da"), transparent ? 0 : 1);

      const sunVec = (az: number, el: number) => {
        const aRad = (az * Math.PI) / 180;
        const eRad = (el * Math.PI) / 180;
        return new THREE.Vector3(
          Math.cos(eRad) * Math.sin(aRad),
          Math.sin(eRad),
          Math.cos(eRad) * Math.cos(aRad),
        ).normalize();
      };

      const initial = paramsRef.current;
      const uniforms = {
        uTime: { value: 0 },
        uSpeed: { value: initial.speed },
        uSteepness1: { value: initial.steepness1 },
        uSteepness2: { value: initial.steepness2 },
        uSteepness3: { value: initial.steepness3 },
        uSunDirection: { value: sunVec(initial.sunAzimuth, initial.sunElevation) },
        uCameraPos: { value: new THREE.Vector3(0, 14, 18) },
        uDeepColor: { value: new THREE.Color("#01060d") },
        uShallowColor: { value: new THREE.Color("#85e0f5") },
        uSkyColor: { value: new THREE.Color("#88b6da") },
        uAlpha: { value: transparent ? 0.96 : 1.0 },
      };

      const geom = new THREE.PlaneGeometry(400, 400, 256, 256);
      // Bake the rotation into the geometry so vertex positions are in the
      // XZ plane locally. The shader reads pos.xz for wave phase — that
      // only makes sense after the rotation is applied to the verts, not
      // to the mesh.
      geom.rotateX(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -2;
      scene.add(mesh);

      container.appendChild(renderer.domElement);

      const resize = () => {
        // Size against the host's bounding rect with a hard cap. Container
        // can get stretched by flex/grid parents on long pages, producing a
        // WebGL framebuffer that hits browser limits (the 33554432 trap).
        const rect = container.getBoundingClientRect();
        const MAX = 4096;
        const w = Math.max(1, Math.min(Math.round(rect.width), MAX));
        const h = Math.max(1, Math.min(Math.round(rect.height), MAX));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const r = container.getBoundingClientRect();
      console.log(
        "[OceanCanvas] mounted",
        "size=", Math.round(r.width) + "x" + Math.round(r.height),
        "cameraPos=", camera.position.toArray(),
        "transparent=", transparent,
      );
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      let frameId = 0;

      const tick = () => {
        const p = paramsRef.current;
        uniforms.uSpeed.value = p.speed;
        uniforms.uSteepness1.value = p.steepness1;
        uniforms.uSteepness2.value = p.steepness2;
        uniforms.uSteepness3.value = p.steepness3;
        uniforms.uSunDirection.value.copy(sunVec(p.sunAzimuth, p.sunElevation));
        uniforms.uTime.value = clock.getElapsedTime();
        uniforms.uCameraPos.value.copy(camera.position);
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(frameId);
        ro.disconnect();
        window.removeEventListener("resize", resize);
        geom.dispose();
        mat.dispose();
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
    // transparent is captured at mount — changing it would re-init renderer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transparent]);

  return <div ref={containerRef} className="ocean-canvas-host" />;
}
