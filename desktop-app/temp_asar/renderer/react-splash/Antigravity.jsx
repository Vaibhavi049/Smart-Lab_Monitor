import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleRing = ({ count = 220, ringRadius = 9, particleSize = 1.2, color = '#B5D4F4', autoAnimate = true, rotationSpeed = 0.03, pulseSpeed = 2 }) => {
  const pointsRef = useRef();

  // Create particle positions
  const particles = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const r = ringRadius + (Math.random() - 0.5) * 2;
        const x = r * Math.cos(theta);
        const y = (Math.random() - 0.5) * 5; // vertical height variance
        const z = r * Math.sin(theta);
        
        coords[i * 3] = x;
        coords[i * 3 + 1] = y;
        coords[i * 3 + 2] = z;
    }
    return coords;
  }, [count, ringRadius]);

  const geoRef = useRef();
  
  useFrame((state) => {
    if (!autoAnimate || !pointsRef.current) return;
    
    // Ambient rotation
    pointsRef.current.rotation.y += rotationSpeed * 0.1;
    
    // Slow breathing / pulse
    const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed * 0.5) * 0.05;
    pointsRef.current.scale.set(scale, scale, scale);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" count={count} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={particleSize * 0.3} color={color} sizeAttenuation={true} transparent opacity={0.8} />
    </points>
  );
};

export default function Antigravity(props) {
  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <ParticleRing {...props} />
    </Canvas>
  );
}
