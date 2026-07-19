import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  NotaPedidoRestauranteService,
  RestaurantCreditRoom,
  RestaurantRoomChargePayload
} from '../../services/nota-pedido-restaurante.service';

export interface RestaurantRoomChargeDialogData {
  puntoVenta: string;
  total: number;
  moneda: string;
  tipNP: string;
  serieNP: string;
  numNP: string;
  numCuenta: number;
  operador: string;
}

export interface RestaurantRoomChargeDialogResult {
  guardado: boolean;
  habitacion: RestaurantCreditRoom;
  numeroCargoHabitacion: string;
  respuesta?: unknown;
}

@Component({
  selector: 'app-restaurant-room-charge-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-room-charge-dialog.component.html',
  styleUrls: ['./restaurant-room-charge-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantRoomChargeDialogComponent implements OnInit {
  private readonly service = inject(NotaPedidoRestauranteService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) data!: RestaurantRoomChargeDialogData;
  @Output() closed = new EventEmitter<RestaurantRoomChargeDialogResult | null>();

  habitaciones: RestaurantCreditRoom[] = [];
  habitacionSeleccionada: RestaurantCreditRoom | null = null;
  busqueda = '';
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.cargarHabitaciones();
  }

  get habitacionesFiltradas(): RestaurantCreditRoom[] {
    const term = this.normalize(this.busqueda);
    if (!term) {
      return this.habitaciones;
    }

    return this.habitaciones.filter((item) =>
      this.normalize(`${item.numHabita} ${item.numFolio} ${item.codReserva} ${item.nomPax} ${item.tipHabi}`).includes(term)
    );
  }

  seleccionarHabitacion(item: RestaurantCreditRoom): void {
    if (!this.saving) {
      this.habitacionSeleccionada = item;
      this.errorMessage = '';
    }
  }

  async confirmar(): Promise<void> {
    if (!this.habitacionSeleccionada || this.saving) {
      this.errorMessage = 'Seleccione una habitación para continuar.';
      this.cdr.markForCheck();
      return;
    }

    const habitacion = this.habitacionSeleccionada;
    const confirmation = await Swal.fire({
      title: 'Confirmar cargo a habitación',
      text: `Se registrará un cargo por ${this.formatTotal()} a la habitación ${habitacion.numHabita}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar cargo',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { container: 'next-confirm-container', popup: 'next-confirm-modal' }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const payload = this.buildRequest(habitacion);
    this.saving = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.service.registrarCargoHabitacion(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (respuesta) => {
          void Swal.fire({
            title: 'Cargo registrado',
            text: `El cargo a la habitación ${habitacion.numHabita} se guardó correctamente.`,
            icon: 'success',
            confirmButtonText: 'Aceptar',
            customClass: { container: 'next-confirm-container', popup: 'next-confirm-modal' }
          }).then(() => this.closed.emit({
            guardado: true,
            habitacion,
            numeroCargoHabitacion: payload.numHab,
            respuesta
          }));
        },
        error: (error) => {
          console.error('Error al registrar cargo a habitación:', error);
          this.errorMessage = 'No se pudo registrar el cargo a la habitación.';
          void Swal.fire({
            title: 'No se pudo registrar',
            text: this.errorMessage,
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: { container: 'next-confirm-container', popup: 'next-confirm-modal' }
          });
        }
      });
  }

  cerrar(): void {
    if (!this.saving) {
      this.closed.emit(null);
    }
  }

  trackByHabitacion(_: number, item: RestaurantCreditRoom): string {
    return `${item.codReserva}-${item.numFolio || item.numHabita}`;
  }

  formatTotal(): string {
    return `${this.data.moneda} ${Number(this.data.total || 0).toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  private cargarHabitaciones(): void {
    this.loading = true;
    this.errorMessage = '';
    this.service.obtenerHabitacionesConCredito()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.habitaciones = items.map((item) => this.cleanRoom(item));
          if (!this.habitaciones.length) {
            this.errorMessage = 'No hay habitaciones con crédito disponibles.';
          }
        },
        error: (error) => {
          console.error('Error al cargar habitaciones con crédito:', error);
          this.habitaciones = [];
          this.errorMessage = 'No se pudieron cargar las habitaciones con crédito.';
        }
      });
  }

  private buildRequest(room: RestaurantCreditRoom): RestaurantRoomChargePayload {
    const now = new Date();
    const numeroCargo = this.clean(room.numFolio) || this.clean(room.numHabita);
    return {
      proceso: 0,
      tipCrgHab: 'CH',
      numCrgHab: 'GENERA',
      codRsv: this.clean(room.codReserva),
      numHab: numeroCargo,
      pntVenta: this.clean(this.data.puntoVenta || 'PF'),
      fecha: this.formatDate(now),
      hora: this.formatTime(now),
      numDocu: this.clean(room.codReserva),
      nombrePax: this.cleanGuestName(room.nomPax) || 'HUESPED',
      mtoTotal: Number(this.data.total || 0),
      moneda: this.clean(this.data.moneda || room.monedaTar || 'USD'),
      cierre: 0,
      numCierre: 0,
      tipNP: this.clean(this.data.tipNP),
      serieNP: this.clean(this.data.serieNP),
      numNP: this.clean(this.data.numNP),
      numCuenta: Number(this.data.numCuenta || 0),
      operador: this.clean(this.data.operador)
    };
  }

  private cleanRoom(item: RestaurantCreditRoom): RestaurantCreditRoom {
    const stringFields = ['numHabita', 'codReserva', 'codAgen', 'codTarifa', 'codPlan', 'catHabi', 'tipHabi', 'fechaIng',
      'fechaSal', 'monedaLmt', 'tarjeta', 'vence', 'autoriza', 'monedaTar', 'folio', 'numFolio', 'comentarios', 'operador', 'nomPax'] as const;
    const room = { ...item };
    stringFields.forEach((field) => room[field] = this.clean(room[field]));
    return room;
  }

  private cleanGuestName(value: unknown): string {
    return this.clean(value).replace(/^\s*\/\s*/, '').replace(/\s*\/\s*/g, ', ');
  }

  private formatDate(date: Date): string {
    return `${date.getDate()}`.padStart(2, '0') + '/' + `${date.getMonth() + 1}`.padStart(2, '0') + '/' + date.getFullYear();
  }

  private formatTime(date: Date): string {
    return `${date.getHours()}`.padStart(2, '0') + ':' + `${date.getMinutes()}`.padStart(2, '0');
  }

  private normalize(value: unknown): string {
    return this.clean(value).toLocaleLowerCase('es-CR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private clean(value: unknown): string {
    return (value ?? '').toString().replace(/\s+/g, ' ').trim();
  }
}
