import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, filter, finalize, map, of, shareReplay, switchMap, take, tap, throwError } from 'rxjs';

import {
  OperationalAction,
  OperationalContext,
  OperationalContextResponse,
  OperationalSeverity,
  OperationalStatus
} from '../models/operational-context.model';
import { environment } from 'src/environments/environment';
import { EmpresaContextService } from './empresa-context.service';

@Injectable({ providedIn: 'root' })
export class OperationalContextService {
  private readonly http = inject(HttpClient);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly endpoint = `${(environment.apiUrl ?? '').toString().replace(/\/+$/, '')}/estado-operativo`;
  private readonly empresa$ = toObservable(this.empresaContext.empresa);

  private readonly contextState = signal<OperationalContext | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');
  private activeRequest?: Observable<OperationalContext>;
  private activeRequestId = 0;
  private activeEmpresa = '';
  private hasStarted = false;

  readonly context = this.contextState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly operationalDate = computed(() => this.contextState()?.operationalDate ?? '');
  readonly calendarDate = computed(() => this.contextState()?.calendarDate ?? '');
  readonly status = computed(() => this.contextState()?.status ?? OperationalStatus.DateUnavailable);
  readonly requiresAttention = computed(() => {
    const context = this.contextState();
    return !!context && (context.status !== OperationalStatus.Normal || context.differenceDays !== 0 || context.dailyCloseInProgress);
  });
  readonly severity = computed<OperationalSeverity>(() => this.resolveSeverity(this.contextState()));

  constructor() {
    effect(() => {
      const empresa = this.normalizeEmpresa(this.empresaContext.empresa()?.MA04_Unidad);
      if (empresa === this.activeEmpresa) return;

      const previousEmpresa = this.activeEmpresa;
      this.activeEmpresa = empresa;
      if (previousEmpresa) {
        this.clearState();
      }

      if (empresa && previousEmpresa && this.hasStarted) {
        this.ensureLoaded(true).subscribe({ error: () => undefined });
      }
    });
  }

  ensureLoaded(force = false): Observable<OperationalContext> {
    this.hasStarted = true;
    const snapshot = this.contextState();
    const empresa = this.normalizeEmpresa(this.empresaContext.getSnapshot()?.MA04_Unidad);

    if (!force && snapshot && (!empresa || snapshot.empresa === empresa)) {
      return of(snapshot);
    }
    if (!force && this.activeRequest) {
      return this.activeRequest;
    }

    const requestId = ++this.activeRequestId;
    this.loadingState.set(true);
    this.errorState.set('');
    if (force) this.contextState.set(null);

    const request = this.resolveEmpresa().pipe(
      switchMap((empresaCode) => this.http.get<OperationalContextResponse>(`${this.endpoint}/${encodeURIComponent(empresaCode)}`)),
      map((response) => this.normalizeResponse(response)),
      tap((context) => {
        const currentEmpresa = this.normalizeEmpresa(this.empresaContext.getSnapshot()?.MA04_Unidad);
        if (!currentEmpresa || currentEmpresa === context.empresa) {
          this.contextState.set(context);
          this.activeEmpresa = context.empresa;
        }
      }),
      catchError((error: unknown) => {
        if (requestId === this.activeRequestId) {
          this.contextState.set(null);
          this.errorState.set(this.getErrorMessage(error));
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestId === this.activeRequestId) {
          this.loadingState.set(false);
          this.activeRequest = undefined;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.activeRequest = request;
    return request;
  }

  refresh(): Observable<OperationalContext> {
    return this.ensureLoaded(true);
  }

  isActionAllowed(action: OperationalAction | string): boolean {
    const context = this.contextState();
    if (!context) return false;

    const normalizedAction = action.toString().trim().toUpperCase();
    return context.allowedActions.has(OperationalAction.All) || context.allowedActions.has('*') || context.allowedActions.has(normalizedAction);
  }

  notificationKey(context: OperationalContext): string {
    return `operational-context:${context.empresa}:${context.status}:${context.operationalDate}:${context.calendarDate}`;
  }

  shouldNotify(context: OperationalContext): boolean {
    return this.resolveSeverity(context) !== 'normal' && sessionStorage.getItem(this.notificationKey(context)) !== 'acknowledged';
  }

  markNotified(context: OperationalContext): void {
    sessionStorage.setItem(this.notificationKey(context), 'acknowledged');
  }

  private resolveEmpresa(): Observable<string> {
    const snapshot = this.normalizeEmpresa(this.empresaContext.getSnapshot()?.MA04_Unidad);
    if (snapshot) return of(snapshot);

    return this.empresa$.pipe(
      map((empresa) => this.normalizeEmpresa(empresa?.MA04_Unidad)),
      filter((empresa): empresa is string => !!empresa),
      take(1)
    );
  }

  private normalizeResponse(response: OperationalContextResponse): OperationalContext {
    const empresa = this.normalizeEmpresa(response?.empresa);
    const operationalDate = this.normalizeDate(response?.operationalDate);
    const calendarDate = this.normalizeDate(response?.calendarDate);
    if (response?.success !== true || !empresa || !operationalDate || !calendarDate) {
      throw new Error(response?.message || 'El contexto operativo recibido no es válido.');
    }

    const allowedActions = this.parseAllowedActions(response.allowedActions);
    const statusCode = this.toFiniteNumber(response.statusCode);
    const differenceDays = this.toFiniteNumber(response.differenceDays);
    const status = this.normalizeStatus(response.status, statusCode, differenceDays, response.dailyCloseInProgress === true);

    return {
      success: true,
      empresa,
      propertyTimeZoneWindows: (response.propertyTimeZoneWindows ?? '').toString().trim(),
      propertyTimeZoneIana: (response.propertyTimeZoneIana ?? '').toString().trim(),
      serverDateTime: (response.serverDateTime ?? '').toString().trim(),
      calendarDate,
      operationalDate,
      differenceDays,
      statusCode,
      status,
      dailyCloseInProgress: response.dailyCloseInProgress === true,
      closeHour: (response.closeHour ?? '').toString().trim(),
      toleranceMinutes: Math.max(0, this.toFiniteNumber(response.toleranceMinutes)),
      message: (response.message ?? '').toString().trim(),
      allowedActions,
      lastSuccessfulClose: this.normalizeOptionalText(response.lastSuccessfulClose),
      closeStartedAt: this.normalizeOptionalText(response.closeStartedAt),
      closeStartedBy: (response.closeStartedBy ?? '').toString().trim()
    };
  }

  private parseAllowedActions(value: string | readonly string[] | null | undefined): ReadonlySet<string> {
    const values = Array.isArray(value) ? value : (value ?? '').toString().split(',');
    return new Set(values.map((action) => action.toString().trim().toUpperCase()).filter(Boolean));
  }

  private normalizeStatus(value: unknown, statusCode: number, differenceDays: number, closeInProgress: boolean): OperationalStatus | string {
    if (closeInProgress) return OperationalStatus.CloseInProgress;

    const rawStatus = (value ?? '').toString().trim().toUpperCase();
    const aliases: Readonly<Record<string, OperationalStatus>> = {
      NORMAL: OperationalStatus.Normal,
      OPERACION_NORMAL: OperationalStatus.Normal,
      TRANSICION_NOCTURNA: OperationalStatus.NightTransition,
      CIERRE_PENDIENTE: OperationalStatus.PendingClose,
      DESFASE_CRITICO: OperationalStatus.CriticalLag,
      FECHA_FUTURA: OperationalStatus.FutureDate,
      FECHA_NO_DISPONIBLE: OperationalStatus.DateUnavailable,
      CIERRE_EN_PROCESO: OperationalStatus.CloseInProgress
    };

    if (aliases[rawStatus]) return aliases[rawStatus];
    const statusByCode: Readonly<Record<number, OperationalStatus>> = {
      1: OperationalStatus.Normal,
      2: OperationalStatus.NightTransition,
      3: OperationalStatus.PendingClose,
      4: OperationalStatus.CloseInProgress
    };
    if (statusByCode[statusCode]) {
      if (statusCode !== 1 || differenceDays === 0) return statusByCode[statusCode];
    }
    return rawStatus || OperationalStatus.Unknown;
  }

  private resolveSeverity(context: OperationalContext | null): OperationalSeverity {
    if (!context) return 'unavailable';
    if (context.dailyCloseInProgress || context.status === OperationalStatus.CloseInProgress) return 'progress';
    if (context.status === OperationalStatus.Normal && context.differenceDays === 0) return 'normal';
    if (context.status === OperationalStatus.NightTransition) return 'warning';
    return 'danger';
  }

  private clearState(): void {
    this.activeRequestId++;
    this.activeRequest = undefined;
    this.contextState.set(null);
    this.loadingState.set(false);
    this.errorState.set('');
  }

  private normalizeEmpresa(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private normalizeDate(value: unknown): string {
    const text = (value ?? '').toString().trim();
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return '';

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return '';
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  private normalizeOptionalText(value: unknown): string | null {
    const text = (value ?? '').toString().trim();
    return text || null;
  }

  private toFiniteNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return 'No fue posible consultar el contexto operativo.';
    const candidate = error as { message?: unknown; error?: { message?: unknown } };
    const message = candidate.error?.message ?? candidate.message;
    return typeof message === 'string' && message.trim() ? message.trim() : 'No fue posible consultar el contexto operativo.';
  }
}
