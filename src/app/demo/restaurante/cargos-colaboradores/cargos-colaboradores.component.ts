import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  CargoColaborador,
  ConsumoColaboradorRequest,
  RestaurantCollaboratorChargeService
} from '../services/restaurant-collaborator-charge.service';

type CargosColaboradoresForm = {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  colaborador: FormControl<string>;
};

@Component({
  selector: 'app-cargos-colaboradores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './cargos-colaboradores.component.html',
  styleUrls: ['./cargos-colaboradores.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargosColaboradoresComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(RestaurantCollaboratorChargeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSizeOptions = [10, 15, 20];
  readonly filtrosForm: FormGroup<CargosColaboradoresForm>;

  cargos: CargoColaborador[] = [];
  cargosFiltrados: CargoColaborador[] = [];
  pageNumber = 1;
  pageSize = 10;
  loading = false;
  hasSearched = false;
  error: string | null = null;
  dateRangeError = '';

  anulandoKey: string | null = null;
  private activeRequest?: Subscription;

  constructor() {
    const range = this.getDefaultDateRange();
    this.filtrosForm = this.fb.group({
      fechaDesde: this.fb.control(range.fechaDesde, { validators: [Validators.required] }),
      fechaHasta: this.fb.control(range.fechaHasta, { validators: [Validators.required] }),
      colaborador: this.fb.control('')
    });
  }

  ngOnInit(): void {
    this.onBuscar();
  }

  get cargosPagina(): CargoColaborador[] {
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
    return this.cargosPagina.reduce((sum, cargo) => sum + (Number(cargo.PPV10_TotalDocu) || 0), 0);
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
    this.loading = true;
    this.error = null;
    this.hasSearched = true;
    this.pageNumber = 1;
    this.cdr.markForCheck();

    this.activeRequest?.unsubscribe();
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
        next: (cargos) => {
          this.cargos = cargos ?? [];
          this.aplicarFiltroColaborador(value.colaborador);
        },
        error: (error: unknown) => {
          this.cargos = [];
          this.cargosFiltrados = [];
          this.error = this.getErrorMessage(error, 'No se pudieron consultar los cargos a colaboradores.');
        }
      });
  }

  onLimpiar(): void {
    this.activeRequest?.unsubscribe();
    const range = this.getDefaultDateRange();
    this.filtrosForm.reset({ ...range, colaborador: '' });
    this.dateRangeError = '';
    this.error = null;
    this.cargos = [];
    this.cargosFiltrados = [];
    this.pageNumber = 1;
    this.pageSize = 10;
    this.hasSearched = false;
    this.cdr.markForCheck();
  }

  onPageSizeChange(value: string): void {
    this.pageSize = Number(value) || 10;
    this.pageNumber = 1;
  }

  changePage(delta: number): void {
    this.pageNumber = Math.min(Math.max(this.pageNumber + delta, 1), this.totalPages);
  }

  verDetalle(cargo: CargoColaborador): void {
    void this.router.navigate([
      '/restaurante/cargos-colaboradores/detalle',
      cargo.PPV10_TipOpe,
      cargo.PPV10_NumOpe
    ]);
  }

  async anular(cargo: CargoColaborador): Promise<void> {
    if (!this.puedeAnular(cargo) || this.anulandoKey) return;

    const confirmation = await Swal.fire({
      title: 'Anular cargo a colaborador',
      html: `Se anulará la operación <strong>${cargo.PPV10_NumOpe}</strong> de <strong>${cargo.PPV10_NomColabora}</strong>.`,
      input: 'textarea',
      inputLabel: 'Motivo de anulación',
      inputPlaceholder: 'Indique el motivo de la anulación',
      inputAttributes: { maxlength: '200' },
      showCancelButton: true,
      confirmButtonText: 'Anular cargo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      icon: 'warning',
      preConfirm: (value) => {
        const motivo = String(value ?? '').trim();
        if (motivo.length < 5) {
          Swal.showValidationMessage('El motivo debe contener al menos 5 caracteres.');
          return false;
        }
        return motivo;
      }
    });

    if (!confirmation.isConfirmed || !confirmation.value) return;

    const key = this.getCargoKey(cargo);
    this.anulandoKey = key;
    this.cdr.markForCheck();
    this.service
      .anularConsumo(this.buildAnulacionPayload(cargo, String(confirmation.value)))
      .pipe(
        finalize(() => {
          this.anulandoKey = null;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          void Swal.fire('Cargo anulado', response.mensaje || 'El cargo fue anulado correctamente.', 'success');
          this.onBuscar();
        },
        error: (error: unknown) => {
          void Swal.fire('No se pudo anular', this.getErrorMessage(error, 'No se pudo anular el cargo.'), 'error');
        }
      });
  }

  puedeAnular(cargo: CargoColaborador): boolean {
    const estado = (cargo.PPV10_EstDocu || '').trim().toUpperCase();
    return estado !== 'ANU' && estado !== 'A' && !estado.includes('ANUL');
  }

  isAnulando(cargo: CargoColaborador): boolean {
    return this.anulandoKey === this.getCargoKey(cargo);
  }

  estadoClass(estado: string): string {
    const normalized = (estado || '').trim().toUpperCase();
    if (normalized === 'PEN' || normalized === 'P') return 'cargo-estado cargo-estado--pendiente';
    if (normalized === 'ANU' || normalized === 'A' || normalized.includes('ANUL')) return 'cargo-estado cargo-estado--anulado';
    if (normalized === 'PAG' || normalized === 'C') return 'cargo-estado cargo-estado--completado';
    return 'cargo-estado';
  }

  trackByCargo(_index: number, cargo: CargoColaborador): string {
    return `${cargo.PPV10_TipOpe}-${cargo.PPV10_NumOpe}`;
  }

  private aplicarFiltroColaborador(value: string): void {
    const search = this.normalizeSearch(value);
    this.cargosFiltrados = !search
      ? [...this.cargos]
      : this.cargos.filter((cargo) =>
          [cargo.PPV10_NomColabora, cargo.PPV10_CodCola, cargo.PPV10_RucCola]
            .map((field) => this.normalizeSearch(field))
            .some((field) => field.includes(search))
        );
  }

  private buildAnulacionPayload(cargo: CargoColaborador, motivo: string): ConsumoColaboradorRequest {
    return {
      proceso: 3,
      tipOpe: cargo.PPV10_TipOpe,
      numOpe: cargo.PPV10_NumOpe,
      pntVta: cargo.PPV10_PntVenta,
      fecha: this.formatApiDate(cargo.PPV10_Fecha),
      hora: cargo.PPV10_Hora,
      vendedor: cargo.PPV10_CodVendedor,
      codColabora: cargo.PPV10_CodCola,
      rucColabora: cargo.PPV10_RucCola,
      nomColabora: motivo.trim(),
      direccion: cargo.PPV10_Direccion,
      totDocu: Number(cargo.PPV10_TotalDocu) || 0,
      estado: cargo.PPV10_EstDocu,
      moneda: cargo.PPV10_Moneda,
      tCambio: Number(cargo.PPV10_TCambio) || 0,
      lPrecio: cargo.PPV10_LPrecio,
      tipNP: cargo.PPV10_TipoNDP,
      serieNP: cargo.PPV10_SerieNDP,
      numNP: cargo.PPV10_NumeroNDP,
      numCuenta: 0,
      operador: this.auth.getCurrentUser()?.usuario?.trim() || cargo.PPV10_Operador || 'charly'
    };
  }

  private getDefaultDateRange(): { fechaDesde: string; fechaHasta: string } {
    const today = new Date();
    const currentDate = this.formatDateToInput(today);
    return {
      fechaDesde: currentDate,
      fechaHasta: currentDate
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

  private formatApiDate(value: string): string {
    const raw = (value || '').split('T')[0].split(' ')[0];
    return this.formatDateToApi(raw);
  }

  private normalizeSearch(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private getCargoKey(cargo: CargoColaborador): string {
    return `${cargo.PPV10_TipOpe}-${cargo.PPV10_NumOpe}`;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return fallback;
  }
}
