import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { EMPTY, of } from 'rxjs';
import Swal from 'sweetalert2';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { Servicio } from './interfaces/Servicio.interface';
import { ServicioRequest } from './interfaces/ServicioRequest.interface';
import { ServiciosService } from './servicios.service';

interface ServiciosFiltroForm {
  filtro: FormControl<string>;
}

interface ServiciosModalForm {
  codigo: FormControl<string>;
  servicio: FormControl<string>;
  ctaConta: FormControl<string>;
  nombreCta: FormControl<string>;
  ctaCtaPrv: FormControl<string>;
  nomCtaPrv: FormControl<string>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-servicios-compras',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss']
})
export class ServiciosComprasComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly serviciosService = inject(ServiciosService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filtroForm: FormGroup<ServiciosFiltroForm> = this.fb.group({
    filtro: this.fb.control('')
  });

  readonly modalForm: FormGroup<ServiciosModalForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.pattern(/^[^\s]+$/)] }),
    servicio: this.fb.control('', { validators: [Validators.required] }),
    ctaConta: this.fb.control('', { validators: [Validators.required] }),
    nombreCta: this.fb.control('', { validators: [Validators.required] }),
    ctaCtaPrv: this.fb.control(''),
    nomCtaPrv: this.fb.control(''),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  servicios: Servicio[] = [];
  visibleServicios: Servicio[] = [];
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

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
    this.loadServicios();
  }

  onBuscar(): void {
    this.currentPage = 1;
    this.activeFilter = this.normalizeValue(this.filtroForm.getRawValue().filtro) ?? '';
    this.loadServicios(this.activeFilter);
  }

  onLimpiar(): void {
    this.filtroForm.reset({ filtro: '' });
    this.currentPage = 1;
    this.activeFilter = '';
    this.loadServicios();
  }

  onPageSizeChange(size: string): void {
    this.pageSize = Number(size) || this.pageSize;
    this.currentPage = 1;
    this.updatePagination();
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
    this.modalForm.reset(
      {
        codigo: '',
        servicio: '',
        ctaConta: '',
        nombreCta: '',
        ctaCtaPrv: '',
        nomCtaPrv: '',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  abrirModalEditar(servicio: Servicio): void {
    const codigo = servicio.codServicio;
    this.isEditing = true;
    this.modalForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
    this.isLoading = true;

    this.serviciosService
      .getServicioPorId(codigo)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo cargar el servicio.', error);
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
            codigo: data.codServicio,
            servicio: data.servicio,
            ctaConta: data.ctaConta,
            nombreCta: data.descripcionCuenta,
            ctaCtaPrv: data.ctaCtaPrv,
            nomCtaPrv: data.nomCtaPrv,
            operador: data.operador || this.getOperador()
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

  guardarServicio(): void {
    if (this.modalForm.invalid) {
      this.modalForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.serviciosService.actualizarServicio(payload)
      : this.serviciosService.crearServicio(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar el servicio.', error);
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
          text: this.isEditing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
          icon: 'success'
        });
        this.cerrarModal();
        this.loadServicios(this.activeFilter);
      });
  }

  eliminarServicio(servicio: Servicio): void {
    Swal.fire({
      title: 'Eliminar servicio',
      text: `Desea eliminar el servicio ${servicio.codServicio}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.serviciosService
        .eliminarServicio(servicio.codServicio)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar el servicio.', error);
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
            text: 'Servicio eliminado correctamente.',
            icon: 'success'
          });
          this.loadServicios(this.activeFilter);
        });
    });
  }

  isFieldInvalid(field: keyof ServiciosModalForm): boolean {
    const control = this.modalForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Servicio' : 'Nuevo Servicio';
  }

  get emptyMessage(): string {
    return this.isLoading ? 'Cargando servicios...' : 'No hay servicios para mostrar.';
  }

  private loadServicios(filtro?: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.serviciosService
      .getServicios(filtro)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar los servicios.', error);
          return of([] as Servicio[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((servicios) => {
        this.servicios = servicios;
        this.updatePagination();
      });
  }

  private buildPayload(): ServicioRequest {
    const raw = this.modalForm.getRawValue();
    return {
      proceso: 0,
      codigo: this.normalizeCodigo(raw.codigo),
      servicio: this.sanitizeValue(raw.servicio),
      ctaConta: this.sanitizeValue(raw.ctaConta),
      nombreCta: this.sanitizeValue(raw.nombreCta),
      ctaCtaPrv: this.sanitizeValue(raw.ctaCtaPrv),
      nomCtaPrv: this.sanitizeValue(raw.nomCtaPrv),
      operador: this.sanitizeValue(raw.operador)
    };
  }

  private setOperadorDefault(): void {
    this.modalForm.controls.operador.setValue(this.getOperador(), { emitEvent: false });
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private updatePagination(): void {
    this.totalRegistros = this.servicios.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalRegistros / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.applyPagination();
  }

  private applyPagination(): void {
    if (this.totalRegistros === 0) {
      this.pageStart = 0;
      this.pageEnd = 0;
      this.visibleServicios = [];
      return;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.visibleServicios = this.servicios.slice(startIndex, endIndex);
    this.pageStart = startIndex + 1;
    this.pageEnd = Math.min(endIndex, this.totalRegistros);
  }

  private sanitizeValue(value: string): string {
    return value?.trim() ?? '';
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeCodigo(value: string): string {
    return this.sanitizeValue(value).toUpperCase();
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
