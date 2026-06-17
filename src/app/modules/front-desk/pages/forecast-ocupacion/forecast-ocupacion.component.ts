import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface ForecastOcupacionRow {
  fecha: string;
  totalHabitaciones: number;
  bloqueadas: number;
  totalOcupada: number;
  porcentajeOcupacion: number;
  pax: number;
  totalCLL: number;
  standard: number;
  deluxe: number;
  juniorSuite: number;
  suite: number;
  porOcupacion: number;
}

interface ForecastCategoria {
  nombre: string;
  porcentaje: number;
  color: string;
  valor: string;
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
export class ForecastOcupacionComponent {
  hotel = 'Hotel Demo';
  fechaInicial = '2026-06-16';
  fechaFinal = '2026-06-30';
  tipoVista: 'ocupacion' | 'disponibilidad' = 'ocupacion';
  busqueda = '';
  pageSize = 10;
  currentPage = 1;
  isLoading = false;

  readonly categoriasSeleccionadas: Record<string, boolean> = {
    Standard: true,
    'Junior Suite': true,
    Deluxe: true,
    Suite: true
  };

  readonly hoteles = ['Hotel Demo'];
  readonly categorias = ['Standard', 'Junior Suite', 'Deluxe', 'Suite'];
  readonly pageSizes = [10, 20, 50, 100];

  readonly kpis: ForecastKpi[] = [
    { titulo: 'Ocupación Promedio', valor: '42.5%', subtitulo: 'En el período seleccionado', icono: 'analytics', color: '#2563eb' },
    { titulo: 'Pico de Ocupación', valor: '78.2%', subtitulo: '21 Jun 2026', icono: 'trending_up', color: '#14b8a6' },
    { titulo: 'Pax Totales', valor: 174, subtitulo: 'En el período seleccionado', icono: 'groups', color: '#9333ea' },
    { titulo: 'Total Habitaciones', valor: 90, subtitulo: 'Disponibles para venta', icono: 'hotel', color: '#0f3b68' },
    { titulo: 'Total Noches', valor: 540, subtitulo: 'Habitación noche', icono: 'bedtime', color: '#f59e0b' }
  ];

  readonly resumenCategorias: ForecastCategoria[] = [
    { nombre: 'Standard', porcentaje: 34.2, color: '#14b8a6', valor: '31 hab.' },
    { nombre: 'Junior Suite', porcentaje: 28.7, color: '#2563eb', valor: '18 hab.' },
    { nombre: 'Deluxe', porcentaje: 62.1, color: '#9333ea', valor: '27 hab.' },
    { nombre: 'Suite', porcentaje: 45.0, color: '#f59e0b', valor: '14 hab.' }
  ];

  readonly rows: ForecastOcupacionRow[] = [
    this.row('16/06/2026', 90, 2, 1, 1.5, 3, 2, 1, 0, 0, 0, 1.5),
    this.row('17/06/2026', 90, 2, 3, 3.1, 7, 4, 2, 0, 1, 0, 3.1),
    this.row('18/06/2026', 90, 2, 3, 3.1, 8, 4, 1, 1, 1, 0, 3.1),
    this.row('19/06/2026', 90, 3, 4, 4.8, 11, 7, 2, 1, 1, 0, 4.8),
    this.row('20/06/2026', 90, 3, 4, 4.8, 12, 7, 2, 1, 1, 0, 4.8),
    this.row('21/06/2026', 90, 5, 70, 78.2, 174, 128, 28, 20, 15, 7, 78.2),
    this.row('22/06/2026', 90, 4, 50, 55.6, 121, 91, 22, 13, 10, 5, 55.6),
    this.row('23/06/2026', 90, 3, 24, 26.3, 58, 42, 11, 6, 5, 2, 26.3),
    this.row('24/06/2026', 90, 3, 17, 18.5, 39, 30, 8, 4, 4, 1, 18.5),
    this.row('25/06/2026', 90, 2, 22, 24.1, 52, 38, 10, 5, 5, 2, 24.1),
    this.row('26/06/2026', 90, 2, 29, 32.5, 69, 51, 13, 8, 6, 2, 32.5),
    this.row('27/06/2026', 90, 3, 37, 41.2, 86, 64, 16, 10, 8, 3, 41.2),
    this.row('28/06/2026', 90, 3, 35, 38.7, 82, 59, 15, 9, 8, 3, 38.7),
    this.row('29/06/2026', 90, 2, 26, 28.6, 61, 44, 12, 7, 5, 2, 28.6),
    this.row('30/06/2026', 90, 2, 16, 17.6, 37, 27, 7, 4, 4, 1, 17.6)
  ];

  readonly chartOptions: Partial<ApexOptions> = {
    series: [
      {
        name: '% Ocupación',
        data: [1.5, 3.1, 3.1, 4.8, 4.8, 78.2, 55.6, 26.3, 18.5, 24.1, 32.5, 41.2, 38.7, 28.6, 17.6]
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
      categories: ['16 Jun', '17 Jun', '18 Jun', '19 Jun', '20 Jun', '21 Jun', '22 Jun', '23 Jun', '24 Jun', '25 Jun', '26 Jun', '27 Jun', '28 Jun', '29 Jun', '30 Jun'],
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
          y: 42.5,
          borderColor: '#14b8a6',
          strokeDashArray: 5,
          label: {
            borderColor: '#14b8a6',
            style: { color: '#ffffff', background: '#14b8a6' },
            text: 'Promedio 42.5%'
          }
        }
      ]
    },
    dataLabels: { enabled: false }
  };

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

  procesar(): void {
    this.currentPage = 1;
    console.log('Procesar forecast de ocupación', {
      hotel: this.hotel,
      fechaInicial: this.fechaInicial,
      fechaFinal: this.fechaFinal,
      categorias: this.categoriasSeleccionadas,
      tipoVista: this.tipoVista
    });
  }

  imprimir(): void {
    console.log('Imprimir forecast de ocupación');
  }

  exportarExcel(): void {
    console.log('Exportar Excel forecast de ocupación');
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

  trackByFecha(_: number, row: ForecastOcupacionRow): string {
    return row.fecha;
  }

  trackByTitulo(_: number, item: ForecastKpi): string {
    return item.titulo;
  }

  trackByCategoria(_: number, item: ForecastCategoria): string {
    return item.nombre;
  }

  private row(
    fecha: string,
    totalHabitaciones: number,
    bloqueadas: number,
    totalOcupada: number,
    porcentajeOcupacion: number,
    pax: number,
    totalCLL: number,
    standard: number,
    deluxe: number,
    juniorSuite: number,
    suite: number,
    porOcupacion: number
  ): ForecastOcupacionRow {
    return {
      fecha,
      totalHabitaciones,
      bloqueadas,
      totalOcupada,
      porcentajeOcupacion,
      pax,
      totalCLL,
      standard,
      deluxe,
      juniorSuite,
      suite,
      porOcupacion
    };
  }
}
