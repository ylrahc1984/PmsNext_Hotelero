import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  ComercialOportunidad,
  ComercialReportResponse,
  ComercialResumen
} from './comercial-report.models';
import { ComercialReportService } from './comercial-report.service';

interface CommercialKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent' | 'number';
  detail: string;
  trend: string;
  tone: 'positive' | 'warning' | 'neutral';
  help: string;
}

interface ChannelMix {
  name: string;
  revenue: number;
  nights: number;
  reservations: number;
  adr: number;
  share: number;
}

interface SegmentPerformance {
  name: string;
  revenue: number;
  adr: number;
  share: number;
  reservations: number;
  nights: number;
  reservationsShare: number;
  nightsShare: number;
  pickup7Nights: number;
  pickup7Revenue: number;
}

interface Opportunity {
  id: number;
  title: string;
  value: number;
  valueFormat: 'currency' | 'percent';
  detail: string;
  priority: 'Alta' | 'Media';
  action: string;
}

interface DemandPoint {
  label: string;
  dateRange: string;
  demand: number;
  pickup7: number;
  pickup30: number;
  pickup7Percent: number;
  pickup30Percent: number;
}

interface PerformanceDriver {
  label: string;
  value: number;
  share: number;
  detail: string;
  tone: 'volume' | 'rate';
}

@Component({
  selector: 'app-reporte-comercial',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './comercial.component.html',
  styleUrls: ['./comercial.component.scss']
})
export class ComercialComponent implements OnInit {
  private readonly reportService = inject(ComercialReportService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodOptions = ['Hoy', 'Semana actual', 'Mes actual', 'Próximos 30 días', 'Personalizado'];

  filters = {
    period: 'Próximos 30 días',
    from: this.getTodayInputDate(),
    to: this.getInputDateDaysAhead(30),
    currency: 'USD'
  };

  loading = false;
  exporting = false;
  error = '';
  warning = '';
  reportGeneratedDisplay = '—';
  pickupWindow: 7 | 30 = 7;
  executiveInsight = '';
  productionGap = 0;
  productionVariation = 0;
  pickupPaceVariation: number | null = null;
  performanceDrivers: PerformanceDriver[] = [];
  dataQualityPercent = 100;
  dataQualityDetail = 'Información conciliada';
  kpis: CommercialKpi[] = [];
  channels: ChannelMix[] = [];
  segments: SegmentPerformance[] = [];
  opportunities: Opportunity[] = [];
  demandPoints: DemandPoint[] = [];
  recommendations: string[] = [];
  private reportData: ComercialReportResponse | null = null;

  ngOnInit(): void {
    this.loadReport();
  }

  get totalNights(): number {
    return this.channels.reduce((sum, item) => sum + item.nights, 0);
  }

  get totalPickup7Nights(): number {
    return this.segments.reduce((sum, item) => sum + item.pickup7Nights, 0);
  }

  get leadingSegment(): SegmentPerformance | null {
    if (!this.segments.length) return null;
    return this.segments.reduce((leader, item) => item.share > leader.share ? item : leader);
  }

  get commercialMixInsight(): string {
    const leader = this.leadingSegment;
    if (!leader) return '';

    const momentum = this.segments
      .filter((item) => item.revenue > 0)
      .map((item) => ({ item, pickupShare: this.getSegmentPickupShare(item) }))
      .sort((a, b) => (b.pickupShare - b.item.share) - (a.pickupShare - a.item.share))[0];

    if (momentum && momentum.item.name !== leader.name && momentum.pickupShare > momentum.item.share + 10) {
      return `${leader.name} concentra ${this.formatPercent(leader.share)} de la producción. ${momentum.item.name} muestra impulso reciente y aporta ${this.formatPercent(momentum.pickupShare)} de las noches captadas en los últimos 7 días.`;
    }

    return `${leader.name} concentra ${this.formatPercent(leader.share)} de la producción del periodo y es el mercado con mayor peso comercial.`;
  }

  get bestChannelName(): string {
    if (!this.channels.length) return '—';
    return this.channels.reduce((best, item) => (item.revenue > best.revenue ? item : best)).name;
  }

  get maxDemandValue(): number {
    return Math.max(1, ...this.demandPoints.flatMap((item) => [item.demand, this.getDemandPickup(item)]));
  }

  get demandInsight(): string {
    if (!this.demandPoints.length) return '';
    const weakest = this.demandPoints.reduce((current, item) =>
      this.getDemandPickupPercent(item) < this.getDemandPickupPercent(current) ? item : current
    );
    const pickup = this.getDemandPickup(weakest);
    const percent = this.getDemandPickupPercent(weakest);
    return `${weakest.label} requiere atención: ${this.formatNumber(pickup, 0)} de sus ${this.formatNumber(weakest.demand, 0)} noches reservadas fueron captadas durante los últimos ${this.pickupWindow} días (${this.formatNumber(percent, 2)}%).`;
  }

  setPickupWindow(window: 7 | 30): void {
    this.pickupWindow = window;
  }

  getDemandPickup(point: DemandPoint): number {
    return this.pickupWindow === 7 ? point.pickup7 : point.pickup30;
  }

  getDemandPickupPercent(point: DemandPoint): number {
    return this.pickupWindow === 7 ? point.pickup7Percent : point.pickup30Percent;
  }

  onPeriodChange(period: string): void {
    const today = this.toDate(this.getTodayInputDate());
    if (!today || period === 'Personalizado') return;

    let from = new Date(today);
    let to = new Date(today);

    if (period === 'Semana actual') {
      const day = today.getDay() || 7;
      from = this.addDays(today, 1 - day);
      to = this.addDays(today, 7 - day);
    } else if (period === 'Mes actual') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (period === 'Próximos 30 días') {
      to = this.addDays(today, 30);
    }

    this.filters = { ...this.filters, period, from: this.toInputDate(from), to: this.toInputDate(to) };
    this.loadReport();
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

    this.reportService.getReport({
      fechaDesde: this.filters.from,
      fechaHasta: this.filters.to,
      moneda: this.filters.currency
    }).pipe(
      finalize(() => (this.loading = false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => this.applyReport(response),
      error: () => {
        this.clearReport();
        this.error = 'No fue posible cargar el reporte comercial. Intente nuevamente.';
      }
    });
  }

  getChannelPercent(value: number): number {
    return Math.max(0, Math.min(100, this.number(value)));
  }

  getDemandHeight(value: number): number {
    return value > 0 ? Math.max(8, Math.round((value / this.maxDemandValue) * 100)) : 0;
  }

  trackByLabel(_: number, item: { label?: string; name?: string; id?: number }): string | number {
    return item.id ?? item.label ?? item.name ?? _;
  }

  formatValue(kpi: CommercialKpi): string {
    if (kpi.format === 'percent') return `${this.formatNumber(kpi.value, 1)}%`;
    if (kpi.format === 'number') return this.formatNumber(kpi.value, 0);
    return this.formatCurrency(kpi.value);
  }

  formatOpportunityValue(opportunity: Opportunity): string {
    return opportunity.valueFormat === 'percent'
      ? `${this.formatNumber(opportunity.value, 2)}%`
      : this.formatCurrency(opportunity.value);
  }

  formatSignedCurrency(value: number): string {
    const formatted = this.formatCurrency(Math.abs(value));
    return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
  }

  formatSignedPercent(value: number): string {
    const formatted = this.formatNumber(Math.abs(value), 2);
    return value > 0 ? `+${formatted}%` : value < 0 ? `−${formatted}%` : `${formatted}%`;
  }

  formatPercent(value: number): string {
    return `${this.formatNumber(value, 2)}%`;
  }

  getPickupStatus(value: number): 'high' | 'moderate' | 'low' {
    if (value >= 25) return 'high';
    if (value >= 10) return 'moderate';
    return 'low';
  }

  getPickupStatusLabel(value: number): string {
    const status = this.getPickupStatus(value);
    return status === 'high' ? 'Alto' : status === 'moderate' ? 'Moderado' : 'Bajo';
  }

  getSegmentPickupShare(segment: SegmentPerformance): number {
    return this.totalPickup7Nights ? (segment.pickup7Nights / this.totalPickup7Nights) * 100 : 0;
  }

  getSegmentStatus(segment: SegmentPerformance): 'dominant' | 'momentum' | 'stable' | 'review' {
    if (segment.revenue <= 0 && segment.nights > 0) return 'review';
    if (segment.share >= 60) return 'dominant';
    if (this.getSegmentPickupShare(segment) >= segment.share + 10) return 'momentum';
    return 'stable';
  }

  getSegmentStatusLabel(segment: SegmentPerformance): string {
    const status = this.getSegmentStatus(segment);
    if (status === 'dominant') return 'Dominante';
    if (status === 'momentum') return 'Impulso reciente';
    if (status === 'review') return 'Revisar';
    return 'Estable';
  }

  getSegmentStory(segment: SegmentPerformance): string {
    const pickupShare = this.getSegmentPickupShare(segment);
    const status = this.getSegmentStatus(segment);

    if (status === 'review') {
      return `Registra ${this.formatNumber(segment.nights, 0)} noches sin producción asociada; conviene revisar su clasificación.`;
    }
    if (status === 'dominant') {
      return `Concentra ${this.formatPercent(segment.share)} de la producción y ${this.formatPercent(segment.nightsShare)} de las noches del periodo.`;
    }
    if (status === 'momentum') {
      return `Su peso total es ${this.formatPercent(segment.share)}, pero aporta ${this.formatPercent(pickupShare)} del pickup reciente.`;
    }
    return `Aporta ${this.formatPercent(segment.share)} de la producción y ${this.formatPercent(pickupShare)} del pickup reciente.`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: this.filters.currency || 'USD',
      maximumFractionDigits: 2
    }).format(this.number(value));
  }

  resetFilters(): void {
    this.filters = {
      period: 'Próximos 30 días',
      from: this.getTodayInputDate(),
      to: this.getInputDateDaysAhead(30),
      currency: 'USD'
    };
    this.loadReport();
  }

  async exportReport(): Promise<void> {
    if (!this.reportData || this.exporting || this.loading) return;
    this.exporting = true;
    this.error = '';

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        ['Reporte Comercial'],
        [`Periodo: ${this.filters.from} al ${this.filters.to}`],
        [`Moneda: ${this.filters.currency}`],
        [`Generado: ${this.reportGeneratedDisplay}`],
        [],
        ['Lectura ejecutiva'],
        [this.executiveInsight],
        [`Calidad de datos: ${this.formatPercent(this.dataQualityPercent)}`, this.dataQualityDetail],
        [],
        ['Indicador', 'Valor', 'Detalle', 'Comparativo'],
        ...this.kpis.map((item) => [item.label, item.value, item.detail, item.trend]),
        [],
        ['Causas de la variación'],
        ['Causa', 'Efecto estimado', 'Participación', 'Detalle'],
        ...this.performanceDrivers.map((item) => [item.label, item.value, item.share, item.detail]),
        [],
        ['Acciones sugeridas'],
        ...this.recommendations.map((item, index) => [index + 1, item])
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 52 }, { wch: 34 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      this.appendJsonSheet(XLSX, workbook, this.reportData.canales, 'Canales');
      this.appendJsonSheet(XLSX, workbook, this.reportData.fuentes, 'Fuentes');
      this.appendJsonSheet(XLSX, workbook, this.reportData.pickupSemanal, 'Pickup semanal');
      this.appendJsonSheet(XLSX, workbook, this.reportData.mixComercial, 'Mix comercial');
      this.appendJsonSheet(XLSX, workbook, this.reportData.comparativo, 'Comparativo');
      this.appendJsonSheet(XLSX, workbook, this.reportData.oportunidades, 'Oportunidades');
      this.appendJsonSheet(XLSX, workbook, this.reportData.diagnostico, 'Diagnóstico');
      this.appendJsonSheet(XLSX, workbook, this.reportData.incidencias, 'Incidencias');

      XLSX.writeFile(workbook, `reporte-comercial-${this.filters.from}-${this.filters.to}.xlsx`, { compression: true });
    } catch {
      this.error = 'No fue posible generar el archivo Excel.';
    } finally {
      this.exporting = false;
    }
  }

  printReport(): void {
    window.print();
  }

  private applyReport(response: ComercialReportResponse): void {
    this.reportData = response;
    const summary = response.resumen?.[0];
    if (!summary) {
      this.clearReport();
      this.error = 'El reporte no devolvió información para el periodo seleccionado.';
      return;
    }

    this.filters = { ...this.filters, currency: summary.Moneda || this.filters.currency };
    this.reportGeneratedDisplay = this.formatDisplayDate(summary.FechaGeneracion || summary.GeneradoEn);
    this.kpis = this.mapKpis(summary);
    this.applyExecutiveReading(summary);
    this.applyQuality(response);
    this.channels = (response.canales ?? []).map((item) => ({
      name: this.displayCommercialName(item.Canal),
      revenue: this.number(item.Produccion),
      nights: this.number(item.RoomNights),
      reservations: this.number(item.Reservas),
      adr: this.number(item.ADR),
      share: this.number(item.ParticipacionPct)
    }));
    this.segments = (response.mixComercial ?? []).map((item) => ({
      name: this.displayCommercialName(item.Mercado),
      revenue: this.number(item.Produccion),
      adr: this.number(item.ADR),
      share: this.number(item.ParticipacionProduccionPct),
      reservations: this.number(item.Reservas),
      nights: this.number(item.RoomNights),
      reservationsShare: this.number(item.ParticipacionReservasPct),
      nightsShare: this.number(item.ParticipacionRoomNightsPct),
      pickup7Nights: this.number(item.Pickup7RoomNights),
      pickup7Revenue: this.number(item.Pickup7Produccion)
    }));
    this.demandPoints = (response.pickupSemanal ?? []).map((item) => ({
      label: item.Semana,
      dateRange: `${this.formatShortDate(item.FechaDesde)}–${this.formatShortDate(item.FechaHasta)}`,
      demand: this.number(item.RoomNights),
      pickup7: this.number(item.Pickup7RoomNights),
      pickup30: this.number(item.Pickup30RoomNights),
      pickup7Percent: this.number(item.Pickup7Pct),
      pickup30Percent: this.number(item.Pickup30Pct)
    }));

    const selectedOpportunities = this.selectOpportunities(response.oportunidades ?? []);
    this.opportunities = selectedOpportunities.map((item) => ({
      id: item.IdOportunidad,
      title: `${item.Titulo} · ${this.displayCommercialName(item.Elemento)}`,
      value: Math.abs(this.number(item.ValorReferencia)),
      valueFormat: item.Tipo === 'BAJO_PICKUP' ? 'percent' : 'currency',
      detail: `${item.Descripcion} (${this.toTitleCase(item.Dimension)})`,
      priority: item.Prioridad === 'ALTA' ? 'Alta' : 'Media',
      action: this.opportunityAction(item)
    }));
    this.recommendations = this.opportunities.map((item) => item.action);
    this.warning = this.buildQualityWarning(response);
  }

  private mapKpis(summary: ComercialResumen): CommercialKpi[] {
    return [
      {
        label: 'Producción',
        value: this.number(summary.Produccion),
        format: 'currency',
        detail: `${this.formatNumber(summary.Reservas, 0)} reservas confirmadas en el periodo`,
        trend: this.comparisonText(summary.VariacionProduccionPct, summary.ProduccionAnterior, 'producción'),
        tone: this.variationTone(summary.VariacionProduccionPct),
        help: 'Ingreso asociado a las reservas del periodo seleccionado.'
      },
      {
        label: 'Noches vendidas',
        value: this.number(summary.RoomNights),
        format: 'number',
        detail: `${this.formatNumber(summary.Pickup7RoomNights, 0)} noches captadas en los últimos 7 días`,
        trend: this.comparisonText(summary.VariacionRoomNightsPct, summary.RoomNightsAnterior, 'noches'),
        tone: this.variationTone(summary.VariacionRoomNightsPct),
        help: 'Cantidad total de noches de habitación incluidas en las reservas.'
      },
      {
        label: 'Reservas',
        value: this.number(summary.Reservas),
        format: 'number',
        detail: `${this.formatNumber(summary.Pickup7Reservas, 0)} reservas captadas en los últimos 7 días`,
        trend: this.comparisonText(summary.VariacionReservasPct, summary.ReservasAnterior, 'reservas'),
        tone: this.variationTone(summary.VariacionReservasPct),
        help: 'Cantidad de reservas incluidas en el periodo seleccionado.'
      },
      {
        label: 'ADR promedio',
        value: this.number(summary.ADR),
        format: 'currency',
        detail: `ADR anterior ${this.formatCurrency(summary.ADRAnterior)}`,
        trend: this.comparisonText(summary.VariacionADRPct, summary.ADRAnterior, 'ADR'),
        tone: this.variationTone(summary.VariacionADRPct),
        help: 'Tarifa diaria promedio: producción dividida entre noches vendidas.'
      }
    ];
  }

  private applyExecutiveReading(summary: ComercialResumen): void {
    this.productionGap = this.number(summary.Produccion) - this.number(summary.ProduccionAnterior);
    this.productionVariation = this.number(summary.VariacionProduccionPct);

    const previousNights = this.number(summary.RoomNightsAnterior);
    const currentNights = this.number(summary.RoomNights);
    const previousAdr = this.number(summary.ADRAnterior);
    const currentAdr = this.number(summary.ADR);
    const volumeEffect = (currentNights - previousNights) * previousAdr;
    const rateEffect = currentNights * (currentAdr - previousAdr);
    const driverMagnitude = Math.abs(volumeEffect) + Math.abs(rateEffect);

    this.performanceDrivers = previousNights > 0 && previousAdr > 0 ? [
      {
        label: volumeEffect < 0 ? 'Menor volumen' : 'Mayor volumen',
        value: volumeEffect,
        share: driverMagnitude ? (Math.abs(volumeEffect) / driverMagnitude) * 100 : 0,
        detail: `${this.formatNumber(Math.abs(currentNights - previousNights), 0)} noches ${currentNights < previousNights ? 'menos' : 'más'} que el periodo anterior`,
        tone: 'volume'
      },
      {
        label: rateEffect < 0 ? 'Reducción del ADR' : 'Mejora del ADR',
        value: rateEffect,
        share: driverMagnitude ? (Math.abs(rateEffect) / driverMagnitude) * 100 : 0,
        detail: `${this.formatSignedCurrency(currentAdr - previousAdr)} por noche frente al periodo anterior`,
        tone: 'rate'
      }
    ] : [];

    const pickup30WeeklyEquivalent = this.number(summary.Pickup30RoomNights) * (7 / 30);
    this.pickupPaceVariation = pickup30WeeklyEquivalent > 0
      ? ((this.number(summary.Pickup7RoomNights) / pickup30WeeklyEquivalent) - 1) * 100
      : null;

    const productionReading = this.productionGap < 0
      ? `La producción cayó ${this.formatCurrency(Math.abs(this.productionGap))} (${this.formatSignedPercent(this.productionVariation)}).`
      : this.productionGap > 0
        ? `La producción creció ${this.formatCurrency(this.productionGap)} (${this.formatSignedPercent(this.productionVariation)}).`
        : 'La producción se mantuvo estable frente al periodo anterior.';
    const driverReading = this.performanceDrivers.length
      ? `El resultado se explica ${this.performanceDrivers[0].share >= 60 ? 'principalmente por el volumen de noches' : this.performanceDrivers[1].share >= 60 ? 'principalmente por el ADR' : 'por una combinación equilibrada de volumen y ADR'}.`
      : '';
    const pickupReading = this.pickupPaceVariation === null
      ? ''
      : `El pickup reciente está ${Math.abs(this.pickupPaceVariation) < 1 ? 'en línea con' : this.pickupPaceVariation > 0 ? `${this.formatPercent(this.pickupPaceVariation)} por encima de` : `${this.formatPercent(Math.abs(this.pickupPaceVariation))} por debajo de`} su ritmo promedio de 30 días.`;

    this.executiveInsight = [productionReading, driverReading, pickupReading].filter(Boolean).join(' ');
  }

  private applyQuality(response: ComercialReportResponse): void {
    const diagnostic = response.diagnostico?.[0];
    if (!diagnostic) {
      this.dataQualityPercent = 0;
      this.dataQualityDetail = 'Diagnóstico no disponible';
      return;
    }

    const issueCount = Math.max(
      this.number(diagnostic.ReservasSinProduccion),
      this.number(diagnostic.ReservasSinRoomNights),
      this.number(diagnostic.ReservasSinMercado),
      this.number(diagnostic.ReservasSinClasificar),
      this.number(diagnostic.ReservasTipoCambioInvalido)
    );
    const total = this.number(diagnostic.TotalReservas);
    this.dataQualityPercent = total ? Math.max(0, ((total - issueCount) / total) * 100) : 100;
    this.dataQualityDetail = issueCount
      ? `${this.formatNumber(issueCount, 0)} reservas requieren revisión`
      : 'Información conciliada sin incidencias críticas';
  }

  private selectOpportunities(items: ComercialOportunidad[]): ComercialOportunidad[] {
    const seen = new Set<string>();
    return [...items]
      .sort((a, b) => this.priorityOrder(a.Prioridad) - this.priorityOrder(b.Prioridad))
      .filter((item) => {
        const key = `${item.Tipo}|${this.normalize(item.Elemento)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }

  private opportunityAction(item: ComercialOportunidad): string {
    const name = this.displayCommercialName(item.Elemento);
    if (item.Tipo === 'CAIDA_FUERTE') return `Revisar el desempeño de ${name} y definir una acción de recuperación frente al periodo anterior.`;
    if (item.Tipo === 'BAJO_PICKUP') return `Activar una acción comercial para ${name} y monitorear su captación durante los próximos días.`;
    if (item.Tipo === 'CAIDA_ADR') return `Revisar tarifas, descuentos y paridad de ${name} para proteger el ADR.`;
    if (item.Tipo === 'CRECIMIENTO_FUERTE') return `Consolidar el crecimiento de ${name} y evaluar si la estrategia puede replicarse.`;
    return `Dar seguimiento a ${name} durante el próximo corte comercial.`;
  }

  private buildQualityWarning(response: ComercialReportResponse): string {
    const diagnostic = response.diagnostico?.[0];
    if (!diagnostic) return 'El endpoint no incluyó información de diagnóstico para esta consulta.';
    if (Math.abs(this.number(diagnostic.DiferenciaProduccion)) > 0.01) {
      return `La producción no está conciliada: existe una diferencia de ${this.formatCurrency(diagnostic.DiferenciaProduccion)}.`;
    }
    return this.normalize(diagnostic.EstadoCalidad) === 'OK' ? '' : `El diagnóstico del reporte indica estado ${diagnostic.EstadoCalidad}.`;
  }

  private clearReport(): void {
    this.reportData = null;
    this.kpis = [];
    this.channels = [];
    this.segments = [];
    this.opportunities = [];
    this.demandPoints = [];
    this.recommendations = [];
    this.executiveInsight = '';
    this.productionGap = 0;
    this.productionVariation = 0;
    this.pickupPaceVariation = null;
    this.performanceDrivers = [];
    this.dataQualityPercent = 100;
    this.dataQualityDetail = 'Información conciliada';
    this.warning = '';
    this.reportGeneratedDisplay = '—';
  }

  private comparisonText(variation: number, previous: number, metric: string): string {
    if (!this.number(previous)) return `Sin base comparativa anterior para ${metric}`;
    const value = this.number(variation);
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatNumber(value, 2)}% vs periodo anterior`;
  }

  private variationTone(value: number): 'positive' | 'warning' | 'neutral' {
    const variation = this.number(value);
    return variation > 0 ? 'positive' : variation < 0 ? 'warning' : 'neutral';
  }

  private priorityOrder(value: string): number {
    return value === 'ALTA' ? 0 : 1;
  }

  private displayCommercialName(value: string): string {
    const normalized = this.normalize(value);
    if (normalized === 'DIREC') return 'Directo';
    return value || 'Sin definir';
  }

  private formatNumber(value: number, digits: number): string {
    return new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(this.number(value));
  }

  private formatDisplayDate(value: string): string {
    const date = this.toDate(value);
    return date ? new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '—';
  }

  private formatShortDate(value: string): string {
    const date = this.toDate(value);
    return date ? new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: '2-digit' }).format(date) : '—';
  }

  private toDate(value: string): Date | null {
    const raw = (value ?? '').trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
  }

  private toInputDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toTitleCase(value: string): string {
    return (value || '').toLocaleLowerCase('es').replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('es'));
  }

  private normalize(value: unknown): string {
    return (value ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getTodayInputDate(): string {
    return this.toInputDate(new Date());
  }

  private getInputDateDaysAhead(days: number): string {
    return this.toInputDate(this.addDays(new Date(), days));
  }

  private appendJsonSheet(XLSX: typeof import('xlsx'), workbook: import('xlsx').WorkBook, rows: object[], name: string): void {
    if (!rows?.length) return;
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  }
}
