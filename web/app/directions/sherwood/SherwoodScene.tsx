"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Instances, Instance, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Scroll } from "@/lib/scrollProgress";

/*
 * SHERWOOD — un solo mundo cohesivo que la cámara recorre (lección Aegis/Lusion):
 * bosque-catedral de noche → perspectiva a un punto: la COLUMNA de luz verde al fondo
 * (la "gate"). El scroll ES el viaje. La flecha (el fee) vuela scrubbed y clava en la gate.
 *
 * Reglas del vault aplicadas: canvas fijo + scroll nativo (patrón Cyera) · UN tonemap
 * (Canvas `flat` + ACES en el composer) · emisivos HDR con toneMapped:false + Bloom
 * threshold 1 · piso MeshReflectorMaterial res 128 · haz = geometría vertical angosta,
 * nace transparente en sus extremos · DPR [1,1.5] · reduced-motion degrada a frame fijo.
 */

const GATE_Z = -34;
const BASE_BG = "#030805";
const ARROW_START = 0.38;
const ARROW_END = 0.6;
const IMPACT_END = 0.72;

// PRNG determinista (mismo bosque en cada carga; sin Math.random en render)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

// alpha vertical: transparente en AMBOS extremos (regla del haz del vault)
function useColumnAlpha() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.25, "rgba(255,255,255,0.85)");
    g.addColorStop(0.75, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/* ------------------------------ el bosque ------------------------------ */

function Trunks() {
  const trunks = useMemo(() => {
    const rand = mulberry32(20260712);
    const out: { pos: [number, number, number]; r: number; tilt: number }[] = [];
    for (let i = 0; i < 130; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      // pasillo central despejado (|x| >= 2.7) para el viaje de cámara
      const x = side * (2.7 + rand() * 14);
      const z = 16 - rand() * 54; // 16 .. -38
      const r = 0.75 + rand() * 1.9;
      out.push({ pos: [x, 12.5, z], r, tilt: (rand() - 0.5) * 0.06 });
    }
    return out;
  }, []);

  return (
    <Instances limit={140} frustumCulled={false}>
      <cylinderGeometry args={[0.13, 0.21, 26, 7]} />
      <meshStandardMaterial color="#1a2c20" roughness={0.88} metalness={0.05} />
      {trunks.map((t, i) => (
        <Instance key={i} position={t.pos} scale={[t.r, 1, t.r]} rotation={[t.tilt, 0, t.tilt * 0.7]} />
      ))}
    </Instances>
  );
}

function Gate() {
  const alpha = useColumnAlpha();
  const glow = useGlowTexture();
  return (
    <group position={[0, 0, GATE_Z]}>
      {/* la COLUMNA de luz — geometría vertical angosta, HDR para bloom.
          fog={false}: el punto luminoso debe leerse desde el claro del hero (la niebla
          NO puede tragarse el destino — es el hook de perspectiva a un punto) */}
      <mesh position={[0, 9.5, 0]}>
        <planeGeometry args={[1.0, 21]} />
        <meshBasicMaterial
          color={new THREE.Color(0.35, 5.6, 1.3)}
          alphaMap={alpha}
          transparent
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>
      {/* velo ancho de la misma luz (spread del haz) */}
      <mesh position={[0, 9.5, -0.3]}>
        <planeGeometry args={[3.6, 21]} />
        <meshBasicMaterial
          color={new THREE.Color(0.06, 1.1, 0.28)}
          alphaMap={alpha}
          transparent
          opacity={0.5}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
      {/* halo suave detrás (atmósfera, no protagonista) */}
      <mesh position={[0, 7.5, -0.6]}>
        <planeGeometry args={[17, 20]} />
        <meshBasicMaterial
          map={glow}
          color={new THREE.Color(0.05, 0.85, 0.24)}
          transparent
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>
      {/* la luz REAL que rimea los troncos y se refleja en el piso */}
      <pointLight position={[0, 5, 2.5]} color="#00C805" intensity={420} distance={90} decay={2} />
      <pointLight position={[0, 1.2, 4]} color="#2aff8f" intensity={90} distance={36} decay={2} />
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]}>
      <planeGeometry args={[130, 150]} />
      {/* res 128 + blur = "wet mirror" sin tumbar FPS (lección Aegis) */}
      <MeshReflectorMaterial
        blur={[280, 60]}
        resolution={128}
        mixBlur={0.9}
        mixStrength={7}
        roughness={0.85}
        depthScale={0.6}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color="#060d08"
        metalness={0.3}
        mirror={0.6}
      />
    </mesh>
  );
}

/* ------------------------- vida ambiental (puntos) ------------------------- */

function Fireflies({ reduce }: { reduce: boolean }) {
  const glow = useGlowTexture();
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const rand = mulberry32(777);
    const n = 170;
    const base = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      base[i * 3] = (rand() - 0.5) * 34;
      base[i * 3 + 1] = 0.4 + rand() * 7.5;
      base[i * 3 + 2] = 14 - rand() * 52;
      phase[i] = rand() * Math.PI * 2;
    }
    return { n, base, phase, pos: base.slice() };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current || reduce) return;
    const t = clock.elapsedTime;
    const a = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < data.n; i++) {
      const p = data.phase[i];
      a[i * 3] = data.base[i * 3] + Math.sin(t * 0.22 + p) * 0.7;
      a[i * 3 + 1] = data.base[i * 3 + 1] + Math.sin(t * 0.35 + p * 2) * 0.45;
      a[i * 3 + 2] = data.base[i * 3 + 2] + Math.cos(t * 0.18 + p) * 0.5;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.75 + Math.sin(t * 1.7) * 0.2;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glow}
        color={new THREE.Color(0.35, 2.6, 0.7)}
        size={0.1}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// chispas de ORO: los fees fluyendo hacia la gate — se intensifican con el scroll
function GoldSparks({ reduce }: { reduce: boolean }) {
  const glow = useGlowTexture();
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const rand = mulberry32(4242);
    const n = 120;
    const pos = new Float32Array(n * 3);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 22;
      pos[i * 3 + 1] = 0.5 + rand() * 6;
      pos[i * 3 + 2] = 16 - rand() * 50;
      speed[i] = 2 + rand() * 5;
    }
    return { n, pos, speed };
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const p = Scroll.progress;
    const intensity = clamp01((p - 0.1) / 0.35);
    const a = ref.current.geometry.attributes.position.array as Float32Array;
    if (!reduce) {
      const drive = 0.25 + intensity * 1.6;
      for (let i = 0; i < data.n; i++) {
        // convergen hacia el eje y avanzan hacia la gate
        a[i * 3 + 2] -= data.speed[i] * drive * delta;
        a[i * 3] += (0 - a[i * 3]) * 0.12 * drive * delta;
        if (a[i * 3 + 2] < GATE_Z) {
          a[i * 3 + 2] = 16;
          a[i * 3] = (Math.sin(i * 37.7) * 0.5 + 0.5 - 0.5) * 22;
        }
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
    (ref.current.material as THREE.PointsMaterial).opacity = 0.15 + intensity * 0.8;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glow}
        color={new THREE.Color(2.9, 1.7, 0.4)}
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/* ------------------------------- la flecha ------------------------------- */

function Arrow({ reduce }: { reduce: boolean }) {
  const flight = useRef<THREE.Group>(null);
  const rest = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-11, 6.2, 8),
        new THREE.Vector3(-5, 4.6, -6),
        new THREE.Vector3(1.4, 3.6, -19),
        new THREE.Vector3(0, 3.1, GATE_Z + 1.1),
      ]),
    [],
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const p = Scroll.progress;
    const t = reduce ? 1 : clamp01((p - ARROW_START) / (ARROW_END - ARROW_START));
    const ip = clamp01((p - ARROW_END) / (IMPACT_END - ARROW_END));

    if (flight.current) {
      const flying = t > 0.001 && t < 0.999 && !reduce;
      flight.current.visible = flying;
      if (flying) {
        const e = easeInOut(t);
        const pos = curve.getPointAt(e * 0.999);
        flight.current.position.copy(pos);
        const tan = curve.getTangentAt(Math.min(0.999, e));
        flight.current.lookAt(tmp.copy(pos).add(tan));
      }
    }
    if (rest.current) {
      // clavada en la gate tras el impacto (o siempre, en reduced-motion)
      rest.current.visible = reduce || t >= 0.999;
    }
    if (ring.current) {
      const active = ip > 0 && ip < 1 && !reduce;
      ring.current.visible = active;
      if (active) {
        const s = 0.6 + ip * 8;
        ring.current.scale.set(s, s, s);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - ip) * 0.9;
      }
    }
  });

  const arrowBody = (
    <>
      {/* astil apuntando a +Z */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 1.5, 6]} />
        <meshStandardMaterial color="#3a2f1c" roughness={0.7} />
      </mesh>
      {/* punta dorada HDR */}
      <mesh position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.24, 8]} />
        <meshBasicMaterial color={new THREE.Color(3.2, 1.9, 0.5)} toneMapped={false} />
      </mesh>
      {/* plumas verdes (la pluma de Robinhood) */}
      {[0, 2.1, 4.2].map((r) => (
        <mesh key={r} position={[0, 0, -0.62]} rotation={[0, 0, r]}>
          <planeGeometry args={[0.02, 0.3]} />
          <meshBasicMaterial
            color={new THREE.Color(0.1, 1.8, 0.45)}
            toneMapped={false}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      {/* estela: cono estirado additive hacia atrás */}
      <mesh position={[0, 0, -2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 3.4, 6, 1, true]} />
        <meshBasicMaterial
          color={new THREE.Color(0.1, 2.2, 0.55)}
          transparent
          opacity={0.35}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );

  return (
    <>
      <group ref={flight} visible={false}>
        {arrowBody}
      </group>
      <group ref={rest} position={[0, 3.1, GATE_Z + 1.35]} rotation={[0.06, Math.PI, 0]} visible={false}>
        {/* clavada: media flecha sobresaliendo de la luz */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.022, 0.022, 0.8, 6]} />
          <meshStandardMaterial color="#3a2f1c" roughness={0.7} />
        </mesh>
        {[0, 2.1, 4.2].map((r) => (
          <mesh key={r} position={[0, 0, 0.78]} rotation={[0, 0, r]}>
            <planeGeometry args={[0.022, 0.32]} />
            <meshBasicMaterial
              color={new THREE.Color(0.1, 1.8, 0.45)}
              toneMapped={false}
              side={THREE.DoubleSide}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, GATE_Z + 1.5]} visible={false}>
        <ringGeometry args={[0.95, 1, 64]} />
        <meshBasicMaterial
          color={new THREE.Color(0.15, 3, 0.7)}
          transparent
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

/* ------------------------------ cámara (rig) ------------------------------ */

function Rig({ reduce }: { reduce: boolean }) {
  const { camera, pointer, size } = useThree();
  const cur = useRef({ p: 0 });
  useFrame((_, delta) => {
    const target = reduce ? 0.1 : Scroll.progress;
    // damping del progreso (nunca setear el target directo — lección lerp del vault)
    cur.current.p += (target - cur.current.p) * Math.min(1, delta * 4.5);
    const p = cur.current.p;
    const aspect = size.width / size.height;
    const backoff = aspect < 0.8 ? 8 : aspect < 1.3 ? 4 : 0; // portrait: alejar (FOV es vertical)
    const z = THREE.MathUtils.lerp(21 + backoff, -15, easeInOut(p));
    const sway = Math.sin(p * Math.PI * 1.6) * 0.85;
    const px = Math.max(-0.5, Math.min(0.5, pointer.x * 0.5));
    const py = Math.max(-0.25, Math.min(0.25, pointer.y * 0.25));
    camera.position.set(sway + px, 3.5 + Math.sin(p * Math.PI) * 0.35 + py, z);
    // en el hero la columna compone a la DERECHA del titular (tercios); al avanzar, centra.
    // lookAt hacia -X gira la vista a la izquierda → el mundo (x=0) aparece a la derecha.
    const lookX = THREE.MathUtils.lerp(aspect < 1 ? -2.4 : -4.6, 0, easeInOut(clamp01(p * 2.4)));
    camera.lookAt(lookX, 4.4, GATE_Z);
  });
  return null;
}

// flag de primer frame para el gate del preloader
function ReadyFlag() {
  const fired = useRef(false);
  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      (window as unknown as { __sherwoodReady?: boolean }).__sherwoodReady = true;
    }
  });
  return null;
}

/* --------------------------------- export --------------------------------- */

export default function SherwoodScene({ reduce }: { reduce: boolean }) {
  return (
    // wrapper propio fixed (gotcha Vite/R3F: el Canvas necesita un padre con tamaño real)
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <Canvas
        flat // NoToneMapping en el renderer → UN solo ACES en el composer (regla anti doble-tonemap)
        dpr={[1, 1.5]}
        resize={{ offsetSize: true }}
        camera={{ fov: 42, near: 0.1, far: 130, position: [0, 3.5, 21] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={[BASE_BG]} />
        <fog attach="fog" args={[BASE_BG, 9, 55]} />
        {/* luz de luna fría, tenue — el hemisférico garantiza legibilidad */}
        <hemisphereLight args={["#1c2f24", "#060a07", 0.9]} />
        <directionalLight position={[-6, 18, 6]} color="#3a5c53" intensity={0.75} />

        <Trunks />
        <Gate />
        <Floor />
        <Fireflies reduce={reduce} />
        <GoldSparks reduce={reduce} />
        <Arrow reduce={reduce} />
        <Rig reduce={reduce} />
        <ReadyFlag />

        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={1} mipmapBlur />
          <Vignette eskil={false} offset={0.16} darkness={0.82} />
          <Noise opacity={0.035} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
