import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class StorageService {
  async subirComprobante(filePath: string, file: File) {
    return await supabase.storage
      .from('comprobantes')
      .upload(filePath, file);
  }

  async getComprobanteUrl(filePath: string) {
    return await supabase.storage
      .from('comprobantes')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);
  }
}
