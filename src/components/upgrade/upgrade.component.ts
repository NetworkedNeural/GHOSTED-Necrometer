import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpgradeService } from '../../services/upgrade.service';

@Component({
  selector: 'app-upgrade', // The selector remains app-upgrade, but it now functions as the store.
  imports: [CommonModule],
  templateUrl: './upgrade.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradeComponent {
  upgradeService = inject(UpgradeService);

  purchaseCredits(amount: number) {
    this.upgradeService.addCredits(amount);
  }

  purchasePro() {
    this.upgradeService.subscribeToPro();
  }
}
