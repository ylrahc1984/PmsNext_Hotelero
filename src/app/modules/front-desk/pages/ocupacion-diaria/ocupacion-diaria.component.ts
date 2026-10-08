import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, of } from 'rxjs';

import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { toPmsDateInputValue } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomCategory } from '../../settings/room-categories/models/room-category.model';
import { RoomCategoriesService } from '../../settings/room-categories/services/room-categories.service';
import { RoomGroup } from '../../settings/room-groups/models/room-group.model';
import { RoomGroupsService } from '../../settings/room-groups/services/room-groups.service';
import {
  EstadoOcupacionDiaria,
  OcupacionDiariaFilters,
  OcupacionDiariaHabitacion,
  OcupacionDiariaResumen
} from './models/ocupacion-diaria.model';
import { OcupacionDiariaService } from './services/ocupacion-diaria.service';
import { OcupacionDiariaPdfService } from './printing/ocupacion-diaria-pdf.service';

interface OcupacionDiariaForm {
  fecha: FormControl<string>;
  cateHab: FormControl<string>;
  codGrp: FormControl<string>;
  soloActivas: FormControl<boolean>;
}

interface EstadoFiltro {
  codigo: '' | EstadoOcupacionDiaria;
  etiqueta: string;
}

type VistaInventario = 'DISTRIBUCION' | 'LISTA';

interface GrupoHabitacionesViewModel {
  codigo: number;
  etiqueta: string;
  rango: string;
  habitaciones: OcupacionDiariaHabitacion[];
}

@Component({
  selector: 'app-ocupacion-diaria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './ocupacion-diaria.component.html',
  styleUrls: ['./ocupacion-diaria.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OcupacionDiariaComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly ocupacionService = inject(OcupacionDiariaService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly roomGroupsService = inject(RoomGroupsService);
  private readonly ocupacionPdfService = inject(OcupacionDiariaPdfService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly filtersForm: FormGroup<OcupacionDiariaForm> = this.fb.group({
    fecha: this.fb.control('', { validators: [Validators.required] }),
    cateHab: this.fb.control(''),
    codGrp: this.fb.control(''),
    soloActivas: this.fb.control(true)
  });
  readonly busquedaControl = this.fb.control('');
  readonly estados: EstadoFiltro[] = [
    { codigo: '', etiqueta: 'Todas' },
    { codigo: 'DISPONIBLE', etiqueta: 'Disponibles' },
    { codigo: 'RESERVADA', etiqueta: 'Reservadas' },
    { codigo: 'OCUPADA', etiqueta: 'Ocupadas' },
    { codigo: 'BLOQUEADA', etiqueta: 'Bloqueadas' }
  ];

  categorias: RoomCategory[] = [];
  gruposHabitaciones: RoomGroup[] = [];
  habitaciones: OcupacionDiariaHabitacion[] = [];
  habitacionesVisibles: OcupacionDiariaHabitacion[] = [];
  gruposVisibles: GrupoHabitacionesViewModel[] = [];
  resumen: OcupacionDiariaResumen | null = null;
  fechaCargada = '';
  estadoLocal: '' | EstadoOcupacionDiaria = '';
  vistaInventario: VistaInventario = 'DISTRIBUCION';
  loading = false;
  loadingCatalogos = false;
  exportingPdf = false;
  errorMessage = '';
  submitted = false;
  consultada = false;

  ngOnInit(): void {
    this.bindLocalFilters();
    this.loadCatalogs();
    this.initializeOperationalDate();
  }

  consultar(): void {
    this.submitted = true;
    this.filtersForm.markAllAsTouched();
    const fecha = this.filtersForm.controls.fecha.value;
    if (!fecha) {
      this.errorMessage = 'Seleccione una fecha para consultar la ocupación.';
      this.habitaciones = [];
      this.habitacionesVisibles = [];
      this.resumen = null;
      return;
    }

    const raw = this.filtersForm.getRawValue();
    const filters: OcupacionDiariaFilters = {
      fecha: raw.fecha,
      cateHab: raw.cateHab,
      codGrp: raw.codGrp,
      soloActivas: raw.soloActivas
    };
    this.loading = true;
    this.errorMessage = '';
    this.consultada = true;

    this.ocupacionService.consultar(filters).pipe(
      catchError((error: unknown) => {
        console.error('No se pudo cargar la ocupación diaria.', error);
        this.errorMessage = 'No se pudo consultar la ocupación diaria para la fecha seleccionada.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (!response || response.success === false) {
        this.habitaciones = [];
        this.habitacionesVisibles = [];
      this.gruposVisibles = [];
        this.resumen = null;
        if (response?.success === false) {
          this.errorMessage = response.message || 'El backend no confirmó la consulta de ocupación diaria.';
        }
        return;
      }

      this.habitaciones = response.data?.habitaciones ?? [];
      this.resumen = response.data?.resumen ?? null;
      this.fechaCargada = response.data?.fecha || filters.fecha;
      this.rebuildVisibleRooms();
    });
  }

  limpiar(): void {
    const operationalDate = this.operationalDateService.operationalDate();
    const date = toPmsDateInputValue(operationalDate);
    this.filtersForm.reset({ fecha: date, cateHab: '', codGrp: '', soloActivas: true });
    this.busquedaControl.setValue('', { emitEvent: false });
    this.estadoLocal = '';
    this.vistaInventario = 'DISTRIBUCION';
    this.submitted = false;
    this.consultar();
  }

  seleccionarEstado(codigo: '' | EstadoOcupacionDiaria): void {
    this.estadoLocal = codigo;
    this.rebuildVisibleRooms();
  }

  seleccionarVista(vista: VistaInventario): void {
    this.vistaInventario = vista;
  }

  async exportarPdf(): Promise<void> {
    if (this.loading || this.exportingPdf || !this.consultada || !this.resumen || !this.habitaciones.length) {
      return;
    }

    this.exportingPdf = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      await this.ocupacionPdfService.open({
        fecha: this.resumenFecha(),
        resumen: this.resumen,
        habitaciones: this.habitaciones
      });
    } catch (error) {
      console.error('No se pudo generar el reporte PDF de ocupación diaria.', error);
      this.errorMessage = 'No se pudo generar el reporte PDF de ocupación diaria.';
    } finally {
      this.exportingPdf = false;
      this.cdr.markForCheck();
    }
  }

  estadoLabel(estado: string): string {
    const normalized = this.normalizeEstado(estado);
    return this.estados.find((item) => item.codigo === normalized)?.etiqueta || estado || 'Sin estado';
  }

  estadoClass(estado: string): string {
    return `occupancy-status--${this.normalizeEstado(estado).toLowerCase() || 'default'}`;
  }

  estadoCount(codigo: '' | EstadoOcupacionDiaria, resumen: OcupacionDiariaResumen): number {
    switch (codigo) {
      case 'DISPONIBLE': return resumen.disponibles;
      case 'RESERVADA': return resumen.reservadas;
      case 'OCUPADA': return resumen.ocupadas;
      case 'BLOQUEADA': return resumen.bloqueadas;
      default: return resumen.habitaciones;
    }
  }

  normalizeEstado(estado: string): '' | EstadoOcupacionDiaria {
    const normalized = (estado ?? '').trim().toUpperCase();
    return ['DISPONIBLE', 'RESERVADA', 'OCUPADA', 'BLOQUEADA'].includes(normalized)
      ? normalized as EstadoOcupacionDiaria
      : '';
  }

  displayText(value: string | number | null | undefined, fallback = '—'): string {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  trackByHabitacion(_: number, habitacion: OcupacionDiariaHabitacion): number { return habitacion.numeroHabitacion; }

  trackByGrupo(_: number, grupo: GrupoHabitacionesViewModel): number { return grupo.codigo; }

  private initializeOperationalDate(): void {
    this.loading = true;
    this.operationalDateService.ensureLoaded().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (date) => {
        const inputDate = toPmsDateInputValue(date);
        this.filtersForm.controls.fecha.setValue(inputDate, { emitEvent: false });
        this.consultar();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo obtener la fecha operativa para consultar la ocupación.';
        this.cdr.markForCheck();
      }
    });
  }

  private loadCatalogs(): void {
    this.loadingCatalogos = true;
    forkJoin({
      categorias: this.roomCategoriesService.getRoomCategories().pipe(catchError(() => of([] as RoomCategory[]))),
      grupos: this.roomGroupsService.getRoomGroups().pipe(catchError(() => of([] as RoomGroup[])))
    }).pipe(
      finalize(() => {
        this.loadingCatalogos = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ categorias, grupos }) => {
      this.categorias = categorias;
      this.gruposHabitaciones = grupos;
    });
  }

  private bindLocalFilters(): void {
    this.busquedaControl.valueChanges.pipe(
      debounceTime(120),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.rebuildVisibleRooms());
  }

  private rebuildVisibleRooms(): void {
    const term = this.normalizeSearch(this.busquedaControl.value);
    this.habitacionesVisibles = this.habitaciones.filter((habitacion) => {
      const matchesState = !this.estadoLocal || this.normalizeEstado(habitacion.estado) === this.estadoLocal;
      const searchable = this.normalizeSearch([
        habitacion.numeroHabitacion,
        habitacion.reservaDescripcion,
        habitacion.agencia,
        habitacion.tipoPlan
      ].join(' '));
      return matchesState && (!term || searchable.includes(term));
    });
    this.gruposVisibles = this.buildGroups(this.habitacionesVisibles);
    this.cdr.markForCheck();
  }

  private buildGroups(habitaciones: OcupacionDiariaHabitacion[]): GrupoHabitacionesViewModel[] {
    const groups = new Map<number, OcupacionDiariaHabitacion[]>();
    habitaciones.forEach((habitacion) => {
      const numero = Number(habitacion.numeroHabitacion);
      const codigo = numero < 100 ? 1 : Math.floor(numero / 100) * 100;
      const items = groups.get(codigo) ?? [];
      items.push(habitacion);
      groups.set(codigo, items);
    });

    return Array.from(groups.entries())
      .sort(([left], [right]) => left - right)
      .map(([codigo, items]) => ({
        codigo,
        etiqueta: String(codigo),
        rango: `${Number(items[0]?.numeroHabitacion ?? codigo)}–${Number(items[items.length - 1]?.numeroHabitacion ?? codigo)}`,
        habitaciones: [...items].sort((left, right) => Number(left.numeroHabitacion) - Number(right.numeroHabitacion))
      }));
  }

  private normalizeSearch(value: string | number | null | undefined): string {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private resumenFecha(): string {
    return this.fechaCargada || this.filtersForm.controls.fecha.value;
  }
}
