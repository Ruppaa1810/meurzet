import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Validaciones } from './validaciones';

describe('Validaciones', () => {
  let component: Validaciones;
  let fixture: ComponentFixture<Validaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Validaciones],
    }).compileComponents();

    fixture = TestBed.createComponent(Validaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
