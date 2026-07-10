import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToastService } from 'src/app/core/services/toast.service';

export type ValidationLevel = 'success' | 'warning' | 'error';
export type ValidationColor = 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'burgundy';

export interface OperationStatus {
  readonly title: string;
  readonly progress: number;
  readonly description: string;
  readonly operationalDate: string;
}

export interface ValidationItem {
  readonly level: ValidationLevel;
  readonly text: string;
}

export interface ValidationCard {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly color: ValidationColor;
  readonly items: readonly ValidationItem[];
}

export interface SummaryCard {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly level: ValidationLevel | 'primary';
}

interface AnalysisSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly successes: number;
  readonly progress: number;
}

@Component({
  selector: 'app-cierre-diario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cierre-diario.component.html',
  styleUrl: './cierre-diario.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CierreDiarioComponent {
  private readonly toast = inject(ToastService);

  readonly operationStatus = signal<OperationStatus>({
    title: 'Estado General del Sistema',
    progress: 82,
    description: 'Existen validaciones pendientes antes de ejecutar el cierre diario.',
    operationalDate: '10/07/2026'
  });

  readonly validationCards = signal<readonly ValidationCard[]>([
    {
      id: 'front-desk', title: 'Front Desk', icon: 'building', color: 'blue',
      items: [
        { level: 'error', text: 'Reserva con salida vencida.' },
        { level: 'success', text: 'Todos los Check-In fueron procesados.' },
        { level: 'warning', text: 'Dos habitaciones pendientes de limpieza.' }
      ]
    },
    {
      id: 'reservas', title: 'Reservas', icon: 'calendar-check', color: 'green',
      items: [
        { level: 'success', text: 'No existen sobreventas.' },
        { level: 'warning', text: 'Tres reservas pendientes de depósito.' }
      ]
    },
    {
      id: 'restaurante', title: 'Restaurante', icon: 'cup-hot', color: 'orange',
      items: [
        { level: 'success', text: 'No existen mesas abiertas.' },
        { level: 'success', text: 'Todos los consumos fueron registrados.' }
      ]
    },
    {
      id: 'facturacion', title: 'Facturación', icon: 'receipt', color: 'purple',
      items: [
        { level: 'success', text: 'Sin documentos pendientes.' },
        { level: 'success', text: 'Sin inconsistencias fiscales.' }
      ]
    },
    {
      id: 'housekeeping', title: 'Housekeeping', icon: 'brush', color: 'cyan',
      items: [
        { level: 'warning', text: 'Dos habitaciones sin limpiar.' },
        { level: 'success', text: 'Sin habitaciones bloqueadas.' }
      ]
    },
    {
      id: 'caja', title: 'Caja', icon: 'cash-stack', color: 'burgundy',
      items: [
        { level: 'success', text: 'Todas las cajas fueron cerradas.' },
        { level: 'success', text: 'No existen diferencias de efectivo.' }
      ]
    }
  ]);

  private readonly analysisSummary = signal<AnalysisSummary>({
    errors: 3,
    warnings: 5,
    successes: 18,
    progress: 82
  });

  readonly summaryCards = computed<readonly SummaryCard[]>(() => {
    const summary = this.analysisSummary();
    return [
      { id: 'errors', label: 'Errores', value: `${summary.errors}`, icon: 'x-circle', level: 'error' },
      { id: 'warnings', label: 'Advertencias', value: `${summary.warnings}`, icon: 'exclamation-triangle', level: 'warning' },
      { id: 'successes', label: 'Correctos', value: `${summary.successes}`, icon: 'check-circle', level: 'success' },
      { id: 'status', label: 'Estado', value: `${summary.progress} %`, icon: 'speedometer2', level: 'primary' }
    ];
  });

  readonly pendingValidations = computed(() =>
    this.validationCards().some((card) => card.items.some((item) => item.level !== 'success'))
  );

  analyzeSystem(): void {
    this.toast.info('Funcionalidad disponible en la siguiente etapa.', 5000, 'Analizar Sistema');
  }
}
