import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ReservaPendiente,
  ReservasFacturacionService
} from 'src/app/finanzas/services/reservas-facturacion.service';

@Component({
  selector: 'app-reserva-pendiente-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reserva-pendiente-modal.component.html',
  styleUrls: ['./reserva-pendiente-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReservaPendienteModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() reservaSeleccionada = new EventEmitter<{ codReserva: string; codAgencia: string }>();

  private readonly fb = inject(FormBuilder);
  private readonly reservasService = inject(ReservasFacturacionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.group({
    fechaInicio: this.fb.nonNullable.control(this.getMonthStartIsoDate()),
    fechaFin: this.fb.nonNullable.control(this.getTodayIsoDate())
  });

  reservas: ReservaPendiente[] = [];
  reservasLoading = false;
  errorMessage: string | null = null;

  page = 1;
  pageSize = 6;
  totalPages = 1;
  totalRegistros = 0;

  private requestId = 0;
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.page = 1;
      this.ensureDefaultDates();
      this.buscarReservas(true);
    }
    if (openChange?.currentValue === false) {
      this.cancelPending();
    }
  }

  onClose(): void {
    this.cancelPending();
    this.close.emit();
  }

  buscarReservas(resetPage = false): void {
    if (resetPage) {
      this.page = 1;
    }
    const currentRequest = ++this.requestId;
    this.reservasLoading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
    }
    this.loadingTimeoutId = setTimeout(() => {
      if (currentRequest === this.requestId) {
        this.reservasLoading = false;
        this.cdr.markForCheck();
      }
    }, 12000);

    this.reservasService
      .getPendientes(
        this.form.controls.fechaInicio.value,
        this.form.controls.fechaFin.value,
        this.page,
        this.pageSize
      )
      .pipe(
        finalize(() => {
          if (currentRequest === this.requestId) {
            this.reservasLoading = false;
            if (this.loadingTimeoutId) {
              clearTimeout(this.loadingTimeoutId);
              this.loadingTimeoutId = null;
            }
            this.cdr.markForCheck();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.reservas = response?.datos ?? [];
          this.totalRegistros = response?.paginacion?.totalRegistros ?? 0;
          this.totalPages = response?.paginacion?.totalPaginas ?? 1;
          this.page = response?.paginacion?.paginaActual ?? this.page;
          this.pageSize = response?.paginacion?.pageSize ?? this.pageSize;
          this.reservasLoading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          if (currentRequest !== this.requestId) {
            return;
          }
          this.reservas = [];
          this.totalRegistros = 0;
          this.totalPages = 1;
          this.reservasLoading = false;
          this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar las reservas.';
          this.cdr.markForCheck();
        }
      });
  }

  seleccionarReserva(reserva: ReservaPendiente): void {
    if (!reserva?.codReserva) {
      return;
    }
    this.reservasLoading = false;
    this.reservaSeleccionada.emit({ codReserva: reserva.codReserva, codAgencia: reserva.codAgencia });
    this.close.emit();
  }

  paginaAnterior(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.buscarReservas();
    }
  }

  paginaSiguiente(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.buscarReservas();
    }
  }

  ngOnDestroy(): void {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private ensureDefaultDates(): void {
    if (!this.form.controls.fechaInicio.value) {
      this.form.controls.fechaInicio.setValue(this.getMonthStartIsoDate(), { emitEvent: false });
    }
    if (!this.form.controls.fechaFin.value) {
      this.form.controls.fechaFin.setValue(this.getTodayIsoDate(), { emitEvent: false });
    }
  }

  private cancelPending(): void {
    this.requestId += 1;
    this.reservasLoading = false;
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
    this.cdr.markForCheck();
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getMonthStartIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}-01`;
  }
}
