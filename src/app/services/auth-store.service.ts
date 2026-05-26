import { Injectable } from '@angular/core';
import type { UserRole } from '../models/database.types';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  rol: UserRole | null = null;
}
