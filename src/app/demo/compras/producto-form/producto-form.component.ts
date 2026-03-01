import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { UnidadMedidaService } from 'src/app/demo/administracion/unidad-medida/unidad-medida.service';
import { UnidadMedidaDto } from 'src/app/demo/administracion/unidad-medida/unidad-medida.models';
import { ProductoService } from '../producto-list/producto.service';
import { LineaProducto } from '../producto-list/interfaces/LineaProducto.interface';
import { CategoriaProducto } from '../producto-list/interfaces/CategoriaProducto.interface';
import { Producto } from '../producto-list/interfaces/Producto.interface';
import { ProductoRequest } from './interfaces/ProductoRequest.interface';
import { ProductoResponse } from './interfaces/ProductoResponse.interface';
import { Impuesto } from './interfaces/Impuesto.interface';

interface ProductoFormControls {
  codProducto: FormControl<string>;
  nomProducto: FormControl<string>;
  nomCorto: FormControl<string>;
  codigoBarras: FormControl<string>;
  linea: FormControl<string>;
  categoria: FormControl<string>;
  unmProdu: FormControl<string>;
  costoPro: FormControl<number>;
  ultimoCsto: FormControl<number>;
  porImpo: FormControl<number>;
  grabado: FormControl<string>;
  activo: FormControl<boolean>;
  localizacion: FormControl<string>;
  invMin: FormControl<number>;
  invMax: FormControl<number>;
  peso: FormControl<number>;
  modelo: FormControl<string>;
  medida: FormControl<string>;
  cabys: FormControl<string>;
  sinCABYS: FormControl<boolean>;
  url: FormControl<string>;
  operador: FormControl<string>;
  descripcion: FormControl<string>;
}

@Component({
  selector: 'app-producto-form',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './producto-form.component.html',
  styleUrls: ['./producto-form.component.scss']
})
export class ProductoFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly productoService = inject(ProductoService);
  private readonly unidadMedidaService = inject(UnidadMedidaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: FormGroup<ProductoFormControls> = this.fb.group(
    {
      codProducto: this.fb.control(''),
      nomProducto: this.fb.control('', { validators: [Validators.required, Validators.maxLength(100)] }),
      nomCorto: this.fb.control(''),
      codigoBarras: this.fb.control(''),
      linea: this.fb.control('', { validators: [Validators.required] }),
      categoria: this.fb.control('', { validators: [Validators.required] }),
      unmProdu: this.fb.control('', { validators: [Validators.required] }),
      costoPro: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      ultimoCsto: this.fb.control(0, { validators: [Validators.min(0)] }),
      porImpo: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      grabado: this.fb.control('N', { validators: [Validators.required] }),
      activo: this.fb.control(true),
      localizacion: this.fb.control(''),
      invMin: this.fb.control(0, { validators: [Validators.min(0)] }),
      invMax: this.fb.control(0, { validators: [Validators.min(0)] }),
      peso: this.fb.control(0, { validators: [Validators.min(0)] }),
      modelo: this.fb.control(''),
      medida: this.fb.control(''),
      cabys: this.fb.control(''),
      sinCABYS: this.fb.control(false),
      url: this.fb.control(''),
      operador: this.fb.control(''),
      descripcion: this.fb.control('')
    },
    { validators: [this.inventarioValidator] }
  );

  lineas: LineaProducto[] = [];
  categorias: CategoriaProducto[] = [];
  unidades: UnidadMedidaDto[] = [];
  impuestos: Impuesto[] = [];

  isEditing = false;
  isSaving = false;
  isDeleting = false;
  loadingProducto = false;

  lineasLoading = false;
  categoriasLoading = false;
  unidadesLoading = false;
  impuestosLoading = false;

  errorMessage = '';
  private codProductoActual: string | null = null;

  get pageTitle(): string {
    return this.isEditing ? 'Editar Producto' : 'Nuevo Producto';
  }

  get submitLabel(): string {
    return this.isEditing ? 'Guardar Cambios' : 'Guardar Producto';
  }

  get isBusy(): boolean {
    return this.isSaving || this.isDeleting || this.loadingProducto;
  }

  get activoLabel(): string {
    return this.form.controls.activo.value ? 'Activo' : 'Inactivo';
  }

  ngOnInit(): void {
    this.disableCategoriaControl();
    this.setOperadorDefault();
    this.setupLineaWatcher();
    this.setupSinCabysWatcher();
    this.loadCatalogos();
    this.loadIfEditing();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        title: 'Validacion',
        text: 'Por favor completa los campos requeridos.',
        icon: 'warning'
      });
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const payload = this.buildPayload();
    const action = this.isEditing && this.codProductoActual
      ? this.productoService.actualizarProducto(this.codProductoActual, payload)
      : this.productoService.crearProducto(payload);

    action
      .pipe(
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ProductoResponse) => {
          const message =
            response?.respuesta || (this.isEditing ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.');
          Swal.fire({
            title: 'Exito',
            text: message,
            icon: 'success'
          }).then(() => this.goBack());
        },
        error: (error) => {
          this.handleError('No se pudo guardar el producto.', error);
        }
      });
  }

  onDelete(): void {
    const codProducto = this.codProductoActual;
    if (!codProducto) {
      return;
    }

    Swal.fire({
      title: 'Eliminar producto',
      text: `Desea eliminar el producto ${codProducto}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.productoService
        .eliminarProducto(codProducto)
        .pipe(
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (response: ProductoResponse) => {
            const message = response?.respuesta || 'Producto eliminado correctamente.';
            Swal.fire({
              title: 'Eliminado',
              text: message,
              icon: 'success'
            }).then(() => this.goBack());
          },
          error: (error) => {
            this.handleError('No se pudo eliminar el producto.', error);
          }
        });
    });
  }

  cancel(): void {
    this.goBack();
  }

  isFieldInvalid(field: keyof ProductoFormControls): boolean {
    const control = this.form.get(field) as AbstractControl | null;
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  isInventarioInvalid(): boolean {
    const invMinTouched = this.form.controls.invMin.touched || this.form.controls.invMin.dirty;
    const invMaxTouched = this.form.controls.invMax.touched || this.form.controls.invMax.dirty;
    return (invMinTouched || invMaxTouched) && this.form.hasError('inventarioInvalido');
  }

  private loadIfEditing(): void {
    const codProducto = this.route.snapshot.paramMap.get('codProducto');
    if (!codProducto) {
      return;
    }

    this.isEditing = true;
    this.codProductoActual = codProducto;
    this.form.controls.codProducto.disable({ emitEvent: false });

    this.loadingProducto = true;
    this.productoService
      .obtenerProductoPorCodigo(codProducto)
      .pipe(
        finalize(() => {
          this.loadingProducto = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (producto) => this.handleProductoLoaded(producto),
        error: (error) => {
          this.handleError('No se pudo cargar el producto seleccionado.', error);
          this.goBack();
        }
      });
  }

  private handleProductoLoaded(producto: Producto | null): void {
    if (!producto) {
      Swal.fire({
        title: 'No encontrado',
        text: 'No se encontro el producto seleccionado.',
        icon: 'error'
      }).then(() => this.goBack());
      return;
    }

    this.form.patchValue(
      {
        codProducto: producto.MAC02_CodProducto,
        nomProducto: producto.MAC02_NomProducto,
        nomCorto: producto.MAC02_NomCorto,
        linea: producto.MAC02_Linea,
        categoria: producto.MAC02_Categoria,
        unmProdu: producto.MAC02_UnmProdu,
        medida: producto.MAC02_Medida,
        modelo: producto.MAC02_Modelo,
        peso: this.toNumber(producto.MAC02_Peso),
        invMin: this.toNumber(producto.MAC02_InvMin),
        invMax: this.toNumber(producto.MAC02_InvMax),
        costoPro: this.toNumber(producto.MAC02_CostoPro),
        grabado: producto.MAC02_Grabado || 'N',
        porImpo: this.toNumber(producto.MAC02_PorImpto),
        activo: this.isProductoActivo(producto),
        localizacion: producto.MAC02_Localizacion,
        descripcion: producto.MAC02_Descripcion,
        ultimoCsto: this.toNumber(producto.MAC02_UltimoCto),
        url: producto.MAC02_URL,
        cabys: producto.MAC02_CABYS,
        operador: producto.MAC02_Operador
      },
      { emitEvent: false }
    );

    const linea = producto.MAC02_Linea || '';
    const categoria = producto.MAC02_Categoria || '';
    if (linea) {
      this.loadCategorias(linea, categoria);
    } else {
      this.resetCategorias();
    }
  }

  private loadCatalogos(): void {
    this.loadLineas();
    this.loadUnidades();
    this.loadImpuestos();
  }

  private loadLineas(): void {
    this.lineasLoading = true;
    this.productoService
      .getLineas()
      .pipe(
        finalize(() => {
          this.lineasLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (lineas) => {
          this.lineas = lineas;
        },
        error: (error) => {
          this.handleError('No se pudieron cargar las lineas.', error, false);
          this.lineas = [];
        }
      });
  }

  private loadCategorias(linea: string, categoriaSeleccionada?: string): void {
    this.disableCategoriaControl();
    this.categoriasLoading = true;
    this.productoService
      .getCategoriasPorLinea(linea)
      .pipe(
        finalize(() => {
          this.categoriasLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (categorias) => {
          this.categorias = categorias;
          if (categorias.length > 0) {
            this.enableCategoriaControl();
          } else {
            this.disableCategoriaControl();
          }
          if (categoriaSeleccionada) {
            this.form.controls.categoria.setValue(categoriaSeleccionada, { emitEvent: false });
          }
        },
        error: (error) => {
          this.handleError('No se pudieron cargar las categorias.', error, false);
          this.categorias = [];
          this.disableCategoriaControl();
        }
      });
  }

  private loadUnidades(): void {
    this.unidadesLoading = true;
    this.unidadMedidaService
      .getUnidades()
      .pipe(
        finalize(() => {
          this.unidadesLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (unidades) => {
          this.unidades = unidades;
        },
        error: (error) => {
          this.handleError('No se pudieron cargar las unidades de medida.', error, false);
          this.unidades = [];
        }
      });
  }

  private loadImpuestos(): void {
    this.impuestosLoading = true;
    this.productoService
      .getImpuestosFe()
      .pipe(
        finalize(() => {
          this.impuestosLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (impuestos) => {
          this.impuestos = impuestos;
        },
        error: (error) => {
          this.handleError('No se pudieron cargar los impuestos.', error, false);
          this.impuestos = [];
        }
      });
  }

  private setupLineaWatcher(): void {
    this.form.controls.linea.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((linea) => {
      this.onLineaChange(linea);
    });
  }

  private setupSinCabysWatcher(): void {
    this.form.controls.sinCABYS.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((checked) => {
      if (checked) {
        this.form.controls.cabys.disable({ emitEvent: false });
        this.form.controls.cabys.setValue('', { emitEvent: false });
      } else {
        this.form.controls.cabys.enable({ emitEvent: false });
      }
    });
  }

  private onLineaChange(linea: string): void {
    this.resetCategorias();
    const normalized = linea.trim();
    if (!normalized) {
      return;
    }
    this.loadCategorias(normalized);
  }

  private resetCategorias(): void {
    this.categorias = [];
    this.form.controls.categoria.reset('', { emitEvent: false });
    this.disableCategoriaControl();
  }

  private enableCategoriaControl(): void {
    this.form.controls.categoria.enable({ emitEvent: false });
  }

  private disableCategoriaControl(): void {
    this.form.controls.categoria.disable({ emitEvent: false });
  }

  private buildPayload(): ProductoRequest {
    const raw = this.form.getRawValue();

    const codProducto = raw.codProducto.trim() || this.codProductoActual || '';

    return {
      proceso: 0,
      codProducto,
      nomProducto: raw.nomProducto.trim(),
      nomCorto: raw.nomCorto.trim(),
      linea: raw.linea.trim(),
      categoria: raw.categoria.trim(),
      unmProdu: raw.unmProdu.trim(),
      medida: raw.medida.trim(),
      modelo: raw.modelo.trim(),
      peso: this.toNumber(raw.peso),
      invMin: this.toNumber(raw.invMin),
      invMax: this.toNumber(raw.invMax),
      costoPro: this.toNumber(raw.costoPro),
      grabado: raw.grabado,
      porImpo: this.toNumber(raw.porImpo),
      activo: raw.activo ? 'S' : 'N',
      localizacion: raw.localizacion.trim(),
      descripcion: raw.descripcion.trim(),
      ultimoCsto: this.toNumber(raw.ultimoCsto),
      url: raw.url.trim(),
      cabys: raw.cabys.trim(),
      operador: raw.operador.trim(),
      sinCABYS: raw.sinCABYS,
      codigoBarras: raw.codigoBarras.trim(),
      pageNumber: 0,
      pageSize: 0,
      respuesta: ''
    };
  }

  private setOperadorDefault(): void {
    const operador = this.authService.getCurrentUser()?.usuario ?? '';
    this.form.controls.operador.setValue(operador, { emitEvent: false });
  }

  private handleError(message: string, error: unknown, showAlert = true): void {
    console.error(message, error);
    const detalle = this.getErrorMessage(error, message);
    this.errorMessage = detalle;
    if (showAlert) {
      Swal.fire({
        title: 'Error',
        text: detalle,
        icon: 'error'
      });
    }
  }

  private goBack(): void {
    this.router.navigate(['/compras/producto-list']);
  }

  private inventarioValidator(control: AbstractControl): ValidationErrors | null {
    const invMin = Number(control.get('invMin')?.value ?? 0);
    const invMax = Number(control.get('invMax')?.value ?? 0);
    if (!Number.isFinite(invMin) || !Number.isFinite(invMax)) {
      return null;
    }
    return invMin <= invMax ? null : { inventarioInvalido: true };
  }

  private toNumber(value: number | string | null | undefined): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private isProductoActivo(producto: Producto): boolean {
    const value = (producto.MAC02_Activo || '').toString().trim().toUpperCase();
    return value === 'S' || value === 'SI' || value === '1' || value === 'ACTIVO';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!error) {
      return fallback;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return error.message || fallback;
    }
    if (typeof error === 'object') {
      const maybeError = error as { error?: unknown; message?: unknown };
      if (typeof maybeError.message === 'string') {
        return maybeError.message;
      }
      if (typeof maybeError.error === 'string') {
        return maybeError.error;
      }
      if (maybeError.error && typeof maybeError.error === 'object') {
        const nested = maybeError.error as { respuesta?: unknown; message?: unknown };
        if (typeof nested.respuesta === 'string') {
          return nested.respuesta;
        }
        if (typeof nested.message === 'string') {
          return nested.message;
        }
      }
    }
    return fallback;
  }
}
