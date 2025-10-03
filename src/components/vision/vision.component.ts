import { Component, ChangeDetectionStrategy, inject, signal, input, effect, OnDestroy, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceStateService } from '../../services/device-state.service';
import { DetectedEntity, AREntity, SceneObject } from '../../types';
import { SensorService } from '../../services/sensor.service';
import { UpgradeService } from '../../services/upgrade.service';
import { GeminiService } from '../../services/gemini.service';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-vision',
  imports: [CommonModule],
  templateUrl: './vision.component.html',
  styleUrls: ['./vision.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisionComponent implements OnInit, OnDestroy {
  detections = input.required<DetectedEntity[]>();
  deviceState = inject(DeviceStateService);
  private sensorService = inject(SensorService);
  private upgradeService = inject(UpgradeService);
  private geminiService = inject(GeminiService);
  private audioService = inject(AudioService);

  arEntities = signal<AREntity[]>([]);
  targetedEntity = signal<AREntity | null>(null);
  currentTime = signal(Date.now());

  // State for environmental scanning
  isScanningEnvironment = signal(false);
  scanError = signal<string | null>(null);
  sceneObjects = signal<SceneObject[]>([]);
  readonly scanCost = 5;

  private animationFrameId: number | null = null;
  
  private physics = {
    gravityTilt: 0.00005,
    downwardDrift: 0.00002,
    friction: 0.97,
    emfAgitation: 0.00015,
    maxSpeed: 0.2,
    // Properties for scene interaction - tuned for subtlety
    sceneRepulsion: 0.0001, // Reduced force for a more subtle push
    sceneRepulsionRadius: 12,   // Increased radius for a wider, gentler interaction field
  };
  
  constructor() {
    effect(() => {
      const currentDets = this.detections();
      
      this.arEntities.update(oldArEntities => {
        const oldArEntitiesMap = new Map(oldArEntities.map(e => [e.id, e]));
        
        return currentDets.map(detection => {
          const existingArEntity = oldArEntitiesMap.get(detection.id);
          
          if (existingArEntity) {
            return Object.assign({}, existingArEntity, detection);
          } else {
            const { x, y } = this.getNewSpawnPosition();
            return Object.assign({}, detection, {
              x,
              y,
              vx: (Math.random() - 0.5) * 0.05,
              vy: (Math.random() - 0.5) * 0.05,
              ax: 0,
              ay: 0,
            });
          }
        });
      });
    });
  }

  ngOnInit() {
    this.startAnimationLoop();
  }

  ngOnDestroy() {
    this.stopAnimationLoop();
  }

  distortionLevel = computed(() => {
    const reading = this.deviceState.emfReading();
    if (reading < 40) return 0;
    if (reading > 95) return 10;
    return Math.floor(((reading - 40) / 55) * 8) + 1; // 1-9 scale
  });

  async scanEnvironment() {
    if (this.isScanningEnvironment()) return;

    if (!this.upgradeService.spendCredits(this.scanCost)) {
      this.scanError.set(`Insufficient Credits. Requires ${this.scanCost} NC.`);
      setTimeout(() => this.scanError.set(null), 4000);
      return;
    }

    this.isScanningEnvironment.set(true);
    this.scanError.set(null);
    this.sceneObjects.set([]);

    try {
      const result = await CameraPreview.capture({ quality: 85 });
      const analysisResult = await this.geminiService.analyzeScene(result.value);
      this.sceneObjects.set(analysisResult.objects);
      
      // Clear results after a delay
      setTimeout(() => this.sceneObjects.set([]), 15000);
    } catch (err) {
      console.error('Environment scan failed:', err);
      this.scanError.set('Scene analysis failed. Connection unstable.');
       // refund credits on failure
      this.upgradeService.addCredits(this.scanCost);
      setTimeout(() => this.scanError.set(null), 4000);
    } finally {
      this.isScanningEnvironment.set(false);
    }
  }

  pointsToString(points: { x: number; y: number }[]): string {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  private getNewSpawnPosition(): { x: number, y: number } {
    const activeSceneObjects = this.sceneObjects();
    // 70% chance to spawn near an object if any are detected
    const spawnBehindObject = activeSceneObjects.length > 0 && Math.random() < 0.7;

    if (spawnBehindObject) {
      // Pick a random object and a random polyline from it
      const randomObject = activeSceneObjects[Math.floor(Math.random() * activeSceneObjects.length)];
      if (randomObject.polylines.length > 0) {
        const randomPolyline = randomObject.polylines[Math.floor(Math.random() * randomObject.polylines.length)];
        
        if (randomPolyline.length > 0) {
          // Pick a random point on that polyline
          const randomPoint = randomPolyline[Math.floor(Math.random() * randomPolyline.length)];
          
          // Spawn near this point with a small offset
          const offsetX = (Math.random() - 0.5) * 8; // offset by up to 4%
          const offsetY = (Math.random() - 0.5) * 8;
          
          let x = randomPoint.x + offsetX;
          let y = randomPoint.y + offsetY;
          
          // Clamp values to be within the screen bounds but not on the very edge
          x = Math.max(5, Math.min(95, x));
          y = Math.max(5, Math.min(95, y));

          return { x, y };
        }
      }
    }

    // Fallback or if no objects are available: Peripheral spawning
    let x: number, y: number;
    // Define a 30% wide/tall exclusion zone in the center
    const centralExclusionZone = { xMin: 35, xMax: 65, yMin: 35, yMax: 65 };

    if (Math.random() < 0.5) { // Spawn on top/bottom edges
      x = Math.random() * 100;
      y = Math.random() < 0.5 
        ? Math.random() * (centralExclusionZone.yMin) // Top area
        : centralExclusionZone.yMax + Math.random() * (100 - centralExclusionZone.yMax); // Bottom area
    } else { // Spawn on left/right edges
      y = Math.random() * 100;
      x = Math.random() < 0.5 
        ? Math.random() * (centralExclusionZone.xMin) // Left area
        : centralExclusionZone.xMax + Math.random() * (100 - centralExclusionZone.xMax); // Right area
    }
    
    // Clamp to keep them from spawning exactly on the edge and being hard to see
    x = Math.max(5, Math.min(95, x));
    y = Math.max(5, Math.min(95, y));
    
    return { x, y };
  }

  private startAnimationLoop() {
    const animate = () => {
      this.currentTime.set(Date.now());
      this.updateAREntities();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private updateAREntities() {
    const orientation = this.sensorService.orientation();
    const gravityX = orientation ? (orientation.gamma / 90) : 0; 
    const gravityY = orientation ? (Math.max(-90, Math.min(90, orientation.beta)) / 90) : 0;

    const activeSceneObjects = this.sceneObjects(); // Get scene objects once per frame

    this.arEntities.update(entities => {
      let closestEntity: AREntity | null = null;
      let minDistance = 15; // Targeting threshold in viewport % units

      const emfReading = this.deviceState.emfReading();
      const now = Date.now();
      
      const updatedEntities = entities.map(e => {
        let { x, y, vx, vy, ax, ay, interactionTime } = e;

        if (e.contained) {
          // Contained entities are not affected by physics and just drift to a stop.
          vx *= 0.9;
          vy *= 0.9;
          x += vx;
          y += vy;
          return { ...e, x, y, vx, vy, ax: 0, ay: 0, isInteracting: false };
        }
        
        ax = 0;
        ay = 0;

        // --- FORCES ---

        // 1. Gravity from device tilt
        ax += gravityX * this.physics.gravityTilt;
        ay += gravityY * this.physics.gravityTilt;
        
        // 2. Constant downward drift to simulate being in a real space
        ay += this.physics.downwardDrift;

        // 3. EMF Agitation (random, erratic movements proportional to EMF)
        const agitation = emfReading * this.physics.emfAgitation;
        ax += (Math.random() - 0.5) * agitation;
        ay += (Math.random() - 0.5) * agitation;
        
        // 4. Repulsion from scene objects
        let hasInteractedThisFrame = false;
        if (activeSceneObjects.length > 0) {
          for (const obj of activeSceneObjects) {
            for (const polyline of obj.polylines) {
              for (const point of polyline) {
                const dx = x - point.x;
                const dy = y - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.physics.sceneRepulsionRadius) {
                  hasInteractedThisFrame = true;
                  const forceMagnitude = (this.physics.sceneRepulsionRadius - distance) * this.physics.sceneRepulsion;
                  
                  // Play sound with a cooldown
                  if (!interactionTime || now - interactionTime > 500) {
                      this.audioService.playInteractionHum();
                      interactionTime = now;
                  }
                  
                  // Avoid division by zero if distance is exactly 0
                  if (distance > 0) {
                     const forceX = (dx / distance) * forceMagnitude;
                     const forceY = (dy / distance) * forceMagnitude;
                     ax += forceX;
                     ay += forceY;
                  }
                }
              }
            }
          }
        }
        
        // --- PHYSICS INTEGRATION ---
        
        vx += ax;
        vy += ay;
        
        vx *= this.physics.friction;
        vy *= this.physics.friction;

        // Clamp speed to a maximum
        const speed = Math.sqrt(vx*vx + vy*vy);
        if (speed > this.physics.maxSpeed) {
            vx = (vx / speed) * this.physics.maxSpeed;
            vy = (vy / speed) * this.physics.maxSpeed;
        }

        x += vx;
        y += vy;
        
        // --- OFF-SCREEN BEHAVIOR ---
        // If an entity drifts off the bottom, left, or right edge, reset it to appear from the top.
        if (y > 105 || x < -5 || x > 105) {
            x = Math.random() * 80 + 10; // Respawn at a random horizontal position
            y = -5; // Start just above the screen
            vx = (Math.random() - 0.5) * 0.02; // Give it a new, gentle horizontal velocity
            vy = Math.random() * 0.05; // Ensure it drifts downwards
        }
        
        const updatedEntity = { ...e, x, y, vx, vy, ax, ay, interactionTime, isInteracting: hasInteractedThisFrame };

        // --- TARGETING ---
        const distanceToCenter = Math.sqrt(Math.pow(updatedEntity.x - 50, 2) + Math.pow(updatedEntity.y - 45, 2));
        if (distanceToCenter < minDistance) {
            minDistance = distanceToCenter;
            closestEntity = updatedEntity;
        }
        
        return updatedEntity;
      });

      this.targetedEntity.set(closestEntity);
      return updatedEntities;
    });
  }
}