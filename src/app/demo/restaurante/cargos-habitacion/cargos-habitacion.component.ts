import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CargoHabitacion, CargoHabitacionConsultaService } from './cargo-habitacion-consulta.service';

type CargosHabitacionForm = {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  busqueda: FormControl<string>;
};

@Component({
  selector: 'app-cargos-habitacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './cargos-habitacion.component.html',
  styleUrls: ['./cargos-habitacion.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargosHabitacionComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(CargoHabitacionConsultaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSizeOptions = [10, 15, 20];
  readonly filtrosForm: FormGroup<CargosHabitacionForm>;

  cargos: CargoHabitacion[] = [];
  cargosFiltrados: CargoHabitacion[] = [];
  pageNumber = 1;
  pageSize = 10;
  loading = false;
  hasSearched = false;
  error: string | null = null;
  dateRangeError = '';
  private activeRequest?: Subscription;

  constructor() {
    const range = this.getDefaultDateRange();
    this.filtrosForm = this.fb.group({
      fechaDesde: this.fb.control(range.fechaDesde, { validators: [Validators.required] }),
      fechaHasta: this.fb.control(range.fechaHasta, { validators: [Validators.required] }),
      busqueda: this.fb.control('')
    });
  }

  ngOnInit(): void {
    this.onBuscar();
  }

  get cargosPagina(): CargoHabitacion[] {
    const start = (this.pageNumber - 1) * this.pageSize;
    return this.cargosFiltrados.slice(start, start + this.pageSize);
  }

  get totalRecords(): number {
    return this.cargosFiltrados.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
  }

  get pageStart(): number {
    return this.totalRecords ? (this.pageNumber - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return this.totalRecords ? Math.min(this.pageNumber * this.pageSize, this.totalRecords) : 0;
  }

  get totalVisible(): number {
    return this.cargosPagina.reduce((sum, cargo) => sum + (Number(cargo.PFD01_MtoTot) || 0), 0);
  }

  onBuscar(): void {
    if (this.filtrosForm.invalid) {
      this.filtrosForm.markAllAsTouched();
      return;
    }

    const value = this.filtrosForm.getRawValue();
    if (value.fechaDesde > value.fechaHasta) {
      this.dateRangeError = 'La fecha desde no puede ser posterior a la fecha hasta.';
      this.cdr.markForCheck();
      return;
    }

    this.dateRangeError = '';
    this.error = null;
    this.loading = true;
    this.hasSearched = true;
    this.pageNumber = 1;
    this.activeRequest?.unsubscribe();
    this.cdr.markForCheck();

    this.activeRequest = this.service
      .consultarPorFechas(this.formatDateToApi(value.fechaDesde), this.formatDateToApi(value.fechaHasta))
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.cargos = response.datos;
          this.aplicarFiltro(value.busqueda);
        },
        error: (error: unknown) => {
          this.cargos = [];
          this.cargosFiltrados = [];
          this.error = error instanceof Error ? error.message : 'No se pudieron consultar los cargos a habitación.';
        }
      });
  }

  onLimpiar(): void {
    this.activeRequest?.unsubscribe();
    const range = this.getDefaultDateRange();
    this.filtrosForm.reset({ ...range, busqueda: '' });
    this.cargos = [];
    this.cargosFiltrados = [];
    this.pageNumber = 1;
    this.pageSize = 10;
    this.loading = false;
    this.hasSearched = false;
    this.error = null;
    this.dateRangeError = '';
    this.cdr.markForCheck();
  }

  onPageSizeChange(value: string): void {
    this.pageSize = Number(value) || 10;
    this.pageNumber = 1;
  }

  changePage(delta: number): void {
    this.pageNumber = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
  }

  verDetalle(cargo: CargoHabitacion): void {
    void this.router.navigate([
      '/restaurante/cargos-habitacion/detalle',
      cargo.PFD01_TipCrgHab,
      cargo.PFD01_NumCrgHab
    ]);
  }

  estadoTexto(estado: number): string {
    return Number(estado) === 1 ? 'Anulado' : 'Activo';
  }

  estadoClass(estado: number): string {
    return Number(estado) === 1 ? 'cargo-estado cargo-estado--anulado' : 'cargo-estado cargo-estado--activo';
  }

  cierreTexto(cierre: number): string {
    return Number(cierre) > 0 ? 'Cerrado' : 'Abierto';
  }

  trackByCargo(_index: number, cargo: CargoHabitacion): string {
    return `${cargo.PFD01_TipCrgHab}-${cargo.PFD01_NumCrgHab}`;
  }

  private aplicarFiltro(value: string): void {
    const search = this.normalizeSearch(value);
    this.cargosFiltrados = !search
      ? [...this.cargos]
      : this.cargos.filter((cargo) =>
          [
            cargo.PFD01_NombrePax,
            cargo.PFD01_CodReserva,
            cargo.PFD01_NumHab,
            cargo.PFD01_NumDocu,
            cargo.PFD01_NumCrgHab
          ]
            .map((field) => this.normalizeSearch(field))
            .some((field) => field.includes(search))
        );
  }

  private getDefaultDateRange(): { fechaDesde: string; fechaHasta: string } {
    const today = new Date();
    return {
      fechaDesde: `${today.getFullYear()}-01-01`,
      fechaHasta: this.formatDateToInput(today)
    };
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateToApi(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  private normalizeSearch(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
