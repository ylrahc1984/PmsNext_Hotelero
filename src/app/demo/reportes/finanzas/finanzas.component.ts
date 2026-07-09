import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface FinancialKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  detail: string;
  trend: string;
  tone: 'positive' | 'warning' | 'neutral';
}

interface RevenueCenter {
  name: string;
  amount: number;
  budget: number;
  margin: number;
}

interface CashItem {
  label: string;
  amount: number;
  detail: string;
}

interface ReceivableBucket {
  label: string;
  amount: number;
  percent: number;
}

interface MonthlyPoint {
  month: string;
  revenue: number;
  expenses: number;
}

@Component({
  selector: 'app-reporte-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './finanzas.component.html',
  styleUrls: ['./finanzas.component.scss']
})
export class FinanzasComponent {
  private readonly crcToUsdRate = 520;

  readonly todayDisplay = this.getTodayDisplayDate();
  readonly periodOptions = ['Hoy', 'Semana actual', 'Mes actual', 'Ultimos 30 dias'];

  filters = {
    period: 'Mes actual',
    from: this.getInputDateDaysAgo(30),
    to: this.getTodayInputDate()
  };

  readonly kpis: FinancialKpi[] = [
    {
      label: 'Ingreso neto',
      value: 18450000,
      format: 'currency',
      detail: 'Habitaciones, restaurante y cargos directos',
      trend: '+8.4% vs periodo anterior',
      tone: 'positive'
    },
    {
      label: 'ADR',
      value: 78200,
      format: 'currency',
      detail: 'Tarifa diaria promedio',
      trend: '+3.1% vs objetivo',
      tone: 'positive'
    },
    {
      label: 'RevPAR',
      value: 56300,
      format: 'currency',
      detail: 'Ingreso por habitacion disponible',
      trend: '72% ocupacion promedio',
      tone: 'neutral'
    },
    {
      label: 'CxC vencida',
      value: 2450000,
      format: 'currency',
      detail: 'Cartera sobre 30 dias',
      trend: '13.2% del total facturado',
      tone: 'warning'
    }
  ];

  readonly revenueCenters: RevenueCenter[] = [
    { name: 'Habitaciones', amount: 11850000, budget: 11200000, margin: 66 },
    { name: 'Restaurante', amount: 3820000, budget: 3600000, margin: 38 },
    { name: 'Eventos y salones', amount: 1450000, budget: 1800000, margin: 44 },
    { name: 'Otros cargos', amount: 1330000, budget: 1100000, margin: 52 }
  ];

  readonly cashItems: CashItem[] = [
    { label: 'Cobros recibidos', amount: 9250000, detail: 'Depositos, efectivo y tarjetas' },
    { label: 'Pagos programados', amount: 4120000, detail: 'Proveedores y servicios' },
    { label: 'Balance operativo', amount: 5130000, detail: 'Disponible antes de impuestos' }
  ];

  readonly receivableBuckets: ReceivableBucket[] = [
    { label: '0-15 dias', amount: 6200000, percent: 58 },
    { label: '16-30 dias', amount: 1980000, percent: 19 },
    { label: '31-60 dias', amount: 1460000, percent: 14 },
    { label: '61+ dias', amount: 990000, percent: 9 }
  ];

  readonly monthlyPoints: MonthlyPoint[] = [
    { month: 'Feb', revenue: 14200000, expenses: 9200000 },
    { month: 'Mar', revenue: 15600000, expenses: 9750000 },
    { month: 'Abr', revenue: 14900000, expenses: 10100000 },
    { month: 'May', revenue: 17100000, expenses: 10600000 },
    { month: 'Jun', revenue: 18450000, expenses: 11200000 }
  ];

  readonly decisions = [
    'Priorizar cobro de agencias con saldos mayores a 30 dias antes del cierre semanal.',
    'Revisar paquetes de eventos: el ingreso esta 19% bajo presupuesto aunque mantiene margen saludable.',
    'Mantener tarifa promedio de habitaciones; ADR y RevPAR estan sobre objetivo del periodo.'
  ];

  get totalRevenue(): number {
    return this.revenueCenters.reduce((sum, item) => sum + item.amount, 0);
  }

  get totalBudget(): number {
    return this.revenueCenters.reduce((sum, item) => sum + item.budget, 0);
  }

  get budgetVariance(): number {
    return this.totalRevenue - this.totalBudget;
  }

  get totalReceivables(): number {
    return this.receivableBuckets.reduce((sum, item) => sum + item.amount, 0);
  }

  get maxMonthlyValue(): number {
    return Math.max(...this.monthlyPoints.flatMap((item) => [item.revenue, item.expenses]));
  }

  getCenterPercent(value: number): number {
    return this.totalRevenue ? Math.round((value / this.totalRevenue) * 100) : 0;
  }

  getMonthlyHeight(value: number): number {
    return this.maxMonthlyValue ? Math.max(8, Math.round((value / this.maxMonthlyValue) * 100)) : 8;
  }

  trackByLabel(_: number, item: { label?: string; name?: string; month?: string }): string {
    return item.label || item.name || item.month || '';
  }

  formatValue(kpi: FinancialKpi): string {
    if (kpi.format === 'percent') {
      return `${kpi.value.toFixed(1)}%`;
    }

    if (kpi.format === 'number') {
      return kpi.value.toLocaleString();
    }

    return this.formatCurrency(kpi.value);
  }

  formatCurrency(value: number): string {
    const converted = value / this.crcToUsdRate;

    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(converted);
  }

  resetFilters(): void {
    this.filters = {
      period: 'Mes actual',
      from: this.getInputDateDaysAgo(30),
      to: this.getTodayInputDate()
    };
  }

  exportReport(): void {
    console.log('Exportar reporte financiero', this.filters);
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
