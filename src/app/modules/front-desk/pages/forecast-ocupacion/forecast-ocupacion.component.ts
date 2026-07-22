import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { Empresa } from 'src/app/core/models/empresa.model';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { EmpresaService } from 'src/app/core/services/empresa.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomCategory } from '../../settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from '../../settings/room-categories/services/room-categories.service';
import {
  OccupancyForecastCategoryRequest,
  OccupancyForecastCategoryResult,
  OccupancyForecastResponseRow,
  OccupancyForecastService
} from '../occupancy-forecast/occupancy-forecast.service';

interface ForecastOcupacionRow {
  fecha: string;
  totalHabitaciones: number;
  bloqueadas: number;
  totalOcupada: number;
  porcentajeOcupacion: number;
  pax: number;
  totalCLL: number;
  categorias: Record<string, OccupancyForecastCategoryResult>;
  porOcupacion: number;
}

interface ForecastCategoria {
  nombre: string;
  codigo: string;
  porcentaje: number;
  color: string;
  valor: string;
}

interface ForecastCategoryOption {
  codigo: string;
  descripcion: string;
  operador: string;
}

interface ForecastKpi {
  titulo: string;
  valor: string | number;
  subtitulo: string;
  icono: string;
  color: string;
}

@Component({
  selector: 'app-forecast-ocupacion',
  standalone: true,
  imports: [CommonModule, SharedModule, NgApexchartsModule],
  templateUrl: './forecast-ocupacion.component.html',
  styleUrls: ['./forecast-ocupacion.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForecastOcupacionComponent implements OnInit {
  private readonly forecastService = inject(OccupancyForecastService);
  private readonly empresaService = inject(EmpresaService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  hotel = '';
  fechaInicial = toPmsDateInputValue(new Date());
  fechaFinal = toPmsDateInputValue(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)); // 15 dias despues
  tipoVista: 'ocupacion' | 'disponibilidad' = 'ocupacion';
  busqueda = '';
  pageSize = 10;
  currentPage = 1;
  isLoading = false;
  errorMessage = '';

  categoriasSeleccionadas: Record<string, boolean> = {};

  readonly pageSizes = [10, 20, 50, 100];

  hoteles: Empresa[] = [];
  categorias: ForecastCategoryOption[] = [];
  kpis: ForecastKpi[] = this.buildKpis([]);
  resumenCategorias: ForecastCategoria[] = [];
  rows: ForecastOcupacionRow[] = [];
  chartOptions: Partial<ApexOptions> = this.buildChartOptions([]);

  ngOnInit(): void {
    this.loadInitialData();
  }

  get filteredRows(): ForecastOcupacionRow[] {
    const term = this.busqueda.trim().toLowerCase();
    return term ? this.rows.filter((row) => row.fecha.toLowerCase().includes(term)) : this.rows;
  }

  get pagedRows(): ForecastOcupacionRow[] {
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

  get selectedCategories(): ForecastCategoryOption[] {
    return this.categorias.filter((categoria) => this.categoriasSeleccionadas[categoria.codigo]);
  }

  procesar(): void {
    this.currentPage = 1;
    this.loadForecast();
  }

  imprimir(): void {
    console.log('Imprimir forecast de ocupación');
  }

  exportarExcel(): void {
    console.log('Exportar Excel forecast de ocupación');
  }

  onHotelChange(): void {
    this.syncSelectedEmpresaContext();
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

  getCategoryValue(row: ForecastOcupacionRow, codigo: string): number {
    return this.getCategoryResult(row, codigo).cantidad;
  }

  trackByFecha(_: number, row: ForecastOcupacionRow): string {
    return row.fecha;
  }

  trackByTitulo(_: number, item: ForecastKpi): string {
    return item.titulo;
  }

  trackByCategoria(_: number, item: ForecastCategoria): string {
    return item.codigo;
  }

  trackByCategoriaFiltro(_: number, item: ForecastCategoryOption): string {
    return item.codigo;
  }

  trackByHotel(_: number, item: Empresa): string {
    return item?.MA04_Unidad ?? '';
  }

  getHotelNombre(item: Empresa): string {
    return this.toText(item.MA04_Nombre || item.MA04_RazonSocial || item.MA04_Unidad);
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.empresaContext.restaurarDesdeStorage();

    this.empresaService
      .obtenerEmpresas()
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar las empresas.', error);
          this.errorMessage = 'No se pudieron cargar las empresas.';
          return of([] as Empresa[]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((empresas) => {
        this.hoteles = empresas;
        this.setInitialHotel(empresas);
        this.loadRoomCategories();
      });
  }

  private loadRoomCategories(): void {
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
      this.resumenCategorias = [];
      this.chartOptions = this.buildChartOptions([]);
      this.isLoading = false;
      this.errorMessage = 'Seleccione al menos una categoria para procesar el forecast.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.syncSelectedEmpresaContext();

    this.forecastService
      .getForecast({
        proceso: 1,
        fechaInicio: this.formatDateApi(this.fechaInicial),
        fechaFinal: this.formatDateApi(this.fechaFinal),
        categorias: selectedCategories.map((categoria) => this.mapCategoryRequest(categoria))
      })
      .pipe(
        catchError((error) => {
          console.error('No se pudo cargar el forecast de ocupacion.', error);
          this.errorMessage = 'No se pudo cargar el forecast de ocupacion para el periodo seleccionado.';
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
        this.resumenCategorias = this.buildCategorySummary(this.rows);
        this.chartOptions = this.buildChartOptions(this.rows);
        this.currentPage = 1;
      });
  }

  private setInitialHotel(empresas: Empresa[]): void {
    const current = this.empresaContext.getSnapshot();
    const selected =
      empresas.find((empresa) => empresa.MA04_Unidad === current?.MA04_Unidad) ??
      empresas.find((empresa) => Number(empresa.MA04_Principal) === 1) ??
      empresas[0] ??
      null;

    if (!selected) {
      this.hotel = '';
      return;
    }

    this.hotel = selected.MA04_Unidad;
    this.empresaContext.setEmpresa(selected);
  }

  private syncSelectedEmpresaContext(): void {
    const selected = this.hoteles.find((empresa) => empresa.MA04_Unidad === this.hotel);

    if (selected) {
      this.empresaContext.setEmpresa(selected);
    }
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

  private mapForecastRow(row: OccupancyForecastResponseRow): ForecastOcupacionRow {
    return {
      fecha: this.formatDisplayDate(row.fecha),
      totalHabitaciones: Number(row.totHabi) || 0,
      bloqueadas: Number(row.blk) || 0,
      totalOcupada: Number(row.totOcupa) || 0,
      porcentajeOcupacion: Number(row.porOcu) || 0,
      pax: Number(row.totPax) || 0,
      totalCLL: Number(row.totChl) || 0,
      categorias: row.categorias ?? {},
      porOcupacion: Number(row.porOcu) || 0
    };
  }

  private buildKpis(rows: ForecastOcupacionRow[]): ForecastKpi[] {
    const average = rows.length ? rows.reduce((total, row) => total + row.porcentajeOcupacion, 0) / rows.length : 0;
    const peak = rows.reduce<ForecastOcupacionRow | null>(
      (current, row) => (!current || row.porcentajeOcupacion > current.porcentajeOcupacion ? row : current),
      null
    );
    const adults = rows.reduce((total, row) => total + row.pax, 0);
    const children = rows.reduce((total, row) => total + row.totalCLL, 0);
    const availableRoomNights = rows.reduce((total, row) => total + Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupada), 0);
    const occupiedRoomNights = rows.reduce((total, row) => total + row.totalOcupada, 0);

    return [
      { titulo: 'Ocupación Promedio', valor: `${average.toFixed(1)}%`, subtitulo: 'En el período seleccionado', icono: 'insert_chart', color: '#2563eb' },
      { titulo: 'Pico de Ocupación', valor: `${(peak?.porcentajeOcupacion ?? 0).toFixed(1)}%`, subtitulo: peak?.fecha ?? 'Sin datos', icono: 'trending_up', color: '#14b8a6' },
      { titulo: 'Pax Totales', valor: adults + children, subtitulo: `${adults} adultos / ${children} niños`, icono: 'groups', color: '#9333ea' },
      { titulo: 'Total Habitaciones', valor: availableRoomNights, subtitulo: 'Disponibles para venta', icono: 'hotel', color: '#0f3b68' },
      { titulo: 'Total Noches', valor: occupiedRoomNights, subtitulo: 'Habitación noche', icono: 'hotel', color: '#f59e0b' }
    ];
  }

  private buildCategorySummary(rows: ForecastOcupacionRow[]): ForecastCategoria[] {
    const colors = ['#14b8a6', '#2563eb', '#9333ea', '#f59e0b', '#dc2626', '#0f3b68', '#17d4e0'];

    return this.selectedCategories.map((category, index) => {
      const occupied = rows.reduce((total, row) => total + this.getCategoryResult(row, category.codigo).cantidad, 0);
      const totalRooms = rows.reduce((total, row) => total + this.getCategoryResult(row, category.codigo).total, 0);
      const percentage = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0;

      return {
        nombre: category.descripcion,
        codigo: category.codigo,
        porcentaje: percentage,
        color: colors[index % colors.length],
        valor: `${occupied} hab.`
      };
    });
  }

  private buildChartOptions(rows: ForecastOcupacionRow[]): Partial<ApexOptions> {
    const average = rows.length ? rows.reduce((total, row) => total + row.porcentajeOcupacion, 0) / rows.length : 0;

    return {
      series: [
        {
          name: '% Ocupación',
          data: rows.map((row) => Number(row.porcentajeOcupacion.toFixed(1)))
        }
      ],
      chart: {
        type: 'line',
        height: 332,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit'
      },
      colors: ['#2563eb'],
      stroke: {
        curve: 'smooth',
        width: 3
      },
      markers: {
        size: 4,
        strokeWidth: 3,
        hover: { size: 6 }
      },
      grid: {
        borderColor: '#e6ebf3',
        strokeDashArray: 4
      },
      xaxis: {
        categories: rows.map((row) => this.formatChartDate(row.fecha)),
        labels: { style: { colors: '#64748b' } }
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          formatter: (value) => `${value.toFixed(0)}%`,
          style: { colors: ['#64748b'] }
        }
      },
      tooltip: {
        y: {
          formatter: (value) => `${value.toFixed(1)}%`
        }
      },
      annotations: {
        yaxis: [
          {
            y: Number(average.toFixed(1)),
            borderColor: '#14b8a6',
            strokeDashArray: 5,
            label: {
              borderColor: '#14b8a6',
              style: { color: '#ffffff', background: '#14b8a6' },
              text: `Promedio ${average.toFixed(1)}%`
            }
          }
        ]
      },
      dataLabels: { enabled: false }
    };
  }

  private getCategoryResult(row: ForecastOcupacionRow, codigo: string): OccupancyForecastCategoryResult {
    const directResult = row.categorias[codigo];

    if (directResult) {
      return directResult;
    }

    const key = Object.keys(row.categorias).find((categoryKey) => categoryKey.toUpperCase() === codigo.toUpperCase());
    return key ? row.categorias[key] : { codigo, cantidad: 0, total: 0 };
  }

  private formatDateApi(value: string): string {
    return normalizePmsDateDDMMYYYY(value);
  }

  private formatDisplayDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || value;
  }

  private formatChartDate(value: string): string {
    const [day, month] = value.split('/');
    return day && month ? `${day}/${month}` : value;
  }

  private toText(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }
}
