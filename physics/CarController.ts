
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
    // 1. Acceleration & Braking
    const effectiveAccel = this.config.acceleration * this.tractionModifier;
    const targetAccel = inputs.throttle * effectiveAccel;
    const braking = (inputs.brake * this.config.manualBraking) + (this.velocity > 0 ? this.config.engineBraking : 0);
    
    const netAccel = targetAccel - braking;
    this.velocity += netAccel * dt;
    
    // 2. Drag & Steering Scrub (Speed reduction during turns)
    const drag = 0.003 * this.velocity * this.velocity;
    this.velocity -= drag * dt;

    // Steering Scrub: Tires lose forward momentum when turned sharply
    // Scrub increases with steering angle and current velocity
    const normalizedSpeed = this.velocity / this.config.maxSpeed;
    const scrubFactor = Math.abs(inputs.steer) * normalizedSpeed * 0.45; 
    this.velocity -= (this.velocity * scrubFactor) * dt;

    if (this.velocity < 0) this.velocity = 0;
    if (this.velocity > this.config.maxSpeed) this.velocity = this.config.maxSpeed;

    // 3. Car Steering
    // Lower steering lock at high speeds for stability
    const steerLimit = (1.0 - (normalizedSpeed * 0.7)) * this.tractionModifier; 
    const effectiveSteer = inputs.steer * steerLimit;

    // Turning rate scales with speed but caps to prevent infinite spinning at low speed
    const turnRate = effectiveSteer * 2.8 * this.config.steeringSensitivity;
    this.heading += turnRate * Math.min(this.velocity, 20.0) * dt;

    // 4. Body Dynamics (Roll & Pitch)
    const targetRoll = -effectiveSteer * normalizedSpeed * this.config.rollFactor;
    this.bodyRoll += (targetRoll - this.bodyRoll) * this.config.angularDamping * dt;

    const targetPitch = (netAccel / this.config.acceleration) * this.config.pitchFactor;
    this.bodyPitch += (targetPitch - this.bodyPitch) * this.config.angularDamping * dt;

    // 5. Movement
    this.position.x += Math.sin(this.heading) * this.velocity * dt;
    this.position.z += Math.cos(this.heading) * this.velocity * dt;

    // 6. Suspension
    const groundLevel = Math.sin(this.position.x * 0.5) * 0.02 + Math.cos(this.position.z * 0.5) * 0.02;
    const error = groundLevel - this.verticalOffset;
    const springForce = error * this.config.suspensionStiffness;
    const dampingForce = -this.verticalVelocity * this.config.suspensionDamping;
    
    this.verticalVelocity += (springForce + dampingForce) * dt;
    this.verticalOffset += this.verticalVelocity * dt;
    this.position.y = 0.3 + this.verticalOffset;
  }

  public getTelemetry(inputs: { throttle: number, brake: number, steer: number }, extra: { score: number, lap: number, position: number, level: number }): TelemetryData {
    return {
      speed: Math.round(this.velocity * 3.6),
      bodyRoll: Math.round(this.bodyRoll * 57.29),
      bodyPitch: Math.round(this.bodyPitch * 57.29),
      rpm: Math.min(8500, 1000 + (this.velocity * 150) % 7500),
      gear: Math.floor(this.velocity / 18) + 1,
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
