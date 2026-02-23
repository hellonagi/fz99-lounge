'use client';

import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const ASPECT = 6720 / 3120; // ~2.15
const PLANE_WIDTH = 8;
const PLANE_HEIGHT = PLANE_WIDTH / ASPECT;

function TrackPlane() {
  const [trackTex, skywayTex] = useTexture([
    '/tracks/mc1_track.webp',
    '/tracks/mc1_skyway.webp',
  ]);

  return (
    <>
      {/* Track (floating above grid) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
        <meshBasicMaterial
          map={trackTex}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Skyway (elevated above track) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.6, 0]}>
        <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
        <meshBasicMaterial
          map={skywayTex}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

const GRID_HUES = [180, 260, 300, 220, 180]; // cyan → purple → pink → blue → cyan
const GRID_CYCLE_DURATION = 30; // seconds for full cycle

function getHue(elapsedTime: number) {
  const t = (elapsedTime % GRID_CYCLE_DURATION) / GRID_CYCLE_DURATION;
  const segCount = GRID_HUES.length - 1;
  const seg = Math.floor(t * segCount);
  const frac = (t * segCount) - seg;
  return THREE.MathUtils.lerp(GRID_HUES[seg], GRID_HUES[seg + 1] ?? GRID_HUES[0], frac);
}

const PARTICLE_COUNT = 30;

// Shooting stars
const SHOOTING_STAR_COUNT = 15;
const TRAIL_LENGTH = 20;
const TOTAL_POINTS = SHOOTING_STAR_COUNT * TRAIL_LENGTH;
const SS_SPEED_MIN = 2;
const SS_SPEED_MAX = 4;
const SS_GROUND_Y = 0.5;
const SS_COOLDOWN_MIN = 2;
const SS_COOLDOWN_MAX = 8;
const SS_SPAWN_Y_MIN = 3;
const SS_SPAWN_Y_MAX = 5;
const SS_SPAWN_RADIUS_MIN = 1;
const SS_SPAWN_RADIUS_MAX = 5;

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const particleColor = useMemo(() => new THREE.Color(), []);
  const { size } = useThree();
  const responsiveT = THREE.MathUtils.clamp((size.width - 375) / (1200 - 375), 0, 1);
  const baseSize = THREE.MathUtils.lerp(50.0, 30.0, responsiveT); // mobile: 50, desktop: 30

  const { positions, speeds, offsets, scales } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const spd = new Float32Array(PARTICLE_COUNT);
    const off = new Float32Array(PARTICLE_COUNT);
    const scl = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      spd[i] = 0.15 + Math.random() * 0.35;
      off[i] = Math.random() * Math.PI * 2;
      scl[i] = 0.5 + Math.random() * 1.5; // size variation
    }

    return { positions: pos, speeds: spd, offsets: off, scales: scl };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      arr[i * 3] += Math.sin(t * 0.3 + offsets[i]) * 0.002;
      arr[i * 3 + 2] += Math.cos(t * 0.2 + offsets[i]) * 0.002;

      if (arr[i * 3 + 1] > 5) {
        arr[i * 3 + 1] = 0;
        arr[i * 3] = (Math.random() - 0.5) * 8;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
      }
    }

    pos.needsUpdate = true;

    const hue = getHue(t);
    particleColor.setHSL(hue / 360, 0.7, 0.7);
    const mat = ref.current.material as THREE.ShaderMaterial;
    mat.uniforms.uColor.value.copy(particleColor);
    mat.uniforms.uBaseSize.value = baseSize;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
        />
        <bufferAttribute
          attach="attributes-aScale"
          args={[scales, 1]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uColor: { value: new THREE.Color('#67e8f9') }, uBaseSize: { value: baseSize } }}
        vertexShader={`
          uniform float uBaseSize;
          attribute float aScale;
          varying float vScale;
          void main() {
            vScale = aScale;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (uBaseSize * aScale) / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          varying float vScale;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float glow = exp(-d * 6.0);
            float alpha = glow * 0.7;
            gl_FragColor = vec4(uColor * (1.0 + glow * 0.2), alpha);
          }
        `}
      />
    </points>
  );
}

interface StarState {
  phase: 'cooldown' | 'active';
  timer: number;
  startY: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  cr: number;
  cg: number;
  cb: number;
}

function ShootingStars() {
  const ref = useRef<THREE.Points>(null);
  const { size } = useThree();
  const responsiveT = THREE.MathUtils.clamp((size.width - 375) / (1200 - 375), 0, 1);
  const baseSize = THREE.MathUtils.lerp(60.0, 40.0, responsiveT);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS * 3), 3);
    pos.usage = THREE.DynamicDrawUsage;
    const alp = new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS), 1);
    alp.usage = THREE.DynamicDrawUsage;
    const sz = new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS), 1);
    sz.usage = THREE.DynamicDrawUsage;
    const tt = new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS), 1);
    tt.usage = THREE.DynamicDrawUsage;
    const col = new THREE.BufferAttribute(new Float32Array(TOTAL_POINTS * 3), 3);
    col.usage = THREE.DynamicDrawUsage;
    geo.setAttribute('position', pos);
    geo.setAttribute('aAlpha', alp);
    geo.setAttribute('aSize', sz);
    geo.setAttribute('aTrailT', tt);
    geo.setAttribute('aColor', col);
    return geo;
  }, []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uBaseSize: { value: baseSize },
    },
    vertexShader: `
      uniform float uBaseSize;
      attribute float aAlpha;
      attribute float aSize;
      attribute float aTrailT;
      attribute vec3 aColor;
      varying float vAlpha;
      varying float vTrailT;
      varying vec3 vColor;
      void main() {
        vAlpha = aAlpha;
        vTrailT = aTrailT;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (uBaseSize * aSize) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vTrailT;
      varying vec3 vColor;
      void main() {
        if (vAlpha < 0.001) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;

        float core = exp(-d * 20.0);
        float glow = exp(-d * 6.0);

        // Head: white core, Trail: per-star random pink/purple
        vec3 color = mix(vColor, vec3(1.0), smoothstep(0.3, 0.0, vTrailT));
        color = mix(color, vec3(1.0), core * 0.9);
        float alpha = glow * vAlpha;
        gl_FragColor = vec4(color * (1.0 + core * 0.5), alpha);
      }
    `,
  }), [baseSize]);

  const stars = useRef<StarState[]>([]);
  if (stars.current.length === 0) {
    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      stars.current.push({
        phase: 'cooldown',
        // Stagger initial cooldowns so stars appear quickly
        timer: Math.random() * SS_COOLDOWN_MIN,
        startY: 0,
        px: 0, py: 0, pz: 0,
        vx: 0, vy: 0, vz: 0,
        speed: 0,
        cr: 1, cg: 0.4, cb: 0.7,
      });
    }
  }

  function spawnStar(s: StarState) {
    // Spawn outside the track, then fly inward toward center
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 3; // 3-6 units from center
    s.px = Math.cos(angle) * radius;
    s.py = SS_SPAWN_Y_MIN + Math.random() * (SS_SPAWN_Y_MAX - SS_SPAWN_Y_MIN);
    s.pz = Math.sin(angle) * radius;
    s.startY = s.py;
    s.speed = SS_SPEED_MIN + Math.random() * (SS_SPEED_MAX - SS_SPEED_MIN);

    // Direction: toward origin with slight random offset (±20 degrees)
    const toCenter = angle + Math.PI; // point toward origin
    const spread = (Math.random() - 0.5) * 0.7; // ±0.35 rad (~20 deg)
    const horizAngle = toCenter + spread;
    const downRatio = 0.35 + Math.random() * 0.25;
    const horizRatio = Math.sqrt(1 - downRatio * downRatio);
    s.vx = Math.cos(horizAngle) * horizRatio;
    s.vy = -downRatio;
    s.vz = Math.sin(horizAngle) * horizRatio;

    // Random pink-to-purple trail color (hue 280-330)
    const hue = (280 + Math.random() * 50) / 360;
    const _c = new THREE.Color().setHSL(hue, 0.8, 0.65);
    s.cr = _c.r;
    s.cg = _c.g;
    s.cb = _c.b;

    s.phase = 'active';
    s.timer = 0;
  }

  useFrame((_, delta) => {
    if (!ref.current) return;
    const geo = ref.current.geometry;
    const posArr = geo.attributes.position.array as Float32Array;
    const alpArr = geo.attributes.aAlpha.array as Float32Array;
    const szArr = geo.attributes.aSize.array as Float32Array;
    const ttArr = geo.attributes.aTrailT.array as Float32Array;
    const colArr = geo.attributes.aColor.array as Float32Array;

    for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
      const s = stars.current[i];
      const base = i * TRAIL_LENGTH;

      if (s.phase === 'cooldown') {
        s.timer -= delta;
        if (s.timer <= 0) {
          spawnStar(s);
        } else {
          for (let j = 0; j < TRAIL_LENGTH; j++) {
            alpArr[base + j] = 0;
          }
          continue;
        }
      }

      // Active: update head position
      s.px += s.vx * s.speed * delta;
      s.py += s.vy * s.speed * delta;
      s.pz += s.vz * s.speed * delta;
      s.timer += delta;

      const fadeIn = Math.min(1, s.timer / 0.15);
      const groundProximity = Math.max(0, (s.py - SS_GROUND_Y) / (s.startY * 0.4));
      const fadeOut = Math.min(1, groundProximity);
      const masterAlpha = fadeIn * fadeOut;

      const step = s.speed * 0.008;
      for (let j = 0; j < TRAIL_LENGTH; j++) {
        const t = j / (TRAIL_LENGTH - 1);
        const idx3 = (base + j) * 3;
        posArr[idx3]     = s.px - s.vx * step * j;
        posArr[idx3 + 1] = s.py - s.vy * step * j;
        posArr[idx3 + 2] = s.pz - s.vz * step * j;

        const trailFade = Math.pow(1 - t, 2.5);
        alpArr[base + j] = masterAlpha * trailFade;
        szArr[base + j] = (1.0 - t * 0.7);
        ttArr[base + j] = t;
        colArr[idx3]     = s.cr;
        colArr[idx3 + 1] = s.cg;
        colArr[idx3 + 2] = s.cb;
      }

      if (s.py <= SS_GROUND_Y) {
        s.phase = 'cooldown';
        s.timer = SS_COOLDOWN_MIN + Math.random() * (SS_COOLDOWN_MAX - SS_COOLDOWN_MIN);
        for (let j = 0; j < TRAIL_LENGTH; j++) {
          alpArr[base + j] = 0;
        }
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aTrailT.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    material.uniforms.uBaseSize.value = baseSize;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

function AnimatedGrid() {
  const gridRef = useRef<THREE.Mesh>(null);
  const cellColor = useMemo(() => new THREE.Color(), []);
  const sectionColor = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    if (!gridRef.current) return;
    const material = gridRef.current.material as THREE.ShaderMaterial;
    if (!material.uniforms) return;

    const hue = getHue(clock.elapsedTime);

    cellColor.setHSL(hue / 360, 0.8, 0.4);
    sectionColor.setHSL(hue / 360, 0.7, 0.55);

    if (material.uniforms.cellColor) material.uniforms.cellColor.value.copy(cellColor);
    if (material.uniforms.sectionColor) material.uniforms.sectionColor.value.copy(sectionColor);
  });

  return (
    <Grid
      ref={gridRef}
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={1}
      cellColor="#06b6d4"
      sectionSize={2}
      sectionThickness={1.5}
      sectionColor="#22d3ee"
      fadeDistance={12}
      fadeStrength={2}
      infiniteGrid
    />
  );
}

const CAMERA_RADIUS = Math.sqrt(4 * 4 + 4 * 4); // ~5.66, from initial pos [4, _, 4]
const CAMERA_HEIGHT = 4.5;
const ROTATE_SPEED = (2 * Math.PI / 60) * -1.2;

function CameraRig() {
  const angleRef = useRef(Math.atan2(4, 4));
  const target = useMemo(() => new THREE.Vector3(0, -0.5, 0), []);
  const { size } = useThree();

  const responsiveT = THREE.MathUtils.clamp((size.width - 375) / (1200 - 375), 0, 1);
  const baseRadius = THREE.MathUtils.lerp(7.0, CAMERA_RADIUS, responsiveT);

  useFrame(({ camera }, delta) => {
    angleRef.current += ROTATE_SPEED * delta;
    camera.position.x = Math.sin(angleRef.current) * baseRadius;
    camera.position.z = Math.cos(angleRef.current) * baseRadius;
    camera.position.y = CAMERA_HEIGHT;
    camera.lookAt(target);
  });

  return null;
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 25, 45]} />

      <ambientLight intensity={1} />

      <AnimatedGrid />

      <FloatingParticles />
      <ShootingStars />

      <Suspense fallback={null}>
        <TrackPlane />
      </Suspense>

      <CameraRig />
    </>
  );
}

export function TrackScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        camera={{
          position: [4, 4.5, 4],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
      >
        <Scene />
      </Canvas>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-gray-900/15 to-gray-900/65" />
    </div>
  );
}
