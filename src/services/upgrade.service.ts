import { Injectable, signal, effect } from '@angular/core';

const UPGRADE_STORAGE_KEY = 'necrometer_upgrades';

interface UpgradeState {
  credits: number;
  isPro: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UpgradeService {
  // Start the user with a welcome bonus of credits
  credits = signal(15);
  isPro = signal(false);
  
  private readonly proMonthlyCreditStipend = 100;

  constructor() {
    this.loadState();
    // Save state whenever credits or pro status changes
    effect(() => {
      this.saveState();
    });
  }

  /**
   * Spends a specified amount of credits.
   * @param amount The number of credits to spend.
   * @returns `true` if the user had enough credits, `false` otherwise.
   */
  spendCredits(amount: number): boolean {
    if (this.credits() >= amount) {
      this.credits.update(c => c - amount);
      return true;
    }
    return false;
  }

  /**
   * Adds a specified amount of credits to the user's balance.
   * @param amount The number of credits to add.
   */
  addCredits(amount: number) {
    this.credits.update(c => c + amount);
  }

  /**
   * Simulates subscribing the user to the Pro plan.
   */
  subscribeToPro() {
    if (this.isPro()) return;
    this.isPro.set(true);
    this.addCredits(this.proMonthlyCreditStipend);
  }

  private saveState(): void {
    try {
      const state: UpgradeState = {
        credits: this.credits(),
        isPro: this.isPro(),
      };
      localStorage.setItem(UPGRADE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving upgrade state to localStorage', error);
    }
  }

  private loadState(): void {
    try {
      const savedState = localStorage.getItem(UPGRADE_STORAGE_KEY);
      if (savedState) {
        const state: UpgradeState = JSON.parse(savedState);
        this.credits.set(state.credits ?? 15);
        this.isPro.set(state.isPro ?? false);
      }
    } catch (error) {
      console.error('Error loading upgrade state from localStorage', error);
    }
  }
}
