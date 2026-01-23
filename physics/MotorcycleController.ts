import { PhysicsConfig, TelemetryData } from '../types';

export class MotorcycleController {
  public config: PhysicsConfig;
  
  public position = { x: 0, y: 0.5, z: 0 };
  public velocity = 0;
  public heading = 0;
  public leanAngle = 0; // Radians
  public pitchAngle = 0; // For wheelies/stoppies visual
  public verticalOffset = 0;
  public verticalVelocity = 0;
  
  private lastSteerInput = 0;

  constructor(config: PhysicsConfig) {
    this.config = config;
  }

  public update(dt: number, inputs: { throttle: number, brake: number, steer: number }) {
    const normalizedSpeed = this.velocity / this.config.maxSpeed;

    // 1. Acceleration & Braking
    const torqueCurve = 1.0 + (1.0 - normalizedSpeed) * 0.5; // More torque at low RPM
    const accel = inputs.throttle * this.config.acceleration * torqueCurve;
    const braking = inputs.brake * this.config.manualBraking + this.config.engineBraking;
    
    this.velocity += (accel - (this.velocity > 0 ? braking : 0)) * dt;
    
    // Aerodynamic Drag
    const drag = 0.004 * this.velocity * this.velocity;
    this.velocity -= drag * dt;

    if (this.velocity < 0) this.velocity = 0;
    if (this.velocity > this.config.maxSpeed) this.velocity = this.config.maxSpeed;

    // 2. Steering & Lean Dynamics (The core of Moto Physics)
    // Counter-steering: To turn left, you pull the left bar, bike leans left.
    // At high speed, the bike is harder to lean (Gyroscopic stability)
    const stability = 1.0 + normalizedSpeed * 2.0; 
    const leanSpeed = (this.config.steeringSensitivity * 2.5) / stability;
    
    // Target lean is based on speed and steering input
    // More speed + more steer = deeper lean
    const targetLean = -inputs.steer * (0.8 * normalizedSpeed + 0.2); 
    
    // Smoothly interpolate to target lean
    this.leanAngle += (targetLean - this.leanAngle) * leanSpeed * dt;

    // Turn rate is a function of lean angle and velocity
    // Physics: tan(lean) = v^2 / (g * r) => turnRate (v/r) = g * tan(lean) / v
    const gravity = 9.81;
    const turnRate = (this.velocity > 1) 
      ? (gravity * Math.tan(Math.abs(this.leanAngle)) / this.velocity) * Math.sign(-this.leanAngle)
      : -inputs.steer * 2.0; // Hand-pushed turn at very low speed

    this.heading += turnRate * dt;

    // 3. Wheelie/Pitch Logic
    const accelG = (accel - braking) / 10;
    this.pitchAngle += (accelG * 0.1 - this.pitchAngle) * 5 * dt;

    // 4. Movement
    this.position.x += Math.sin(this.heading) * this.velocity * dt;
    this.position.z += Math.cos(this.heading) * this.velocity * dt;

    // 5. Suspension (Simple spring-damper)
    const roadNoise = (Math.random() - 0.5) * 0.01 * normalizedSpeed;
    const springForce = -this.verticalOffset * this.config.suspensionStiffness;
    const dampingForce = -this.verticalVelocity * this.config.suspensionDamping;
    this.verticalVelocity += (springForce + dampingForce) * dt;
    this.verticalOffset += (this.verticalVelocity + roadNoise) * dt;
    this.position.y = 0.6 + this.verticalOffset;
  }

  public getTelemetry(inputs: { throttle: number, brake: number, steer: number }, extra: { score: number, lap: number, position: number, level: number }): TelemetryData {
    const kph = this.velocity * 3.6;
    const gear = Math.min(6, Math.floor(kph / 45) + 1);
    const rpm = 2000 + (kph % 45) * 200 + (inputs.throttle * 1000);

    return {
      speed: Math.round(kph),
      bodyRoll: Math.round(this.leanAngle * 57.29),
      bodyPitch: Math.round(this.pitchAngle * 57.29),
      rpm: Math.round(rpm),
      gear,
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