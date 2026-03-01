import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { catchError, finalize } from 'rxjs/operators';
import { EMPTY, of } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { LineaProductoService } from '../linea-producto/linea-producto.service';
import { LineaProducto } from '../linea-producto/interfaces/LineaProducto.interface';
import { CategoriaProducto } from './interfaces/CategoriaProducto.interface';
import { CategoriaProductoRequest } from './interfaces/CategoriaProductoRequest.interface';
import { CategoriaProductoService } from './categoria-producto.service';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface LineaSelectorForm {
  linea: FormControl<string>;
}

interface CategoriaModalForm {
  codLinea: FormControl<string>;
  codCate: FormControl<string>;
  categoria: FormControl<string>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-categoria-producto',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './categoria-producto.component.html',
  styleUrls: ['./categoria-producto.component.scss']
})
export class CategoriaProductoComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly lineaService = inject(LineaProductoService);
  private readonly categoriaService = inject(CategoriaProductoService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly lineaForm: FormGroup<LineaSelectorForm> = this.fb.group({
    linea: this.fb.control('', { validators: [Validators.required] })
  });

  readonly modalForm: FormGroup<CategoriaModalForm> = this.fb.group({
    codLinea: this.fb.control('', { validators: [Validators.required] }),
    codCate: this.fb.control('', { validators: [Validators.required, Validators.maxLength(3)] }),
    categoria: this.fb.control('', { validators: [Validators.required] }),
    operador: this.fb.control('', { validators: [Validators.required] })
  });

  lineas: LineaProducto[] = [];
  categorias: CategoriaProducto[] = [];

  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  ngOnInit(): void {
    this.setOperadorDefault();
    this.loadLineas();
    this.setupLineaWatcher();
  }

  abrirModalCrear(): void {
    if (!this.selectedLinea) {
      return;
    }
    this.isEditing = false;
    this.modalForm.reset(
      {
        codLinea: this.selectedLinea,
        codCate: '',
        categoria: '',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.disable({ emitEvent: false });
    this.modalForm.controls.codCate.enable({ emitEvent: false });
    this.showModal = true;
  }

  abrirModalEditar(categoria: CategoriaProducto): void {
    this.isEditing = true;
    const codLinea = (categoria.CAC03_Linea || this.selectedLinea || '').trim();
    this.modalForm.reset(
      {
        codLinea,
        codCate: categoria.CAC03_CodCate,
        categoria: categoria.CAC03_Categoria,
        operador: categoria.CAC03_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.disable({ emitEvent: false });
    this.modalForm.controls.codCate.disable({ emitEvent: false });
    this.showModal = true;
  }

  cerrarModal(): void {
    if (this.isSaving) {
      return;
    }
    this.showModal = false;
    this.modalForm.reset(
      {
        codLinea: this.selectedLinea || '',
        codCate: '',
        categoria: '',
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.modalForm.controls.codLinea.disable({ emitEvent: false });
    this.modalForm.controls.codCate.enable({ emitEvent: false });
  }

  guardarCategoria(): void {
    if (this.modalForm.invalid) {
      this.modalForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing
      ? this.categoriaService.actualizarCategoria(payload)
      : this.categoriaService.crearCategoria(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la categoria.', error);
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
          text: this.isEditing ? 'Categoria actualizada correctamente.' : 'Categoria creada correctamente.',
          icon: 'success'
        });
        this.cerrarModal();
        this.loadCategorias();
      });
  }

  eliminarCategoria(categoria: CategoriaProducto): void {
    Swal.fire({
      title: 'Eliminar categoria',
      text: `Desea eliminar la categoria ${categoria.CAC03_CodCate}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.categoriaService
        .eliminarCategoria(categoria.CAC03_CodCate)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la categoria.', error);
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
            text: 'Categoria eliminada correctamente.',
            icon: 'success'
          });
          this.loadCategorias();
        });
    });
  }

  onLimpiarLinea(): void {
    this.lineaForm.reset({ linea: '' }, { emitEvent: true });
  }

  isFieldInvalid(field: keyof CategoriaModalForm): boolean {
    const control = this.modalForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Categoria' : 'Nueva Categoria';
  }

  get emptyMessage(): string {
    if (!this.selectedLinea) {
      return 'Seleccione una linea para visualizar categorias.';
    }
    return this.isLoading ? 'Cargando categorias...' : 'No hay categorias para mostrar.';
  }

  get selectedLinea(): string {
    return this.lineaForm.controls.linea.value?.trim() || '';
  }

  get canCreate(): boolean {
    return !!this.selectedLinea && !this.isLoading;
  }

  private loadLineas(): void {
    this.isLoading = true;
    this.lineaService
      .getLineas()
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las lineas.', error);
          return of([] as LineaProducto[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lineas) => {
        this.lineas = lineas;
      });
  }

  private setupLineaWatcher(): void {
    this.lineaForm.controls.linea.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.categorias = [];
        if (this.selectedLinea) {
          this.loadCategorias();
        }
      });
  }

  private loadCategorias(): void {
    const linea = this.selectedLinea;
    if (!linea) {
      this.categorias = [];
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.categoriaService
      .getCategoriasPorLinea(linea)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las categorias.', error);
          return of([] as CategoriaProducto[]);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((categorias) => {
        this.categorias = categorias;
      });
  }

  private buildPayload(): CategoriaProductoRequest {
    const raw = this.modalForm.getRawValue();
    const codLinea = (raw.codLinea || this.selectedLinea).trim();

    return {
      proceso: 0,
      codLinea,
      codCate: raw.codCate.trim(),
      categoria: raw.categoria.trim(),
      operador: raw.operador.trim(),
      respuesta: ''
    };
  }

  private setOperadorDefault(): void {
    this.modalForm.controls.operador.setValue(this.getOperador(), { emitEvent: false });
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
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
