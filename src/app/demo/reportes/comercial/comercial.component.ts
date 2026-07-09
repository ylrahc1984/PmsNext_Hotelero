import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface CommercialKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  detail: string;
  trend: string;
  tone: 'positive' | 'warning' | 'neutral';
}

interface ChannelMix {
  name: string;
  revenue: number;
  nights: number;
  conversion: number;
}

interface SegmentPerformance {
  name: string;
  revenue: number;
  adr: number;
  share: number;
}

interface Opportunity {
  title: string;
  value: number;
  detail: string;
  priority: 'Alta' | 'Media';
}

interface DemandPoint {
  label: string;
  demand: number;
  pickup: number;
}

@Component({
  selector: 'app-reporte-comercial',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './comercial.component.html',
  styleUrls: ['./comercial.component.scss']
})
export class ComercialComponent {
  readonly todayDisplay = this.getTodayDisplayDate();
  readonly periodOptions = ['Hoy', 'Semana actual', 'Mes actual', 'Proximos 30 dias'];

  filters = {
    period: 'Proximos 30 dias',
    from: this.getTodayInputDate(),
    to: this.getInputDateDaysAhead(30)
  };

  readonly kpis: CommercialKpi[] = [
    {
      label: 'Produccion estimada',
      value: 48250,
      format: 'currency',
      detail: 'Reservas confirmadas y grupos probables',
      trend: '+12.6% vs periodo anterior',
      tone: 'positive'
    },
    {
      label: 'Noches vendidas',
      value: 418,
      format: 'number',
      detail: 'Habitaciones confirmadas en el periodo',
      trend: '76 noches nuevas esta semana',
      tone: 'neutral'
    },
    {
      label: 'Conversion comercial',
      value: 34.8,
      format: 'percent',
      detail: 'Cotizaciones convertidas a reserva',
      trend: '+4.2 pts vs objetivo',
      tone: 'positive'
    },
    {
      label: 'ADR cotizado',
      value: 116,
      format: 'currency',
      detail: 'Tarifa promedio de oportunidades abiertas',
      trend: 'Revisar descuentos OTA',
      tone: 'warning'
    }
  ];

  readonly channels: ChannelMix[] = [
    { name: 'Directo', revenue: 18600, nights: 146, conversion: 42 },
    { name: 'OTA', revenue: 14950, nights: 138, conversion: 31 },
    { name: 'Agencias', revenue: 9200, nights: 84, conversion: 28 },
    { name: 'Corporativo', revenue: 5500, nights: 50, conversion: 37 }
  ];

  readonly segments: SegmentPerformance[] = [
    { name: 'Leisure', revenue: 20350, adr: 121, share: 42 },
    { name: 'Corporativo', revenue: 11200, adr: 112, share: 23 },
    { name: 'Grupos', revenue: 9750, adr: 108, share: 20 },
    { name: 'Eventos', revenue: 6950, adr: 136, share: 15 }
  ];

  readonly opportunities: Opportunity[] = [
    {
      title: 'Grupo medico regional',
      value: 8400,
      detail: '28 noches, decision esperada esta semana',
      priority: 'Alta'
    },
    {
      title: 'Campana escapada fin de semana',
      value: 5200,
      detail: 'Impulsar directo en fechas de baja ocupacion',
      priority: 'Alta'
    },
    {
      title: 'Renovacion cuenta corporativa',
      value: 4100,
      detail: 'Mantener ADR minimo de $112',
      priority: 'Media'
    }
  ];

  readonly demandPoints: DemandPoint[] = [
    { label: 'Sem 1', demand: 68, pickup: 24 },
    { label: 'Sem 2', demand: 74, pickup: 31 },
    { label: 'Sem 3', demand: 59, pickup: 18 },
    { label: 'Sem 4', demand: 81, pickup: 36 }
  ];

  readonly recommendations = [
    'Proteger tarifa directa: es el canal con mejor conversion y mayor control de margen.',
    'Activar promocion limitada para la semana 3; la demanda cae frente al resto del periodo.',
    'Cerrar seguimiento del grupo medico antes del viernes para asegurar bloque de habitaciones.'
  ];

  get totalChannelRevenue(): number {
    return this.channels.reduce((sum, item) => sum + item.revenue, 0);
  }

  get totalNights(): number {
    return this.channels.reduce((sum, item) => sum + item.nights, 0);
  }

  get bestChannel(): ChannelMix {
    return this.channels.reduce((best, item) => (item.revenue > best.revenue ? item : best), this.channels[0]);
  }

  get maxDemandValue(): number {
    return Math.max(...this.demandPoints.flatMap((item) => [item.demand, item.pickup]));
  }

  getChannelPercent(value: number): number {
    return this.totalChannelRevenue ? Math.round((value / this.totalChannelRevenue) * 100) : 0;
  }

  getDemandHeight(value: number): number {
    return this.maxDemandValue ? Math.max(8, Math.round((value / this.maxDemandValue) * 100)) : 8;
  }

  trackByLabel(_: number, item: { label?: string; name?: string; title?: string }): string {
    return item.label || item.name || item.title || '';
  }

  formatValue(kpi: CommercialKpi): string {
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
      period: 'Proximos 30 dias',
      from: this.getTodayInputDate(),
      to: this.getInputDateDaysAhead(30)
    };
  }

  exportReport(): void {
    console.log('Exportar reporte comercial', this.filters);
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

  private getInputDateDaysAhead(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
