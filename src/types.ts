export interface EntityProfile {
  name: string;
  type: string;
  backstory: string;
  instability: number; // 0-100 scale
  contained: boolean;
  glyphB64: string;
}

export interface DetectedEntity extends EntityProfile {
  id: number;
  timestamp: Date;
  emfReading: number;
}

export interface AREntity extends DetectedEntity {
  x: number; // position on screen (percentage)
  y: number;
  vx: number; // velocity
  vy: number;
  ax: number; // acceleration
  ay: number;
  interactionTime?: number; // Timestamp of the last scene interaction
  isInteracting?: boolean; // Flag for a momentary visual effect
}

export interface DetectionEvent {
  emf: number;
  strength: 'weak' | 'moderate' | 'strong' | 'critical';
}

export interface EVPAnalysis {
  transcription: string;
  confidence: number;
}

export interface TemporalEcho {
  title: string;
  era: string;
  description: string;
}

export interface CrossReferenceResult {
  match: boolean;
  details: string;
}

export interface EmotionalResonanceResult {
  emotions: string[];
  summary: string;
}

export interface ContainmentRitual {
  steps: string[];
  outcome: string;
}

export interface SceneObject {
  name: string;
  polylines: { x: number; y: number }[][];
}

export interface SceneAnalysisResult {
  objects: SceneObject[];
}