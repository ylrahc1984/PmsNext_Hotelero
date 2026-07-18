import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  ColaboradorConsumo,
  ConsumoColaboradorRequest,
  RestaurantCollaboratorChargeService
} from '../../services/restaurant-collaborator-charge.service';

export interface RestaurantCollaboratorChargeDialogData {
  puntoVenta: string;
  vendedor: string;
  total: number;
  moneda: string;
  tipoCambio: number;
  listaPrecio: string;
  tipNP: string;
  serieNP: string;
  numNP: string;
  numCuenta: number;
  operador: string;
}

export interface RestaurantCollaboratorChargeDialogResult {
  guardado: boolean;
  colaborador: ColaboradorConsumo;
  observaciones: string;
  respuesta?: unknown;
}

@Component({
  selector: 'app-restaurant-collaborator-charge-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-collaborator-charge-dialog.component.html',
  styleUrls: ['./restaurant-collaborator-charge-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantCollaboratorChargeDialogComponent implements OnInit {
  private readonly service = inject(RestaurantCollaboratorChargeService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) data!: RestaurantCollaboratorChargeDialogData;
  @Output() closed = new EventEmitter<RestaurantCollaboratorChargeDialogResult | null>();

  colaboradores: ColaboradorConsumo[] = [];
  colaboradorSeleccionado: ColaboradorConsumo | null = null;
  busqueda = '';
  observaciones = '';
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.cargarColaboradores();
  }

  get colaboradoresFiltrados(): ColaboradorConsumo[] {
    const term = this.normalize(this.busqueda);
    if (!term) {
      return this.colaboradores;
    }
    return this.colaboradores.filter((item) =>
      this.normalize(`${item.MPV30_Codigo} ${item.MPV30_Nombre} ${item.MPV30_Ruc} ${item.MPV30_CentroCosto}`).includes(term)
    );
  }

  seleccionarColaborador(item: ColaboradorConsumo): void {
    if (!this.saving) {
      this.colaboradorSeleccionado = item;
      this.errorMessage = '';
    }
  }

  async confirmar(): Promise<void> {
    if (!this.colaboradorSeleccionado || this.saving) {
      this.errorMessage = 'Seleccione un colaborador para continuar.';
      this.cdr.markForCheck();
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar cargo a colaborador',
      text: `Se registrará un cargo por ${this.formatTotal()} a ${this.colaboradorSeleccionado.MPV30_Nombre}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar cargo',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        container: 'next-confirm-container',
        popup: 'next-confirm-modal'
      }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const colaborador = this.colaboradorSeleccionado;
    const payload = this.buildRequest(colaborador);
    this.saving = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.service
      .guardarConsumo(payload)
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
            text: 'El consumo del colaborador se guardó correctamente.',
            icon: 'success',
            confirmButtonText: 'Aceptar',
            customClass: {
              container: 'next-confirm-container',
              popup: 'next-confirm-modal'
            }
          }).then(() => {
            this.closed.emit({
              guardado: true,
              colaborador,
              observaciones: this.observaciones.trim(),
              respuesta
            });
          });
        },
        error: (error) => {
          console.error('Error al guardar consumo de colaborador:', error);
          this.errorMessage = 'No se pudo registrar el cargo al colaborador.';
          void Swal.fire({
            title: 'No se pudo registrar',
            text: this.errorMessage,
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: {
              container: 'next-confirm-container',
              popup: 'next-confirm-modal'
            }
          });
        }
      });
  }

  cerrar(): void {
    if (!this.saving) {
      this.closed.emit(null);
    }
  }

  trackByColaborador(_: number, item: ColaboradorConsumo): string {
    return item.MPV30_Codigo;
  }

  formatTotal(): string {
    return `${this.data.moneda} ${Number(this.data.total || 0).toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  private cargarColaboradores(): void {
    this.loading = true;
    this.errorMessage = '';
    this.service
      .listarColaboradores()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.colaboradores = (items || []).map((item) => ({
            ...item,
            MPV30_Codigo: this.clean(item.MPV30_Codigo),
            MPV30_Nombre: this.clean(item.MPV30_Nombre),
            MPV30_Telefono: this.clean(item.MPV30_Telefono),
            MPV30_Direccion: this.clean(item.MPV30_Direccion),
            MPV30_Ruc: this.clean(item.MPV30_Ruc),
            MPV30_CentroCosto: this.clean(item.MPV30_CentroCosto),
            MPV30_Operador: this.clean(item.MPV30_Operador)
          }));
          if (!this.colaboradores.length) {
            this.errorMessage = 'No hay colaboradores disponibles.';
          }
        },
        error: (error) => {
          console.error('Error al cargar colaboradores:', error);
          this.colaboradores = [];
          this.errorMessage = 'No se pudieron cargar los colaboradores.';
        }
      });
  }

  private buildRequest(colaborador: ColaboradorConsumo): ConsumoColaboradorRequest {
    const now = new Date();
    return {
      proceso: 0,
      tipOpe: 'CC',
      numOpe: 'GENERA',
      pntVta: this.clean(this.data.puntoVenta),
      fecha: this.formatDate(now),
      hora: this.formatTime(now),
      vendedor: this.clean(this.data.vendedor),
      codColabora: colaborador.MPV30_Codigo,
      rucColabora: colaborador.MPV30_Ruc,
      nomColabora: colaborador.MPV30_Nombre,
      direccion: this.observaciones.trim(),
      totDocu: Number(this.data.total || 0),
      estado: 'PEN',
      moneda: this.clean(this.data.moneda),
      tCambio: Number(this.data.tipoCambio || 1),
      lPrecio: this.clean(this.data.listaPrecio),
      tipNP: this.clean(this.data.tipNP),
      serieNP: this.clean(this.data.serieNP),
      numNP: this.clean(this.data.numNP),
      numCuenta: Number(this.data.numCuenta || 0),
      operador: this.clean(this.data.operador)
    };
  }

  private formatDate(date: Date): string {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private formatTime(date: Date): string {
    return `${date.getHours()}`.padStart(2, '0') + ':' + `${date.getMinutes()}`.padStart(2, '0');
  }

  private normalize(value: unknown): string {
    return this.clean(value).toLocaleLowerCase('es-CR');
  }

  private clean(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }
}
