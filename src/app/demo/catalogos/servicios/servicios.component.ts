import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { OperatorFunction } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ServiciosService, ServicioUI, CentroCostoOption, CategoriaOption } from './servicios.service';
import { ListaPrecioService } from '../listas-precios/lista-precio.service';
import { ListaPrecioUI } from '../listas-precios/lista-precio.models';
import { DetalleListaPrecioHotelService } from '../listas-precios/services/detalle-lista-precio-hotel.service';
import {
  AgregarDetalleListaPrecioPayload,
  DetalleListaPrecioHotelModel
} from '../listas-precios/models/detalle-lista-precio-hotel.model';

@Component({
  selector: 'app-servicios',
  imports: [CommonModule, SharedModule, FormsModule, RouterModule],
  templateUrl: './servicios.component.html',
  styleUrls: ['./servicios.component.scss']
})
export class ServiciosComponent implements OnInit {
  servicios             : ServicioUI[] = [];
  filteredServicios     : ServicioUI[] = [];
  isLoading             = false;

  filterNombre               = '';
  filterCategoria            = '';
  filterGrupo                = '';
  filterVisible              = '1';
  categoriaSearchValue       : CategoriaOption | string = '';
  grupoSearchValue           : CentroCostoOption | string = '';
  lookupModal                : 'categoria' | 'grupo' | null = null;
  lookupModalQuery           = '';

  categoriaOptions           : CategoriaOption[] = [];
  grupoOptions               : CentroCostoOption[] = [];

  currentPage                = 1;
  pageSize                   = 10;
  totalPages                 = 1;
  totalRegistros             = 0;
  pageSizeOptions            = [10, 20, 50, 100];

  isPriceListModalOpen        = false;
  priceListModalService       : ServicioUI | null = null;
  priceLists                  : ListaPrecioUI[] = [];
  priceListSearchTerm         = '';
  isLoadingPriceLists         = false;
  priceListLoadError          = '';
  selectedPriceList           : ListaPrecioUI | null = null;
  selectedPriceListDetail     : DetalleListaPrecioHotelModel[] = [];
  isCheckingPriceList         = false;
  priceListCheckSucceeded     = false;
  selectedPriceListHasProduct = false;
  priceListValidationMessage  = '';
  priceListPrice              : number | null = null;
  isAddingToPriceList         = false;

  private readonly serviciosService = inject(ServiciosService);
  private readonly listaPrecioService = inject(ListaPrecioService);
  private readonly detalleListaPrecioService = inject(DetalleListaPrecioHotelService);
  private readonly router = inject(Router);
  private priceListCheckRequestId = 0;

  readonly searchCategorias: OperatorFunction<string, readonly CategoriaOption[]> = (text$) => text$.pipe(
    debounceTime(150),
    distinctUntilChanged(),
    map((term) => this.filterLookupOptions(this.categoriaOptions, term))
  );

  readonly searchGrupos: OperatorFunction<string, readonly CentroCostoOption[]> = (text$) => text$.pipe(
    debounceTime(150),
    distinctUntilChanged(),
    map((term) => this.filterLookupOptions(this.grupoOptions, term))
  );

  readonly categoriaFormatter = (item: CategoriaOption | string): string =>
    typeof item === 'string' ? item : `${item.codigo} - ${item.nombre}`;

  readonly grupoFormatter = (item: CentroCostoOption | string): string =>
    typeof item === 'string' ? item : `${item.codigo} - ${item.nombre}`;

  get baseRoute(): string {
    return this.isRestaurantConfiguration ? '/restaurante/configuracion/servicios' : '/catalogos/servicios';
  }

  get parentRoute(): string {
    return '/restaurante/configuracion';
  }

  get parentLabel(): string {
    return 'Configuracion Restaurante';
  }

  get isRestaurantConfiguration(): boolean {
    return this.router.url.startsWith('/restaurante/configuracion/servicios');
  }

  get filteredPriceLists(): ListaPrecioUI[] {
    const term = this.normalizeSearch(this.priceListSearchTerm);
    return this.priceLists
      .filter((lista) => {
        if (!term) {
          return true;
        }
        return [lista.codigo, lista.descripcion, lista.moneda, lista.planRate]
          .some((value) => this.normalizeSearch(value).includes(term));
      })
      .sort((a, b) => {
        if (a.vigente !== b.vigente) {
          return a.vigente === 'S' ? -1 : 1;
        }
        return (a.descripcion || a.codigo).localeCompare(b.descripcion || b.codigo);
      });
  }

  get canAddServiceToPriceList(): boolean {
    return Boolean(
      this.priceListModalService &&
      this.selectedPriceList &&
      this.selectedPriceList.vigente === 'S' &&
      this.selectedPriceList.moneda?.trim() &&
      !this.isCheckingPriceList &&
      this.priceListCheckSucceeded &&
      !this.selectedPriceListHasProduct &&
      !this.isAddingToPriceList &&
      Number(this.priceListPrice) > 0
    );
  }

  get selectedPriceListNextOrder(): number {
    return this.selectedPriceListDetail.reduce(
      (max, item) => Math.max(max, Number(item.MPV05_Orden) || 0),
      0
    ) + 1;
  }

  ngOnInit() {
    this.loadCategoriaOptions();
    this.loadGrupoOptions();
    this.loadServicios();
  }

  loadServicios(): void {
    this.isLoading = true;
    const visible   = Number(this.filterVisible);
    const codGrupo  = this.filterGrupo.trim() || undefined;
    const codCateg  = this.filterCategoria.trim() || undefined;
    const nombre    = this.normalizeNombre(this.filterNombre);

    const request = nombre
      ? this.serviciosService.consultarServiciosPorNombre(nombre, visible, this.currentPage, this.pageSize)
      : this.serviciosService.consultarServiciosPorGrupo(
          visible,
          this.currentPage,
          this.pageSize,
          codGrupo,
          codCateg
        );

    request.subscribe({
      next: (result) => {
        this.servicios               = result.data ?? [];
        this.totalRegistros          = Number(result.totalRegistros ?? this.servicios.length) || this.servicios.length;
        this.currentPage             = Number(result.paginaActual ?? this.currentPage) || this.currentPage;
        this.pageSize                = Number(result.pageSize ?? this.pageSize) || this.pageSize;
        this.totalPages              = Number(result.totalPages ?? 1) || 1;
        this.applyLocalFilters       ();
        this.isLoading               = false;
      },
      error: (error) => {
        console.error('Error al cargar servicios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los servicios.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private loadCategoriaOptions(): void {
    this.serviciosService.getCategoriaOptions().subscribe({
      next: (options) => {
        const selected = this.filterCategoria.trim().toUpperCase();
        const normalizedOptions = options.map((item) => ({
          codigo: (item.codigo || '').trim().toUpperCase(),
          nombre: (item.nombre || '').trim() || (item.codigo || '').trim().toUpperCase()
        }));
        const merged = selected && !normalizedOptions.some((item) => item.codigo === selected)
          ? [...normalizedOptions, { codigo: selected, nombre: selected }]
          : normalizedOptions;
        this.categoriaOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: (error) => {
        console.error('Error al cargar categorias:', error);
        this.categoriaOptions = [];
      }
    });
  }

  private loadGrupoOptions(): void {
    this.serviciosService.getCentroCostoOptions(1, 50).subscribe({
      next: (options) => {
        const selected = this.filterGrupo.trim().toUpperCase();
        const normalizedOptions = options.map((item) => ({
          codigo: (item.codigo || '').trim().toUpperCase(),
          nombre: (item.nombre || '').trim() || (item.codigo || '').trim().toUpperCase()
        }));
        const merged = selected && !normalizedOptions.some((item) => item.codigo === selected)
          ? [...normalizedOptions, { codigo: selected, nombre: selected }]
          : normalizedOptions;
        this.grupoOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: (error) => {
        console.error('Error al cargar grupos:', error);
        this.grupoOptions = [];
      }
    });
  }

  applyLocalFilters(): void {
    const categoria = this.filterCategoria.trim();
    const grupo = this.filterGrupo.trim();
    const visible = Number(this.filterVisible);

    this.filteredServicios = this.servicios.filter((item) => {
      const matchesCategoria = !categoria || item.codCateg === categoria;
      const matchesGrupo = !grupo || item.codGrupo === grupo;
      const matchesVisible = item.visible === visible;
      return matchesCategoria && matchesGrupo && matchesVisible;
    });
  }

  onBuscar(): void {
    this.filterNombre = this.normalizeNombre(this.filterNombre);
    this.currentPage = 1;
    this.loadServicios();
  }

  onLimpiar(): void {
    this.filterNombre              = '';
    this.filterCategoria           = '';
    this.filterGrupo               = '';
    this.categoriaSearchValue      = '';
    this.grupoSearchValue          = '';
    this.filterVisible             = '1';
    this.currentPage               = 1;
    this.loadServicios();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.pageSize = Number(this.pageSize) || 20;
    this.loadServicios();
  }

  goToPageRelative(delta: number): void {
    const nextPage = Number(this.currentPage) + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadServicios();
  }

  toggleVisibleFilter(checked: boolean): void {
    this.filterVisible = checked ? '1' : '0';
  }

  onCategoriaSelected(event: NgbTypeaheadSelectItemEvent<CategoriaOption>): void {
    this.filterCategoria = event.item.codigo;
    this.categoriaSearchValue = event.item;
  }

  onGrupoSelected(event: NgbTypeaheadSelectItemEvent<CentroCostoOption>): void {
    this.filterGrupo = event.item.codigo;
    this.grupoSearchValue = event.item;
  }

  onCategoriaInputChange(value: CategoriaOption | string): void {
    this.categoriaSearchValue = value;
    this.filterCategoria = typeof value === 'string' ? this.resolveLookupCode(this.categoriaOptions, value) : value.codigo;
  }

  onGrupoInputChange(value: CentroCostoOption | string): void {
    this.grupoSearchValue = value;
    this.filterGrupo = typeof value === 'string' ? this.resolveLookupCode(this.grupoOptions, value) : value.codigo;
  }

  openLookupModal(type: 'categoria' | 'grupo'): void {
    this.lookupModal = type;
    this.lookupModalQuery = '';
  }

  closeLookupModal(): void {
    this.lookupModal = null;
    this.lookupModalQuery = '';
  }

  get lookupModalTitle(): string {
    return this.lookupModal === 'categoria' ? 'Seleccionar categoria' : 'Seleccionar grupo';
  }

  get lookupModalOptions(): Array<CategoriaOption | CentroCostoOption> {
    const options = this.lookupModal === 'categoria' ? this.categoriaOptions : this.grupoOptions;
    return this.filterLookupOptions(options, this.lookupModalQuery, 50);
  }

  selectLookupModalOption(option: CategoriaOption | CentroCostoOption): void {
    if (this.lookupModal === 'categoria') {
      this.filterCategoria = option.codigo;
      this.categoriaSearchValue = option;
    } else {
      this.filterGrupo = option.codigo;
      this.grupoSearchValue = option;
    }
    this.closeLookupModal();
  }

  openPriceListModal(servicio: ServicioUI): void {
    this.priceListModalService = servicio;
    this.isPriceListModalOpen = true;
    this.priceLists = [];
    this.priceListSearchTerm = '';
    this.priceListLoadError = '';
    this.selectedPriceList = null;
    this.selectedPriceListDetail = [];
    this.priceListCheckSucceeded = false;
    this.selectedPriceListHasProduct = false;
    this.priceListValidationMessage = '';
    this.priceListPrice = null;
    this.loadPriceLists();
  }

  closePriceListModal(): void {
    if (this.isAddingToPriceList) {
      return;
    }
    this.priceListCheckRequestId += 1;
    this.isPriceListModalOpen = false;
    this.priceListModalService = null;
    this.selectedPriceList = null;
    this.selectedPriceListDetail = [];
    this.isCheckingPriceList = false;
    this.priceListCheckSucceeded = false;
  }

  selectPriceList(lista: ListaPrecioUI): void {
    if (lista.vigente !== 'S' || !lista.moneda?.trim() || this.isAddingToPriceList) {
      return;
    }

    const requestId = ++this.priceListCheckRequestId;
    this.selectedPriceList = lista;
    this.selectedPriceListDetail = [];
    this.priceListCheckSucceeded = false;
    this.selectedPriceListHasProduct = false;
    this.priceListValidationMessage = '';
    this.priceListPrice = null;
    this.isCheckingPriceList = true;

    this.detalleListaPrecioService.getDetalle(lista.codigo).subscribe({
      next: (detalle) => {
        if (requestId !== this.priceListCheckRequestId || !this.isPriceListModalOpen) {
          return;
        }
        this.selectedPriceListDetail = detalle;
        this.priceListCheckSucceeded = true;
        this.selectedPriceListHasProduct = this.detailContainsService(detalle);
        this.isCheckingPriceList = false;
        this.priceListValidationMessage = this.selectedPriceListHasProduct
          ? `El producto ${this.priceListModalService?.codReceta} ya pertenece a esta lista de precios.`
          : 'Producto disponible para agregar a esta lista.';
      },
      error: (error) => {
        if (requestId !== this.priceListCheckRequestId || !this.isPriceListModalOpen) {
          return;
        }
        console.error('Error al verificar producto en lista de precios:', error);
        this.selectedPriceListDetail = [];
        this.priceListCheckSucceeded = false;
        this.isCheckingPriceList = false;
        this.priceListValidationMessage = 'No se pudo verificar el contenido de la lista. Intente nuevamente.';
      }
    });
  }

  confirmAddServiceToPriceList(): void {
    const servicio = this.priceListModalService;
    const lista = this.selectedPriceList;
    const precio = Number(this.priceListPrice);
    if (!servicio || !lista || !this.canAddServiceToPriceList || !Number.isFinite(precio)) {
      return;
    }

    this.isAddingToPriceList = true;
    this.priceListValidationMessage = 'Verificando nuevamente la lista antes de guardar...';

    this.detalleListaPrecioService.getDetalle(lista.codigo).subscribe({
      next: (detalleActual) => {
        if (this.detailContainsService(detalleActual)) {
          this.selectedPriceListDetail = detalleActual;
          this.priceListCheckSucceeded = true;
          this.selectedPriceListHasProduct = true;
          this.isAddingToPriceList = false;
          this.priceListValidationMessage = `El producto ${servicio.codReceta} ya fue agregado a esta lista.`;
          Swal.fire({
            title: 'Producto ya incluido',
            text: 'La lista cambió antes de confirmar. No se realizó ningún registro duplicado.',
            icon: 'info'
          });
          return;
        }

        const payload = this.buildPriceListPayload(servicio, lista, detalleActual, precio);
        this.detalleListaPrecioService.agregarProducto(payload).subscribe({
          next: () => {
            this.isAddingToPriceList = false;
            this.closePriceListModal();
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: `${servicio.nomReceta} agregado a ${lista.descripcion || lista.codigo}.`,
              showConfirmButton: false,
              timer: 2600,
              timerProgressBar: true
            });
          },
          error: (error) => {
            console.error('Error al agregar producto a lista de precios:', error);
            this.isAddingToPriceList = false;
            this.priceListValidationMessage = 'No se pudo agregar el producto a la lista de precios.';
            Swal.fire({
              title: 'Error',
              text: 'No se pudo agregar el producto a la lista de precios.',
              icon: 'error'
            });
          }
        });
      },
      error: (error) => {
        console.error('Error en validacion final de lista de precios:', error);
        this.isAddingToPriceList = false;
        this.priceListValidationMessage = 'No fue posible completar la validación final. No se realizó ningún cambio.';
      }
    });
  }

  trackByPriceList(_: number, lista: ListaPrecioUI): string {
    return lista.codigo;
  }

  private loadPriceLists(): void {
    this.isLoadingPriceLists = true;
    this.listaPrecioService.getListas({ pageNumber: 1, pageSize: 500 }).subscribe({
      next: (result) => {
        if (!this.isPriceListModalOpen) {
          return;
        }
        this.priceLists = result.data ?? [];
        this.isLoadingPriceLists = false;
        this.priceListLoadError = '';
      },
      error: (error) => {
        console.error('Error al cargar listas de precios:', error);
        this.priceLists = [];
        this.isLoadingPriceLists = false;
        this.priceListLoadError = 'No se pudieron cargar las listas de precios.';
      }
    });
  }

  private detailContainsService(detalle: DetalleListaPrecioHotelModel[]): boolean {
    const productCode = this.normalizeCode(this.priceListModalService?.codReceta);
    return Boolean(productCode) &&
      detalle.some((item) => this.normalizeCode(item.MPV05_CodProducto) === productCode);
  }

  private buildPriceListPayload(
    servicio: ServicioUI,
    lista: ListaPrecioUI,
    detalle: DetalleListaPrecioHotelModel[],
    precio: number
  ): AgregarDetalleListaPrecioPayload {
    const maxOrder = detalle.reduce((max, item) => Math.max(max, Number(item.MPV05_Orden) || 0), 0);
    return {
      proceso: 0,
      codLstPrecio: lista.codigo.trim(),
      codProducto: servicio.codReceta.trim(),
      desProducto: servicio.nomReceta.trim(),
      nomCorto: (servicio.nomCorto || '').trim(),
      precioTotal: precio,
      cstoProdu: Number(servicio.ctoTotal || servicio.ctoReceta) || 0,
      impuesto: 1,
      moneda: lista.moneda.trim().toUpperCase(),
      orden: maxOrder + 1,
      operador: '',
      pageNumber: 0,
      pageSize: 0,
      respuesta: ''
    };
  }

  private normalizeCode(value: unknown): string {
    return `${value ?? ''}`.trim().toUpperCase();
  }

  private normalizeSearch(value: unknown): string {
    return `${value ?? ''}`.trim().toLocaleLowerCase();
  }

  private normalizeNombre(value: string): string {
    return (value || '').trim().replace(/\s+/g, ' ');
  }

  private filterLookupOptions<T extends { codigo: string; nombre: string }>(options: T[], term: string, limit = 12): T[] {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
      return options.slice(0, limit);
    }
    return options
      .filter((item) => item.codigo.toLowerCase().includes(normalized) || item.nombre.toLowerCase().includes(normalized))
      .slice(0, limit);
  }

  private resolveLookupCode<T extends { codigo: string; nombre: string }>(options: T[], value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return '';
    }
    const match = options.find((item) =>
      item.codigo.toLowerCase() === normalized || `${item.codigo} - ${item.nombre}`.toLowerCase() === normalized
    );
    return match?.codigo ?? '';
  }

  deleteServicio(servicio: ServicioUI): void {
    Swal.fire({
      title: 'Eliminar servicio',
      text: `Desea eliminar el servicio ${servicio.codReceta}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.serviciosService.eliminarServicio(servicio.codReceta).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Servicio eliminado correctamente.',
            icon: 'success'
          });
          this.loadServicios();
        },
        error: (error) => {
          console.error('Error al eliminar servicio:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el servicio.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  cambiarVisibilidadServicio(servicio: ServicioUI, visible: 0 | 1): void {
    const accion = visible === 1 ? 'mostrar' : 'ocultar';
    const accionPasada = visible === 1 ? 'mostrado' : 'ocultado';

    Swal.fire({
      title: `${visible === 1 ? 'Mostrar' : 'Ocultar'} servicio`,
      text: `¿Está seguro de ${accion} el servicio ${servicio.codReceta}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.serviciosService.actualizarVisibilidad(servicio.codReceta, visible).subscribe({
        next: () => {
          Swal.fire({
            title: `Servicio ${accionPasada}`,
            text: `El servicio se ha ${accionPasada} correctamente.`,
            icon: 'success'
          });
          this.loadServicios();
        },
        error: (error) => {
          console.error(`Error al ${accion} servicio:`, error);
          Swal.fire({
            title: 'Error',
            text: `No se pudo ${accion} el servicio.`,
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  getVisibleBadge(visible: number): string {
    return visible === 1 ? 'badge-success' : 'badge-secondary';
  }
}
