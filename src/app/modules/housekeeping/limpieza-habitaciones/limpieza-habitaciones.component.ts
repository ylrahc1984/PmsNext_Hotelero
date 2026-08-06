import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize, map, switchMap } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  EstadoLimpiezaVisual,
  LimpiezaHabitacion,
  LimpiezaHabitacionesKpis,
  LimpiezaHabitacionVista,
  PrioridadHousekeeping
} from './models/limpieza-habitacion.model';
import { resolveEstadoLimpieza } from './models/limpieza-habitacion.util';
import { LimpiezaHabitacionesPdfService } from './printing/limpieza-habitaciones-pdf.service';
import { LimpiezaHabitacionesService } from './services/limpieza-habitaciones.service';

@Component({
  selector: 'app-limpieza-habitaciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './limpieza-habitaciones.component.html',
  styleUrls: ['./limpieza-habitaciones.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LimpiezaHabitacionesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly limpiezaService = inject(LimpiezaHabitacionesService);
  private readonly pdfService = inject(LimpiezaHabitacionesPdfService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly filtersForm = this.fb.group({
    buscar: this.fb.control(''),
    estado: this.fb.control('TODOS'),
    grupo: this.fb.control('TODOS'),
    limpieza: this.fb.control('TODOS'),
    prioridad: this.fb.control('TODAS')
  });

  habitaciones: LimpiezaHabitacionVista[] = [];
  fechaOperativa = '';
  operador = '';
  isLoading = false;
  isExportingPdf = false;
  errorMessage = '';
  lastUpdated: Date | null = null;

  readonly limpiezaOptions: Array<EstadoLimpiezaVisual | 'TODOS'> = [
    'TODOS', 'PENDIENTE', 'LIMPIA', 'EN PROCESO', 'INSPECCION'
  ];
  readonly prioridadOptions: Array<PrioridadHousekeeping | 'TODAS'> = [
    'TODAS', 'SALIDA HOY', 'LLEGADA', 'OCUPADA', 'LIBRE', 'OTRA'
  ];

  ngOnInit(): void {
    this.operador = String(this.auth.getCurrentUser()?.usuario ?? '').trim();
    this.loadInitialData();
  }

  get habitacionesFiltradas(): LimpiezaHabitacionVista[] {
    const filters = this.filtersForm.getRawValue();
    const search = this.normalize(filters.buscar);

    return this.habitaciones.filter((room) => {
      const matchesSearch = !search || [room.room, room.huesped, room.grupo, room.estado]
        .some((value) => this.normalize(value).includes(search));
      return matchesSearch
        && (filters.estado === 'TODOS' || room.estado === filters.estado)
        && (filters.grupo === 'TODOS' || room.grupo === filters.grupo)
        && (filters.limpieza === 'TODOS' || room.estadoLimpieza === filters.limpieza)
        && (filters.prioridad === 'TODAS' || room.prioridad === filters.prioridad);
    });
  }

  get estadosDisponibles(): string[] {
    return this.unique(this.habitaciones.map((room) => room.estado));
  }

  get gruposDisponibles(): string[] {
    return this.unique(this.habitaciones.map((room) => room.grupo));
  }

  get kpis(): LimpiezaHabitacionesKpis {
    return this.calculateKpis(this.habitaciones);
  }

  actualizar(): void {
    if (this.isLoading) return;
    this.loadFromOperationalDate(true);
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      buscar: '',
      estado: 'TODOS',
      grupo: 'TODOS',
      limpieza: 'TODOS',
      prioridad: 'TODAS'
    });
  }

  async exportarPdf(): Promise<void> {
    const visibleRooms = this.habitacionesFiltradas;
    if (!this.fechaOperativa || !visibleRooms.length || this.isExportingPdf) {
      if (!visibleRooms.length) this.toast.warning('No hay habitaciones visibles para incluir en el PDF.');
      return;
    }

    this.isExportingPdf = true;
    this.cdr.markForCheck();
    try {
      const result = await this.pdfService.open({
        fechaOperativa: this.fechaOperativa,
        operador: this.operador,
        habitaciones: visibleRooms,
        kpis: this.calculateKpis(visibleRooms),
        generadoEn: new Date()
      });
      if (result === 'downloaded') {
        this.toast.info('El navegador bloqueó la vista previa; el PDF fue descargado.');
      }
    } catch (error: unknown) {
      console.error('No se pudo generar la lista PDF de Housekeeping.', error);
      this.toast.blockingError(this.errorText(error, 'No se pudo generar el PDF de limpieza de habitaciones.'));
    } finally {
      this.isExportingPdf = false;
      this.cdr.markForCheck();
    }
  }

  estadoClass(value: string): string {
    return `hk-status--${this.slug(value)}`;
  }

  limpiezaClass(value: EstadoLimpiezaVisual): string {
    return `hk-clean--${this.slug(value)}`;
  }

  prioridadClass(value: PrioridadHousekeeping): string {
    return `hk-priority--${this.slug(value)}`;
  }

  trackByRoom(_: number, room: LimpiezaHabitacionVista): string {
    return room.room;
  }

  private loadInitialData(): void {
    if (!this.operador) {
      this.errorMessage = 'No se pudo determinar el operador de la sesión.';
      return;
    }
    this.loadFromOperationalDate(false);
  }

  private loadFromOperationalDate(forceRefresh: boolean): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const dateRequest = forceRefresh
      ? this.operationalDateService.refresh()
      : this.operationalDateService.ensureLoaded();

    dateRequest.pipe(
      map((date) => normalizePmsDateDDMMYYYY(date)),
      switchMap((date) => {
        if (!date) throw new Error('No se obtuvo una fecha operativa válida.');
        this.fechaOperativa = date;
        return this.limpiezaService.prepararLista(date, this.operador);
      }),
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.habitaciones = response.habitaciones
          .map((room) => this.toView(room))
          .sort((a, b) => a.prioridadOrden - b.prioridadOrden || this.roomCompare(a.room, b.room));
        this.lastUpdated = new Date();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.habitaciones = [];
        this.errorMessage = this.errorText(error, 'No se pudo preparar la lista de limpieza de habitaciones.');
        this.toast.blockingError(this.errorMessage);
        this.cdr.markForCheck();
      }
    });
  }

  private toView(room: LimpiezaHabitacion): LimpiezaHabitacionVista {
    const estadoLimpieza = resolveEstadoLimpieza(room.clean);
    const { prioridad, orden } = this.resolvePriority(room);
    return { ...room, estadoLimpieza, prioridad, prioridadOrden: orden };
  }

  private resolvePriority(room: LimpiezaHabitacion): { prioridad: PrioridadHousekeeping; orden: number } {
    if (room.fechaFin && room.fechaFin === this.fechaOperativa) return { prioridad: 'SALIDA HOY', orden: 1 };
    if (room.estado === 'LLEGADA') return { prioridad: 'LLEGADA', orden: 2 };
    if (room.estado === 'OCUPADO' || room.estado === 'OCUPADA') return { prioridad: 'OCUPADA', orden: 3 };
    if (room.estado === 'LIBRE') return { prioridad: 'LIBRE', orden: 4 };
    return { prioridad: 'OTRA', orden: 5 };
  }

  private calculateKpis(rooms: LimpiezaHabitacionVista[]): LimpiezaHabitacionesKpis {
    return {
      total: rooms.length,
      salidasHoy: rooms.filter((room) => room.prioridad === 'SALIDA HOY').length,
      llegadas: rooms.filter((room) => room.estado === 'LLEGADA').length,
      ocupadas: rooms.filter((room) => ['OCUPADO', 'OCUPADA'].includes(room.estado)).length,
      pendientes: rooms.filter((room) => room.estadoLimpieza === 'PENDIENTE').length,
      limpias: rooms.filter((room) => room.estadoLimpieza === 'LIMPIA').length
    };
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }

  private roomCompare(a: string, b: string): number {
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
  }

  private slug(value: string): string {
    return this.normalize(value).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  }

  private normalize(value: unknown): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
  }
}
