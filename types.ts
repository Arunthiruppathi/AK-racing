
export interface PhysicsConfig {
  maxSpeed: number;
  acceleration: number;
  engineBraking: number;
  manualBraking: number;
  steeringSensitivity: number;
  rollFactor: number;
  pitchFactor: number;
  angularDamping: number;
  tractionAsphalt: number;
  suspensionStiffness: number;
  suspensionDamping: number;
}

export interface TelemetryData {
  speed: number;
  bodyRoll: number;
  bodyPitch: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  score: number;
  lap: number;
  position: number;
  level: number;
  currentTask?: string;
  taskProgress?: number;
  taskTotal?: number;
}

export enum TaskType {
  Speed = "SPEED_DEMON",
  Collect = "GEM_HUNTER",
  Checkpoint = "PRECISION_PILOT"
}
