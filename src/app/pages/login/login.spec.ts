import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Login } from './login';
import { SupabaseService } from '../../services/supabase.service';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: {
            supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
            login: () => Promise.resolve({ data: { user: null }, error: null }),
            getPerfil: () => Promise.resolve({ data: null, error: null })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
