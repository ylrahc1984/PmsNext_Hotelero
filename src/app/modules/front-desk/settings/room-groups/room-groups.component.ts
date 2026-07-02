import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomGroup } from './models/room-group.model';
import { RoomGroupRequest } from './models/room-group-request.model';
import { RoomGroupsService } from './services/room-groups.service';

type SortColumn = 'codigo' | 'descripcion' | 'operador';
type SortDirection = 'asc' | 'desc';

interface RoomGroupForm {
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-room-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './room-groups.component.html',
  styleUrls: ['./room-groups.component.scss']
})
export class RoomGroupsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roomGroupsService = inject(RoomGroupsService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomGroupForm: FormGroup<RoomGroupForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  roomGroups: RoomGroup[] = [];
  filteredRoomGroups: RoomGroup[] = [];
  searchTerm = '';
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  sortColumn: SortColumn = 'codigo';
  sortDirection: SortDirection = 'asc';

  ngOnInit(): void {
    this.loadRoomGroups();
  }

  loadRoomGroups(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.roomGroupsService
      .getRoomGroups()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los grupos de habitaciones.', error);
          return of([] as RoomGroup[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((roomGroups) => {
        this.roomGroups = roomGroups;
        this.applyFilters();
      });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  sortBy(column: SortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applyFilters();
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.errorMessage = '';
    this.roomGroupForm.reset(
      {
        codigo: '',
        descripcion: '',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomGroupForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(roomGroup: RoomGroup): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.roomGroupForm.reset(
      {
        codigo: roomGroup.CR04_CodGrp,
        descripcion: roomGroup.CR04_Descripcion,
        operador: roomGroup.CR04_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomGroupForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.roomGroupForm.markAsUntouched();
  }

  saveRoomGroup(): void {
    if (this.roomGroupForm.invalid) {
      this.roomGroupForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.roomGroupsService.updateRoomGroup(payload.codigo, payload)
      : this.roomGroupsService.createRoomGroup(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el grupo de habitaciones.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.toastService.addToast({
          title: 'Exito',
          message:
            response.respuesta ||
            (this.isEditing ? 'Grupo de habitaciones actualizado correctamente.' : 'Grupo de habitaciones creado correctamente.'),
          type: 'success'
        });
        this.closeModal();
        this.loadRoomGroups();
      });
  }

  deleteRoomGroup(roomGroup: RoomGroup): void {
    Swal.fire({
      title: 'Eliminar Grupo de Habitaciones',
      text: '¿Desea eliminar este Grupo de Habitaciones?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.roomGroupsService
        .deleteRoomGroup(roomGroup.CR04_CodGrp)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el grupo de habitaciones.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          this.toastService.addToast({
            title: 'Exito',
            message: response.respuesta || 'Grupo de habitaciones eliminado correctamente.',
            type: 'success'
          });
          this.loadRoomGroups();
        });
    });
  }

  isFieldInvalid(field: keyof RoomGroupForm): boolean {
    const control = this.roomGroupForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof RoomGroupForm): string {
    const control = this.roomGroupForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Grupo de Habitaciones' : 'Nuevo Grupo de Habitaciones';
  }

  get emptyMessage(): string {
    return this.searchTerm.trim()
      ? 'No existen grupos de habitaciones que coincidan con la busqueda.'
      : 'No existen grupos de habitaciones registrados.';
  }

  trackByCodigo(_: number, item: RoomGroup): string {
    return item.CR04_CodGrp;
  }

  private applyFilters(): void {
    const term = this.normalizeText(this.searchTerm);

    const filtered = this.roomGroups.filter((roomGroup) => {
      if (!term) {
        return true;
      }

      return (
        this.normalizeText(roomGroup.CR04_CodGrp).includes(term) ||
        this.normalizeText(roomGroup.CR04_Descripcion).includes(term)
      );
    });

    this.filteredRoomGroups = filtered.sort((left, right) => this.compareRoomGroups(left, right));
  }

  private compareRoomGroups(left: RoomGroup, right: RoomGroup): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(roomGroup: RoomGroup): string {
    const sortValues: Record<SortColumn, string> = {
      codigo: roomGroup.CR04_CodGrp,
      descripcion: roomGroup.CR04_Descripcion,
      operador: roomGroup.CR04_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): RoomGroupRequest {
    const raw = this.roomGroupForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codigo: this.sanitizeValue(raw.codigo).toUpperCase(),
      descripcion: this.sanitizeValue(raw.descripcion),
      operador: this.sanitizeValue(raw.operador) || this.getOperador(),
      respuesta: ''
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private sanitizeValue(value: string): string {
    return value.trim();
  }

  private normalizeText(value: string): string {
    return value.trim().toLowerCase();
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    this.toastService.addToast({
      title: 'Error',
      message,
      type: 'error'
    });
  }
}
