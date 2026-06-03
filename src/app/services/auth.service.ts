import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isPasswordRecovery = false;

  constructor() {
    this.isPasswordRecovery = localStorage.getItem('meurzet_recovery') === 'true';
    if (this.isPasswordRecovery) {
      localStorage.removeItem('meurzet_recovery');
    }
  }

  async login(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return await supabase.auth.signOut();
  }

  async resetPassword(email: string) {
    const res = await Promise.race([
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?recovery=true`,
      }),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      ),
    ]);
    return res;
  }

  async getSession() {
    return await supabase.auth.getSession();
  }

  async updatePassword(password: string) {
    return await supabase.auth.updateUser({ password });
  }
}
