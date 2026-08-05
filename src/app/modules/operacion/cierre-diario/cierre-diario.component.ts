import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalContextService } from 'src/app/core/services/operational-context.service';
import { ToastService } from 'src/app/core/services/toast.service';
import {
  CierreDiarioValidacionDetalle,
  CierreDiarioValidacionResponse,
  EjecutarCierreDiarioResponse
} from './cierre-diario.model';
import { CierreDiarioService } from './cierre-diario.service';

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

interface ValidationCardDefinition {
  readonly title: string;
  readonly icon: string;
  readonly color: ValidationColor;
}

const VALIDATION_CARD_DEFINITIONS: Readonly<Record<string, ValidationCardDefinition>> = {
  CHK001: { title: 'Front Desk', icon: 'building', color: 'blue' },
  CHK002: { title: 'Restaurante', icon: 'cup-hot', color: 'orange' },
  CHK003: { title: 'Housekeeping', icon: 'brush', color: 'cyan' },
  CHK004: { title: 'Caja', icon: 'cash-stack', color: 'burgundy' },
  CHK005: { title: 'Reservas', icon: 'calendar-check', color: 'green' }
};

const INITIAL_VALIDATION_CARDS: readonly ValidationCard[] = Object.entries(VALIDATION_CARD_DEFINITIONS).map(([id, definition]) => ({
  id,
  ...definition,
  items: [{ level: 'warning', text: 'Pendiente de ejecutar el análisis del sistema.' }]
}));

@Component({
  selector: 'app-cierre-diario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cierre-diario.component.html',
  styleUrl: './cierre-diario.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CierreDiarioComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly operationalContextService = inject(OperationalContextService);
  private readonly cierreDiarioService = inject(CierreDiarioService);
  private readonly destroyRef = inject(DestroyRef);
  private closeExecutionLocked = false;

  readonly operationStatus = signal<OperationStatus>({
    title: 'Estado General del Sistema',
    progress: 0,
    description: 'Consultando la fecha operativa del sistema...',
    operationalDate: ''
  });

  readonly validationCards = signal<readonly ValidationCard[]>(INITIAL_VALIDATION_CARDS);
  readonly analysisPerformed = signal(false);
  readonly isLoadingOperationalDate = signal(true);
  readonly operationalDateError = signal(false);
  readonly isAnalyzing = signal(false);
  readonly isExecuting = signal(false);
  readonly isCloseCompleted = signal(false);
  readonly canExecuteClose = signal(false);
  readonly completedCloseOperator = signal('');

  private readonly analysisSummary = signal<AnalysisSummary>({
    errors: 0,
    warnings: 0,
    successes: 0,
    progress: 0
  });

  readonly summaryCards = computed<readonly SummaryCard[]>(() => {
    const summary = this.analysisSummary();
    return [
      { id: 'errors', label: 'Bloqueantes', value: `${summary.errors}`, icon: 'x-circle', level: 'error' },
      { id: 'warnings', label: 'Advertencias', value: `${summary.warnings}`, icon: 'exclamation-triangle', level: 'warning' },
      { id: 'successes', label: 'Correctos', value: `${summary.successes}`, icon: 'check-circle', level: 'success' },
      { id: 'status', label: 'Estado', value: `${summary.progress} %`, icon: 'speedometer2', level: 'primary' }
    ];
  });

  readonly pendingValidations = computed(() => !this.isCloseCompleted() && (!this.analysisPerformed() || !this.canExecuteClose()));
  readonly operationalCloseAllowed = computed(() => this.operationalContextService.isActionAllowed(OperationalAction.RunDailyClose));

  readonly statusLabel = computed(() => {
    if (this.isCloseCompleted()) return 'Cierre completado';
    if (this.isLoadingOperationalDate()) return 'Consultando fecha';
    if (this.operationalDateError()) return 'Fecha no disponible';
    if (this.isAnalyzing()) return 'Analizando sistema';
    if (!this.analysisPerformed()) return 'Pendiente de análisis';
    return this.canExecuteClose() ? 'Sistema listo' : 'Revisión requerida';
  });

  readonly closeHelpText = computed(() => {
    if (this.isCloseCompleted()) {
      const operator = this.completedCloseOperator();
      return `Cierre diario ejecutado correctamente${operator ? ` por ${operator}` : ''}.`;
    }
    if (this.isExecuting()) return 'Ejecutando el cierre diario. Espere a que el proceso finalice.';
    if (this.isLoadingOperationalDate()) return 'Consultando la fecha operativa del sistema.';
    if (this.operationalDateError()) return 'No se puede cerrar sin una fecha operativa válida.';
    if (!this.operationalCloseAllowed()) return 'El contexto operativo actual no permite ejecutar el cierre diario.';
    if (!this.analysisPerformed()) return 'Ejecute el análisis del sistema para habilitar esta acción.';
    if (!this.canExecuteClose()) return 'El cierre permanecerá bloqueado mientras existan validaciones pendientes.';
    return 'Todas las validaciones finalizaron correctamente. El cierre diario está habilitado.';
  });

  ngOnInit(): void {
    this.loadOperationalDate();
  }

  handleAnalyzeAction(): void {
    if (this.operationalDateError()) {
      this.loadOperationalDate();
      return;
    }
    this.analyzeSystem();
  }

  analyzeSystem(): void {
    if (
      this.isLoadingOperationalDate() ||
      this.operationalDateError() ||
      !this.operationStatus().operationalDate ||
      this.isAnalyzing() ||
      this.isExecuting() ||
      this.isCloseCompleted()
    ) {
      return;
    }

    this.isAnalyzing.set(true);
    this.analysisPerformed.set(false);
    this.canExecuteClose.set(false);
    this.operationStatus.update((status) => ({
      ...status,
      progress: 0,
      description: `Analizando la operación del ${status.operationalDate}...`
    }));

    this.cierreDiarioService
      .validar(this.operationStatus().operationalDate)
      .pipe(
        finalize(() => this.isAnalyzing.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => this.applyValidationResponse(response),
        error: (error: unknown) => this.handleValidationError(error)
      });
  }

  async executeDailyClose(): Promise<void> {
    if (
      this.closeExecutionLocked ||
      this.isLoadingOperationalDate() ||
      this.operationalDateError() ||
      !this.operationStatus().operationalDate ||
      !this.operationalCloseAllowed() ||
      !this.canExecuteClose() ||
      this.isExecuting() ||
      this.isCloseCompleted()
    ) {
      return;
    }

    const fecha = this.operationStatus().operationalDate.trim();
    const empresa = (this.operationalContextService.context()?.empresa ?? '').trim();
    const operador = (this.authService.getCurrentUser()?.usuario ?? '').toString().trim();

    if (!empresa) {
      await Swal.fire({
        title: 'Empresa requerida',
        text: 'No fue posible identificar la empresa del contexto operativo. Actualice la página antes de ejecutar el cierre.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (!operador) {
      await Swal.fire({
        title: 'Operador requerido',
        text: 'No fue posible identificar al usuario de la sesión. Inicie sesión nuevamente antes de ejecutar el cierre.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    this.closeExecutionLocked = true;
    this.isExecuting.set(true);
    const confirmation = await Swal.fire({
      title: '¿Ejecutar cierre diario?',
      text: `Se cerrará la fecha operativa ${fecha} de la empresa ${empresa} con el operador ${operador}. Esta operación no debe ejecutarse más de una vez.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, ejecutar cierre',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d4ed8',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      allowOutsideClick: false
    });

    if (!confirmation.isConfirmed) {
      this.closeExecutionLocked = false;
      this.isExecuting.set(false);
      return;
    }

    // El análisis vigente se consume al iniciar el cierre. Esto evita que el
    // mismo resultado al 100 % pueda habilitar una segunda ejecución.
    this.analysisPerformed.set(false);
    this.canExecuteClose.set(false);
    this.analysisSummary.set({ errors: 0, warnings: 0, successes: 0, progress: 0 });
    this.validationCards.set(INITIAL_VALIDATION_CARDS);
    this.operationStatus.update((status) => ({
      ...status,
      progress: 0,
      description: `Ejecutando el cierre diario del ${fecha}...`
    }));

    this.cierreDiarioService
      .ejecutar({ empresa, operador })
      .pipe(
        finalize(() => {
          this.closeExecutionLocked = false;
          this.isExecuting.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => void this.handleCloseSuccess(response),
        error: (error: unknown) => void this.handleCloseError(error)
      });
  }

  private applyValidationResponse(response: CierreDiarioValidacionResponse): void {
    const details = Array.isArray(response.data?.detalles) ? response.data.detalles : [];
    const progress = this.calculateProgress(details);
    const isValid =
      details.length > 0 &&
      response.success === true &&
      response.data?.resumen?.esValido === true &&
      response.data?.parametrosSalida?.esValido === true &&
      details.every((detail) => this.toNumber(detail.pendientes) === 0 || detail.bloqueaCierre !== true);

    this.validationCards.set(details.map((detail) => this.toValidationCard(detail)));
    this.analysisSummary.set(this.buildAnalysisSummary(details, progress));
    this.operationStatus.set({
      title: isValid ? 'Sistema listo para el cierre' : 'Estado General del Sistema',
      progress,
      description: response.message || response.data?.resumen?.mensaje || 'Análisis finalizado.',
      operationalDate: response.data?.resumen?.fechaValidada || this.operationStatus().operationalDate
    });
    this.analysisPerformed.set(true);
    this.canExecuteClose.set(isValid);

    if (isValid) {
      this.toast.success('Todas las validaciones finalizaron correctamente.', 5000, 'Sistema listo');
    } else {
      this.toast.warning(response.message || 'Existen pendientes que bloquean el cierre diario.', 6500, 'Revisión requerida');
    }
  }

  private loadOperationalDate(): void {
    this.isLoadingOperationalDate.set(true);
    this.operationalDateError.set(false);

    this.operationalContextService
      .ensureLoaded(this.operationalDateError())
      .pipe(
        finalize(() => this.isLoadingOperationalDate.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (context) => {
          this.operationStatus.set({
            title: 'Estado General del Sistema',
            progress: 0,
            description: context.message || 'Ejecute el análisis para validar si el sistema está listo para el cierre diario.',
            operationalDate: context.operationalDate
          });
        },
        error: (error: unknown) => {
          console.error('No se pudo consultar la fecha operativa del sistema.', error);
          this.handleOperationalDateError(this.getBackendErrorMessage(error) || 'No fue posible consultar la fecha operativa del sistema.');
        }
      });
  }

  private handleOperationalDateError(message: string): void {
    this.operationalDateError.set(true);
    this.canExecuteClose.set(false);
    this.operationStatus.set({
      title: 'Fecha operativa no disponible',
      progress: 0,
      description: message,
      operationalDate: ''
    });
    this.toast.blockingError(message, 6500, 'Fecha operativa');
  }

  private handleValidationError(error: unknown): void {
    console.error('No se pudo analizar el sistema para el cierre diario.', error);
    this.analysisPerformed.set(false);
    this.canExecuteClose.set(false);
    this.validationCards.set(INITIAL_VALIDATION_CARDS);
    this.analysisSummary.set({ errors: 0, warnings: 0, successes: 0, progress: 0 });
    this.operationStatus.update((status) => ({
      ...status,
      progress: 0,
      description: 'No fue posible completar el análisis. Verifique la conexión e intente nuevamente.'
    }));
    this.toast.blockingError('No fue posible consultar las validaciones del cierre diario.', 6000, 'Error de análisis');
  }

  private async handleCloseSuccess(response: EjecutarCierreDiarioResponse): Promise<void> {
    if (response.success !== true) {
      await this.handleCloseError(response);
      return;
    }

    const fechaAnterior = this.normalizeBackendDate(response.fechaAnterior) || this.operationStatus().operationalDate;
    const nuevaFechaOperativa = this.normalizeBackendDate(response.nuevaFechaOperativa) || fechaAnterior;
    const operador = response.operador?.trim() || (this.authService.getCurrentUser()?.usuario ?? '').toString().trim();
    this.isCloseCompleted.set(true);
    this.canExecuteClose.set(false);
    this.completedCloseOperator.set(operador);
    this.operationStatus.set({
      title: 'Cierre diario ejecutado',
      progress: 0,
      description: response.mensaje || 'Cierre diario ejecutado exitosamente.',
      operationalDate: nuevaFechaOperativa
    });
    this.toast.success(response.mensaje || 'Cierre diario ejecutado exitosamente.', 6000, 'Proceso completado');
    this.operationalContextService.refresh().subscribe({ error: () => undefined });

    const resultText = [
      response.mensaje || 'Cierre diario ejecutado exitosamente.',
      `Empresa: ${response.empresa || this.operationalContextService.context()?.empresa || '-'}`,
      `Fecha cerrada: ${fechaAnterior}`,
      `Nueva fecha operativa: ${nuevaFechaOperativa}`,
      `Operador: ${operador}`,
      response.fechaHoraCierre ? `Fecha y hora del cierre: ${response.fechaHoraCierre}` : ''
    ].filter(Boolean).join('\n');

    await Swal.fire({
      title: 'Cierre diario completado',
      text: resultText,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      allowOutsideClick: false
    });
  }

  private async handleCloseError(error: unknown): Promise<void> {
    console.error('No se pudo ejecutar el cierre diario.', error);
    const backendMessage = this.getBackendErrorMessage(error);
    this.operationStatus.update((status) => ({
      ...status,
      description: backendMessage || 'No fue posible ejecutar el cierre diario. El análisis continúa vigente.'
    }));
    this.toast.blockingError(backendMessage || 'No fue posible ejecutar el cierre diario.', 6500, 'Cierre no ejecutado');

    await Swal.fire({
      title: 'No se ejecutó el cierre',
      text: backendMessage || 'Ocurrió un error al ejecutar el cierre diario. Puede intentarlo nuevamente.',
      icon: 'error',
      confirmButtonText: 'Aceptar'
    });
  }

  private getBackendErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const candidate = error as { message?: unknown; mensaje?: unknown; error?: { message?: unknown; mensaje?: unknown } };
    const message = candidate.error?.mensaje ?? candidate.error?.message ?? candidate.mensaje ?? candidate.message;
    return typeof message === 'string' ? message.trim() : '';
  }

  private normalizeBackendDate(value: unknown): string {
    const text = (value ?? '').toString().trim();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return '';
    return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  }

  private toValidationCard(detail: CierreDiarioValidacionDetalle): ValidationCard {
    const code = (detail.codigo || '').trim().toUpperCase();
    const definition = VALIDATION_CARD_DEFINITIONS[code] || {
      title: detail.validacion || 'Validación operativa',
      icon: 'shield-check',
      color: 'purple' as ValidationColor
    };
    const pending = this.toNumber(detail.pendientes);
    const level: ValidationLevel = pending === 0 ? 'success' : detail.bloqueaCierre ? 'error' : 'warning';
    const text = pending === 0
      ? `${detail.validacion}: sin pendientes.`
      : `${detail.validacion}: ${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}.`;

    return {
      id: code || detail.validacion,
      ...definition,
      items: [{ level, text }]
    };
  }

  private buildAnalysisSummary(details: readonly CierreDiarioValidacionDetalle[], progress: number): AnalysisSummary {
    return details.reduce<AnalysisSummary>(
      (summary, detail) => {
        const pending = this.toNumber(detail.pendientes);
        return {
          errors: summary.errors + (pending > 0 && detail.bloqueaCierre ? pending : 0),
          warnings: summary.warnings + (pending > 0 && !detail.bloqueaCierre ? pending : 0),
          successes: summary.successes + (pending === 0 ? 1 : 0),
          progress
        };
      },
      { errors: 0, warnings: 0, successes: 0, progress }
    );
  }

  private calculateProgress(details: readonly CierreDiarioValidacionDetalle[]): number {
    if (!details.length) {
      return 0;
    }
    const successfulChecks = details.filter((detail) => this.toNumber(detail.pendientes) === 0).length;
    return Math.round((successfulChecks / details.length) * 100);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
