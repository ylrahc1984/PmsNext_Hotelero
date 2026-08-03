import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { RoomChargePosPrintService } from 'src/app/modules/front-desk/pages/room-stay-management/printing/room-charge-pos-print.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { CargoIncluido, CargoIncluidoConsultaService, CargoIncluidoDetalle } from './cargo-incluido-consulta.service';

type CargosIncluidosForm = {
  fechaDesde: FormControl<string>;
  fechaHasta: FormControl<string>;
  busqueda: FormControl<string>;
};

@Component({
  selector: 'app-cargos-incluidos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './cargos-incluidos.component.html',
  styleUrls: ['./cargos-incluidos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargosIncluidosComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly service = inject(CargoIncluidoConsultaService);
  private readonly printService = inject(RoomChargePosPrintService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly pageSizeOptions = [10, 20, 30];
  readonly filtrosForm: FormGroup<CargosIncluidosForm>;

  cargos: CargoIncluido[] = [];
  cargosFiltrados: CargoIncluido[] = [];
  pageNumber = 1;
  pageSize = 10;
  loading = false;
  hasSearched = false;
  error: string | null = null;
  dateRangeError = '';
  reprinting = new Set<string>();
  anulandoKey: string | null = null;

  selectedCargo: CargoIncluido | null = null;
  detailHeader: CargoIncluido | null = null;
  detailItems: CargoIncluidoDetalle[] = [];
  detailLoading = false;
  detailError = '';

  private activeRequest?: Subscription;
  private detailRequest?: Subscription;

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

  get cargosPagina(): CargoIncluido[] {
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
    return this.cargosPagina.reduce((sum, cargo) => sum + (Number(cargo.PFD03_MtoTot) || 0), 0);
  }

  get detailTotal(): number {
    return this.detailItems.reduce((sum, item) => sum + (Number(item.PFD04_Total) || 0), 0);
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
        next: (cargos) => {
          this.cargos = cargos;
          this.aplicarFiltro(value.busqueda);
        },
        error: (error: unknown) => {
          this.cargos = [];
          this.cargosFiltrados = [];
          this.error = this.getErrorMessage(error, 'No se pudieron consultar los cargos incluidos.');
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

  verDetalle(cargo: CargoIncluido): void {
    this.selectedCargo = cargo;
    this.detailHeader = null;
    this.detailItems = [];
    this.detailError = '';
    this.detailLoading = true;
    this.detailRequest?.unsubscribe();
    this.cdr.markForCheck();

    this.detailRequest = this.service
      .consultarDetalle(cargo.PFD03_TipCrgInc, cargo.PFD03_NumCrgInc)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.detailHeader = response.encabezado ?? null;
          this.detailItems = response.detalle ?? [];
          if (!this.detailHeader) this.detailError = 'No se encontró el encabezado del cargo incluido.';
        },
        error: (error: unknown) => {
          this.detailError = this.getErrorMessage(error, 'No se pudo consultar el detalle del cargo incluido.');
        }
      });
  }

  cerrarDetalle(): void {
    this.detailRequest?.unsubscribe();
    this.selectedCargo = null;
    this.detailHeader = null;
    this.detailItems = [];
    this.detailLoading = false;
    this.detailError = '';
    this.cdr.markForCheck();
  }

  async reimprimirCargo(cargo: CargoIncluido): Promise<void> {
    const key = this.cargoKey(cargo);
    if (this.reprinting.has(key)) return;

    const confirmation = await Swal.fire({
      title: 'Reimprimir cargo incluido',
      text: `Se enviará una copia del cargo ${cargo.PFD03_TipCrgInc} ${cargo.PFD03_NumCrgInc} a TIQUETE.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reimprimir',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!confirmation.isConfirmed) return;

    this.reprinting.add(key);
    this.cdr.markForCheck();
    try {
      await this.printService.printByOperation(cargo.PFD03_TipCrgInc, cargo.PFD03_NumCrgInc, 'TIQUETE', 'REIMPRESION');
      await Swal.fire('Cargo reimpreso', 'La copia fue enviada correctamente a TIQUETE.', 'success');
    } catch (error: unknown) {
      await Swal.fire('No se pudo reimprimir', this.getErrorMessage(error, 'Verifique QZ Tray y la impresora TIQUETE.'), 'error');
    } finally {
      this.reprinting.delete(key);
      this.cdr.markForCheck();
    }
  }

  async anularCargo(cargo: CargoIncluido): Promise<void> {
    if (!this.puedeAnular(cargo) || this.anulandoKey) return;

    const confirmation = await Swal.fire({
      title: 'Anular cargo incluido',
      html: `Se anulará la operación <strong>${cargo.PFD03_NumCrgInc}</strong> de <strong>${cargo.PFD03_NombrePax}</strong>.`,
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

    this.anulandoKey = this.cargoKey(cargo);
    this.cdr.markForCheck();
    const operador = this.auth.getCurrentUser()?.usuario?.trim() || cargo.PFD03_Operador || 'admin';
    this.service
      .anular(cargo, String(confirmation.value), operador)
      .pipe(
        finalize(() => {
          this.anulandoKey = null;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          void Swal.fire('Cargo anulado', response.mensaje || response.message || response.respuesta || 'El cargo fue anulado correctamente.', 'success');
          this.onBuscar();
        },
        error: (error: unknown) => {
          void Swal.fire('No se pudo anular', this.getErrorMessage(error, 'No se pudo anular el cargo incluido.'), 'error');
        }
      });
  }

  puedeAnular(cargo: CargoIncluido): boolean {
    return Number(cargo.PFD03_Cierre) === 0;
  }

  isReprinting(cargo: CargoIncluido): boolean {
    return this.reprinting.has(this.cargoKey(cargo));
  }

  isAnulando(cargo: CargoIncluido): boolean {
    return this.anulandoKey === this.cargoKey(cargo);
  }

  cierreTexto(cierre: number): string {
    return Number(cierre) > 0 ? 'Cerrado' : 'Abierto';
  }

  trackByCargo(_index: number, cargo: CargoIncluido): string {
    return `${cargo.PFD03_TipCrgInc}-${cargo.PFD03_NumCrgInc}`;
  }

  trackByDetail(index: number, item: CargoIncluidoDetalle): string {
    return `${index}-${item.PFD04_CodConsumo ?? ''}`;
  }

  private aplicarFiltro(value: string): void {
    const search = this.normalizeSearch(value);
    this.cargosFiltrados = !search
      ? [...this.cargos]
      : this.cargos.filter((cargo) =>
          [cargo.PFD03_NombrePax, cargo.PFD03_CodReserva, cargo.PFD03_NumHab, cargo.PFD03_NumDocu, cargo.PFD03_NumCrgInc]
            .map((field) => this.normalizeSearch(field))
            .some((field) => field.includes(search))
        );
  }

  private getDefaultDateRange(): { fechaDesde: string; fechaHasta: string } {
    const value = this.formatDateToInput(new Date());
    return { fechaDesde: value, fechaHasta: value };
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
    return String(value ?? '').trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private cargoKey(cargo: CargoIncluido): string {
    return `${cargo.PFD03_TipCrgInc}-${cargo.PFD03_NumCrgInc}`;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
  }
}
