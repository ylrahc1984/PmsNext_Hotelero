import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { EMPTY, of } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { Almacen } from './interfaces/Almacen.interface';
import { AlmacenRequest } from './interfaces/AlmacenRequest.interface';
import { AlmacenService } from './almacen.service';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface AlmacenModalForm {
  codAlma: FormControl<string>;
  nomAlma: FormControl<string>;
  tipAlma: FormControl<string>;
  principal: FormControl<boolean>;
  orden: FormControl<number>;
  operador: FormControl<string>;
}

interface AlmacenFiltroForm {
  nomAlma: FormControl<string>;
}

@Component({
  selector: 'app-almacen',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './almacen.component.html',
  styleUrls: ['./almacen.component.scss']
})
export class AlmacenComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly almacenService = inject(AlmacenService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filtroForm: FormGroup<AlmacenFiltroForm> = this.fb.group({
    nomAlma: this.fb.control('')
  });

  readonly modalForm: FormGroup<AlmacenModalForm> = this.fb.group({
    codAlma: this.fb.control('', { validators: [Validators.required, Validators.pattern(/^\S+$/)] }),
    nomAlma: this.fb.control('', { validators: [Validators.required] }),
    tipAlma: this.fb.control('G', { validators: [Validators.required] }),
    principal: this.fb.control(false),
    orden: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  almacenes: Almacen[] = [];
  visibleAlmacenes: Almacen[] = [];
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  private codAlmaActual: string | null = null;
  private activeFilter = '';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageStart = 0;
  pageEnd = 0;
  readonly pageSizeOptions = [10, 20, 50];

  ngOnInit(): void {
    this.setOperadorDefault();
    this.loadAlmacenes();
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.activeFilter = this.normalizeValue(this.filtroForm.getRawValue().nomAlma) ?? '';
    this.loadAlmacenes(this.activeFilter);
  }

  onLimpiar(): void {
    this.filtroForm.reset({ nomAlma: '' });
    this.currentPage = 1;
    this.activeFilter = '';
    this.loadAlmacenes();
  }

  onPageSizeChange(size: string): void {
    this.pageSize = Number(size) || this.pageSize;
    this.currentPage = 1;
    this.applyPagination();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.applyPagination();
  }

  abrirModalCrear(): void {
    this.isEditing = false;
    this.codAlmaActual = null;
    this.modalForm.reset(
      {
        codAlma: '',
        nomAlma: '',
        tipAlma: 'G',
        principal: false,
        orden: 0,
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codAlma.enable({ emitEvent: false });
    this.showModal = true;
  }

  abrirModalEditar(almacen: Almacen): void {
    const codAlma = almacen.CAC05_CodAlmacen;
    this.isEditing = true;
    this.codAlmaActual = codAlma;
    this.modalForm.controls.codAlma.disable({ emitEvent: false });
    this.showModal = true;

    this.isLoading = true;
    this.almacenService
      .getAlmacenPorId(codAlma)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo cargar el almacen.', error);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        if (!data) {
          return;
        }
        this.modalForm.patchValue(
          {
            codAlma: data.CAC05_CodAlmacen,
            nomAlma: data.CAC05_NomAlmacen,
            tipAlma: data.CAC05_TipAlmacen,
            principal: Number(data.CAC05_Principal) === 1,
            orden: Number(data.CAC05_Orden) || 0,
            operador: data.CAC05_Operador || this.getOperador()
          },
          { emitEvent: false }
        );
      });
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }
    this.showModal = false;
  }

  guardarAlmacen(): void {
    if (this.modalForm.invalid) {
      this.modalForm.markAllAsTouched();
      return;
    }

    if (this.modalForm.controls.principal.value) {
      this.desmarcarOtrosPrincipales();
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.almacenService.actualizarAlmacen(payload)
      : this.almacenService.crearAlmacen(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el almacen.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Almacen actualizado correctamente.' : 'Almacen creado correctamente.',
          icon: 'success'
        });
        this.cerrarModal();
        this.loadAlmacenes(this.activeFilter);
      });
  }

  eliminarAlmacen(almacen: Almacen): void {
    Swal.fire({
      title: 'Eliminar almacen',
      text: `Desea eliminar el almacen ${almacen.CAC05_CodAlmacen}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.almacenService
        .eliminarAlmacen(almacen.CAC05_CodAlmacen)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el almacen.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Almacen eliminado correctamente.',
            icon: 'success'
          });
          this.loadAlmacenes(this.activeFilter);
        });
    });
  }

  isFieldInvalid(field: keyof AlmacenModalForm): boolean {
    const control = this.modalForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get principalBadgeClass(): (value: number) => string {
    return (value: number) => (Number(value) === 1 ? 'badge bg-success' : 'badge bg-secondary');
  }

  get principalLabel(): (value: number) => string {
    return (value: number) => (Number(value) === 1 ? 'Principal' : 'Secundario');
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Almacen' : 'Nuevo Almacen';
  }

  get emptyMessage(): string {
    return this.isLoading ? 'Cargando almacenes...' : 'No hay almacenes para mostrar.';
  }

  private loadAlmacenes(filtro?: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.almacenService
      .getAlmacenes(filtro)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los almacenes.', error);
          return of([] as Almacen[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((almacenes) => {
        this.almacenes = almacenes;
        this.updatePagination();
      });
  }

  private buildPayload(): AlmacenRequest {
    const raw = this.modalForm.getRawValue();
    return {
      proceso: 0,
      codAlma: raw.codAlma.trim(),
      nomAlma: raw.nomAlma.trim(),
      tipAlma: raw.tipAlma.trim(),
      principal: raw.principal ? 1 : 0,
      orden: Number(raw.orden) || 0,
      operador: raw.operador.trim(),
      respuesta: ''
    };
  }

  private desmarcarOtrosPrincipales(): void {
    this.almacenes = this.almacenes.map((item) => ({
      ...item,
      CAC05_Principal: item.CAC05_CodAlmacen === this.codAlmaActual ? item.CAC05_Principal : 0
    }));
    this.applyPagination();
  }

  private setOperadorDefault(): void {
    this.modalForm.controls.operador.setValue(this.getOperador(), { emitEvent: false });
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private updatePagination(): void {
    this.totalRegistros = this.almacenes.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.applyPagination();
  }

  private applyPagination(): void {
    if (this.totalRegistros === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      this.visibleAlmacenes = [];
      return;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.visibleAlmacenes = this.almacenes.slice(startIndex, endIndex);
    this.pageStart = startIndex + 1;
    this.pageEnd = Math.min(endIndex, this.totalRegistros);
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error'
    });
  }
}
