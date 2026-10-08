import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { normalizePmsDateDDMMYYYY, toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { WalkInAgenciaOption } from '../../walk-in/models/walk-in.model';
import { WalkInService } from '../../walk-in/services/walk-in.service';
import {
  ArriboAgenciaViewModel,
  ArriboFechaViewModel,
  ArriboHabitacion,
  ArriboReserva,
  ArribosResumen
} from './models/arribo.model';
import { ArribosService } from './services/arribos.service';
import { ArribosPdfService } from './printing/arribos-pdf.service';

interface ArribosFilterForm {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  codAgencia: FormControl<string>;
  estado: FormControl<string>;
  busqueda: FormControl<string>;
}

interface ArriboKpi {
  label: string;
  value: number;
  icon: string;
  tone: 'primary' | 'blue' | 'green' | 'amber';
}

interface ArriboEstadoOption {
  codigo: string;
  etiqueta: string;
}

@Component({
  selector: 'app-arribos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './arribos.component.html',
  styleUrls: ['./arribos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArribosComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly arribosService = inject(ArribosService);
  private readonly arribosPdfService = inject(ArribosPdfService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly walkInService = inject(WalkInService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly estados: ArriboEstadoOption[] = [
    { codigo: '', etiqueta: 'Todos' },
    { codigo: 'ABI', etiqueta: 'Abierta' },
    { codigo: 'WLT', etiqueta: 'Lista de espera' },
    { codigo: 'CCR', etiqueta: 'Confirmada' }
  ];

  readonly filtersForm: FormGroup<ArribosFilterForm> = this.fb.group({
    fechaDesde: this.fb.control('', { validators: [Validators.required] }),
    fechaHasta: this.fb.control('', { validators: [Validators.required] }),
    codAgencia: this.fb.control(''),
    estado: this.fb.control(''),
    busqueda: this.fb.control('')
  });

  readonly agenciaSearchControl = this.fb.control('');
  readonly agenciaModalSearchControl = this.fb.control('');
  readonly kpis: ArriboKpi[] = [];

  reservas: ArriboReserva[] = [];
  grupos: ArriboFechaViewModel[] = [];
  resumenVisible: ArribosResumen = { reservas: 0, habitaciones: 0, adultos: 0, ninos: 0 };
  agenciasModal: WalkInAgenciaOption[] = [];
  agenciaModalOpen = false;
  agenciasModalLoading = false;
  agenciasModalError = '';
  expandedReservations = new Set<string>();
  loading = false;
  errorMessage = '';
  submitted = false;
  exportingPdf = false;

  ngOnInit(): void {
    this.bindAgencyModalSearch();
    this.bindLocalFilters();
    this.initializeOperationalDate();
  }

  buscar(): void {
    this.submitted = true;
    this.filtersForm.markAllAsTouched();
    const validationMessage = this.getDateValidationMessage();
    if (validationMessage) {
      this.errorMessage = validationMessage;
      this.reservas = [];
      this.rebuildView();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    const filters = this.filtersForm.getRawValue();

    this.arribosService
      .consultarArribos(filters.fechaDesde, filters.fechaHasta, filters.codAgencia)
      .pipe(
        catchError((error: unknown) => {
          console.error('No se pudieron cargar los arribos.', error);
          this.errorMessage = 'No se pudieron cargar los arribos para el período seleccionado.';
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (!response) {
          this.reservas = [];
          this.rebuildView();
          return;
        }

        if (response.success === false) {
          this.errorMessage = response.message || 'El backend no confirmó la consulta de arribos.';
          this.reservas = [];
          this.rebuildView();
          return;
        }

        this.reservas = response.data?.reservas ?? [];
        this.expandedReservations.clear();
        this.rebuildView();
      });
  }

  limpiar(): void {
    const operationalDate = this.operationalDateService.operationalDate();
    const date = toPmsDateInputValue(operationalDate);
    this.filtersForm.reset({ fechaDesde: date, fechaHasta: date, codAgencia: '', estado: '', busqueda: '' });
    this.agenciaSearchControl.setValue('', { emitEvent: false });
    this.agenciaModalSearchControl.setValue('', { emitEvent: false });
    this.agenciasModal = [];
    this.agenciaModalOpen = false;
    this.agenciasModalError = '';
    this.submitted = false;
    this.buscar();
  }

  seleccionarAgencia(agencia: WalkInAgenciaOption): void {
    this.filtersForm.controls.codAgencia.setValue(agencia.codigo, { emitEvent: false });
    this.agenciaSearchControl.setValue(`${agencia.codigo} - ${agencia.descripcion}`, { emitEvent: false });
    this.agenciaModalOpen = false;
  }

  abrirAgenciaModal(): void {
    this.agenciaModalOpen = true;
    this.agenciasModalError = '';
    this.agenciaModalSearchControl.setValue('', { emitEvent: false });
    this.cargarAgenciasModal('');
  }

  cerrarAgenciaModal(): void {
    this.agenciaModalOpen = false;
    this.agenciasModalError = '';
  }

  async exportarPdf(): Promise<void> {
    const visibles = this.reservasVisibles();
    if (this.loading || this.exportingPdf || !visibles.length) {
      return;
    }

    const filters = this.filtersForm.getRawValue();
    this.exportingPdf = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      await this.arribosPdfService.open(
        {
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
          agencia: this.agenciaSearchControl.value || 'Todas'
        },
        visibles
      );
    } catch (error) {
      console.error('No se pudo generar el PDF de arribos.', error);
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo generar el PDF de arribos.';
    } finally {
      this.exportingPdf = false;
      this.cdr.markForCheck();
    }
  }

  toggleReserva(codReserva: string): void {
    if (this.expandedReservations.has(codReserva)) {
      this.expandedReservations.delete(codReserva);
    } else {
      this.expandedReservations.add(codReserva);
    }
  }

  expandirTodo(): void {
    this.expandedReservations = new Set(this.reservasVisibles().map((reserva) => reserva.codReserva));
  }

  contraerTodo(): void {
    this.expandedReservations.clear();
  }

  estaExpandida(codReserva: string): boolean {
    return this.expandedReservations.has(codReserva);
  }

  tieneObservacion(reserva: ArriboReserva): boolean {
    return !!reserva.observacion?.trim();
  }

  estadoLabel(estado: string): string {
    const code = this.normalizeEstado(estado);
    return this.estados.find((item) => item.codigo === code)?.etiqueta || estado || 'N/D';
  }

  estadoClass(estado: string): string {
    return `status-badge--${this.normalizeEstado(estado).toLowerCase() || 'default'}`;
  }

  diferenciaHabitaciones(reserva: ArriboReserva): boolean {
    return Number(reserva.resumen?.habitacionesReservadas ?? 0) !== Number(reserva.resumen?.habitacionesDesglosadas ?? 0);
  }

  nombreHuesped(huesped: { nombre: string; apellidos: string }): string {
    return [huesped.nombre, huesped.apellidos].map((value) => value?.trim()).filter(Boolean).join(' ');
  }

  formatDate(value: string): string {
    return normalizePmsDateDDMMYYYY(value) || value || 'N/D';
  }

  trackByFecha(_: number, grupo: ArriboFechaViewModel): string {
    return grupo.fecha;
  }

  trackByAgencia(_: number, grupo: ArriboAgenciaViewModel): string {
    return `${grupo.codigo}-${grupo.nombre}`;
  }

  trackByReserva(_: number, reserva: ArriboReserva): string {
    return reserva.codReserva;
  }

  trackByHabitacion(_: number, habitacion: ArriboHabitacion): string {
    return `${habitacion.numero}-${habitacion.orden}`;
  }

  private initializeOperationalDate(): void {
    this.loading = true;
    this.operationalDateService
      .ensureLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (date) => {
          const inputDate = toPmsDateInputValue(date);
          this.filtersForm.patchValue({ fechaDesde: inputDate, fechaHasta: inputDate }, { emitEvent: false });
          this.buscar();
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'No se pudo obtener la fecha operativa para consultar los arribos.';
          this.cdr.markForCheck();
        }
      });
  }

  private bindLocalFilters(): void {
    this.filtersForm.controls.estado.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildView());

    this.filtersForm.controls.busqueda.valueChanges
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.rebuildView());
  }

  private bindAgencyModalSearch(): void {
    this.agenciaModalSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          this.agenciasModalLoading = true;
          return (term.trim().length >= 2
            ? this.walkInService.buscarAgenciasPorNombre(term, 1, 50)
            : this.walkInService.getAgenciasPaginadas(1, 10)
          ).pipe(catchError((error: unknown) => {
            console.error('No se pudieron cargar las agencias.', error);
            this.agenciasModalError = 'No se pudo cargar el catálogo de agencias.';
            return of(null);
          }));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.agenciasModalLoading = false;
        this.agenciasModal = response?.datos ?? [];
        this.cdr.markForCheck();
      });
  }

  private cargarAgenciasModal(term: string): void {
    this.agenciasModalLoading = true;
    this.agenciasModalError = '';
    const request = term.trim().length >= 2
      ? this.walkInService.buscarAgenciasPorNombre(term, 1, 50)
      : this.walkInService.getAgenciasPaginadas(1, 10);

    request.pipe(
      catchError((error: unknown) => {
        console.error('No se pudieron cargar las agencias.', error);
        this.agenciasModalError = 'No se pudo cargar el catálogo de agencias.';
        return of(null);
      }),
      finalize(() => {
        this.agenciasModalLoading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.agenciasModal = response?.datos ?? [];
    });
  }

  private getDateValidationMessage(): string {
    const value = this.filtersForm.getRawValue();
    if (!value.fechaDesde || !value.fechaHasta) {
      return 'Seleccione las fechas Desde y Hasta.';
    }

    const desde = normalizePmsDateDDMMYYYY(value.fechaDesde);
    const hasta = normalizePmsDateDDMMYYYY(value.fechaHasta);
    if (!desde || !hasta) {
      return 'Seleccione un rango de fechas válido.';
    }

    const desdeKey = desde.split('/').reverse().join('');
    const hastaKey = hasta.split('/').reverse().join('');
    return hastaKey < desdeKey ? 'La fecha Hasta no puede ser menor que la fecha Desde.' : '';
  }

  private reservasVisibles(): ArriboReserva[] {
    const filters = this.filtersForm.getRawValue();
    const estado = this.normalizeEstado(filters.estado);
    const term = filters.busqueda.trim().toLowerCase();

    return this.reservas.filter((reserva) => {
      const matchesEstado = !estado || this.normalizeEstado(reserva.estado) === estado;
      const searchable = [
        reserva.codReserva,
        reserva.descripcion,
        reserva.agencia?.codigo,
        reserva.agencia?.nombre,
        ...reserva.habitaciones.flatMap((habitacion) => [
          habitacion.numero,
          habitacion.categoria,
          habitacion.tipo,
          ...habitacion.huespedes.flatMap((huesped) => [huesped.nombre, huesped.apellidos])
        ])
      ].join(' ').toLowerCase();
      return matchesEstado && (!term || searchable.includes(term));
    });
  }

  private rebuildView(): void {
    const visibles = this.reservasVisibles();
    const byDate = new Map<string, ArriboReserva[]>();

    visibles.forEach((reserva) => {
      const date = normalizePmsDateDDMMYYYY(reserva.fechaIngreso) || reserva.fechaIngreso || 'N/D';
      const items = byDate.get(date) ?? [];
      items.push(reserva);
      byDate.set(date, items);
    });

    this.grupos = Array.from(byDate.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([fecha, reservas]) => {
      const byAgency = new Map<string, ArriboReserva[]>();
      reservas.forEach((reserva) => {
        const codigo = reserva.agencia?.codigo || 'SIN-AGENCIA';
        const items = byAgency.get(codigo) ?? [];
        items.push(reserva);
        byAgency.set(codigo, items);
      });

      const agencias = Array.from(byAgency.entries()).map(([codigo, items]) => ({
        codigo,
        nombre: items[0]?.agencia?.nombre || 'Sin agencia',
        reservas: items.length,
        habitaciones: items.reduce((total, item) => total + this.reservaHabitaciones(item), 0),
        reservasItems: items
      }));

      return {
        fecha,
        label: this.formatDateGroupLabel(fecha),
        reservas: reservas.length,
        habitaciones: reservas.reduce((total, item) => total + this.reservaHabitaciones(item), 0),
        adultos: reservas.reduce((total, item) => total + Number(item.resumen?.adultos ?? 0), 0),
        ninos: reservas.reduce((total, item) => total + Number(item.resumen?.ninos ?? 0), 0),
        agencias
      };
    });

    this.resumenVisible = {
      reservas: visibles.length,
      habitaciones: visibles.reduce((total, item) => total + this.reservaHabitaciones(item), 0),
      adultos: visibles.reduce((total, item) => total + Number(item.resumen?.adultos ?? 0), 0),
      ninos: visibles.reduce((total, item) => total + Number(item.resumen?.ninos ?? 0), 0)
    };
    this.kpis.splice(0, this.kpis.length, ...this.buildKpis(this.resumenVisible));
  }

  private buildKpis(resumen: ArribosResumen): ArriboKpi[] {
    return [
      { label: 'Reservas', value: resumen.reservas, icon: 'event_available', tone: 'primary' },
      { label: 'Habitaciones', value: resumen.habitaciones, icon: 'hotel', tone: 'blue' },
      { label: 'Adultos', value: resumen.adultos, icon: 'groups', tone: 'green' },
      { label: 'Niños', value: resumen.ninos, icon: 'child_friendly', tone: 'amber' }
    ];
  }

  private reservaHabitaciones(reserva: ArriboReserva): number {
    return Number(reserva.resumen?.habitacionesReservadas ?? reserva.habitaciones?.length ?? 0);
  }

  private formatDateGroupLabel(value: string): string {
    const parts = value.split('/');
    if (parts.length !== 3) return value;
    const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return new Intl.DateTimeFormat('es-CR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
      .format(date)
      .replace('.', '')
      .toUpperCase();
  }

  private normalizeEstado(value: string | null | undefined): string {
    const code = (value ?? '').trim().toUpperCase();
    const aliases: Record<string, string> = {
      ABIERTO: 'ABI',
      ABIERTA: 'ABI',
      CONFIRMADA: 'CCR',
      CONFIRMADO: 'CCR',
      'LISTA DE ESPERA': 'WLT',
      WAITLIST: 'WLT'
    };
    return aliases[code] ?? code;
  }
}
