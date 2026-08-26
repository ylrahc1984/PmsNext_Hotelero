import { FormControl, FormGroup } from '@angular/forms';

import {
  buildContactCounts,
  buildGuestExportRows,
  buildGuestKpis,
  buildNationalityChart,
  classifyGuestContact,
  filterGuestRows,
  guestDateRangeValidator,
  guestIdentityKey,
  hasUsableDocument,
  toGuestApiDate
} from './analisis-huespedes.helpers';
import { GuestLocalFilters, ReporteHuespedMercadeo } from './analisis-huespedes.models';

describe('analisis-huespedes helpers', () => {
  const guest = (overrides: Partial<ReporteHuespedMercadeo> = {}): ReporteHuespedMercadeo => ({
    idRooming: 1,
    codReserva: 'RES-1',
    numHabitacion: '8',
    nombreCompleto: 'Émilie Favril',
    tipoDocumento: '03',
    numeroDocumento: '15-15 453',
    codNacionalidad: '019',
    nacionalidad: 'BÉLGICA',
    email: 'emilie@example.com',
    tipoEmail: 'CORREO DIRECTO',
    telefono: '+506 8888-0000',
    estadoContacto: 'CORREO Y TELEFONO',
    esContactable: true,
    tipoPax: 'PAX',
    fechaIngreso: '2026-08-01T00:00:00',
    fechaSalida: '2026-08-02T00:00:00',
    noches: 1,
    codAgencia: '03353',
    nomAgencia: 'BOOKING.COM',
    codTarifa: 'FITS',
    codPlan: 'DYN',
    estadoReserva: 'CHK',
    esReservaDirecta: 'N',
    operadorReserva: 'CHANNEL',
    registrosMismaEstancia: 1,
    fueConsolidado: false,
    ...overrides
  });

  const emptyFilters = (overrides: Partial<GuestLocalFilters> = {}): GuestLocalFilters => ({
    search: '',
    nacionalidad: '',
    agencia: '',
    estadoContacto: '',
    tipoEmail: '',
    origenReserva: '',
    estadoReserva: '',
    tipoPax: '',
    ...overrides
  });

  it('valida que fecha desde no sea posterior a fecha hasta', () => {
    const form = new FormGroup(
      { fechaDesde: new FormControl('2026-08-06'), fechaHasta: new FormControl('2026-08-05') },
      guestDateRangeValidator
    );
    expect(form.hasError('invalidDateRange')).toBeTrue();
    form.controls.fechaDesde.setValue('2026-08-01');
    expect(form.valid).toBeTrue();
  });

  it('formatea los parámetros de API como dd/MM/yyyy', () => {
    expect(toGuestApiDate('2026-08-05')).toBe('05/08/2026');
  });

  it('genera identidad con documento normalizado', () => {
    expect(guestIdentityKey(guest())).toBe('DOC:03:1515453');
  });

  it('usa nombre y nacionalidad como identidad cuando no hay documento usable', () => {
    const key = guestIdentityKey(guest({ numeroDocumento: 'SIN DOCUMENTO' }));
    expect(key).toBe('PERSONA:EMILIE FAVRIL:019');
  });

  it('reconoce documentos placeholder como no disponibles', () => {
    ['0', '0000000000', 'SIN DOCUMENTO', 'SINDOCUMENTO', 'N/A', 'NA'].forEach((value) =>
      expect(hasUsableDocument(value)).withContext(value).toBeFalse()
    );
  });

  it('cuenta huéspedes únicos sin eliminar sus estancias', () => {
    const rows = [
      guest(),
      guest({ idRooming: 2, codReserva: 'RES-2', numeroDocumento: '1515453' }),
      guest({ idRooming: 3, numeroDocumento: '99' })
    ];
    const kpis = buildGuestKpis(rows);
    expect(kpis.paxAlojados).toBe(3);
    expect(kpis.huespedesUnicos).toBe(2);
  });

  it('clasifica contacto directo, OTA, teléfono y ausencia de contacto de forma excluyente', () => {
    expect(classifyGuestContact(guest())).toBe('CORREO DIRECTO');
    expect(classifyGuestContact(guest({ tipoEmail: 'OTA BOOKING' }))).toBe('CORREO OTA');
    expect(classifyGuestContact(guest({ tipoEmail: 'OTA EXPEDIA' }))).toBe('CORREO OTA');
    expect(classifyGuestContact(guest({ tipoEmail: 'SIN CORREO', email: null, telefono: '2222' }))).toBe('SOLO TELÉFONO');
    expect(classifyGuestContact(guest({ tipoEmail: 'SIN CORREO', email: null, telefono: null }))).toBe('SIN CONTACTO');
    expect(Object.values(buildContactCounts([guest(), guest({ tipoEmail: 'OTA BOOKING' })])).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('agrupa las nacionalidades excedentes en Otros y conserva porcentajes', () => {
    const chart = buildNationalityChart(
      [
        guest({ nacionalidad: 'Costa Rica' }),
        guest({ idRooming: 2, nacionalidad: 'Costa Rica' }),
        guest({ idRooming: 3, nacionalidad: 'Bélgica' }),
        guest({ idRooming: 4, nacionalidad: 'Francia' }),
        guest({ idRooming: 5, nacionalidad: 'España' })
      ],
      2
    );
    expect(chart.map((item) => item.label)).toEqual(['Costa Rica', 'Bélgica', 'Otros']);
    expect(chart[2].count).toBe(2);
    expect(chart.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);
  });

  it('busca sin distinguir mayúsculas ni acentos', () => {
    expect(filterGuestRows([guest()], emptyFilters({ search: 'emilie' }))).toHaveSize(1);
    expect(filterGuestRows([guest()], emptyFilters({ search: 'belgica' }))).toHaveSize(1);
  });

  it('combina filtros locales de agencia, contacto y origen', () => {
    const rows = [guest(), guest({ idRooming: 2, nomAgencia: 'DIRECTO', esReservaDirecta: 'S', tipoEmail: 'SIN CORREO' })];
    const result = filterGuestRows(rows, emptyFilters({ agencia: 'BOOKING.COM', tipoEmail: 'CORREO DIRECTO', origenReserva: 'AGENCIA' }));
    expect(result).toEqual([rows[0]]);
  });

  it('exporta la colección recibida y conserva documento y teléfono como texto', () => {
    const filtered = filterGuestRows(
      [guest(), guest({ idRooming: 2, nacionalidad: 'FRANCIA' })],
      emptyFilters({ nacionalidad: 'BÉLGICA' })
    );
    const exported = buildGuestExportRows(filtered);
    expect(exported).toHaveSize(1);
    expect(exported[0]['Número de documento']).toBe('15-15 453');
    expect(exported[0]['Teléfono']).toBe('+506 8888-0000');
  });
});
