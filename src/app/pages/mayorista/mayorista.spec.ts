import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mayorista } from './mayorista';

describe('Mayorista', () => {
  let component: Mayorista;
  let fixture: ComponentFixture<Mayorista>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mayorista],
    }).compileComponents();

    fixture = TestBed.createComponent(Mayorista);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
