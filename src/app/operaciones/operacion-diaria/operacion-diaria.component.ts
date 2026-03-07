import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, filter, finalize, map, merge, of, shareReplay, startWith, switchMap } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OperacionDiariaService, OperacionDiariaParams } from './operacion-diaria.service';
import { AuthService } from 'src/app/core/services/auth.service';
import {
  BloqueHora,
  OperacionDetalle,
  OperacionDiariaResponse,
  ResumenActividadHora
} from './models/operacion-diaria.model';

interface OperacionDiariaViewState {
  loading: boolean;
  error: string | null;
  data: OperacionDiariaResponse | null;
}

@Component({
  selector: 'app-operacion-diaria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SharedModule],
  templateUrl: './operacion-diaria.component.html',
  styleUrls: ['./operacion-diaria.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperacionDiariaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly operacionDiariaService = inject(OperacionDiariaService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  readonly today = this.toDateInput(new Date());

  readonly form = this.fb.group({
    fechaInicio: this.fb.control(this.today, { validators: [Validators.required], nonNullable: true }),
    fechaFin: this.fb.control(this.today, { validators: [Validators.required], nonNullable: true }),
    busqueda: this.fb.control('', { nonNullable: true }),
    agenciaId: this.fb.control<string | null>(null),
    choferId: this.fb.control<string | null>(null)
  });

  readonly autoRefresh = false;
  readonly pageSizes = [25, 50, 100];
  page = 1;
  pageSize = 50;
  totalRegistros = 0;
  checkingIn = new Set<number | string>();

  private readonly manualRefresh$ = new Subject<void>();
  private readonly autoRefresh$ = this.form.valueChanges.pipe(
    debounceTime(350),
    filter(() => this.autoRefresh),
    filter(() => this.form.valid),
    map(() => {
      this.page = 1;
      return void 0;
    })
  );

  private readonly refresh$ = merge(this.manualRefresh$, this.autoRefresh$).pipe(startWith(void 0));
  private resumenPorHora = new Map<string, ResumenActividadHora[]>();

  readonly vm$: Observable<OperacionDiariaViewState> = this.refresh$.pipe(
    map(() => this.buildParams()),
    switchMap((params) =>
      this.operacionDiariaService.getOperacionDiaria(params).pipe(
        map((data) => {
          this.totalRegistros = data?.totalRegistros ?? 0;
          const totalPages = this.totalPaginas(this.totalRegistros);
          if (this.page > totalPages && totalPages > 0) {
            this.page = totalPages;
            this.manualRefresh$.next();
          }
          this.resumenPorHora = this.buildResumenMap(data?.resumenActividadPorHora ?? []);
          return { loading: false, error: null, data };
        }),
        startWith({ loading: true, error: null, data: null }),
        catchError(() => of({ loading: false, error: 'No se pudo cargar la operacion diaria.', data: null }))
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  buscar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.page = 1;
    this.manualRefresh$.next();
  }

  setHoy(): void {
    this.form.patchValue({
      fechaInicio: this.today,
      fechaFin: this.today
    });
    this.buscar();
  }

  changePage(delta: number): void {
    const next = this.page + delta;
    const totalPages = this.totalPaginas(this.totalRegistros);
    if (next < 1 || next > totalPages) {
      return;
    }
    this.page = next;
    this.manualRefresh$.next();
  }

  onPageSizeChange(size: number): void {
    const nextSize = Number(size) || this.pageSize;
    if (nextSize === this.pageSize) {
      return;
    }
    this.pageSize = nextSize;
    this.page = 1;
    this.manualRefresh$.next();
  }

  totalPaginas(totalRegistros: number): number {
    const total = totalRegistros ?? 0;
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  get pageStart(): number {
    return this.totalRegistros ? this.pageSize * (this.page - 1) + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.totalRegistros);
  }

  getResumenPorHora(hora: string): ResumenActividadHora[] {
    return this.resumenPorHora.get(hora) ?? [];
  }

  getEstadoBadge(estado: string): string {
    const code = (estado ?? '').toString().trim().toUpperCase();
    if (code === 'CHK') return 'bg-info';
    if (code === 'CON') return 'bg-success';
    if (code === 'PEN') return 'bg-warning text-dark';
    if (code === 'CAN') return 'bg-danger';
    return 'bg-secondary';
  }

  isTransporteAsignado(detalle: OperacionDetalle): boolean {
    const raw = (detalle?.procesado ?? 0) as unknown;
    if (raw === true) return true;
    if (raw === false || raw === null || raw === undefined) return false;
    return Number(raw) === 1;
  }

  getEstadoTransporte(detalle: OperacionDetalle): string {
    return this.isTransporteAsignado(detalle) ? 'Asignado' : 'Sin asignar';
  }

  getTransporteBadge(detalle: OperacionDetalle): string {
    return this.isTransporteAsignado(detalle) ? 'bg-success' : 'bg-secondary';
  }

  isCheckInRealizado(detalle: OperacionDetalle): boolean {
    const estado = (detalle?.estado ?? '').toString().trim().toUpperCase();
    return estado === 'CHK';
  }

  isCheckingIn(detalle: OperacionDetalle): boolean {
    return this.checkingIn.has(this.getDetalleKey(detalle));
  }

  onCheckIn(detalle: OperacionDetalle): void {
    if (!detalle?.prV02_CodReserva || this.isCheckInRealizado(detalle)) {
      return;
    }
    Swal.fire({
      title: 'Confirmar Check In',
      text: `Desea marcar la reserva ${detalle.prV02_CodReserva} como Check In?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.executeCheckIn(detalle);
    });
  }

  private executeCheckIn(detalle: OperacionDetalle): void {
    const key = this.getDetalleKey(detalle);
    const operador = this.getOperador();

    this.checkingIn.add(key);
    this.http
      .post('http://localhost:5000/api/reserva/checkin', {
        codReserva: detalle.prV02_CodReserva,
        operador
      })
      .pipe(finalize(() => this.checkingIn.delete(key)))
      .subscribe({
        next: () => {
          detalle.estado = 'CHK';
          Swal.fire({
            title: 'Check In realizado',
            text: `Reserva ${detalle.prV02_CodReserva} actualizada.`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
          this.buscar();
        },
        error: (error) => {
          console.error('Error haciendo check in:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo hacer Check In de la reserva.',
            icon: 'error'
          });
        }
      });
  }

  getServiceColor(codServicio: string): string {
    const code = (codServicio ?? '').toString().trim().toUpperCase();
    if (code.startsWith('TOU') || code.startsWith('TUR') || code.startsWith('TOUR')) return 'chip--tours';
    if (code.startsWith('TR') || code.startsWith('TRA') || code.startsWith('TRANS')) return 'chip--transporte';
    if (code.startsWith('EX') || code.startsWith('EXT') || code.startsWith('ADV')) return 'chip--extremo';
    return 'chip--otro';
  }

  trackByBloque(index: number, bloque: BloqueHora): string {
    return bloque.bloqueHora || `bloque-${index}`;
  }

  trackByDetalle(index: number, detalle: OperacionDetalle): number | string {
    return detalle.prV02_ID ?? `${detalle.prV02_CodReserva}-${index}`;
  }

  trackByResumen(index: number, resumen: ResumenActividadHora): string {
    return `${resumen.bloqueHora}-${resumen.codServicio}-${index}`;
  }

  private getDetalleKey(detalle: OperacionDetalle): number | string {
    return detalle.prV02_ID ?? detalle.prV02_CodReserva ?? 'detalle';
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return user?.usuario || user?.nombre || 'Admin';
  }

  private buildParams(): OperacionDiariaParams {
    const value = this.form.getRawValue();
    return {
      fechaInicio: this.formatDateForApi(value.fechaInicio),
      fechaFin: this.formatDateForApi(value.fechaFin),
      busqueda: this.normalizeOptional(value.busqueda),
      agenciaId: this.normalizeOptional(value.agenciaId),
      choferId: this.normalizeOptional(value.choferId),
      page: this.page,
      pageSize: this.pageSize
    };
  }

  private normalizeOptional(value: string | null | undefined): string | undefined {
    const normalized = (value ?? '').toString().trim();
    return normalized ? normalized : undefined;
  }

  private formatDateForApi(value: string): string {
    const normalized = (value ?? '').toString().trim();
    if (!normalized) {
      return '';
    }
    if (normalized.includes('/')) {
      return normalized;
    }
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (yyyy && mm && dd) {
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return normalized;
  }

  private buildResumenMap(items: ResumenActividadHora[]): Map<string, ResumenActividadHora[]> {
    const mapByHora = new Map<string, ResumenActividadHora[]>();
    items.forEach((item) => {
      const key = item.bloqueHora || '';
      if (!mapByHora.has(key)) {
        mapByHora.set(key, []);
      }
      mapByHora.get(key)!.push(item);
    });
    return mapByHora;
  }

  private toDateInput(date: Date): string {
    const yyyy = date.getFullYear().toString().padStart(4, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
