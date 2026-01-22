
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MotorcycleController } from '../physics/MotorcycleController';
import { PhysicsConfig, TelemetryData, TaskType } from '../types';

// Extended Task Types
const CUSTOM_TASK_AGILE = "TECHNICAL_U_TURN";

interface SimulationProps {
  config: PhysicsConfig;
  onTelemetry: (data: TelemetryData) => void;
}

const Simulation: React.FC<SimulationProps> = ({ config, onTelemetry }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MotorcycleController>(new MotorcycleController(config));
  
  // Mission State
  const [gameState, setGameState] = useState({
    score: 0,
    currentTask: TaskType.Collect,
    progress: 0,
    total: 5,
    speedTimer: 0,
    initialHeading: 0
  });

  useEffect(() => {
    controllerRef.current.config = config;
  }, [config]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010103);
    scene.fog = new THREE.FogExp2(0x010103, 0.012);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0x202040, 0.8));
    const pointLight = new THREE.PointLight(0xff00ff, 20, 100);
    scene.add(pointLight);

    // --- Track ---
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(150, 0, 100),
      new THREE.Vector3(300, 0, 0),
      new THREE.Vector3(400, 0, -200),
      new THREE.Vector3(250, 0, -450),
      new THREE.Vector3(0, 0, -400),
      new THREE.Vector3(-250, 0, -450),
      new THREE.Vector3(-450, 0, -200),
      new THREE.Vector3(-300, 0, 100),
      new THREE.Vector3(-150, 0, 150),
    ], true);

    const trackTubeGeo = new THREE.TubeGeometry(curve, 256, 15, 12, true);
    trackTubeGeo.scale(1, 0.01, 1);
    
    const colors = [];
    const colorA = new THREE.Color(0x00ffff);
    const colorB = new THREE.Color(0xff00ff);
    const count = trackTubeGeo.attributes.position.count;
    for (let i = 0; i < count; i++) {
      const lerpVal = (i / count) * 10 % 1.0;
      const c = colorA.clone().lerp(colorB, lerpVal);
      colors.push(c.r, c.g, c.b);
    }
    trackTubeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const trackMat = new THREE.MeshStandardMaterial({ 
      vertexColors: true,
      roughness: 0.1,
      metalness: 0.5,
      side: THREE.DoubleSide 
    });
    const trackMesh = new THREE.Mesh(trackTubeGeo, trackMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // --- Checkpoint Archways ---
    const archways: THREE.Group[] = [];
    const archGeo = new THREE.TorusGeometry(8, 0.4, 16, 32, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 5 });
    for (let i = 0; i < 10; i++) {
      const arch = new THREE.Group();
      const ring = new THREE.Mesh(archGeo, archMat);
      ring.rotation.x = Math.PI;
      arch.add(ring);
      const t = i / 10;
      const pos = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      arch.position.copy(pos);
      arch.lookAt(pos.clone().add(tangent));
      scene.add(arch);
      archways.push(arch);
    }

    // --- Gems ---
    const gems: THREE.Mesh[] = [];
    const gemGeo = new THREE.IcosahedronGeometry(0.8);
    for (let i = 0; i < 30; i++) {
      const gem = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ 
        color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 2 
      }));
      const t = Math.random();
      const pos = curve.getPoint(t);
      const normal = curve.getTangent(t).cross(new THREE.Vector3(0, 1, 0)).normalize();
      pos.add(normal.multiplyScalar((Math.random() - 0.5) * 12));
      pos.y = 1.2;
      gem.position.copy(pos);
      scene.add(gem);
      gems.push(gem);
    }

    // --- Player Bike ---
    const playerGroup = new THREE.Group();
    const trailGeometry = new THREE.PlaneGeometry(0.2, 1);
    const trailMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
    trailMesh.rotation.x = Math.PI / 2;
    trailMesh.position.z = -1;
    playerGroup.add(trailMesh);

    const bikeBody = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0 }));
    bikeBody.position.y = 0.35;
    playerGroup.add(bikeBody);
    scene.add(playerGroup);

    // --- Logic Loop ---
    const keys: Record<string, boolean> = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    let lScore = 0;
    let lProgress = 0;
    let lTask: string = TaskType.Collect;
    let lTotal = 5;
    let lSpeedTimer = 0;
    let lInitialHeading = 0;
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const currentInputs = {
        throttle: keys['ArrowUp'] || keys['KeyW'] ? 1 : 0,
        brake: keys['ArrowDown'] || keys['KeyS'] ? 1 : 0,
        steer: (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0) - (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0)
      };

      const pC = controllerRef.current;
      pC.update(dt, currentInputs);

      trailMesh.scale.y = pC.velocity * 0.5;
      trailMesh.position.z = -trailMesh.scale.y / 2 - 0.5;

      const playerPosVec = new THREE.Vector3(pC.position.x, 0, pC.position.z);
      
      // Extended Mission Logic including Agile U-Turn
      if (lTask === TaskType.Collect) {
        gems.forEach(gem => {
          if (gem.visible && gem.position.distanceTo(playerPosVec) < 2.5) {
            gem.visible = false;
            lScore += 200;
            lProgress++;
            if (lProgress >= lTotal) {
              lTask = CUSTOM_TASK_AGILE;
              lProgress = 0;
              lTotal = 180; // degrees
              lInitialHeading = pC.heading;
            }
          }
        });
      } else if (lTask === CUSTOM_TASK_AGILE) {
        // Goal: Perform a 180 degree pivot at low speed
        const headingDiff = Math.abs(pC.heading - lInitialHeading) * (180 / Math.PI);
        lProgress = Math.min(Math.floor(headingDiff), 180);
        
        if (pC.velocity * 3.6 > 30) {
            // Reset if too fast - requires low speed agility
            lInitialHeading = pC.heading;
            lProgress = 0;
        }

        if (lProgress >= 180) {
          lTask = TaskType.Speed;
          lProgress = 0;
          lTotal = 5;
          lScore += 1500;
        }
      } else if (lTask === TaskType.Speed) {
        if (pC.velocity * 3.6 > 130) {
          lSpeedTimer += dt;
          lProgress = Math.floor(lSpeedTimer);
          if (lSpeedTimer >= 5) {
            lTask = TaskType.Checkpoint;
            lProgress = 0;
            lTotal = 3;
            lScore += 1000;
          }
        } else {
          lSpeedTimer = 0;
          lProgress = 0;
        }
      } else if (lTask === TaskType.Checkpoint) {
        archways.forEach((arch) => {
          if (arch.visible && arch.position.distanceTo(playerPosVec) < 6) {
            arch.visible = false;
            lProgress++;
            lScore += 500;
            if (lProgress >= lTotal) {
              lTask = TaskType.Collect;
              lProgress = 0;
              lTotal = 5;
              gems.forEach(g => g.visible = true);
              archways.forEach(a => a.visible = true);
            }
          }
        });
      }

      playerGroup.position.set(pC.position.x, pC.position.y, pC.position.z);
      playerGroup.rotation.y = pC.heading;
      playerGroup.rotation.z = -pC.leanAngle;
      pointLight.position.set(pC.position.x, pC.position.y + 2, pC.position.z);

      const baseTelemetry = pC.getTelemetry(currentInputs, { score: lScore, lap: 1, position: 1 });
      onTelemetry({
        ...baseTelemetry,
        currentTask: lTask,
        taskProgress: lProgress,
        taskTotal: lTotal
      });

      const camDist = 7 + (pC.velocity * 0.1);
      camera.position.lerp(new THREE.Vector3(
        pC.position.x - Math.sin(pC.heading) * camDist,
        pC.position.y + 3.5,
        pC.position.z - Math.cos(pC.heading) * camDist
      ), 0.15);
      camera.lookAt(pC.position.x, pC.position.y + 1, pC.position.z);
      camera.fov = 70 + (pC.velocity * 0.4);
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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Simulation;
