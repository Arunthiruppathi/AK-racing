
import { PhysicsConfig, TelemetryData } from '../types';

export class MotorcycleController {
  public config: PhysicsConfig;
  
  // State variables
  public position = { x: 0, y: 0.5, z: 0 };
  public velocity = 0;
  public heading = 0;
  public leanAngle = 0;
  public verticalOffset = 0;
  public verticalVelocity = 0;
  
  // Dynamic modifiers
  public tractionModifier = 1.0;
  public stabilityModifier = 1.0;

  constructor(config: PhysicsConfig) {
    this.config = config;
  }

  public update(dt: number, inputs: { throttle: number, brake: number, steer: number }) {
    // 1. Core Movement Model with Traction
    const effectiveAccel = this.config.acceleration * this.tractionModifier;
    const targetAccel = inputs.throttle * effectiveAccel;
    const braking = (inputs.brake * this.config.manualBraking) + (this.velocity > 0 ? this.config.engineBraking : 0);
    
    const netAccel = targetAccel - braking;
    this.velocity += netAccel * dt;
    
    // Drag
    const drag = 0.005 * this.velocity * this.velocity;
    this.velocity -= drag * dt;

    if (this.velocity < 0) this.velocity = 0;
    if (this.velocity > this.config.maxSpeed) this.velocity = this.config.maxSpeed;

    // 2. Steering & Leaning (Refined for Low Speed Agility)
    const normalizedSpeed = this.velocity / this.config.maxSpeed;
    
    // At low speed, we allow a wider steering angle (1.5x) 
    // At high speed, we dampen steering (0.4x) to avoid twitchiness
    const steerLimit = (1.5 - (normalizedSpeed * 1.1)) * this.tractionModifier; 
    const effectiveSteer = inputs.steer * steerLimit;

    // Agility Factor: Boosts turning capability significantly at low speeds
    // This allows for sharp technical turns and 180-degree pivots
    const agilityMultiplier = 2.5 - (normalizedSpeed * 1.8);
    const turnRate = effectiveSteer * agilityMultiplier * this.config.steeringSensitivity;
    
    // Applying heading change. We add a small floor to velocity for steering 
    // to ensure the bike feels responsive even when starting from a stop.
    const turnVelocity = Math.max(this.velocity, 2.0); 
    this.heading += turnRate * turnVelocity * dt;

    // Lean logic: Proportional to speed. No leaning at zero speed, deep leaning at high speed.
    const targetLean = effectiveSteer * normalizedSpeed * this.config.leanFactor * 1.5;
    const effectiveDamping = this.config.angularDamping * this.stabilityModifier;
    this.leanAngle += (targetLean - this.leanAngle) * effectiveDamping * dt;

    // 3. Position update
    this.position.x += Math.sin(this.heading) * this.velocity * dt;
    this.position.z += Math.cos(this.heading) * this.velocity * dt;

    // 5. Suspension
    const groundLevel = Math.sin(this.position.x * 0.5) * 0.05 + Math.cos(this.position.z * 0.5) * 0.05;
    const targetVertical = groundLevel;
    const error = targetVertical - this.verticalOffset;
    const springForce = error * this.config.suspensionStiffness;
    const dampingForce = -this.verticalVelocity * this.config.suspensionDamping;
    
    this.verticalVelocity += (springForce + dampingForce) * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    this.position.y = 0.5 + this.verticalOffset;
  }

  public getTelemetry(inputs: { throttle: number, brake: number, steer: number }, extra: { score: number, lap: number, position: number }): TelemetryData {
    return {
      speed: Math.round(this.velocity * 3.6),
      leanAngle: Math.round(this.leanAngle * 57.29),
      rpm: Math.min(9000, 2000 + (this.velocity * 120) % 7000),
      gear: Math.floor(this.velocity / 15) + 1,
      throttle: inputs.throttle,
      brake: inputs.brake,
      steering: inputs.steer,
      score: extra.score,
      lap: extra.lap,
      position: extra.position
    };
  }
}
