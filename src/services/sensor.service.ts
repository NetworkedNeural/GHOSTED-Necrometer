import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SensorService {
  orientation = signal<{ alpha: number; beta: number; gamma: number } | null>(null);
  motion = signal<{ x: number; y: number; z: number } | null>(null);

  private hasPermissions = signal(false);

  // Using arrow functions to preserve `this` context in event handlers
  private handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
      this.orientation.set({ alpha: event.alpha, beta: event.beta, gamma: event.gamma });
    }
  };

  private handleMotion = (event: DeviceMotionEvent) => {
    if (event.accelerationIncludingGravity?.x) {
      this.motion.set({
        x: event.accelerationIncludingGravity.x,
        y: event.accelerationIncludingGravity.y!,
        z: event.accelerationIncludingGravity.z!,
      });
    }
  };

  async start(): Promise<void> {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      console.warn('Device Orientation API not supported.');
      return;
    }

    // For iOS 13+ we need to request permission
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          this.hasPermissions.set(true);
        } else {
          console.warn('Permission for Device Orientation not granted.');
          return;
        }
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return;
      }
    } else {
      // For other browsers, permission is often granted by default or handled differently
      this.hasPermissions.set(true);
    }

    if (this.hasPermissions()) {
        window.addEventListener('deviceorientation', this.handleOrientation, true);
        window.addEventListener('devicemotion', this.handleMotion, true);
    }
  }

  stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.handleOrientation, true);
      window.removeEventListener('devicemotion', this.handleMotion, true);
    }
  }
}
