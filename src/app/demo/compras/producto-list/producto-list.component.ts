import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { distinctUntilChanged, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ProductoService, ProductoFiltros } from './producto.service';
import { Producto } from './interfaces/Producto.interface';
import { LineaProducto } from './interfaces/LineaProducto.interface';
import { CategoriaProducto } from './interfaces/CategoriaProducto.interface';
import { ProductoPaginacion, ProductoResponse } from './interfaces/ProductoResponse.interface';

interface ProductoFiltrosForm {
  linea: FormControl<string>;
  categoria: FormControl<string>;
  nomProducto: FormControl<string>;
  codigoBarra: FormControl<string>;
}

@Component({
  selector: 'app-producto-list',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './producto-list.component.html',
  styleUrls: ['./producto-list.component.scss']
})
export class ProductoListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productoService = inject(ProductoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly filtrosForm: FormGroup<ProductoFiltrosForm> = this.fb.group({
    linea: this.fb.control('', { nonNullable: true }),
    categoria: this.fb.control('', { nonNullable: true }),
    nomProducto: this.fb.control('', { nonNullable: true }),
    codigoBarra: this.fb.control('', { nonNullable: true })
  });

  productos: Producto[] = [];
  lineas: LineaProducto[] = [];
  categorias: CategoriaProducto[] = [];

  isLoading = false;
  lineasLoading = false;
  categoriasLoading = false;
  hasSearched = false;

  pageNumber = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageStart = 0;
  pageEnd = 0;

  readonly pageSizeOptions = [10, 20, 50, 100];

  get emptyStateMessage(): string {
    if (this.isLoading || this.lineasLoading || this.categoriasLoading) {
      return 'Cargando productos...';
    }
    if (!this.hasSearched) {
      return 'No hay busquedas realizadas todavia.';
    }
    return 'No hay productos para mostrar con los filtros actuales.';
  }

  ngOnInit(): void {
    this.disableCategoriaControl();
    this.loadLineas();
    this.setupLineaWatcher();
    this.onBuscar();
  }

  onBuscar(): void {
    this.pageNumber = 1;
    this.loadProductos(this.pageNumber, this.pageSize);
  }

  onLimpiar(): void {
    this.filtrosForm.reset(
      {
        linea: '',
        categoria: '',
        nomProducto: '',
        codigoBarra: ''
      },
      { emitEvent: false }
    );
    this.resetCategorias();
    this.pageNumber = 1;
    this.loadProductos(this.pageNumber, this.pageSize);
  }

  onPageSizeChange(size: string): void {
    const parsed = Number(size) || this.pageSize;
    this.pageSize = parsed;
    this.pageNumber = 1;
    this.loadProductos(this.pageNumber, this.pageSize);
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.pageNumber + delta;
    if (nextPage < 1 || nextPage > this.totalPages || this.isLoading) {
      return;
    }
    this.pageNumber = nextPage;
    this.loadProductos(this.pageNumber, this.pageSize);
  }

  trackByProducto(index: number, producto: Producto): string {
    return producto.MAC02_CodProducto || `${index}`;
  }

  getEstadoLabel(producto: Producto): string {
    return this.isProductoActivo(producto) ? 'Activo' : 'Inactivo';
  }

  getEstadoBadgeClass(producto: Producto): string {
    return this.isProductoActivo(producto) ? 'bg-success' : 'bg-secondary';
  }

  editarProducto(producto: Producto): void {
    const codProducto = (producto.MAC02_CodProducto || '').trim();
    if (!codProducto) {
      return;
    }
    this.router.navigate(['/compras/producto-form', codProducto]);
  }

  eliminarProducto(producto: Producto): void {
    const codProducto = (producto.MAC02_CodProducto || '').trim();
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
      this.isLoading = true;
      this.productoService
        .eliminarProducto(codProducto)
        .pipe(
          finalize(() => {
            this.isLoading = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (response) => {
            const message = response?.respuesta || 'Producto eliminado correctamente.';
            Swal.fire({
              title: 'Eliminado',
              text: message,
              icon: 'success'
            });
            this.loadProductos(this.pageNumber, this.pageSize);
          },
          error: (error) => {
            console.error('Error al eliminar producto:', error);
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar el producto.',
              icon: 'error'
            });
          }
        });
    });
  }

  private setupLineaWatcher(): void {
    this.filtrosForm.controls.linea.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((linea) => this.onLineaChange(linea));
  }

  private onLineaChange(linea: string): void {
    this.resetCategorias();
    const normalized = this.normalizeValue(linea);
    if (!normalized) {
      return;
    }
    this.loadCategorias(normalized);
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
          console.error('Error al cargar lineas:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar las lineas.',
            icon: 'error'
          });
          this.lineas = [];
        }
      });
  }

  private loadCategorias(linea: string): void {
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
        },
        error: (error) => {
          console.error('Error al cargar categorias:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar las categorias.',
            icon: 'error'
          });
          this.categorias = [];
          this.disableCategoriaControl();
        }
      });
  }

  private loadProductos(pageNumber: number, pageSize: number): void {
    const filtros = this.buildFiltros(pageNumber, pageSize);
    this.isLoading = true;
    this.hasSearched = true;

    this.productoService
      .getProductos(filtros)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => this.handleProductosResponse(response, pageNumber, pageSize),
        error: (error) => {
          console.error('Error al cargar productos:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar los productos.',
            icon: 'error'
          });
          this.productos = [];
          this.updatePagination([], pageNumber, pageSize);
        }
      });
  }

  private handleProductosResponse(response: ProductoResponse, pageNumber: number, pageSize: number): void {
    const productos = response?.datos ?? [];
    this.productos = productos;
    this.updatePagination(productos, pageNumber, pageSize, response?.paginacion?.[0]);
  }

  private buildFiltros(pageNumber: number, pageSize: number): ProductoFiltros {
    const values = this.filtrosForm.getRawValue();
    return {
      nomProducto: this.normalizeValue(values.nomProducto),
      linea: this.normalizeValue(values.linea),
      categoria: this.normalizeValue(values.categoria),
      codigoBarra: this.normalizeValue(values.codigoBarra),
      pageNumber,
      pageSize
    };
  }

  private updatePagination(
    productos: Producto[],
    pageNumber: number,
    pageSize: number,
    paginacion?: ProductoPaginacion
  ): void {
    if (productos.length === 0) {
      this.pageNumber = pageNumber;
      this.pageSize = pageSize;
      this.totalPages = 1;
      this.totalRegistros = 0;
      this.pageStart = 0;
      this.pageEnd = 0;
      return;
    }

    const totalRegistros = this.toNumber(paginacion?.TotalRegistros, productos.length);
    const totalPages = this.toNumber(paginacion?.TotalPaginas, Math.ceil(totalRegistros / pageSize) || 1);
    const paginaActual = this.toNumber(paginacion?.PaginaActual, pageNumber);

    this.totalRegistros = totalRegistros;
    this.totalPages = Math.max(1, totalPages);
    this.pageNumber = Math.min(Math.max(paginaActual, 1), this.totalPages);
    this.pageSize = pageSize;
    this.pageStart = totalRegistros === 0 ? 0 : (this.pageNumber - 1) * pageSize + 1;
    this.pageEnd = totalRegistros === 0 ? 0 : Math.min(this.pageStart + productos.length - 1, totalRegistros);
  }

  private resetCategorias(): void {
    this.categorias = [];
    this.filtrosForm.controls.categoria.reset('', { emitEvent: false });
    this.disableCategoriaControl();
  }

  private enableCategoriaControl(): void {
    this.filtrosForm.controls.categoria.enable({ emitEvent: false });
  }

  private disableCategoriaControl(): void {
    this.filtrosForm.controls.categoria.disable({ emitEvent: false });
  }

  private normalizeValue(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toNumber(value: number | string | null | undefined, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  private isProductoActivo(producto: Producto): boolean {
    const value = (producto.MAC02_Activo || '').toString().trim().toUpperCase();
    return value === 'S' || value === 'SI' || value === '1' || value === 'ACTIVO';
  }
}
