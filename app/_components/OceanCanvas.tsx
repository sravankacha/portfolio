"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Gerstner-wave ocean shader.
 *
 * The plane is subdivided 256x256. Each vertex is displaced by the sum of four
 * Gerstner waves of varying direction, wavelength, steepness, and speed. The
 * fragment shader samples a fresnel term against the camera and a phong-style
 * specular against a fixed sun direction to give the surface depth and
 * highlights. Colours sample between deep navy and a brighter sky-blue at
 * crests.
 */

const vertexShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec3 vNormal;

  // Gerstner wave: returns (offsetX, offsetY, offsetZ) and contributes to normal.
  // We compute per-wave tangent contributions then build a normal at the end.
  vec3 gerstner(
    vec3 pos,
    vec2 direction,
    float steepness,
    float wavelength,
    float speed,
    inout vec3 tangent,
    inout vec3 binormal
  ) {
    float k = 6.28318530718 / wavelength;             // 2pi / wavelength
    float c = sqrt(9.8 / k) * speed;                  // phase speed
    vec2 d = normalize(direction);
    float f = k * dot(d, pos.xz) - c * uTime;
    float a = steepness / k;

    // Tangent contributions (Tessendorf 2001 / Gerstner)
    tangent  += vec3(
      -d.x * d.x * (steepness * sin(f)),
      d.x * (steepness * cos(f)),
      -d.x * d.y * (steepness * sin(f))
    );
    binormal += vec3(
      -d.x * d.y * (steepness * sin(f)),
      d.y * (steepness * cos(f)),
      -d.y * d.y * (steepness * sin(f))
    );

    return vec3(
      d.x * a * cos(f),
      a * sin(f),
      d.y * a * cos(f)
    );
  }

  void main() {
    vec3 pos = position;

    vec3 tangent  = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    vec3 d1 = gerstner(pos, vec2(1.0,  0.0), 0.20, 18.0, 1.0, tangent, binormal);
    vec3 d2 = gerstner(pos, vec2(0.7,  0.7), 0.14, 11.0, 1.3, tangent, binormal);
    vec3 d3 = gerstner(pos, vec2(0.3,  1.0), 0.10,  6.0, 1.6, tangent, binormal);
    vec3 d4 = gerstner(pos, vec2(-0.6, 0.5), 0.07,  3.0, 2.0, tangent, binormal);

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
  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 L = normalize(uSunDirection);
    vec3 H = normalize(L + V);

    // Fresnel (Schlick)
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 5.0);

    // Wave-height-driven base color
    float height = clamp(vWorldPos.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 baseColor = mix(uDeepColor, uShallowColor, smoothstep(-0.3, 0.6, vWorldPos.y));

    // Subsurface tint near crests
    baseColor += smoothstep(0.4, 1.2, vWorldPos.y) * vec3(0.08, 0.15, 0.20);

    // Sun specular
    float specPower = 120.0;
    float spec = pow(max(dot(N, H), 0.0), specPower);

    // Soft second highlight tail for shimmer
    float shimmer = pow(max(dot(N, H), 0.0), 28.0) * 0.35;

    // Sky reflection mix via fresnel
    vec3 reflection = mix(baseColor, uSkyColor, fresnel * 0.8);

    vec3 finalColor = reflection + spec * vec3(1.0, 0.95, 0.85) + shimmer * vec3(0.9, 0.95, 1.0);

    // Slight depth-fog at distance for the receding plane
    float distance = length(uCameraPos - vWorldPos);
    float fog = 1.0 - exp(-distance * 0.012);
    finalColor = mix(finalColor, uSkyColor, fog * 0.65);

    gl_FragColor = vec4(finalColor, 0.96);
  }
`;

function Water() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0.35, 0.7, 0.5).normalize() },
      uCameraPos: { value: new THREE.Vector3(0, 14, 18) },
      uDeepColor: { value: new THREE.Color("#012a4a") },
      uShallowColor: { value: new THREE.Color("#0077b6") },
      uSkyColor: { value: new THREE.Color("#cfeaff") },
    }),
    [],
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uCameraPos.value.copy(state.camera.position);
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -2, 0]}
    >
      <planeGeometry args={[200, 200, 256, 256]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export default function OceanCanvas() {
  return (
    <div className="ocean-canvas">
      <Canvas
        camera={{ position: [0, 14, 18], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Water />
      </Canvas>
    </div>
  );
}
