
export interface PhysicsConfig {
  maxSpeed: number;
  acceleration: number;
  engineBraking: number;
  manualBraking: number;
  steeringSensitivity: number;
  leanFactor: number;
  angularDamping: number;
  tractionAsphalt: number;
  suspensionStiffness: number;
  suspensionDamping: number;
}

export interface TelemetryData {
  speed: number;
  leanAngle: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  score: number;
  lap: number;
  position: number;
  // Game state fields are optional for parts of the system (like physics) that don't track them
  currentTask?: string;
  taskProgress?: number;
  taskTotal?: number;
}

export enum SurfaceType {
  Asphalt = 'Asphalt',
  Dirt = 'Dirt',
  Wet = 'Wet',
  Oil = 'Oil'
}

export enum TaskType {
  Speed = "SPEED_DEMON",
  Collect = "GEM_HUNTER",
  Checkpoint = "PRECISION_PILOT"
}
