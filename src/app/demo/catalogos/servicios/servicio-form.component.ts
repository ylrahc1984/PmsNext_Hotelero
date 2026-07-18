import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  ServiciosService,
  ServicioUI,
  CentroCostoOption,
  CategoriaOption,
  UnidadMedidaOption
} from './servicios.service';
import { RecetaDetallePayload, ManejoRecetaPayload, EquivalenciaGeneralDto } from './servicios.service';
import { ProductoService } from '../../compras/producto-list/producto.service';
import { Producto } from '../../compras/producto-list/interfaces/Producto.interface';

interface RecetaDetalleForm extends RecetaDetallePayload {
  costoUnidadOrigen: number | null;
}

interface ServicioFormData {
  codReceta         : string;
  nomReceta         : string;
  nomCorto          : string;
  codCateg          : string;
  codGrupo          : string;
  uMedida           : string;
  numPorciones      : number;
  ctoReceta         : number;
  ctoProduccion     : number;
  ctoNeto           : number;
  utilidad          : number;
  totalCUtilidad    : number;
  ctoIva            : number;
  ctoTotal          : number;
  descripcion       : string;
  visible           : number;
  urlImagen         : string;
  cabys             : string;
  compuesto         : string;
}

interface CabysItem {
  codigo          : string;
  descripcion     : string;
  categorias      : string[];
  impuesto        : number;
  uri             : string;
  estado          : string;
}

interface CabysResponse {
  total       : number;
  cantidad    : number;
  cabys       : CabysItem[];
}

@Component({
  selector: 'app-servicio-form',
  imports: [CommonModule, SharedModule, FormsModule, RouterModule],
  templateUrl: './servicio-form.component.html',
  styleUrls: ['./servicio-form.component.scss']
})
export class ServicioFormComponent implements OnInit {
  formData: ServicioFormData = this.createEmpty();
  isEditing = false;
  isLoading = false;
  title = 'Nuevo Registro Comercial';

  categoriaOptions             : CategoriaOption[] = [];
  grupoOptions                 : CentroCostoOption[] = [];
  unidadOptions                : UnidadMedidaOption[] = [];
  requiereReceta               = false;
  recetaDetalle                : RecetaDetalleForm[] = [];
  showProductoModal            = false;
  productoQuery                = '';
  productos                    : Producto[] = [];
  productosLoading             = false;
  productoPageNumber           = 1;
  productoPageSize             = 10;
  productoTotalPages           = 1;
  productoTotalRegistros       = 0;
  productoPageSizeOptions      = [10, 25, 50];
  equivalenciasPorProducto     : Record<string, EquivalenciaGeneralDto[]> = {};
  equivalenciasLoading         : Record<string, boolean> = {};

  private serviciosService     = inject(ServiciosService);
  private route                = inject(ActivatedRoute);
  private router               = inject(Router);
  private http                 = inject(HttpClient);
  private productoService      = inject(ProductoService);

  get listRoute(): string {
    return this.router.url.startsWith('/restaurante/servicios') ? '/restaurante/servicios' : '/catalogos/servicios';
  }

  showCabysModal     = false;
  cabysQuery         = '';
  cabysTop           = 10;
  cabysResults       : CabysItem[] = [];
  cabysTotal         = 0;
  cabysLoading       = false;
  cabysError         = '';

  ngOnInit() {
    const codReceta = this.route.snapshot.paramMap.get('codReceta') ?? '';
    if (codReceta) {
      this.isEditing = true;
      this.title = 'Editar Registro Comercial';
      this.loadCatalogsAndServicio(codReceta);
    } else {
      this.formData = this.createEmpty();
      this.loadLookupOptions();
    }
  }

  private createEmpty(): ServicioFormData {
    return {
      codReceta         : '',
      nomReceta         : '',
      nomCorto          : '',
      codCateg          : '',
      codGrupo          : '',
      uMedida           : 'Unid',
      numPorciones      : 1,
      ctoReceta         : 0,
      ctoProduccion     : 0,
      ctoNeto           : 0,
      utilidad          : 0,
      totalCUtilidad    : 0,
      ctoIva            : 0,
      ctoTotal          : 0,
      descripcion       : '',
      visible           : 1,
      urlImagen         : '',
      cabys             : '',
      compuesto         : 'N'
    };
  }

  private loadLookupOptions(): void {
    this.loadCategoriaOptions();
    this.loadCentroCostoOptions();
    this.loadUnidadMedidaOptions();
  }

  private loadCatalogsAndServicio(codReceta: string): void {
    this.isLoading = true;
    forkJoin({
      categorias: this.serviciosService.getCategoriaOptions().pipe(catchError(() => of([]))),
      grupos: this.serviciosService.getCentroCostoOptions(1, 100).pipe(catchError(() => of([]))),
      unidades: this.serviciosService.getUnidadMedidaOptions().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ categorias, grupos, unidades }) => {
        this.categoriaOptions = categorias;
        this.grupoOptions = grupos;
        this.unidadOptions = unidades;
        this.loadServicio(codReceta);
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  private loadCategoriaOptions(): void {
    this.serviciosService.getCategoriaOptions().subscribe({
      next: (options) => {
        const selected = this.formData.codCateg;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, nombre: selected }]
          : options;
        this.categoriaOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.categoriaOptions = [];
      }
    });
  }

  private loadCentroCostoOptions(): void {
    this.serviciosService.getCentroCostoOptions(1, 100).subscribe({
      next: (options) => {
        const selected = this.formData.codGrupo;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, nombre: selected }]
          : options;
        this.grupoOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.grupoOptions = [];
      }
    });
  }

  private loadUnidadMedidaOptions(): void {
    this.serviciosService.getUnidadMedidaOptions().subscribe({
      next: (options) => {
        const selected = this.formData.uMedida;
        const merged = selected && !options.some((item) => item.codigo === selected)
          ? [...options, { codigo: selected, descripcion: selected }]
          : options;
        this.unidadOptions = merged.sort((a, b) => a.codigo.localeCompare(b.codigo));
      },
      error: () => {
        this.unidadOptions = [];
      }
    });
  }

  private loadServicio(codReceta: string): void {
    this.serviciosService.getEstructuraRecetaCompleta(codReceta).subscribe({
      next: (estructura) => {
        if (!estructura.encabezado) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el servicio.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate([this.listRoute]);
          return;
        }
        this.applyServicio(estructura.encabezado);
        this.recetaDetalle = estructura.detalle.map((item) => ({
          ...item,
          costoUnidadOrigen: null
        }));
        this.requiereReceta = this.recetaDetalle.length > 0 || estructura.encabezado.compuesto === 'S';
        this.formData.compuesto = this.requiereReceta ? 'S' : 'N';
        this.recalculateCostSummary();
        this.recetaDetalle.forEach((item) => this.loadEquivalencias(item, true));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar servicio:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el servicio.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private applyServicio(servicio: ServicioUI): void {
    this.formData = {
      ...this.createEmpty(),
      codReceta           : servicio.codReceta,
      nomReceta           : servicio.nomReceta,
      nomCorto            : servicio.nomCorto,
      codCateg            : servicio.codCateg,
      codGrupo            : servicio.codGrupo,
      uMedida             : servicio.uMedida || 'Unid',
      numPorciones        : Number(servicio.numPorciones || 0),
      ctoReceta           : this.roundCost(Number(servicio.ctoReceta || 0)),
      ctoProduccion       : this.roundCost(Number(servicio.ctoProduccion || 0)),
      ctoNeto             : this.roundCost(Number(servicio.ctoNeto || 0)),
      utilidad            : this.roundCost(Number(servicio.utilidad || 0)),
      totalCUtilidad      : this.roundCost(Number(servicio.totalCUtilidad || 0)),
      ctoIva              : this.roundCost(Number((servicio as ServicioUI & { ctoIva?: number }).ctoIva || 0)),
      ctoTotal            : this.roundCost(Number(servicio.ctoTotal || 0)),
      descripcion         : servicio.descripcion || '',
      visible             : Number(servicio.visible ?? 0),
      urlImagen           : servicio.urlImagen || '',
      cabys               : servicio.cabys || '',
      compuesto           : servicio.compuesto || 'N'
    };
    this.requiereReceta = this.formData.compuesto === 'S';

    const normalizedGrupo = this.normalizeGrupoKey(this.formData.codGrupo);
    if (normalizedGrupo) {
      const matchByCodigo = this.grupoOptions.find(
        (item) => this.normalizeGrupoKey(item.codigo) === normalizedGrupo
      );
      const matchByNombre = matchByCodigo
        ? undefined
        : this.grupoOptions.find((item) => this.normalizeGrupoKey(item.nombre) === normalizedGrupo);
      if (matchByCodigo) {
        this.formData.codGrupo = matchByCodigo.codigo;
      } else if (matchByNombre) {
        this.formData.codGrupo = matchByNombre.codigo;
      }
    }

    if (this.formData.codCateg && !this.categoriaOptions.some((item) => item.codigo === this.formData.codCateg)) {
      this.categoriaOptions = [
        ...this.categoriaOptions,
        { codigo: this.formData.codCateg, nombre: this.formData.codCateg }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    if (this.formData.codGrupo && !this.grupoOptions.some((item) => item.codigo === this.formData.codGrupo)) {
      this.grupoOptions = [
        ...this.grupoOptions,
        { codigo: this.formData.codGrupo, nombre: this.formData.codGrupo }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    if (this.formData.uMedida && !this.unidadOptions.some((item) => item.codigo === this.formData.uMedida)) {
      this.unidadOptions = [
        ...this.unidadOptions,
        { codigo: this.formData.uMedida, descripcion: this.formData.uMedida }
      ].sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
  }

  private normalizeGrupoKey(value: string | undefined | null): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/\.+$/g, '')
      .replace(/\s+/g, ' ');
  }

  onVisibleToggle(checked: boolean): void {
    this.formData.visible = checked ? 1 : 0;
  }

  onCompuestoToggle(checked: boolean): void {
    this.formData.compuesto = checked ? 'S' : 'N';
  }

  onRequiereRecetaChange(requiere: boolean): void {
    this.requiereReceta = requiere;
    this.formData.compuesto = requiere ? 'S' : 'N';
    if (!requiere) {
      this.recetaDetalle = [];
      this.recalculateRecipeCosts();
    }
  }

  openProductoModal(): void {
    this.showProductoModal = true;
    this.productoQuery = '';
    this.buscarProductos(true);
  }

  closeProductoModal(): void {
    if (!this.productosLoading) {
      this.showProductoModal = false;
    }
  }

  buscarProductos(resetPage = true): void {
    if (resetPage) {
      this.productoPageNumber = 1;
    }
    this.productosLoading = true;
    this.productoService.getProductos({
      nomProducto: this.productoQuery.trim() || undefined,
      pageNumber: this.productoPageNumber,
      pageSize: this.productoPageSize
    }).pipe(
      catchError((error) => {
        console.error('Error al buscar ingredientes:', error);
        return of({ datos: [], paginacion: [] });
      }),
      finalize(() => this.productosLoading = false)
    ).subscribe((response) => {
      this.productos = response?.datos ?? [];
      this.updateProductoPagination(response?.paginacion?.[0]);
    });
  }

  goToProductoPage(delta: number): void {
    const nextPage = this.productoPageNumber + delta;
    if (nextPage < 1 || nextPage > this.productoTotalPages || this.productosLoading) {
      return;
    }
    this.productoPageNumber = nextPage;
    this.buscarProductos(false);
  }

  onProductoPageSizeChange(): void {
    this.productoPageSize = Number(this.productoPageSize) || 10;
    this.buscarProductos(true);
  }

  get productoPageStart(): number {
    return this.productoTotalRegistros === 0 ? 0 : (this.productoPageNumber - 1) * this.productoPageSize + 1;
  }

  get productoPageEnd(): number {
    return Math.min(this.productoPageStart + this.productos.length - 1, this.productoTotalRegistros);
  }

  seleccionarProducto(producto: Producto): void {
    const codigo = (producto.MAC02_CodProducto || '').trim();
    const existente = this.recetaDetalle.find((item) => item.dR_CodProducto === codigo);
    if (existente) {
      existente.dR_CanProducto += 1;
      this.recalculateRecipeCosts();
      this.showProductoModal = false;
      return;
    }

    const costo = this.roundCost(Number(producto.MAC02_UltimoCto ?? producto.MAC02_CostoPro ?? 0) || 0);
    const unidad = (producto.MAC02_UnmProdu || '').trim();
    const detalle: RecetaDetalleForm = {
      dR_Tipo               : 'P',
      dR_CodProducto        : codigo,
      dR_NomProducto        : (producto.MAC02_NomProducto || '').trim(),
      dR_UnMProducto        : unidad,
      dR_CodEquival         : '',
      dR_PorMerma           : 0,
      dR_CanProducto        : 1,
      dR_UMDestino          : unidad,
      dR_CtoProducto        : costo,
      dR_CtoTotal           : costo,
      dR_Orden              : this.recetaDetalle.length + 1,
      costoUnidadOrigen     : costo
    };
    this.recetaDetalle.push(detalle);
    this.loadEquivalencias(detalle);
    this.recalculateRecipeCosts();
    this.showProductoModal = false;
  }

  removeIngrediente(index: number): void {
    const codigo = this.recetaDetalle[index]?.dR_CodProducto;
    this.recetaDetalle.splice(index, 1);
    if (codigo) {
      delete this.equivalenciasPorProducto[codigo];
      delete this.equivalenciasLoading[codigo];
    }
    this.recetaDetalle.forEach((item, itemIndex) => item.dR_Orden = itemIndex + 1);
    this.recalculateRecipeCosts();
  }

  recalculateRecipeCosts(): void {
    this.recetaDetalle.forEach((item) => {
      const cantidad = Math.max(0, Number(item.dR_CanProducto) || 0);
      const tieneCostoUnitario = item.costoUnidadOrigen !== null && item.costoUnidadOrigen !== undefined;
      const costoUnidadOrigen = Math.max(0, Number(item.costoUnidadOrigen) || 0);
      const merma = Math.min(100, Math.max(0, Number(item.dR_PorMerma) || 0));
      item.dR_CanProducto = cantidad;
      if (tieneCostoUnitario) {
        item.costoUnidadOrigen = this.roundCost(costoUnidadOrigen);
      }
      item.dR_PorMerma = merma;
      const equivalencia = this.getEquivalenciaSeleccionada(item);
      const factorConversion = equivalencia && Number(equivalencia.MPV03_Equivalencia) > 0
        ? Number(equivalencia.MPV03_Equivalencia)
        : 1;
      const cantidadBase = equivalencia ? Math.max(0, Number(equivalencia.MPV03_Cantidad) || 1) : 1;
      const cantidadOrigen = cantidad * cantidadBase / factorConversion;
      if (tieneCostoUnitario) {
        item.dR_CtoProducto = this.roundCost(cantidadOrigen * costoUnidadOrigen);
        item.dR_CtoTotal = this.roundCost(item.dR_CtoProducto * (1 + merma / 100));
      }
    });
    const costoReceta = this.recetaDetalle.reduce((total, item) => total + item.dR_CtoTotal, 0);
    if (this.requiereReceta) {
      this.formData.ctoReceta = this.roundCost(costoReceta);
    }
    this.recalculateCostSummary();
  }

  normalizeIngredientCost(item: RecetaDetalleForm): void {
    if (item.costoUnidadOrigen === null || item.costoUnidadOrigen === undefined) {
      return;
    }
    item.costoUnidadOrigen = this.roundCost(item.costoUnidadOrigen);
    this.recalculateRecipeCosts();
  }

  normalizeTotalCost(): void {
    this.formData.ctoTotal = this.roundCost(this.formData.ctoTotal);
  }

  normalizeCostField(field: 'ctoReceta' | 'ctoProduccion' | 'ctoNeto' | 'utilidad' | 'ctoIva' | 'ctoTotal'): void {
    this.formData[field] = this.roundCost(this.formData[field]);
    if (field === 'ctoProduccion' || field === 'utilidad') {
      this.formData[field] = Math.max(0, this.formData[field]);
    }
    this.recalculateCostSummary();
  }

  private recalculateCostSummary(): void {
    const costoReceta = Math.max(0, Number(this.formData.ctoReceta) || 0);
    const porcentajeProduccion = Math.max(0, Number(this.formData.ctoProduccion) || 0);
    const porcentajeUtilidad = Math.max(0, Number(this.formData.utilidad) || 0);
    const porcentajeIva = 23;

    this.formData.ctoNeto = this.roundCost(costoReceta * (1 + porcentajeProduccion / 100));
    this.formData.totalCUtilidad = this.roundCost(this.formData.ctoNeto * (1 + porcentajeUtilidad / 100));
    this.formData.ctoIva = this.roundCost(this.formData.totalCUtilidad * (porcentajeIva / 100));
    this.formData.ctoTotal = this.roundCost(this.formData.totalCUtilidad + this.formData.ctoIva);
  }

  onEquivalenciaChange(item: RecetaDetalleForm): void {
    const equivalencia = this.getEquivalenciaSeleccionada(item);
    item.dR_UMDestino = equivalencia?.MPV03_UMDestino?.trim() || item.dR_UnMProducto;
    this.recalculateRecipeCosts();
  }

  getEquivalencias(item: RecetaDetalleForm): EquivalenciaGeneralDto[] {
    return this.equivalenciasPorProducto[item.dR_CodProducto] ?? [];
  }

  getConversionLabel(item: RecetaDetalleForm): string {
    const equivalencia = this.getEquivalenciaSeleccionada(item);
    if (!equivalencia) {
      return `Costo por ${item.dR_UnMProducto || 'unidad'} base`;
    }
    return `${equivalencia.MPV03_Cantidad} ${equivalencia.MPV03_UMOrigen} = ${equivalencia.MPV03_Equivalencia} ${equivalencia.MPV03_UMDestino}`;
  }

  private loadEquivalencias(item: RecetaDetalleForm, preserveStoredCost = false): void {
    const codigo = item.dR_CodProducto;
    const unidadOrigen = item.dR_UnMProducto.trim();
    if (!codigo || !unidadOrigen) {
      return;
    }

    this.equivalenciasLoading[codigo] = true;
    this.serviciosService.getEquivalenciasPorUnidadOrigen(unidadOrigen).pipe(
      catchError((error) => {
        console.error(`Error al cargar equivalencias para ${unidadOrigen}:`, error);
        return of([] as EquivalenciaGeneralDto[]);
      }),
      finalize(() => this.equivalenciasLoading[codigo] = false)
    ).subscribe((equivalencias) => {
      this.equivalenciasPorProducto[codigo] = equivalencias;
      const equivalenciaGuardada = equivalencias.find((equivalencia) =>
        String(equivalencia.MPV03_CodEqui) === String(item.dR_CodEquival)
      );
      const mismaUnidad = equivalencias.find((equivalencia) =>
        equivalencia.MPV03_UMDestino.trim().toUpperCase() === unidadOrigen.toUpperCase()
      );
      const seleccion = equivalenciaGuardada ?? mismaUnidad ?? equivalencias[0];
      if (seleccion) {
        item.dR_CodEquival = String(seleccion.MPV03_CodEqui);
        item.dR_UMDestino = seleccion.MPV03_UMDestino.trim();
      } else {
        item.dR_CodEquival = '';
        item.dR_UMDestino = unidadOrigen;
      }
      if (!preserveStoredCost) {
        this.recalculateRecipeCosts();
      }
    });
  }

  private getEquivalenciaSeleccionada(item: RecetaDetalleForm): EquivalenciaGeneralDto | undefined {
    return this.getEquivalencias(item).find((equivalencia) =>
      String(equivalencia.MPV03_CodEqui) === String(item.dR_CodEquival)
    );
  }

  private roundCost(value: number): number {
    const numericValue = Number(value) || 0;
    return Math.round((numericValue + Number.EPSILON) * 100) / 100;
  }

  private updateProductoPagination(meta?: { TotalRegistros: number; PaginaActual: number; TotalPaginas: number }): void {
    const totalRegistros = Number(meta?.TotalRegistros ?? this.productos.length) || this.productos.length;
    const totalPages = Number(meta?.TotalPaginas ?? Math.ceil(totalRegistros / this.productoPageSize)) || 1;
    const paginaActual = Number(meta?.PaginaActual ?? this.productoPageNumber) || this.productoPageNumber;

    this.productoTotalRegistros = totalRegistros;
    this.productoTotalPages = Math.max(1, totalPages);
    this.productoPageNumber = Math.min(Math.max(1, paginaActual), this.productoTotalPages);
  }

  async saveServicio(form: NgForm): Promise<void> {
    if (!form.valid || this.isLoading) {
      return;
    }

    if (this.requiereReceta && this.recetaDetalle.length === 0) {
      Swal.fire({
        title: 'Receta incompleta',
        text: this.isEditing
          ? 'El registro tiene receta, pero el endpoint actual no devolvio sus ingredientes. Cargue nuevamente el detalle antes de actualizar.'
          : 'Agregue al menos un ingrediente o seleccione la opcion sin receta.',
        icon: 'warning'
      });
      return;
    }

    const cleaned: ServicioUI = {
      codReceta           : this.formData.codReceta.trim(),
      nomReceta           : this.formData.nomReceta.trim(),
      nomCorto            : this.formData.nomCorto?.trim() || '',
      codCateg            : this.formData.codCateg.trim(),
      codGrupo            : this.formData.codGrupo.trim(),
      uMedida             : this.formData.uMedida.trim(),
      numPorciones        : Number(this.formData.numPorciones || 0),
      ctoReceta           : Number(this.formData.ctoReceta || 0),
      ctoProduccion       : Number(this.formData.ctoProduccion || 0),
      ctoNeto             : Number(this.formData.ctoNeto || 0),
      utilidad            : Number(this.formData.utilidad || 0),
      totalCUtilidad      : Number(this.formData.totalCUtilidad || 0),
      ctoIva              : Number(this.formData.ctoIva || 0),
      ctoTotal            : Number(this.formData.ctoTotal || 0),
      descripcion         : this.formData.descripcion?.trim() || '',
      visible             : Number(this.formData.visible ?? 0),
      urlImagen           : this.formData.urlImagen?.trim() || '',
      cabys               : this.formData.cabys?.trim() || '',
      compuesto           : this.formData.compuesto || 'N'
    };

    const payload: ManejoRecetaPayload = {
      proceso: this.isEditing ? 2 : 1,
      tmpdetalle: this.requiereReceta ? this.recetaDetalle.map((item, index) => ({
        dR_Tipo           : item.dR_Tipo,
        dR_CodProducto    : item.dR_CodProducto,
        dR_NomProducto    : item.dR_NomProducto,
        dR_UnMProducto    : item.dR_UnMProducto,
        dR_CodEquival     : item.dR_CodEquival,
        dR_PorMerma       : item.dR_PorMerma,
        dR_CanProducto    : item.dR_CanProducto,
        dR_UMDestino      : item.dR_UMDestino,
        dR_CtoProducto    : item.dR_CtoProducto,
        dR_CtoTotal       : item.dR_CtoTotal,
        dR_Orden          : index + 1
      })) : [],
      codcateg            : cleaned.codCateg,
      codgrupo            : cleaned.codGrupo,
      codreceta           : cleaned.codReceta,
      nomreceta           : cleaned.nomReceta,
      nomcorto            : cleaned.nomCorto,
      umedida             : cleaned.uMedida,
      numporciones        : cleaned.numPorciones,
      ctoreceta           : cleaned.ctoReceta,
      ctoproduccion       : cleaned.ctoProduccion,
      ctoneto             : cleaned.ctoNeto,
      utilidad            : cleaned.utilidad,
      totalcutilidad      : cleaned.totalCUtilidad,
      ctototal            : cleaned.ctoTotal,
      descripcion         : cleaned.descripcion,
      visible             : cleaned.visible,
      urlimagen           : cleaned.urlImagen,
      operador            : '',
      cabys               : cleaned.cabys,
      compuesto           : this.requiereReceta ? 'S' : 'N',
      pageSize            : 0,
      pageNumber          : 0,
    };

    const actionLabel = this.isEditing ? 'actualizar' : 'crear';
    const recipeSummary = this.requiereReceta
      ? `La receta contiene ${payload.tmpdetalle.length} ingrediente${payload.tmpdetalle.length === 1 ? '' : 's'}.`
      : 'El producto se guardara sin receta.';
    const confirmation = await Swal.fire({
      title: this.isEditing ? 'Confirmar actualizacion' : 'Confirmar nuevo registro',
      text: `¿Desea ${actionLabel} ${cleaned.nomReceta}? ${recipeSummary}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.isEditing ? 'Si, actualizar' : 'Si, crear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: this.isEditing ? '#4f46e5' : '#198754',
      reverseButtons: true,
      focusCancel: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const request = this.isEditing
      ? this.serviciosService.actualizarManejoReceta(payload)
      : this.serviciosService.insertarManejoReceta(payload);

    this.isLoading = true;
    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
          icon: 'success'
        });
        this.router.navigate([this.listRoute]);
      },
      error: (error) => {
        console.error('Error al guardar servicio:', error);
        Swal.fire({
          title: 'Error',
          text: this.isEditing ? 'No se pudo actualizar el servicio.' : 'No se pudo crear el servicio.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate([this.listRoute]);
  }

  openCabysModal(): void {
    this.showCabysModal = true;
    if (!this.cabysQuery) {
      this.cabysQuery = this.formData.nomReceta?.trim() || '';
    }
  }

  closeCabysModal(): void {
    if (this.cabysLoading) {
      return;
    }
    this.showCabysModal = false;
  }

  onCabysSearch(): void {
    const query = this.cabysQuery?.trim();
    if (!query) {
      this.cabysResults = [];
      this.cabysTotal = 0;
      this.cabysError = 'Ingrese un texto para buscar.';
      return;
    }

    const top = Math.min(50, Math.max(1, Number(this.cabysTop) || 10));
    this.cabysTop = top;
    this.cabysLoading = true;
    this.cabysError = '';

    const params = new HttpParams().set('q', query).set('top', String(top));
    this.http
      .get<CabysResponse>('https://api.hacienda.go.cr/fe/cabys', { params })
      .pipe(
        catchError((error) => {
          console.error('Error al consultar CABYS:', error);
          this.cabysError = 'No se pudo consultar CABYS.';
          return of({ total: 0, cantidad: 0, cabys: [] } as CabysResponse);
        }),
        finalize(() => {
          this.cabysLoading = false;
        })
      )
      .subscribe((response) => {
        this.cabysTotal = Number(response?.total ?? 0);
        this.cabysResults = response?.cabys ?? [];
      });
  }

  selectCabys(item: CabysItem): void {
    this.formData.cabys = item?.codigo ?? '';
    this.showCabysModal = false;
  }
}
