"use client";

import { useEffect, useRef } from "react";
import type * as THREENS from "three";
import { useThemeId } from "./useThemeId";

const THREE_URL = "https://esm.sh/three@0.180.0";
const ROOM_ENV_URL = "https://esm.sh/three@0.180.0/examples/jsm/environments/RoomEnvironment.js";

// Runtime CDN import — keeps Three out of the bundle.
function importCdn<T>(url: string): Promise<T> {
  return new Function("u", "return import(u)")(url) as Promise<T>;
}

/* =========================================================
   Elastic glass blob for the editorial hero.

   A refractive, iridescent glass body sits in front of soft
   brand-colored light. Its surface wobbles with 3D noise; it
   stretches toward the cursor on a spring (so it overshoots
   and settles like jelly), and a click sends a ripple across
   it. Normals are rebuilt in the vertex shader from the
   displaced surface so refraction follows every bulge.
   ========================================================= */

// Ashima simplex noise (MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const DISPLACE = /* glsl */ `
uniform float uTime;
uniform vec3 uPull;      // direction the blob is being pulled toward (object space)
uniform float uPullAmt;  // spring-driven stretch
uniform float uRipple;   // seconds since the last click (large = none)
uniform vec3 uRippleAt;
${NOISE}
float blobDisplace(vec3 p) {
  vec3 n = normalize(p);
  float d = snoise(n * 0.95 + vec3(0.0, uTime * 0.2, uTime * 0.06)) * 0.11
          + snoise(n * 1.9 - vec3(uTime * 0.15)) * 0.025;
  // jelly stretch toward the pull direction
  float facing = dot(n, uPull);
  d += uPullAmt * smoothstep(0.15, 1.0, facing) * (0.55 + 0.45 * facing);
  // click ripple: a ring that runs outward from the click point and decays
  float ang = acos(clamp(dot(n, uRippleAt), -1.0, 1.0));
  d += sin(ang * 9.0 - uRipple * 11.0) * exp(-uRipple * 2.2) * smoothstep(uRipple * 3.2 + 0.4, uRipple * 3.2 - 0.4, ang) * 0.07;
  return d;
}
vec3 blobPoint(vec3 p) { return normalize(p) * (1.0 + blobDisplace(p)); }
`;

export default function GlassBlob() {
  const theme = useThemeId();
  if (theme !== "editorial") return null;
  return <GlassBlobCanvas />;
}

function GlassBlobCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    Promise.all([
      importCdn<typeof THREENS>(THREE_URL),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      importCdn<any>(ROOM_ENV_URL),
    ])
      .then(([THREE, { RoomEnvironment }]) => {
        if (disposed || !host.isConnected) return;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(0xffffff, 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
        camera.position.set(0, 0, 6.2);

        // Soft brand light behind the glass: drifting purple/blue/teal pools that
        // fade to pure white at the edges, so the canvas melts into the page.
        const backdropMat = new THREE.ShaderMaterial({
          toneMapped: false,
          uniforms: { uTime: { value: 0 } },
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            varying vec2 vUv;
            float pool(vec2 uv, vec2 c, float r) {
              float d = length(uv - c);
              return exp(-d * d / (r * r));
            }
            void main() {
              vec2 uv = vUv - 0.5;
              float t = uTime * 0.12;
              // brand pools (editorial purple, deep teal, aqua) laid over white paper
              vec3 col = vec3(1.0);
              col = mix(col, vec3(0.41, 0.19, 0.76), 0.9 * pool(uv, vec2(-0.12 + 0.05 * sin(t * 1.3), 0.1 + 0.04 * cos(t)), 0.2));
              col = mix(col, vec3(0.12, 0.37, 0.45), 0.85 * pool(uv, vec2(0.14 + 0.04 * cos(t * 0.9), -0.12 + 0.05 * sin(t * 1.1)), 0.19));
              col = mix(col, vec3(0.39, 0.87, 0.87), 0.8 * pool(uv, vec2(0.05 * sin(t * 0.7), -0.03 + 0.04 * cos(t * 1.7)), 0.11));
              col = mix(col, vec3(0.36, 0.25, 0.66), 0.7 * pool(uv, vec2(0.13 * cos(t * 0.5), 0.15 * sin(t * 0.6)), 0.1));
              // fade to the page's white well inside the canvas edge
              float edge = smoothstep(0.47, 0.3, length(uv));
              gl_FragColor = vec4(mix(vec3(1.0), col, edge), 1.0);
            }
          `,
        });
        const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(4.75, 4.75), backdropMat);
        backdrop.position.z = -2.4;
        scene.add(backdrop);

        // The glass
        const uniforms = {
          uTime: { value: 0 },
          uPull: { value: new THREE.Vector3(0, 0, 1) },
          uPullAmt: { value: 0 },
          uRipple: { value: 99 },
          uRippleAt: { value: new THREE.Vector3(0, 0, 1) },
        };
        const glass = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.06,
          transmission: 1,
          thickness: 1.6,
          ior: 1.48,
          dispersion: 2.5,
          iridescence: 0.55,
          iridescenceIOR: 1.35,
          clearcoat: 1,
          clearcoatRoughness: 0.04,
          attenuationColor: new THREE.Color(0xe4d8ff),
          attenuationDistance: 3,
          envMapIntensity: 1.25,
          specularIntensity: 1,
        });
        glass.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\n" + DISPLACE)
            .replace(
              "#include <beginnormal_vertex>",
              /* glsl */ `
              // rebuild the normal from the displaced surface
              vec3 bn = normalize(position);
              vec3 bt = normalize(cross(abs(bn.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), bn));
              vec3 bb = cross(bn, bt);
              float e = 0.012;
              vec3 q0 = blobPoint(position);
              vec3 q1 = blobPoint(position + bt * e);
              vec3 q2 = blobPoint(position + bb * e);
              vec3 objectNormal = normalize(cross(q1 - q0, q2 - q0));
              #ifdef USE_TANGENT
                vec3 objectTangent = vec3(tangent.xyz);
              #endif
              `
            )
            .replace("#include <begin_vertex>", "vec3 transformed = q0;");
        };
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 64), glass);
        blob.scale.setScalar(1.05);
        scene.add(blob);

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(-2, 3, 4);
        scene.add(key);

        // ---------- elastic interaction ----------
        const pull = { amt: 0, vel: 0, target: 0 };
        const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
        const pullDir = new THREE.Vector3(0, 0, 1);
        const pullTarget = new THREE.Vector3(0, 0, 1);
        const onMove = (e: PointerEvent) => {
          const r = host.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 2 - 1;
          const y = -((e.clientY - r.top) / r.height) * 2 + 1;
          const dist = Math.hypot(x, y);
          // pull grows as the cursor nears, then eases off far away
          pull.target = dist < 1.6 ? 0.2 * Math.min(1, 1.6 - dist + 0.35) : 0;
          pullTarget.set(x, y, 0.75).normalize();
          tilt.tx = y * 0.35;
          tilt.ty = x * 0.45;
        };
        const onLeave = () => {
          pull.target = 0;
          tilt.tx = tilt.ty = 0;
        };
        const onDown = () => {
          uniforms.uRipple.value = 0;
          uniforms.uRippleAt.value.copy(pullDir);
          pull.vel += 1.6; // a poke overshoots
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", onLeave);
        host.addEventListener("pointerdown", onDown);

        const resize = () => {
          const rect = host.getBoundingClientRect();
          const w = Math.min(Math.max(1, rect.width), 2048);
          const h = Math.min(Math.max(1, rect.height), 2048);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        let visible = true;
        const io = new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          if (visible && !raf && !reduceMotion) raf = requestAnimationFrame(tick);
        });
        io.observe(host);

        // The CSS blob stays as the no-WebGL fallback; hide it once glass is up
        const slot = host.parentElement;
        slot?.setAttribute("data-glass", "on");

        let last = performance.now() / 1000;
        let t = 0;
        const tick = () => {
          raf = 0;
          if (disposed) return;
          const now = performance.now() / 1000;
          const dt = Math.min(now - last, 0.05);
          last = now;
          t += dt;
          // springs: stiff enough to snap, light damping so it wobbles before settling
          pull.vel += ((pull.target - pull.amt) * 70 - pull.vel * 7) * dt;
          pull.amt += pull.vel * dt;
          tilt.vx += ((tilt.tx - tilt.x) * 40 - tilt.vx * 6) * dt;
          tilt.vy += ((tilt.ty - tilt.y) * 40 - tilt.vy * 6) * dt;
          tilt.x += tilt.vx * dt;
          tilt.y += tilt.vy * dt;
          pullDir.lerp(pullTarget, 1 - Math.exp(-dt * 10)).normalize();

          uniforms.uTime.value = t;
          uniforms.uPull.value.copy(pullDir).applyQuaternion(blob.quaternion.clone().invert());
          uniforms.uPullAmt.value = pull.amt;
          uniforms.uRipple.value += dt;
          backdropMat.uniforms.uTime.value = t;
          blob.rotation.set(tilt.x, t * 0.12 + tilt.y, 0);
          renderer.render(scene, camera);
          if (visible) raf = requestAnimationFrame(tick);
        };
        if (reduceMotion) renderer.render(scene, camera);
        else raf = requestAnimationFrame(tick);

        cleanup = () => {
          io.disconnect();
          ro.disconnect();
          window.removeEventListener("pointermove", onMove);
          document.documentElement.removeEventListener("pointerleave", onLeave);
          host.removeEventListener("pointerdown", onDown);
          slot?.removeAttribute("data-glass");
          blob.geometry.dispose();
          glass.dispose();
          backdrop.geometry.dispose();
          backdropMat.dispose();
          pmrem.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        // WebGL/CDN unavailable — the CSS blob remains
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, []);

  return <div ref={hostRef} className="glass-blob" />;
}
