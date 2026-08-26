import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { environment } from 'src/environments/environment';
import { ReservaTagAsignado, ReservaTagCatalogo, ReservaTagSeleccionado } from '../../models/reserva-tag.model';
import { ReservationTagSelectorComponent } from './reservation-tag-selector.component';

describe('ReservationTagSelectorComponent', () => {
  let fixture: ComponentFixture<ReservationTagSelectorComponent>;
  let component: ReservationTagSelectorComponent;
  let httpMock: HttpTestingController;
  const catalogUrl = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/reservas/tags`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationTagSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(ReservationTagSelectorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne((request) => request.url === catalogUrl && request.params.get('soloManuales') === 'true')
      .flush(successfulCatalog([]));
  });

  afterEach(() => httpMock.verify());

  it('debounces searches and sends only the latest term', fakeAsync(() => {
    component.searchControl.setValue('ha');
    tick(150);
    component.searchControl.setValue('habi');
    tick(299);
    httpMock.expectNone((request) => request.url === catalogUrl);
    tick(1);

    const request = httpMock.expectOne((candidate) => candidate.url === catalogUrl);
    expect(request.request.params.get('busqueda')).toBe('habi');
    expect(request.request.params.get('soloManuales')).toBe('true');
    request.flush(successfulCatalog([]));
  }));

  it('replaces a conflicting local selection and removes its observation', () => {
    const requested = makeCatalogTag(1, 'Solicitado', { grupoExclusion: 'LATE_OUT' });
    const approved = makeCatalogTag(2, 'Autorizado', { grupoExclusion: 'LATE_OUT' });
    component.toggleTag(requested);
    component.updateObservation(requested.idTag, 'Nota temporal');
    component.toggleTag(approved);

    expect(component.selectedTags().length).toBe(1);
    expect(component.selectedTags()[0].tag.idTag).toBe(approved.idTag);
    expect(component.selectedTags()[0].observacion).toBeNull();
    expect(component.selectionMessage()).toContain('fue reemplazada');
  });

  it('blocks conflicts with persisted automatic tags', () => {
    fixture.componentRef.setInput('assignedTags', [
      makeAssignedTag(1, 'Solicitado automático', { grupoExclusion: 'LATE_OUT', tipoAsignacion: 'AUTOMATICO' })
    ]);
    const approved = makeCatalogTag(2, 'Autorizado', { grupoExclusion: 'LATE_OUT' });
    component.toggleTag(approved);

    expect(component.selectedTags()).toEqual([]);
    expect(component.resultDisabledReason(approved)).toContain('administrada automáticamente');
  });

  it('emits several selected tags once with trimmed optional observations', () => {
    const first = makeCatalogTag(1, 'VIP');
    const second = makeCatalogTag(2, 'Llegada tardía');
    const emitted: ReservaTagSeleccionado[][] = [];
    component.save.subscribe((selections) => emitted.push(selections));
    component.toggleTag(first);
    component.toggleTag(second);
    component.updateObservation(first.idTag, '  Coordinar amenidad  ');
    component.confirmSelection();

    expect(emitted.length).toBe(1);
    expect(emitted[0].map((selection) => selection.tag.idTag)).toEqual([1, 2]);
    expect(emitted[0][0].observacion).toBe('Coordinar amenidad');
    expect(emitted[0][1].observacion).toBeNull();
  });
});

function successfulCatalog(tags: ReservaTagCatalogo[]) {
  return { datos: tags, respuesta: 'OK|BÚSQUEDA REALIZADA', exito: true, codigoHttp: 200 };
}

function makeCatalogTag(idTag: number, nombre: string, overrides: Partial<ReservaTagCatalogo> = {}): ReservaTagCatalogo {
  return {
    idCategoria: 1, categoria: 'Operación', descripcionCategoria: null, ordenCategoria: 10, idTag, nombre,
    descripcion: 'Descripción', color: '#DBEAFE', icono: 'tag', prioridad: 1, esAlerta: false,
    permiteAsignacionManual: true, grupoExclusion: null, activo: true, ...overrides
  };
}

function makeAssignedTag(idTag: number, nombre: string, overrides: Partial<ReservaTagAsignado> = {}): ReservaTagAsignado {
  return {
    idAsignacion: idTag, codReserva: 'RSV-1', idCategoria: 1, categoria: 'Operación', ordenCategoria: 10,
    idTag, nombre, descripcion: 'Descripción', color: '#DBEAFE', icono: 'tag', prioridad: 1, esAlerta: false,
    permiteAsignacionManual: true, grupoExclusion: null, tipoAsignacion: 'MANUAL', origen: 'RESERVA', observacion: null,
    fechaAsignacion: '2026-08-24T11:11:13', operadorAsignacion: 'CHARLY', ...overrides
  };
}
