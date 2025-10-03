import { Injectable } from '@angular/core';
import { DetectedEntity } from '../types';

const DETECTIONS_STORAGE_KEY = 'necrometer_detections';

@Injectable({
  providedIn: 'root',
})
export class PersistenceService {

  saveDetections(detections: DetectedEntity[]): void {
    try {
      const data = JSON.stringify(detections);
      localStorage.setItem(DETECTIONS_STORAGE_KEY, data);
    } catch (error) {
      console.error('Error saving detections to localStorage', error);
    }
  }

  loadDetections(): DetectedEntity[] {
    try {
      const data = localStorage.getItem(DETECTIONS_STORAGE_KEY);
      if (data) {
        const detections = JSON.parse(data) as DetectedEntity[];
        // Rehydrate Date objects from string representations
        return detections.map(detection => ({
          ...detection,
          timestamp: new Date(detection.timestamp),
        }));
      }
    } catch (error) {
      console.error('Error loading detections from localStorage', error);
      // If there's an error, clear the corrupted data to prevent future issues
      localStorage.removeItem(DETECTIONS_STORAGE_KEY);
    }
    return [];
  }
}
