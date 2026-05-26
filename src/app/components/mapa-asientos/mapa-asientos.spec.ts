import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapaAsientos } from './mapa-asientos';

describe('MapaAsientos', () => {
  let component: MapaAsientos;
  let fixture: ComponentFixture<MapaAsientos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapaAsientos],
    }).compileComponents();

    fixture = TestBed.createComponent(MapaAsientos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
