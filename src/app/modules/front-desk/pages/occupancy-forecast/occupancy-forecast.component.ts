import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SharedModule } from 'src/app/theme/shared/shared.module';

export interface OccupancyForecastRow {
  fecha: string;
  totalHabitaciones: number;
  bloqueadas: number;
  totalOcupadas: number;
  pax: number;
  totalChl: number;
  standardOcupadas: number;
  standardTotal: number;
  deluxeOcupadas: number;
  deluxeTotal: number;
  juniorOcupadas: number;
  juniorTotal: number;
  suiteOcupadas: number;
  suiteTotal: number;
  porcentajeOcupacion: number;
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
export class OccupancyForecastComponent {
  fechaInicial = '2026-06-16';
  fechaFinal = '2026-06-30';
  tipoVista: 'ocupacion' | 'disponibilidad' = 'ocupacion';
  busqueda = '';
  pageSize = 10;
  currentPage = 1;
  isLoading = false;

  readonly categorias = ['Standard', 'Junior Suite', 'Deluxe', 'Suite'];
  readonly categoriasSeleccionadas: Record<string, boolean> = {
    Standard: true,
    'Junior Suite': true,
    Deluxe: true,
    Suite: true
  };

  readonly kpis: ForecastKpi[] = [
    { title: 'Ocupacion Promedio', value: '42.5%', helper: 'En el periodo seleccionado', icon: 'analytics' },
    { title: 'Pico de Ocupacion', value: '78.2%', helper: '21 Jun 2026', icon: 'trending_up' },
    { title: 'Pax Totales', value: '174', helper: 'En el periodo seleccionado', icon: 'groups' },
    { title: 'Habitaciones Disponibles', value: '90', helper: 'Disponibles para venta', icon: 'hotel' },
    { title: 'Noches Proyectadas', value: '540', helper: 'Habitacion noche', icon: 'bedtime' }
  ];

  readonly pageSizes = [10, 20, 50, 100];
  readonly rows: OccupancyForecastRow[] = [
    this.row('16/06/2026', 120, 4, 51, 96, 138, 20, 48, 12, 28, 14, 30, 5, 14, 42.5),
    this.row('17/06/2026', 120, 4, 54, 101, 146, 22, 48, 13, 28, 14, 30, 5, 14, 45),
    this.row('18/06/2026', 120, 5, 58, 109, 156, 24, 48, 14, 28, 15, 30, 5, 14, 48.3),
    this.row('19/06/2026', 120, 5, 62, 118, 168, 26, 48, 15, 28, 15, 30, 6, 14, 51.7),
    this.row('20/06/2026', 120, 6, 74, 143, 205, 31, 48, 18, 28, 18, 30, 7, 14, 61.7),
    this.row('21/06/2026', 120, 6, 94, 174, 248, 38, 48, 23, 28, 24, 30, 9, 14, 78.2),
    this.row('22/06/2026', 120, 5, 86, 161, 231, 34, 48, 22, 28, 21, 30, 9, 14, 71.7),
    this.row('23/06/2026', 120, 4, 78, 149, 214, 31, 48, 20, 28, 19, 30, 8, 14, 65),
    this.row('24/06/2026', 120, 4, 70, 134, 193, 28, 48, 18, 28, 17, 30, 7, 14, 58.3),
    this.row('25/06/2026', 120, 3, 63, 121, 176, 25, 48, 16, 28, 16, 30, 6, 14, 52.5),
    this.row('26/06/2026', 120, 3, 59, 112, 162, 24, 48, 14, 28, 15, 30, 6, 14, 49.2),
    this.row('27/06/2026', 120, 4, 67, 128, 184, 27, 48, 17, 28, 17, 30, 6, 14, 55.8),
    this.row('28/06/2026', 120, 5, 88, 169, 240, 35, 48, 22, 28, 22, 30, 9, 14, 73.3),
    this.row('29/06/2026', 120, 5, 102, 188, 268, 40, 48, 26, 28, 26, 30, 10, 14, 85),
    this.row('30/06/2026', 120, 4, 43, 82, 119, 18, 48, 10, 28, 11, 30, 4, 14, 35.8)
  ];

  readonly actions: ForecastAction[] = [
    { label: 'Imprimir', icon: 'print', accent: 'primary' },
    { label: 'Exportar Excel', icon: 'file_download' }
  ];

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
    console.log('Procesar pronostico de ocupacion', {
      fechaInicial: this.fechaInicial,
      fechaFinal: this.fechaFinal,
      categorias: this.categoriasSeleccionadas,
      tipoVista: this.tipoVista
    });
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

  trackByLabel(_: number, item: { label?: string; title?: string }): string {
    return item.label ?? item.title ?? '';
  }

  private row(
    fecha: string,
    totalHabitaciones: number,
    bloqueadas: number,
    totalOcupadas: number,
    pax: number,
    totalChl: number,
    standardOcupadas: number,
    standardTotal: number,
    deluxeOcupadas: number,
    deluxeTotal: number,
    juniorOcupadas: number,
    juniorTotal: number,
    suiteOcupadas: number,
    suiteTotal: number,
    porcentajeOcupacion: number
  ): OccupancyForecastRow {
    return {
      fecha,
      totalHabitaciones,
      bloqueadas,
      totalOcupadas,
      pax,
      totalChl,
      standardOcupadas,
      standardTotal,
      deluxeOcupadas,
      deluxeTotal,
      juniorOcupadas,
      juniorTotal,
      suiteOcupadas,
      suiteTotal,
      porcentajeOcupacion
    };
  }
}
