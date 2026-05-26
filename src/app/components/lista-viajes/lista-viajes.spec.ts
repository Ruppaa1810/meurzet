import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaViajes } from './lista-viajes';

describe('ListaViajes', () => {
  let component: ListaViajes;
  let fixture: ComponentFixture<ListaViajes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaViajes],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaViajes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
