import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DepartamentoService } from '../departamento/departamento.service';
import { UsuarioService } from '../usuarios/usuario.service';
import { UsuarioDetalleComponent } from './usuario-detalle';

describe('UsuarioDetalle', () => {
  let component: UsuarioDetalleComponent;
  let fixture: ComponentFixture<UsuarioDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuarioDetalleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: DepartamentoService, useValue: { getAll: () => of([]) } },
        { provide: UsuarioService, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsuarioDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
