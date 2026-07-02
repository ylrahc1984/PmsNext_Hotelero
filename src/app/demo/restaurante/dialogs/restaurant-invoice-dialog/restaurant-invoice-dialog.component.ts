import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { ToastService } from 'src/app/core/services/toast.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import {
  FormaPagoPuntoVenta,
  RestaurantPaymentMethodService
} from '../../services/restaurant-payment-method.service';
import {
  FacturacionPuntoVentaRequest,
  RestaurantInvoiceService
} from '../../services/restaurant-invoice.service';

export interface RestaurantInvoiceDialogData {
  mesa            : string;
  salon           : string;
  pax             : number;
  puntoVenta      : string;
  codArea         : string;
  codMozo         : string;
  moneda          : string;
  tipoCambio      : number;
  subtotal        : number;
  impuesto        : number;
  total           : number;
  propina         : number;
  tipNdp          : string;
  numeroNdp       : string;
  operador        : string;
}

export interface FormaPagoAplicada {
  frmPago       : string;
  descripcion   : string;
  tipo          : string;
  numTarjeta    : string;
  moneda        : string;
  monto         : number;
  vencimiento   : string;
  mtoTotal      : number;
  tCambio       : number;
  orden         : number;
}

export interface RestaurantInvoiceDialogResult {
  facturado   : boolean;
  respuesta   ?: unknown;
}

interface ConsumidorFinal {
  codigo      : string;
  nombre      : string;
  ruc         : string;
  direccion   : string;
  email       ?: string;
}

@Component({
  selector: 'app-restaurant-invoice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restaurant-invoice-dialog.component.html',
  styleUrls: ['./restaurant-invoice-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantInvoiceDialogComponent implements OnInit {
  private readonly paymentMethodService = inject(RestaurantPaymentMethodService);
  private readonly invoiceService = inject(RestaurantInvoiceService);
  private readonly clienteService = inject(ClienteService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clienteSearch$ = new Subject<string>();

  @Input({ required: true }) data!: RestaurantInvoiceDialogData;
  @Output() closed = new EventEmitter<RestaurantInvoiceDialogResult | null>();

  readonly consumidorFinal: ConsumidorFinal = {
    codigo      : '000000000',
    ruc         : '000000000',
    nombre      : 'CLIENTE EN GENERAL',
    direccion   : 'S/D',
    email       : ''
  };

  formasPago                : FormaPagoPuntoVenta[] = [];
  pagosAplicados            : FormaPagoAplicada[] = [];
  clienteSearch             = '';
  clientes                  : ClienteUI[] = [];
  clienteSeleccionado       : ClienteUI | null = null;
  formaPagoSeleccionada     = '';
  montoPago                 : number | null = null;
  referenciaPago            = '';
  loadingFormasPago         = false;
  errorFormasPago           = '';
  buscandoClientes          = false;
  errorClientes             = '';
  loadingFacturacion        = false;
  validationMessage         = '';

  ngOnInit(): void {
    this.cargarFormasPago();
    this.setupClienteSearch();
  }

  get totalCuenta(): number {
    return this.round(Number(this.data?.total || 0));
  }

  get totalPagado(): number {
    return this.round(this.pagosAplicados.reduce((sum, pago) => sum + Number(pago.monto || 0), 0));
  }

  get pendiente(): number {
    return this.round(Math.max(this.totalCuenta - this.totalPagado, 0));
  }

  get cambio(): number {
    return this.round(Math.max(this.totalPagado - this.totalCuenta, 0));
  }

  get puedeConfirmar(): boolean {
    return this.pagosAplicados.length > 0 && this.totalPagado >= this.totalCuenta && !this.loadingFacturacion;
  }

  get clienteFacturacion(): ClienteUI | ConsumidorFinal {
    return this.clienteSeleccionado || this.consumidorFinal;
  }

  onBuscarCliente(value: string): void {
    this.clienteSearch = value;
    this.errorClientes = '';
    this.clienteSearch$.next(value);
  }

  seleccionarCliente(cliente: ClienteUI): void {
    this.clienteSeleccionado = cliente;
    this.clienteSearch = cliente.nombre;
    this.clientes = [];
    this.errorClientes = '';
  }

  limpiarCliente(): void {
    this.clienteSeleccionado = null;
    this.clienteSearch = '';
    this.clientes = [];
    this.errorClientes = '';
  }

  agregarPago(): void {
    this.validationMessage = '';
    const formaPago = this.formasPago.find((item) => item.CA05_Codigo === this.formaPagoSeleccionada);
    const monto = this.round(Number(this.montoPago || 0));

    if (!formaPago) {
      this.validationMessage = 'Selecciona una forma de pago.';
      return;
    }
    if (monto <= 0) {
      this.validationMessage = 'El monto debe ser mayor a 0.';
      return;
    }
    if (monto > this.pendiente && !this.esEfectivo(formaPago)) {
      this.validationMessage = 'El monto no puede ser mayor al pendiente para esta forma de pago.';
      return;
    }

    this.pagosAplicados = [
      ...this.pagosAplicados,
      {
        frmPago       : formaPago.CA05_Codigo,
        descripcion   : formaPago.CA05_Descripcion,
        tipo          : formaPago.CA05_TipPago,
        numTarjeta    : (this.referenciaPago || '').trim(),
        moneda        : this.data.moneda,
        monto         ,
        vencimiento   : '',
        mtoTotal      : monto,
        tCambio       : Number(this.data.tipoCambio || 1),
        orden         : this.pagosAplicados.length + 1
      }
    ];
    this.montoPago = this.pendiente > 0 ? this.pendiente : null;
    this.referenciaPago = '';
  }

  eliminarPago(index: number): void {
    this.pagosAplicados = this.pagosAplicados
      .filter((_, currentIndex) => currentIndex !== index)
      .map((pago, currentIndex) => ({ ...pago, orden: currentIndex + 1 }));
  }

  verDetalleConsumos(): void {
    console.log('Ver detalle de consumos', this.data);
  }

  confirmarFacturacion(): void {
    if (!this.puedeConfirmar) {
      this.validationMessage = this.pagosAplicados.length === 0
        ? 'Agrega al menos una forma de pago.'
        : 'El total pagado debe cubrir el total de la cuenta.';
      return;
    }

    this.loadingFacturacion = true;
    this.validationMessage = '';
    const request = this.buildFacturacionRequest();
    console.log('[RestaurantInvoiceDialog] POST /facturacion/venta-pntvta-web payload', request);

    this.invoiceService
      .facturarPuntoVenta(request)
      .pipe(
        finalize(() => {
          this.loadingFacturacion = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (respuesta) => {
          this.toast.success('Factura generada correctamente.');
          this.closed.emit({ facturado: true, respuesta });
        },
        error: (error) => {
          console.error('Error al facturar mesa:', error);
          this.validationMessage = 'No se pudo completar la facturacion.';
          this.toast.error('No se pudo completar la facturacion.');
        }
      });
  }

  cerrar(): void {
    if (this.loadingFacturacion) {
      return;
    }
    this.closed.emit(null);
  }

  trackByCodigo(_: number, item: FormaPagoPuntoVenta | ClienteUI): string {
    return 'CA05_Codigo' in item ? item.CA05_Codigo : item.codigo;
  }

  trackByPago(_: number, item: FormaPagoAplicada): number {
    return item.orden;
  }

  private cargarFormasPago(): void {
    this.loadingFormasPago = true;
    this.errorFormasPago = '';
    this.paymentMethodService
      .obtenerFormasPagoPorPuntoVenta(this.data.puntoVenta)
      .pipe(
        finalize(() => {
          this.loadingFormasPago = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.formasPago = items || [];
          this.formaPagoSeleccionada = this.formasPago[0]?.CA05_Codigo || '';
          this.montoPago = this.totalCuenta;
        },
        error: (error) => {
          console.error('Error al cargar formas de pago:', error);
          this.formasPago = [];
          this.errorFormasPago = 'No se pudieron cargar las formas de pago.';
        }
      });
  }

  private setupClienteSearch(): void {
    this.clienteSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const normalized = (query || '').trim();
          if (normalized.length < 2) {
            this.clientes = [];
            this.buscandoClientes = false;
            this.cdr.markForCheck();
            return of([]);
          }
          this.buscandoClientes = true;
          this.cdr.markForCheck();
          return this.clienteService.getClientes(1, 8, normalized).pipe(
            catchError((error) => {
              console.error('Error al buscar clientes:', error);
              this.errorClientes = 'No se pudieron cargar los clientes.';
              return of({ data: [] });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.clientes = Array.isArray(result) ? result : result.data;
        this.buscandoClientes = false;
        this.cdr.markForCheck();
      });
  }

  private buildFacturacionRequest(): FacturacionPuntoVentaRequest {
    const now = new Date();
    const fecha = this.formatDateDDMMYYYY(now);
    const hora = this.formatTimeHHMM(now);
    const cliente = this.clienteFacturacion;
    const primeraFormaPago = this.pagosAplicados[0];

    return {
      proceso         : 1,
      nomTabla        : '',
      nomTabImpu      : '',
      nomTabFrmp      : '',
      numInterno      : '',
      tipDocu         : 'TRR',
      serieDocu       : '',
      numDocu         : 'GENERA',
      tipNdp          : this.data.tipNdp || '',
      numeroNdp       : this.data.numeroNdp || '',
      tipo            : primeraFormaPago?.frmPago ? 'CONTADO' : '',
      codReserva      : '',
      habita          : '',
      master          : '',
      fechaDocu       : fecha,
      horaDonp        : hora,
      codCliente      : cliente.codigo || '',
      rucClie         : cliente.ruc || '0000000000',
      nomClie         : cliente.nombre || 'CLIENTE EN GENERAL',
      direccion       : cliente.direccion || 'S/D',
      pntVenta        : this.data.puntoVenta,
      codVendedor     : this.data.codMozo,
      subtotal        : Number(this.data.subtotal || 0),
      descuento       : 0,
      neto            : Number(this.data.subtotal || 0),
      impuesto        : Number(this.data.impuesto || 0),
      exonera         : 0,
      totDocumento    : this.totalCuenta,
      totPago         : this.totalPagado,
      totPropina      : Number(this.data.propina || 0),
      fechaPago       : fecha,
      fechaVen        : fecha,
      estado          : 'PEN',
      moneda          : this.data.moneda,
      tCambio         : Number(this.data.tipoCambio || 1),
      formaPago       : primeraFormaPago?.frmPago || '',
      numCuenta       : 0,
      usuario         : this.data.operador,
      formasPago: this.pagosAplicados.map((pago) => ({
        frmPago       : pago.frmPago,
        tipo          : pago.tipo,
        numTarjeta    : pago.numTarjeta,
        moneda        : pago.moneda,
        monto         : pago.monto,
        vencimiento   : pago.vencimiento,
        mtoTotal      : pago.mtoTotal,
        tCambio       : pago.tCambio,
        orden         : pago.orden
      })),
      respuesta       : ''
    };
  }

  private formatDateDDMMYYYY(date: Date): string {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private formatTimeHHMM(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private esEfectivo(formaPago: FormaPagoPuntoVenta): boolean {
    const text = `${formaPago.CA05_Codigo} ${formaPago.CA05_Descripcion} ${formaPago.CA05_TipPago}`.toUpperCase();
    return text.includes('EFECTIVO') || text.includes('CONTADO') || formaPago.CA05_TipPago?.toUpperCase() === 'CE';
  }

  private round(value: number): number {
    return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  }
}
