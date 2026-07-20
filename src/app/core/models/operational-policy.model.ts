import { OperationalAction, OperationalStatus } from './operational-context.model';

export type OperationalDecisionCode = 'ALLOWED' | 'NOT_ALLOWED' | 'CONTEXT_LOADING' | 'CONTEXT_UNAVAILABLE';

export interface OperationalDecision {
  readonly allowed: boolean;
  readonly code: OperationalDecisionCode;
  readonly action: OperationalAction | string;
  readonly actionLabel: string;
  readonly status: OperationalStatus | string | null;
  readonly operationalDate: string;
  readonly calendarDate: string;
  readonly reason: string;
}

export interface OperationalRequirementOptions {
  /** Fuerza una consulta nueva antes de tomar la decisión. Úsese en escrituras críticas. */
  readonly refresh?: boolean;
  /** Muestra una explicación uniforme cuando la acción no está permitida. */
  readonly notify?: boolean;
}
