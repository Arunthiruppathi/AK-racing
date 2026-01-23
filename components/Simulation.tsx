
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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdceeff);
    scene.fog = new THREE.Fog(0xdceeff, 200, 1500);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(300, 600, 200);
    sun.castShadow = true;
    sun.shadow.camera.left = -600;
    sun.shadow.camera.right = 600;
    sun.shadow.camera.top = 600;
    sun.shadow.camera.bottom = -600;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // --- High Speed Straightaway Track ---
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1200),    // Main Straight
      new THREE.Vector3(100, 0, -1300),  // Sharp Corner 1
      new THREE.Vector3(600, 0, -1300),  // Back Straight Top
      new THREE.Vector3(700, 0, -1200),  // Corner 2
      new THREE.Vector3(700, 0, 0),      // Return Straight
      new THREE.Vector3(600, 0, 100),    // Corner 3
      new THREE.Vector3(100, 0, 100),    // Front Straight
      new THREE.Vector3(0, 0, 0),
    ], true, 'catmullrom', 0.05); 

    const trackWidth = 28;
    const trackTubeGeo = new THREE.TubeGeometry(curve, 600, trackWidth / 2, 8, true);
    trackTubeGeo.scale(1, 0.001, 1);
    
    // Custom shader-like material for track lines
    const trackMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a, 
      roughness: 0.8,
      metalness: 0.1
    });
    const trackMesh = new THREE.Mesh(trackTubeGeo, trackMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Decorative side curbs
    const curbGeo = new THREE.TubeGeometry(curve, 600, (trackWidth / 2) + 0.5, 8, true);
    curbGeo.scale(1, 0.002, 1);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    scene.add(curbMesh);

    const grid = new THREE.GridHelper(3000, 60, 0xbbccdd, 0xccdde0);
    grid.position.y = -0.05;
    scene.add(grid);

    // --- Obstacles ---
    const obstacles: THREE.Mesh[] = [];
    const barrierGeo = new THREE.BoxGeometry(5, 2, 1);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x330000 });
    
    const generateObstacles = (count: number) => {
      obstacles.forEach(o => scene.remove(o));
      obstacles.length = 0;
      for (let i = 0; i < count; i++) {
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        const t = Math.random();
        const pos = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        const laneOffset = (Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 5);
        pos.add(normal.multiplyScalar(laneOffset));
        pos.y = 1.0;
        barrier.position.copy(pos);
        barrier.lookAt(pos.clone().add(tangent));
        barrier.castShadow = true;
        scene.add(barrier);
        obstacles.push(barrier);
      }
    };
    generateObstacles(12 * levelRef.current);

    // --- Racing Car Model ---
    const carGroup = new THREE.Group();
    
    // Chassis
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.1 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 4.8), bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    carGroup.add(chassis);

    // Cabin/Windshield
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.0 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 2.2), glassMat);
    cabin.position.set(0, 0.85, -0.3);
    carGroup.add(cabin);

    // Rear Wing
    const wingSupport = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.1), bodyMat);
    wingSupport.position.set(0, 0.8, 2.0);
    carGroup.add(wingSupport);
    const wingPlate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.8), bodyMat);
    wingPlate.position.set(0, 1.0, 2.1);
    carGroup.add(wingPlate);

    const wheels: THREE.Mesh[] = [];
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 });
    
    [[-1.0, 1.6], [1.0, 1.6], [-1.0, -1.6], [1.0, -1.6]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, 0.45, z);
      carGroup.add(wheel);
      wheels.push(wheel);
    });
    scene.add(carGroup);

    // --- Simulation Loop ---
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => keys[e.code] = true;
    const onKeyUp = (e: KeyboardEvent) => keys[e.code] = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let lProgress = 0;
    let lTask: string = TaskType.Speed;
    let lTotal = 10;
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

      // Collision
      if (collisionCooldown > 0) collisionCooldown -= dt;
      obstacles.forEach(obs => {
        const carPos = new THREE.Vector3(pC.position.x, 1.0, pC.position.z);
        if (obs.position.distanceTo(carPos) < 2.8 && collisionCooldown <= 0) {
          pC.velocity *= 0.35; 
          scoreRef.current = Math.max(0, scoreRef.current - 1000);
          collisionCooldown = 1.5;
          carGroup.position.y += 0.5; // Visual impact
        }
      });

      // Visual Updates
      carGroup.position.set(pC.position.x, pC.position.y, pC.position.z);
      carGroup.rotation.y = pC.heading;
      chassis.rotation.z = pC.bodyRoll;
      chassis.rotation.x = -pC.bodyPitch;
      
      wheels.forEach((w, i) => {
        w.rotation.x += pC.velocity * 0.45 * dt;
        if (i < 2) w.rotation.y = currentInputs.steer * 0.4;
      });

      // Progress
      if (lTask === TaskType.Speed) {
          lProgress = Math.min(lTotal, lProgress + (pC.velocity > 25 ? dt * 0.2 : 0));
          if (lProgress >= lTotal) {
            levelRef.current = Math.min(10, levelRef.current + 1);
            lProgress = 0;
            scoreRef.current += 5000;
            generateObstacles(10 + levelRef.current * 2);
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

      // Camera: Tracking sequential focus
      const speedFactor = pC.velocity / pC.config.maxSpeed;
      const camDist = 15 + (speedFactor * 6);
      const camHeight = 4.5 - (speedFactor * 1.5);
      
      const targetCamPos = new THREE.Vector3(
        pC.position.x - Math.sin(pC.heading) * camDist,
        pC.position.y + camHeight,
        pC.position.z - Math.cos(pC.heading) * camDist
      );
      camera.position.lerp(targetCamPos, 0.1);
      camera.lookAt(
        pC.position.x + Math.sin(pC.heading) * 15,
        pC.position.y + 0.5,
        pC.position.z + Math.cos(pC.heading) * 15
      );
      
      camera.fov = 55 + (speedFactor * 30);
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
