
import { Component, ChangeDetectionStrategy, input, effect, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  decay: number;
}

@Component({
  selector: 'app-spectral-map',
  templateUrl: './spectral-map.component.html',
  styleUrls: ['./spectral-map.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpectralMapComponent implements AfterViewInit, OnDestroy {
  emfReading = input.required<number>();
  @ViewChild('spectralCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    effect(() => {
      if (!this.ctx) return;
      const reading = this.emfReading();
      const targetParticleCount = Math.floor((reading / 100) * 350); // Increased density
      
      while (this.particles.length < targetParticleCount) {
        this.particles.push(this.createParticle());
      }
      while (this.particles.length > targetParticleCount && this.particles.length > 0) {
        this.particles.pop();
      }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('Failed to get 2D context');
      return;
    }
    this.ctx = context;

    const rect = canvas.parentElement!.getBoundingClientRect();
    this.width = canvas.width = rect.width;
    this.height = canvas.height = rect.height;
    
    this.startAnimation();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private createParticle(): Particle {
    const readingFactor = this.emfReading() / 100;
    return {
      x: this.width / 2,
      y: this.height / 2,
      vx: (Math.random() - 0.5) * (2 + readingFactor * 5), // More velocity with EMF
      vy: (Math.random() - 0.5) * (2 + readingFactor * 5),
      radius: Math.random() * 1.5 + 1 + readingFactor * 2, // Larger radius with EMF
      alpha: Math.random() * 0.5 + 0.3,
      decay: Math.random() * 0.01 + 0.005,
    };
  }

  private startAnimation() {
    const animate = () => {
      this.draw();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private draw() {
    if (!this.ctx) return;

    // Create a motion trail effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const readingFactor = this.emfReading() / 100;
    // Brighter particles with higher EMF
    const intensity = Math.min(1.5, 0.5 + readingFactor * 2);

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
        Object.assign(p, this.createParticle());
        p.alpha = Math.random() * 0.5 + 0.3; // Reset alpha
      }
      
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(110, 231, 183, ${p.alpha * intensity})`;
      this.ctx.fill();
    });
  }
}