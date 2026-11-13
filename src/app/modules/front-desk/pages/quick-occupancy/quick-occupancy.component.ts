import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, catchError, finalize, of } from 'rxjs';

import {
  addPmsCalendarDays,
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  normalizePmsDateKeyboardInputDDMMYYYY
} from 'src/app/core/utils/pms-date.util';
import { PmsDateInputComponent } from 'src/app/theme/shared/components/pms-date-input/pms-date-input.component';
import { RoomCategory } from '../../settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from '../../settings/room-categories/services/room-categories.service';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastCategoryResult,
  OccupancyForecastRequest,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from '../occupancy-forecast/occupancy-forecast.service';

type OccupancyView = 'ocupacion' | 'disponibilidad';

interface QuickOccupancyCategory {
  codigo: string;
  descripcion: string;
  operador: string;
}

interface QuickOccupancyRow {
  fecha: string;
  totalHabitaciones: number;
  bloqueadas: number;
  totalOcupadas: number;
  pax: number;
  totalChl: number;
  categorias: Record<string, OccupancyForecastCategoryResult>;
  porcentajeOcupacion: number;
}

@Component({
  selector: 'app-quick-occupancy',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PmsDateInputComponent],
  templateUrl: './quick-occupancy.component.html',
  styleUrls: ['./quick-occupancy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickOccupancyComponent implements OnChanges, OnInit, OnDestroy {
  private readonly forecastService = inject(OccupancyForecastService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() canOpenQuickOccupancy = false;
  @Input() canOpenFullForecast = false;
  @Output() readonly openChange = new EventEmitter<boolean>();

  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('fechaInicialInput') private fechaInicialInput?: PmsDateInputComponent;

  readonly filters = new FormGroup({
    fechaInicial: new FormControl<string | null>(null, Validators.required),
    fechaFinal: new FormControl<string | null>(null, Validators.required)
  });

  categorias: QuickOccupancyCategory[] = [];
  categoriasSeleccionadas: Record<string, boolean> = {};
  tipoVista: OccupancyView = 'ocupacion';
  rows: QuickOccupancyRow[] = [];
  pageSize = 10;
  currentPage = 1;
  readonly pageSizes = [10, 20, 50, 100];
  isLoadingCategories = false;
  isLoading = false;
  hasQueried = false;
  submitted = false;
  errorMessage = '';
  categoryErrorMessage = '';

  private sessionActive = false;
  private queryToken = 0;
  private lastFilterValue = '';
  private lastStartDate: string | null = null;
  private autoFinalDate: string | null = null;
  private categoriesSubscription?: Subscription;
  private forecastSubscription?: Subscription;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private restoreFocusTimer?: ReturnType<typeof setTimeout>;
  private focusRestoreTarget: HTMLElement | null = null;

  ngOnInit(): void {
    this.filters.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const startDate = value.fechaInicial ?? null;
      const finalDate = value.fechaFinal ?? null;
      if (this.autoFinalDate && finalDate === this.autoFinalDate && startDate !== this.lastStartDate) {
        this.autoFinalDate = startDate ? this.addDays(startDate, 3) : null;
        if (finalDate !== this.autoFinalDate) {
          this.filters.controls.fechaFinal.setValue(this.autoFinalDate, { emitEvent: false });
        }
      } else if (this.autoFinalDate && finalDate !== this.autoFinalDate) {
        this.autoFinalDate = null;
      }
      this.lastStartDate = startDate;

      const serializedValue = JSON.stringify(value);
      if (serializedValue === this.lastFilterValue) return;
      this.lastFilterValue = serializedValue;
      this.invalidateResults();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['canOpenQuickOccupancy'] && !this.canOpenQuickOccupancy && this.open) {
      this.closePanel();
      return;
    }
    if (!changes['open']) return;
    if (this.open && !this.sessionActive) {
      if (!this.canOpenQuickOccupancy) {
        this.open = false;
        this.openChange.emit(false);
        return;
      }
      this.startSession(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    } else if (!this.open && this.sessionActive) {
      this.endSession(true);
    }
  }

  ngOnDestroy(): void {
    this.cancelTimers();
    this.cancelPendingRequests();
  }

  get selectedCategories(): QuickOccupancyCategory[] {
    return this.categorias.filter((category) => this.categoriasSeleccionadas[category.codigo]);
  }

  get allCategoriesSelected(): boolean {
    return this.categorias.length > 0 && this.selectedCategories.length === this.categorias.length;
  }

  get someCategoriesSelected(): boolean {
    const selectedCount = this.selectedCategories.length;
    return selectedCount > 0 && selectedCount < this.categorias.length;
  }

  get dateRangeError(): string {
    const start = this.filters.controls.fechaInicial.value;
    const end = this.filters.controls.fechaFinal.value;
    if (!start || !end) return '';
    const difference = differenceInPmsCalendarDays(start, end);
    return difference !== null && difference < 0 ? 'La fecha final debe ser igual o posterior a la fecha inicial.' : '';
  }

  get pageRows(): QuickOccupancyRow[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.rows.slice(startIndex, startIndex + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.rows.length / this.pageSize));
  }

  get paginationLabel(): string {
    if (!this.rows.length) return 'Sin registros';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    return `${start}-${Math.min(this.currentPage * this.pageSize, this.rows.length)} de ${this.rows.length}`;
  }

  get quantityLabel(): string {
    return this.tipoVista === 'ocupacion' ? 'Ocupadas' : 'Disponibles';
  }

  get percentageLabel(): string {
    return this.tipoVista === 'ocupacion' ? '% Ocupación' : '% Disponibilidad';
  }

  openPanel(): void {
    if (this.open || !this.canOpenQuickOccupancy) return;
    this.open = true;
    this.startSession(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    this.openChange.emit(true);
    this.cdr.markForCheck();
  }

  closePanel(): void {
    if (!this.open && !this.sessionActive) return;
    this.open = false;
    this.endSession(true);
    this.openChange.emit(false);
    this.cdr.markForCheck();
  }

  onFinalDateFocus(): void {
    const startDate = normalizePmsDateKeyboardInputDDMMYYYY(this.filters.controls.fechaInicial.value);
    const currentFinalDate = this.filters.controls.fechaFinal.value;
    if (!startDate || (currentFinalDate && currentFinalDate !== this.autoFinalDate)) return;

    const suggestedFinalDate = this.addDays(startDate, 3);
    if (!suggestedFinalDate) return;

    this.autoFinalDate = suggestedFinalDate;
    if (currentFinalDate !== suggestedFinalDate) {
      this.filters.controls.fechaFinal.setValue(suggestedFinalDate);
    }
  }

  procesar(): void {
    this.submitted = true;
    this.filters.markAllAsTouched();
    this.errorMessage = '';

    if (this.filters.invalid || this.dateRangeError) {
      this.cdr.markForCheck();
      return;
    }

    if (this.isLoading || this.isLoadingCategories) return;
    if (!this.selectedCategories.length) {
      this.errorMessage = this.categorias.length
        ? 'Seleccione al menos una categoría para procesar el pronóstico.'
        : this.categoryErrorMessage || 'No hay categorías de habitación disponibles para consultar.';
      this.cdr.markForCheck();
      return;
    }

    const fechaInicio = normalizePmsDateKeyboardInputDDMMYYYY(this.filters.controls.fechaInicial.value);
    const fechaFinal = normalizePmsDateKeyboardInputDDMMYYYY(this.filters.controls.fechaFinal.value);
    if (!fechaInicio || !fechaFinal) return;

    const request: OccupancyForecastRequest = {
      proceso: 1,
      fechaInicio,
      fechaFinal,
      categorias: this.selectedCategories.map((category) => this.mapCategoryRequest(category))
    };

    this.forecastSubscription?.unsubscribe();
    const requestToken = ++this.queryToken;
    this.rows = [];
    this.hasQueried = false;
    this.currentPage = 1;
    this.isLoading = true;
    this.cdr.markForCheck();

    this.forecastSubscription = this.forecastService
      .getForecast(request)
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el pronóstico de ocupación rápida.', error);
          if (requestToken === this.queryToken && this.open) {
            this.errorMessage = 'No se pudo cargar el pronóstico para el período seleccionado.';
            this.hasQueried = true;
          }
          return of([] as OccupancyForecastResponseRow[]);
        }),
        finalize(() => {
          if (requestToken !== this.queryToken || !this.open) return;
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        if (requestToken !== this.queryToken || !this.open) return;
        this.rows = items.map((item) => this.mapForecastRow(item));
        this.hasQueried = true;
        this.currentPage = 1;
        this.cdr.markForCheck();
      });
  }

  setCategorySelected(codigo: string, selected: boolean): void {
    this.categoriasSeleccionadas = { ...this.categoriasSeleccionadas, [codigo]: selected };
    this.invalidateResults();
  }

  setAllCategories(selected: boolean): void {
    this.categoriasSeleccionadas = this.categorias.reduce<Record<string, boolean>>((selection, category) => {
      selection[category.codigo] = selected;
      return selection;
    }, {});
    this.invalidateResults();
  }

  setView(value: OccupancyView): void {
    this.tipoVista = value;
    this.currentPage = 1;
  }

  setPageSize(value: number): void {
    this.pageSize = value;
    this.currentPage = 1;
  }

  previousPage(): void {
    this.currentPage = Math.max(1, this.currentPage - 1);
  }

  nextPage(): void {
    this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
  }

  getCategoryResult(row: QuickOccupancyRow, codigo: string): OccupancyForecastCategoryResult {
    const direct = row.categorias[codigo];
    if (direct) return direct;
    const key = Object.keys(row.categorias).find((candidate) => candidate.toUpperCase() === codigo.toUpperCase());
    return key ? row.categorias[key] : { codigo, cantidad: 0, total: 0 };
  }

  getCategoryDisplay(row: QuickOccupancyRow, codigo: string): string {
    const result = this.getCategoryResult(row, codigo);
    const quantity = this.tipoVista === 'ocupacion' ? result.cantidad : Math.max(0, result.total - result.cantidad);
    return `${quantity}/${result.total}`;
  }

  isCategoryUnavailable(row: QuickOccupancyRow, codigo: string): boolean {
    if (this.tipoVista !== 'disponibilidad') return false;
    const result = this.getCategoryResult(row, codigo);
    return result.total > 0 && result.cantidad >= result.total;
  }

  getViewQuantity(row: QuickOccupancyRow): number {
    return this.tipoVista === 'ocupacion' ? row.totalOcupadas : Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupadas);
  }

  getViewPercentage(row: QuickOccupancyRow): number {
    if (this.tipoVista === 'ocupacion') return row.porcentajeOcupacion;
    const sellableRooms = Math.max(0, row.totalHabitaciones - row.bloqueadas);
    return sellableRooms > 0 ? (this.getViewQuantity(row) / sellableRooms) * 100 : 0;
  }

  getPercentageClass(value: number): string {
    const high = this.tipoVista === 'ocupacion' ? value >= 80 : value < 50;
    const medium = value >= 50 && value < 80;
    return high ? 'quick-occupancy__percentage--high' : medium ? 'quick-occupancy__percentage--medium' : 'quick-occupancy__percentage--low';
  }

  trackByCategory(_: number, category: QuickOccupancyCategory): string {
    return category.codigo;
  }

  trackByDate(_: number, row: QuickOccupancyRow): string {
    return row.fecha;
  }

  isRequiredError(name: 'fechaInicial' | 'fechaFinal'): boolean {
    const control = this.filters.controls[name];
    return control.hasError('required') && (control.touched || this.submitted);
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private startSession(focusRestoreTarget: HTMLElement | null): void {
    if (this.sessionActive) return;
    this.sessionActive = true;
    this.focusRestoreTarget = focusRestoreTarget;
    this.resetState();
    this.loadCategories();
    this.cancelTimers();
    this.focusTimer = setTimeout(() => {
      if (this.open && this.sessionActive) this.fechaInicialInput?.focus();
    }, 0);
  }

  private endSession(restoreFocus: boolean): void {
    if (!this.sessionActive) return;
    this.sessionActive = false;
    this.cancelTimers();
    this.cancelPendingRequests();
    this.resetState();
    const target = this.focusRestoreTarget;
    this.focusRestoreTarget = null;
    if (restoreFocus && target?.isConnected && target !== document.body) {
      this.restoreFocusTimer = setTimeout(() => target.focus(), 0);
    }
  }

  private resetState(): void {
    this.filters.reset({ fechaInicial: null, fechaFinal: null }, { emitEvent: false });
    this.lastFilterValue = JSON.stringify(this.filters.getRawValue());
    this.lastStartDate = null;
    this.autoFinalDate = null;
    this.filters.markAsPristine();
    this.filters.markAsUntouched();
    this.categorias = [];
    this.categoriasSeleccionadas = {};
    this.tipoVista = 'ocupacion';
    this.rows = [];
    this.pageSize = 10;
    this.currentPage = 1;
    this.isLoadingCategories = false;
    this.isLoading = false;
    this.hasQueried = false;
    this.submitted = false;
    this.errorMessage = '';
    this.categoryErrorMessage = '';
  }

  private loadCategories(): void {
    this.isLoadingCategories = true;
    this.categoriesSubscription?.unsubscribe();
    this.categoriesSubscription = this.roomCategoriesService
      .getRoomCategories()
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las categorías de habitación para Quick Occupancy.', error);
          this.categoryErrorMessage = 'No se pudieron cargar las categorías de habitación.';
          return of([] as RoomCategory[]);
        }),
        finalize(() => {
          this.isLoadingCategories = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        if (!this.open || !this.sessionActive) return;
        this.categorias = this.mapCategoryOptions(items);
        this.categoriasSeleccionadas = this.categorias.reduce<Record<string, boolean>>((selection, category) => {
          selection[category.codigo] = true;
          return selection;
        }, {});
        this.cdr.markForCheck();
      });
  }

  private invalidateResults(): void {
    if (!this.sessionActive) return;
    this.queryToken += 1;
    this.forecastSubscription?.unsubscribe();
    this.forecastSubscription = undefined;
    this.isLoading = false;
    this.rows = [];
    this.currentPage = 1;
    this.hasQueried = false;
    if (!this.isLoadingCategories) this.errorMessage = '';
    this.cdr.markForCheck();
  }

  private cancelPendingRequests(): void {
    this.queryToken += 1;
    this.categoriesSubscription?.unsubscribe();
    this.categoriesSubscription = undefined;
    this.forecastSubscription?.unsubscribe();
    this.forecastSubscription = undefined;
  }

  private cancelTimers(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    if (this.restoreFocusTimer) clearTimeout(this.restoreFocusTimer);
    this.focusTimer = undefined;
    this.restoreFocusTimer = undefined;
  }

  private mapCategoryOptions(categories: RoomCategory[]): QuickOccupancyCategory[] {
    return categories
      .map((category) => ({
        codigo: this.toText(category.CR01_CodCate).toUpperCase(),
        descripcion: this.toText(category.CR01_Categoria || category.CR01_CodCate).toUpperCase(),
        operador: this.toText(category.CR01_Operador)
      }))
      .filter((category) => category.codigo.length > 0)
      .sort((left, right) => left.descripcion.localeCompare(right.descripcion, undefined, { sensitivity: 'base' }));
  }

  private addDays(value: string, days: number): string | null {
    const date = addPmsCalendarDays(value, days);
    const formatted = date ? normalizePmsDateDDMMYYYY(date) : '';
    return formatted || null;
  }

  private mapCategoryRequest(category: QuickOccupancyCategory): OccupancyForecastCategoryRequest {
    return {
      codigo: category.codigo,
      descripcion: category.descripcion,
      operador: category.operador || 'carga'
    };
  }

  private mapForecastRow(row: OccupancyForecastResponseRow): QuickOccupancyRow {
    return {
      fecha: normalizePmsDateDDMMYYYY(row.fecha) || row.fecha,
      totalHabitaciones: Number(row.totHabi) || 0,
      bloqueadas: Number(row.blk) || 0,
      totalOcupadas: Number(row.totOcupa) || 0,
      pax: Number(row.totPax) || 0,
      totalChl: Number(row.totChl) || 0,
      categorias: row.categorias ?? {},
      porcentajeOcupacion: Number(row.porOcu) || 0
    };
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.panel) return [];
    return Array.from(
      this.panel.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true' && !element.closest('[hidden]'));
  }

  private toText(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }
}
