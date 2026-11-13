import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';

import { RoomCategory } from '../../settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from '../../settings/room-categories/services/room-categories.service';
import {
  OccupancyForecastRequest,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from '../occupancy-forecast/occupancy-forecast.service';
import { QuickOccupancyComponent } from './quick-occupancy.component';

@Component({
  standalone: true,
  imports: [QuickOccupancyComponent],
  template: `
    <button type="button" class="open-button" (click)="open = true">Abrir disponibilidad</button>
    <app-quick-occupancy [(open)]="open" [canOpenQuickOccupancy]="true" />
  `
})
class QuickOccupancyHostComponent {
  open = false;
}

describe('QuickOccupancyComponent', () => {
  let categoriesService: jasmine.SpyObj<RoomCategoriesService>;
  let forecastService: jasmine.SpyObj<OccupancyForecastService>;

  const categories: RoomCategory[] = [
    { CR01_CodCate: 'STD', CR01_Categoria: 'Standard', CR01_NumHabita: 4, CR01_Orden: 1, CR01_Operador: '', CR01_ESTADO: 1 },
    { CR01_CodCate: 'DLX', CR01_Categoria: 'Deluxe', CR01_NumHabita: 3, CR01_Orden: 2, CR01_Operador: 'maria', CR01_ESTADO: 1 }
  ];

  beforeEach(async () => {
    categoriesService = jasmine.createSpyObj<RoomCategoriesService>('RoomCategoriesService', ['getRoomCategories']);
    forecastService = jasmine.createSpyObj<OccupancyForecastService>('OccupancyForecastService', ['getForecast']);
    categoriesService.getRoomCategories.and.returnValue(of(categories));
    forecastService.getForecast.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [QuickOccupancyHostComponent],
      providers: [
        provideRouter([]),
        { provide: RoomCategoriesService, useValue: categoriesService },
        { provide: OccupancyForecastService, useValue: forecastService }
      ]
    }).compileComponents();
  });

  function createAndOpen(): ComponentFixture<QuickOccupancyHostComponent> {
    const fixture = TestBed.createComponent(QuickOccupancyHostComponent);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.open-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    return fixture;
  }

  function componentOf(fixture: ComponentFixture<QuickOccupancyHostComponent>): QuickOccupancyComponent {
    return fixture.debugElement.children.find((child) => child.componentInstance instanceof QuickOccupancyComponent)!.componentInstance;
  }

  function setDates(component: QuickOccupancyComponent, start = '20/11/2026', end = '20/11/2026'): void {
    component.filters.setValue({ fechaInicial: start, fechaFinal: end });
  }

  function forecastRow(fecha = '20/11/2026', occupied = 5): OccupancyForecastResponseRow {
    return {
      fecha,
      totHabi: 10,
      blk: 2,
      totOcupa: occupied,
      totPax: 7,
      totChl: 1,
      porOcu: 62.5,
      categorias: {
        STD: { codigo: 'STD', cantidad: 2, total: 4 },
        DLX: { codigo: 'DLX', cantidad: 3, total: 3 }
      }
    };
  }

  it('opens with empty dates, occupancy view, selected categories, and no forecast request', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);

    expect(component.filters.value).toEqual({ fechaInicial: null, fechaFinal: null });
    expect(component.tipoVista).toBe('ocupacion');
    expect(component.allCategoriesSelected).toBeTrue();
    expect(component.rows).toEqual([]);
    expect(forecastService.getForecast).not.toHaveBeenCalled();
    expect(categoriesService.getRoomCategories).toHaveBeenCalledTimes(1);
  });

  it('focuses the initial date when opened from the trigger', fakeAsync(() => {
    const fixture = createAndOpen();
    tick(0);
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input[type="text"]'));
  }));

  it('requires both dates before processing', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    component.procesar();
    fixture.detectChanges();
    expect(component.submitted).toBeTrue();
    expect(component.filters.invalid).toBeTrue();
    expect(forecastService.getForecast).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('La fecha inicial es obligatoria.');
    expect(fixture.nativeElement.textContent).toContain('La fecha final es obligatoria.');
  });

  it('allows a one-day range with equal start and end dates', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component);
    component.procesar();
    expect(component.dateRangeError).toBe('');
    expect(forecastService.getForecast).toHaveBeenCalledTimes(1);
  });

  it('fills the final date with three calendar days when focus moves to that control', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    component.filters.controls.fechaInicial.setValue('30/12/2026');
    fixture.detectChanges();

    const finalDateField = fixture.nativeElement.querySelector('.quick-occupancy__date-grid > div:nth-child(2)') as HTMLElement;
    finalDateField.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(component.filters.controls.fechaFinal.value).toBe('02/01/2027');
    expect((fixture.nativeElement.querySelectorAll('app-pms-date-input input[type="text"]')[1] as HTMLInputElement).value).toBe(
      '02/01/2027'
    );
  });

  it('preserves a manually chosen final date and updates an automatically suggested one when the start changes', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    component.filters.controls.fechaInicial.setValue('30/12/2026');
    component.onFinalDateFocus();
    expect(component.filters.controls.fechaFinal.value).toBe('02/01/2027');

    component.filters.controls.fechaInicial.setValue('31/12/2026');
    expect(component.filters.controls.fechaFinal.value).toBe('03/01/2027');

    component.filters.controls.fechaFinal.setValue('10/01/2027');
    component.onFinalDateFocus();
    component.filters.controls.fechaInicial.setValue('01/01/2027');
    expect(component.filters.controls.fechaFinal.value).toBe('10/01/2027');
  });

  it('rejects an end date earlier than the start date', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component, '21/11/2026', '20/11/2026');
    component.procesar();
    fixture.detectChanges();
    expect(component.dateRangeError).toContain('igual o posterior');
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('selects and deselects individual categories and toggles select-all', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    expect(component.selectedCategories.map((item) => item.codigo)).toEqual(['DLX', 'STD']);

    component.setCategorySelected('STD', false);
    expect(component.someCategoriesSelected).toBeTrue();
    expect(component.allCategoriesSelected).toBeFalse();
    component.setAllCategories(false);
    expect(component.selectedCategories.length).toBe(0);
    component.setAllCategories(true);
    expect(component.allCategoriesSelected).toBeTrue();
  });

  it('blocks a query when no category is selected', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component);
    component.setAllCategories(false);
    component.procesar();
    expect(component.errorMessage).toContain('Seleccione al menos una categoría');
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('recalculates category and global availability from the original forecast fields', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    const row = component['mapForecastRow'](forecastRow());

    component.setView('ocupacion');
    expect(component.getViewQuantity(row)).toBe(5);
    expect(component.getViewPercentage(row)).toBe(62.5);
    expect(component.getCategoryDisplay(row, 'STD')).toBe('2/4');

    component.setView('disponibilidad');
    expect(component.getViewQuantity(row)).toBe(3);
    expect(component.getViewPercentage(row)).toBe(37.5);
    expect(component.getCategoryDisplay(row, 'STD')).toBe('2/4');
    expect(component.getCategoryDisplay(row, 'DLX')).toBe('0/3');
    expect(component.isCategoryUnavailable(row, 'DLX')).toBeTrue();
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('sends the existing process value, date format, and category request fields', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component, '20112026', '21112026');
    component.setCategorySelected('DLX', false);
    component.procesar();

    const request = forecastService.getForecast.calls.mostRecent().args[0] as OccupancyForecastRequest;
    expect(request).toEqual({
      proceso: 1,
      fechaInicio: '20/11/2026',
      fechaFinal: '21/11/2026',
      categorias: [{ codigo: 'STD', descripcion: 'STANDARD', operador: 'carga' }]
    });
  });

  it('submits the same query from the form, supporting Enter without a custom key handler', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component);
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(forecastService.getForecast).toHaveBeenCalledTimes(1);
  });

  it('processes from the button and shows a busy state without duplicate requests', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    const pending = new Subject<OccupancyForecastResponseRow[]>();
    forecastService.getForecast.and.returnValue(pending);
    setDates(component);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.quick-occupancy__process') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.isLoading).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Consultando ocupación y disponibilidad');
    component.procesar();
    expect(forecastService.getForecast).toHaveBeenCalledTimes(1);
    pending.next([forecastRow()]);
    pending.complete();
    fixture.detectChanges();
    expect(component.isLoading).toBeFalse();
    expect(component.rows.length).toBe(1);
  });

  it('shows the empty-result message when the service returns no rows', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    forecastService.getForecast.and.returnValue(of([]));
    setDates(component);
    component.procesar();
    fixture.detectChanges();
    expect(component.hasQueried).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No hay información de pronóstico');
  });

  it('shows a query error when the forecast service fails', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    forecastService.getForecast.and.returnValue(throwError(() => new Error('network')));
    setDates(component);
    component.procesar();
    fixture.detectChanges();
    expect(component.errorMessage).toContain('No se pudo cargar el pronóstico para el período seleccionado');
    expect(component.isLoading).toBeFalse();
  });

  it('shows a category-loading error and prevents consultation when catalog loading fails', () => {
    categoriesService.getRoomCategories.and.returnValue(throwError(() => new Error('network')));
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component);
    component.procesar();
    fixture.detectChanges();
    expect(component.categoryErrorMessage).toContain('No se pudieron cargar');
    expect(forecastService.getForecast).not.toHaveBeenCalled();
  });

  it('paginates client-side and uses the existing page-size options', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    const rows = Array.from({ length: 25 }, (_, index) => forecastRow(`${String(index + 1).padStart(2, '0')}/11/2026`));
    forecastService.getForecast.and.returnValue(of(rows));
    setDates(component, '01/11/2026', '30/11/2026');
    component.procesar();

    expect(component.pageRows.length).toBe(10);
    expect(component.totalPages).toBe(3);
    expect(component.paginationLabel).toBe('1-10 de 25');
    component.nextPage();
    expect(component.currentPage).toBe(2);
    expect(component.paginationLabel).toBe('11-20 de 25');
    component.setPageSize(20);
    expect(component.currentPage).toBe(1);
    expect(component.pageRows.length).toBe(20);
    expect(component.pageSizes).toEqual([10, 20, 50, 100]);
  });

  it('clears the dates, selected categories, results, and view when closed', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component);
    component.rows = [component['mapForecastRow'](forecastRow())];
    component.setView('disponibilidad');
    component.closePanel();
    fixture.detectChanges();

    expect(fixture.componentInstance.open).toBeFalse();
    expect(component.filters.value).toEqual({ fechaInicial: null, fechaFinal: null });
    expect(component.rows).toEqual([]);
    expect(component.categorias).toEqual([]);
    expect(component.tipoVista).toBe('ocupacion');
  });

  it('reopens without previous dates or results and initializes categories again', fakeAsync(() => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    setDates(component, '20/11/2026', '21/11/2026');
    component.rows = [component['mapForecastRow'](forecastRow())];
    component.closePanel();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.open-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    expect(component.filters.value).toEqual({ fechaInicial: null, fechaFinal: null });
    expect(component.rows).toEqual([]);
    expect(component.tipoVista).toBe('ocupacion');
    expect(categoriesService.getRoomCategories).toHaveBeenCalledTimes(2);
  }));

  it('cancels an old query when the date filters change so stale rows cannot replace current results', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    const oldResponse = new Subject<OccupancyForecastResponseRow[]>();
    const newResponse = new Subject<OccupancyForecastResponseRow[]>();
    forecastService.getForecast.and.returnValues(oldResponse, newResponse);
    setDates(component, '20/11/2026', '21/11/2026');
    component.procesar();

    component.filters.setValue({ fechaInicial: '22/11/2026', fechaFinal: '23/11/2026' });
    expect(component.isLoading).toBeFalse();
    expect(component.rows).toEqual([]);
    component.procesar();
    oldResponse.next([forecastRow('20/11/2026', 1)]);
    newResponse.next([forecastRow('22/11/2026', 8)]);
    newResponse.complete();
    fixture.detectChanges();

    expect(component.rows.length).toBe(1);
    expect(component.rows[0].totalOcupadas).toBe(8);
  });

  it('cancels pending requests when the panel closes', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    const pending = new Subject<OccupancyForecastResponseRow[]>();
    const unsubscribe = spyOn(pending, 'subscribe').and.callThrough();
    forecastService.getForecast.and.returnValue(pending);
    setDates(component);
    component.procesar();
    const subscription = component['forecastSubscription']!;
    const closedSpy = spyOn(subscription, 'unsubscribe').and.callThrough();

    component.closePanel();
    expect(closedSpy).toHaveBeenCalled();
    pending.next([forecastRow()]);
    expect(component.rows).toEqual([]);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('closes on Escape, traps Tab at the ends, and restores focus to the opener', fakeAsync(() => {
    const fixture = TestBed.createComponent(QuickOccupancyHostComponent);
    fixture.detectChanges();
    const opener = fixture.nativeElement.querySelector('.open-button') as HTMLButtonElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    const component = componentOf(fixture);
    const panel = fixture.nativeElement.querySelector('.quick-occupancy') as HTMLElement;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])')
    ).filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');
    const last = focusable[focusable.length - 1];

    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(focusable[0]);

    focusable[0].focus();
    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    panel.dispatchEvent(shiftTab);
    expect(shiftTab.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(last);

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    tick(0);
    expect(component.open).toBeFalse();
    expect(document.activeElement).toBe(opener);
  }));

  it('renders the existing full forecast route and keeps filters visible after results load', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    component.canOpenFullForecast = true;
    fixture.detectChanges();
    forecastService.getForecast.and.returnValue(of([forecastRow()]));
    setDates(component);
    component.procesar();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.quick-occupancy__filters')).not.toBeNull();
    const fullForecastLink = fixture.nativeElement.querySelector('.quick-occupancy__footer a') as HTMLAnchorElement;
    expect(fullForecastLink.getAttribute('href')).toBe('/front-desk/occupancy-forecast');
    expect(fixture.nativeElement.textContent).not.toContain('Ocupación Promedio');
  });

  it('displays required-date descriptions on the date fields for assistive technology', () => {
    const fixture = createAndOpen();
    const component = componentOf(fixture);
    component.procesar();
    fixture.detectChanges();
    const inputs = Array.from(fixture.nativeElement.querySelectorAll('app-pms-date-input input[type="text"]')) as HTMLInputElement[];
    expect(inputs[0].getAttribute('aria-describedby')).toContain('quick-start-required');
    expect(inputs[1].getAttribute('aria-describedby')).toContain('quick-end-required');
  });
});
