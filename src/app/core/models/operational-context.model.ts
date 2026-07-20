export enum OperationalStatus {
  Normal = 'OPERACION_NORMAL',
  NightTransition = 'TRANSICION_NOCTURNA',
  PendingClose = 'CIERRE_PENDIENTE',
  CriticalLag = 'DESFASE_CRITICO',
  FutureDate = 'FECHA_FUTURA',
  DateUnavailable = 'FECHA_NO_DISPONIBLE',
  CloseInProgress = 'CIERRE_EN_PROCESO',
  Unknown = 'DESCONOCIDO'
}

export enum OperationalAction {
  All = 'ALL',
  View = 'VIEW',
  CreateOperation = 'CREATE_OPERATION',
  UpdateOperation = 'UPDATE_OPERATION',
  ResolvePendingCheckout = 'RESOLVE_PENDING_CHECKOUT',
  CloseOpenTable = 'CLOSE_OPEN_TABLE',
  RunDailyClose = 'RUN_DAILY_CLOSE'
}

export type OperationalSeverity = 'normal' | 'warning' | 'danger' | 'progress' | 'unavailable';

export interface OperationalContextResponse {
  success: boolean;
  empresa: string;
  propertyTimeZoneWindows: string;
  propertyTimeZoneIana: string;
  serverDateTime: string;
  calendarDate: string;
  operationalDate: string;
  differenceDays: number;
  statusCode: number;
  status: string;
  dailyCloseInProgress: boolean;
  closeHour: string;
  toleranceMinutes: number;
  message: string;
  allowedActions: string | readonly string[];
  lastSuccessfulClose: string | null;
  closeStartedAt: string | null;
  closeStartedBy: string;
}

export interface OperationalContext {
  readonly success: true;
  readonly empresa: string;
  readonly propertyTimeZoneWindows: string;
  readonly propertyTimeZoneIana: string;
  readonly serverDateTime: string;
  readonly calendarDate: string;
  readonly operationalDate: string;
  readonly differenceDays: number;
  readonly statusCode: number;
  readonly status: OperationalStatus | string;
  readonly dailyCloseInProgress: boolean;
  readonly closeHour: string;
  readonly toleranceMinutes: number;
  readonly message: string;
  readonly allowedActions: ReadonlySet<string>;
  readonly lastSuccessfulClose: string | null;
  readonly closeStartedAt: string | null;
  readonly closeStartedBy: string;
}
