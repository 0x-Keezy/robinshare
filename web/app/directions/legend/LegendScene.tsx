"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Scroll } from "@/lib/scrollProgress";

/*
 * LEGEND — el polo corporativo del bake-off: un CAMPO de barras de luz (los trades,
 * un chart de velas abstracto) respirando sobre un piso espejo casi-negro. Con el
 * scroll, la energía fluye hacia el VAULT: un monolito de luz verde que crece.
 * Registro Cyera (clean corporate), mismo backbone que Sherwood.
 */

const BASE_BG = "#04070a";
const VAULT_Z = -26;
const N_BARS = 420;

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* el campo de trades: instanced boxes con altura animada; los "verdes" emiten HDR */
function BarField() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => {
    const rand = mulberry32(20260712);
    const items: { x: number; z: number; phase: number; speed: number; hot: boolean; base: number }[] = [];
    for (let i = 0; i < N_BARS; i++) {
      // banda a cada lado de un pasillo central (|x|>=1.6), profundidad 18..-38
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (1.6 + rand() * 15);
      const z = 18 - rand() * 56;
      items.push({
        x,
        z,
        phase: rand() * Math.PI * 2,
        speed: 0.5 + rand() * 1.4,
        hot: rand() < 0.3, // ~30% de barras "verdes" (emisivas)
        base: 0.25 + rand() * 1.1,
      });
    }
    return items;
  }, []);

  const colors = useMemo(() => {
    const cold = new THREE.Color("#101820");
    const hot = new THREE.Color(0.06, 1.9, 0.35); // HDR → bloom
    const arr = new Float32Array(N_BARS * 3);
    data.forEach((d, i) => {
      const c = d.hot ? hot : cold;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    });
    return arr;
  }, [data]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    const p = Scroll.progress;
    // la "marea" hacia el vault crece con el scroll
    const surge = easeInOut(clamp01((p - 0.15) / 0.45));
    for (let i = 0; i < N_BARS; i++) {
      const d = data[i];
      const dist = Math.abs(d.z - VAULT_Z);
      // ola que viaja hacia el vault: fase depende de la distancia
      const wave = Math.sin(t * d.speed + d.phase + dist * 0.28 - t * surge * 2.2);
      const h = Math.max(0.06, d.base + wave * (0.3 + surge * 0.9) + surge * (10 / Math.max(4, dist)));
      dummy.position.set(d.x, h / 2, d.z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N_BARS]} frustumCulled={false}>
      <boxGeometry args={[0.09, 1, 0.09]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </boxGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

/* el VAULT: monolito de luz que crece con el scroll (el escrow acumulándose) */
function Vault() {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame(({ clock }) => {
    const p = Scroll.progress;
    const grow = 0.15 + easeInOut(clamp01((p - 0.18) / 0.5)) * 0.85;
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.03;
    if (core.current) {
      core.current.scale.set(1, grow * pulse, 1);
      core.current.position.y = (grow * pulse * 13) / 2;
    }
    if (halo.current) {
      // el halo NACE con el vault (si está desde el hero lee como orbe flotante)
      const a = easeInOut(clamp01((p - 0.12) / 0.5));
      (halo.current.material as THREE.MeshBasicMaterial).opacity = a * 0.85;
      halo.current.scale.setScalar(0.35 + a * 0.65);
    }
  });

  return (
    <group position={[0, 0, VAULT_Z]}>
      <mesh ref={core}>
        <boxGeometry args={[1.15, 13, 1.15]} />
        <meshBasicMaterial color={new THREE.Color(0.3, 4.8, 1.05)} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={halo} position={[0, 6, -0.8]}>
        <planeGeometry args={[16, 18]} />
        <meshBasicMaterial
          map={glowTex}
          color={new THREE.Color(0.04, 0.8, 0.2)}
          transparent
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
      <pointLight position={[0, 4, 3]} color="#00C805" intensity={300} distance={70} decay={2} />
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]}>
      <planeGeometry args={[120, 140]} />
      <MeshReflectorMaterial
        blur={[260, 50]}
        resolution={128}
        mixBlur={0.85}
        mixStrength={9}
        roughness={0.7}
        depthScale={0.5}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color="#05080b"
        metalness={0.45}
        mirror={0.75}
      />
    </mesh>
  );
}

function Rig({ reduce }: { reduce: boolean }) {
  const { camera, pointer, size } = useThree();
  const cur = useRef({ p: 0 });
  useFrame((_, delta) => {
    const target = reduce ? 0.12 : Scroll.progress;
    cur.current.p += (target - cur.current.p) * Math.min(1, delta * 4.5);
    const p = cur.current.p;
    const aspect = size.width / size.height;
    const backoff = aspect < 0.8 ? 9 : aspect < 1.3 ? 4 : 0;
    // arranca ALTO mirando el campo (overview de chart) y baja al nivel del vault
    const z = THREE.MathUtils.lerp(19 + backoff, -12, easeInOut(p));
    const y = THREE.MathUtils.lerp(10.5, 2.6, easeInOut(clamp01(p * 1.35)));
    const px = Math.max(-0.6, Math.min(0.6, pointer.x * 0.6));
    const py = Math.max(-0.3, Math.min(0.3, pointer.y * 0.3));
    camera.position.set(Math.sin(p * Math.PI * 1.2) * 1.4 + px, y + py, z);
    const lookX = THREE.MathUtils.lerp(aspect < 1 ? -2 : -4.2, 0, easeInOut(clamp01(p * 2.2)));
    camera.lookAt(lookX, THREE.MathUtils.lerp(0.5, 4.5, easeInOut(p)), VAULT_Z);
  });
  return null;
}

function ReadyFlag() {
  const fired = useRef(false);
  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      (window as unknown as { __legendReady?: boolean }).__legendReady = true;
    }
  });
  return null;
}

export default function LegendScene({ reduce }: { reduce: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        flat
        dpr={[1, 1.5]}
        resize={{ offsetSize: true }}
        camera={{ fov: 40, near: 0.1, far: 130, position: [0, 10.5, 19] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={[BASE_BG]} />
        <fog attach="fog" args={[BASE_BG, 12, 60]} />
        <BarField />
        <Vault />
        <Floor />
        <Rig reduce={reduce} />
        <ReadyFlag />
        <EffectComposer>
          <Bloom intensity={1.1} luminanceThreshold={1} mipmapBlur />
          <Vignette eskil={false} offset={0.14} darkness={0.8} />
          <Noise opacity={0.03} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
