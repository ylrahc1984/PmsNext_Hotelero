import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Empresa } from 'src/app/core/models/empresa.model';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { EmpresaService } from 'src/app/core/services/empresa.service';
import { addPmsCalendarDays, normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
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
  fechaFinal = toPmsDateInputValue(addPmsCalendarDays(new Date(), 15)); // 15 dias calendario despues
  tipoVista: 'ocupacion' | 'disponibilidad' = 'ocupacion';
  busqueda = '';
  pageSize = 10;
  currentPage = 1;
  isLoading = false;
  isExportingExcel = false;
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

  get viewQuantityLabel(): string {
    return this.tipoVista === 'ocupacion' ? 'Total Ocupada' : 'Total Disponible';
  }

  get viewPercentageLabel(): string {
    return this.tipoVista === 'ocupacion' ? '% Ocupación' : '% Disponibilidad';
  }

  get viewSummaryLabel(): string {
    return this.tipoVista === 'ocupacion' ? 'Por Ocupación' : 'Por Disponibilidad';
  }

  get chartTitle(): string {
    return this.tipoVista === 'ocupacion' ? 'Ocupación Proyectada' : 'Disponibilidad Proyectada';
  }

  get hotelNombreSeleccionado(): string {
    const selected = this.hoteles.find((item) => item.MA04_Unidad === this.hotel);
    return selected ? this.getHotelNombre(selected) : '—';
  }

  get selectedCategoriesLabel(): string {
    return this.selectedCategories.map((categoria) => categoria.descripcion).join(', ') || 'Ninguna';
  }

  get periodoSeleccionado(): string {
    return `${normalizePmsDateDDMMYYYY(this.fechaInicial)} al ${normalizePmsDateDDMMYYYY(this.fechaFinal)}`;
  }

  procesar(): void {
    this.currentPage = 1;
    this.loadForecast();
  }

  imprimir(): void {
    if (this.isLoading || this.filteredRows.length === 0) return;

    document.body.classList.add('forecast-print-mode');
    const cleanup = (): void => {
      document.body.classList.remove('forecast-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  async exportarExcel(): Promise<void> {
    const exportRows = this.filteredRows;
    if (this.isLoading || this.isExportingExcel) return;
    if (exportRows.length === 0) {
      void Swal.fire({ icon: 'info', title: 'Sin información', text: 'No hay filas del forecast para exportar.' });
      return;
    }

    this.isExportingExcel = true;
    this.cdr.markForCheck();
    try {
      const XLSX = await import('xlsx-js-style');
      const categoryHeaders = this.selectedCategories.map((category) => category.descripcion);
      const headers = [
        'Fecha', 'Total habitaciones', 'Habitaciones bloqueadas', this.viewQuantityLabel, this.viewPercentageLabel,
        'Pax', 'Total C/LL', ...categoryHeaders, this.viewSummaryLabel
      ];
      const columnCount = headers.length;
      const reportInfo = [
        ['Forecast de Ocupación'],
        [`Período: ${this.periodoSeleccionado}`],
        [`Hotel: ${this.hotelNombreSeleccionado} (${this.hotel || '—'})`],
        [`Vista: ${this.tipoVista === 'ocupacion' ? 'Ocupación' : 'Disponibilidad'} | Categorías: ${this.selectedCategoriesLabel}`],
        [`Búsqueda aplicada: ${this.busqueda.trim() || 'Ninguna'} | Registros: ${exportRows.length}`],
        []
      ];
      const kpiLabels = this.kpis.map((kpi) => kpi.titulo);
      const kpiValues = this.kpis.map((kpi) => `${kpi.valor}${kpi.subtitulo ? ` — ${kpi.subtitulo}` : ''}`);
      const rowData = exportRows.map((row) => [
        row.fecha,
        row.totalHabitaciones,
        row.bloqueadas,
        this.getViewQuantity(row),
        this.getViewPercentage(row),
        row.pax,
        row.totalCLL,
        ...this.selectedCategories.map((category) => this.getCategoryValue(row, category.codigo)),
        this.getViewPercentage(row)
      ]);
      const kpiRow = (values: Array<string | number>): Array<string | number> => {
        const result: Array<string | number> = Array(columnCount).fill('');
        values.forEach((value, index) => {
          result[Math.floor(index * columnCount / values.length)] = value;
        });
        return result;
      };
      const headerRow = reportInfo.length + 3;
      const worksheet = XLSX.utils.aoa_to_sheet([
        ...reportInfo,
        kpiRow(kpiLabels),
        kpiRow(kpiValues),
        [],
        headers,
        ...rowData
      ]);
      const merges: import('xlsx-js-style').Range[] = Array.from({ length: reportInfo.length - 1 }, (_, row) => ({
        s: { r: row, c: 0 }, e: { r: row, c: columnCount - 1 }
      }));
      const kpiRanges: Array<{ start: number; end: number }> = [];
      for (let index = 0; index < this.kpis.length; index += 1) {
        const start = Math.floor(index * columnCount / this.kpis.length);
        const end = Math.floor((index + 1) * columnCount / this.kpis.length) - 1;
        kpiRanges.push({ start, end });
        if (end > start) {
          for (const row of [reportInfo.length, reportInfo.length + 1]) {
            merges.push({ s: { r: row, c: start }, e: { r: row, c: end } });
          }
        }
      }
      worksheet['!merges'] = merges;
      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + rowData.length, c: columnCount - 1 } })
      };
      worksheet['!cols'] = [18, 18, 22, 18, 17, 12, 14, ...categoryHeaders.map(() => 18), 18].map((wch) => ({ wch }));
      worksheet['!rows'] = [
        { hpt: 32 }, ...Array.from({ length: 4 }, () => ({ hpt: 21 })), { hpt: 10 },
        { hpt: 23 }, { hpt: 38 }, { hpt: 10 }, { hpt: 34 }, ...rowData.map(() => ({ hpt: 23 }))
      ];

      const setStyle = (row: number, column: number, style: Record<string, unknown>): void => {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = worksheet[address] ?? { t: 's', v: '' };
        cell.s = { ...cell.s, ...style };
        worksheet[address] = cell;
      };
      for (let column = 0; column < columnCount; column += 1) {
        setStyle(0, column, {
          fill: { fgColor: { rgb: 'FF17365D' } },
          font: { name: 'Aptos Display', sz: 16, bold: true, color: { rgb: 'FFFFFFFF' } },
          alignment: { vertical: 'center', horizontal: 'left' }
        });
        for (let row = 1; row < reportInfo.length - 1; row += 1) {
          setStyle(row, column, {
            fill: { fgColor: { rgb: row % 2 ? 'FFF1F5F9' : 'FFE6EEF6' } },
            font: { name: 'Aptos', sz: 10, color: { rgb: 'FF334155' }, bold: row === 1 },
            alignment: { vertical: 'center', wrapText: true },
            border: { bottom: { style: 'thin', color: { rgb: 'FFD8E1EA' } } }
          });
        }
        setStyle(headerRow, column, {
          fill: { fgColor: { rgb: 'FF245B8F' } },
          font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FFFFFFFF' } },
          alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
          border: { bottom: { style: 'medium', color: { rgb: 'FF17365D' } } }
        });
      }
      kpiRanges.forEach(({ start, end }, index) => {
        for (let column = start; column <= end; column += 1) {
          setStyle(reportInfo.length, column, {
            fill: { fgColor: { rgb: 'FFE6EEF6' } },
            font: { name: 'Aptos', sz: 9, bold: true, color: { rgb: 'FF526579' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: { top: { style: 'medium', color: { rgb: 'FF2563EB' } } }
          });
          setStyle(reportInfo.length + 1, column, {
            fill: { fgColor: { rgb: 'FFF5F8FC' } },
            font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FF17365D' } },
            alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
            border: { bottom: { style: 'thin', color: { rgb: 'FFCBD5E1' } } }
          });
        }
        const labelCell = worksheet[XLSX.utils.encode_cell({ r: reportInfo.length, c: start })];
        const valueCell = worksheet[XLSX.utils.encode_cell({ r: reportInfo.length + 1, c: start })];
        if (labelCell) labelCell.v = kpiLabels[index];
        if (valueCell) valueCell.v = kpiValues[index];
      });

      for (let rowIndex = headerRow + 1; rowIndex <= headerRow + rowData.length; rowIndex += 1) {
        for (let column = 0; column < columnCount; column += 1) {
          setStyle(rowIndex, column, {
            fill: { fgColor: { rgb: (rowIndex - headerRow) % 2 ? 'FFFFFFFF' : 'FFF3F7FB' } },
            font: { name: 'Aptos', sz: 10, color: { rgb: 'FF243447' } },
            alignment: { vertical: 'center', horizontal: column === 0 ? 'left' : 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'FFD8E1EA' } } }
          });
          if (typeof worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: column })]?.v === 'number') {
            worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: column })].z = '#,##0';
          }
        }
        for (const percentColumn of [4, columnCount - 1]) {
          worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: percentColumn })].z = '0.0"%"';
        }
      }

      const workbook = XLSX.utils.book_new();
      workbook.Props = { Title: 'Forecast de Ocupación', Subject: this.periodoSeleccionado };
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Forecast');
      const safeHotel = this.hotel.replace(/[^a-zA-Z0-9_-]/g, '') || 'hotel';
      const safeDate = (value: string): string => normalizePmsDateDDMMYYYY(value).replace(/\//g, '-') || 'fecha';
      XLSX.writeFile(workbook, `forecast-ocupacion_${safeHotel}_${safeDate(this.fechaInicial)}_${safeDate(this.fechaFinal)}.xlsx`, { compression: true });
      void Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Archivo Excel descargado', showConfirmButton: false, timer: 2500 });
    } catch (error) {
      console.error('No se pudo exportar el Forecast de Ocupación.', error);
      void Swal.fire({ icon: 'error', title: 'No se pudo exportar', text: 'No fue posible generar el archivo Excel. Intente nuevamente.' });
    } finally {
      this.isExportingExcel = false;
      this.cdr.markForCheck();
    }
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

  onViewChange(): void {
    this.kpis = this.buildKpis(this.rows);
    this.resumenCategorias = this.buildCategorySummary(this.rows);
    this.chartOptions = this.buildChartOptions(this.rows);
    this.cdr.markForCheck();
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
    const result = this.getCategoryResult(row, codigo);
    return this.tipoVista === 'ocupacion' ? result.cantidad : Math.max(0, result.total - result.cantidad);
  }

  getViewQuantity(row: ForecastOcupacionRow): number {
    return this.tipoVista === 'ocupacion'
      ? row.totalOcupada
      : Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupada);
  }

  getViewPercentage(row: ForecastOcupacionRow): number {
    if (this.tipoVista === 'ocupacion') {
      return row.porcentajeOcupacion;
    }

    const sellableRooms = Math.max(0, row.totalHabitaciones - row.bloqueadas);
    return sellableRooms > 0 ? (this.getViewQuantity(row) / sellableRooms) * 100 : 0;
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

  isCategoryUnavailable(row: ForecastOcupacionRow, codigo: string): boolean {
    if (this.tipoVista !== 'disponibilidad') {
      return false;
    }

    const result = this.getCategoryResult(row, codigo);
    return result.total > 0 && result.cantidad >= result.total;
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
      categorias: row.categorias ?? {}
    };
  }

  private buildKpis(rows: ForecastOcupacionRow[]): ForecastKpi[] {
    const viewPercentages = rows.map((row) => this.getViewPercentage(row));
    const average = viewPercentages.length ? viewPercentages.reduce((total, percentage) => total + percentage, 0) / viewPercentages.length : 0;
    const peak = rows.reduce<ForecastOcupacionRow | null>(
      (current, row) => (!current || this.getViewPercentage(row) > this.getViewPercentage(current) ? row : current),
      null
    );
    const adults = rows.reduce((total, row) => total + row.pax, 0);
    const children = rows.reduce((total, row) => total + row.totalCLL, 0);
    const availableRoomNights = rows.reduce((total, row) => total + Math.max(0, row.totalHabitaciones - row.bloqueadas - row.totalOcupada), 0);
    const occupiedRoomNights = rows.reduce((total, row) => total + row.totalOcupada, 0);
    const isOccupancyView = this.tipoVista === 'ocupacion';

    return [
      { titulo: isOccupancyView ? 'Ocupación Promedio' : 'Disponibilidad Promedio', valor: `${average.toFixed(1)}%`, subtitulo: 'En el período seleccionado', icono: 'insert_chart', color: '#2563eb' },
      { titulo: isOccupancyView ? 'Pico de Ocupación' : 'Pico de Disponibilidad', valor: `${(peak ? this.getViewPercentage(peak) : 0).toFixed(1)}%`, subtitulo: peak?.fecha ?? 'Sin datos', icono: 'trending_up', color: '#14b8a6' },
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
      const quantity = this.tipoVista === 'ocupacion' ? occupied : Math.max(0, totalRooms - occupied);
      const percentage = totalRooms > 0 ? (quantity / totalRooms) * 100 : 0;

      return {
        nombre: category.descripcion,
        codigo: category.codigo,
        porcentaje: percentage,
        color: colors[index % colors.length],
        valor: `${quantity} hab.`
      };
    });
  }

  private buildChartOptions(rows: ForecastOcupacionRow[]): Partial<ApexOptions> {
    const viewPercentages = rows.map((row) => this.getViewPercentage(row));
    const average = viewPercentages.length ? viewPercentages.reduce((total, percentage) => total + percentage, 0) / viewPercentages.length : 0;
    const viewLabel = this.tipoVista === 'ocupacion' ? 'Ocupación' : 'Disponibilidad';

    return {
      series: [
        {
          name: `% ${viewLabel}`,
          data: rows.map((row) => Number(this.getViewPercentage(row).toFixed(1)))
        }
      ],
      chart: {
        type: 'line',
        height: 360,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        parentHeightOffset: 0
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
        type: 'category',
        categories: rows.map((row) => this.formatChartDate(row.fecha)),
        tickPlacement: 'on',
        axisBorder: {
          show: true,
          color: '#d7dee9'
        },
        axisTicks: {
          show: true,
          color: '#d7dee9'
        },
        labels: {
          show: true,
          rotate: -45,
          rotateAlways: rows.length > 10,
          hideOverlappingLabels: false,
          trim: false,
          minHeight: 54,
          maxHeight: 72,
          style: {
            colors: '#64748b',
            fontSize: '11px',
            fontWeight: 600
          }
        }
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
              text: `${viewLabel} promedio ${average.toFixed(1)}%`
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
