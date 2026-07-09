import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface RestaurantKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  detail: string;
  trend: string;
  tone: 'positive' | 'warning' | 'neutral';
}

interface BestSeller {
  name: string;
  category: string;
  units: number;
  revenue: number;
  margin: number;
}

interface SalesArea {
  name: string;
  revenue: number;
  tickets: number;
  averageTicket: number;
}

interface ShiftPoint {
  label: string;
  revenue: number;
  tickets: number;
}

interface OperationalAlert {
  title: string;
  detail: string;
  tone: 'positive' | 'warning' | 'neutral';
}

@Component({
  selector: 'app-reporte-restaurante',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './restaurante.component.html',
  styleUrls: ['./restaurante.component.scss']
})
export class RestauranteReporteComponent {
  readonly todayDisplay = this.getTodayDisplayDate();
  readonly periodOptions = ['Hoy', 'Semana actual', 'Mes actual', 'Ultimos 30 dias'];

  filters = {
    period: 'Mes actual',
    from: this.getInputDateDaysAgo(30),
    to: this.getTodayInputDate()
  };

  readonly kpis: RestaurantKpi[] = [
    {
      label: 'Venta neta',
      value: 28640,
      format: 'currency',
      detail: 'Restaurante, bar y room service',
      trend: '+9.7% vs periodo anterior',
      tone: 'positive'
    },
    {
      label: 'Comandas',
      value: 842,
      format: 'number',
      detail: 'Ordenes atendidas en el periodo',
      trend: '156 comandas en fin de semana',
      tone: 'neutral'
    },
    {
      label: 'Ticket promedio',
      value: 34,
      format: 'currency',
      detail: 'Promedio por comanda cerrada',
      trend: '+$3 vs objetivo',
      tone: 'positive'
    },
    {
      label: 'Anulaciones',
      value: 2.8,
      format: 'percent',
      detail: 'Notas anuladas o corregidas',
      trend: 'Revisar turno noche',
      tone: 'warning'
    }
  ];

  readonly bestSellers: BestSeller[] = [
    { name: 'Casado de lomito', category: 'Platos fuertes', units: 128, revenue: 2816, margin: 64 },
    { name: 'Ceviche tropical', category: 'Entradas', units: 96, revenue: 1344, margin: 58 },
    { name: 'Hamburguesa artesanal', category: 'Platos fuertes', units: 84, revenue: 1428, margin: 52 },
    { name: 'Margarita maracuya', category: 'Bebidas', units: 78, revenue: 936, margin: 71 },
    { name: 'Tres leches', category: 'Postres', units: 66, revenue: 528, margin: 69 }
  ];

  readonly salesAreas: SalesArea[] = [
    { name: 'Restaurante principal', revenue: 13980, tickets: 392, averageTicket: 36 },
    { name: 'Bar piscina', revenue: 7420, tickets: 246, averageTicket: 30 },
    { name: 'Room service', revenue: 4260, tickets: 124, averageTicket: 34 },
    { name: 'Eventos', revenue: 2980, tickets: 80, averageTicket: 37 }
  ];

  readonly shiftPoints: ShiftPoint[] = [
    { label: 'Desayuno', revenue: 6120, tickets: 238 },
    { label: 'Almuerzo', revenue: 8740, tickets: 276 },
    { label: 'Cena', revenue: 10480, tickets: 244 },
    { label: 'Bar', revenue: 3300, tickets: 84 }
  ];

  readonly alerts: OperationalAlert[] = [
    {
      title: 'Mayor margen en bebidas',
      detail: 'Margarita maracuya mantiene 71% de margen y buen volumen.',
      tone: 'positive'
    },
    {
      title: 'Controlar anulaciones',
      detail: 'La anulacion se concentra en turno noche; conviene revisar autorizaciones.',
      tone: 'warning'
    },
    {
      title: 'Impulsar room service',
      detail: 'Ticket sano con baja participacion; oportunidad en habitaciones ocupadas.',
      tone: 'neutral'
    }
  ];

  readonly recommendations = [
    'Mantener visibles los platos de mayor margen en el POS y cartas digitales.',
    'Crear combo de cena con bebida premium para elevar ticket promedio sin saturar cocina.',
    'Revisar inventario de lomito y maracuya antes del fin de semana por alta rotacion.'
  ];

  get totalRevenue(): number {
    return this.salesAreas.reduce((sum, item) => sum + item.revenue, 0);
  }

  get totalTickets(): number {
    return this.salesAreas.reduce((sum, item) => sum + item.tickets, 0);
  }

  get topSeller(): BestSeller {
    return this.bestSellers.reduce((top, item) => (item.revenue > top.revenue ? item : top), this.bestSellers[0]);
  }

  get maxShiftValue(): number {
    return Math.max(...this.shiftPoints.flatMap((item) => [item.revenue, item.tickets]));
  }

  getAreaPercent(value: number): number {
    return this.totalRevenue ? Math.round((value / this.totalRevenue) * 100) : 0;
  }

  getShiftHeight(value: number, type: 'revenue' | 'tickets'): number {
    const max = type === 'revenue' ? Math.max(...this.shiftPoints.map((item) => item.revenue)) : Math.max(...this.shiftPoints.map((item) => item.tickets));
    return max ? Math.max(8, Math.round((value / max) * 100)) : 8;
  }

  trackByLabel(_: number, item: { label?: string; name?: string; title?: string }): string {
    return item.label || item.name || item.title || '';
  }

  formatValue(kpi: RestaurantKpi): string {
    if (kpi.format === 'percent') {
      return `${kpi.value.toFixed(1)}%`;
    }

    if (kpi.format === 'number') {
      return kpi.value.toLocaleString('es-CR');
    }

    return this.formatCurrency(kpi.value);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }

  resetFilters(): void {
    this.filters = {
      period: 'Mes actual',
      from: this.getInputDateDaysAgo(30),
      to: this.getTodayInputDate()
    };
  }

  exportReport(): void {
    console.log('Exportar reporte restaurante', this.filters);
  }

  printReport(): void {
    window.print();
  }

  private getTodayDisplayDate(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${now.getFullYear()}`;
  }

  private getTodayInputDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  private getInputDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
