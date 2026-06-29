import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { supabase } from './supabase-client';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('login calls supabase.auth.signInWithPassword', async () => {
    const spy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: '123' } }, error: null,
    } as any);
    const res = await service.login('test@test.com', 'pass123');
    expect(spy).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass123' });
    expect(res.data?.user?.id).toBe('123');
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const spy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as any);
    await service.signOut();
    expect(spy).toHaveBeenCalled();
  });

  it('getSession returns session from supabase', async () => {
    const spy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: '123' } } }, error: null,
    } as any);
    const res = await service.getSession();
    expect(spy).toHaveBeenCalled();
    expect(res.data?.session?.user?.id).toBe('123');
  });
});
