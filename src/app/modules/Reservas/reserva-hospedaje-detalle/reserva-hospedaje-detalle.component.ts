import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import {
  ReservaHabitacionDetalle,
  ReservaHabitacionDetalleItem,
  ReservaInclusionDetalleItem,
  ReservaServicioDetalleItem
} from '../interfaces/reserva-habitacion.interface';
import { ReservaHabitacionService } from '../services/reserva-habitacion.service';

@Component({
  selector: 'app-reserva-hospedaje-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './reserva-hospedaje-detalle.component.html',
  styleUrls: ['./reserva-hospedaje-detalle.component.scss']
})
export class ReservaHospedajeDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ReservaHabitacionService);

  readonly codReserva = signal('');
  readonly reserva = signal<ReservaHabitacionDetalle | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly habitaciones = computed(() => this.reserva()?.habitaciones ?? []);
  readonly inclusiones = computed(() => this.reserva()?.inclusiones ?? []);
  readonly servicios = computed(() => this.reserva()?.servicios ?? []);
  readonly moneda = computed(() => this.reserva()?.moneda?.trim() || 'USD');

  readonly cantidadHabitaciones = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.cantHab), 0));
  readonly totalHabitaciones = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.total), 0));
  readonly totalInclusiones = computed(() => this.inclusiones().reduce((total, item) => total + this.toNumber(item.totServ), 0));
  readonly totalServicios = computed(() => this.servicios().reduce((total, item) => total + this.serviceTotal(item), 0));
  readonly totalImpuestos = computed(() => this.servicios().reduce((total, item) => total + this.toNumber(item.impuesto), 0));
  readonly totalPax = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.numPax) * this.toNumber(item.cantHab), 0));
  readonly totalNinos = computed(() => this.habitaciones().reduce((total, item) => total + this.toNumber(item.numChild), 0));
  readonly accionesBloqueadas = computed(() => this.esEstadoBloqueado(this.reserva()?.estado));

  ngOnInit(): void {
    const codReserva = this.route.snapshot.paramMap.get('codReserva')?.trim() ?? '';
    if (!codReserva) {
      void this.router.navigate(['/reservas/consulta-reservas']);
      return;
    }

    this.codReserva.set(codReserva);
    this.loadReserva(codReserva);
  }

  reload(): void {
    const codReserva = this.codReserva();
    if (codReserva) {
      this.loadReserva(codReserva);
    }
  }

  volver(): void {
    void this.router.navigate(['/reservas/consulta-reservas']);
  }

  formatDate(value: string | null | undefined): string {
    return normalizePmsDateDDMMYYYY(value) || 'N/D';
  }

  editarReserva(): void {
    if (this.accionesBloqueadas()) {
      return;
    }

    const codReserva = this.codReserva();
    if (codReserva) {
      void this.router.navigate(['/reservas/editar-hospedaje', codReserva]);
    }
  }

  estadoLabel(estado: string | undefined): string {
    const normalized = (estado ?? '').trim().toUpperCase();
    const labels: Record<string, string> = {
      ABI: 'Abierta',
      CON: 'Confirmada',
      CCR: 'Confirmada',
      CHK: 'Check In',
      IN: 'Check In',
      OUT: 'Check Out',
      ANU: 'Cancelada',
      WLI: 'Lista interna',
      WLT: 'Lista de espera'
    };

    return labels[normalized] ?? (normalized || 'Sin estado');
  }

  estadoClass(estado: string | undefined): string {
    const normalized = (estado ?? '').trim().toUpperCase();
    const classes: Record<string, string> = {
      ABI: 'status-badge status-badge--primary',
      CON: 'status-badge status-badge--success',
      CCR: 'status-badge status-badge--success',
      CHK: 'status-badge status-badge--info',
      IN: 'status-badge status-badge--info',
      OUT: 'status-badge status-badge--muted',
      ANU: 'status-badge status-badge--danger',
      WLI: 'status-badge status-badge--warning',
      WLT: 'status-badge status-badge--warning'
    };

    return classes[normalized] ?? 'status-badge status-badge--muted';
  }

  roomDescription(item: ReservaHabitacionDetalleItem): string {
    return [item.catHabita, item.tipHabita].map((value) => String(value ?? '').trim()).filter(Boolean).join(' / ') || 'Habitacion';
  }

  inclusionDescription(item: ReservaInclusionDetalleItem): string {
    return String(item.desServ ?? item.codServ ?? '').trim() || 'Inclusion';
  }

  serviceDescription(item: ReservaServicioDetalleItem): string {
    return String(item.descripcion ?? item.desServ ?? item.codSrv ?? item.codServ ?? '').trim() || 'Servicio';
  }

  serviceTotal(item: ReservaServicioDetalleItem): number {
    if (item.total != null) {
      return this.toNumber(item.total);
    }

    if (item.totServ != null) {
      return this.toNumber(item.totServ);
    }

    return this.toNumber(item.cantidad) * this.toNumber(item.precio);
  }

  toNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private esEstadoBloqueado(estado: string | undefined): boolean {
    const normalized = (estado ?? '').trim().toUpperCase();
    return normalized === 'ANU' || normalized === 'CANCELADO' || normalized === 'CHK' || normalized === 'IN' || normalized === 'CHECK IN';
  }

  private loadReserva(codReserva: string): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.service
      .getReservaDetalle(codReserva)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detalle) => this.reserva.set(detalle),
        error: (error) => {
          console.error('No se pudo cargar el detalle de la reserva.', error);
          this.reserva.set(null);
          this.errorMessage.set('No se pudo cargar el detalle de la reserva.');
        }
      });
  }
}
