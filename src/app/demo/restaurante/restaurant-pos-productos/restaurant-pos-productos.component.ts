import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, from, map, of, switchMap, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { OperationalAction } from 'src/app/core/models/operational-context.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { OperationalPolicyService } from 'src/app/core/services/operational-policy.service';
import { RestaurantProductConfigDialogComponent } from '../dialogs/restaurant-product-config-dialog/restaurant-product-config-dialog.component';
import { CategoriaVisible } from '../interfaces/categoria-visible.interface';
import { ProductoMenu } from '../interfaces/producto-menu.interface';
import { RestaurantePedidoItem } from '../interfaces/restaurante-pedido-item.interface';
import { SelectedRestaurantTableContext } from '../models/restaurant-operacion.models';
import {
  RestaurantCommandDispatchResult,
  RestaurantCommandPrintService
} from '../printing/restaurant-command-print.service';
import { CategoriasMenuService } from '../services/categorias-menu.service';
import {
  NotaPedidoRestauranteDocumento,
  NotaPedidoRestauranteEjecutarResponse,
  NotaPedidoRestauranteProceso91Response,
  NotaPedidoRestauranteRequest,
  NotaPedidoRestauranteService
} from '../services/nota-pedido-restaurante.service';
import { ProductosMenuService } from '../services/productos-menu.service';
import { RestaurantOperationContextService } from '../services/restaurant-operation-context.service';
import { normalizeRestaurantDateDDMMYYYY } from '../services/restaurant-date.util';
import { RestaurantCartStore } from '../store/restaurant-cart.store';

type PosTab = 'categorias' | 'productos' | 'pedido';

interface NotaPedidoMesaState {
  mesaId            : number;
  pntVta            : string;
  codArea           : string;
  tipNp             : string;
  serieNp           : string;
  numNp             : string;
  fecha             : string;
  respuesta         : NotaPedidoRestauranteEjecutarResponse;
  detalleResponse   : NotaPedidoRestauranteProceso91Response | null;
}

interface NotaPedidoActiva {
  tipNp     : string;
  serieNp   : string;
  numNp     : string;
  fecha     : string;
}

interface PedidoConfirmationNotification {
  title : string;
  text  : string;
  icon  : 'success' | 'warning';
}

@Component({
  selector: 'app-restaurant-pos-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, RestaurantProductConfigDialogComponent],
  providers: [RestaurantCartStore],
  templateUrl: './restaurant-pos-productos.component.html',
  styleUrls: ['./restaurant-pos-productos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantPosProductosComponent implements OnInit, OnDestroy {
  private readonly route                   = inject(ActivatedRoute);
  private readonly router                  = inject(Router);
  private readonly categoriasService       = inject(CategoriasMenuService);
  private readonly productosService        = inject(ProductosMenuService);
  private readonly notaPedidoService       = inject(NotaPedidoRestauranteService);
  private readonly operationContext        = inject(RestaurantOperationContextService);
  private readonly operationalPolicy       = inject(OperationalPolicyService);
  private readonly authService             = inject(AuthService);
  private readonly cdr                     = inject(ChangeDetectorRef);
  private readonly commandPrintService     = inject(RestaurantCommandPrintService);
  readonly restaurantCartStore             = inject(RestaurantCartStore);

  readonly mesaId                   = Number(this.route.snapshot.paramMap.get('id') ?? '0');
  readonly selectedTableContext     = this.readSelectedTableContext();
  readonly selectedPointOfSale      =
    this.selectedTableContext?.puntoVenta ?? this.operationContext.getSelectedPointOfSale();
  readonly puntoVentaDetalle        = this.selectedPointOfSale?.detalle ?? null;
  readonly codPuntoVenta            = this.route.snapshot.queryParamMap.get('puntoVenta') || this.selectedPointOfSale?.codigo || '';
  readonly codAreaOperativa         =
    this.route.snapshot.queryParamMap.get('ubicacion') || this.selectedTableContext?.areaOperativa.MPV09_CodUbicacion || '';
  readonly codMozo                 = this.route.snapshot.queryParamMap.get('mozo') || this.selectedTableContext?.mozo.MPV11_CodUsuario || '';
  readonly codComanda              = this.puntoVentaDetalle?.MPV07_CodComanda || '';
  readonly listaPrecio             = this.puntoVentaDetalle?.MPV10_CodLstPrecio || '';
  readonly monedaPuntoVenta        = this.puntoVentaDetalle?.MPV04_Moneda || '';
  readonly notaPedidoActiva        = this.readNotaPedidoActiva();
  readonly operador                = this.getOperador();

  categorias              : CategoriaVisible[] = [];
  productos               : ProductoMenu[] = [];
  categoriaActiva         : CategoriaVisible | null = null;
  productoConfigActivo    : ProductoMenu | null = null;
  busqueda                = '';
  activeTab               : PosTab = 'productos';
  loadingCategorias       = false;
  loadingProductos        = false;
  errorCategorias         = '';
  errorProductos          = '';
  mensaje                 = '';
  guardandoPedido         = false;

  readonly mesaInfo = {
    mesa      : String(this.mesaId || this.selectedTableContext?.mesa.numero || ''),
    salon     : this.selectedTableContext?.areaOperativa.MPV09_Descripcion || this.codAreaOperativa || 'Principal',
    mesero    : this.selectedTableContext?.mozo.MPV11_NomMozo || this.codMozo || 'Sin asignar',
    personas  : this.selectedTableContext?.mesa.personas || 4,
    tiempo    : '01:25 h'
  };

  ngOnInit(): void {
    this.restaurantCartStore.limpiar();
    this.cargarCategorias();
  }

  ngOnDestroy(): void {
    this.restaurantCartStore.limpiar();
  }

  seleccionarCategoria(categoria: CategoriaVisible): void {
    this.categoriaActiva = categoria;
    this.activeTab = 'productos';
    this.productos = [];
    this.errorProductos = '';
    this.loadingProductos = true;
    this.productosService
      .obtenerProductosPorCategoria(this.listaPrecio, categoria.MPV00_CodCategoria)
      .pipe(
        catchError(() => {
          this.errorProductos = 'No fue posible cargar los productos de esta categoria.';
          return of([]);
        }),
        finalize(() => {
          this.loadingProductos = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((productos) => {
        this.productos = productos;
        this.cdr.markForCheck();
      });
  }

  productosFiltrados(): ProductoMenu[] {
    const term = this.busqueda.trim().toLowerCase();
    if (!term) {
      return this.productos;
    }
    return this.productos.filter((producto) =>
      `${producto.MPV05_DesProducto ?? ''} ${producto.MPV05_NomCorto ?? ''}`.toLowerCase().includes(term)
    );
  }

  agregarProducto(producto: ProductoMenu): void {
    this.abrirModalConfiguracion(producto);
  }

  abrirModalConfiguracion(producto: ProductoMenu): void {
    this.productoConfigActivo = producto;
    this.mensaje = '';
  }

  cerrarModalConfiguracion(): void {
    this.productoConfigActivo = null;
  }

  agregarItemConfigurado(item: RestaurantePedidoItem): void {
    this.restaurantCartStore.agregarItem(item);
    this.productoConfigActivo = null;
    this.mensaje = '';
    this.cdr.markForCheck();
  }

  contextoModalProducto() {
    return {
      pntVenta: this.codPuntoVenta,
      codMozo: this.codMozo,
      pax: this.mesaInfo.personas,
      operador: this.operador
    };
  }

  incrementar(item: RestaurantePedidoItem): void {
    this.restaurantCartStore.incrementarCantidad(item.orden);
  }

  disminuir(item: RestaurantePedidoItem): void {
    this.restaurantCartStore.disminuirCantidad(item.orden);
  }

  eliminar(item: RestaurantePedidoItem): void {
    this.restaurantCartStore.eliminarItem(item.orden);
  }

  limpiarPedido(): void {
    this.restaurantCartStore.limpiar();
    this.mensaje = '';
  }

  async confirmarPedido(): Promise<void> {
    const items = this.restaurantCartStore.items();
    if (!items.length || this.guardandoPedido) {
      return;
    }

    const requiredAction = this.notaPedidoActiva
      ? OperationalAction.UpdateOperation
      : OperationalAction.CreateOperation;
    const operationAllowed = await this.operationalPolicy.require(requiredAction, {
      refresh: true
    });

    if (!operationAllowed) {
      return;
    }

    const result = await Swal.fire({
      title: 'Confirmar pedido',
      text: `Se enviaran ${this.restaurantCartStore.totalProductos()} productos a la comanda.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        popup: 'next-confirm-modal'
      }
    });

    if (!result.isConfirmed) {
      return;
    }

    const payload = this.buildNotaPedidoPayload(items);
    console.log('Payload nota-pedido-restaurante/ejecutar', JSON.parse(JSON.stringify(payload)));
    this.guardandoPedido = true;
    this.mensaje = '';
    this.notaPedidoService
      .ejecutar(payload)
      .pipe(
        switchMap((response) => {
          console.log('nota-pedido-restaurante/ejecutar', response);
          const documento = this.getDocumentoPedido(response) || this.getDocumentoNotaActiva();
          if (!this.isPedidoOk(response) || !documento) {
            return throwError(() => new Error('La respuesta del pedido no contiene documento valido.'));
          }

          return forkJoin({
            detalleResponse: this.notaPedidoService
              .obtenerDetallePedido({
                tipNp: documento.TIPO,
                serieNp: documento.SERIE,
                numNp: documento.NUMERODOC,
                pntVta: this.codPuntoVenta,
                fecha: payload.fecha,
                exonerado: 0
              })
              .pipe(catchError(() => of(null))),
            commandResult: from(
              this.commandPrintService.dispatchPending({
                documento,
                pntVta: this.codPuntoVenta,
                codArea: this.codAreaOperativa,
                numMesa: String(this.mesaId || this.mesaInfo.mesa || ''),
                fecha: payload.fecha,
                hora: payload.hora,
                exonerado: payload.exonerado,
                salon: this.mesaInfo.salon,
                mesero: this.mesaInfo.mesero || this.codMozo,
                personas: this.mesaInfo.personas,
                nuevosItems: items
              })
            )
          }).pipe(
            map(({ detalleResponse, commandResult }) => ({
              response,
              documento,
              detalleResponse,
              commandResult
            }))
          );
        }),
        finalize(() => {
          this.guardandoPedido = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: ({ response, documento, detalleResponse, commandResult }) => {
          this.persistirNotaPedidoMesa(documento, response, detalleResponse, payload.fecha);
          const notification = this.commandNotification(documento, commandResult);
          this.mensaje = notification.text;
          this.restaurantCartStore.limpiar();
          void Swal.fire({
            title: notification.title,
            text: notification.text,
            icon: notification.icon,
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          }).then(() => this.volverMesaDetalle(documento, payload.fecha));
          this.cdr.markForCheck();
        },
        error: () => {
          this.mensaje = 'No fue posible enviar el pedido.';
          void Swal.fire({
            title: 'No se pudo confirmar',
            text: 'Revise la conexion o intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.cdr.markForCheck();
        }
      });
  }

  cancelar(): void {
    this.router.navigate(['/restaurant/mesa', this.mesaId], {
      queryParams: {
        puntoVenta: this.codPuntoVenta,
        ubicacion: this.codAreaOperativa,
        mozo: this.codMozo,
        ...this.getNotaPedidoQueryParams()
      }
    });
  }

  subtotal(): number {
    return this.restaurantCartStore.subtotalPedido();
  }

  impuestos(): number {
    return this.restaurantCartStore.totalImpuestos();
  }

  propina(): number {
    return 0;
  }

  total(): number {
    return this.subtotal() + this.propina();
  }

  subtotalItem(item: RestaurantePedidoItem): number {
    return item.total;
  }

  moneda(): string {
    return this.monedaPuntoVenta || this.restaurantCartStore.items()[0]?.moneda || this.productos[0]?.MPV05_Moneda || 'USD';
  }

  iconoCategoria(nombre: string): string {
    const key = this.normalizar(nombre);
    const icons: Record<string, string> = {
      AGUAS: 'icon-droplet',
      BEBIDAS: 'icon-coffee',
      VINOS: 'icon-award',
      POSTRES: 'icon-gift',
      CARNES: 'icon-slack',
      MARISCOS: 'icon-anchor',
      DESAYUNOS: 'icon-sun',
      PASTAS: 'icon-disc',
      COCTELES: 'icon-coffee'
    };
    return icons[key] ?? 'icon-menu';
  }

  trackCategoria(_: number, categoria: CategoriaVisible): string {
    return categoria.MPV00_CodCategoria;
  }

  trackProducto(_: number, producto: ProductoMenu): string {
    return producto.MPV05_CodProducto;
  }

  trackPedido(_: number, item: RestaurantePedidoItem): number {
    return item.orden;
  }

  private cargarCategorias(): void {
    if (!this.listaPrecio) {
      this.errorCategorias = 'El punto de venta seleccionado no tiene una lista de precios configurada.';
      this.cdr.markForCheck();
      return;
    }

    this.loadingCategorias = true;
    this.errorCategorias = '';
    console.log('Cargando categorias para lista', this.listaPrecio);
    this.categoriasService
      .obtenerCategoriasVisibles(this.listaPrecio)
      .pipe(
        catchError(() => {
          this.errorCategorias = 'No fue posible cargar las categorias.';
          return of([]);
        }),
        finalize(() => {
          this.loadingCategorias = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((categorias) => {
        this.categorias = categorias;
        
        if (categorias.length) {
          this.seleccionarCategoria(categorias[0]);
        }
      });
  }

  private normalizar(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return (user?.usuario || user?.Usuario || user?.Operador || '').toString().trim();
  }

  private buildNotaPedidoPayload(items: RestaurantePedidoItem[]): NotaPedidoRestauranteRequest {
    const now = new Date();
    const total = this.subtotal();
    const notaPedido = this.notaPedidoActiva;
    return {
      proceso         : notaPedido ? 2 : 1,
      tipNp           : notaPedido?.tipNp || this.codComanda,
      serieNp         : notaPedido?.serieNp || '',
      numNp           : notaPedido?.numNp || 'GENERA',
      pntVta          : this.codPuntoVenta,
      codArea         : this.codAreaOperativa,
      numMesa         : String(this.mesaId || this.mesaInfo.mesa || ''),
      fecha           : notaPedido?.fecha || this.formatDate(now),
      hora            : this.formatTime(now),
      codMozo         : this.codMozo,
      cCliente        : '',
      rucCliente      : '',
      nomCliente      : '',
      exonerado       : 0,
      subtotal        : total,
      impuesto        : 0,
      totalDoc        : total,
      estado          : '0',
      moneda          : this.moneda(),
      tCambio         : 1,
      lPrecio         : this.listaPrecio,
      nItem           : items.length,
      nRoom           : '',
      comentario      : '',
      operador        : this.operador,
      detalle         : items.map((item) => ({
        codConsumo    : item.codConsumo,
        nomConsumo    : item.nomConsumo,
        grupo         : item.grupo,
        categoria     : item.categoria,
        cantidad      : item.cantidad,
        precio        : item.precio,
        total         : item.total,
        modificar     : item.modificar,
        incluido      : item.incluido === 1,
        exonerado     : String(item.exonerado),
        moneda        : item.moneda,
        pax           : item.pax,
        tiempo        : item.tiempo,
        comentario    : item.comentario,
        orden         : item.orden,
        operador      : item.operador || this.operador
      })),
      respuesta       : ''
    };
  }

  private formatDate(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private formatTime(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getDocumentoPedido(response: NotaPedidoRestauranteEjecutarResponse): NotaPedidoRestauranteDocumento | null {
    const documento = response.tablas?.[0]?.[0];
    if (!documento?.TIPO || !documento?.SERIE || !documento?.NUMERODOC) {
      return null;
    }
    return documento;
  }

  private isPedidoOk(response: NotaPedidoRestauranteEjecutarResponse): boolean {
    return (response.respuesta || '').toUpperCase() === 'OK';
  }

  private persistirNotaPedidoMesa(
    documento: NotaPedidoRestauranteDocumento,
    respuesta: NotaPedidoRestauranteEjecutarResponse,
    detalleResponse: NotaPedidoRestauranteProceso91Response | null,
    fecha: string
  ): void {
    const state: NotaPedidoMesaState = {
      mesaId      : this.mesaId,
      pntVta      : this.codPuntoVenta,
      codArea     : this.codAreaOperativa,
      tipNp       : documento.TIPO,
      serieNp     : documento.SERIE,
      numNp       : documento.NUMERODOC,
      fecha,
      respuesta,
      detalleResponse
    };
    sessionStorage.setItem('restaurantLastNotaPedido', JSON.stringify(state));
  }

  private volverMesaDetalle(documento: NotaPedidoRestauranteDocumento, fecha: string): void {
    this.router.navigate(['/restaurant/mesa', this.mesaId], {
      queryParams: {
        puntoVenta    : this.codPuntoVenta,
        ubicacion     : this.codAreaOperativa,
        mozo          : this.codMozo,
        tipNp         : documento.TIPO,
        serieNp       : documento.SERIE,
        numNp         : documento.NUMERODOC,
        fecha
      }
    });
  }

  private readSelectedTableContext(): SelectedRestaurantTableContext | null {
    return this.operationContext.getSelectedTableContext();
  }

  private readNotaPedidoActiva(): NotaPedidoActiva | null {
    const tipNp = this.route.snapshot.queryParamMap.get('tipNp');
    const serieNp = this.route.snapshot.queryParamMap.get('serieNp');
    const numNp = this.route.snapshot.queryParamMap.get('numNp');
    const fecha = this.normalizeDateDDMMYYYY(this.route.snapshot.queryParamMap.get('fecha'));
    if (!tipNp || !serieNp || !numNp || !fecha) {
      return null;
    }
    return { tipNp, serieNp, numNp, fecha };
  }

  private getDocumentoNotaActiva(): NotaPedidoRestauranteDocumento | null {
    if (!this.notaPedidoActiva) {
      return null;
    }
    return {
      TIPO: this.notaPedidoActiva.tipNp,
      SERIE: this.notaPedidoActiva.serieNp,
      NUMERODOC: this.notaPedidoActiva.numNp
    };
  }

  private getNotaPedidoQueryParams(): Partial<NotaPedidoActiva> {
    if (!this.notaPedidoActiva) {
      return {};
    }
    return {
      tipNp: this.notaPedidoActiva.tipNp,
      serieNp: this.notaPedidoActiva.serieNp,
      numNp: this.notaPedidoActiva.numNp,
      fecha: this.notaPedidoActiva.fecha
    };
  }

  private normalizeDateDDMMYYYY(value: unknown): string {
    return normalizeRestaurantDateDDMMYYYY(value);
  }

  private commandNotification(
    documento: NotaPedidoRestauranteDocumento,
    result: RestaurantCommandDispatchResult
  ): PedidoConfirmationNotification {
    const documentNumber = `${documento.TIPO}-${documento.SERIE}-${documento.NUMERODOC}`;

    if (result.impresorasFaltantes.length) {
      const missing = result.impresorasFaltantes
        .map((failure) => `${failure.destino} (${failure.impresora})`)
        .join(', ');
      return {
        title: 'Pedido guardado, comanda pendiente',
        text: `Nota ${documentNumber} guardada. No se consultó la comanda porque faltan: ${missing}.`,
        icon: 'warning'
      };
    }

    if (result.errorConsulta) {
      return {
        title: 'Pedido guardado, comanda pendiente',
        text: `Nota ${documentNumber} guardada. ${result.errorConsulta}`,
        icon: 'warning'
      };
    }

    if (result.erroresImpresion.length) {
      const failed = result.erroresImpresion
        .map((failure) => `${failure.destino} (${failure.impresora})`)
        .join(', ');
      return {
        title: 'Pedido guardado con incidencia',
        text: `La comanda fue procesada, pero falló la impresión en ${failed}. Utilice Reimprimir comanda.`,
        icon: 'warning'
      };
    }

    const printed = result.impresos.length
      ? ` Comandas enviadas: ${result.impresos.join(' y ')}.`
      : '';
    return {
      title: 'Pedido confirmado',
      text: `Nota ${documentNumber} generada correctamente.${printed}`,
      icon: 'success'
    };
  }
}
