import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import {
  CheckInArrival,
  CheckInArrivalKpi,
  CheckInArrivalSortColumn,
  CheckInArrivalSortDirection
} from './models/check-in-arrival.model';
import { CheckInArrivalsService } from './services/check-in-arrivals.service';

interface CheckInArrivalFilterForm {
  fechaIngreso: string;
  soloPendientes: boolean;
  busqueda: string;
}

interface PaginationOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-check-in-arrivals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './check-in-arrivals.component.html',
  styleUrls: ['./check-in-arrivals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckInArrivalsComponent implements OnInit {
  private readonly arrivalsService = inject(CheckInArrivalsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  readonly pageSizeOptions: PaginationOption[] = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 }
  ];

  readonly columns: { label: string; key: CheckInArrivalSortColumn }[] = [
    { label: 'Habitacion', key: 'numHabita' },
    { label: 'Categoria', key: 'catHabita' },
    { label: 'Tipo', key: 'tipHabita' },
    { label: 'Reserva', key: 'codReserva' },
    { label: 'Agencia', key: 'nomAgencia' },
    { label: 'Descripcion', key: 'descripcion' },
    { label: 'Entrada', key: 'fechaIng' },
    { label: 'Salida', key: 'fechaSal' },
    { label: 'Noches', key: 'totNoches' },
    { label: 'Adultos', key: 'numPax' },
    { label: 'Ninos', key: 'numChild' },
    { label: 'Plan', key: 'codPlan' },
    { label: 'Estado', key: 'estado' }
  ];

  readonly filtersForm = this.fb.nonNullable.group<CheckInArrivalFilterForm>({
    fechaIngreso: this.formatDateInput(new Date()),
    soloPendientes: true,
    busqueda: ''
  });

  arrivals: CheckInArrival[] = [];
  filteredArrivals: CheckInArrival[] = [];
  pagedArrivals: CheckInArrival[] = [];
  kpis: CheckInArrivalKpi[] = [];
  selectedArrival: CheckInArrival | null = null;

  loading = false;
  reloading = false;
  errorMessage = '';
  page = 1;
  pageSize = 10;
  totalPages = 1;
  sortColumn: CheckInArrivalSortColumn = 'fechaIng';
  sortDirection: CheckInArrivalSortDirection = 'asc';
  activeObservationKey: string | null = null;

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    const filters = this.filtersForm.getRawValue();
    const fechaApi = this.formatDateApi(filters.fechaIngreso);

    this.loading = this.arrivals.length === 0;
    this.reloading = this.arrivals.length > 0;
    this.errorMessage = '';

    this.arrivalsService
      .getPendientes(fechaApi, filters.soloPendientes)
      .pipe(
        catchError((error) => {
          console.error('No se pudieron cargar los arribos pendientes.', error);
          this.errorMessage = 'No se pudieron cargar los arribos para la fecha seleccionada.';
          return of([] as CheckInArrival[]);
        }),
        finalize(() => {
          this.loading = false;
          this.reloading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((arrivals) => {
        this.arrivals = arrivals.map((arrival) => this.normalizeArrival(arrival));
        this.selectedArrival = this.arrivals[0] ?? null;
        this.activeObservationKey = null;
        this.page = 1;
        this.refreshView();
      });
  }

  limpiar(): void {
    this.filtersForm.setValue({
      fechaIngreso: this.formatDateInput(new Date()),
      soloPendientes: true,
      busqueda: ''
    });
    this.buscar();
  }

  aplicarBusqueda(): void {
    this.page = 1;
    this.refreshView();
  }

  seleccionarArrival(arrival: CheckInArrival): void {
    this.selectedArrival = arrival;
  }

  toggleObservacion(arrival: CheckInArrival): void {
    if (!this.hasObservacion(arrival)) {
      return;
    }

    const key = this.getArrivalKey(arrival);
    this.activeObservationKey = this.activeObservationKey === key ? null : key;
  }

  ordenar(column: CheckInArrivalSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.refreshView();
  }

  cambiarPageSize(value: string): void {
    this.pageSize = Number(value) || 10;
    this.page = 1;
    this.refreshView();
  }

  paginaAnterior(): void {
    if (this.page <= 1) {
      return;
    }

    this.page -= 1;
    this.refreshPage();
  }

  paginaSiguiente(): void {
    if (this.page >= this.totalPages) {
      return;
    }

    this.page += 1;
    this.refreshPage();
  }

  getSortIcon(column: CheckInArrivalSortColumn): string {
    if (this.sortColumn !== column) {
      return 'unfold_more';
    }

    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  getRangeLabel(): string {
    if (this.filteredArrivals.length === 0) {
      return '0 de 0';
    }

    const start = (this.page - 1) * this.pageSize + 1;
    const end = Math.min(this.page * this.pageSize, this.filteredArrivals.length);

    return `${start}-${end} de ${this.filteredArrivals.length}`;
  }

  isSelected(arrival: CheckInArrival): boolean {
    return !!this.selectedArrival && this.getArrivalKey(this.selectedArrival) === this.getArrivalKey(arrival);
  }

  isObservacionOpen(arrival: CheckInArrival): boolean {
    return this.activeObservationKey === this.getArrivalKey(arrival);
  }

  hasObservacion(arrival: CheckInArrival): boolean {
    return arrival.observacion.trim().length > 0;
  }

  getHabitacionLabel(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? arrival.numHabita : 'Sin Habitacion';
  }

  getHabitacionBadgeClass(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? 'text-bg-success' : 'text-bg-danger';
  }

  getHabitacionBadgeLabel(arrival: CheckInArrival): string {
    return this.hasHabitacion(arrival) ? 'Habitacion Asignada' : 'Sin Habitacion';
  }

  formatDisplayDate(value: string): string {
    const normalized = value.trim();

    if (!normalized) {
      return '-';
    }

    const ddmmyyyy = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[1]}/${ddmmyyyy[2]}/${ddmmyyyy[3]}`;
    }

    const yyyymmdd = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return `${yyyymmdd[3]}/${yyyymmdd[2]}/${yyyymmdd[1]}`;
    }

    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    }

    return normalized;
  }

  getProcesadoBadgeClass(arrival: CheckInArrival): string {
    return Number(arrival.procesado) === 1 ? 'text-bg-primary' : 'text-bg-warning';
  }

  getProcesadoBadgeLabel(arrival: CheckInArrival): string {
    return Number(arrival.procesado) === 1 ? 'Check In realizado' : 'Pendiente';
  }

  isCheckInDisabled(arrival: CheckInArrival | null): boolean {
    return !arrival || Number(arrival.procesado) === 1;
  }

  realizarCheckIn(reserva: CheckInArrival): void {
    console.log(reserva);
  }

  verReserva(reserva: CheckInArrival): void {
    console.log('Ver Reserva', reserva);
  }

  roomingList(reserva: CheckInArrival): void {
    console.log('Rooming List', reserva);
  }

  generarHojaRegistro(reserva: CheckInArrival): void {
    console.log('Generar Hoja de Registro', reserva);
  }

  imprimirArribos(): void {
    console.log('Imprimir Arribos', this.filteredArrivals);
  }

  asignarHabitacion(reserva: CheckInArrival): void {
    console.log('Asignar Habitacion', reserva);
  }

  volverRoomRack(): void {
    this.router.navigate(['/front-desk/room-rack']);
  }

  trackByReserva(_: number, arrival: CheckInArrival): string {
    return this.getArrivalKey(arrival);
  }

  trackByKpi(_: number, kpi: CheckInArrivalKpi): string {
    return kpi.label;
  }

  trackByColumn(_: number, column: { key: CheckInArrivalSortColumn }): string {
    return column.key;
  }

  private refreshView(): void {
    this.filteredArrivals = this.sortArrivals(this.filterArrivals(this.arrivals));
    this.kpis = this.buildKpis(this.filteredArrivals);
    this.totalPages = Math.max(1, Math.ceil(this.filteredArrivals.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);
    this.refreshPage();
    this.syncSelectedArrival();
  }

  private refreshPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.pagedArrivals = this.filteredArrivals.slice(start, start + this.pageSize);
  }

  private syncSelectedArrival(): void {
    if (!this.selectedArrival) {
      this.selectedArrival = this.filteredArrivals[0] ?? null;
      return;
    }

    const selectedKey = this.getArrivalKey(this.selectedArrival);
    this.selectedArrival = this.filteredArrivals.find((arrival) => this.getArrivalKey(arrival) === selectedKey) ?? this.filteredArrivals[0] ?? null;
  }

  private getArrivalKey(arrival: CheckInArrival): string {
    return `${arrival.codReserva}-${arrival.numHabita}-${arrival.folio}`;
  }

  private filterArrivals(arrivals: CheckInArrival[]): CheckInArrival[] {
    const term = this.normalizeText(this.filtersForm.controls.busqueda.value);

    if (!term) {
      return arrivals;
    }

    return arrivals.filter((arrival) => {
      const searchable = [
        arrival.numHabita,
        arrival.codReserva,
        arrival.codAgencia,
        arrival.nomAgencia,
        arrival.descripcion
      ].map((value) => this.normalizeText(value));

      return searchable.some((value) => value.includes(term));
    });
  }

  private sortArrivals(arrivals: CheckInArrival[]): CheckInArrival[] {
    return [...arrivals].sort((left, right) => {
      const leftValue = this.getSortValue(left, this.sortColumn);
      const rightValue = this.getSortValue(right, this.sortColumn);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });

      return this.sortDirection === 'asc' ? result : result * -1;
    });
  }

  private getSortValue(arrival: CheckInArrival, column: CheckInArrivalSortColumn): string {
    const value = arrival[column];
    return value == null ? '' : String(value);
  }

  private buildKpis(arrivals: CheckInArrival[]): CheckInArrivalKpi[] {
    const habitacionesAsignadas = arrivals.filter((arrival) => this.hasHabitacion(arrival)).length;
    const habitacionesPendientes = arrivals.length - habitacionesAsignadas;

    return [
      { label: 'Arribos del dia', value: arrivals.length, icon: 'flight_land', accent: 'primary' },
      { label: 'Habitaciones asignadas', value: habitacionesAsignadas, icon: 'hotel', accent: 'green' },
      { label: 'Habitaciones pendientes', value: habitacionesPendientes, icon: 'meeting_room', accent: 'amber' },
      { label: 'Pax Adultos', value: this.sumNumeric(arrivals, 'numPax'), icon: 'groups', accent: 'blue' },
      { label: 'Ninos', value: this.sumNumeric(arrivals, 'numChild'), icon: 'child_care', accent: 'burgundy' },
      { label: 'Reservas sin habitacion', value: habitacionesPendientes, icon: 'event_busy', accent: 'muted' }
    ];
  }

  private sumNumeric(arrivals: CheckInArrival[], key: 'numPax' | 'numChild'): number {
    return arrivals.reduce((total, arrival) => total + (Number(arrival[key]) || 0), 0);
  }

  private hasHabitacion(arrival: CheckInArrival): boolean {
    const habitacion = arrival.numHabita.trim().toUpperCase();
    return habitacion.length > 0 && !habitacion.startsWith('HB');
  }

  private normalizeArrival(arrival: CheckInArrival): CheckInArrival {
    return {
      ...arrival,
      numHabita: this.toStringValue(arrival.numHabita),
      catHabita: this.toStringValue(arrival.catHabita),
      tipHabita: this.toStringValue(arrival.tipHabita),
      codReserva: this.toStringValue(arrival.codReserva),
      codTarifa: this.toStringValue(arrival.codTarifa),
      codPlan: this.toStringValue(arrival.codPlan),
      descripcion: this.toStringValue(arrival.descripcion),
      fechaIng: this.toStringValue(arrival.fechaIng),
      fechaSal: this.toStringValue(arrival.fechaSal),
      procesado: Number(arrival.procesado) || 0,
      numPax: Number(arrival.numPax) || 0,
      numChild: Number(arrival.numChild) || 0,
      cpl: Number(arrival.cpl) || 0,
      totNoches: Number(arrival.totNoches) || 0,
      totDias: Number(arrival.totDias) || 0,
      folio: this.toStringValue(arrival.folio),
      estado: this.toStringValue(arrival.estado),
      codAgencia: this.toStringValue(arrival.codAgencia),
      nomAgencia: this.toStringValue(arrival.nomAgencia),
      observacion: this.toStringValue(arrival.observacion)
    };
  }

  private toStringValue(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatDateApi(value: string): string {
    const [year, month, day] = value.split('-');

    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }
}
