import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CargoIncluido, CargoIncluidoConsultaService } from './cargo-incluido-consulta.service';

describe('CargoIncluidoConsultaService', () => {
  let service: CargoIncluidoConsultaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CargoIncluidoConsultaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta por fechas con los parámetros requeridos', () => {
    service.consultarPorFechas('01/08/2026', '20/08/2026').subscribe((items) => {
      expect(items.length).toBe(1);
      expect(items[0].PFD03_NumCrgInc).toBe('001-000002');
    });

    const request = http.expectOne((item) => item.url.endsWith('/cargo-incluido/por-fecha'));
    expect(request.request.params.get('fechaInicio')).toBe('01/08/2026');
    expect(request.request.params.get('fechaFin')).toBe('20/08/2026');
    request.flush([{
      pfD03_TipCrgInc: 'CIN',
      pfD03_NumCrgInc: '001-000002',
      pfD03_NombrePax: 'CARLOTA AREVALO',
      pfD03_MtoTot: 9840
    }]);
  });

  it('normaliza el encabezado y detalle devueltos en camel case', () => {
    service.consultarDetalle('CIN', '001-000002').subscribe((response) => {
      expect(response.encabezado?.PFD03_NombrePax).toBe('CARLOTA AREVALO');
      expect(response.detalle[0].PFD04_NomConsumo).toBe("DON'T FIND ME NEMO");
      expect(response.detalle[0].PFD04_Cantidad).toBe(1);
    });

    const request = http.expectOne((item) => item.url.endsWith('/cargo-incluido/CIN/001-000002'));
    request.flush({
      encabezado: { pfD03_TipCrgInc: 'CIN', pfD03_NumCrgInc: '001-000002', pfD03_NombrePax: 'CARLOTA AREVALO' },
      detalle: [{ pfD04_CodConsumo: 'CRC-0012', pfD04_NomConsumo: "DON'T FIND ME NEMO", pfD04_Cantidad: 1 }]
    });
  });

  it('anula mediante DELETE con tipo, número, motivo y operador', () => {
    service.anular(makeCargo(), 'Cargo duplicado', 'CHARLY').subscribe();

    const request = http.expectOne((item) => item.url.endsWith('/cargo-incluido/CIN/001-000002'));
    expect(request.request.method).toBe('DELETE');
    expect(request.request.params.get('motivo')).toBe('Cargo duplicado');
    expect(request.request.params.get('operador')).toBe('CHARLY');
    request.flush('OK');
  });
});

function makeCargo(): CargoIncluido {
  return {
    PFD03_TipCrgInc: 'CIN',
    PFD03_NumCrgInc: '001-000002',
    PFD03_CodReserva: 'NA260000235',
    PFD03_NumHab: '10',
    PFD03_PntVenta: 'PP',
    PFD03_Fecha: '2026-08-03T00:00:00',
    PFD03_Hora: '08:37',
    PFD03_NumDocu: 'NA260000235',
    PFD03_NombrePax: 'CARLOTA AREVALO',
    PFD03_MtoTot: 9840,
    PFD03_Moneda: 'COL',
    PFD03_Cierre: 0,
    PFD03_NumCierre: 0,
    PFD03_Operador: 'charly'
  };
}
