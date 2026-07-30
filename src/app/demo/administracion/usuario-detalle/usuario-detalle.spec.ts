import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsuarioDetalleComponent } from './usuario-detalle';

describe('UsuarioDetalle', () => {
  let component: UsuarioDetalleComponent;
  let fixture: ComponentFixture<UsuarioDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuarioDetalleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsuarioDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
