import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MotorcycleController } from '../physics/MotorcycleController';
import { PhysicsConfig, TelemetryData, TaskType } from '../types';

interface SimulationProps {
  config: PhysicsConfig;
  onTelemetry: (data: TelemetryData) => void;
}

const Simulation: React.FC<SimulationProps> = ({ config, onTelemetry }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MotorcycleController>(new MotorcycleController(config));
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  
  useEffect(() => {
    controllerRef.current.config = config;
  }, [config]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050507);
    scene.fog = new THREE.Fog(0x050507, 100, 1000);

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const sun = new THREE.DirectionalLight(0x4488ff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    // Track
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -800),
      new THREE.Vector3(200, 0, -1100),
      new THREE.Vector3(600, 0, -1100),
      new THREE.Vector3(800, 0, -800),
      new THREE.Vector3(800, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ], true);
    
    const trackGeo = new THREE.TubeGeometry(curve, 200, 12, 8, true);
    trackGeo.scale(1, 0.01, 1);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.9 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.receiveShadow = true;
    scene.add(track);

    const grid = new THREE.GridHelper(2000, 50, 0x1f2937, 0x111827);
    grid.position.y = -0.1;
    scene.add(grid);

    // Motorcycle Model
    const bikeGroup = new THREE.Group();
    
    // Main Chassis (Slim)
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.8, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.8, roughness: 0.2 })
    );
    chassis.position.y = 0.5;
    bikeGroup.add(chassis);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.position.set(0, 0.4, 0.8);
    bikeGroup.add(frontWheel);

    const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rearWheel.position.set(0, 0.4, -0.8);
    bikeGroup.add(rearWheel);

    scene.add(bikeGroup);

    // Logic
    const keys: Record<string, boolean> = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const inputs = {
        throttle: keys['KeyW'] || keys['ArrowUp'] ? 1 : 0,
        brake: keys['KeyS'] || keys['ArrowDown'] ? 1 : 0,
        steer: (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0)
      };

      const pC = controllerRef.current;
      pC.update(dt, inputs);

      // Apply to 3D
      bikeGroup.position.set(pC.position.x, pC.position.y - 0.5, pC.position.z);
      bikeGroup.rotation.y = pC.heading;
      bikeGroup.rotation.z = pC.leanAngle;
      bikeGroup.rotation.x = -pC.pitchAngle;

      // Wheel rotation
      frontWheel.rotation.x += pC.velocity * 0.5 * dt;
      rearWheel.rotation.x += pC.velocity * 0.5 * dt;
      // Handlebars steering visual
      frontWheel.rotation.y = inputs.steer * 0.3;

      // Camera
      const camOffset = new THREE.Vector3(
        -Math.sin(pC.heading) * 8,
        3.5,
        -Math.cos(pC.heading) * 8
      );
      camera.position.lerp(new THREE.Vector3().copy(bikeGroup.position).add(camOffset), 0.1);
      camera.lookAt(bikeGroup.position.x, bikeGroup.position.y + 0.5, bikeGroup.position.z);

      onTelemetry(pC.getTelemetry(inputs, { score: scoreRef.current, lap: 1, position: 1, level: levelRef.current }));

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [onTelemetry]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Simulation;