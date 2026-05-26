import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmacionPago } from './confirmacion-pago';

describe('ConfirmacionPago', () => {
  let component: ConfirmacionPago;
  let fixture: ComponentFixture<ConfirmacionPago>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmacionPago],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacionPago);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
