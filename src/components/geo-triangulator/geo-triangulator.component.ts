import { Component, ChangeDetectionStrategy, input, effect, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

interface Signal {
  angle: number;
  distance: number;
  strength: number;
  speed: number;
  pulseSize: number;
  pulseAlpha: number;
}

@Component({
  selector: 'app-geo-triangulator',
  templateUrl: './geo-triangulator.component.html',
  styleUrls: ['./geo-triangulator.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeoTriangulatorComponent implements AfterViewInit, OnDestroy {
  emfReading = input.required<number>();
  @ViewChild('radarCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private signal: Signal | null = null;
  private animationFrameId: number | null = null;
  private size = 0;
  private center = 0;
  private pulseCounter = 0;

  constructor() {
    effect(() => {
      const reading = this.emfReading();
      if (reading > 10 && !this.signal) {
        this.signal = this.createSignal();
      } else if (reading <= 10 && this.signal) {
        this.signal = null;
      }
      
      if (this.signal) {
        this.signal.strength = reading / 100;
        this.signal.speed = (reading / 100) * 0.05;
      }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.ctx = context;

    const rect = canvas.parentElement!.getBoundingClientRect();
    this.size = canvas.width = canvas.height = rect.width;
    this.center = this.size / 2;
    
    this.startAnimation();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private createSignal(): Signal {
    return {
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * (this.center * 0.8),
      strength: 0.1,
      speed: 0.01,
      pulseSize: 0,
      pulseAlpha: 0,
    };
  }

  private startAnimation() {
    let rotation = 0;
    const animate = () => {
      rotation += 0.02;
      this.pulseCounter += 0.05;
      this.draw(rotation);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private draw(rotation: number) {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.size, this.size);
    const readingFactor = this.emfReading() / 100;

    // Draw grid
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
    this.ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const distortion = this.center * 0.03 * Math.sin(this.pulseCounter * 0.5 + i) * readingFactor;
      this.ctx.beginPath();
      this.ctx.arc(this.center, this.center, ((this.center * 0.9 / 3) * i) + distortion, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Draw sweep
    this.ctx.save();
    this.ctx.translate(this.center, this.center);
    this.ctx.rotate(rotation);
    const gradient = this.ctx.createLinearGradient(0, 0, this.center, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0.5)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.arc(0, 0, this.center * 0.9, 0, Math.PI * 0.25);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();


    // Draw signal
    if (this.signal) {
      this.signal.angle += this.signal.speed * (Math.random() - 0.5);
      this.signal.distance += (Math.random() - 0.5) * 2;
      this.signal.distance = Math.max(0, Math.min(this.signal.distance, this.center * 0.85));
      
      const x = this.center + Math.cos(this.signal.angle) * this.signal.distance;
      const y = this.center + Math.sin(this.signal.angle) * this.signal.distance;
      
      // Color shifts from green (120) to red (0) based on strength
      const hue = 120 - (this.signal.strength * 120);

      // Pulsing effect
      this.signal.pulseSize = (Math.sin(this.pulseCounter * (1 + this.signal.strength * 2)) + 1) / 2; // 0 to 1
      this.signal.pulseAlpha = 1 - this.signal.pulseSize;
      
      // Draw pulse
      this.ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${this.signal.pulseAlpha * 0.5})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4 + this.signal.pulseSize * 10 * this.signal.strength, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw main dot
      this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, 1)`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}