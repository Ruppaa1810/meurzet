import { Injectable } from '@angular/core';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class StorageService {
  async subirComprobante(filePath: string, file: File) {
    const archivo = await achicarFoto(file);
    return await supabase.storage
      .from('comprobantes')
      .upload(filePath, archivo, { contentType: archivo.type });
  }

  async getComprobanteUrl(filePath: string) {
    return await supabase.storage
      .from('comprobantes')
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);
  }
}

/** Las fotos del celular pesan varios MB y tardan en subir: se achican a 1600px antes de mandarlas. */
async function achicarFoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 500_000) return file;
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
