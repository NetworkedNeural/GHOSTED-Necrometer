import { Component, ChangeDetectionStrategy, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectionEvent } from '../../types';
import { SpectralMapComponent } from '../spectral-map/spectral-map.component';
import { GeoTriangulatorComponent } from '../geo-triangulator/geo-triangulator.component';
import { DeviceStateService } from '../../services/device-state.service';

@Component({
  selector: 'app-scanner',
  imports: [CommonModule, SpectralMapComponent, GeoTriangulatorComponent],
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannerComponent {
  detection = output<DetectionEvent>();
  
  status = signal('CALIBRATING...');
  private lastDetectionTime = 0;

  deviceState = inject(DeviceStateService);

  constructor() {
    effect(() => {
      const reading = this.deviceState.emfReading();
      this.updateStatus(reading);
  
      const detectionCooldown = 10000; // 10 seconds
      const now = Date.now();
      
      // Trigger a detection event if reading is critical and cooldown has passed
      if (reading > 90 && (now - this.lastDetectionTime > detectionCooldown)) {
        this.triggerDetection(reading);
        this.lastDetectionTime = now;
        // Reset EMF slightly to prevent immediate re-triggering
        this.deviceState.emfReading.set(20); 
      }
    });
  }

  updateStatus(reading: number) {
    if (reading < 10) this.status.set('SYSTEM NOMINAL');
    else if (reading < 40) this.status.set('TRACE ENERGY DETECTED');
    else if (reading < 75) this.status.set('MODERATE FIELD DISTURBANCE');
    else if (reading < 90) this.status.set('HIGH EMF WARNING');
    else this.status.set('!!! CRITICAL EVENT IMMINENT !!!');
  }

  triggerDetection(reading: number) {
    let strength: DetectionEvent['strength'] = 'weak';
    if (reading > 98) strength = 'critical';
    else if (reading > 95) strength = 'strong';
    else if (reading > 90) strength = 'moderate';
    
    this.detection.emit({ emf: parseFloat(reading.toFixed(2)), strength });
  }

  barColorClass = computed(() => {
    const reading = this.deviceState.emfReading();
    if (reading > 90) return 'bg-red-500';
    if (reading > 75) return 'bg-yellow-500';
    if (reading > 40) return 'bg-teal-400';
    return 'bg-green-500';
  });

   statusColorClass = computed(() => {
    const reading = this.deviceState.emfReading();
    if (reading > 90) return 'text-red-400 animate-pulse';
    if (reading > 75) return 'text-yellow-400';
    if (reading > 40) return 'text-teal-300';
    return 'text-green-400';
  });

  scannerContainerStyles = computed(() => {
    const reading = this.deviceState.emfReading();
    let opacity = 0;
    let duration = 5;
    let blur = 0;

    if (reading > 5) {
      opacity = (reading / 100) * 0.4;
      duration = Math.max(0.5, 3 - (reading / 100) * 2.5); // Faster pulse with higher reading
      blur = (reading / 100) * 20;
    }

    return {
      '--glow-color': `rgba(52, 211, 153, ${opacity})`,
      '--glow-blur': `0 0 ${blur}px var(--glow-color)`,
      'animationDuration': `${duration}s`,
    };
  });

  backgroundDistortionOpacity = computed(() => {
    const reading = this.deviceState.emfReading();
    if (reading < 10) return 0;
    return Math.min((reading / 100) * 0.3, 0.3); // Max 30% opacity
  });
}