import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { OperationalAction, OperationalContext } from '../models/operational-context.model';
import {
  OperationalDecision,
  OperationalRequirementOptions
} from '../models/operational-policy.model';
import { OperationalContextService } from './operational-context.service';

const ACTION_LABELS: Readonly<Record<string, string>> = {
  [OperationalAction.All]: 'realizar operaciones',
  [OperationalAction.View]: 'consultar información',
  [OperationalAction.CreateOperation]: 'crear una nueva operación',
  [OperationalAction.UpdateOperation]: 'modificar una operación',
  [OperationalAction.ResolvePendingCheckout]: 'resolver un check-out pendiente',
  [OperationalAction.CloseOpenTable]: 'cerrar una mesa abierta',
  [OperationalAction.RunDailyClose]: 'ejecutar el cierre diario'
};

@Injectable({ providedIn: 'root' })
export class OperationalPolicyService {
  private readonly operationalContext = inject(OperationalContextService);

  can(action: OperationalAction | string): boolean {
    return this.decision(action).allowed;
  }

  decision(action: OperationalAction | string): OperationalDecision {
    const normalizedAction = this.normalizeAction(action);
    const context = this.operationalContext.context();
    const actionLabel = this.actionLabel(normalizedAction);

    if (!context) {
      const loading = this.operationalContext.loading();
      return {
        allowed: false,
        code: loading ? 'CONTEXT_LOADING' : 'CONTEXT_UNAVAILABLE',
        action: normalizedAction,
        actionLabel,
        status: null,
        operationalDate: '',
        calendarDate: '',
        reason: loading
          ? 'Se está actualizando el contexto operativo. Espere un momento e intente nuevamente.'
          : this.operationalContext.error() || 'No se puede validar la operación porque el contexto operativo no está disponible.'
      };
    }

    return this.buildContextDecision(context, normalizedAction, actionLabel);
  }

  async require(
    action: OperationalAction | string,
    options: OperationalRequirementOptions = {}
  ): Promise<boolean> {
    const refresh = options.refresh === true;
    const notify = options.notify !== false;

    if (refresh) {
      try {
        await firstValueFrom(this.operationalContext.refresh());
      } catch {
        const unavailableDecision = this.decision(action);
        if (notify) await this.notifyDenied(unavailableDecision);
        return false;
      }
    } else if (!this.operationalContext.context() && !this.operationalContext.loading()) {
      try {
        await firstValueFrom(this.operationalContext.ensureLoaded());
      } catch {
        const unavailableDecision = this.decision(action);
        if (notify) await this.notifyDenied(unavailableDecision);
        return false;
      }
    }

    const decision = this.decision(action);
    if (!decision.allowed && notify) await this.notifyDenied(decision);
    return decision.allowed;
  }

  async notifyDenied(actionOrDecision: OperationalAction | string | OperationalDecision): Promise<void> {
    const decision = typeof actionOrDecision === 'object' ? actionOrDecision : this.decision(actionOrDecision);
    if (decision.allowed) return;

    const Swal = (await import('sweetalert2')).default;
    await Swal.fire({
      title: decision.code === 'CONTEXT_UNAVAILABLE' ? 'Contexto operativo no disponible' : 'Acción no permitida',
      text: decision.reason,
      icon: decision.code === 'CONTEXT_LOADING' ? 'info' : 'warning',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#1f6bff'
    });
  }

  actionLabel(action: OperationalAction | string): string {
    const normalizedAction = this.normalizeAction(action);
    return ACTION_LABELS[normalizedAction] || normalizedAction.toLowerCase().replace(/_/g, ' ');
  }

  private buildContextDecision(
    context: OperationalContext,
    action: string,
    actionLabel: string
  ): OperationalDecision {
    const allowed = this.operationalContext.isActionAllowed(action);
    return {
      allowed,
      code: allowed ? 'ALLOWED' : 'NOT_ALLOWED',
      action,
      actionLabel,
      status: context.status,
      operationalDate: context.operationalDate,
      calendarDate: context.calendarDate,
      reason: allowed
        ? `El contexto operativo permite ${actionLabel}.`
        : this.deniedReason(context, actionLabel)
    };
  }

  private deniedReason(context: OperationalContext, actionLabel: string): string {
    const contextMessage = context.message ? `${context.message} ` : '';
    return `${contextMessage}No está permitido ${actionLabel} mientras el sistema se encuentre en el estado ${context.status}. Fecha operativa: ${context.operationalDate}.`;
  }

  private normalizeAction(action: OperationalAction | string): string {
    return (action ?? '').toString().trim().toUpperCase();
  }
}
