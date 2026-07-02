import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { RoomCategory } from '../room-categories/models/room-category.model';
import { RoomCategoriesService } from '../room-categories/services/room-categories.service';
import { RoomGroup } from '../room-groups/models/room-group.model';
import { RoomGroupsService } from '../room-groups/services/room-groups.service';
import { RoomType } from '../room-types/models/room-type.model';
import { RoomTypesService } from '../room-types/services/room-types.service';
import { Room } from './models/room.model';
import { RoomRequest } from './models/room-request.model';
import { RoomsService } from './services/rooms.service';

type SortColumn =
  | 'habitacion'
  | 'categoria'
  | 'tipo'
  | 'grupo'
  | 'camas'
  | 'pax'
  | 'descripcion'
  | 'estado'
  | 'clean'
  | 'activo'
  | 'operador';
type SortDirection = 'asc' | 'desc';

interface RoomForm {
  habitacion: FormControl<number>;
  categoria: FormControl<string>;
  tipo: FormControl<string>;
  grupo: FormControl<string>;
  totCamas: FormControl<number>;
  totPax: FormControl<number>;
  descripcion: FormControl<string>;
  estado: FormControl<string>;
  clean: FormControl<string>;
  anexo: FormControl<string>;
  activo: FormControl<string>;
  operador: FormControl<string>;
}

interface CatalogOption {
  value: string;
  label: string;
  badgeClass: string;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss']
})
export class RoomsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly roomsService = inject(RoomsService);
  private readonly roomCategoriesService = inject(RoomCategoriesService);
  private readonly roomTypesService = inject(RoomTypesService);
  private readonly roomGroupsService = inject(RoomGroupsService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roomForm: FormGroup<RoomForm> = this.fb.group({
    habitacion: this.fb.control(0, { validators: [Validators.required, Validators.min(1)] }),
    categoria: this.fb.control('', { validators: [Validators.required] }),
    tipo: this.fb.control('', { validators: [Validators.required] }),
    grupo: this.fb.control('', { validators: [Validators.required] }),
    totCamas: this.fb.control(1, { validators: [Validators.required, Validators.min(1)] }),
    totPax: this.fb.control(1, { validators: [Validators.required, Validators.min(1)] }),
    descripcion: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    estado: this.fb.control('L', { validators: [Validators.required] }),
    clean: this.fb.control('L', { validators: [Validators.required] }),
    anexo: this.fb.control('', { validators: [Validators.maxLength(20)] }),
    activo: this.fb.control('S', { validators: [Validators.required] }),
    operador: this.fb.control('', { validators: [Validators.required, Validators.maxLength(50)] })
  });

  readonly estadoOptions: CatalogOption[] = [
    { value: 'L', label: 'Libre', badgeClass: 'bg-success' },
    { value: 'O', label: 'Ocupada', badgeClass: 'bg-danger' },
    { value: 'B', label: 'Bloqueada', badgeClass: 'bg-warning text-dark' },
    { value: 'F', label: 'Fuera de Servicio', badgeClass: 'bg-secondary' }
  ];

  readonly cleaningOptions: CatalogOption[] = [
    { value: 'L', label: 'Limpia', badgeClass: 'bg-success' },
    { value: 'S', label: 'Sucia', badgeClass: 'bg-danger' },
    { value: 'I', label: 'Inspección', badgeClass: 'bg-info text-dark' }
  ];

  readonly activeOptions: CatalogOption[] = [
    { value: 'S', label: 'Sí', badgeClass: 'bg-success' },
    { value: 'N', label: 'No', badgeClass: 'bg-secondary' }
  ];

  readonly pageSizeOptions = [10, 20, 50, 100];

  rooms: Room[] = [];
  filteredRooms: Room[] = [];
  paginatedRooms: Room[] = [];
  roomCategories: RoomCategory[] = [];
  roomGroups: RoomGroup[] = [];
  filterRoomTypes: RoomType[] = [];
  formRoomTypes: RoomType[] = [];

  searchTerm = '';
  filterCategory = '';
  filterType = '';
  filterGroup = '';
  filterEstado = '';
  filterActivo = '';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRecords = 0;

  isLoading = false;
  isCatalogLoading = false;
  isSaving = false;
  isDeleting = false;
  isCleaning = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  sortColumn: SortColumn = 'habitacion';
  sortDirection: SortDirection = 'asc';

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.isLoading = true;
    this.isCatalogLoading = true;
    this.errorMessage = '';

    forkJoin({
      rooms: this.roomsService.getRooms().pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las habitaciones.', error);
          return of([] as Room[]);
        })
      ),
      categories: this.roomCategoriesService.getRoomCategories().pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las categorias de habitaciones.', error);
          return of([] as RoomCategory[]);
        })
      ),
      groups: this.roomGroupsService.getRoomGroups().pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los grupos de habitaciones.', error);
          return of([] as RoomGroup[]);
        })
      )
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.isCatalogLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ rooms, categories, groups }) => {
        this.rooms = rooms;
        this.roomCategories = categories;
        this.roomGroups = groups;
        this.applyFilters(true);
      });
  }

  onSearchChange(): void {
    this.applyFilters(true);
  }

  onFilterChange(): void {
    this.applyFilters(true);
  }

  onFilterCategoryChange(): void {
    this.filterType = '';
    this.filterRoomTypes = [];

    if (!this.filterCategory) {
      this.applyFilters(true);
      return;
    }

    this.loadRoomTypesForCategory(this.filterCategory, 'filter');
    this.applyFilters(true);
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToFirstPage(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  goToPreviousPage(): void {
    this.currentPage = Math.max(this.currentPage - 1, 1);
    this.updatePagination();
  }

  goToNextPage(): void {
    this.currentPage = Math.min(this.currentPage + 1, this.totalPages);
    this.updatePagination();
  }

  goToLastPage(): void {
    this.currentPage = this.totalPages;
    this.updatePagination();
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
    this.formRoomTypes = [];
    this.roomForm.reset(
      {
        habitacion: 0,
        categoria: '',
        tipo: '',
        grupo: '',
        totCamas: 1,
        totPax: 1,
        descripcion: '',
        estado: 'L',
        clean: 'L',
        anexo: '',
        activo: 'S',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomForm.controls.habitacion.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(room: Room): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.formRoomTypes = [];
    this.roomForm.reset(
      {
        habitacion: room.CR05_NumHab,
        categoria: room.CR05_CateHab,
        tipo: room.CR05_TipoHab,
        grupo: room.CR05_CodGrp,
        totCamas: room.CR05_TotCamas ?? 1,
        totPax: room.CR05_NumPax ?? 1,
        descripcion: room.CR05_Descripcion,
        estado: room.CR05_EstHab || 'L',
        clean: room.CR05_Clean || 'L',
        anexo: room.CR05_Anexo || '',
        activo: room.CR05_Activo || 'S',
        operador: room.CR05_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.roomForm.controls.habitacion.disable({ emitEvent: false });
    this.loadRoomTypesForCategory(room.CR05_CateHab, 'form', room.CR05_TipoHab);
    this.showModal = true;
  }

  onFormCategoryChange(): void {
    const categoria = this.roomForm.controls.categoria.value;
    this.roomForm.controls.tipo.setValue('', { emitEvent: false });
    this.formRoomTypes = [];

    if (!categoria) {
      return;
    }

    this.loadRoomTypesForCategory(categoria, 'form');
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.roomForm.markAsUntouched();
  }

  saveRoom(): void {
    if (this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.roomsService.updateRoom(payload.habitacion, payload)
      : this.roomsService.createRoom(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la habitacion.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.upsertLocalRoom(this.mapPayloadToRoom(payload));
        this.toastService.addToast({
          title: 'Exito',
          message: response.respuesta || (this.isEditing ? 'Habitacion actualizada correctamente.' : 'Habitacion creada correctamente.'),
          type: 'success'
        });
        this.closeModal();
      });
  }

  deleteRoom(room: Room): void {
    Swal.fire({
      title: 'Eliminar Habitación',
      text: '¿Desea eliminar esta habitación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.roomsService
        .deleteRoom(room.CR05_NumHab)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la habitacion.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          this.rooms = this.rooms.filter((item) => item.CR05_NumHab !== room.CR05_NumHab);
          this.applyFilters();
          this.toastService.addToast({
            title: 'Exito',
            message: response.respuesta || 'Habitacion eliminada correctamente.',
            type: 'success'
          });
        });
    });
  }

  cycleCleaningStatus(room: Room): void {
    const nextClean = this.getNextCleaningStatus(room.CR05_Clean);
    this.updateRoomCleaning(room, nextClean);
  }

  updateRoomCleaning(room: Room, clean: string): void {
    this.isCleaning = true;
    this.roomsService
      .updateCleaning(room.CR05_NumHab, clean)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo actualizar el estado de limpieza.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isCleaning = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.rooms = this.rooms.map((item) => (item.CR05_NumHab === room.CR05_NumHab ? { ...item, CR05_Clean: clean } : item));
        this.applyFilters();
        this.toastService.addToast({
          title: 'Exito',
          message: 'Estado de limpieza actualizado correctamente.',
          type: 'success'
        });
      });
  }

  markAllAsClean(): void {
    Swal.fire({
      title: 'Marcar todas como Limpias',
      text: '¿Desea marcar todas las habitaciones como Limpias?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, actualizar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isCleaning = true;
      this.roomsService
        .updateAllCleaning('L')
        .pipe(
          catchError((error) => {
            this.handleError('No se pudieron marcar las habitaciones como limpias.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isCleaning = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          this.rooms = this.rooms.map((room) => ({ ...room, CR05_Clean: 'L' }));
          this.applyFilters();
          this.toastService.addToast({
            title: 'Exito',
            message: 'Habitaciones marcadas como limpias correctamente.',
            type: 'success'
          });
        });
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterCategory = '';
    this.filterType = '';
    this.filterGroup = '';
    this.filterEstado = '';
    this.filterActivo = '';
    this.filterRoomTypes = [];
    this.applyFilters(true);
  }

  isFieldInvalid(field: keyof RoomForm): boolean {
    const control = this.roomForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof RoomForm): string {
    const control = this.roomForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['min']) {
      const minError = control.errors['min'] as { min: number };
      return `Debe ser mayor o igual a ${minError.min}`;
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  getOptionLabel(options: CatalogOption[], value: string): string {
    return options.find((option) => option.value === value)?.label ?? (value || 'N/D');
  }

  getOptionBadgeClass(options: CatalogOption[], value: string): string {
    return options.find((option) => option.value === value)?.badgeClass ?? 'bg-light text-dark';
  }

  getCategoryLabel(codigo: string): string {
    const category = this.roomCategories.find((item) => item.CR01_CodCate === codigo);
    return category ? `${category.CR01_CodCate} - ${category.CR01_Categoria}` : codigo || 'N/D';
  }

  getRoomTypeLabel(codigo: string, categoria: string): string {
    const roomType = [...this.filterRoomTypes, ...this.formRoomTypes].find(
      (item) => item.CR02_TipHabita === codigo && item.CR02_CatHabita === categoria
    );
    return roomType ? `${roomType.CR02_TipHabita} - ${roomType.CR02_NomHabita}` : codigo || 'N/D';
  }

  getGroupLabel(codigo: string): string {
    const group = this.roomGroups.find((item) => item.CR04_CodGrp === codigo);
    return group ? `${group.CR04_CodGrp} - ${group.CR04_Descripcion}` : codigo || 'N/D';
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Habitación' : 'Nueva Habitación';
  }

  get emptyMessage(): string {
    return this.rooms.length === 0 ? 'No existen habitaciones registradas.' : 'No existen habitaciones que coincidan con los filtros.';
  }

  get paginationStart(): number {
    if (this.totalRecords === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get paginationEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRecords);
  }

  trackByRoom(_: number, item: Room): number {
    return item.CR05_NumHab;
  }

  private loadRoomTypesForCategory(categoria: string, target: 'filter' | 'form', selectedType = ''): void {
    this.roomTypesService
      .getRoomTypesByCategory(categoria)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los tipos de habitacion para la categoria seleccionada.', error);
          return of([] as RoomType[]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((roomTypes) => {
        if (target === 'filter') {
          this.filterRoomTypes = roomTypes;
          return;
        }

        this.formRoomTypes = roomTypes;
        if (selectedType && roomTypes.some((roomType) => roomType.CR02_TipHabita === selectedType)) {
          this.roomForm.controls.tipo.setValue(selectedType, { emitEvent: false });
        }
      });
  }

  private applyFilters(resetPage = false): void {
    if (resetPage) {
      this.currentPage = 1;
    }

    const term = this.normalizeText(this.searchTerm);
    const filtered = this.rooms.filter((room) => {
      const matchesSearch =
        !term ||
        this.normalizeText(String(room.CR05_NumHab)).includes(term) ||
        this.normalizeText(room.CR05_CateHab).includes(term) ||
        this.normalizeText(room.CR05_TipoHab).includes(term) ||
        this.normalizeText(room.CR05_CodGrp).includes(term) ||
        this.normalizeText(room.CR05_Descripcion).includes(term) ||
        this.normalizeText(room.CR05_Anexo).includes(term) ||
        this.normalizeText(room.CR05_Operador).includes(term);

      return (
        matchesSearch &&
        (!this.filterCategory || room.CR05_CateHab === this.filterCategory) &&
        (!this.filterType || room.CR05_TipoHab === this.filterType) &&
        (!this.filterGroup || room.CR05_CodGrp === this.filterGroup) &&
        (!this.filterEstado || room.CR05_EstHab === this.filterEstado) &&
        (!this.filterActivo || room.CR05_Activo === this.filterActivo)
      );
    });

    this.filteredRooms = filtered.sort((left, right) => this.compareRooms(left, right));
    this.updatePagination();
  }

  private updatePagination(): void {
    this.totalRecords = this.filteredRooms.length;
    this.totalPages = Math.max(Math.ceil(this.totalRecords / this.pageSize), 1);
    this.currentPage = Math.min(this.currentPage, this.totalPages);

    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedRooms = this.filteredRooms.slice(start, start + this.pageSize);
  }

  private compareRooms(left: Room, right: Room): number {
    const leftValue = this.getSortValue(left);
    const rightValue = this.getSortValue(right);
    const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });

    return this.sortDirection === 'asc' ? comparison : comparison * -1;
  }

  private getSortValue(room: Room): string {
    const sortValues: Record<SortColumn, string> = {
      habitacion: String(room.CR05_NumHab ?? 0),
      categoria: room.CR05_CateHab,
      tipo: room.CR05_TipoHab,
      grupo: room.CR05_CodGrp,
      camas: String(room.CR05_TotCamas ?? 0),
      pax: String(room.CR05_NumPax ?? 0),
      descripcion: room.CR05_Descripcion,
      estado: room.CR05_EstHab,
      clean: room.CR05_Clean,
      activo: room.CR05_Activo,
      operador: room.CR05_Operador
    };

    return sortValues[this.sortColumn] ?? '';
  }

  private buildPayload(): RoomRequest {
    const raw = this.roomForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      habitacion: raw.habitacion,
      categoria: this.sanitizeValue(raw.categoria),
      tipo: this.sanitizeValue(raw.tipo),
      grupo: this.sanitizeValue(raw.grupo),
      totCamas: raw.totCamas,
      totPax: raw.totPax,
      descripcion: this.sanitizeValue(raw.descripcion),
      estado: this.sanitizeValue(raw.estado),
      clean: this.sanitizeValue(raw.clean),
      anexo: this.sanitizeValue(raw.anexo),
      activo: this.sanitizeValue(raw.activo),
      operador: this.sanitizeValue(raw.operador) || this.getOperador(),
      respuesta: ''
    };
  }

  private mapPayloadToRoom(payload: RoomRequest): Room {
    return {
      CR05_NumHab: payload.habitacion,
      CR05_CateHab: payload.categoria,
      CR05_TipoHab: payload.tipo,
      CR05_CodGrp: payload.grupo,
      CR05_TotCamas: payload.totCamas,
      CR05_NumPax: payload.totPax,
      CR05_Descripcion: payload.descripcion,
      CR05_EstHab: payload.estado,
      CR05_Clean: payload.clean,
      CR05_Anexo: payload.anexo,
      CR05_Activo: payload.activo,
      CR05_Operador: payload.operador
    };
  }

  private upsertLocalRoom(room: Room): void {
    const roomIndex = this.rooms.findIndex((item) => item.CR05_NumHab === room.CR05_NumHab);
    this.rooms =
      roomIndex >= 0
        ? this.rooms.map((item) => (item.CR05_NumHab === room.CR05_NumHab ? room : item))
        : [...this.rooms, room];
    this.applyFilters();
  }

  private getNextCleaningStatus(clean: string): string {
    if (clean === 'L') {
      return 'S';
    }

    if (clean === 'S') {
      return 'I';
    }

    return 'L';
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
