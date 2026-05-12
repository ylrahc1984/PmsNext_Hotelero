import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { NotasCreditoService } from '../services/notas-credito.service';
import { NotaCreditoDetalleComponent } from './nota-credito-detalle.component';

describe('NotaCreditoDetalleComponent', () => {
  let component: NotaCreditoDetalleComponent;
  let fixture: ComponentFixture<NotaCreditoDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotaCreditoDetalleComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({}))
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate')
          }
        },
        {
          provide: NotasCreditoService,
          useValue: {
            getDetalleNotaCredito: jasmine.createSpy('getDetalleNotaCredito').and.returnValue(of({}))
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotaCreditoDetalleComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
