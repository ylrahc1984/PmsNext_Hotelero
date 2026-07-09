import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from 'src/app/theme/shared/shared.module';

interface OperationalKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  detail: string;
  trend: string;
  tone: 'positive' | 'warning' | 'neutral';
}

interface RoomStatus {
  label: string;
  value: number;
  detail: string;
  tone: 'available' | 'occupied' | 'warning' | 'blocked';
}

interface MovementItem {
  label: string;
  count: number;
  completed: number;
  detail: string;
}

interface WorkloadPoint {
  label: string;
  arrivals: number;
  departures: number;
}

interface OperationalFocus {
  title: string;
  detail: string;
  impact: string;
  tone: 'positive' | 'warning' | 'neutral';
}

@Component({
  selector: 'app-reservas-reporte',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss']
})
export class ReservasComponent {
  readonly todayDisplay = this.getTodayDisplayDate();
  readonly periodOptions = ['Hoy', 'Manana', 'Semana actual', 'Proximos 7 dias'];

  filters = {
    period: 'Hoy',
    from: this.getTodayInputDate(),
    to: this.getTodayInputDate()
  };

  readonly kpis: OperationalKpi[] = [
    {
      label: 'Ocupacion operativa',
      value: 78,
      format: 'percent',
      detail: 'Habitaciones ocupadas vs inventario disponible',
      trend: '+6 pts vs ayer',
      tone: 'positive'
    },
    {
      label: 'Llegadas pendientes',
      value: 9,
      format: 'number',
      detail: 'Check-ins por completar hoy',
      trend: '4 llegadas antes de las 15:00',
      tone: 'warning'
    },
    {
      label: 'Salidas pendientes',
      value: 5,
      format: 'number',
      detail: 'Check-outs por cerrar en front desk',
      trend: '2 cuentas con cargos abiertos',
      tone: 'neutral'
    },
    {
      label: 'Valor en riesgo',
      value: 1260,
      format: 'currency',
      detail: 'Habitaciones bloqueadas o fuera de servicio',
      trend: 'Requiere accion de mantenimiento',
      tone: 'warning'
    }
  ];

  readonly roomStatuses: RoomStatus[] = [
    { label: 'Disponibles', value: 18, detail: 'Listas para venta inmediata', tone: 'available' },
    { label: 'Ocupadas', value: 42, detail: 'Con huesped en casa', tone: 'occupied' },
    { label: 'Sucias', value: 11, detail: 'Pendientes de limpieza', tone: 'warning' },
    { label: 'Fuera de servicio', value: 3, detail: 'Impactan inventario vendible', tone: 'blocked' }
  ];

  readonly movements: MovementItem[] = [
    { label: 'Llegadas', count: 24, completed: 15, detail: 'Check-ins completados' },
    { label: 'Salidas', count: 19, completed: 14, detail: 'Check-outs cerrados' },
    { label: 'Stayovers', count: 37, completed: 25, detail: 'Habitaciones que permanecen' },
    { label: 'Cambios de habitacion', count: 4, completed: 2, detail: 'Movimientos coordinados' }
  ];

  readonly workloadPoints: WorkloadPoint[] = [
    { label: '08:00', arrivals: 2, departures: 7 },
    { label: '11:00', arrivals: 4, departures: 9 },
    { label: '14:00', arrivals: 8, departures: 3 },
    { label: '17:00', arrivals: 7, departures: 0 },
    { label: '20:00', arrivals: 3, departures: 0 }
  ];

  readonly focusItems: OperationalFocus[] = [
    {
      title: 'Housekeeping bajo presion',
      detail: '11 habitaciones sucias coinciden con llegadas tempranas.',
      impact: 'Priorizar salidas con llegada asignada',
      tone: 'warning'
    },
    {
      title: 'Mantenimiento afecta venta',
      detail: '3 habitaciones fuera de servicio reducen inventario disponible.',
      impact: this.formatCurrency(1260),
      tone: 'warning'
    },
    {
      title: 'Front desk estable',
      detail: 'La mayoria de salidas ya fue procesada antes del bloque fuerte de llegadas.',
      impact: 'Riesgo moderado',
      tone: 'positive'
    }
  ];

  readonly recommendations = [
    'Asignar prioridad de limpieza a habitaciones con llegada confirmada antes de las 15:00.',
    'Escalar mantenimiento de habitaciones fuera de servicio con impacto comercial directo.',
    'Revisar cuentas abiertas de salidas pendientes antes del cierre de turno.'
  ];

  get maxWorkloadValue(): number {
    return Math.max(...this.workloadPoints.flatMap((item) => [item.arrivals, item.departures]));
  }

  getMovementPercent(item: MovementItem): number {
    return item.count ? Math.round((item.completed / item.count) * 100) : 0;
  }

  getWorkloadHeight(value: number): number {
    return this.maxWorkloadValue ? Math.max(8, Math.round((value / this.maxWorkloadValue) * 100)) : 8;
  }

  trackByLabel(_: number, item: { label?: string; title?: string }): string {
    return item.label || item.title || '';
  }

  formatValue(kpi: OperationalKpi): string {
    if (kpi.format === 'percent') {
      return `${kpi.value.toFixed(0)}%`;
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
      period: 'Hoy',
      from: this.getTodayInputDate(),
      to: this.getTodayInputDate()
    };
  }

  exportReport(): void {
    console.log('Exportar reporte operativo hotelero', this.filters);
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
}
