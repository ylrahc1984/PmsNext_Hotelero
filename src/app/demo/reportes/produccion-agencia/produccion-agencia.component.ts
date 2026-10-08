import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { addPmsCalendarDays, normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  ProduccionAgenciaData,
  ProduccionAgenciaDetalle,
  ProduccionAgenciaResponse,
  ProduccionAgenciaResumen
} from './produccion-agencia.models';
import { ProduccionAgenciaService } from './produccion-agencia.service';

type SortKey =
  | 'nomAgencia'
  | 'reservasBrutas'
  | 'reservasVigentes'
  | 'reservasCanceladas'
  | 'habitacionesBrutas'
  | 'habitacionesVigentes'
  | 'habitacionesCanceladas'
  | 'roomNightsBrutos'
  | 'roomNightsVigentes'
  | 'roomNightsCancelados'
  | 'estanciaPromedio'
  | 'porcentajeCancelacionRoomNights'
  | 'porcentajeParticipacion';

interface StateBar {
  label: string;
  value: number;
  percent: number;
  tone: string;
}

interface ParticipationSegment {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-produccion-agencia',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './produccion-agencia.component.html',
  styleUrls: ['./produccion-agencia.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProduccionAgenciaComponent implements OnInit {
  private readonly service = inject(ProduccionAgenciaService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  filters = { fechaInicio: '', fechaFin: '' };
  loading = false;
  errorMessage = '';
  submitted = false;
  searchTerm = '';
  sortKey: SortKey = 'porcentajeParticipacion';
  sortDirection: 'asc' | 'desc' = 'desc';
  pageSize = 10;
  currentPage = 1;
  expandedAgencyCode = '';

  report: ProduccionAgenciaData | null = null;
  agenciasFiltradas: ProduccionAgenciaDetalle[] = [];
  agenciasPagina: ProduccionAgenciaDetalle[] = [];
  stateBars: StateBar[] = [];
  participationSegments: ParticipationSegment[] = [];
  compositionVigentesPercent = 0;
  compositionCanceladosPercent = 0;
  donutGradient = 'conic-gradient(#dfe7f0 0 100%)';

  ngOnInit(): void {
    this.initializeOperationalPeriod();
  }

  consultar(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (!this.filters.fechaInicio || !this.filters.fechaFin || this.filters.fechaInicio > this.filters.fechaFin) {
      this.errorMessage = 'Seleccione un rango de fechas válido.';
      return;
    }

    this.loading = true;
    this.service.consultar(this.filters).pipe(
      catchError((error: unknown) => {
        console.error('No se pudo consultar la producción por agencia.', error);
        this.clearReport();
        const httpError = error as { status?: number; error?: { message?: string } };
        this.errorMessage = httpError.status === 400 && httpError.error?.message
          ? httpError.error.message
          : 'No fue posible consultar la producción por agencia.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (!response || response.success === false) {
        this.clearReport();
        if (response?.message) this.errorMessage = response.message;
        return;
      }
      this.applyReport(response);
    });
  }

  limpiar(): void {
    const end = this.dateObject(this.operationalDateService.operationalDate()) ?? new Date();
    const start = addPmsCalendarDays(end, -6) ?? end;
    this.filters = { fechaInicio: toPmsDateInputValue(start), fechaFin: toPmsDateInputValue(end) };
    this.searchTerm = '';
    this.sortKey = 'porcentajeParticipacion';
    this.sortDirection = 'desc';
    this.currentPage = 1;
    this.expandedAgencyCode = '';
    this.consultar();
  }

  aplicarRango(tipo: 'hoy' | 'ultimos7' | 'ultimos30' | 'mes'): void {
    const end = this.dateObject(this.operationalDateService.operationalDate()) ?? new Date();
    let start = end;
    if (tipo === 'ultimos7') start = addPmsCalendarDays(end, -6) ?? end;
    if (tipo === 'ultimos30') start = addPmsCalendarDays(end, -29) ?? end;
    if (tipo === 'mes') start = new Date(end.getFullYear(), end.getMonth(), 1);
    this.filters = { fechaInicio: toPmsDateInputValue(start), fechaFin: toPmsDateInputValue(end) };
    this.consultar();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
    this.refreshAgencyView();
  }

  ordenarPor(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'nomAgencia' ? 'asc' : 'desc';
    }
    this.currentPage = 1;
    this.refreshAgencyView();
  }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.pageCount) return;
    this.currentPage = page;
    this.refreshAgencyView(false);
  }

  toggleDetalle(codigo: string): void {
    this.expandedAgencyCode = this.expandedAgencyCode === codigo ? '' : codigo;
  }

  isExpanded(codigo: string): boolean {
    return this.expandedAgencyCode === codigo;
  }

  get resumen(): ProduccionAgenciaResumen | null {
    return this.report?.resumen ?? null;
  }

  get agenciasTotal(): number {
    return this.report?.agencias?.length ?? 0;
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.agenciasFiltradas.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.pageCount }, (_, index) => index + 1);
  }

  get rangeStart(): number {
    return this.agenciasFiltradas.length ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.agenciasFiltradas.length);
  }

  get periodDays(): number {
    const from = normalizePmsDateDDMMYYYY(this.filters.fechaInicio);
    const to = normalizePmsDateDDMMYYYY(this.filters.fechaFin);
    const start = this.parseDate(from);
    const end = this.parseDate(to);
    return start && end ? Math.floor((end.getTime() - start.getTime()) / 86400000) + 1 : 0;
  }

  get periodLabel(): string {
    const start = this.formatShortDate(this.report?.fechaInicio || this.filters.fechaInicio);
    const end = this.formatShortDate(this.report?.fechaFin || this.filters.fechaFin);
    return `${start} - ${end}`;
  }

  formatNumber(value: number, decimals = 0): string {
    return new Intl.NumberFormat('es-CR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(this.number(value));
  }

  formatPercent(value: number): string {
    return `${this.formatNumber(value, 2)}%`;
  }

  cancellationTone(value: number): string {
    if (value >= 70) return 'risk-high';
    if (value >= 35) return 'risk-medium';
    return 'risk-low';
  }

  progressWidth(value: number): number {
    return Math.max(0, Math.min(100, this.number(value)));
  }

  displayAgencia(value: string): string {
    return value?.trim() || 'Sin agencia';
  }

  trackByAgency(_: number, item: ProduccionAgenciaDetalle): string {
    return item.codAgencia;
  }

  private initializeOperationalPeriod(): void {
    this.loading = true;
    this.operationalDateService.ensureLoaded().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (date) => {
        const end = date;
        const start = addPmsCalendarDays(end, -6) ?? end;
        this.filters = { fechaInicio: toPmsDateInputValue(start), fechaFin: toPmsDateInputValue(end) };
        this.consultar();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo obtener la fecha operativa para consultar el reporte.';
        this.cdr.markForCheck();
      }
    });
  }

  private applyReport(response: ProduccionAgenciaResponse): void {
    this.report = response.data;
    this.currentPage = 1;
    this.buildVisuals(response.data);
    this.refreshAgencyView();
  }

  private buildVisuals(data: ProduccionAgenciaData): void {
    const resumen = data.resumen;
    const total = this.number(resumen.roomNightsBrutos);
    this.compositionVigentesPercent = total ? (this.number(resumen.roomNightsVigentes) / total) * 100 : 0;
    this.compositionCanceladosPercent = total ? (this.number(resumen.roomNightsCancelados) / total) * 100 : 0;
    this.stateBars = [
      { label: 'CHK', value: resumen.roomNightsCHK, tone: 'checked' },
      { label: 'CCR', value: resumen.roomNightsCCR, tone: 'confirmed' },
      { label: 'ABI', value: resumen.roomNightsABI, tone: 'open' },
      { label: 'WLT', value: resumen.roomNightsWLT, tone: 'waitlist' },
      { label: 'ANU', value: resumen.roomNightsANU, tone: 'cancelled' }
    ].map((item) => ({ ...item, percent: total ? (this.number(item.value) / total) * 100 : 0 }));

    const top = [...(data.agencias ?? [])]
      .sort((left, right) => this.number(right.porcentajeParticipacion) - this.number(left.porcentajeParticipacion))
      .slice(0, 5);
    const colors = ['#16436f', '#0ea5a3', '#d98a16', '#7c3aed', '#4f86c6'];
    this.participationSegments = top.map((item, index) => ({ label: this.displayAgencia(item.nomAgencia), value: this.number(item.porcentajeParticipacion), color: colors[index] }));
    const otherValue = Math.max(0, 100 - this.participationSegments.reduce((totalValue, item) => totalValue + item.value, 0));
    if (otherValue > 0.01) this.participationSegments.push({ label: 'Otras', value: otherValue, color: '#cbd5e1' });
    let cursor = 0;
    const stops = this.participationSegments.map((item) => {
      const start = cursor;
      cursor += item.value;
      return `${item.color} ${start}% ${cursor}%`;
    });
    this.donutGradient = stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#dfe7f0 0 100%)';
  }

  private refreshAgencyView(resetPage = true): void {
    if (resetPage) this.currentPage = 1;
    const term = this.searchTerm.trim().toLowerCase();
    const source = this.report?.agencias ?? [];
    this.agenciasFiltradas = source
      .filter((item) => !term || `${item.codAgencia} ${item.nomAgencia}`.toLowerCase().includes(term))
      .sort((left, right) => this.compareAgencies(left, right));
    if (this.currentPage > this.pageCount) this.currentPage = this.pageCount;
    const offset = (this.currentPage - 1) * this.pageSize;
    this.agenciasPagina = this.agenciasFiltradas.slice(offset, offset + this.pageSize);
    this.cdr.markForCheck();
  }

  private compareAgencies(left: ProduccionAgenciaDetalle, right: ProduccionAgenciaDetalle): number {
    const leftValue = left[this.sortKey];
    const rightValue = right[this.sortKey];
    const result = typeof leftValue === 'string'
      ? leftValue.localeCompare(String(rightValue), 'es', { sensitivity: 'base' })
      : Number(leftValue ?? 0) - Number(rightValue ?? 0);
    return this.sortDirection === 'asc' ? result : -result;
  }

  private clearReport(): void {
    this.report = null;
    this.agenciasFiltradas = [];
    this.agenciasPagina = [];
    this.stateBars = [];
    this.participationSegments = [];
    this.donutGradient = 'conic-gradient(#dfe7f0 0 100%)';
  }

  private formatShortDate(value: string): string {
    const normalized = normalizePmsDateDDMMYYYY(value);
    const date = this.parseDate(normalized);
    return date ? new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '') : value || '—';
  }

  private parseDate(value: string): Date | null {
    const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
  }

  private number(value: number | null | undefined): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private dateObject(value: string | Date | null): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const normalized = normalizePmsDateDDMMYYYY(value);
    return this.parseDate(normalized);
  }
}
