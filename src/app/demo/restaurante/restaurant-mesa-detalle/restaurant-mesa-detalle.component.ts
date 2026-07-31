import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { timer } from 'rxjs';
import Swal from 'sweetalert2';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import {
  RestaurantCollaboratorChargeDialogComponent,
  RestaurantCollaboratorChargeDialogData,
  RestaurantCollaboratorChargeDialogResult
} from '../dialogs/restaurant-collaborator-charge-dialog/restaurant-collaborator-charge-dialog.component';
import {
  RestaurantInvoiceDialogComponent,
  RestaurantInvoiceDialogData,
  RestaurantInvoiceDialogResult
} from '../dialogs/restaurant-invoice-dialog/restaurant-invoice-dialog.component';
import {
  RestaurantRoomChargeDialogComponent,
  RestaurantRoomChargeDialogData,
  RestaurantRoomChargeDialogResult
} from '../dialogs/restaurant-room-charge-dialog/restaurant-room-charge-dialog.component';
import { SelectedRestaurantTableContext } from '../models/restaurant-operacion.models';
import {
  RestaurantCommandDispatchResult,
  RestaurantCommandPrintService
} from '../printing/restaurant-command-print.service';
import { RestaurantPrecheckPrintBuilder } from '../printing/restaurant-precheck-print.builder';
import { RestaurantDashboardService } from '../restaurant-dashboard/restaurant-dashboard.service';
import { RestaurantOperationContextService } from '../services/restaurant-operation-context.service';
import { normalizeRestaurantDateDDMMYYYY } from '../services/restaurant-date.util';
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
  hora        : string;
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
  hora                ?: string;
  cuentaFiltro        ?: number;
  detalleResponse     : NotaPedidoRestauranteProceso91Response | null;
}

interface AccionOperativa {
  id        : string;
  titulo    : string;
  icono     : string;
  tipo      ?: 'primary' | 'danger';
  sinPermiso?: boolean;
}

@Component({
  selector: 'app-restaurant-mesa-detalle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RestaurantInvoiceDialogComponent,
    RestaurantCollaboratorChargeDialogComponent,
    RestaurantRoomChargeDialogComponent
  ],
  templateUrl: './restaurant-mesa-detalle.component.html',
  styleUrls: ['./restaurant-mesa-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantMesaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notaPedidoService = inject(NotaPedidoRestauranteService);
  private readonly dashboardService = inject(RestaurantDashboardService);
  private readonly operationContext = inject(RestaurantOperationContextService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly precheckPrintBuilder = inject(RestaurantPrecheckPrintBuilder);
  private readonly commandPrintService = inject(RestaurantCommandPrintService);
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly destroyRef = inject(DestroyRef);
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
    horaApertura    : this.selectedTableContext?.mesa.horaReserva || '12:30',
    tiempoOcupada   : '01:25 h',
    habitacion      : '000',
    cliente         : 'Cliente General',
    comentario      : 'Orden de mesa para 4 personas, sin requerimientos especiales.'
  };

  consumoActual                 : ConsumoMesa[] = [];
  notaPedidoInfo                : NotaPedidoMesaInfo | null = null;
  monedaActual                  = 'USD';
  subtotal                      = 0;
  descuento                     = 0;
  impuestos                     = 0;
  propina                       = 0;
  total                         = 0;
  tipoCambio                   : TipoCambio | null = null;
  tipoCambioLoading            = false;
  tipoCambioError              = '';
  showInvoiceDialog             = false;
  notaPedidoDetalleValido       = false;
  invoiceDialogData             : RestaurantInvoiceDialogData | null = null;
  showCollaboratorChargeDialog  = false;
  collaboratorChargeDialogData : RestaurantCollaboratorChargeDialogData | null = null;
  showRoomChargeDialog          = false;
  roomChargeDialogData          : RestaurantRoomChargeDialogData | null = null;
  eliminandoItems               = new Set<number>();
  cambiandoCuentaItems          = new Set<number>();
  dividiendoItems               = new Set<number>();
  cuentaModalItem               : ConsumoMesa | null = null;
  dividirModalItem              : ConsumoMesa | null = null;
  cuentaSeleccionada            = 1;
  cuentaFiltroActual            = 0;
  partesSeleccionadas           = 2;
  readonly cuentasDisponibles   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly partesDisponibles    = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  showPropinaModal              = false;
  propinaMonto                  : number | null = null;
  isPropinaSaving               = false;
  propinaError                  = '';
  isReturningToMain            = false;
  isPrintingAccount            = false;
  isReprintingCommand          = false;
  notaPedidoLoading            = false;
  notaPedidoError              = '';

  private detalleRequestId = 0;
  private currentOrderDetail: NotaPedidoRestauranteProceso91Response | null = null;

  readonly acciones: AccionOperativa[] = [
    { id: 'imprimir-cuenta', titulo: 'Imprimir Cuenta', icono: 'icon-printer' },
    { id: 'reimprimir-comanda', titulo: 'Re Imprimir Comanda', icono: 'icon-file-text' },
    { id: 'transferir-cuenta', titulo: 'Transferir Cuenta', icono: 'icon-repeat', sinPermiso: true },
    { id: 'facturar-mesa', titulo: 'Facturar Mesa', icono: 'icon-credit-card', tipo: 'primary' },
    { id: 'cargo-colaborador', titulo: 'Cargo Colaborador', icono: 'icon-user' },
    { id: 'cargo-incluido', titulo: 'Cargo Incluido', icono: 'icon-package', sinPermiso: true },
    { id: 'cargo-habitacion', titulo: 'Cargo Habitacion', icono: 'icon-home' },
    { id: 'regresar-principal', titulo: 'Regresar a Principal', icono: 'icon-corner-up-left' }
  ];

  ngOnInit(): void {
    this.cargarTipoCambio();
    this.cargarNotaPedidoActual();
    this.iniciarRelojMesa();
  }

  get compraTipoCambio(): number | null {
    return this.tipoCambio?.compra ?? null;
  }

  get ventaTipoCambio(): number | null {
    return this.tipoCambio?.venta ?? null;
  }

  get monedaPuntoVenta(): string {
    return this.selectedTableContext?.puntoVenta.detalle?.MPV04_Moneda || this.monedaActual || 'USD';
  }

  abrirModalPropina(): void {
    if (!this.notaPedidoInfo) {
      void Swal.fire({
        title: 'Nota de pedido requerida',
        text: 'Debe existir una nota de pedido activa para cargar una propina.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    this.propinaMonto = null;
    this.propinaError = '';
    this.showPropinaModal = true;
    this.cdr.markForCheck();
  }

  cerrarModalPropina(): void {
    if (this.isPropinaSaving) {
      return;
    }

    this.showPropinaModal = false;
    this.propinaMonto = null;
    this.propinaError = '';
    this.cdr.markForCheck();
  }

  confirmarPropina(): void {
    const nota = this.notaPedidoInfo;
    const monto = Number(this.propinaMonto || 0);

    if (!nota || this.isPropinaSaving) {
      return;
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      this.propinaError = 'Ingrese un monto de propina mayor que cero.';
      this.cdr.markForCheck();
      return;
    }

    this.isPropinaSaving = true;
    this.propinaError = '';
    this.cdr.markForCheck();

    this.notaPedidoService.registrarPropina({
      tipNp: nota.tipNp,
      serieNp: nota.serieNp,
      numNp: nota.numNp,
      precio: Number(monto.toFixed(2)),
      moneda: this.monedaPuntoVenta,
      nCuenta: Number(this.cuentaFiltroActual || 0)
    }).subscribe({
      next: () => {
        const { tipNp, serieNp, numNp, fecha } = nota;
        this.isPropinaSaving = false;
        this.showPropinaModal = false;
        this.propinaMonto = null;
        sessionStorage.removeItem('restaurantLastNotaPedido');
        this.cdr.markForCheck();

        void Swal.fire({
          title: 'Propina cargada',
          text: `La propina fue registrada en ${this.monedaPuntoVenta}.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          customClass: {
            popup: 'next-confirm-modal'
          }
        });
        this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
      },
      error: (error) => {
        console.error('No se pudo registrar la propina.', error);
        this.isPropinaSaving = false;
        this.propinaError = 'No se pudo registrar la propina. Revise la conexión e intente nuevamente.';
        this.cdr.markForCheck();
      }
    });
  }

  onAccionClick(accion: AccionOperativa): void {
    if (accion.sinPermiso) {
      return;
    }
    if (accion.id === 'imprimir-cuenta') {
      void this.imprimirCuenta();
      return;
    }
    if (accion.id === 'reimprimir-comanda') {
      void this.reimprimirComanda();
      return;
    }
    if (accion.id === 'facturar-mesa') {
      this.abrirModalFacturacion();
      return;
    }
    if (accion.id === 'cargo-colaborador') {
      this.abrirModalCargoColaborador();
      return;
    }
    if (accion.id === 'cargo-habitacion') {
      this.abrirModalCargoHabitacion();
      return;
    }
    if (accion.id === 'regresar-principal') {
      this.regresarAPrincipal();
    }
  }

  isAccionDisabled(accion: AccionOperativa): boolean {
    if (accion.sinPermiso) {
      return true;
    }
    if (accion.id === 'imprimir-cuenta') {
      return this.isPrintingAccount || this.tipoCambioLoading || this.notaPedidoLoading || !this.notaPedidoDetalleValido;
    }
    if (accion.id === 'reimprimir-comanda') {
      return this.isReprintingCommand || this.notaPedidoLoading || !this.notaPedidoDetalleValido;
    }
    return accion.id === 'regresar-principal' && this.isReturningToMain;
  }

  async imprimirCuenta(): Promise<void> {
    if (this.isPrintingAccount) {
      return;
    }

    const nota = this.notaPedidoInfo;
    const orderDetail = this.currentOrderDetail;
    if (!nota || !this.notaPedidoDetalleValido || !orderDetail?.detalles?.length) {
      await Swal.fire({
        title: 'Sin consumo para imprimir',
        text: 'Debe existir una nota de pedido con consumos cargados antes de imprimir la pre-cuenta.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    const moneda = this.monedaPuntoVenta;
    if (this.requiresPrecheckCurrencyConversion(moneda) && !this.hasValidPrecheckExchangeRate(moneda)) {
      await Swal.fire({
        title: 'Tipo de cambio no disponible',
        text: 'No es posible imprimir la cuenta con una conversión confiable. Actualice el tipo de cambio e intente nuevamente.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    this.isPrintingAccount = true;
    this.cdr.markForCheck();

    try {
      const empresa = this.empresaContext.getSnapshot();
      const commands = this.precheckPrintBuilder.build({
        empresa: {
          nombre: (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'RESTAURANTE').trim(),
          ruc: empresa?.MA04_Ruc,
          direccion: empresa?.MA04_Direccion,
          telefono: empresa?.MA04_Telefono1
        },
        puntoVenta: this.selectedTableContext?.puntoVenta.descripcion || this.codPuntoVenta,
        salon: this.mesaDetalle.salon,
        mesa: this.mesaDetalle.numeroMesa,
        mesero: this.mesaDetalle.mesero,
        cliente: this.mesaDetalle.cliente,
        habitacion: this.mesaDetalle.habitacion,
        personas: this.selectedTableContext?.mesa.personas,
        nota: {
          tipo: nota.tipNp,
          serie: nota.serieNp,
          numero: nota.numNp,
          fecha: nota.fecha,
          hora: nota.hora
        },
        cuenta: this.cuentaFiltroActual,
        moneda,
        tipoCambio: this.tipoCambio
          ? {
              monedaBase: this.tipoCambio.monedaBase || 'COL',
              monedaReferencia: this.tipoCambio.monedaReferencia || 'USD',
              compra: Number(this.tipoCambio.compra || 0),
              venta: Number(this.tipoCambio.venta || 0)
            }
          : undefined,
        detalles: orderDetail.detalles,
        totales: orderDetail.totales,
        totalPropina: orderDetail.totalPropina,
        impresoPor: this.getOperador(),
        fechaImpresion: new Date()
      });

      await this.qzPrintService.printRaw(commands);
      await Swal.fire({
        title: 'Pre-cuenta impresa',
        text: this.cuentaFiltroActual > 0
          ? `La cuenta ${this.cuentaFiltroActual} fue enviada a la impresora TIQUETE.`
          : 'La pre-cuenta fue enviada a la impresora TIQUETE.',
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
    } catch (error) {
      console.error('No se pudo imprimir la pre-cuenta del restaurante.', error);
      await Swal.fire({
        title: 'No se pudo imprimir',
        text: error instanceof Error && error.message
          ? error.message
          : 'Verifique que QZ Tray esté abierto y que la impresora TIQUETE esté instalada.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
    } finally {
      this.isPrintingAccount = false;
      this.cdr.markForCheck();
    }
  }

  async reimprimirComanda(): Promise<void> {
    if (this.isReprintingCommand) {
      return;
    }

    const nota = this.notaPedidoInfo;
    const orderDetail = this.currentOrderDetail;
    if (!nota || !this.notaPedidoDetalleValido || !orderDetail?.detalles?.length) {
      await Swal.fire({
        title: 'Sin comanda para reimprimir',
        text: 'Debe existir una nota de pedido con consumos cargados.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Reimprimir comanda',
      text: 'Se generará una copia de la comanda para cocina y/o bar. ¿Desea continuar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reimprimir',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        popup: 'next-confirm-modal'
      }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.isReprintingCommand = true;
    this.cdr.markForCheck();

    try {
      const result = await this.commandPrintService.reprint({
        documento: {
          TIPO: nota.tipNp,
          SERIE: nota.serieNp,
          NUMERODOC: nota.numNp
        },
        pntVta: this.codPuntoVenta,
        codArea: this.codAreaOperativa,
        numMesa: this.mesaDetalle.numeroMesa,
        fecha: this.normalizeDateDDMMYYYY(nota.fecha),
        hora: nota.hora,
        exonerado: 0,
        salon: this.mesaDetalle.salon,
        mesero: this.mesaDetalle.mesero || this.codMozo,
        personas: this.selectedTableContext?.mesa.personas || this.mesaDetalle.personas,
        gruposActuales: orderDetail.detalles.map((detalle) => detalle.ppV08_Grupo || '')
      });

      await this.showCommandReprintResult(result);
    } catch (error) {
      console.error('No se pudo reimprimir la comanda del restaurante.', error);
      await Swal.fire({
        title: 'No se pudo reimprimir',
        text: error instanceof Error && error.message
          ? error.message
          : 'Verifique la conexión, QZ Tray y las impresoras COCINA y BAR.',
        icon: 'error',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
    } finally {
      this.isReprintingCommand = false;
      this.cdr.markForCheck();
    }
  }

  private async showCommandReprintResult(result: RestaurantCommandDispatchResult): Promise<void> {
    if (result.impresorasFaltantes.length) {
      const missing = result.impresorasFaltantes
        .map((failure) => `${failure.destino} (${failure.impresora})`)
        .join(', ');
      await Swal.fire({
        title: 'No se consultó la reimpresión',
        text: `Faltan las siguientes impresoras: ${missing}.`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    if (result.errorConsulta) {
      await Swal.fire({
        title: 'No se pudo obtener la comanda',
        text: result.errorConsulta,
        icon: 'error',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    if (result.erroresImpresion.length) {
      const failed = result.erroresImpresion
        .map((failure) => `${failure.destino} (${failure.impresora})`)
        .join(', ');
      const printed = result.impresos.length
        ? ` Se imprimió correctamente en ${result.impresos.join(' y ')}.`
        : '';
      await Swal.fire({
        title: 'Reimpresión incompleta',
        text: `Falló la impresión en ${failed}.${printed}`,
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    if (!result.impresos.length) {
      await Swal.fire({
        title: 'Sin detalle para reimprimir',
        text: 'El proceso 111 no devolvió productos de cocina ni de bar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    await Swal.fire({
      title: 'Comanda reimpresa',
      text: `Copias enviadas a ${result.impresos.join(' y ')}.`,
      icon: 'success',
      timer: 1800,
      showConfirmButton: false,
      customClass: {
        popup: 'next-confirm-modal'
      }
    });
  }

  regresarAPrincipal(): void {
    if (this.isReturningToMain) {
      return;
    }

    const nota = this.notaPedidoInfo;
    if (!nota) {
      void this.router.navigate(['/restaurant/dashboard', this.codPuntoVenta]);
      return;
    }

    this.isReturningToMain = true;
    this.cdr.markForCheck();
    this.notaPedidoService
      .obtenerDetallePedido({
        tipNp: nota.tipNp,
        serieNp: nota.serieNp,
        numNp: nota.numNp,
        pntVta: this.codPuntoVenta,
        fecha: this.normalizeDateDDMMYYYY(nota.fecha),
        exonerado: 0
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if ((response.detalles ?? []).length > 0) {
            this.isReturningToMain = false;
            this.cdr.markForCheck();
            void this.router.navigate(['/restaurant/dashboard', this.codPuntoVenta]);
            return;
          }

          this.finalizarNotaPedidoVacia(nota);
        },
        error: (error) => {
          console.error('No se pudo validar el detalle antes de regresar.', error);
          this.mostrarErrorRegreso('No se pudo verificar si la nota tiene consumos pendientes.');
        }
      });
  }

  abrirModalCargoColaborador(): void {
    if (!this.notaPedidoInfo || !this.consumoActual.length) {
      void Swal.fire({
        title: 'Sin consumo para cargar',
        text: 'Debe existir una nota de pedido con consumos para registrar el cargo a un colaborador.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    const detallePuntoVenta = this.selectedTableContext?.puntoVenta.detalle;
    this.collaboratorChargeDialogData = {
      puntoVenta: this.codPuntoVenta,
      vendedor: this.codMozo,
      total: Number(this.total || 0),
      moneda: this.monedaActual || detallePuntoVenta?.MPV04_Moneda || 'USD',
      tipoCambio: 1,
      listaPrecio: detallePuntoVenta?.MPV10_CodLstPrecio || '',
      tipNP: this.notaPedidoInfo.tipNp,
      serieNP: this.notaPedidoInfo.serieNp,
      numNP: this.notaPedidoInfo.numNp,
      numCuenta: Number(this.cuentaFiltroActual || 0),
      operador: this.getOperador()
    };
    this.showCollaboratorChargeDialog = true;
    this.cdr.markForCheck();
  }

  onCollaboratorChargeDialogClosed(result: RestaurantCollaboratorChargeDialogResult | null): void {
    this.showCollaboratorChargeDialog = false;
    this.collaboratorChargeDialogData = null;
    if (result?.guardado) {
      this.reconciliarMesaTrasProceso();
    }
    this.cdr.markForCheck();
  }

  abrirModalCargoHabitacion(): void {
    if (!this.notaPedidoInfo || !this.consumoActual.length) {
      void Swal.fire({
        title: 'Sin consumo para cargar',
        text: 'Debe existir una nota de pedido con consumos para registrar cargo a habitacion.',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
        customClass: {
          popup: 'next-confirm-modal'
        }
      });
      return;
    }

    this.roomChargeDialogData = {
      puntoVenta: this.codPuntoVenta,
      total: Number(this.total || 0),
      moneda: this.monedaActual || 'USD',
      tipNP: this.notaPedidoInfo.tipNp,
      serieNP: this.notaPedidoInfo.serieNp,
      numNP: this.notaPedidoInfo.numNp,
      numCuenta: Number(this.cuentaFiltroActual || 0),
      operador: this.getOperador()
    };
    this.showRoomChargeDialog = true;
    this.cdr.markForCheck();
  }

  onRoomChargeDialogClosed(result: RestaurantRoomChargeDialogResult | null): void {
    console.log('[RestaurantMesaDetalle] Cargo habitación - resultado del modal', result);
    console.log(
      '[RestaurantMesaDetalle] POST /cargo-habitacion-restaurante response',
      result?.respuesta ?? null
    );

    this.showRoomChargeDialog = false;
    this.roomChargeDialogData = null;
    if (result?.guardado) {
      this.mesaDetalle.habitacion = result.habitacion.numHabita;
      this.mesaDetalle.cliente = result.habitacion.nomPax || this.mesaDetalle.cliente;
      this.reconciliarMesaTrasProceso();
    }
    this.cdr.markForCheck();
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

  recargarNotaPedido(): void {
    if (this.notaPedidoInfo) {
      this.consultarDetallePedido(
        this.notaPedidoInfo.tipNp,
        this.notaPedidoInfo.serieNp,
        this.notaPedidoInfo.numNp,
        this.notaPedidoInfo.fecha,
        this.cuentaFiltroActual
      );
      return;
    }

    this.cargarNotaPedidoActual();
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
    const moneda = this.monedaActual || this.selectedTableContext?.puntoVenta?.detalle?.MPV04_Moneda || 'USD';
    this.invoiceDialogData = {
      mesa          : this.mesaDetalle.numeroMesa || String(this.mesaId),
      salon         : this.mesaDetalle.salon || 'Salón Principal',
      pax           : Number(this.mesaDetalle.personas || 4),
      puntoVenta    : this.codPuntoVenta || 'PL',
      codArea       : this.codAreaOperativa || '08',
      codMozo       : this.codMozo || 'FFUENTES',
      moneda        ,
      tipoCambio    : 1,
      tipoCambioCompra: Number(this.tipoCambio?.compra || 0),
      tipoCambioVenta : Number(this.tipoCambio?.venta || 0),
      monedaBaseTipoCambio       : this.tipoCambio?.monedaBase || 'COL',
      monedaReferenciaTipoCambio : this.tipoCambio?.monedaReferencia || 'USD',
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
      this.reconciliarMesaTrasProceso();
    }
    this.cdr.markForCheck();
  }

  private readSelectedTableContext(): SelectedRestaurantTableContext | null {
    return this.operationContext.getSelectedTableContext();
  }

  private cargarTipoCambio(): void {
    this.tipoCambioLoading = true;
    this.tipoCambioError = '';

    this.tipoCambioService
      .fetchTipoCambio(this.formatDate(new Date()), 'usd')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.tipoCambio = items[0] ?? this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.tipoCambio = this.tipoCambioService.getActual() ?? null;
          this.tipoCambioLoading = false;
          this.tipoCambioError = 'Referencia no actualizada';
          this.cdr.markForCheck();
        }
      });
  }

  private requiresPrecheckCurrencyConversion(currency: string): boolean {
    const normalized = this.normalizeCurrency(currency);
    return this.isCostaRicanColon(normalized) || normalized === 'USD';
  }

  private hasValidPrecheckExchangeRate(currency: string): boolean {
    if (!this.tipoCambio) {
      return false;
    }

    const source = this.normalizeCurrency(currency);
    const base = this.normalizeCurrency(this.tipoCambio.monedaBase || 'COL');
    const reference = this.normalizeCurrency(this.tipoCambio.monedaReferencia || 'USD');

    if (this.sameCurrency(source, base)) {
      return Number(this.tipoCambio.compra) > 0;
    }
    if (this.sameCurrency(source, reference)) {
      return Number(this.tipoCambio.venta) > 0;
    }
    return false;
  }

  private normalizeCurrency(value: string | null | undefined): string {
    return (value || '').trim().toUpperCase();
  }

  private sameCurrency(first: string, second: string): boolean {
    return first === second || (this.isCostaRicanColon(first) && this.isCostaRicanColon(second));
  }

  private isCostaRicanColon(currency: string): boolean {
    return currency === 'COL' || currency === 'CRC';
  }

  private cargarNotaPedidoActual(): void {
    this.notaPedidoDetalleValido = false;
    this.notaPedidoError = '';
    const tipNp = this.cleanValue(this.route.snapshot.queryParamMap.get('tipNp'));
    const serieNp = this.cleanValue(this.route.snapshot.queryParamMap.get('serieNp'));
    const numNp = this.cleanValue(this.route.snapshot.queryParamMap.get('numNp'));
    const fecha = this.normalizeDateDDMMYYYY(this.route.snapshot.queryParamMap.get('fecha'));
    const hora = this.cleanValue(this.route.snapshot.queryParamMap.get('hora'));

    if (tipNp && serieNp && numNp && fecha) {
      this.notaPedidoInfo = { tipNp, serieNp, numNp, fecha, hora, respuesta: 'Pendiente' };
      this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
      return;
    }

    const contextNotaPedido = this.selectedTableContext?.mesa.notaPedido;
    if (contextNotaPedido?.tipNp && contextNotaPedido.serieNp && contextNotaPedido.numNp && contextNotaPedido.fecha) {
      this.notaPedidoInfo = {
        tipNp: contextNotaPedido.tipNp,
        serieNp: contextNotaPedido.serieNp,
        numNp: contextNotaPedido.numNp,
        fecha: this.normalizeDateDDMMYYYY(contextNotaPedido.fecha),
        hora: contextNotaPedido.hora || hora,
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

    const state = this.readNotaPedidoMesaState();
    if (state && this.isNotaPedidoDeMesaActual(state)) {
      this.notaPedidoInfo = {
        tipNp: state.tipNp,
        serieNp: state.serieNp,
        numNp: state.numNp,
        fecha: this.normalizeDateDDMMYYYY(state.fecha),
        hora: state.hora || hora,
        respuesta: state.detalleResponse?.respuesta || 'Pendiente'
      };
      this.consultarDetallePedido(
        state.tipNp,
        state.serieNp,
        state.numNp,
        this.normalizeDateDDMMYYYY(state.fecha),
        this.cuentaFiltroActual
      );
      return;
    }

    if (this.selectedTableContext?.mesa.estado === 'OCUPADA' || tipNp || serieNp || numNp || fecha) {
      this.recuperarNotaPedidoDesdeMesa();
      return;
    }

    this.limpiarNotaPedidoEnPantalla();
  }

  private recuperarNotaPedidoDesdeMesa(): void {
    if (!this.codPuntoVenta || !this.codAreaOperativa) {
      this.establecerErrorNotaPedido('No se pudo identificar el punto de venta y el salon de la mesa ocupada.');
      return;
    }

    const requestId = ++this.detalleRequestId;
    this.notaPedidoLoading = true;
    this.notaPedidoError = '';
    this.cdr.markForCheck();

    this.dashboardService
      .obtenerMesasPorUbicacion(this.codPuntoVenta, this.codAreaOperativa)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mesas) => {
          if (requestId !== this.detalleRequestId) {
            return;
          }

          const mesa = mesas.find((item) => Number(item.cpV05_NumMesa || 0) === this.mesaId);
          const tipNp = this.cleanValue(mesa?.ppV07_TipNDP);
          const serieNp = this.cleanValue(mesa?.ppV07_SerieNDP);
          const numNp = this.cleanValue(mesa?.ppV07_NumNDP);
          const fecha = this.normalizeDateDDMMYYYY(mesa?.ppV07_FecDocu);
          const hora = this.cleanValue(mesa?.ppV07_HorDocu);

          if (!mesa || !tipNp || !serieNp || !numNp || !fecha) {
            this.establecerErrorNotaPedido(
              mesa?.ocupada
                ? 'La mesa figura ocupada, pero el servidor no devolvio la referencia completa de su nota de pedido.'
                : 'No se encontro una nota de pedido activa para esta mesa.'
            );
            return;
          }

          this.notaPedidoInfo = { tipNp, serieNp, numNp, fecha, hora, respuesta: 'Pendiente' };
          this.actualizarReferenciaNotaEnUrl(this.notaPedidoInfo);
          this.consultarDetallePedido(tipNp, serieNp, numNp, fecha, this.cuentaFiltroActual);
        },
        error: (error) => {
          if (requestId !== this.detalleRequestId) {
            return;
          }
          console.error('No se pudo recuperar la nota asociada a la mesa.', error);
          this.establecerErrorNotaPedido('No se pudo consultar la nota asociada a la mesa. Revise la conexion con el servidor.');
        }
      });
  }

  private actualizarReferenciaNotaEnUrl(nota: NotaPedidoMesaInfo): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tipNp: nota.tipNp,
        serieNp: nota.serieNp,
        numNp: nota.numNp,
        fecha: nota.fecha,
        hora: nota.hora || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private establecerErrorNotaPedido(message: string): void {
    this.notaPedidoLoading = false;
    this.notaPedidoDetalleValido = false;
    this.currentOrderDetail = null;
    this.notaPedidoError = message;
    this.consumoActual = [];
    this.subtotal = 0;
    this.impuestos = 0;
    this.propina = 0;
    this.total = 0;
    this.cdr.markForCheck();
  }

  private iniciarRelojMesa(): void {
    timer(0, 30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.actualizarTiempoTranscurrido());
  }

  private actualizarTiempoTranscurrido(): void {
    const apertura = this.getFechaHoraApertura();
    if (!apertura) {
      this.mesaDetalle.tiempoOcupada = '-';
      this.cdr.markForCheck();
      return;
    }

    const elapsedMilliseconds = Math.max(Date.now() - apertura.getTime(), 0);
    const totalMinutes = Math.floor(elapsedMilliseconds / 60_000);
    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor((totalMinutes % 1_440) / 60);
    const minutes = totalMinutes % 60;
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} h`;

    this.mesaDetalle.tiempoOcupada = days > 0 ? `${days} d ${time}` : time;
    this.cdr.markForCheck();
  }

  private getFechaHoraApertura(): Date | null {
    const fecha = this.normalizeDateDDMMYYYY(this.notaPedidoInfo?.fecha);
    const hora = (this.notaPedidoInfo?.hora || '').trim();
    const dateMatch = fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const timeMatch = hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);

    if (!dateMatch || !timeMatch) {
      return null;
    }

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const seconds = Number(timeMatch[3] || 0);
    const period = (timeMatch[4] || '').toUpperCase();

    if (period === 'PM' && hours < 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    if (hours > 23 || minutes > 59 || seconds > 59) {
      return null;
    }

    const opening = new Date(
      Number(dateMatch[3]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[1]),
      hours,
      minutes,
      seconds
    );

    return Number.isNaN(opening.getTime()) ? null : opening;
  }

  private consultarDetallePedido(tipNp: string, serieNp: string, numNp: string, fecha: string, cuentaFiltro = this.cuentaFiltroActual): void {
    const requestId = ++this.detalleRequestId;
    this.notaPedidoDetalleValido = false;
    this.notaPedidoLoading = true;
    this.notaPedidoError = '';
    const normalizedFecha = this.normalizeDateDDMMYYYY(fecha);
    this.cuentaFiltroActual = Number(cuentaFiltro || 0);
    this.cdr.markForCheck();
    this.notaPedidoService
      .obtenerDetallePedido({
        tipNp,
        serieNp,
        numNp,
        pntVta: this.codPuntoVenta,
        fecha: normalizedFecha,
        exonerado: this.cuentaFiltroActual
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.detalleRequestId) {
            return;
          }
          this.notaPedidoLoading = false;
          this.notaPedidoInfo = {
            tipNp,
            serieNp,
            numNp,
            fecha: normalizedFecha,
            hora: this.notaPedidoInfo?.hora || '',
            respuesta: response.respuesta || 'OK'
          };
          this.aplicarDetallePedido(response);
        },
        error: (error) => {
          if (requestId !== this.detalleRequestId) {
            return;
          }
          console.error('No se pudo cargar el detalle de la nota de pedido.', error);
          this.eliminandoItems.clear();
          this.cambiandoCuentaItems.clear();
          this.dividiendoItems.clear();
          this.establecerErrorNotaPedido('No se pudo cargar el consumo de la nota. Revise la conexion con el servidor e intente nuevamente.');
        }
      });
  }

  private reconciliarMesaTrasProceso(): void {
    const notaProcesada = this.notaPedidoInfo;
    sessionStorage.removeItem('restaurantLastNotaPedido');

    if (!notaProcesada) {
      this.finalizarMesaProcesada();
      return;
    }

    this.notaPedidoService
      .obtenerDetallePedido({
        tipNp: notaProcesada.tipNp,
        serieNp: notaProcesada.serieNp,
        numNp: notaProcesada.numNp,
        pntVta: this.codPuntoVenta,
        fecha: this.normalizeDateDDMMYYYY(notaProcesada.fecha),
        exonerado: 0
      })
      .subscribe({
        next: (response) => {
          const detallesPendientes = response.detalles ?? [];
          if (!detallesPendientes.length) {
            this.finalizarMesaProcesada();
            this.cdr.markForCheck();
            return;
          }

          this.cuentaFiltroActual = 0;
          this.notaPedidoInfo = {
            ...notaProcesada,
            respuesta: response.respuesta || notaProcesada.respuesta
          };
          this.aplicarDetallePedido(response);
        },
        error: (error) => {
          console.error('No se pudo verificar si quedaron cargos pendientes en la nota.', error);
          void Swal.fire({
            title: 'Cargo procesado',
            text: 'El cargo fue registrado, pero no se pudo actualizar el detalle pendiente de la mesa. Intente recargar la información.',
            icon: 'warning',
            confirmButtonText: 'Aceptar',
            customClass: {
              popup: 'next-confirm-modal'
            }
          });
          this.cdr.markForCheck();
        }
      });
  }

  private finalizarNotaPedidoVacia(nota: NotaPedidoMesaInfo): void {
    this.notaPedidoService
      .verificarFinalizarNotaPedido({
        tipNp: nota.tipNp,
        serieNp: nota.serieNp,
        numNp: nota.numNp,
        numMesa: this.mesaDetalle.numeroMesa || String(this.mesaId),
        pntVta: this.codPuntoVenta,
        codArea: this.codAreaOperativa
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          sessionStorage.removeItem('restaurantLastNotaPedido');
          this.limpiarSelectedTableContextActual();
          this.limpiarNotaPedidoEnPantalla(true);
          this.isReturningToMain = false;
          this.cdr.markForCheck();
          void this.router.navigate(['/restaurant/dashboard', this.codPuntoVenta]);
        },
        error: (error) => {
          console.error('No se pudo finalizar la nota de pedido vacía.', error);
          this.mostrarErrorRegreso('La nota está vacía, pero no se pudo cerrar. Intente nuevamente.');
        }
      });
  }

  private mostrarErrorRegreso(message: string): void {
    this.isReturningToMain = false;
    this.cdr.markForCheck();
    void Swal.fire({
      title: 'No se puede regresar',
      text: message,
      icon: 'error',
      confirmButtonText: 'Aceptar',
      customClass: {
        popup: 'next-confirm-modal'
      }
    });
  }

  private finalizarMesaProcesada(): void {
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
    this.detalleRequestId += 1;
    this.notaPedidoInfo = null;
    this.notaPedidoDetalleValido = false;
    this.currentOrderDetail = null;
    this.notaPedidoLoading = false;
    this.notaPedidoError = '';
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
      this.operationContext.clearSelectedTableContext();
    }
  }

  private aplicarDetallePedido(response: NotaPedidoRestauranteProceso91Response): void {
    this.notaPedidoDetalleValido = true;
    this.currentOrderDetail = response;
    this.eliminandoItems.clear();
    this.cambiandoCuentaItems.clear();
    this.dividiendoItems.clear();
    this.consumoActual = (response.detalles || []).map((detalle) => {
      const cantidad = Number(detalle.ppV08_Cantidad || 0);
      const precio = Number(detalle.ppV08_UniConImp || 0);
      return {
        id          : detalle.ppV08_ID,
        codigo      : detalle.ppV08_CodProducto,
        producto    : (detalle.ppV08_NomProducto || '').trim(),
        cantidad    ,
        precio      ,
        subtotal    : Number(detalle.ppV08_Precio || 0),
        moneda      : detalle.ppV08_Moneda || 'USD',
        orden       : detalle.ppV08_Orden,
        cuenta      : detalle.ppV08_NCuenta || ''
      };
    });

    const firstCurrency = this.consumoActual[0]?.moneda;
    this.monedaActual = firstCurrency || this.monedaActual;
    this.subtotal = Number(response.totales?.subtotalneto || 0);
    this.descuento = (response.detalles || []).reduce(
      (total, detalle) => total + Number(detalle.ppV08_Descuento || 0),
      0
    );
    this.impuestos = Number(response.totales?.impuestos || 0);
    this.propina = Number(response.totalPropina || 0);
    const totalConsumo = Number(response.totales?.total || 0);
    this.total = totalConsumo + this.propina;
    if (this.notaPedidoInfo) {
      this.notaPedidoInfo = {
        ...this.notaPedidoInfo,
        respuesta: response.respuesta || this.notaPedidoInfo.respuesta
      };
      this.persistirNotaPedidoMesaState(response);
    }
    this.actualizarTiempoTranscurrido();
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
      hora              : this.notaPedidoInfo.hora || '',
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

  private cleanValue(value: unknown): string {
    return (value ?? '').toString().trim();
  }

  private formatDate(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private normalizeDateDDMMYYYY(value: unknown): string {
    return normalizeRestaurantDateDDMMYYYY(value);
  }
}
