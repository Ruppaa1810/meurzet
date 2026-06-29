import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isPasswordRecovery = false;

  constructor() {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.isPasswordRecovery = true;
      }
    });
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
        redirectTo: `${window.location.origin}/sistema/`,
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
