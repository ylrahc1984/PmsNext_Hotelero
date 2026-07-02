import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import {
  RestaurantInvoiceDialogComponent,
  RestaurantInvoiceDialogData,
  RestaurantInvoiceDialogResult
} from '../dialogs/restaurant-invoice-dialog/restaurant-invoice-dialog.component';
import { SelectedRestaurantTableContext } from '../models/restaurant-operacion.models';
import {
  NotaPedidoRestauranteProceso91Response,
  NotaPedidoRestauranteService
} from '../services/nota-pedido-restaurante.service';

export interface MesaDetalle {
  mesaId          : number;
  numeroMesa      : string;
  salon           : string;
  estado          : string;
  mesero          : string;
  personas        : number;
  horaApertura    : string;
  tiempoOcupada   : string;
  habitacion      ?: string;
  cliente         ?: string;
  comentario      ?: string;
}

export interface ConsumoMesa {
  id            : number;
  codigo        : string;
  producto      : string;
  cantidad      : number;
  precio        : number;
  subtotal      : number;
  moneda        : string;
  orden         : number;
  cuenta        : string;
}

export interface NotaPedidoMesaInfo {
  tipNp       : string;
  serieNp     : string;
  numNp       : string;
  fecha       : string;
  respuesta   : string;
}

interface NotaPedidoMesaState {
  mesaId              : number;
  pntVta              : string;
  codArea             : string;
  tipNp               : string;
  serieNp             : string;
  numNp               : string;
  fecha               : string;
  cuentaFiltro        ?: number;
  detalleResponse     : NotaPedidoRestauranteProceso91Response | null;
}

interface AccionOperativa {
  id        : string;
  titulo    : string;
  icono     : string;
  tipo      ?: 'primary' | 'danger';
}

@Component({
  selector: 'app-restaurant-mesa-detalle',
  standalone: true,
  imports: [CommonModule, RestaurantInvoiceDialogComponent],
  templateUrl: './restaurant-mesa-detalle.component.html',
  styleUrls: ['./restaurant-mesa-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantMesaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notaPedidoService = inject(NotaPedidoRestauranteService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly mesaId = Number(this.route.snapshot.paramMap.get('id') ?? '12');
  readonly selectedTableContext = this.readSelectedTableContext();
  readonly codPuntoVenta = this.route.snapshot.queryParamMap.get('puntoVenta') || this.selectedTableContext?.puntoVenta?.codigo || '';
  readonly codAreaOperativa =
    this.route.snapshot.queryParamMap.get('ubicacion') || this.selectedTableContext?.areaOperativa.MPV09_CodUbicacion || '';
  readonly codMozo = this.route.snapshot.queryParamMap.get('mozo') || this.selectedTableContext?.mozo.MPV11_CodUsuario || '';

  readonly mesaDetalle: MesaDetalle = {
    mesaId          : this.mesaId,
    numeroMesa      : String(this.mesaId),
    salon           : this.selectedTableContext?.areaOperativa.MPV09_Descripcion || this.codAreaOperativa || 'Principal',
    estado          : 'Ocupada',
    mesero          : this.selectedTableContext?.mozo.MPV11_NomMozo || this.codMozo || 'Sin asignar',
    personas        : 4,
    horaApertura    : '12:15 PM',
    tiempoOcupada   : '01:25 h',
    habitacion      : '000',
    cliente         : 'Cliente General',
    comentario      : 'Orden de mesa para 4 personas, sin requerimientos especiales.'
  };

  consumoActual             : ConsumoMesa[] = [];
  notaPedidoInfo            : NotaPedidoMesaInfo | null = null;
  monedaActual              = 'USD';
  subtotal                  = 0;
  descuento                 = 0;
  impuestos                 = 0;
  propina                   = 0;
  total                     = 0;
  showInvoiceDialog         = false;
  notaPedidoDetalleValido   = false;
  invoiceDialogData         : RestaurantInvoiceDialogData | null = null;
  eliminandoItems           = new Set<number>();
  cambiandoCuentaItems      = new Set<number>();
  dividiendoItems           = new Set<number>();
  cuentaModalItem           : ConsumoMesa | null = null;
  dividirModalItem          : ConsumoMesa | null = null;
  cuentaSeleccionada        = 1;
  cuentaFiltroActual        = 0;
  partesSeleccionadas       = 2;
  readonly cuentasDisponibles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly partesDisponibles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly acciones: AccionOperativa[] = [
    { id: 'imprimir-cuenta', titulo: 'Imprimir Cuenta', icono: 'icon-printer' },
    { id: 'reimprimir-comanda', titulo: 'Re Imprimir Comanda', icono: 'icon-file-text' },
    { id: 'transferir-cuenta', titulo: 'Transferir Cuenta', icono: 'icon-repeat' },
    { id: 'facturar-mesa', titulo: 'Facturar Mesa', icono: 'icon-credit-card', tipo: 'primary' },
    { id: 'cargo-colaborador', titulo: 'Cargo Colaborador', icono: 'icon-user' },
    { id: 'cargo-incluido', titulo: 'Cargo Incluido', icono: 'icon-package' },
    { id: 'cargo-habitacion', titulo: 'Cargo Habitacion', icono: 'icon-home' },
    { id: 'regresar-principal', titulo: 'Regresar a Principal', icono: 'icon-corner-up-left' }
  ];

  ngOnInit(): void {
    this.cargarNotaPedidoActual();
  }

  onAccionClick(accion: AccionOperativa): void {
    if (accion.id === 'facturar-mesa') {
      this.abrirModalFacturacion();
      return;
    }
    if (accion.id === 'regresar-principal') {
      this.router.navigate(['/restaurant/dashboard', this.codPuntoVenta]);
    }
  }

  abrirCatalogoProductos(): void {
    const notaPedidoQuery =
      this.notaPedidoDetalleValido && this.notaPedidoInfo
        ? {
            tipNp: this.notaPedidoInfo.tipNp,
            serieNp: this.notaPedidoInfo.serieNp,
            numNp: this.notaPedidoInfo.numNp,
            fecha: this.normalizeDateDDMMYYYY(this.notaPedidoInfo.fecha)
          }
        : {};

    this.router.navigate(['/restaurant/pos-productos', this.mesaId], {
      queryParams: {
        puntoVenta: this.codPuntoVenta,
        ubicacion: this.codAreaOperativa,
        mozo: this.codMozo,
        ...notaPedidoQuery
      }
    });
  }

  seleccionarFiltroCuenta(cuenta: number): void {
    this.cuentaFiltroActual = cuenta;
    if (!this.notaPedidoInfo) {
      this.cdr.markForCheck();
      return;
    }

    this.consultarDetallePedido(
      this.notaPedidoInfo.tipNp,
      this.notaPedidoInfo.serieNp,
      this.notaPedidoInfo.numNp,
      this.notaPedidoInfo.fecha,
      cuenta
    );
  }

  async eliminarItem(item: ConsumoMesa): Promise<void> {
    if (!this.notaPedidoInfo || this.eliminandoItems.has(item.id)) {
      return;
    }

    const result = await Swal.fire({
      title: 'Eliminar item',
      text: `Desea eliminar ${item.producto || 'este item'} de la nota?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        popup: 'next-confirm-modal'
      }
    });

    if (!result.isConfirmed) {
      return;
    }

    this.eliminandoItems.add(item.id);
    this.cdr.markForCheck();

    this.notaPedidoService
      .eliminarItem({
        tipNp: this.notaPedidoInfo.tipNp,
        serieNp: this.notaPedidoInfo.serieNp,
        numNp: this.notaPedidoInfo.numNp,
        nItem: item.id,
        fecha: this.notaPedidoInfo.fecha || this.formatDate(new Date())
      })
      .subscribe({
        next: () => {
          sessionStorage.removeItem('restaurantLastNotaPedido');
          void Swal.fire({
            title: 'Item eliminado',
            text: 'El consumo fue actualizado correctamente.',
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.consultarDetallePedido(
            this.notaPedidoInfo?.tipNp || '',
            this.notaPedidoInfo?.serieNp || '',
            this.notaPedidoInfo?.numNp || '',
            this.notaPedidoInfo?.fecha || this.formatDate(new Date()),
            this.cuentaFiltroActual
          );
        },
        error: () => {
          void Swal.fire({
            title: 'No se pudo eliminar',
            text: 'Revise la conexion o intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.eliminandoItems.delete(item.id);
          this.cdr.markForCheck();
        }
      });
  }

  isItemEliminando(item: ConsumoMesa): boolean {
    return this.eliminandoItems.has(item.id);
  }

  abrirModalCambiarCuenta(item: ConsumoMesa): void {
    if (!this.notaPedidoInfo || this.cambiandoCuentaItems.has(item.id)) {
      return;
    }

    const cuentaActual = Number(item.cuenta || 1);
    this.cuentaSeleccionada = this.cuentasDisponibles.includes(cuentaActual) ? cuentaActual : 1;
    this.cuentaModalItem = item;
    this.cdr.markForCheck();
  }

  cerrarModalCambiarCuenta(): void {
    if (this.cuentaModalItem && this.cambiandoCuentaItems.has(this.cuentaModalItem.id)) {
      return;
    }

    this.cuentaModalItem = null;
    this.cuentaSeleccionada = 1;
    this.cdr.markForCheck();
  }

  seleccionarCuenta(cuenta: number): void {
    if (this.isCambioCuentaGuardando()) {
      return;
    }

    this.cuentaSeleccionada = cuenta;
  }

  confirmarCambioCuenta(): void {
    if (!this.notaPedidoInfo || !this.cuentaModalItem || this.isCambioCuentaGuardando()) {
      return;
    }

    const item = this.cuentaModalItem;
    const cuentaDestino = this.cuentaSeleccionada;
    this.cambiandoCuentaItems.add(item.id);
    this.cdr.markForCheck();

    this.notaPedidoService
      .cambiarCuenta({
        tipNp: this.notaPedidoInfo.tipNp,
        serieNp: this.notaPedidoInfo.serieNp,
        numNp: this.notaPedidoInfo.numNp,
        nItem: item.id,
        subtotal: cuentaDestino,
        fecha: this.notaPedidoInfo.fecha || this.formatDate(new Date())
      })
      .subscribe({
        next: () => {
          sessionStorage.removeItem('restaurantLastNotaPedido');
          const fecha = this.notaPedidoInfo?.fecha || this.formatDate(new Date());
          const tipNp = this.notaPedidoInfo?.tipNp || '';
          const serieNp = this.notaPedidoInfo?.serieNp || '';
          const numNp = this.notaPedidoInfo?.numNp || '';
          this.cuentaModalItem = null;
          this.cuentaSeleccionada = 1;
          void Swal.fire({
            title: 'Cuenta actualizada',
            text: `El item fue movido a la cuenta ${cuentaDestino}.`,
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
        },
        error: () => {
          void Swal.fire({
            title: 'No se pudo cambiar',
            text: 'Revise la conexion o intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.cambiandoCuentaItems.delete(item.id);
          this.cdr.markForCheck();
        }
      });
  }

  isCuentaCambiando(item: ConsumoMesa): boolean {
    return this.cambiandoCuentaItems.has(item.id);
  }

  isCambioCuentaGuardando(): boolean {
    return !!this.cuentaModalItem && this.cambiandoCuentaItems.has(this.cuentaModalItem.id);
  }

  abrirModalDividirItem(item: ConsumoMesa): void {
    if (!this.notaPedidoInfo || this.dividiendoItems.has(item.id)) {
      return;
    }

    this.partesSeleccionadas = 2;
    this.dividirModalItem = item;
    this.cdr.markForCheck();
  }

  cerrarModalDividirItem(): void {
    if (this.dividirModalItem && this.dividiendoItems.has(this.dividirModalItem.id)) {
      return;
    }

    this.dividirModalItem = null;
    this.partesSeleccionadas = 2;
    this.cdr.markForCheck();
  }

  seleccionarPartes(partes: number): void {
    if (this.isDividirItemGuardando()) {
      return;
    }

    this.partesSeleccionadas = partes;
  }

  confirmarDividirItem(): void {
    if (!this.notaPedidoInfo || !this.dividirModalItem || this.isDividirItemGuardando()) {
      return;
    }

    const item = this.dividirModalItem;
    const partes = this.partesSeleccionadas;
    this.dividiendoItems.add(item.id);
    this.cdr.markForCheck();

    this.notaPedidoService
      .dividirProducto({
        tipNp: this.notaPedidoInfo.tipNp,
        serieNp: this.notaPedidoInfo.serieNp,
        numNp: this.notaPedidoInfo.numNp,
        ordenOrigen: item.orden,
        partes
      })
      .subscribe({
        next: () => {
          sessionStorage.removeItem('restaurantLastNotaPedido');
          const fecha = this.notaPedidoInfo?.fecha || this.formatDate(new Date());
          const tipNp = this.notaPedidoInfo?.tipNp || '';
          const serieNp = this.notaPedidoInfo?.serieNp || '';
          const numNp = this.notaPedidoInfo?.numNp || '';
          this.dividirModalItem = null;
          this.partesSeleccionadas = 2;
          void Swal.fire({
            title: 'Item dividido',
            text: `El item fue dividido en ${partes} partes.`,
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
        },
        error: () => {
          void Swal.fire({
            title: 'No se pudo dividir',
            text: 'Revise la conexion o intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.dividiendoItems.delete(item.id);
          this.cdr.markForCheck();
        }
      });
  }

  isItemDividiendo(item: ConsumoMesa): boolean {
    return this.dividiendoItems.has(item.id);
  }

  isDividirItemGuardando(): boolean {
    return !!this.dividirModalItem && this.dividiendoItems.has(this.dividirModalItem.id);
  }

  abrirModalFacturacion(): void {
    this.invoiceDialogData = {
      mesa          : this.mesaDetalle.numeroMesa || String(this.mesaId),
      salon         : this.mesaDetalle.salon || 'Salón Principal',
      pax           : Number(this.mesaDetalle.personas || 4),
      puntoVenta    : this.codPuntoVenta || 'PL',
      codArea       : this.codAreaOperativa || '08',
      codMozo       : this.codMozo || 'FFUENTES',
      moneda        : this.monedaActual || this.selectedTableContext?.puntoVenta?.detalle?.MPV04_Moneda || 'USD',
      tipoCambio    : 1,
      subtotal      : Number(this.subtotal || 0),
      impuesto      : Number(this.impuestos || 0),
      total         : Number(this.total || 0),
      propina       : Number(this.propina || 0),
      tipNdp        : this.notaPedidoInfo?.tipNp || '',
      numeroNdp     : this.notaPedidoInfo?.numNp || '',
      operador      : this.getOperador()
    };
    this.showInvoiceDialog = true;
    this.cdr.markForCheck();
  }

  onInvoiceDialogClosed(result: RestaurantInvoiceDialogResult | null): void {
    this.showInvoiceDialog = false;
    this.invoiceDialogData = null;
    if (result?.facturado) {
      this.limpiarMesaFacturada();
    }
    this.cdr.markForCheck();
  }

  private readSelectedTableContext(): SelectedRestaurantTableContext | null {
    const raw = sessionStorage.getItem('selectedRestaurantTableContext');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as SelectedRestaurantTableContext;
    } catch {
      return null;
    }
  }

  private cargarNotaPedidoActual(): void {
    this.notaPedidoDetalleValido = false;
    const tipNp = this.route.snapshot.queryParamMap.get('tipNp');
    const serieNp = this.route.snapshot.queryParamMap.get('serieNp');
    const numNp = this.route.snapshot.queryParamMap.get('numNp');
    const fecha = this.normalizeDateDDMMYYYY(this.route.snapshot.queryParamMap.get('fecha'));
    
    if (tipNp && serieNp && numNp && fecha) {
      this.notaPedidoInfo = { tipNp, serieNp, numNp, fecha, respuesta: 'Pendiente' };
      this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
      return;
    }

    const state = this.readNotaPedidoMesaState();
    if (state && this.isNotaPedidoDeMesaActual(state)) {
      this.notaPedidoInfo = {
        tipNp: state.tipNp,
        serieNp: state.serieNp,
        numNp: state.numNp,
        fecha: this.normalizeDateDDMMYYYY(state.fecha),
        respuesta: state.detalleResponse?.respuesta || 'OK'
      };
      if (state.detalleResponse && Number(state.cuentaFiltro || 0) === this.cuentaFiltroActual) {
        this.aplicarDetallePedido(state.detalleResponse);
        return;
      }
      this.consultarDetallePedido(
        state.tipNp,
        state.serieNp,
        state.numNp,
        this.normalizeDateDDMMYYYY(state.fecha),
        this.cuentaFiltroActual
      );
      return;
    }

    const contextNotaPedido = this.selectedTableContext?.mesa.notaPedido;
    if (contextNotaPedido?.tipNp && contextNotaPedido.serieNp && contextNotaPedido.numNp && contextNotaPedido.fecha) {
      this.notaPedidoInfo = {
        tipNp: contextNotaPedido.tipNp,
        serieNp: contextNotaPedido.serieNp,
        numNp: contextNotaPedido.numNp,
        fecha: this.normalizeDateDDMMYYYY(contextNotaPedido.fecha),
        respuesta: 'Pendiente'
      };
      this.consultarDetallePedido(
        contextNotaPedido.tipNp,
        contextNotaPedido.serieNp,
        contextNotaPedido.numNp,
        this.normalizeDateDDMMYYYY(contextNotaPedido.fecha),
        this.cuentaFiltroActual
      );
      return;
    }

    this.limpiarNotaPedidoEnPantalla();
  }

  private consultarDetallePedido(tipNp: string, serieNp: string, numNp: string, fecha: string, cuentaFiltro = this.cuentaFiltroActual): void {
    this.notaPedidoDetalleValido = false;
    const normalizedFecha = this.normalizeDateDDMMYYYY(fecha);
    this.cuentaFiltroActual = Number(cuentaFiltro || 0);
    this.notaPedidoService
      .obtenerDetallePedido({
        tipNp,
        serieNp,
        numNp,
        pntVta: this.codPuntoVenta,
        fecha: normalizedFecha,
        exonerado: this.cuentaFiltroActual
      })
      .subscribe({
        next: (response) => {
          this.notaPedidoInfo = {
            tipNp,
            serieNp,
            numNp,
            fecha: normalizedFecha,
            respuesta: response.respuesta || 'OK'
          };
          this.aplicarDetallePedido(response);
        },
        error: () => {
          this.notaPedidoDetalleValido = false;
          this.eliminandoItems.clear();
          this.cambiandoCuentaItems.clear();
          this.dividiendoItems.clear();
          this.cdr.markForCheck();
        }
      });
  }

  private limpiarMesaFacturada(): void {
    sessionStorage.removeItem('restaurantLastNotaPedido');
    this.limpiarSelectedTableContextActual();
    this.limpiarNotaPedidoEnPantalla(true);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tipNp: null,
        serieNp: null,
        numNp: null,
        fecha: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private limpiarNotaPedidoEnPantalla(marcarMesaLibre = false): void {
    this.notaPedidoInfo = null;
    this.notaPedidoDetalleValido = false;
    this.consumoActual = [];
    this.subtotal = 0;
    this.descuento = 0;
    this.impuestos = 0;
    this.propina = 0;
    this.total = 0;
    this.cuentaFiltroActual = 0;
    this.cuentaModalItem = null;
    this.dividirModalItem = null;
    this.eliminandoItems.clear();
    this.cambiandoCuentaItems.clear();
    this.dividiendoItems.clear();

    if (marcarMesaLibre) {
      this.mesaDetalle.estado = 'Libre';
      this.mesaDetalle.personas = 0;
      this.mesaDetalle.horaApertura = '-';
      this.mesaDetalle.tiempoOcupada = '-';
      this.mesaDetalle.habitacion = '';
      this.mesaDetalle.cliente = '';
      this.mesaDetalle.comentario = 'Mesa disponible para nueva nota de pedido.';
    }
  }

  private limpiarSelectedTableContextActual(): void {
    const context = this.readSelectedTableContext();
    if (!context) {
      return;
    }

    const mismaMesa = Number(context.mesa?.numero || 0) === this.mesaId;
    const mismoPuntoVenta = !this.codPuntoVenta || context.puntoVenta?.codigo === this.codPuntoVenta;
    const mismaArea = !this.codAreaOperativa || context.areaOperativa?.MPV09_CodUbicacion === this.codAreaOperativa;

    if (mismaMesa && mismoPuntoVenta && mismaArea) {
      sessionStorage.removeItem('selectedRestaurantTableContext');
    }
  }

  private aplicarDetallePedido(response: NotaPedidoRestauranteProceso91Response): void {
    this.notaPedidoDetalleValido = true;
    this.eliminandoItems.clear();
    this.cambiandoCuentaItems.clear();
    this.dividiendoItems.clear();
    this.consumoActual = (response.detalles || []).map((detalle) => {
      const cantidad = Number(detalle.ppV08_Cantidad || 0);
      const precio = Number(detalle.ppV08_Precio || 0);
      return {
        id          : detalle.ppV08_ID,
        codigo      : detalle.ppV08_CodProducto,
        producto    : (detalle.ppV08_NomProducto || '').trim(),
        cantidad    ,
        precio      ,
        subtotal    : detalle.ppV08_Precio,
        moneda      : detalle.ppV08_Moneda || 'USD',
        orden       : detalle.ppV08_Orden,
        cuenta      : detalle.ppV08_NCuenta || ''
      };
    });

    const firstCurrency = this.consumoActual[0]?.moneda;
    this.monedaActual = firstCurrency || this.monedaActual;
    this.subtotal = Number(response.totales?.subtotal || 0);
    this.descuento = 0;
    this.impuestos = Number(response.totales?.impuestos || 0);
    this.propina = Number(response.totalPropina || 0);
    this.total = Number(response.totales?.granTotal ?? response.totales?.total ?? 0);
    if (this.notaPedidoInfo) {
      this.notaPedidoInfo = {
        ...this.notaPedidoInfo,
        respuesta: response.respuesta || this.notaPedidoInfo.respuesta
      };
      this.persistirNotaPedidoMesaState(response);
    }
    this.cdr.markForCheck();
  }

  private persistirNotaPedidoMesaState(detalleResponse: NotaPedidoRestauranteProceso91Response): void {
    if (!this.notaPedidoInfo) {
      return;
    }

    const state: NotaPedidoMesaState = {
      mesaId            : this.mesaId,
      pntVta            : this.codPuntoVenta,
      codArea           : this.codAreaOperativa,
      tipNp             : this.notaPedidoInfo.tipNp,
      serieNp           : this.notaPedidoInfo.serieNp,
      numNp             : this.notaPedidoInfo.numNp,
      fecha             : this.normalizeDateDDMMYYYY(this.notaPedidoInfo.fecha),
      cuentaFiltro      : this.cuentaFiltroActual,
      detalleResponse
    };
    sessionStorage.setItem('restaurantLastNotaPedido', JSON.stringify(state));
  }

  private readNotaPedidoMesaState(): NotaPedidoMesaState | null {
    const raw = sessionStorage.getItem('restaurantLastNotaPedido');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as NotaPedidoMesaState;
    } catch {
      return null;
    }
  }

  private isNotaPedidoDeMesaActual(state: NotaPedidoMesaState): boolean {
    return (
      state.mesaId === this.mesaId &&
      (!state.pntVta || state.pntVta === this.codPuntoVenta) &&
      (!state.codArea || state.codArea === this.codAreaOperativa)
    );
  }

  private getOperador(): string {
    const user = this.authService.getCurrentUser();
    return (user?.usuario || user?.Usuario || user?.Operador || 'charly').toString().trim() || 'charly';
  }

  private formatDate(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private normalizeDateDDMMYYYY(value: unknown): string {
    const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    const slashDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashDate) {
      return `${slashDate[1].padStart(2, '0')}/${slashDate[2].padStart(2, '0')}/${slashDate[3]}`;
    }

    const isoDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDate) {
      return `${isoDate[3].padStart(2, '0')}/${isoDate[2].padStart(2, '0')}/${isoDate[1]}`;
    }

    return normalized;
  }
}
