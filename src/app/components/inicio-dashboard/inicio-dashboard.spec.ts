import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InicioDashboard } from './inicio-dashboard';

describe('InicioDashboard', () => {
  let component: InicioDashboard;
  let fixture: ComponentFixture<InicioDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
