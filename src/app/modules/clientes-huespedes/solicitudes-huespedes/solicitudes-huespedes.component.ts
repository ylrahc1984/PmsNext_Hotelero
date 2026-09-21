import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { ToastService } from 'src/app/core/services/toast.service';
import {
  AccionSolicitudHuesped,
  EstadoSolicitudHuesped,
  SolicitudHuesped,
  SolicitudHuespedKpis
} from './solicitudes-huespedes.models';
import { SolicitudHuespedService } from './solicitudes-huespedes.service';

interface EstadoOption {
  value: EstadoSolicitudHuesped | '';
  label: string;
}

@Component({
  selector: 'app-solicitudes-huespedes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './solicitudes-huespedes.component.html',
  styleUrls: ['./solicitudes-huespedes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SolicitudesHuespedesComponent implements OnInit {
  private readonly service = inject(SolicitudHuespedService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly estadoOptions: EstadoOption[] = [
    { value: '', label: 'Todos' },
    { value: 'PEN', label: 'Pendientes' },
    { value: 'ATE', label: 'En atención' },
    { value: 'COM', label: 'Completadas' },
    { value: 'CAN', label: 'Canceladas' }
  ];
  readonly operationForm = this.fb.nonNullable.group({
    observacionInterna: ['', [Validators.maxLength(1000)]]
  });

  readonly filterForm = this.fb.nonNullable.group({ estado: '', area: '' });
  solicitudes: SolicitudHuesped[] = [];
  filteredSolicitudes: SolicitudHuesped[] = [];
  areas: string[] = [];
  kpis: SolicitudHuespedKpis = { PEN: 0, ATE: 0, COM: 0, CAN: 0 };
  loading = false;
  loadedOnce = false;
  errorMessage = '';
  lastUpdated: Date | null = null;
  operationOpen = false;
  operationBusy = false;
  selectedSolicitud: SolicitudHuesped | null = null;
  selectedAction: AccionSolicitudHuesped | null = null;

  ngOnInit(): void {
    this.filterForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyFilters());
    this.consultar();
  }

  consultar(): void {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = '';
    this.service
      .consultar()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => {
          this.solicitudes = Array.isArray(rows) ? rows : [];
          this.loadedOnce = true;
          this.lastUpdated = new Date();
          this.buildAreaOptions();
          this.applyFilters();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.backendMessage(error) || 'No fue posible cargar las solicitudes. Intente nuevamente.';
          this.toast.error(this.errorMessage);
        }
      });
  }

  applyFilters(): void {
    const { estado, area } = this.filterForm.getRawValue();
    this.filteredSolicitudes = this.solicitudes.filter((solicitud) =>
      (!estado || solicitud.estado === estado) && (!area || solicitud.area === area)
    );
    this.kpis = this.filteredSolicitudes.reduce<SolicitudHuespedKpis>(
      (summary, solicitud) => ({ ...summary, [solicitud.estado]: summary[solicitud.estado] + 1 }),
      { PEN: 0, ATE: 0, COM: 0, CAN: 0 }
    );
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.filterForm.reset({ estado: '', area: '' });
  }

  openOperation(solicitud: SolicitudHuesped, action: AccionSolicitudHuesped): void {
    this.selectedSolicitud = solicitud;
    this.selectedAction = action;
    this.operationForm.reset({ observacionInterna: '' });
    this.operationOpen = true;
    queueMicrotask(() => document.querySelector<HTMLElement>('.request-modal textarea')?.focus());
  }

  closeOperation(): void {
    if (this.operationBusy) return;
    this.operationOpen = false;
    this.selectedSolicitud = null;
    this.selectedAction = null;
  }

  confirmOperation(): void {
    const solicitud = this.selectedSolicitud;
    const action = this.selectedAction;
    if (!solicitud || !action || this.operationForm.invalid || this.operationBusy) return;

    this.operationBusy = true;
    const request = { observacionInterna: this.operationForm.controls.observacionInterna.value.trim() };
    const operation = action === 'atender'
      ? this.service.atender(solicitud.idSolicitud, request)
      : action === 'completar'
        ? this.service.completar(solicitud.idSolicitud, request)
        : this.service.cancelar(solicitud.idSolicitud, request);

    operation.pipe(finalize(() => { this.operationBusy = false; this.cdr.markForCheck(); }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success(`Solicitud #${solicitud.idSolicitud} actualizada correctamente.`);
        this.operationBusy = false;
        this.closeOperation();
        this.consultar();
      },
      error: (error: HttpErrorResponse) => {
        const message = this.backendMessage(error) || 'No fue posible actualizar la solicitud.';
        this.toast.error(message);
        this.consultar();
      }
    });
  }

  actionLabel(action: AccionSolicitudHuesped | null): string {
    return action === 'atender' ? 'Poner en atención' : action === 'completar' ? 'Completar' : 'Cancelar';
  }

  statusLabel(status: EstadoSolicitudHuesped): string {
    return { PEN: 'Pendiente', ATE: 'En atención', COM: 'Completada', CAN: 'Cancelada' }[status];
  }

  statusClass(status: EstadoSolicitudHuesped): string {
    return `status-badge status-badge--${status.toLowerCase()}`;
  }

  elapsedLabel(solicitud: SolicitudHuesped): string {
    const minutes = solicitud.minutosDesdeSolicitud;
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) {
      if (minutes < 60) return `Hace ${minutes} min`;
      return `Hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    }
    const date = new Date(solicitud.fechaSolicitud);
    if (Number.isNaN(date.getTime())) return 'Tiempo no disponible';
    return 'Fecha registrada';
  }

  exactDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  trackById(_: number, solicitud: SolicitudHuesped): number { return solicitud.idSolicitud; }

  private buildAreaOptions(): void {
    this.areas = [...new Set(this.solicitudes.map((item) => item.area?.trim()).filter((area): area is string => Boolean(area)))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private backendMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') return error.error.trim();
    const body = error.error as { mensaje?: string; message?: string; error?: string } | null;
    return body?.mensaje?.trim() || body?.message?.trim() || body?.error?.trim() || '';
  }
}
