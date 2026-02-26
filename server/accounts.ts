import { dbSettingsGet, dbSettingsSet } from "./storage";
import type { AccountEntry, AccountsData } from "@shared/schema";

const SETTINGS_KEY = "accounts";

export class AccountManager {
  private accounts: AccountsData;

  constructor() {
    this.accounts = {};
  }

  private loadAccounts(): void {
    try {
      const raw = dbSettingsGet(SETTINGS_KEY);
      if (raw) {
        this.accounts = JSON.parse(raw);
        Object.keys(this.accounts).forEach((service) => {
          this.accounts[service].forEach((account) => {
            if (!account.currentUsers) account.currentUsers = 0;
            if (!account.maxUsers) account.maxUsers = 5;
            if (!account.usedBy) account.usedBy = [];
            if (account.fullyUsed === undefined) account.fullyUsed = false;
            if (account.disabled === undefined) account.disabled = false;
            if (!account.id) {
              account.id = `${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
          });
        });
      } else {
        this.accounts = {};
      }
    } catch {
      this.accounts = {};
    }
  }

  private saveAccounts(): void {
    dbSettingsSet(SETTINGS_KEY, JSON.stringify(this.accounts));
  }

  checkAvailability(planId: string): { available: boolean; message: string; slots?: number } {
    this.loadAccounts();
    if (!this.accounts[planId] || this.accounts[planId].length === 0) {
      return { available: false, message: "No accounts available for this plan" };
    }
    const available = this.accounts[planId].find(
      (acc) => !acc.fullyUsed && !acc.disabled && acc.currentUsers < acc.maxUsers
    );
    if (available) {
      return {
        available: true,
        message: "Account available",
        slots: available.maxUsers - available.currentUsers,
      };
    }
    return { available: false, message: "All accounts are currently full" };
  }

  assignAccount(planId: string, customerEmail: string, customerName: string): AccountEntry | null {
    this.loadAccounts();
    if (!this.accounts[planId] || this.accounts[planId].length === 0) return null;
    const account = this.accounts[planId].find(
      (acc) => !acc.fullyUsed && !acc.disabled && acc.currentUsers < acc.maxUsers
    );
    if (!account) return null;

    account.currentUsers += 1;
    if (!account.usedBy) account.usedBy = [];
    account.usedBy.push({
      customerEmail,
      customerName: customerName || "Customer",
      assignedAt: new Date().toISOString(),
    });

    if (account.currentUsers >= account.maxUsers) {
      account.fullyUsed = true;
    }

    this.saveAccounts();
    return account;
  }

  addAccount(planId: string, data: Partial<AccountEntry>): AccountEntry {
    this.loadAccounts();
    if (!this.accounts[planId]) {
      this.accounts[planId] = [];
    }

    const newAccount: AccountEntry = {
      ...data,
      id: `${planId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      currentUsers: 0,
      maxUsers: data.maxUsers || 5,
      fullyUsed: false,
      disabled: false,
      usedBy: [],
      addedAt: new Date().toISOString(),
    };

    this.accounts[planId].push(newAccount);
    this.saveAccounts();
    return newAccount;
  }

  updateAccount(accountId: string, updates: Partial<AccountEntry>): AccountEntry | null {
    this.loadAccounts();
    for (const accounts of Object.values(this.accounts)) {
      const idx = accounts.findIndex((acc) => acc.id === accountId);
      if (idx !== -1) {
        accounts[idx] = { ...accounts[idx], ...updates };
        if (accounts[idx].currentUsers < accounts[idx].maxUsers) {
          accounts[idx].fullyUsed = false;
        }
        this.saveAccounts();
        return accounts[idx];
      }
    }
    return null;
  }

  toggleAccountDisabled(accountId: string): AccountEntry | null {
    this.loadAccounts();
    for (const accounts of Object.values(this.accounts)) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc) {
        acc.disabled = !acc.disabled;
        this.saveAccounts();
        return acc;
      }
    }
    return null;
  }

  removeAccount(accountId: string): { removed: boolean; planId?: string } {
    this.loadAccounts();
    for (const [planId, accounts] of Object.entries(this.accounts)) {
      const idx = accounts.findIndex((acc) => acc.id === accountId);
      if (idx !== -1) {
        accounts.splice(idx, 1);
        if (accounts.length === 0) delete this.accounts[planId];
        this.saveAccounts();
        return { removed: true, planId };
      }
    }
    return { removed: false };
  }

  findAccountByCustomer(planId: string, customerEmail: string): AccountEntry | null {
    this.loadAccounts();
    const accounts = this.accounts[planId] || [];
    for (const acc of accounts) {
      if (acc.usedBy?.some((u: any) => u.customerEmail === customerEmail)) {
        return acc;
      }
    }
    return null;
  }

  getStockInfo(planId: string): { total: number; used: number; available: number } {
    this.loadAccounts();
    const accounts = this.accounts[planId] || [];
    let total = 0, used = 0;
    accounts.forEach(acc => {
      total += acc.maxUsers || 5;
      used  += acc.currentUsers || 0;
    });
    return { total, used, available: total - used };
  }

  getAllAccounts(): AccountsData {
    this.loadAccounts();
    return this.accounts;
  }

  getStats(): {
    totalAccounts: number;
    totalSlots: number;
    usedSlots: number;
    availableSlots: number;
    byPlan: Record<string, { total: number; used: number; available: number }>;
  } {
    this.loadAccounts();
    let totalAccounts = 0;
    let totalSlots = 0;
    let usedSlots = 0;
    const byPlan: Record<string, { total: number; used: number; available: number }> = {};

    for (const [planId, accounts] of Object.entries(this.accounts)) {
      let planTotal = 0;
      let planUsed = 0;
      accounts.forEach((acc) => {
        planTotal += acc.maxUsers || 5;
        planUsed += acc.currentUsers || 0;
        totalAccounts++;
      });
      totalSlots += planTotal;
      usedSlots += planUsed;
      byPlan[planId] = { total: planTotal, used: planUsed, available: planTotal - planUsed };
    }

    return { totalAccounts, totalSlots, usedSlots, availableSlots: totalSlots - usedSlots, byPlan };
  }
}

export const accountManager = new AccountManager();
