import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Seleccion } from './seleccion';

describe('Seleccion', () => {
  let component: Seleccion;
  let fixture: ComponentFixture<Seleccion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Seleccion],
    }).compileComponents();

    fixture = TestBed.createComponent(Seleccion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
