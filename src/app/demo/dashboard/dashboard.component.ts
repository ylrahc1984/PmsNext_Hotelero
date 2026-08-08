import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';

import { OperationalStatus } from 'src/app/core/models/operational-context.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalContextService } from 'src/app/core/services/operational-context.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import {
  DashboardAlertView,
  DashboardForecastBarView,
  DashboardForecastView,
  DashboardHousekeepingView,
  DashboardMetricView,
  DashboardOperativoItem,
  DashboardProcessColumnView,
  DashboardProcessView,
  DashboardTone
} from './dashboard.models';
import { DashboardForecastService } from './dashboard-forecast.service';
import { DashboardHousekeepingService } from './dashboard-housekeeping.service';
import { DashboardService } from './dashboard.service';

interface IndicatorDefinition {
  label           : string;
  description     : string;
  icon            : string;
  tone            : DashboardTone;
  sections        : string[];
  indicators      : string[];
  subIndicators   ?: string[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService               = inject(DashboardService);
  private readonly dashboardForecastService       = inject(DashboardForecastService);
  private readonly dashboardHousekeepingService   = inject(DashboardHousekeepingService);
  private readonly authService                    = inject(AuthService);
  private readonly operationalContext             = inject(OperationalContextService);
  private readonly tipoCambioService              = inject(TipoCambioService);
  private readonly destroyRef                     = inject(DestroyRef);

  private readonly itemIndex                      = new Map<string, DashboardOperativoItem>();
  private readonly baseIndex                      = new Map<string, DashboardOperativoItem>();

  readonly loading                                = signal(true);
  readonly error                                  = signal('');
  readonly items                                  = signal<DashboardOperativoItem[]>([]);
  readonly greeting                               = signal(this.resolveGreeting());
  readonly userName                               = signal('Usuario');
  readonly operationalDate                        = this.operationalContext.operationalDate;
  readonly operationalSeverity                    = this.operationalContext.severity;
  readonly operationalStatusLabel                 = computed(() => this.resolveOperationalStatusLabel());
  readonly lastUpdatedAt                          = signal('—');
  readonly tipoCambio                             = signal<TipoCambio | null>(null);
  readonly tipoCambioLoading                      = signal(true);
  readonly tipoCambioError                        = signal('');
  readonly generalMetrics                         = signal<DashboardMetricView[]>([]);
  readonly processSections                        = signal<DashboardProcessView[]>([]);
  readonly alerts                                 = signal<DashboardAlertView[]>([]);
  readonly housekeepingMetrics                    = signal<DashboardMetricView[]>([]);
  readonly housekeepingError                      = signal('');
  readonly restaurantMetrics                      = signal<DashboardMetricView[]>([]);
  readonly forecastSummary                        = signal<DashboardMetricView[]>([]);
  readonly forecastBars                           = signal<DashboardForecastBarView[]>([]);
  readonly forecastError                          = signal('');
  readonly productionMetrics                      = signal<DashboardMetricView[]>([]);
  readonly productionCurrency                     = signal('—');
  readonly reservationStateMetrics                = signal<DashboardMetricView[]>([]);
  readonly quickMetrics                           = signal<DashboardMetricView[]>([]);

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => this.userName.set(this.resolveUserName(user)));
    this.loadDashboard();
  }

  getIndicador(seccion: string, indicador: string, subIndicador = ''): DashboardOperativoItem | null {
    return this.itemIndex.get(this.buildKey(seccion, indicador, subIndicador))
      ?? (!subIndicador ? this.baseIndex.get(this.buildBaseKey(seccion, indicador)) : undefined)
      ?? null;
  }

  getValor(seccion: string, indicador: string, subIndicador = ''): number | null {
    const value = this.getIndicador(seccion, indicador, subIndicador)?.Valor;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  getEstado(seccion: string, indicador: string, subIndicador = ''): string {
    return this.getIndicador(seccion, indicador, subIndicador)?.EstadoDato || 'NO_DISPONIBLE';
  }

  getUnidad(seccion: string, indicador: string, subIndicador = ''): string {
    return this.getIndicador(seccion, indicador, subIndicador)?.Unidad || '';
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    this.tipoCambioLoading.set(true);
    this.tipoCambioError.set('');
    this.forecastError.set('');
    this.housekeepingError.set('');

    const currentUser = this.authService.getCurrentUser();
    const operator = (currentUser?.usuario ?? currentUser?.nombre ?? '').toString().trim();

    this.operationalContext
      .ensureLoaded()
      .pipe(
        switchMap((context) => forkJoin({
          items: this.dashboardService.getDashboard(context.operationalDate),
          tiposCambio: this.tipoCambioService.fetchTipoCambio(context.operationalDate, 'usd').pipe(
            catchError(() => {
              this.tipoCambioError.set('Referencia no actualizada');
              const cachedRate = this.tipoCambioService.getActual();
              return of(cachedRate ? [cachedRate] : []);
            })
          ),
          forecast: this.dashboardForecastService.getSevenDayForecast(context.operationalDate).pipe(
            catchError(() => {
              this.forecastError.set('No fue posible obtener el forecast de ocupación para los próximos 7 días.');
              return of({ bars: [], average: null, peak: null } as DashboardForecastView);
            })
          ),
          housekeeping: this.dashboardHousekeepingService.getSummary(context.operationalDate, operator).pipe(
            catchError(() => {
              this.housekeepingError.set('No fue posible obtener el resumen operativo de Housekeeping.');
              return of(null as DashboardHousekeepingView | null);
            })
          )
        })),
        catchError(() => {
          this.clearDashboard();
          this.error.set('No fue posible obtener la fotografía operativa del hotel.');
          return of({
            items: [] as DashboardOperativoItem[],
            tiposCambio: [] as TipoCambio[],
            forecast: { bars: [], average: null, peak: null } as DashboardForecastView,
            housekeeping: null as DashboardHousekeepingView | null
          });
        }),
        finalize(() => {
          this.loading.set(false);
          this.tipoCambioLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ items, tiposCambio, forecast, housekeeping }) => {
        this.tipoCambio.set(tiposCambio[0] ?? null);
        if (!tiposCambio.length && !this.tipoCambioError()) {
          this.tipoCambioError.set('Tipo de cambio no disponible');
        }
        this.applyDashboard(items);
        this.applyForecast(forecast);
        this.applyHousekeeping(housekeeping);
      });
  }

  private applyDashboard(items: DashboardOperativoItem[]): void {
    const safeItems = Array.isArray(items) ? items : [];
    this.items.set(safeItems);
    this.buildIndexes(safeItems);
    this.lastUpdatedAt.set(this.formatTime(safeItems[0]?.GeneradoEn));

    this.generalMetrics.set(this.buildGeneralMetrics());
    this.processSections.set([
      this.buildProcess('LLEGADAS', 'Operación de Llegadas', 'Flujo de recepción', 'bi-box-arrow-in-right', 'blue'),
      this.buildProcess('SALIDAS', 'Operación de Salidas', 'Cierre de estancias', 'bi-box-arrow-right', 'violet')
    ]);
    this.restaurantMetrics.set(this.buildRestaurantMetrics());
    this.productionMetrics.set(this.buildProductionMetrics());
    this.reservationStateMetrics.set(this.buildReservationStateMetrics());
    this.quickMetrics.set(this.buildQuickMetrics());
    this.alerts.set(this.buildAlerts());
  }

  private buildIndexes(items: DashboardOperativoItem[]): void {
    this.itemIndex.clear();
    this.baseIndex.clear();

    for (const item of items) {
      this.itemIndex.set(this.buildKey(item.Seccion, item.Indicador, item.SubIndicador), item);
      const baseKey = this.buildBaseKey(item.Seccion, item.Indicador);
      if (!this.baseIndex.has(baseKey)) {
        this.baseIndex.set(baseKey, item);
      }
    }
  }

  private buildGeneralMetrics(): DashboardMetricView[] {
    const section = this.occupancySections();
    return [
      this.createMetric({ label: 'Ocupación actual', description: 'Porcentaje de inventario ocupado', icon: 'bi-pie-chart', tone: 'blue', sections: section, indicators: ['PORCENTAJE DE OCUPACION', 'OCUPACION ACTUAL', 'OCUPACION'], subIndicators: ['ACTUAL', '', 'PORCENTAJE'] }),
      this.createMetric({ label: 'Disponibles', description: 'Habitaciones listas para venta', icon: 'bi-door-open', tone: 'cyan', sections: section, indicators: ['HABITACIONES DISPONIBLES', 'DISPONIBLES'], subIndicators: ['', 'HABITACIONES'] }),
      this.createMetric({ label: 'Ocupadas', description: 'Habitaciones actualmente ocupadas', icon: 'bi-door-closed', tone: 'violet', sections: section, indicators: ['HABITACIONES OCUPADAS', 'OCUPADAS'], subIndicators: ['', 'HABITACIONES'] }),
      this.createMetric({ label: 'Pax en casa', description: 'Huéspedes alojados en el hotel', icon: 'bi-people', tone: 'green', sections: section, indicators: ['PAX EN CASA', 'HUESPEDES EN CASA', 'PAX IN HOUSE'] }),
      this.createMetric({ label: 'Llegadas hoy', description: 'Habitaciones con ingreso programado', icon: 'bi-box-arrow-in-right', tone: 'blue', sections: section, indicators: ['LLEGADAS HOY'], subIndicators: ['HABITACIONES'] }),
      this.createMetric({ label: 'Salidas hoy', description: 'Habitaciones con salida programada', icon: 'bi-box-arrow-right', tone: 'orange', sections: section, indicators: ['SALIDAS HOY'], subIndicators: ['HABITACIONES'] }),
      this.createMetric({ label: 'Bloqueadas', description: 'Habitaciones fuera del inventario', icon: 'bi-lock', tone: 'slate', sections: section, indicators: ['BLOQUEADAS HOY', 'HABITACIONES BLOQUEADAS', 'BLOQUEADAS'] })
    ];
  }

  private buildProcess(section: 'LLEGADAS' | 'SALIDAS', title: string, eyebrow: string, icon: string, tone: DashboardTone): DashboardProcessView {
    const completedStage = section === 'LLEGADAS' ? 'CHECK IN REALIZADOS' : 'CHECK OUT REALIZADOS';
    const completedDescription = section === 'LLEGADAS' ? 'Ingresos completados' : 'Estancias cerradas';
    const columns: DashboardProcessColumnView[] = [
      this.buildProcessColumn(section, 'PROGRAMADAS', 'Programadas', 'Plan del día operativo', 'bi-calendar2-check', section === 'LLEGADAS' ? 'blue' : 'violet', true),
      this.buildProcessColumn(section, completedStage, section === 'LLEGADAS' ? 'Check-In realizados' : 'Check-Out realizados', completedDescription, 'bi-check2-circle', 'green', false),
      this.buildProcessColumn(section, 'PENDIENTES', 'Pendientes', 'Trabajo por completar', 'bi-hourglass-split', 'orange', true)
    ];

    const footers = section === 'LLEGADAS'
      ? [
          this.createProcessMetric(section, 'CANCELADAS', 'RESERVAS', 'Canceladas', 'Reservas retiradas del plan', 'bi-calendar-x', 'orange'),
          this.createProcessMetric(section, 'NO SHOW', 'RESERVAS', 'No Show', 'Llegadas que no se presentaron', 'bi-person-x', 'red')
        ]
      : [this.createProcessMetric(section, 'TARDIAS O VENCIDAS', 'RESERVAS', 'Tardías o vencidas', 'Salidas fuera del horario esperado', 'bi-exclamation-octagon', 'red')];

    return {
      id: section.toLowerCase(),
      eyebrow,
      title,
      description: section === 'LLEGADAS'
        ? 'Avance de las llegadas previstas para la fecha operativa.'
        : 'Avance de las salidas y liberación del inventario del día.',
      icon,
      tone,
      columns,
      footers
    };
  }

  private buildProcessColumn(
    section: string,
    stage: string,
    title: string,
    description: string,
    icon: string,
    tone: DashboardTone,
    includeChildren: boolean
  ): DashboardProcessColumnView {
    const metrics = [
      this.createProcessMetric(section, stage, 'RESERVAS', 'Reservas', 'Expedientes', 'bi-journal-bookmark', tone),
      this.createProcessMetric(section, stage, 'HABITACIONES', 'Habitaciones', 'Unidades', 'bi-door-closed', tone),
      this.createProcessMetric(section, stage, 'PAX ADULTOS', 'Pax adultos', 'Personas', 'bi-person', tone)
    ];

    if (includeChildren) {
      metrics.push(this.createProcessMetric(section, stage, 'PAX NINOS', 'Pax niños', 'Personas', 'bi-person-arms-up', tone));
    }

    return {
      id: `${this.normalize(section)}-${this.normalize(stage)}`,
      title,
      description,
      icon,
      tone,
      metrics
    };
  }

  private createProcessMetric(
    section: string,
    stage: string,
    measure: string,
    label: string,
    description: string,
    icon: string,
    tone: DashboardTone
  ): DashboardMetricView {
    const stageAliases = this.stageAliases(stage);
    const measureAliases = this.measureAliases(measure);
    const item = this.findItem(
      [section, `OPERACION DE ${section}`, `OPERACION ${section}`],
      stageAliases,
      measureAliases
    ) ?? this.findItem(
      [section, `OPERACION DE ${section}`, `OPERACION ${section}`],
      measureAliases,
      stageAliases
    ) ?? this.findItem(
      [section, `OPERACION DE ${section}`, `OPERACION ${section}`],
      stageAliases.flatMap((stageName) => measureAliases.map((measureName) => `${stageName} ${measureName}`)),
      ['']
    );

    return this.toMetricView(item, label, description, icon, tone);
  }

  private applyHousekeeping(summary: DashboardHousekeepingView | null): void {
    const rule = this.housekeepingError() || 'Resumen calculado desde la lista operativa de limpieza';
    this.housekeepingMetrics.set([
      this.createCountMetric('Pendientes', summary?.pending, 'Trabajo por iniciar', 'bi-clock-history', 'orange', rule),
      this.createCountMetric('Limpias', summary?.clean, 'Listas para asignar', 'bi-stars', 'green', rule),
      this.createCountMetric('En proceso', summary?.inProgress, 'Limpieza activa', 'bi-arrow-repeat', 'blue', rule),
      this.createCountMetric('En inspección', summary?.inspection, 'Pendientes de validar', 'bi-clipboard-check', 'violet', rule),
      this.createCountMetric('Salidas de hoy', summary?.departuresToday, 'Prioridad por salida', 'bi-box-arrow-right', 'red', rule),
      this.createCountMetric('Llegadas', summary?.arrivals, 'Habitaciones por preparar', 'bi-box-arrow-in-right', 'cyan', rule)
    ]);
  }

  private createCountMetric(
    label: string,
    value: number | undefined,
    description: string,
    icon: string,
    tone: DashboardTone,
    rule: string
  ): DashboardMetricView {
    const available = typeof value === 'number' && Number.isFinite(value);
    return {
      id: this.normalize(label).toLowerCase().replace(/\s+/g, '-'),
      label,
      description,
      icon,
      tone,
      rawValue: available ? value : null,
      value: available ? new Intl.NumberFormat('es-CR').format(value) : '—',
      unit: '',
      state: available ? 'DISPONIBLE' : 'NO_DISPONIBLE',
      rule,
      available
    };
  }

  private buildRestaurantMetrics(): DashboardMetricView[] {
    const sections = ['RESTAURANTE', 'OPERACION RESTAURANTE'];
    return [
      this.createMetric({ label: 'Mesas ocupadas', description: 'Servicio activo', icon: 'bi-grid-3x3-gap', tone: 'blue', sections, indicators: ['MESAS OCUPADAS'] }),
      this.createMetric({ label: 'Pedidos activos', description: 'Órdenes en proceso', icon: 'bi-receipt', tone: 'orange', sections, indicators: ['PEDIDOS ACTIVOS'] }),
      this.createMetric({ label: 'Tickets abiertos', description: 'Cuentas sin cerrar', icon: 'bi-ticket-perforated', tone: 'violet', sections, indicators: ['TICKETS ABIERTOS'] }),
      this.createMetric({ label: 'Ventas del día', description: 'Producción de restaurante', icon: 'bi-cash-stack', tone: 'green', sections, indicators: ['VENTAS DEL DIA', 'VENTAS'] }),
      this.createMetric({ label: 'Room Service', description: 'Servicios activos', icon: 'bi-bell', tone: 'cyan', sections, indicators: ['ROOM SERVICE ACTIVO', 'ROOM SERVICE'] })
    ];
  }

  private applyForecast(forecast: DashboardForecastView): void {
    this.forecastBars.set(forecast.bars);
    this.forecastSummary.set([
      this.createForecastMetric('Promedio 7 días', forecast.average, 'blue'),
      this.createForecastMetric('Pico 7 días', forecast.peak, 'cyan')
    ]);
  }

  private createForecastMetric(
    label: string,
    value: number | null,
    tone: DashboardTone,
    base?: DashboardMetricView
  ): DashboardMetricView {
    const available = value !== null && Number.isFinite(value);
    return {
      id: base?.id || this.normalize(label).toLowerCase().replace(/\s+/g, '-'),
      label,
      description: base?.description || 'Ocupación proyectada',
      icon: base?.icon || 'bi-bar-chart-line',
      tone,
      rawValue: available ? value : null,
      value: available ? `${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(value)}%` : '—',
      unit: available ? '%' : '',
      state: available ? 'DISPONIBLE' : 'NO_DISPONIBLE',
      rule: 'Pronóstico de ocupación para los próximos 7 días',
      available
    };
  }

  private buildProductionMetrics(): DashboardMetricView[] {
    const sections = ['PRODUCCION', 'PRODUCCION DEL DIA', 'RESERVAS'];
    const metrics = [
      this.createMetric({ label: 'Reservas creadas', description: 'Registradas en la fecha operativa', icon: 'bi-calendar-plus', tone: 'blue', sections, indicators: ['RESERVAS CREADAS', 'Creadas hoy — Cantidad', 'RESERVAS DEL DIA'] }),
      this.createMetric({ label: 'Producción', description: 'Valor generado por las reservas', icon: 'bi-cash-coin', tone: 'green', sections, indicators: ['PRODUCCION', 'Creadas hoy — Producción', 'TOTAL PRODUCCION'] })
    ];
    this.productionCurrency.set(metrics[1].unit || '—');
    return metrics;
  }

  private buildReservationStateMetrics(): DashboardMetricView[] {
    const sections = ['RESERVAS', 'ESTADO DE RESERVAS', 'PRODUCCION'];
    return [
      this.createMetric({ label: 'Confirmadas', description: 'Reservas confirmadas hoy', icon: 'bi-check-circle', tone: 'green', sections, indicators: ['CONFIRMADAS HOY', 'CONFIRMADAS', 'RESERVAS CONFIRMADAS', 'ESTADO'], subIndicators: ['TOTAL', '', 'CONFIRMADAS'] }),
      this.createMetric({ label: 'Canceladas', description: 'Reservas canceladas hoy', icon: 'bi-x-circle', tone: 'orange', sections, indicators: ['CANCELADAS HOY', 'CANCELADAS', 'RESERVAS CANCELADAS', 'ESTADO'], subIndicators: ['TOTAL', '', 'CANCELADAS'] }),
      this.createMetric({ label: 'No Show', description: 'Reservas no presentadas', icon: 'bi-person-x', tone: 'red', sections, indicators: ['NO SHOW', 'NOSHOW', 'ESTADO'], subIndicators: ['', 'NO SHOW', 'NOSHOW'] }),
      this.createMetric({ label: 'Lista de espera', description: 'Reservas en espera', icon: 'bi-list-check', tone: 'slate', sections, indicators: ['LISTA DE ESPERA', 'WAITLIST', 'ESTADO'], subIndicators: ['', 'LISTA DE ESPERA', 'WAITLIST'] })
    ];
  }

  private buildQuickMetrics(): DashboardMetricView[] {
    return [
      this.createMetric({ label: 'Llegadas hoy', description: 'Habitaciones', icon: 'bi-box-arrow-in-right', tone: 'blue', sections: this.occupancySections(), indicators: ['LLEGADAS HOY'], subIndicators: ['HABITACIONES', ''] }),
      this.createMetric({ label: 'Salidas hoy', description: 'Habitaciones', icon: 'bi-box-arrow-right', tone: 'violet', sections: this.occupancySections(), indicators: ['SALIDAS HOY'], subIndicators: ['HABITACIONES', ''] }),
      this.createMetric({ label: 'Pax en casa', description: 'Huéspedes alojados', icon: 'bi-people', tone: 'green', sections: this.occupancySections(), indicators: ['PAX EN CASA', 'HUESPEDES EN CASA', 'PAX IN HOUSE'] }),
      this.createMetric({ label: 'Disponibles', description: 'Habitaciones', icon: 'bi-door-open', tone: 'cyan', sections: this.occupancySections(), indicators: ['HABITACIONES DISPONIBLES', 'DISPONIBLES'] }),
      this.createMetric({ label: 'Ocupación', description: 'Porcentaje actual', icon: 'bi-pie-chart', tone: 'blue', sections: this.occupancySections(), indicators: ['PORCENTAJE DE OCUPACION', 'OCUPACION ACTUAL', 'OCUPACION'], subIndicators: ['ACTUAL', '', 'PORCENTAJE'] })
    ];
  }

  private buildAlerts(): DashboardAlertView[] {
    const lateDepartures = this.createProcessMetric('SALIDAS', 'TARDIAS O VENCIDAS', 'RESERVAS', '', '', '', 'red');
    const pendingCheckIns = this.createProcessMetric('LLEGADAS', 'PENDIENTES', 'RESERVAS', '', '', '', 'orange');
    const cancelledArrivals = this.createProcessMetric('LLEGADAS', 'CANCELADAS', 'RESERVAS', '', '', '', 'orange');
    const noShows = this.createProcessMetric('LLEGADAS', 'NO SHOW', 'RESERVAS', '', '', '', 'red');
    const outOfService = this.createMetric({ label: '', description: '', icon: '', tone: 'red', sections: this.occupancySections(), indicators: ['HABITACIONES FUERA DE SERVICIO', 'FUERA DE SERVICIO'] });
    const alerts: DashboardAlertView[] = [];

    this.pushAlert(alerts, lateDepartures, 'critical', 'bi-exclamation-octagon-fill', 'Salidas vencidas', 'salidas tardías o vencidas');
    this.pushAlert(alerts, pendingCheckIns, 'warning', 'bi-hourglass-split', 'Check-In pendientes', 'Check-In pendientes');
    this.pushAlert(alerts, cancelledArrivals, 'notice', 'bi-calendar-x', 'Reservas canceladas', 'reservas canceladas');
    this.pushAlert(alerts, noShows, 'critical', 'bi-person-x-fill', 'No Show', 'reservas marcadas como No Show');
    this.pushAlert(alerts, outOfService, 'notice', 'bi-tools', 'Fuera de servicio', 'habitaciones fuera de servicio');

    return alerts.length
      ? alerts
      : [{ id: 'operation-clear', icon: 'bi-check-circle-fill', title: 'Operación estable', detail: 'Operación sin alertas críticas.', tone: 'success' }];
  }

  private pushAlert(
    alerts: DashboardAlertView[],
    metric: DashboardMetricView,
    tone: DashboardAlertView['tone'],
    icon: string,
    title: string,
    noun: string
  ): void {
    if (metric.rawValue === null || metric.rawValue <= 0) {
      return;
    }
    alerts.push({
      id: `${this.normalize(title)}-${alerts.length}`,
      icon,
      title,
      detail: `${this.formatNumber(metric.rawValue)} ${noun}`,
      tone
    });
  }

  private createMetric(definition: IndicatorDefinition): DashboardMetricView {
    const subIndicators = definition.subIndicators ?? [''];
    const item = this.findItem(definition.sections, definition.indicators, subIndicators)
      ?? this.findItem(
        definition.sections,
        subIndicators.filter(Boolean),
        definition.indicators
      );
    return this.toMetricView(item, definition.label, definition.description, definition.icon, definition.tone);
  }

  private toMetricView(
    item: DashboardOperativoItem | null,
    label: string,
    description: string,
    icon: string,
    tone: DashboardTone
  ): DashboardMetricView {
    const available = this.isAvailable(item);
    return {
      id: `${this.normalize(label || item?.Indicador || 'indicador')}-${this.normalize(item?.SubIndicador || '')}`,
      label,
      description,
      icon,
      tone,
      rawValue: available ? item?.Valor ?? null : null,
      value: available && item ? this.formatValue(item) : '—',
      unit: available ? item?.Unidad?.trim() || '' : '',
      state: item?.EstadoDato || 'NO_DISPONIBLE',
      rule: item?.ReglaAplicada || '',
      available
    };
  }

  private findItem(sections: string[], indicators: string[], subIndicators: string[]): DashboardOperativoItem | null {
    for (const section of sections) {
      for (const indicator of indicators) {
        for (const subIndicator of subIndicators) {
          const item = this.getIndicador(section, indicator, subIndicator);
          if (item) {
            return item;
          }
        }
      }
    }
    return null;
  }

  private isAvailable(item: DashboardOperativoItem | null): boolean {
    if (!item || typeof item.Valor !== 'number' || !Number.isFinite(item.Valor)) {
      return false;
    }
    const state = this.normalize(item.EstadoDato);
    return !['NO DISPONIBLE', 'SIN DATO', 'ERROR', 'NO APLICA'].some((invalid) => state.includes(invalid));
  }

  private formatValue(item: DashboardOperativoItem): string {
    if (typeof item.Valor !== 'number' || !Number.isFinite(item.Valor)) {
      return '—';
    }
    const value = this.formatNumber(item.Valor);
    const unit = this.normalize(item.Unidad);
    if (this.isPercentageItem(item)) {
      return `${value}%`;
    }
    if (['CRC', 'USD', 'EUR'].includes(unit)) {
      return `${item.Unidad.trim()} ${value}`;
    }
    return value;
  }

  private isPercentageItem(item: DashboardOperativoItem): boolean {
    const unit = this.normalize(item.Unidad);
    return unit === '%' || unit.includes('PORCENTAJE') || unit.includes('PERCENT');
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CR', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
  }

  private resolveGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  private resolveUserName(user: unknown): string {
    if (!user || typeof user !== 'object') return 'Usuario';
    const value = user as { nombre?: unknown; usuario?: unknown };
    const fullName = (value.nombre ?? value.usuario ?? '').toString().trim();
    return fullName.split(/\s+/)[0] || 'Usuario';
  }

  private resolveOperationalStatusLabel(): string {
    const context = this.operationalContext.context();
    if (!context) return 'Estado no disponible';
    if (context.dailyCloseInProgress || context.status === OperationalStatus.CloseInProgress) return 'Cierre diario en proceso';
    if (context.status === OperationalStatus.Normal && context.differenceDays === 0) return 'Operación normal';
    if (context.status === OperationalStatus.NightTransition) return 'Transición de jornada';
    if (context.status === OperationalStatus.PendingClose) return 'Cierre diario pendiente';
    if (context.status === OperationalStatus.CriticalLag) return 'Desfase operativo crítico';
    if (context.status === OperationalStatus.FutureDate) return 'Fecha operativa futura';
    return 'Atención operativa requerida';
  }

  private formatTime(value: string | null | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) return '—';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      const match = raw.match(/(?:T|\s)(\d{1,2}:\d{2})/);
      return match?.[1] ?? raw;
    }
    return new Intl.DateTimeFormat('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }

  private stageAliases(stage: string): string[] {
    const aliases: Record<string, string[]> = {
      'PROGRAMADAS': ['PROGRAMADAS', 'PROGRAMADOS', 'TOTAL PROGRAMADAS', 'TOTAL PROGRAMADOS'],
      'PENDIENTES': ['PENDIENTES DE CHECK IN', 'PENDIENTES DE CHECK OUT', 'PENDIENTES', 'CHECK IN PENDIENTES', 'CHECK OUT PENDIENTES'],
      'CHECK IN REALIZADOS': ['CHECK IN REALIZADOS', 'CHECK-IN REALIZADOS', 'REALIZADOS'],
      'CHECK OUT REALIZADOS': ['CHECK OUT REALIZADOS', 'CHECK-OUT REALIZADOS', 'REALIZADOS'],
      'CANCELADAS': ['CANCELADAS', 'CANCELADOS'],
      'NO SHOW': ['NO SHOW', 'NOSHOW'],
      'TARDIAS O VENCIDAS': ['TARDIAS O VENCIDAS', 'TARDIAS', 'VENCIDAS', 'SALIDAS VENCIDAS']
    };
    return aliases[stage] ?? [stage];
  }

  private measureAliases(measure: string): string[] {
    const aliases: Record<string, string[]> = {
      'RESERVAS': ['RESERVAS', 'RESERVA'],
      'HABITACIONES': ['HABITACIONES', 'HABITACION', 'LLEGADAS', 'SALIDAS'],
      'PAX ADULTOS': ['PAX ADULTOS', 'ADULTOS', 'PAX'],
      'PAX NINOS': ['PAX NINOS', 'NINOS', 'CHILDREN']
    };
    return aliases[measure] ?? [measure];
  }

  private occupancySections(): string[] {
    return ['OCUPACION', 'ESTADO GENERAL', 'ESTADO GENERAL DEL HOTEL', 'HOUSEKEEPING'];
  }

  private clearDashboard(): void {
    this.itemIndex.clear();
    this.baseIndex.clear();
    this.items.set([]);
    this.generalMetrics.set([]);
    this.processSections.set([]);
    this.alerts.set([]);
    this.housekeepingMetrics.set([]);
    this.restaurantMetrics.set([]);
    this.forecastSummary.set([]);
    this.forecastBars.set([]);
    this.productionMetrics.set([]);
    this.reservationStateMetrics.set([]);
    this.quickMetrics.set([]);
  }

  private buildKey(section: string, indicator: string, subIndicator: string): string {
    return `${this.normalize(section)}|${this.normalize(indicator)}|${this.normalize(subIndicator)}`;
  }

  private buildBaseKey(section: string, indicator: string): string {
    return `${this.normalize(section)}|${this.normalize(indicator)}`;
  }

  private normalize(value: unknown): string {
    return (value ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9%]+/g, ' ')
      .trim()
      .toUpperCase();
  }
}
