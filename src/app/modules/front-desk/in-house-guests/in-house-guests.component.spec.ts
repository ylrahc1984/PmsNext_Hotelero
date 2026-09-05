import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from 'src/environments/environment';
import { InHouseGuestsComponent } from './in-house-guests.component';

describe('InHouseGuestsComponent', () => {
  let component: InHouseGuestsComponent;
  let fixture: ComponentFixture<InHouseGuestsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InHouseGuestsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(InHouseGuestsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const request = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/pax-in-house/lista-completa`);
    request.flush({
      pax: [],
      totalHabitaciones: 0,
      totalAdultos: 0,
      totalNinos: 0,
      totalHuespedes: 0,
      respuesta: ''
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('consulta y visualiza el pasaporte del huésped seleccionado en modo solo lectura', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:passport');
    spyOn(URL, 'revokeObjectURL');

    component.response = {
      pax: [{
        numHabita: '101',
        paxIn: 'ANA SOLANO',
        fechaIng: '01/09/2026',
        fechaSal: '05/09/2026',
        noches: 4,
        desayuno: 'SI',
        media: 'NO',
        fullPen: 'NO',
        numPax: 1,
        numChild: 0,
        varios: '',
        codReserva: 'RSV-1',
        nomAgencia: 'Directos'
      }],
      totalHabitaciones: 1,
      totalAdultos: 1,
      totalNinos: 0,
      totalHuespedes: 1,
      respuesta: ''
    };
    component.guests = component.response.pax;
    component.seleccionarGuest(component.guests[0]);

    const roomingRequest = httpMock.expectOne((req) =>
      req.url === `${environment.apiUrl}/rooming-list` &&
      req.params.get('codRsv') === 'RSV-1' &&
      req.params.get('numHabita') === '101'
    );
    roomingRequest.flush({
      success: true,
      data: [{
        numInterno: '0000000361',
        codReserva: 'RSV-1',
        numHabita: '101',
        nacionalidad: 'CR',
        tipDocu: 'PAS',
        numDocu: 'P123',
        nombre: 'Ana',
        apellidos: 'Solano',
        fecNaci: '',
        sexo: '',
        estCivil: '',
        tipoPax: 'PAX',
        direccion: '',
        email: 'ana@example.com',
        motivo: '',
        procede: '',
        mdoArribo: '',
        orden: 1,
        operador: 'tester'
      }]
    });

    const metadataRequest = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/frontdesk/documento-huesped/rooming/0000000361`);
    metadataRequest.flush({
      idDocumento: 27,
      idRooming: '0000000361',
      codReserva: 'RSV-1',
      tipoDocumento: 'PAS',
      ladoDocumento: 'FRONT',
      nombreArchivo: 'passport.jpg',
      formato: 'jpg',
      mimeType: 'image/jpeg',
      tamanoBytes: 1024,
      activo: true,
      fechaCreacion: '2026-09-05T10:00:00',
      operadorCreacion: 'tester'
    });
    fixture.detectChanges();

    const viewButton = fixture.nativeElement.querySelector('.passport-view-button') as HTMLButtonElement;
    expect(viewButton.disabled).toBeFalse();
    viewButton.click();

    const contentRequest = httpMock.expectOne((req) => req.url === `${environment.apiUrl}/frontdesk/documento-huesped/27/contenido`);
    expect(contentRequest.request.responseType).toBe('blob');
    contentRequest.flush(new Blob(['image'], { type: 'image/jpeg' }));
    fixture.detectChanges();

    expect(component.passportViewerUrl).toBe('blob:passport');
    expect(fixture.nativeElement.querySelector('.passport-viewer img')).toBeTruthy();
  });
});
