import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { RestaurantRoomChargePrintService } from '../../printing/restaurant-room-charge-print.service';
import {
  NotaPedidoRestauranteService,
  RestaurantCreditRoom,
  RestaurantRoomChargePayload,
  RestaurantRoomChargeResponse
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
  respuesta?: RestaurantRoomChargeResponse;
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
  private readonly printService = inject(RestaurantRoomChargePrintService);
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

    try {
      const respuesta = await firstValueFrom(this.service.registrarCargoHabitacion(payload));
      console.log('[RestaurantRoomChargeDialog] guardar response', respuesta);

      const guardado = respuesta?.success === true
        || (respuesta?.respuesta || '').trim().toUpperCase() === 'OK';

      if (!guardado) {
        this.errorMessage = respuesta?.message
          || respuesta?.mensaje
          || respuesta?.respuesta
          || 'El servidor no confirmó el registro del cargo.';
        await this.showResultDialog('No se pudo registrar', this.errorMessage, 'error');
        return;
      }

      const tipoOperacion = (respuesta.tipCrgHab || respuesta.tipoOperacion || '').trim();
      const numeroOperacion = (respuesta.numCrgHab || respuesta.numeroOperacion || '').trim();
      let printError = '';

      if (!tipoOperacion || !numeroOperacion) {
        printError = 'La respuesta no incluyó el tipo y número de operación necesarios para imprimir.';
      } else {
        try {
          await this.printService.printByOperation(tipoOperacion, numeroOperacion, 'TIQUETE');
        } catch (error: unknown) {
          console.error('El cargo fue guardado, pero no se pudo imprimir:', error);
          printError = this.getErrorMessage(error);
        }
      }

      if (printError) {
        await this.showResultDialog(
          'Cargo registrado; impresión pendiente',
          `El cargo a la habitación ${habitacion.numHabita} fue guardado, pero no se pudo imprimir en TIQUETE. ${printError}`,
          'warning'
        );
      } else {
        await this.showResultDialog(
          'Cargo registrado e impreso',
          `El cargo a la habitación ${habitacion.numHabita} se guardó e imprimió correctamente. Operación ${tipoOperacion} ${numeroOperacion}.`,
          'success'
        );
      }

      this.closed.emit({
        guardado: true,
        habitacion,
        numeroCargoHabitacion: numeroOperacion,
        respuesta
      });
    } catch (error: unknown) {
      console.error('Error al registrar cargo a habitación:', error);
      this.errorMessage = 'No se pudo registrar el cargo a la habitación.';
      await this.showResultDialog('No se pudo registrar', this.errorMessage, 'error');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
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

  private async showResultDialog(
    title: string,
    text: string,
    icon: 'success' | 'warning' | 'error'
  ): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon,
      confirmButtonText: 'Aceptar',
      customClass: {
        container: 'next-confirm-container',
        popup: 'next-confirm-modal'
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    return 'Verifique QZ Tray y la impresora configurada.';
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
