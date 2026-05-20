import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  supabase: SupabaseClient;

  constructor() {

    this.supabase = createClient(
      'https://yenkuvvumgmuyvjludeg.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inllbmt1dnZ1bWdtdXl2amx1ZGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDc1ODMsImV4cCI6MjA5NDY4MzU4M30.WOnAysNAhia3JubCLut7UkoGhBFWZHjyAS15SHiruT8'
    );

  }

  async login(email: string, password: string) {

    return await this.supabase.auth.signInWithPassword({
      email,
      password
    });

  }

  async getRole(userId: string) {

    return await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId);

  }

}