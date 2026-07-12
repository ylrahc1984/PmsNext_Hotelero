import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

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

  fechaInicial = new Date().toISOString().split('T')[0];
  fechaFinal = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 15 dias despues
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
    return row.categorias[codigo] ?? { codigo, cantidad: 0, total: 0 };
  }

  getCategoryDisplay(row: OccupancyForecastRow, codigo: string): string {
    const result = this.getCategoryResult(row, codigo);
    return `${result.cantidad}/${result.total}`;
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
    const occupancyAverage = rows.length ? rows.reduce((total, row) => total + row.porcentajeOcupacion, 0) / rows.length : 0;
    const peak = rows.reduce<OccupancyForecastRow | null>(
      (current, row) => (!current || row.porcentajeOcupacion > current.porcentajeOcupacion ? row : current),
      null
    );
    const adults = rows.reduce((total, row) => total + row.pax, 0);
    const children = rows.reduce((total, row) => total + row.totalChl, 0);
    const availableRoomNights = rows.reduce((total, row) => total + Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupadas), 0);
    const occupiedRoomNights = rows.reduce((total, row) => total + row.totalOcupadas, 0);

    return [
      { title: 'Ocupacion Promedio', value: `${occupancyAverage.toFixed(1)}%`, helper: 'En el periodo seleccionado', icon: 'analytics' },
      { title: 'Pico de Ocupacion', value: `${(peak?.porcentajeOcupacion ?? 0).toFixed(1)}%`, helper: peak?.fecha ?? 'Sin datos', icon: 'trending_up' },
      { title: 'Pax Totales', value: String(adults + children), helper: `${adults} adultos / ${children} ninos`, icon: 'groups' },
      { title: 'Habitaciones Disponibles', value: String(availableRoomNights), helper: 'Habitacion noche disponible', icon: 'hotel' },
      { title: 'Noches Proyectadas', value: String(occupiedRoomNights), helper: 'Habitacion noche ocupada', icon: 'bedtime' }
    ];
  }

  private formatDateApi(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private formatDisplayDate(value: string): string {
    const date = new Date(value.replace(/\s+/g, ' '));

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private toText(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }
}
