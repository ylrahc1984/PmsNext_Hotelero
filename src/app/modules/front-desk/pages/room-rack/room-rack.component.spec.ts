import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { CheckInArrival } from '../../check-in-arrivals/models/check-in-arrival.model';
import { CheckInArrivalsService } from '../../check-in-arrivals/services/check-in-arrivals.service';
import { RoomGroupsService } from '../../settings/room-groups/services/room-groups.service';
import { RoomRackRoom } from './models/room-rack-room.model';
import { RoomRackComponent } from './room-rack.component';
import { RoomRackService } from './services/room-rack.service';

describe('RoomRackComponent: filtros locales', () => {
  let fixture: ComponentFixture<RoomRackComponent>;
  let component: RoomRackComponent;
  let rack: jasmine.SpyObj<RoomRackService>;
  let groups: jasmine.SpyObj<RoomGroupsService>;
  let arrivals: jasmine.SpyObj<CheckInArrivalsService>;
  let rooms: RoomRackRoom[];
  const distribution: [string, number][] = [['STD', 12], ['123', 10], ['400', 8], ['500', 7], ['700', 4], ['900', 2], ['', 7]];

  // Synthetic fixture with the requested distribution; not a claim about the live inventory.
  function inventory(): RoomRackRoom[] {
    let number = 0;
    return distribution.flatMap(([group, count]) => Array.from({ length: count }, () => ({
      CR05_NumHab: ++number, CR05_CodGrp: group, CR05_CateHab: number % 2 ? 'STD' : 'SUP',
      CR05_TipoHab: number % 2 ? 'DBL' : 'SGL', CR05_TotCamas: 1, CR05_NumPax: 2,
      CR05_EstHab: 'D', RSV: '', CR05_Clean: number % 5 ? 'L' : 'S', CR05_Anexo: '',
      CR05_Activo: 'S', CR05_Operador: '', CR05_Descripcion: 'Habitación de prueba'
    }))).reverse();
  }

  beforeEach(async () => {
    spyOnProperty(history, 'state', 'get').and.returnValue({});
    rooms = inventory();
    rack = jasmine.createSpyObj<RoomRackService>('rack', ['getAllRoomsStatus', 'updateRoomCleanStatus']);
    groups = jasmine.createSpyObj<RoomGroupsService>('groups', ['getRoomGroups']);
    arrivals = jasmine.createSpyObj<CheckInArrivalsService>('arrivals', ['getPendientes']);
    rack.getAllRoomsStatus.and.callFake(() => of(rooms.map((room) => ({ ...room }))));
    rack.updateRoomCleanStatus.and.returnValue(of({}));
    groups.getRoomGroups.and.returnValue(of(distribution.filter(([code]) => !!code).map(([code]) => ({
      CR04_CodGrp: code, CR04_Descripcion: 'Grupo ' + code, CR04_Operador: ''
    }))));
    arrivals.getPendientes.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [RoomRackComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: RoomRackService, useValue: rack },
        { provide: RoomGroupsService, useValue: groups },
        { provide: CheckInArrivalsService, useValue: arrivals },
        { provide: OperationalDateService, useValue: {
          operationalDate: signal('22/09/2026'), ensureLoaded: () => of('22/09/2026'), refresh: () => of('22/09/2026')
        } },
        { provide: TipoCambioService, useValue: { fetchTipoCambio: () => of([]) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(RoomRackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    fixture.destroy();
  });

  it('muestra 50 habitaciones y ordena numéricamente sin mutar la fuente', () => {
    expect(component.habitacionesVisibles.length).toBe(50);
    expect(component.habitacionesVisibles.slice(0, 12).map((room) => room.numero))
      .toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    expect(component.habitaciones[0].numero).toBe('50');
    expect(component.kpisLimpieza.map((kpi) => kpi.cantidad)).toEqual([50, 40, 10]);
  });

  for (const [code, count] of distribution.filter(([code]) => !!code)) {
    it('filtra el grupo ' + code + ' con ' + count + ' habitaciones', () => {
      component.grupoSeleccionado = code;
      component.aplicarFiltros();
      expect(component.habitacionesVisibles.length).toBe(count);
      expect(component.habitacionesVisibles.every((room) => room.data.CR05_CodGrp === code)).toBeTrue();
      expect(groups.getRoomGroups).toHaveBeenCalledTimes(1);
      expect(rack.getAllRoomsStatus).toHaveBeenCalledTimes(1);
    });
  }

  it('busca desde el input, combina filtros y limpia sin consultas', async () => {
    const search: HTMLInputElement = fixture.nativeElement.querySelector('#rack-search');
    search.value = ' 37 ';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await Promise.resolve();
    expect(component.habitacionesVisibles.map((room) => room.numero)).toEqual(['37']);
    component.grupoSeleccionado = '500';
    component.estadoOperacionalSeleccionado = 'Disponible';
    component.estadoLimpiezaSeleccionado = 'Sucia';
    component.busqueda = '';
    component.categoriaSeleccionada = 'STD';
    component.tipoSeleccionado = 'DBL';
    component.aplicarFiltros();
    expect(component.habitacionesVisibles.map((room) => room.numero)).toEqual(['35']);
    expect(component.kpis[0].cantidad).toBe(50);
    search.value = 'inexistente';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rack-empty').textContent).toContain('No hay habitaciones que coincidan');
    const reset: HTMLButtonElement = fixture.nativeElement.querySelector('.rack-empty button');
    reset.click();
    fixture.detectChanges();
    expect(component.habitacionesVisibles.length).toBe(50);
    expect(component.hayFiltrosActivos).toBeFalse();
    expect(rack.getAllRoomsStatus).toHaveBeenCalledTimes(1);
  });

  it('cambia de densidad desde los botones sin perder filtros ni consultar servicios', () => {
    component.grupoSeleccionado = '500';
    component.aplicarFiltros();
    const visible = component.habitacionesVisibles;
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.rack-density button');
    buttons[1].click();
    fixture.detectChanges();
    expect(component.densidad).toBe('compact');
    expect(fixture.nativeElement.querySelector('.rooms-grid--compact')).toBeTruthy();
    buttons[0].click();
    fixture.detectChanges();
    expect(component.densidad).toBe('comfortable');
    expect(component.habitacionesVisibles).toBe(visible);
    expect(component.grupoSeleccionado).toBe('500');
    expect(rack.getAllRoomsStatus).toHaveBeenCalledTimes(1);
    expect(groups.getRoomGroups).toHaveBeenCalledTimes(1);
  });

  it('reaplica filtros tras refresh y actualización de limpieza concurrente', () => {
    component.grupoSeleccionado = '500';
    component.estadoLimpiezaSeleccionado = 'Sucia';
    component.aplicarFiltros();
    const previousRoom = component.habitacionesVisibles[0];
    const pending = new Subject<unknown>();
    rack.updateRoomCleanStatus.and.returnValue(pending);
    component.onLimpiarHabitacion(previousRoom);
    component.actualizarVentana(true);
    expect(component.habitacionesVisibles[0]).not.toBe(previousRoom);
    pending.next({});
    pending.complete();
    expect(component.habitacionesVisibles.length).toBe(0);
    expect(component.kpisLimpieza.map((kpi) => kpi.cantidad)).toEqual([50, 41, 9]);
    expect(groups.getRoomGroups).toHaveBeenCalledTimes(1);
  });

  it('conserva las reglas de estados, limpieza desconocida y salida más entrada', () => {
    const codes = ['D', 'R', 'O', 'H', 'M', 'B', '?'];
    rooms = rooms.slice(0, 7).map((room, index) => ({ ...room, CR05_EstHab: codes[index], CR05_Clean: index ? 'L' : '?' }));
    const arrival: CheckInArrival = {
      numHabita: String(rooms[3].CR05_NumHab), procesado: 0, catHabita: '', tipHabita: '', codReserva: '',
      codTarifa: '', codPlan: '', descripcion: '', fechaIng: '', fechaSal: '', numPax: 1, numChild: 0,
      cpl: 0, totNoches: 1, totDias: 1, folio: '', estado: '', codAgencia: '', nomAgencia: '', observacion: ''
    };
    arrivals.getPendientes.and.returnValue(of([arrival]));
    component.actualizarVentana(true);
    expect(component.kpis.map((kpi) => kpi.cantidad)).toEqual([7, 1, 2, 1, 1, 1, 1, 1]);
    expect(component.kpisLimpieza.map((kpi) => kpi.cantidad)).toEqual([7, 6, 0]);
    component.estadoOperacionalSeleccionado = 'Entrada hoy';
    component.aplicarFiltros();
    expect(component.habitacionesVisibles.length).toBe(2);
    expect(component.habitacionesVisibles.some((room) => room.cardClass === 'state-turnover-today')).toBeTrue();
    component.estadoOperacionalSeleccionado = 'Salida Hoy';
    component.aplicarFiltros();
    expect(component.habitacionesVisibles.length).toBe(1);
  });

  it('genera opciones únicas sin blancos y mantiene un orden estable para números y texto', () => {
    rooms[0].CR05_CateHab = '  ';
    rooms[1].CR05_CateHab = ' STD ';
    rooms[0].CR05_TipoHab = '';
    component.actualizarVentana(true);
    expect(component.categorias).toEqual(['STD', 'SUP']);
    expect(component.tipos).toEqual(['DBL', 'SGL']);
    const base = component.habitaciones[0];
    component.habitaciones = ['A10', '2', 'A2', '10', '02', ''].map((numero) => ({ ...base, numero }));
    component.aplicarFiltros();
    expect(component.habitacionesVisibles.map((room) => room.numero)).toEqual(['2', '02', '10', '', 'A2', 'A10']);
  });

  it('mantiene independientes ambos grupos de chips dentro de la misma franja', () => {
    component.grupoSeleccionado = '500';
    component.aplicarFiltros();
    const operational: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.rack-status-row [aria-labelledby="rack-operational-label"] button');
    const cleaning: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.rack-status-row [aria-labelledby="rack-clean-label"] button');
    operational[1].click();
    cleaning[2].click();
    fixture.detectChanges();
    expect(component.estadoOperacionalSeleccionado).toBe('Disponible');
    expect(component.estadoLimpiezaSeleccionado).toBe('Sucia');
    expect(component.habitacionesVisibles.map((room) => room.numero)).toEqual(['35']);
    expect(fixture.nativeElement.querySelector('.rack-results').textContent).toContain('Mostrando 1 de 50 habitaciones');
    operational[0].click();
    fixture.detectChanges();
    expect(component.estadoOperacionalSeleccionado).toBe('Todas');
    expect(component.estadoLimpiezaSeleccionado).toBe('Sucia');
    expect(cleaning[2].getAttribute('aria-pressed')).toBe('true');
    cleaning[0].click();
    fixture.detectChanges();
    expect(component.habitacionesVisibles.length).toBe(7);
    expect(rack.getAllRoomsStatus).toHaveBeenCalledTimes(1);
  });

  it('adapta los controles al viewport y compacta la altura sin reducir los botones', () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position: fixed; left: 0; top: 0; height: 1000px; border: 0';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument;
      const view = frame.contentWindow;
      if (!doc || !view) throw new Error('No se pudo crear el viewport de prueba');
      document.querySelectorAll('style').forEach((style) => doc.head.appendChild(style.cloneNode(true)));
      doc.body.style.margin = '0';
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      const toolbar = doc.querySelector<HTMLElement>('.rack-toolbar');
      const grid = doc.querySelector<HTMLElement>('.rooms-grid');
      const card = doc.querySelector<HTMLElement>('.room-card');
      const action = doc.querySelector<HTMLElement>('.quick-action');
      const operational = doc.querySelector<HTMLElement>('[aria-labelledby="rack-operational-label"]');
      const cleaning = doc.querySelector<HTMLElement>('[aria-labelledby="rack-clean-label"]');
      const results = doc.querySelector<HTMLElement>('.rack-results > span');
      const order = doc.querySelector<HTMLElement>('.rack-order');
      if (!toolbar || !grid || !card || !action || !operational || !cleaning || !results || !order) throw new Error('No se renderizó el rack');
      for (const width of [375, 768, 1024, 1280, 1366, 1440, 1600, 1920]) {
        frame.style.width = width + 'px';
        grid.classList.remove('rooms-grid--compact');
        const comfortableHeight = card.getBoundingClientRect().height;
        const actionHeight = action.getBoundingClientRect().height;
        const columns = view.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const operationalRect = operational.getBoundingClientRect();
        const cleaningRect = cleaning.getBoundingClientRect();
        if (width >= 1600) {
          expect(cleaningRect.top).withContext('Estados en una fila a ' + width).toBe(operationalRect.top);
          expect(cleaningRect.left).toBeGreaterThan(operationalRect.right);
        } else if (width <= 768) {
          expect(cleaningRect.top).withContext('Estados apilados a ' + width).toBeGreaterThanOrEqual(operationalRect.bottom);
        }
        expect(doc.documentElement.scrollWidth).withContext('Página sin overflow a ' + width).toBeLessThanOrEqual(width);
        if (width >= 768) {
          expect(results.getBoundingClientRect().bottom).toBeGreaterThan(order.getBoundingClientRect().top);
          expect(results.getBoundingClientRect().top).toBeLessThan(order.getBoundingClientRect().bottom);
        }
        expect(toolbar.scrollWidth).withContext('Controles a ' + width + 'px').toBeLessThanOrEqual(toolbar.clientWidth + 1);
        grid.classList.add('rooms-grid--compact');
        expect(card.getBoundingClientRect().height).withContext('Altura a ' + width + 'px').toBeLessThan(comfortableHeight);
        expect(action.getBoundingClientRect().height).toBe(actionHeight);
        expect(view.getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(columns);
      }
    } finally {
      frame.remove();
    }
  });
});
