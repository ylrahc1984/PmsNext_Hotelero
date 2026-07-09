import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { BlockedRoom, BlockedRoomsService, CreateBlockedRoomRequest } from './services/blocked-rooms.service';

interface BlockedRoomForm {
  roomNumber: number | null;
  categoryCode: string;
  roomDescription: string;
  startDate: string;
  endDate: string;
  description: string;
  observations: string;
}

type ModalMode = 'create' | 'extend' | null;

@Component({
  selector: 'app-blocked-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './blocked-rooms.component.html',
  styleUrls: ['./blocked-rooms.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockedRoomsComponent implements OnInit {
  private readonly blockedRoomsService = inject(BlockedRoomsService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  bloqueos: BlockedRoom[] = [];
  filtro = '';
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  modalMode: ModalMode = null;
  modalErrorMessage = '';
  selectedRoom: BlockedRoom | null = null;
  form: BlockedRoomForm = this.createDefaultForm();

  ngOnInit(): void {
    this.cargarBloqueos();
  }

  get bloqueosFiltrados(): BlockedRoom[] {
    const term = this.filtro.trim().toLowerCase();

    if (!term) {
      return this.bloqueos;
    }

    return this.bloqueos.filter((item) => {
      return (
        String(item.roomNumber).includes(term)
        || item.categoryCode.toLowerCase().includes(term)
        || item.roomDescription.toLowerCase().includes(term)
        || item.description.toLowerCase().includes(term)
        || item.operator.toLowerCase().includes(term)
      );
    });
  }

  cargarBloqueos(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    this.blockedRoomsService
      .getBlockedRooms()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.bloqueos = response;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('No se pudo cargar el listado de bloqueos.', error);
          this.errorMessage = 'No se pudo cargar el listado de habitaciones bloqueadas.';
          this.cdr.markForCheck();
        }
      });
  }

  abrirModalCrear(): void {
    this.modalMode = 'create';
    this.selectedRoom = null;
    this.modalErrorMessage = '';
    this.form = this.createDefaultForm();
  }

  abrirModalExtender(room: BlockedRoom): void {
    this.modalMode = 'extend';
    this.selectedRoom = room;
    this.modalErrorMessage = '';
    this.form = {
      roomNumber: room.roomNumber,
      categoryCode: room.categoryCode,
      roomDescription: room.roomDescription,
      startDate: this.toDateInputValue(room.startDate),
      endDate: this.toDateInputValue(room.endDate),
      description: room.description,
      observations: room.observations || ''
    };
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }

    this.modalMode = null;
    this.modalErrorMessage = '';
    this.selectedRoom = null;
  }

  guardarModal(): void {
    if (!this.modalMode || this.isSaving) {
      return;
    }

    const validationMessage = this.validarFormulario();
    if (validationMessage) {
      this.modalErrorMessage = validationMessage;
      return;
    }

    this.isSaving = true;
    this.modalErrorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    if (this.modalMode === 'create') {
      this.crearBloqueo();
      return;
    }

    this.extenderBloqueo();
  }

  async desbloquear(room: BlockedRoom): Promise<void> {
    if (this.isSaving) {
      return;
    }

    const result = await Swal.fire({
      title: 'Desbloquear habitacion',
      text: `Se desbloqueara la habitacion ${room.roomNumber}. Desea continuar?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, desbloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
      cancelButtonColor: '#6c757d'
    });

    if (!result.isConfirmed) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    this.blockedRoomsService
      .unlockBlockedRoom(room, this.getOperadorActual())
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.successMessage = `Habitacion ${room.roomNumber} desbloqueada correctamente.`;
          this.cargarBloqueos();
        },
        error: (error) => {
          console.error('No se pudo desbloquear la habitacion.', error);
          this.errorMessage = 'No se pudo desbloquear la habitacion seleccionada.';
          this.cdr.markForCheck();
        }
      });
  }

  formatearFecha(value: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  trackByRoom(_: number, item: BlockedRoom): number {
    return item.roomNumber;
  }

  private crearBloqueo(): void {
    const payload: CreateBlockedRoomRequest = {
      roomNumber: Number(this.form.roomNumber),
      categoryCode: this.form.categoryCode.trim(),
      roomDescription: this.form.roomDescription.trim(),
      startDate: this.toApiDate(this.form.startDate),
      endDate: this.toApiDate(this.form.endDate),
      description: this.form.description.trim(),
      observations: this.form.observations.trim(),
      operator: this.getOperadorActual()
    };

    this.blockedRoomsService
      .createBlockedRoom(payload)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.successMessage = `Habitacion ${payload.roomNumber} bloqueada correctamente.`;
          this.cargarBloqueos();
        },
        error: (error) => {
          console.error('No se pudo crear el bloqueo de habitacion.', error);
          this.modalErrorMessage = 'No se pudo crear el bloqueo. Verifique los datos e intente nuevamente.';
          this.cdr.markForCheck();
        }
      });
  }

  private extenderBloqueo(): void {
    if (!this.selectedRoom) {
      this.modalErrorMessage = 'No se encontro la habitacion seleccionada para extender el bloqueo.';
      this.isSaving = false;
      this.cdr.markForCheck();
      return;
    }

    this.blockedRoomsService
      .extendBlockedRoom(
        this.selectedRoom,
        this.toApiDate(this.form.endDate),
        this.form.observations.trim(),
        this.getOperadorActual()
      )
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.successMessage = `Bloqueo de habitacion ${this.selectedRoom?.roomNumber} extendido correctamente.`;
          this.cargarBloqueos();
        },
        error: (error) => {
          console.error('No se pudo extender el bloqueo de la habitacion.', error);
          this.modalErrorMessage = 'No se pudo extender el bloqueo de la habitacion seleccionada.';
          this.cdr.markForCheck();
        }
      });
  }

  private validarFormulario(): string {
    if (!this.form.startDate || !this.form.endDate) {
      return 'Debe seleccionar fecha inicial y fecha final.';
    }

    if (new Date(this.form.endDate) < new Date(this.form.startDate)) {
      return 'La fecha final no puede ser menor a la fecha inicial.';
    }

    if (this.modalMode === 'create') {
      if (!this.form.roomNumber || this.form.roomNumber <= 0) {
        return 'Debe indicar un numero de habitacion valido.';
      }

      if (!this.form.categoryCode.trim()) {
        return 'Debe indicar la categoria de la habitacion.';
      }

      if (!this.form.description.trim()) {
        return 'Debe indicar la descripcion del bloqueo.';
      }
    }

    return '';
  }

  private toApiDate(value: string): string {
    if (!value) {
      return '';
    }

    return `${value}T00:00:00`;
  }

  private toDateInputValue(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private createDefaultForm(): BlockedRoomForm {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return {
      roomNumber: null,
      categoryCode: '',
      roomDescription: '',
      startDate: this.toDateInputValue(today.toISOString()),
      endDate: this.toDateInputValue(tomorrow.toISOString()),
      description: '',
      observations: ''
    };
  }

  private getOperadorActual(): string {
    const user = this.authService.getCurrentUser();
    return user?.usuario || user?.Usuario || user?.userName || 'SISTEMA';
  }
}
