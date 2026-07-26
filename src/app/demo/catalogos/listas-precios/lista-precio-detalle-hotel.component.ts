import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AgregarDetalleListaPrecioPayload, DetalleListaPrecioHotelModel, RecetaNoEnListaHotelModel } from './models/detalle-lista-precio-hotel.model';
import { DetalleListaPrecioHotelService } from './services/detalle-lista-precio-hotel.service';
import { ListaPrecioService } from './lista-precio.service';

@Component({
  selector: 'app-lista-precio-detalle-hotel',
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './lista-precio-detalle-hotel.component.html',
  styleUrls: ['./lista-precio-detalle-hotel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListaPrecioDetalleHotelComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly detalleService = inject(DetalleListaPrecioHotelService);
  private readonly listaPrecioService = inject(ListaPrecioService);

  codListaPrecio      = '';
  nombreListaPrecio   = '';
  monedaListaPrecio   = '';
  data                : DetalleListaPrecioHotelModel[] = [];
  filteredData        : DetalleListaPrecioHotelModel[] = [];
  pagedData           : DetalleListaPrecioHotelModel[] = [];

  searchTerm           = '';
  isLoading            = false;
  isDeleting           = false;
  errorMessage         = '';

  currentPage            = 1;
  pageSize               = 10;
  totalRecords           = 0;
  pageSizeOptions        = [10, 25, 50, 100];

  isProductModalOpen        = false;
  isLoadingRecetas          = false;
  isSavingProducto          = false;
  recetaSearchTerm          = '';
  recetaErrorMessage        = '';
  recetasNoEnLista          : RecetaNoEnListaHotelModel[] = [];
  selectedReceta            : RecetaNoEnListaHotelModel | null = null;
  selectedPrecioTotal       : number | null = null;
  recetaCurrentPage         = 1;
  recetaPageSize            = 20;
  recetaTotalRecords        = 0;
  recetaTotalPages          = 1;
  recetaPageSizeOptions     = [10, 20, 50];

  ngOnInit(): void {
    this.codListaPrecio = (this.route.snapshot.paramMap.get('codListaPrecio') || '').trim();
    if (!this.codListaPrecio) {
      this.volver();
      return;
    }
    const listaNavegacion = this.getListaDesdeNavegacion();
    this.nombreListaPrecio = listaNavegacion.nombre;
    this.monedaListaPrecio = listaNavegacion.moneda;
    if (!this.nombreListaPrecio || !this.monedaListaPrecio) {
      this.loadListaPrecio();
    }
    this.loadDetalle();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
  }

  get totalProductos(): number {
    return this.data.length;
  }

  get totalCategorias(): number {
    return this.countDistinct(this.data.map((item) => item.MPV00_NomCategoria));
  }

  get totalGrupos(): number {
    return this.countDistinct(this.data.map((item) => item.MPV01_CodGrupo));
  }

  get totalMonedas(): number {
    return this.countDistinct(this.data.map((item) => item.MPV05_Moneda));
  }

  get monedaLista(): string {
    const monedaDetalle = this.data.find((item) => item.MPV05_Moneda)?.MPV05_Moneda;
    return (this.monedaListaPrecio || monedaDetalle || '').trim().toUpperCase();
  }

  loadDetalle(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.detalleService
      .getDetalle(this.codListaPrecio)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.data = [...(items ?? [])].sort((a, b) => {
            if (a.MPV05_Orden !== b.MPV05_Orden) {
              return a.MPV05_Orden - b.MPV05_Orden;
            }
            return a.MPV05_DesProducto.localeCompare(b.MPV05_DesProducto);
          });
          this.isLoading = false;
          this.applyFilter();
        },
        error: (error) => {
          console.error('Error al cargar detalle lista precio hotel:', error);
          this.data = [];
          this.filteredData = [];
          this.pagedData = [];
          this.totalRecords = 0;
          this.isLoading = false;
          this.errorMessage = 'No se pudo cargar el detalle de la lista de precios.';
          this.cdr.markForCheck();
        }
      });
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilter();
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize) || 10;
    this.currentPage = 1;
    this.rebuildPagination();
  }

  goToPageRelative(delta: number): void {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.rebuildPagination();
  }

  agregarProducto(): void {
    this.isProductModalOpen     = true;
    this.recetaSearchTerm       = '';
    this.selectedReceta         = null;
    this.selectedPrecioTotal    = null;
    this.recetaCurrentPage      = 1;
    this.loadRecetasNoEnLista();
  }

  cerrarModalProducto(): void {
    if (this.isSavingProducto) {
      return;
    }
    this.isProductModalOpen = false;
  }

  buscarRecetasNoEnLista(): void {
    this.recetaCurrentPage = 1;
    this.loadRecetasNoEnLista();
  }

  limpiarBusquedaRecetas(): void {
    this.recetaSearchTerm = '';
    this.recetaCurrentPage = 1;
    this.loadRecetasNoEnLista();
  }

  onRecetaPageSizeChange(): void {
    this.recetaPageSize = Number(this.recetaPageSize) || 20;
    this.recetaCurrentPage = 1;
    this.loadRecetasNoEnLista();
  }

  goToRecetaPageRelative(delta: number): void {
    const nextPage = this.recetaCurrentPage + delta;
    if (nextPage < 1 || nextPage > this.recetaTotalPages || this.isLoadingRecetas) {
      return;
    }
    this.recetaCurrentPage = nextPage;
    this.loadRecetasNoEnLista();
  }

  seleccionarReceta(receta: RecetaNoEnListaHotelModel): void {
    this.selectedReceta = receta;
    this.selectedPrecioTotal = null;
  }

  guardarProductoSeleccionado(): void {
    if (!this.selectedReceta || this.isSavingProducto) {
      return;
    }

    const moneda = this.monedaLista;
    if (!moneda) {
      Swal.fire({
        title: 'Moneda no disponible',
        text: 'No se pudo identificar la moneda configurada para esta lista de precios.',
        icon: 'warning'
      });
      return;
    }

    const precioTotal = Number(this.selectedPrecioTotal);
    if (!Number.isFinite(precioTotal) || precioTotal <= 0) {
      Swal.fire({
        title: 'Precio requerido',
        text: 'Indique un precio total válido. El precio debe incluir los impuestos de ley.',
        icon: 'warning'
      });
      return;
    }

    this.isSavingProducto = true;
    this.detalleService
      .agregarProducto(this.buildAgregarPayload(this.selectedReceta, precioTotal, moneda))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingProducto = false;
          this.isProductModalOpen = false;
          this.showProductoAgregadoToast();
          this.loadDetalle();
        },
        error: (error) => {
          console.error('Error al agregar producto a lista de precios:', error);
          this.isSavingProducto = false;
          Swal.fire({
            title: 'Error',
            text: 'No se pudo agregar el producto a la lista de precios.',
            icon: 'error'
          });
          this.cdr.markForCheck();
        }
      });
  }

  eliminarProducto(item: DetalleListaPrecioHotelModel): void {
    const id = this.getDeleteId(item);
    if (!id || this.isDeleting) {
      return;
    }

    Swal.fire({
      title: 'Eliminar Producto',
      text: '¿Desea eliminar este producto de la lista de precios?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        popup: 'next-confirm-modal',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-light'
      },
      buttonsStyling: false
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isDeleting = true;
      this.cdr.markForCheck();
      this.detalleService
        .eliminarProducto(this.codListaPrecio, id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isDeleting = false;
            this.showSuccessToast();
            this.loadDetalle();
          },
          error: (error) => {
            console.error('Error al eliminar producto de lista de precios:', error);
            this.isDeleting = false;
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar el producto.',
              icon: 'error'
            });
            this.cdr.markForCheck();
          }
        });
    });
  }

  trackByProducto(_: number, item: DetalleListaPrecioHotelModel): string {
    return `${item.MPV05_ID ?? ''}-${item.MPV05_CodProducto}`;
  }

  formatMoney(item: DetalleListaPrecioHotelModel, value: number): string {
    const moneda = item.MPV05_Moneda || 'USD';
    return `${moneda} ${Number(value || 0).toFixed(2)}`;
  }

  hasImpuesto(item: DetalleListaPrecioHotelModel): boolean {
    return Number(item.MPV05_Impuesto || 0) > 0;
  }

  isRecetaSelected(item: RecetaNoEnListaHotelModel): boolean {
    return this.selectedReceta?.MPV01_CodReceta === item.MPV01_CodReceta;
  }

  trackByReceta(_: number, item: RecetaNoEnListaHotelModel): string {
    return item.MPV01_CodReceta;
  }

  get listasRoute(): string {
    return this.router.url.startsWith('/restaurante/configuracion/listas-precios')
      ? '/restaurante/configuracion/listas-precios'
      : '/catalogos/listas-precios';
  }

  volver(): void {
    this.router.navigate([this.listasRoute]);
  }

  private getListaDesdeNavegacion(): { nombre: string; moneda: string } {
    const navigationState = this.router.getCurrentNavigation()?.extras.state as
      | { nombreListaPrecio?: string; monedaListaPrecio?: string }
      | undefined;
    const historyState = (history.state ?? {}) as {
      nombreListaPrecio?: string;
      monedaListaPrecio?: string;
    };
    return {
      nombre: `${navigationState?.nombreListaPrecio ?? historyState.nombreListaPrecio ?? ''}`.trim(),
      moneda: `${navigationState?.monedaListaPrecio ?? historyState.monedaListaPrecio ?? ''}`.trim().toUpperCase()
    };
  }

  private loadListaPrecio(): void {
    this.listaPrecioService
      .getListaByCodigo(this.codListaPrecio)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          this.nombreListaPrecio = (lista?.descripcion || this.nombreListaPrecio).trim();
          this.monedaListaPrecio = (lista?.moneda || this.monedaListaPrecio).trim().toUpperCase();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar informacion de lista de precios:', error);
          this.cdr.markForCheck();
        }
      });
  }

  private applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredData = term
      ? this.data.filter((item) => item.MPV05_DesProducto.toLowerCase().includes(term))
      : [...this.data];
    this.rebuildPagination();
  }

  private loadRecetasNoEnLista(): void {
    this.isLoadingRecetas = true;
    this.recetaErrorMessage = '';
    this.detalleService
      .getRecetasNoEnLista(this.codListaPrecio, this.recetaCurrentPage, this.recetaPageSize, this.recetaSearchTerm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.recetasNoEnLista     = result.data;
          this.recetaTotalRecords   = result.totalRegistros;
          this.recetaCurrentPage    = result.paginaActual;
          this.recetaPageSize       = result.pageSize;
          this.recetaTotalPages     = result.totalPages;
          this.isLoadingRecetas     = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error al cargar recetas no incluidas en lista:', error);
          this.recetasNoEnLista     = [];
          this.recetaTotalRecords   = 0;
          this.recetaTotalPages     = 1;
          this.isLoadingRecetas     = false;
          this.recetaErrorMessage   = 'No se pudieron cargar los productos disponibles.';
          this.cdr.markForCheck();
        }
      });
  }

  private buildAgregarPayload(
    receta: RecetaNoEnListaHotelModel,
    precioTotal: number,
    moneda: string
  ): AgregarDetalleListaPrecioPayload {
    return {
      proceso         : 0,
      codLstPrecio    : this.codListaPrecio,
      codProducto     : receta.MPV01_CodReceta,
      desProducto     : receta.MPV01_NomReceta,
      nomCorto        : receta.MPV01_NomCorto,
      precioTotal     ,
      cstoProdu       : receta.MPV01_CtoTotal || receta.MPV01_CtoReceta,
      impuesto        : 0,
      moneda          ,
      orden           : this.getNextOrden(),
      operador        : '',
      pageNumber      : 0,
      pageSize        : 0,
      respuesta       : ''
    };
  }

  private getNextOrden(): number {
    const maxOrden = this.data.reduce((max, item) => Math.max(max, Number(item.MPV05_Orden || 0)), 0);
    return maxOrden + 1;
  }

  private rebuildPagination(): void {
    this.totalRecords = this.filteredData.length;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedData = this.filteredData.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

  private countDistinct(values: string[]): number {
    return new Set(values.map((value) => (value || '').trim()).filter(Boolean)).size;
  }

  private getDeleteId(item: DetalleListaPrecioHotelModel): number | string {
    return item.MPV05_ID ?? item.MPV05_CodProducto;
  }

  private showSuccessToast(): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Producto eliminado correctamente.',
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true
    });
  }

  private showProductoAgregadoToast(): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Producto agregado correctamente.',
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true
    });
  }
}
