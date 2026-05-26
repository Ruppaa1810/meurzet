import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Seleccion } from './seleccion';
import { SupabaseService } from '../../../services/supabase.service';

describe('Seleccion', () => {
  let component: Seleccion;
  let fixture: ComponentFixture<Seleccion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Seleccion],
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: {
            getViajePorId: () => Promise.resolve({ data: null, error: null }),
            getAsientosPorViaje: () => Promise.resolve({ data: [], error: null })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Seleccion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
