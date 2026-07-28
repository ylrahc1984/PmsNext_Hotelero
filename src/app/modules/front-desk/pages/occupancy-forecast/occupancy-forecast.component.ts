import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import {
  addPmsCalendarDays,
  differenceInPmsCalendarDays,
  normalizePmsDateDDMMYYYY,
  toPmsDateInputValue
} from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomCategory } from '../../settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from '../../settings/room-categories/services/room-categories.service';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastCategoryResult,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from './occupancy-forecast.service';

export interface OccupancyForecastRow {
  fecha: string;
  totalHabitaciones: number;
  bloqueadas: number;
  totalOcupadas: number;
  pax: number;
  totalChl: number;
  categorias: Record<string, OccupancyForecastCategoryResult>;
  porcentajeOcupacion: number;
}

interface ForecastCategoryOption {
  codigo: string;
  descripcion: string;
  operador: string;
}

interface ForecastKpi {
  title: string;
  value: string;
  helper: string;
  icon: string;
}

interface ForecastAction {
  label: string;
  icon: string;
  accent?: 'primary';
}

@Component({
  selector: 'app-occupancy-forecast',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './occupancy-forecast.component.html',
  styleUrls: ['./occupancy-forecast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OccupancyForecastComponent implements OnInit {
  private readonly forecastService = inject(OccupancyForecastService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly initialDate = new Date();

  fechaInicial = toPmsDateInputValue(this.initialDate);
  fechaFinal = toPmsDateInputValue(addPmsCalendarDays(this.initialDate, 15)); // 15 dias calendario despues
  tipoVista: 'ocupacion' | 'disponibilidad' = 'ocupacion';
  busqueda = '';
  pageSize = 10;
  currentPage = 1;
  isLoading = false;
  errorMessage = '';

  categorias: ForecastCategoryOption[] = [];
  categoriasSeleccionadas: Record<string, boolean> = {};

  kpis: ForecastKpi[] = this.buildKpis([]);

  readonly pageSizes = [10, 20, 50, 100];
  rows: OccupancyForecastRow[] = [];

  readonly actions: ForecastAction[] = [
    { label: 'Imprimir', icon: 'print', accent: 'primary' },
    { label: 'Exportar Excel', icon: 'file_download' }
  ];

  ngOnInit(): void {
    this.loadInitialData();
  }

  get filteredRows(): OccupancyForecastRow[] {
    const term = this.busqueda.trim().toLowerCase();

    if (!term) {
      return this.rows;
    }

    return this.rows.filter((row) => row.fecha.toLowerCase().includes(term));
  }

  get pagedRows(): OccupancyForecastRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  get paginationLabel(): string {
    if (!this.filteredRows.length) {
      return 'Sin registros';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.filteredRows.length);
    return `${start}-${end} de ${this.filteredRows.length}`;
  }

  get dateRangeError(): string {
    const startDate = this.formatDateApi(this.fechaInicial);
    const endDate = this.formatDateApi(this.fechaFinal);

    if (!startDate || !endDate) {
      return 'Seleccione una fecha inicial y una fecha final válidas.';
    }

    return (differenceInPmsCalendarDays(startDate, endDate) ?? -1) < 0
      ? 'La fecha final debe ser igual o posterior a la fecha inicial.'
      : '';
  }

  get viewQuantityLabel(): string {
    return this.tipoVista === 'ocupacion' ? 'Total Ocupada' : 'Total Disponible';
  }

  get viewPercentageLabel(): string {
    return this.tipoVista === 'ocupacion' ? '% Ocupación' : '% Disponibilidad';
  }

  procesar(): void {
    this.currentPage = 1;
    this.loadForecast();
  }

  imprimir(): void {
    console.log('Imprimir pronostico');
  }

  exportarExcel(): void {
    console.log('Exportar Excel');
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  onViewChange(): void {
    this.kpis = this.buildKpis(this.rows);
  }

  previousPage(): void {
    this.currentPage = Math.max(1, this.currentPage - 1);
  }

  nextPage(): void {
    this.currentPage = Math.min(this.totalPages, this.currentPage + 1);
  }

  getOccupancyClass(value: number): string {
    if (value >= 80) {
      return 'occupancy-high';
    }

    if (value >= 50) {
      return 'occupancy-medium';
    }

    return 'occupancy-low';
  }

  getViewPercentageClass(value: number): string {
    if (this.tipoVista === 'ocupacion') {
      return this.getOccupancyClass(value);
    }

    if (value >= 80) {
      return 'occupancy-low';
    }

    if (value >= 50) {
      return 'occupancy-medium';
    }

    return 'occupancy-high';
  }

  trackByFecha(_: number, row: OccupancyForecastRow): string {
    return row.fecha;
  }

  trackByCategoria(_: number, item: ForecastCategoryOption): string {
    return item.codigo;
  }

  trackByLabel(_: number, item: { label?: string; title?: string }): string {
    return item.label ?? item.title ?? '';
  }

  get selectedCategories(): ForecastCategoryOption[] {
    return this.categorias.filter((categoria) => this.categoriasSeleccionadas[categoria.codigo]);
  }

  getCategoryResult(row: OccupancyForecastRow, codigo: string): OccupancyForecastCategoryResult {
    const directResult = row.categorias[codigo];
    if (directResult) {
      return directResult;
    }

    const key = Object.keys(row.categorias).find((categoryKey) => categoryKey.toUpperCase() === codigo.toUpperCase());
    return key ? row.categorias[key] : { codigo, cantidad: 0, total: 0 };
  }

  getCategoryDisplay(row: OccupancyForecastRow, codigo: string): string {
    const result = this.getCategoryResult(row, codigo);
    const quantity = this.tipoVista === 'ocupacion' ? result.cantidad : Math.max(0, result.total - result.cantidad);
    return `${quantity}/${result.total}`;
  }

  isCategoryUnavailable(row: OccupancyForecastRow, codigo: string): boolean {
    if (this.tipoVista !== 'disponibilidad') {
      return false;
    }

    const result = this.getCategoryResult(row, codigo);
    return result.total > 0 && result.cantidad >= result.total;
  }

  getViewQuantity(row: OccupancyForecastRow): number {
    return this.tipoVista === 'ocupacion'
      ? row.totalOcupadas
      : Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupadas);
  }

  getViewPercentage(row: OccupancyForecastRow): number {
    if (this.tipoVista === 'ocupacion') {
      return row.porcentajeOcupacion;
    }

    const sellableRooms = Math.max(0, row.totalHabitaciones - row.bloqueadas);
    return sellableRooms > 0 ? (this.getViewQuantity(row) / sellableRooms) * 100 : 0;
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.roomCategoriesService
      .getRoomCategories()
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las categorias de habitacion.', error);
          this.errorMessage = 'No se pudieron cargar las categorias de habitacion.';
          return of([] as RoomCategory[]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((categories) => {
        this.categorias = this.mapCategoryOptions(categories);
        this.categoriasSeleccionadas = this.categorias.reduce<Record<string, boolean>>((selected, categoria) => {
          selected[categoria.codigo] = true;
          return selected;
        }, {});

        this.loadForecast();
      });
  }

  private loadForecast(): void {
    const dateRangeError = this.dateRangeError;
    if (dateRangeError) {
      this.isLoading = false;
      this.errorMessage = dateRangeError;
      this.cdr.markForCheck();
      return;
    }

    const selectedCategories = this.selectedCategories;

    if (!selectedCategories.length) {
      this.rows = [];
      this.kpis = this.buildKpis([]);
      this.isLoading = false;
      this.errorMessage = 'Seleccione al menos una categoria para procesar el pronostico.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.forecastService
      .getForecast({
        proceso: 1,
        fechaInicio: this.formatDateApi(this.fechaInicial),
        fechaFinal: this.formatDateApi(this.fechaFinal),
        categorias: selectedCategories.map((categoria) => this.mapCategoryRequest(categoria))
      })
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el pronostico de ocupacion.', error);
          this.errorMessage = 'No se pudo cargar el pronostico de ocupacion para el periodo seleccionado.';
          return of([] as OccupancyForecastResponseRow[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((rows) => {
        this.rows = rows.map((row) => this.mapForecastRow(row));
        this.kpis = this.buildKpis(this.rows);
        this.currentPage = 1;
      });
  }

  private mapCategoryOptions(categories: RoomCategory[]): ForecastCategoryOption[] {
    return categories
      .map((category) => ({
        codigo: this.toText(category.CR01_CodCate).toUpperCase(),
        descripcion: this.toText(category.CR01_Categoria || category.CR01_CodCate).toUpperCase(),
        operador: this.toText(category.CR01_Operador)
      }))
      .filter((category) => category.codigo.length > 0)
      .sort((left, right) => left.descripcion.localeCompare(right.descripcion, undefined, { sensitivity: 'base' }));
  }

  private mapCategoryRequest(category: ForecastCategoryOption): OccupancyForecastCategoryRequest {
    return {
      codigo: category.codigo,
      descripcion: category.descripcion,
      operador: category.operador || 'carga'
    };
  }

  private mapForecastRow(row: OccupancyForecastResponseRow): OccupancyForecastRow {
    return {
      fecha: this.formatDisplayDate(row.fecha),
      totalHabitaciones: Number(row.totHabi) || 0,
      bloqueadas: Number(row.blk) || 0,
      totalOcupadas: Number(row.totOcupa) || 0,
      pax: Number(row.totPax) || 0,
      totalChl: Number(row.totChl) || 0,
      categorias: row.categorias ?? {},
      porcentajeOcupacion: Number(row.porOcu) || 0
    };
  }

  private buildKpis(rows: OccupancyForecastRow[]): ForecastKpi[] {
    const viewPercentages = rows.map((row) => this.getViewPercentage(row));
    const viewAverage = viewPercentages.length ? viewPercentages.reduce((total, percentage) => total + percentage, 0) / viewPercentages.length : 0;
    const peak = rows.reduce<OccupancyForecastRow | null>(
      (current, row) => (!current || this.getViewPercentage(row) > this.getViewPercentage(current) ? row : current),
      null
    );
    const adults = rows.reduce((total, row) => total + row.pax, 0);
    const children = rows.reduce((total, row) => total + row.totalChl, 0);
    const availableRoomNights = rows.reduce((total, row) => total + Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupadas), 0);
    const occupiedRoomNights = rows.reduce((total, row) => total + row.totalOcupadas, 0);
    const isOccupancyView = this.tipoVista === 'ocupacion';

    return [
      {
        title: isOccupancyView ? 'Ocupación Promedio' : 'Disponibilidad Promedio',
        value: `${viewAverage.toFixed(1)}%`,
        helper: 'En el período seleccionado',
        icon: 'analytics'
      },
      {
        title: isOccupancyView ? 'Pico de Ocupación' : 'Pico de Disponibilidad',
        value: `${(peak ? this.getViewPercentage(peak) : 0).toFixed(1)}%`,
        helper: peak?.fecha ?? 'Sin datos',
        icon: 'trending_up'
      },
      { title: 'Pax Totales', value: String(adults + children), helper: `${adults} adultos / ${children} ninos`, icon: 'groups' },
      { title: 'Habitaciones Disponibles', value: String(availableRoomNights), helper: 'Habitacion noche disponible', icon: 'hotel' },
      {
        title: isOccupancyView ? 'Noches Proyectadas' : 'Noches Disponibles',
        value: String(isOccupancyView ? occupiedRoomNights : availableRoomNights),
        helper: isOccupancyView ? 'Habitación noche ocupada' : 'Habitación noche disponible',
        icon: 'bedtime'
      }
    ];
  }

  private formatDateApi(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private formatDisplayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || value;
  }

  private toText(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }
}
