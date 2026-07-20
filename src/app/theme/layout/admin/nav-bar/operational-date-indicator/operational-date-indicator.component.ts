import { Component, OnInit, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { OperationalAction, OperationalContext, OperationalStatus } from 'src/app/core/models/operational-context.model';
import { OperationalContextService } from 'src/app/core/services/operational-context.service';

@Component({
  selector: 'app-operational-date-indicator',
  standalone: true,
  templateUrl: './operational-date-indicator.component.html',
  styleUrl: './operational-date-indicator.component.scss'
})
export class OperationalDateIndicatorComponent implements OnInit {
  private readonly operationalContextService = inject(OperationalContextService);
  private readonly router = inject(Router);

  readonly compact = input(false);
  readonly context = this.operationalContextService.context;
  readonly operationalDate = this.operationalContextService.operationalDate;
  readonly loading = this.operationalContextService.loading;
  readonly error = this.operationalContextService.error;
  readonly severity = this.operationalContextService.severity;

  ngOnInit(): void {
    this.loadDate();
  }

  retry(): void {
    this.loadDate(true);
  }

  viewDetails(): void {
    const context = this.context();
    if (context) void this.showContextDialog(context, false);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.viewDetails();
    }
  }

  private loadDate(force = false): void {
    this.operationalContextService.ensureLoaded(force).subscribe({
      next: (context) => void this.showContextDialog(context, true),
      error: () => undefined
    });
  }

  private async showContextDialog(context: OperationalContext, onlyIfPending: boolean): Promise<void> {
    if (onlyIfPending) {
      if (!this.operationalContextService.shouldNotify(context)) return;
      this.operationalContextService.markNotified(context);
    }

    const canOpenClose = this.operationalContextService.isActionAllowed(OperationalAction.RunDailyClose);
    const isNormal = context.status === OperationalStatus.Normal && context.differenceDays === 0;
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      title: this.dialogTitle(context),
      text: [
        context.message,
        `Fecha operativa: ${context.operationalDate}`,
        `Fecha calendario: ${context.calendarDate}`,
        context.propertyTimeZoneIana ? `Zona horaria: ${context.propertyTimeZoneIana}` : '',
        context.dailyCloseInProgress && context.closeStartedBy ? `Cierre iniciado por: ${context.closeStartedBy}` : ''
      ].filter(Boolean).join('\n'),
      icon: isNormal ? 'success' : context.dailyCloseInProgress ? 'info' : this.severity() === 'warning' ? 'warning' : 'error',
      confirmButtonText: canOpenClose && !isNormal ? 'Ir a Cierre Diario' : 'Entendido',
      showCancelButton: canOpenClose && !isNormal,
      cancelButtonText: 'Continuar trabajando',
      confirmButtonColor: '#1f6bff',
      cancelButtonColor: '#64748b',
      reverseButtons: true
    });

    if (result.isConfirmed && canOpenClose && !isNormal) {
      await this.router.navigate(['/operacion/cierre-diario']);
    }
  }

  private dialogTitle(context: OperationalContext): string {
    if (context.dailyCloseInProgress || context.status === OperationalStatus.CloseInProgress) return 'Cierre diario en proceso';
    if (context.status === OperationalStatus.Normal && context.differenceDays === 0) return 'Jornada operativa al día';
    if (context.status === OperationalStatus.NightTransition) return 'Transición de jornada';
    if (context.status === OperationalStatus.PendingClose) return 'Cierre diario pendiente';
    return 'Atención operativa requerida';
  }
}
