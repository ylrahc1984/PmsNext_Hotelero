import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subscription, finalize } from 'rxjs';

import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  DailyFinancialEvolution,
  FinancialReportCurrency,
  ReporteFinancieroResponse,
  RevenueBySource,
  RevenueCenter
} from './financial-report.models';
import { FinancialReportService } from './financial-report.service';

interface FinancialKpi {
  label: string;
  value: number;
  format: 'currency' | 'percent';
  detail: string;
  tone: 'positive' | 'warning' | 'neutral';
}

interface FinancialFilters {
  period: string;
  from: string;
  to: string;
  currency: FinancialReportCurrency;
}

interface FinancialTooltipContext {
  dataPointIndex: number;
}

@Component({
  selector: 'app-reporte-finanzas',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule, NgApexchartsModule],
  templateUrl: './finanzas.component.html',
  styleUrls: ['./finanzas.component.scss']
})
export class FinanzasComponent implements OnInit {
  private readonly reportService = inject(FinancialReportService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodOptions = ['Hoy', 'Semana actual', 'Mes actual', 'Ultimos 30 dias'];
  readonly currencyOptions: FinancialReportCurrency[] = ['USD', 'COL'];

  filters: FinancialFilters = this.getDefaultFilters();
  report: ReporteFinancieroResponse | null = null;
  chartOptions: Partial<ApexOptions> = this.buildChartOptions([]);
  loading = false;
  exporting = false;
  error = '';

  private requestSubscription?: Subscription;
  private requestToken = 0;

  ngOnInit(): void {
    this.loadReport();
  }

  get kpis(): FinancialKpi[] {
    const summary = this.report?.resumen;
    return [
      { label: 'Ingreso neto', value: summary?.ingresoNeto ?? 0, format: 'currency', detail: 'Ingresos del período', tone: 'positive' },
      { label: 'Gastos', value: summary?.gastoNeto ?? 0, format: 'currency', detail: 'Compras y gastos registrados', tone: 'warning' },
      {
        label: 'Resultado del período',
        value: summary?.resultadoOperativo ?? 0,
        format: 'currency',
        detail: 'Ingresos menos gastos registrados',
        tone: (summary?.resultadoOperativo ?? 0) >= 0 ? 'positive' : 'warning'
      },
      { label: 'Margen', value: summary?.margenOperativoPorcentaje ?? 0, format: 'percent', detail: 'Resultado sobre ingresos', tone: 'neutral' }
    ];
  }

  get observations(): string[] {
    if (!this.report || this.isEmptyReport) return [];
    const observations: string[] = [];
    const leadingCenter = this.report.centrosIngreso.reduce<RevenueCenter | null>(
      (leader, center) => !leader || center.participacionPorcentaje > leader.participacionPorcentaje ? center : leader,
      null
    );
    if (leadingCenter) {
      observations.push(`${this.toSentenceCase(leadingCenter.centroCosto)} concentra el ${this.formatPercent(leadingCenter.participacionPorcentaje)} de los ingresos del período.`);
    }

    const { ingresoNeto, gastoNeto, resultadoOperativo } = this.report.resumen;
    if (ingresoNeto !== 0) {
      observations.push(`Los gastos registrados representan el ${this.formatPercent((gastoNeto / ingresoNeto) * 100)} de los ingresos netos.`);
    }
    if (resultadoOperativo > 0) {
      observations.push(`El período presenta un resultado positivo de ${this.formatCurrency(resultadoOperativo)}.`);
    } else if (resultadoOperativo < 0) {
      observations.push(`El período presenta un resultado negativo de ${this.formatCurrency(Math.abs(resultadoOperativo))}.`);
    } else {
      observations.push('El período presenta un resultado equilibrado.');
    }
    return observations;
  }

  get isEmptyReport(): boolean {
    if (!this.report) return false;
    const { resumen, resumenGastos } = this.report;
    return resumen.ingresoNeto === 0 && resumen.gastoNeto === 0 && resumen.resultadoOperativo === 0 &&
      resumenGastos.totalCompras === 0 && this.report.centrosIngreso.length === 0 &&
      this.report.ingresosPorOrigen.length === 0 && this.report.evolucionDiaria.length === 0;
  }

  get reportPeriodDisplay(): string {
    if (!this.report) return '—';
    return `${this.formatApiDate(this.report.resumen.fechaDesde)} - ${this.formatApiDate(this.report.resumen.fechaHasta)}`;
  }

  onPeriodChange(period: string): void {
    const today = this.startOfDay(new Date());
    let from = new Date(today);
    let to = new Date(today);
    if (period === 'Semana actual') {
      const day = today.getDay() || 7;
      from = this.addDays(today, 1 - day);
    } else if (period === 'Mes actual') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'Ultimos 30 dias') {
      from = this.addDays(today, -29);
    }
    this.filters = { ...this.filters, period, from: this.toInputDate(from), to: this.toInputDate(to) };
    this.loadReport();
  }

  onDateChange(field: 'from' | 'to', value: string): void {
    this.filters = { ...this.filters, [field]: value };
    if (this.filters.from && this.filters.to) this.loadReport();
  }

  onCurrencyChange(currency: FinancialReportCurrency): void {
    this.filters = { ...this.filters, currency };
    this.loadReport();
  }

  loadReport(): void {
    const from = this.fromInputDate(this.filters.from);
    const to = this.fromInputDate(this.filters.to);
    if (!from || !to || from > to) {
      ++this.requestToken;
      this.requestSubscription?.unsubscribe();
      this.loading = false;
      this.clearReport();
      this.error = 'El rango de fechas seleccionado no es válido.';
      return;
    }

    const token = ++this.requestToken;
    this.requestSubscription?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.clearReport();
    this.requestSubscription = this.reportService.getReporteFinanciero(from, to, this.filters.currency).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (token === this.requestToken) this.loading = false;
      })
    ).subscribe({
        next: (response) => {
          this.report = this.normalizeResponse(response);
          this.chartOptions = this.buildChartOptions(this.report.evolucionDiaria);
        },
        error: (error: unknown) => {
          this.error = this.getErrorMessage(error);
        this.toast.error(this.error, 5500, 'Reporte financiero');
      }
    });
  }

  getCenterPercent(value: number): number {
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  }

  getOriginLabel(origin: string): string {
    const labels: Record<string, string> = { DOCUMENTO: 'Documentos', RECIBO_COMERCIAL: 'Recibos comerciales' };
    return labels[origin] ?? this.toSentenceCase(origin.replace(/_/g, ' '));
  }

  formatValue(kpi: FinancialKpi): string {
    return kpi.format === 'percent' ? this.formatPercent(kpi.value) : this.formatCurrency(kpi.value);
  }

  formatCurrency(value: number, currency: FinancialReportCurrency = this.filters.currency): string {
    const displayCurrency = currency === 'COL' ? 'CRC' : 'USD';
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${displayCurrency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
  }

  formatPercent(value: number): string {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}%`;
  }

  resetFilters(): void {
    this.filters = this.getDefaultFilters();
    this.loadReport();
  }

  async exportReport(): Promise<void> {
    if (!this.report || this.exporting || this.loading) return;
    this.exporting = true;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summary = this.report.resumen;
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
        'Fecha desde': summary.fechaDesde,
        'Fecha hasta': summary.fechaHasta,
        Moneda: summary.moneda,
        'Ingreso neto': summary.ingresoNeto,
        'Gasto neto': summary.gastoNeto,
        'Resultado del período': summary.resultadoOperativo,
        'Margen (%)': summary.margenOperativoPorcentaje
      }]), 'Resumen');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(this.report.centrosIngreso), 'Centros ingreso');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(this.report.ingresosPorOrigen), 'Origen ingresos');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([this.report.resumenGastos]), 'Compras');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(this.report.evolucionDiaria), 'Evolución diaria');
      XLSX.writeFile(workbook, `reporte-financiero-${this.filters.from}-${this.filters.to}-${this.filters.currency}.xlsx`, { compression: true });
    } catch {
      this.toast.error('No fue posible generar el archivo Excel.', 5000, 'Exportación');
    } finally {
      this.exporting = false;
    }
  }

  printReport(): void {
    window.print();
  }

  trackRevenueCenter(_: number, item: RevenueCenter): string { return item.codCentroCosto; }
  trackRevenueSource(_: number, item: RevenueBySource): string { return item.origen; }
  trackKpi(_: number, item: FinancialKpi): string { return item.label; }
  trackText(index: number): number { return index; }

  private buildChartOptions(points: DailyFinancialEvolution[]): Partial<ApexOptions> {
    const currency = this.filters.currency;
    return {
      series: [
        { name: 'Ingresos', data: points.map((point) => point.ingresos) },
        { name: 'Gastos', data: points.map((point) => point.gastos) }
      ],
      chart: { type: 'area', height: 260, toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true } },
      colors: ['#1f6bff', '#8a0f4d'],
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.22, opacityTo: 0.03 } },
      dataLabels: { enabled: false },
      markers: { size: points.length <= 31 ? 3 : 0, hover: { sizeOffset: 3 } },
      xaxis: { categories: points.map((point) => this.formatChartDate(point.fecha)), labels: { rotate: -45, hideOverlappingLabels: true, trim: true } },
      yaxis: { labels: { formatter: (value) => this.formatCompactCurrency(Number(value), currency) } },
      grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
      legend: { show: false },
      tooltip: {
        shared: true,
        intersect: false,
        custom: (context: FinancialTooltipContext) => {
          const point = points[context.dataPointIndex];
          if (!point) return '';
          return `<div class="financial-tooltip"><strong>${this.formatLongDate(point.fecha)}</strong><span>Ingresos <b>${this.formatCurrency(point.ingresos, currency)}</b></span><span>Gastos <b>${this.formatCurrency(point.gastos, currency)}</b></span><span>Resultado <b>${this.formatCurrency(point.resultado, currency)}</b></span></div>`;
        }
      }
    };
  }

  private normalizeResponse(response: ReporteFinancieroResponse): ReporteFinancieroResponse {
    return {
      ...response,
      centrosIngreso: Array.isArray(response.centrosIngreso) ? response.centrosIngreso : [],
      ingresosPorOrigen: Array.isArray(response.ingresosPorOrigen) ? response.ingresosPorOrigen : [],
      evolucionDiaria: Array.isArray(response.evolucionDiaria) ? response.evolucionDiaria : []
    };
  }

  private clearReport(): void {
    this.report = null;
    this.chartOptions = this.buildChartOptions([]);
  }

  private getDefaultFilters(): FinancialFilters {
    const today = this.startOfDay(new Date());
    return {
      period: 'Mes actual',
      from: this.toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: this.toInputDate(today),
      currency: 'USD'
    };
  }

  private fromInputDate(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toInputDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatApiDate(value: string): string {
    const date = this.parseApiDate(value);
    return date ? new Intl.DateTimeFormat('es-CR').format(date) : value;
  }

  private formatChartDate(value: string): string {
    const date = this.parseApiDate(value);
    return date ? new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: 'short' }).format(date) : value;
  }

  private formatLongDate(value: string): string {
    const date = this.parseApiDate(value);
    return date ? new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : value;
  }

  private parseApiDate(value: string): Date | null {
    const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatCompactCurrency(value: number, currency: FinancialReportCurrency): string {
    const prefix = currency === 'COL' ? 'CRC' : 'USD';
    return `${prefix} ${new Intl.NumberFormat('es-CR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
  }

  private toSentenceCase(value: string): string {
    const normalized = String(value ?? '').trim().toLocaleLowerCase('es');
    return normalized ? normalized.charAt(0).toLocaleUpperCase('es') + normalized.slice(1) : 'Sin identificar';
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'No fue posible cargar el reporte financiero. Intente nuevamente.';
  }
}
