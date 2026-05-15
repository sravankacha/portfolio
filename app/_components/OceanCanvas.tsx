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
  sunElevation: 45,
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

    vec3 d1 = gerstner(pos, vec2(1.0, 0.0),  uSteepness1, 18.0, uSpeed * 1.0, tangent, binormal);
    vec3 d2 = gerstner(pos, vec2(0.7, 0.7),  uSteepness2, 11.0, uSpeed * 1.3, tangent, binormal);
    vec3 d3 = gerstner(pos, vec2(0.3, 1.0),  uSteepness3,  6.0, uSpeed * 1.6, tangent, binormal);
    vec3 d4 = gerstner(pos, vec2(-0.6, 0.5), uSteepness3 * 0.6, 3.0, uSpeed * 2.0, tangent, binormal);

    vec3 displaced = pos + d1 + d2 + d3 + d4;
    vec3 normal = normalize(cross(binormal, tangent));

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

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uSunDirection);
    vec3 H = normalize(L + V);

    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 5.0);

    vec3 baseColor = mix(uDeepColor, uShallowColor, smoothstep(-0.3, 0.6, vWorldPos.y));
    baseColor += smoothstep(0.4, 1.2, vWorldPos.y) * vec3(0.08, 0.15, 0.20);

    float spec = pow(max(dot(N, H), 0.0), 120.0);
    float shimmer = pow(max(dot(N, H), 0.0), 28.0) * 0.35;

    vec3 reflection = mix(baseColor, uSkyColor, fresnel * 0.8);
    vec3 finalColor = reflection + spec * vec3(1.0, 0.95, 0.85) + shimmer * vec3(0.9, 0.95, 1.0);

    float distance = length(uCameraPos - vWorldPos);
    float fog = 1.0 - exp(-distance * 0.012);
    finalColor = mix(finalColor, uSkyColor, fog * 0.65);

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
      const THREE = await loadThree();
      if (cancelled || !containerRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
      camera.position.set(0, 14, 18);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: transparent,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
        uDeepColor: { value: new THREE.Color("#012a4a") },
        uShallowColor: { value: new THREE.Color("#0077b6") },
        uSkyColor: { value: new THREE.Color("#cfeaff") },
        uAlpha: { value: transparent ? 0.96 : 1.0 },
      };

      const geom = new THREE.PlaneGeometry(200, 200, 256, 256);
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
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

  return <div ref={containerRef} className="ocean-canvas-host absolute inset-0" />;
}
