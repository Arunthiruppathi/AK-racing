
import { PhysicsConfig, TelemetryData } from '../types.ts';

export class CarController {
  public config: PhysicsConfig;
  
  public position = { x: 0, y: 0.3, z: 0 };
  public velocity = 0;
  public heading = 0;
  public bodyRoll = 0;
  public bodyPitch = 0;
  public verticalOffset = 0;
  public verticalVelocity = 0;
  
  public tractionModifier = 1.0;

  constructor(config: PhysicsConfig) {
    this.config = config;
  }

  public update(dt: number, inputs: { throttle: number, brake: number, steer: number }) {
    // 1. Propulsion & Braking
    const powerScale = this.velocity < 20 ? 1.2 : 1.0; // Low-end torque
    const effectiveAccel = this.config.acceleration * this.tractionModifier * powerScale;
    const targetAccel = inputs.throttle * effectiveAccel;
    
    // Braking is much stronger than acceleration in high-performance cars
    const brakingPower = this.config.manualBraking * 1.2;
    const braking = (inputs.brake * brakingPower) + (this.velocity > 0 ? this.config.engineBraking : 0);
    
    const netAccel = targetAccel - braking;
    this.velocity += netAccel * dt;
    
    // 2. Drag & Tire Scrub
    const drag = 0.0025 * this.velocity * this.velocity;
    this.velocity -= drag * dt;

    // Steering Scrub: Lateral friction loss during cornering
    const normalizedSpeed = this.velocity / this.config.maxSpeed;
    const lateralG = Math.abs(inputs.steer) * normalizedSpeed;
    const scrubIntensity = 0.55; 
    this.velocity -= (this.velocity * lateralG * scrubIntensity) * dt;

    if (this.velocity < 0) this.velocity = 0;
    if (this.velocity > this.config.maxSpeed) this.velocity = this.config.maxSpeed;

    // 3. Steering Dynamics
    // High-speed stability: reduce steering lock as speed increases
    const steerLock = 0.85 - (normalizedSpeed * 0.65);
    const effectiveSteer = inputs.steer * steerLock * this.config.steeringSensitivity;

    // Turn rate is based on velocity (Ackermann approximation)
    const turnSensitivity = 3.2;
    const turningCircle = Math.min(this.velocity, 35.0); 
    this.heading += effectiveSteer * turnSensitivity * (turningCircle / 20) * dt;

    // 4. Weight Transfer (Aesthetics & Physics feedback)
    // Roll: Car leans OUTSIDE the turn
    const targetRoll = -effectiveSteer * normalizedSpeed * this.config.rollFactor * 1.8;
    this.bodyRoll += (targetRoll - this.bodyRoll) * this.config.angularDamping * dt;

    // Pitch: Nose dives on brake, lifts on throttle
    const accelerationForce = netAccel / this.config.acceleration;
    const targetPitch = accelerationForce * this.config.pitchFactor * 1.5;
    this.bodyPitch += (targetPitch - this.bodyPitch) * this.config.angularDamping * dt;

    // 5. Movement
    this.position.x += Math.sin(this.heading) * this.velocity * dt;
    this.position.z += Math.cos(this.heading) * this.velocity * dt;

    // 6. Micro-suspension (Road feel)
    const roadNoise = (Math.random() - 0.5) * 0.005 * normalizedSpeed;
    const groundLevel = (Math.sin(this.position.x * 0.8) * 0.01) + roadNoise;
    const springError = groundLevel - this.verticalOffset;
    
    this.verticalVelocity += (springError * this.config.suspensionStiffness - this.verticalVelocity * this.config.suspensionDamping) * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    this.position.y = 0.3 + this.verticalOffset;
  }

  public getTelemetry(inputs: { throttle: number, brake: number, steer: number }, extra: { score: number, lap: number, position: number, level: number }): TelemetryData {
    const kph = this.velocity * 3.6;
    
    // Simulate a 6-speed sequential gearbox
    const gearThresholds = [0, 40, 80, 130, 190, 260];
    let gear = 1;
    for (let i = 1; i < gearThresholds.length; i++) {
      if (kph > gearThresholds[i]) gear = i + 1;
    }

    // RPM logic relative to gear
    const currentGearMin = gearThresholds[gear - 1];
    const currentGearMax = gearThresholds[gear] || 400;
    const gearRange = currentGearMax - currentGearMin;
    const rpmBase = ((kph - currentGearMin) / gearRange) * 5000;
    const rpm = Math.min(9000, 2000 + rpmBase + (inputs.throttle * 500));

    return {
      speed: Math.round(kph),
      bodyRoll: Math.round(this.bodyRoll * 57.29),
      bodyPitch: Math.round(this.bodyPitch * 57.29),
      rpm: Math.round(rpm),
      gear: gear,
      throttle: inputs.throttle,
      brake: inputs.brake,
      steering: inputs.steer,
      score: extra.score,
      lap: extra.lap,
      position: extra.position,
      level: extra.level
    };
  }
}
