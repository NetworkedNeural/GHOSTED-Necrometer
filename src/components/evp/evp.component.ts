import { Component, ChangeDetectionStrategy, signal, ViewChild, ElementRef, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { EVPAnalysis } from '../../types';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';
import { UpgradeService } from '../../services/upgrade.service';


type RecordingState = 'idle' | 'recording' | 'analyzing' | 'result';

@Component({
  selector: 'app-evp',
  imports: [CommonModule],
  templateUrl: './evp.component.html',
  styleUrls: ['./evp.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvpComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveformCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  state = signal<RecordingState>('idle');
  analysisResult = signal<EVPAnalysis | null>(null);
  error = signal<string | null>(null);
  
  private geminiService = inject(GeminiService);
  private upgradeService = inject(UpgradeService);
  private animationFrameId: number | null = null;
  
  readonly analysisCost = 2;

  ngAfterViewInit() {
    this.drawSilence();
  }
  
  async toggleRecording() {
    if (this.state() === 'recording') {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      const permission = await VoiceRecorder.requestAudioRecordingPermission();
      if (!permission.value) {
        this.error.set("Microphone access is required. Please enable permissions.");
        return;
      }
      await VoiceRecorder.startRecording();
      this.state.set('recording');
      this.error.set(null);
      this.drawSimulatedWaveform();
    } catch (err) {
      console.error("Microphone access denied:", err);
      this.error.set("Failed to start recording. Ensure permissions are enabled.");
      this.state.set('idle');
    }
  }

  async stopRecording() {
    if (this.state() !== 'recording') return;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    try {
        const result: RecordingData = await VoiceRecorder.stopRecording();
        if (result.value) {
            this.analyze();
        } else {
             this.error.set("Recording failed to produce data.");
             this.state.set('idle');
        }
    } catch (err) {
        console.error("Error stopping recording", err);
        this.error.set("An error occurred while stopping the recording.");
        this.state.set('idle');
    }
  }
  
  async analyze() {
    if (!this.upgradeService.spendCredits(this.analysisCost)) {
      this.error.set(`Insufficient Credits. Analysis requires ${this.analysisCost} NC.`);
      this.state.set('idle');
      this.drawSilence();
      return;
    }

    this.state.set('analyzing');
    this.drawSilence();
    try {
      const result = await this.geminiService.getEVPMessage();
      this.analysisResult.set(result);
      this.state.set('result');
    } catch (err) {
      this.error.set("AI analysis failed. The connection is unstable.");
      this.state.set('idle');
    }
  }
  
  reset() {
    this.state.set('idle');
    this.analysisResult.set(null);
    this.error.set(null);
    this.drawSilence();
  }

  drawSimulatedWaveform() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const midY = height / 2;
    let time = 0;
    
    const draw = () => {
      time += 0.05;
      ctx.fillStyle = 'rgb(0, 0, 0)';
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(52, 211, 153)';
      ctx.beginPath();
      ctx.moveTo(0, midY);

      for (let x = 0; x < width; x++) {
        const noise = (Math.sin(x * 0.1 + time) + Math.sin(x * 0.25 + time * 2) * 0.5) * (Math.random() * 5 + 5);
        const y = midY + noise;
        ctx.lineTo(x, y);
      }

      ctx.stroke();
      this.animationFrameId = requestAnimationFrame(draw);
    };
    draw();
  }
  
  drawSilence() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    ctx.fillStyle = 'rgb(0, 0, 0)';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(52, 211, 153)';
    ctx.beginPath();
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);
    ctx.stroke();
  }

  ngOnDestroy() {
    if (this.state() === 'recording') {
        VoiceRecorder.stopRecording();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
