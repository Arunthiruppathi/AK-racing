
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CarController } from '../physics/CarController.ts';
import { PhysicsConfig, TelemetryData, TaskType } from '../types.ts';

interface SimulationProps {
  config: PhysicsConfig;
  onTelemetry: (data: TelemetryData) => void;
}

const Simulation: React.FC<SimulationProps> = ({ config, onTelemetry }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CarController>(new CarController(config));
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  
  useEffect(() => {
    controllerRef.current.config = config;
  }, [config]);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f7ff);
    scene.fog = new THREE.Fog(0xf0f7ff, 100, 1200);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // --- High Contrast Daylight Lighting ---
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(200, 400, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // --- Straight Road Layout ---
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -800),    // Long Straight 1
      new THREE.Vector3(50, 0, -850),   // Corner 1
      new THREE.Vector3(450, 0, -850),  // Short Straight 1
      new THREE.Vector3(500, 0, -800),  // Corner 2
      new THREE.Vector3(500, 0, 0),     // Long Straight 2
      new THREE.Vector3(450, 0, 50),    // Corner 3
      new THREE.Vector3(50, 0, 50),     // Short Straight 2
      new THREE.Vector3(0, 0, 0),      // Back to Start
    ], true, 'catmullrom', 0.1); // Tension 0.1 makes corners sharper/roads straighter

    const trackTubeGeo = new THREE.TubeGeometry(curve, 500, 22, 12, true);
    trackTubeGeo.scale(1, 0.002, 1);
    const trackMat = new THREE.MeshStandardMaterial({ 
      color: 0x222222, 
      roughness: 0.9, 
      metalness: 0.05 
    });
    const trackMesh = new THREE.Mesh(trackTubeGeo, trackMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Grid helper for straight-line orientation
    const grid = new THREE.GridHelper(2000, 40, 0xcccccc, 0xeeeeee);
    grid.position.y = -0.1;
    scene.add(grid);

    // --- Obstacles ---
    const obstacles: THREE.Mesh[] = [];
    const barrierGeo = new THREE.BoxGeometry(4, 1.8, 0.8);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xee2222 });
    
    const generateObstacles = (count: number) => {
      obstacles.forEach(o => scene.remove(o));
      obstacles.length = 0;
      for (let i = 0; i < count; i++) {
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        const t = Math.random();
        const pos = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        // Randomly place on left or right lane
        const laneOffset = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 8);
        pos.add(normal.multiplyScalar(laneOffset));
        pos.y = 0.9;
        barrier.position.copy(pos);
        barrier.lookAt(pos.clone().add(tangent));
        barrier.castShadow = true;
        scene.add(barrier);
        obstacles.push(barrier);
      }
    };
    generateObstacles(10 * levelRef.current);

    // --- Car Visuals ---
    const carGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.1 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.5), bodyMat);
    chassis.position.y = 0.4;
    chassis.castShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    cabin.position.set(0, 0.85, -0.2);
    carGroup.add(cabin);

    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, 0.42, z);
      carGroup.add(wheel);
      wheels.push(wheel);
    });
    scene.add(carGroup);

    // --- Logic ---
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => keys[e.code] = true;
    const onKeyUp = (e: KeyboardEvent) => keys[e.code] = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let lProgress = 0;
    let lTask: string = TaskType.Collect;
    let lTotal = 5;
    let lastTime = performance.now();
    let collisionCooldown = 0;

    const animate = () => {
      const now = performance.now();
      const dt = Math.max(0.001, Math.min((now - lastTime) / 1000, 0.05));
      lastTime = now;

      const currentInputs = {
        throttle: keys['ArrowUp'] || keys['KeyW'] ? 1 : 0,
        brake: keys['ArrowDown'] || keys['KeyS'] ? 1 : 0,
        steer: (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0) - (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0)
      };

      const pC = controllerRef.current;
      pC.update(dt, currentInputs);

      // Collision Detection
      if (collisionCooldown > 0) collisionCooldown -= dt;
      obstacles.forEach(obs => {
        const dist = obs.position.distanceTo(new THREE.Vector3(pC.position.x, 0.9, pC.position.z));
        if (dist < 2.6 && collisionCooldown <= 0) {
          pC.velocity *= 0.4; // Sharp penalty for hitting barriers
          scoreRef.current = Math.max(0, scoreRef.current - 800);
          collisionCooldown = 1.2;
          carGroup.position.y += 0.4; // Jolt
        }
      });

      // Visuals
      carGroup.position.set(pC.position.x, pC.position.y, pC.position.z);
      carGroup.rotation.y = pC.heading;
      chassis.rotation.z = pC.bodyRoll;
      chassis.rotation.x = -pC.bodyPitch;
      wheels.forEach((w, i) => {
        w.rotation.x += pC.velocity * 0.5 * dt;
        if (i < 2) w.rotation.y = currentInputs.steer * 0.45;
      });

      // Level Progress Logic
      if (lTask === TaskType.Collect) {
          lProgress = Math.min(lTotal, lProgress + (pC.velocity > 15 ? dt * 0.15 : 0));
          if (lProgress >= lTotal) {
            levelRef.current = Math.min(5, levelRef.current + 1);
            lProgress = 0;
            scoreRef.current += 3000;
            generateObstacles(8 * levelRef.current);
          }
      }

      const baseTelemetry = pC.getTelemetry(currentInputs, { 
        score: scoreRef.current, 
        lap: 1, 
        position: 1,
        level: levelRef.current 
      });
      onTelemetry({ 
        ...baseTelemetry, 
        currentTask: lTask, 
        taskProgress: Math.floor(lProgress), 
        taskTotal: lTotal 
      });

      // Cinematic Chase Camera for Straights
      const camDist = 14 + (pC.velocity * 0.15);
      const camHeight = 4.0;
      const targetCamPos = new THREE.Vector3(
        pC.position.x - Math.sin(pC.heading) * camDist,
        pC.position.y + camHeight,
        pC.position.z - Math.cos(pC.heading) * camDist
      );
      camera.position.lerp(targetCamPos, 0.12);
      camera.lookAt(
        pC.position.x + Math.sin(pC.heading) * 10,
        pC.position.y + 0.5,
        pC.position.z + Math.cos(pC.heading) * 10
      );
      
      camera.fov = 55 + (pC.velocity * 0.45);
      camera.updateProjectionMatrix();

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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [onTelemetry]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Simulation;
