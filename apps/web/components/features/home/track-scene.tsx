'use client';

import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, useTexture } from '@react-three/drei';
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

const PARTICLE_COUNT = 240;

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const particleColor = useMemo(() => new THREE.Color(), []);

  const { positions, speeds, offsets } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const spd = new Float32Array(PARTICLE_COUNT);
    const off = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
      spd[i] = 0.1 + Math.random() * 0.3;
      off[i] = Math.random() * Math.PI * 2;
    }

    return { positions: pos, speeds: spd, offsets: off };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    const t = clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * 0.005;
      arr[i * 3] += Math.sin(t * 0.3 + offsets[i]) * 0.002;
      arr[i * 3 + 2] += Math.cos(t * 0.2 + offsets[i]) * 0.002;

      if (arr[i * 3 + 1] > 10) {
        arr[i * 3 + 1] = -2;
        arr[i * 3] = (Math.random() - 0.5) * 14;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 14;
      }
    }

    pos.needsUpdate = true;

    const hue = getHue(t);
    particleColor.setHSL(hue / 360, 0.7, 0.7);
    const mat = ref.current.material as THREE.ShaderMaterial;
    mat.uniforms.uColor.value.copy(particleColor);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uColor: { value: new THREE.Color('#67e8f9') }, uOpacity: { value: 0.6 } }}
        vertexShader={`
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 10.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float alpha = smoothstep(0.5, 0.2, d) * uOpacity;
            gl_FragColor = vec4(uColor, alpha);
          }
        `}
      />
    </points>
  );
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
      cellThickness={0.6}
      cellColor="#06b6d4"
      sectionSize={2}
      sectionThickness={1}
      sectionColor="#22d3ee"
      fadeDistance={12}
      fadeStrength={2}
      infiniteGrid
    />
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 18, 35]} />

      <ambientLight intensity={1} />

      <AnimatedGrid />

      <FloatingParticles />

      <Suspense fallback={null}>
        <TrackPlane />
      </Suspense>

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
        target={[0, -0.5, 0]}
      />
    </>
  );
}

export function TrackScene() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Canvas
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
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/40 to-gray-900/90" />
    </div>
  );
}
