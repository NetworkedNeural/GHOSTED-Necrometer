import { Injectable, signal, effect, OnDestroy, inject } from '@angular/core';
import { SensorService } from './sensor.service';

@Injectable({
  providedIn: 'root',
})
export class DeviceStateService implements OnDestroy {
  private sensorService = inject(SensorService);
  emfReading = signal(0);

  private lastMotion = { x: 0, y: 0, z: 0 };
  private lastAlpha = 0;
  private updateInterval: any;

  constructor() {
    // Start the update loop when the service is created
    this.updateInterval = setInterval(() => this.updateEmf(), 100);

    // This effect will react to sensor changes and calculate the EMF
    effect(() => {
        const motion = this.sensorService.motion();
        const orientation = this.sensorService.orientation();
        
        let motionSpike = 0;
        let orientationSpike = 0;

        if (motion) {
            const deltaX = Math.abs(motion.x - this.lastMotion.x);
            const deltaY = Math.abs(motion.y - this.lastMotion.y);
            const deltaZ = Math.abs(motion.z - this.lastMotion.z);
            const totalDelta = deltaX + deltaY + deltaZ;
            
            // A sharp jerk will create a high delta
            if (totalDelta > 15) { // Threshold for a significant jerk
                motionSpike = Math.min(totalDelta * 3, 60); // Cap the spike
            }
            this.lastMotion = motion;
        }

        if (orientation) {
            // Check for rapid spinning
            let deltaAlpha = Math.abs(orientation.alpha - this.lastAlpha);
            if (deltaAlpha > 180) deltaAlpha = 360 - deltaAlpha; // Handle wrap-around from 359 to 0
            
            if (deltaAlpha > 20) { // Fast spin
                orientationSpike = Math.min(deltaAlpha, 40);
            }
            this.lastAlpha = orientation.alpha;
        }

        const currentEmf = this.emfReading();
        // Add spikes to the current reading, but don't let it go over 100
        const newEmf = Math.min(100, currentEmf + motionSpike + orientationSpike);
        
        if (newEmf > currentEmf) {
            this.emfReading.set(newEmf);
        }
    });
  }

  // This method will handle the natural decay of the signal
  private updateEmf(): void {
    this.emfReading.update(current => {
      // Apply decay, but keep a tiny bit of base noise
      const decay = current * 0.95;
      const baseNoise = (Math.random() - 0.5) * 0.5;
      return Math.max(0, decay + baseNoise);
    });
  }

  ngOnDestroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}