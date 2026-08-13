import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalContextService } from 'src/app/core/services/operational-context.service';
import { addPmsCalendarDays } from 'src/app/core/utils/pms-date.util';
import { DashboardOperativoItem } from 'src/app/demo/dashboard/dashboard.models';
import { InHouseGuest } from 'src/app/modules/front-desk/in-house-guests/models/in-house-guest.model';
import { OccupancyForecastResponseRow } from 'src/app/modules/front-desk/pages/occupancy-forecast/occupancy-forecast.service';
import { resolveRackOperationalState } from 'src/app/shared/models/room-operational-visual-state';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ReservasReportData, ReservasReportService } from './reservas-report.service';

interface OperationalKpi {
  label: string;
  value: number;
  format: 'percent' | 'number';
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
  completed: number | null;
  detail: string;
}

interface ForecastPoint {
  label: string;
  occupied: number;
  available: number;
  occupancy: number;
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
export class ReservasComponent implements OnInit {
  private readonly reportService = inject(ReservasReportService);
  private readonly operationalContext = inject(OperationalContextService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodOptions = ['Hoy', 'Mañana', 'Semana actual', 'Próximos 7 días', 'Personalizado'];

  filters = { period: 'Hoy', from: this.getTodayInputDate(), to: this.getTodayInputDate() };
  operationalDate = this.getTodayInputDate();
  loading = false;
  exporting = false;
  error = '';
  warning = '';
  kpis: OperationalKpi[] = [];
  roomStatuses: RoomStatus[] = [];
  movements: MovementItem[] = [];
  forecastPoints: ForecastPoint[] = [];
  focusItems: OperationalFocus[] = [];
  recommendations: string[] = [];

  ngOnInit(): void {
    this.operationalContext.ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (context) => {
          this.operationalDate = context.operationalDate || this.getTodayInputDate();
          this.applyPeriod('Hoy');
          this.loadReport();
        },
        error: () => {
          this.operationalDate = this.getTodayInputDate();
          this.applyPeriod('Hoy');
          this.loadReport();
        }
      });
  }

  get reportDateDisplay(): string {
    return this.formatDisplayDate(this.filters.from);
  }

  get maxForecastValue(): number {
    return Math.max(1, ...this.forecastPoints.flatMap((item) => [item.occupied, item.available]));
  }

  onPeriodChange(period: string): void {
    this.applyPeriod(period);
  }

  onCustomDateChange(field: 'from' | 'to', value: string): void {
    this.filters = { ...this.filters, period: 'Personalizado', [field]: value };
  }

  loadReport(): void {
    if (!this.filters.from || !this.filters.to || this.filters.from > this.filters.to) {
      this.error = 'El rango de fechas seleccionado no es válido.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.warning = '';

    this.reportService.load({
      from: this.filters.from,
      to: this.filters.to,
      operator: this.getOperator()
    }).pipe(
      finalize(() => (this.loading = false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => this.applyReport(data),
      error: () => {
        this.clearReport();
        this.error = 'No fue posible cargar el reporte operativo. Intente nuevamente.';
      }
    });
  }

  getMovementPercent(item: MovementItem): number {
    return item.completed !== null && item.count ? Math.min(100, Math.round((item.completed / item.count) * 100)) : 0;
  }

  getForecastHeight(value: number): number {
    return value > 0 ? Math.max(8, Math.round((value / this.maxForecastValue) * 100)) : 0;
  }

  trackByLabel(_: number, item: { label?: string; title?: string }): string {
    return item.label || item.title || '';
  }

  formatValue(kpi: OperationalKpi): string {
    return kpi.format === 'percent'
      ? `${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(kpi.value)}%`
      : new Intl.NumberFormat('es-CR').format(kpi.value);
  }

  resetFilters(): void {
    this.applyPeriod('Hoy');
    this.loadReport();
  }

  async exportReport(): Promise<void> {
    if (this.exporting || this.loading || (!this.kpis.length && !this.roomStatuses.length)) return;
    this.exporting = true;
    this.error = '';

    try {
      const XLSX = await import('xlsx');
      const summaryRows = [
        ['Reporte Operativo Hotelero'],
        [`Periodo: ${this.filters.from} al ${this.filters.to}`],
        [],
        ['Indicadores operativos'],
        ['Indicador', 'Valor', 'Detalle', 'Lectura'],
        ...this.kpis.map((item) => [item.label, item.value, item.detail, item.trend]),
        [],
        ['Estado de habitaciones'],
        ['Estado', 'Cantidad', 'Detalle'],
        ...this.roomStatuses.map((item) => [item.label, item.value, item.detail]),
        [],
        ['Movimientos'],
        ['Movimiento', 'Programados/Total', 'Completados', 'Detalle'],
        ...this.movements.map((item) => [item.label, item.count, item.completed ?? '', item.detail]),
        [],
        ['Focos operativos'],
        ['Foco', 'Detalle', 'Impacto'],
        ...this.focusItems.map((item) => [item.title, item.detail, item.impact]),
        [],
        ['Recomendaciones'],
        ...this.recommendations.map((item, index) => [index + 1, item])
      ];
      const forecastRows = [
        ['Fecha', 'Habitaciones ocupadas', 'Habitaciones disponibles', 'Ocupación %'],
        ...this.forecastPoints.map((item) => [item.label, item.occupied, item.available, item.occupancy])
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      const forecastSheet = XLSX.utils.aoa_to_sheet(forecastRows);
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 48 }, { wch: 34 }];
      forecastSheet['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 16 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen operativo');
      XLSX.utils.book_append_sheet(workbook, forecastSheet, 'Forecast');
      XLSX.writeFile(workbook, `reporte-operativo-${this.filters.from}-${this.filters.to}.xlsx`, { compression: true });
    } catch {
      this.error = 'No fue posible generar el archivo Excel.';
    } finally {
      this.exporting = false;
    }
  }

  printReport(): void {
    window.print();
  }

  private applyReport(data: ReservasReportData): void {
    const occupancy = this.metric(data.dashboard, this.occupancySections(), ['PORCENTAJE DE OCUPACION', 'OCUPACION ACTUAL', 'OCUPACION'], ['ACTUAL', '', 'PORCENTAJE']);
    const previousOccupancy = this.metric(data.previousDashboard, this.occupancySections(), ['PORCENTAJE DE OCUPACION', 'OCUPACION ACTUAL', 'OCUPACION'], ['ACTUAL', '', 'PORCENTAJE']);
    const arrivalsPlanned = this.processMetric(data.dashboard, 'LLEGADAS', 'PROGRAMADAS', 'HABITACIONES');
    const arrivalsCompleted = this.processMetric(data.dashboard, 'LLEGADAS', 'CHECK IN REALIZADOS', 'HABITACIONES');
    const arrivalsPending = this.processMetric(data.dashboard, 'LLEGADAS', 'PENDIENTES', 'HABITACIONES');
    const departuresPlanned = this.processMetric(data.dashboard, 'SALIDAS', 'PROGRAMADAS', 'HABITACIONES');
    const departuresCompleted = this.processMetric(data.dashboard, 'SALIDAS', 'CHECK OUT REALIZADOS', 'HABITACIONES');
    const departuresPending = this.processMetric(data.dashboard, 'SALIDAS', 'PENDIENTES', 'HABITACIONES');
    const lateDepartures = this.processMetric(data.dashboard, 'SALIDAS', 'TARDIAS O VENCIDAS', 'RESERVAS');
    const available = this.metric(data.dashboard, this.occupancySections(), ['HABITACIONES DISPONIBLES', 'DISPONIBLES'], ['', 'HABITACIONES']);
    const occupied = this.metric(data.dashboard, this.occupancySections(), ['HABITACIONES OCUPADAS', 'OCUPADAS'], ['', 'HABITACIONES']);
    const outOfService = this.metric(data.dashboard, this.occupancySections(), ['HABITACIONES FUERA DE SERVICIO', 'FUERA DE SERVICIO', 'BLOQUEADAS HOY'], ['', 'HABITACIONES']);
    const dirty = data.rooms.filter((room) => this.normalize(room.CR05_Clean) === 'S').length;
    const blockedRooms = data.rooms.filter((room) => resolveRackOperationalState(room.CR05_EstHab) === 'blocked').length;
    const resolvedAvailable = available ?? data.rooms.filter((room) => resolveRackOperationalState(room.CR05_EstHab) === 'available').length;
    const resolvedOccupied = occupied ?? data.inHouse.totalHabitaciones;
    const resolvedOutOfService = outOfService ?? blockedRooms;
    const occupancyValue = occupancy ?? this.calculateOccupancy(resolvedOccupied, resolvedAvailable, resolvedOutOfService);

    this.kpis = [
      {
        label: 'Ocupación operativa', value: occupancyValue, format: 'percent',
        detail: 'Habitaciones ocupadas frente al inventario operativo',
        trend: previousOccupancy === null ? 'Sin comparativo del día anterior' : this.formatPointDifference(occupancyValue - previousOccupancy),
        tone: occupancyValue >= 85 ? 'warning' : 'positive'
      },
      {
        label: 'Llegadas pendientes', value: arrivalsPending ?? Math.max(0, (arrivalsPlanned ?? 0) - (arrivalsCompleted ?? 0)), format: 'number',
        detail: 'Habitaciones con check-in por completar', trend: `${arrivalsCompleted ?? 0} de ${arrivalsPlanned ?? 0} check-ins realizados`,
        tone: (arrivalsPending ?? 0) > 0 ? 'warning' : 'positive'
      },
      {
        label: 'Salidas pendientes', value: departuresPending ?? Math.max(0, (departuresPlanned ?? 0) - (departuresCompleted ?? 0)), format: 'number',
        detail: 'Habitaciones con check-out por cerrar', trend: `${departuresCompleted ?? 0} de ${departuresPlanned ?? 0} check-outs realizados`,
        tone: lateDepartures && lateDepartures > 0 ? 'warning' : 'neutral'
      },
      {
        label: 'Fuera de servicio', value: resolvedOutOfService, format: 'number',
        detail: 'Habitaciones que reducen el inventario vendible', trend: `${blockedRooms} habitaciones bloqueadas en Room Rack`,
        tone: resolvedOutOfService > 0 ? 'warning' : 'positive'
      }
    ];

    this.roomStatuses = [
      { label: 'Disponibles', value: resolvedAvailable, detail: 'Listas para venta inmediata', tone: 'available' },
      { label: 'Ocupadas', value: resolvedOccupied, detail: 'Con huéspedes en casa', tone: 'occupied' },
      { label: 'Sucias', value: dirty, detail: 'Pendientes de limpieza', tone: 'warning' },
      { label: 'Fuera de servicio', value: resolvedOutOfService, detail: 'Impactan el inventario vendible', tone: 'blocked' }
    ];

    const stayovers = this.countStayovers(data.inHouse.pax, this.filters.from);
    this.movements = [
      { label: 'Llegadas', count: arrivalsPlanned ?? 0, completed: arrivalsCompleted ?? 0, detail: 'Check-ins completados' },
      { label: 'Salidas', count: departuresPlanned ?? 0, completed: departuresCompleted ?? 0, detail: 'Check-outs cerrados' },
      { label: 'Stayovers', count: stayovers, completed: null, detail: 'Habitaciones que permanecen alojadas' },
      { label: 'Pax en casa', count: data.inHouse.totalHuespedes, completed: null, detail: `${data.inHouse.totalHabitaciones} habitaciones ocupadas` }
    ];

    this.forecastPoints = data.forecast.map((row) => this.mapForecast(row));
    this.buildOperationalReading(dirty, arrivalsPending ?? 0, resolvedOutOfService, lateDepartures ?? 0);
    this.warning = data.unavailableSources.length
      ? `Información parcial: no fue posible consultar ${data.unavailableSources.join(', ')}.`
      : '';
  }

  private buildOperationalReading(dirty: number, arrivalsPending: number, outOfService: number, lateDepartures: number): void {
    const focus: OperationalFocus[] = [];
    const recommendations: string[] = [];

    if (dirty > 0 && arrivalsPending > 0) {
      focus.push({ title: 'Housekeeping requiere coordinación', detail: `${dirty} habitaciones sucias coinciden con ${arrivalsPending} llegadas pendientes.`, impact: 'Priorizar habitaciones con llegada asignada', tone: 'warning' });
      recommendations.push('Priorizar la limpieza de habitaciones asignadas a llegadas pendientes.');
    }
    if (outOfService > 0) {
      focus.push({ title: 'Inventario reducido', detail: `${outOfService} habitaciones están fuera de servicio o bloqueadas.`, impact: 'Reduce la capacidad vendible', tone: 'warning' });
      recommendations.push('Revisar con mantenimiento las habitaciones fuera de servicio y su fecha estimada de liberación.');
    }
    if (lateDepartures > 0) {
      focus.push({ title: 'Salidas vencidas', detail: `${lateDepartures} salidas requieren seguimiento de front desk.`, impact: 'Puede retrasar limpieza y nuevas llegadas', tone: 'warning' });
      recommendations.push('Cerrar las salidas vencidas antes del siguiente bloque de llegadas.');
    }
    if (!focus.length) {
      focus.push({ title: 'Operación estable', detail: 'No se detectaron alertas críticas con las fuentes disponibles.', impact: 'Sin acciones urgentes', tone: 'positive' });
      recommendations.push('Mantener el seguimiento normal de llegadas, salidas y disponibilidad.');
    }

    this.focusItems = focus;
    this.recommendations = recommendations;
  }

  private mapForecast(row: OccupancyForecastResponseRow): ForecastPoint {
    const total = this.number(row.totHabi);
    const occupied = this.number(row.totOcupa);
    const blocked = this.number(row.blk);
    return {
      label: this.formatDisplayDate(row.fecha),
      occupied,
      available: Math.max(0, total - occupied - blocked),
      occupancy: this.number(row.porOcu)
    };
  }

  private metric(items: DashboardOperativoItem[], sections: string[], indicators: string[], subIndicators: string[]): number | null {
    const normalizedSections = sections.map((item) => this.normalize(item));
    const normalizedIndicators = indicators.map((item) => this.normalize(item));
    const normalizedSubIndicators = subIndicators.map((item) => this.normalize(item));
    const match = items.find((item) => {
      const section = this.normalize(item.Seccion);
      const indicator = this.normalize(item.Indicador);
      const subIndicator = this.normalize(item.SubIndicador);
      return normalizedSections.includes(section)
        && normalizedIndicators.includes(indicator)
        && (normalizedSubIndicators.includes(subIndicator) || normalizedSubIndicators.includes(''));
    });
    return this.availableValue(match);
  }

  private processMetric(items: DashboardOperativoItem[], section: 'LLEGADAS' | 'SALIDAS', stage: string, measure: string): number | null {
    const sectionNames = [section, `OPERACION DE ${section}`, `OPERACION ${section}`].map((item) => this.normalize(item));
    const stages = this.stageAliases(stage).map((item) => this.normalize(item));
    const measures = this.measureAliases(measure).map((item) => this.normalize(item));
    const match = items.find((item) => {
      const itemSection = this.normalize(item.Seccion);
      const indicator = this.normalize(item.Indicador);
      const subIndicator = this.normalize(item.SubIndicador);
      if (!sectionNames.includes(itemSection)) return false;
      return (stages.includes(indicator) && measures.includes(subIndicator))
        || (measures.includes(indicator) && stages.includes(subIndicator))
        || (stages.some((value) => indicator.includes(value)) && measures.some((value) => indicator.includes(value)));
    });
    return this.availableValue(match);
  }

  private availableValue(item: DashboardOperativoItem | undefined): number | null {
    if (!item || typeof item.Valor !== 'number' || !Number.isFinite(item.Valor)) return null;
    const state = this.normalize(item.EstadoDato);
    return ['NO DISPONIBLE', 'SIN DATO', 'ERROR', 'NO APLICA'].some((invalid) => state.includes(invalid)) ? null : item.Valor;
  }

  private countStayovers(guests: InHouseGuest[], date: string): number {
    const selected = this.dateValue(date);
    if (selected === null) return 0;
    return new Set(guests
      .filter((guest) => {
        const arrival = this.dateValue(guest.fechaIng);
        const departure = this.dateValue(guest.fechaSal);
        return arrival !== null && departure !== null && arrival < selected && departure > selected;
      })
      .map((guest) => guest.numHabita)
      .filter(Boolean)).size;
  }

  private applyPeriod(period: string): void {
    const base = this.operationalDate || this.getTodayInputDate();
    let from = base;
    let to = base;

    if (period === 'Mañana') {
      from = this.toInputDate(addPmsCalendarDays(base, 1));
      to = from;
    } else if (period === 'Semana actual') {
      const date = this.toDate(base);
      if (date) {
        const day = date.getDay() || 7;
        from = this.toInputDate(addPmsCalendarDays(date, 1 - day));
        to = this.toInputDate(addPmsCalendarDays(date, 7 - day));
      }
    } else if (period === 'Próximos 7 días') {
      to = this.toInputDate(addPmsCalendarDays(base, 6));
    } else if (period === 'Personalizado') {
      this.filters = { ...this.filters, period };
      return;
    }

    this.filters = { period, from, to };
  }

  private clearReport(): void {
    this.kpis = [];
    this.roomStatuses = [];
    this.movements = [];
    this.forecastPoints = [];
    this.focusItems = [];
    this.recommendations = [];
  }

  private occupancySections(): string[] {
    return ['OCUPACION', 'ESTADO GENERAL', 'ESTADO GENERAL DEL HOTEL', 'HOUSEKEEPING'];
  }

  private stageAliases(stage: string): string[] {
    const aliases: Record<string, string[]> = {
      PROGRAMADAS: ['PROGRAMADAS', 'PROGRAMADOS', 'TOTAL PROGRAMADAS', 'TOTAL PROGRAMADOS'],
      PENDIENTES: ['PENDIENTES DE CHECK IN', 'PENDIENTES DE CHECK OUT', 'PENDIENTES', 'CHECK IN PENDIENTES', 'CHECK OUT PENDIENTES'],
      'CHECK IN REALIZADOS': ['CHECK IN REALIZADOS', 'CHECK-IN REALIZADOS', 'REALIZADOS'],
      'CHECK OUT REALIZADOS': ['CHECK OUT REALIZADOS', 'CHECK-OUT REALIZADOS', 'REALIZADOS'],
      'TARDIAS O VENCIDAS': ['TARDIAS O VENCIDAS', 'TARDIAS', 'VENCIDAS', 'SALIDAS VENCIDAS']
    };
    return aliases[stage] ?? [stage];
  }

  private measureAliases(measure: string): string[] {
    const aliases: Record<string, string[]> = {
      RESERVAS: ['RESERVAS', 'RESERVA'],
      HABITACIONES: ['HABITACIONES', 'HABITACION', 'LLEGADAS', 'SALIDAS']
    };
    return aliases[measure] ?? [measure];
  }

  private calculateOccupancy(occupied: number, available: number, blocked: number): number {
    const inventory = occupied + available + blocked;
    return inventory ? (occupied / inventory) * 100 : 0;
  }

  private formatPointDifference(value: number): string {
    const formatted = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1, signDisplay: 'always' }).format(value);
    return `${formatted} pts frente al día anterior`;
  }

  private formatDisplayDate(value: string): string {
    const date = this.toDate(value);
    return date ? new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : value || '—';
  }

  private dateValue(value: string): number | null {
    return this.toDate(value)?.getTime() ?? null;
  }

  private toDate(value: string): Date | null {
    const raw = (value ?? '').trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
  }

  private toInputDate(value: Date | null): string {
    if (!value || Number.isNaN(value.getTime())) return this.getTodayInputDate();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private getOperator(): string {
    const user = this.authService.getCurrentUser();
    return (user?.usuario ?? user?.nombre ?? 'carga').toString().trim() || 'carga';
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalize(value: unknown): string {
    return (value ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9%]+/g, ' ').trim().toUpperCase();
  }

  private getTodayInputDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
