import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Minorista } from './minorista';

describe('Minorista', () => {
  let component: Minorista;
  let fixture: ComponentFixture<Minorista>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Minorista],
    }).compileComponents();

    fixture = TestBed.createComponent(Minorista);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
