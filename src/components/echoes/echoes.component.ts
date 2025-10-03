import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { TemporalEcho } from '../../types';
import { UpgradeService } from '../../services/upgrade.service';

type ScanState = 'idle' | 'scanning' | 'result' | 'error';

@Component({
  selector: 'app-echoes',
  imports: [CommonModule],
  templateUrl: './echoes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EchoesComponent {
  state = signal<ScanState>('idle');
  echo = signal<TemporalEcho | null>(null);
  error = signal<string | null>(null);

  private geminiService = inject(GeminiService);
  private upgradeService = inject(UpgradeService);
  readonly scanCost = 3;

  async scanForEcho() {
    this.echo.set(null);
    this.error.set(null);

    if (!this.upgradeService.spendCredits(this.scanCost)) {
      this.error.set(`Insufficient Credits. Scan requires ${this.scanCost} NC.`);
      this.state.set('error');
      return;
    }

    this.state.set('scanning');

    try {
      const result = await this.geminiService.getTemporalEcho();
      this.echo.set(result);
      this.state.set('result');
    } catch (err) {
      console.error('Temporal Echo scan failed:', err);
      this.error.set('Failed to resolve temporal distortions. The signal is too weak.');
      this.state.set('error');
    }
  }

  reset() {
    this.state.set('idle');
    this.error.set(null);
    this.echo.set(null);
  }
}
