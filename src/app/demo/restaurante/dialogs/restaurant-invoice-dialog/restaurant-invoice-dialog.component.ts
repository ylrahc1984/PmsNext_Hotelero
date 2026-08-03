import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { PosDocumentPrintService } from 'src/app/core/printing/pos-document-print.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import {
  FormaPagoPuntoVenta,
  RestaurantPaymentMethodService
} from '../../services/restaurant-payment-method.service';
import {
  DocumentoPuntoVenta,
  FacturacionDocumentoGenerado,
  FacturacionPuntoVentaRequest,
  FacturacionPuntoVentaResponse,
  RestaurantInvoiceService
} from '../../services/restaurant-invoice.service';

export interface RestaurantInvoiceDialogData {
  mesa            : string;
  salon           : string;
  pax             : number;
  puntoVenta      : string;
  puntoVentaNombre?: string;
  codArea         : string;
  codMozo         : string;
  moneda          : string;
  tipoCambio      : number;
  tipoCambioCompra: number;
  tipoCambioVenta : number;
  monedaBaseTipoCambio       : string;
  monedaReferenciaTipoCambio : string;
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
  respuesta   ?: FacturacionPuntoVentaResponse;
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
  private readonly posDocumentPrintService = inject(PosDocumentPrintService);
  private readonly clienteService = inject(ClienteService);
  private readonly monedaService = inject(MonedaService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly clienteSearch$ = new Subject<string>();

  @Input({ required: true }) data!: RestaurantInvoiceDialogData;
  @Output() closed = new EventEmitter<RestaurantInvoiceDialogResult | null>();

  readonly consumidorFinal: ConsumidorFinal = {
    codigo      : '0000000000',
    ruc         : '00000000',
    nombre      : 'CLIENTE EN GENERAL',
    direccion   : 'S/D',
    email       : ''
  };

  formasPago                : FormaPagoPuntoVenta[] = [];
  documentosPuntoVenta      : DocumentoPuntoVenta[] = [];
  tipoDocumentoSeleccionado : DocumentoPuntoVenta | null = null;
  pagosAplicados            : FormaPagoAplicada[] = [];
  monedas                   : MonedaUI[] = [];
  clienteSearch             = '';
  clientes                  : ClienteUI[] = [];
  clienteSeleccionado       : ClienteUI | null = null;
  formaPagoSeleccionada     = '';
  monedaPagoSeleccionada    = '';
  montoPagoTexto            = '';
  referenciaPago            = '';
  loadingFormasPago         = false;
  errorFormasPago           = '';
  loadingMonedas            = false;
  errorMonedas              = '';
  loadingDocumentos         = false;
  errorDocumentos           = '';
  documentoSelectionMessage = '';
  buscandoClientes          = false;
  errorClientes             = '';
  loadingFacturacion        = false;
  validationMessage         = '';

  ngOnInit(): void {
    this.cargarFormasPago();
    this.cargarMonedas();
    this.cargarDocumentosPuntoVenta();
    this.setupClienteSearch();
  }

  get totalCuenta(): number {
    return this.round(Number(this.data?.total || 0));
  }

  get totalPagado(): number {
    return this.round(this.pagosAplicados.reduce((sum, pago) => sum + Number(pago.mtoTotal || 0), 0));
  }

  get pendiente(): number {
    return this.round(Math.max(this.totalCuenta - this.totalPagado, 0));
  }

  get cambio(): number {
    return this.round(Math.max(this.totalPagado - this.totalCuenta, 0));
  }

  get puedeConfirmar(): boolean {
    return this.pagosAplicados.length > 0
      && this.totalPagado >= this.totalCuenta
      && !!this.tipoDocumentoSeleccionado
      && !this.loadingDocumentos
      && !this.loadingFacturacion;
  }

  get clienteFacturacion(): ClienteUI | ConsumidorFinal {
    return this.clienteSeleccionado || this.consumidorFinal;
  }

  get montoPagoActual(): number {
    return this.parseAmount(this.montoPagoTexto);
  }

  get montoPagoConvertido(): number | null {
    const conversion = this.convertirPagoAMonedaDocumento(this.montoPagoActual, this.monedaPagoSeleccionada);
    if (!conversion) {
      return null;
    }

    const formaPago = this.formasPago.find((item) => item.CA05_Codigo === this.formaPagoSeleccionada);
    const exceso = this.round(conversion.equivalente - this.pendiente);
    if (
      formaPago
      && !this.esEfectivo(formaPago)
      && exceso > 0
      && exceso <= this.getConversionRoundingTolerance(this.monedaPagoSeleccionada)
    ) {
      return this.pendiente;
    }
    return conversion.equivalente;
  }

  get pagoRequiereConversion(): boolean {
    return !this.sonMismaMoneda(this.monedaPagoSeleccionada, this.data.moneda);
  }

  get saldoMonedaPago(): number | null {
    return this.convertirSaldoAMonedaPago(this.pendiente, this.monedaPagoSeleccionada);
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
    this.seleccionarTipoDocumento();
  }

  limpiarCliente(): void {
    this.clienteSeleccionado = null;
    this.clienteSearch = '';
    this.clientes = [];
    this.errorClientes = '';
    this.seleccionarTipoDocumento();
  }

  agregarPago(): void {
    this.validationMessage = '';
    const formaPago = this.formasPago.find((item) => item.CA05_Codigo === this.formaPagoSeleccionada);
    const moneda = this.normalizeCurrency(this.monedaPagoSeleccionada);
    const monto = this.round(this.montoPagoActual);
    const conversion = this.convertirPagoAMonedaDocumento(monto, moneda);

    if (!formaPago) {
      this.validationMessage = 'Selecciona una forma de pago.';
      return;
    }
    if (!moneda) {
      this.validationMessage = 'Selecciona la moneda del pago.';
      return;
    }
    if (monto <= 0) {
      this.validationMessage = 'El monto debe ser mayor a 0.';
      return;
    }
    if (!conversion) {
      this.validationMessage = `No hay un tipo de cambio disponible para convertir ${moneda} a ${this.data.moneda}.`;
      return;
    }
    let montoAplicado = conversion.equivalente;
    if (montoAplicado > this.pendiente && !this.esEfectivo(formaPago)) {
      const exceso = this.round(montoAplicado - this.pendiente);
      if (exceso > this.getConversionRoundingTolerance(moneda)) {
        this.validationMessage = 'El monto no puede ser mayor al pendiente para esta forma de pago.';
        return;
      }
      montoAplicado = this.pendiente;
    }

    this.pagosAplicados = [
      ...this.pagosAplicados,
      {
        frmPago       : formaPago.CA05_Codigo,
        descripcion   : formaPago.CA05_Descripcion,
        tipo          : formaPago.CA05_TipPago,
        numTarjeta    : (this.referenciaPago || '').trim(),
        moneda        : moneda,
        monto         ,
        vencimiento   : '',
        mtoTotal      : montoAplicado,
        tCambio       : conversion.tasa,
        orden         : this.pagosAplicados.length + 1
      }
    ];
    this.actualizarMontoConSaldo();
    this.referenciaPago = '';
  }

  eliminarPago(index: number): void {
    this.pagosAplicados = this.pagosAplicados
      .filter((_, currentIndex) => currentIndex !== index)
      .map((pago, currentIndex) => ({ ...pago, orden: currentIndex + 1 }));
    this.actualizarMontoConSaldo();
  }

  onMonedaPagoChange(moneda: string): void {
    this.monedaPagoSeleccionada = this.normalizeCurrency(moneda);
    this.validationMessage = '';
    this.actualizarMontoConSaldo();
  }

  onMontoPagoChange(value: string): void {
    this.montoPagoTexto = value;
    this.validationMessage = '';
  }

  onMontoPagoFocus(): void {
    const amount = this.montoPagoActual;
    this.montoPagoTexto = amount > 0 ? amount.toFixed(2) : '';
  }

  onMontoPagoBlur(): void {
    const amount = this.montoPagoActual;
    this.montoPagoTexto = amount > 0 ? this.formatAmount(amount) : '';
  }

  verDetalleConsumos(): void {
    console.log('Ver detalle de consumos', this.data);
  }

  async confirmarFacturacion(): Promise<void> {
    if (!this.tipoDocumentoSeleccionado) {
      this.validationMessage = 'No hay un tipo de documento disponible para facturar.';
      return;
    }

    if (!this.puedeConfirmar) {
      this.validationMessage = this.pagosAplicados.length === 0
        ? 'Agrega al menos una forma de pago.'
        : 'El total pagado debe cubrir el total de la cuenta.';
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar facturación',
      text: `Se generará el documento ${this.tipoDocumentoSeleccionado.MPV31_CodDocu} por ${this.data.moneda} ${this.formatAmount(this.totalCuenta)}. ¿Desea continuar?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar facturación',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        container: 'next-confirm-container',
        popup: 'next-confirm-modal'
      }
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    this.loadingFacturacion = true;
    this.validationMessage = '';
    const request = this.buildFacturacionRequest();
    console.log('[RestaurantInvoiceDialog] POST /facturacion/venta-pntvta-web payload', request);

    try {
      const respuesta = await firstValueFrom(this.invoiceService.facturarPuntoVenta(request));
      console.log(
        '[RestaurantInvoiceDialog] POST /facturacion/venta-pntvta-web response',
        respuesta
      );

      if ((respuesta?.respuesta || '').trim().toUpperCase() !== 'OK') {
        this.validationMessage = respuesta?.respuesta || 'El servidor no confirmó la facturación.';
        this.toast.error(this.validationMessage);
        return;
      }

      this.toast.success('Factura generada correctamente.');
      const documento = this.getDocumentoGenerado(respuesta);

      if (!documento) {
        this.toast.warning(
          'La factura fue generada, pero la respuesta no incluyó la referencia necesaria para imprimirla.',
          6000,
          'Impresión pendiente'
        );
      } else {
        try {
          await this.posDocumentPrintService.printRestaurantByReference(
            {
              tipoDocu: documento.TipDocu,
              serieDocu: documento.Serie,
              numDocu: documento.NumDocu
            },
            'TIQUETE',
            this.data.puntoVentaNombre || this.data.puntoVenta
          );
          this.toast.success(
            `Documento ${documento.TipDocu} ${documento.Serie}-${documento.NumDocu} enviado a TIQUETE.`
          );
        } catch (printError: unknown) {
          console.error('La factura fue generada, pero no se pudo imprimir:', printError);
          this.toast.warning(
            `La factura fue generada, pero no se pudo imprimir en TIQUETE. ${this.getErrorMessage(printError)}`,
            7000,
            'Impresión pendiente'
          );
        }
      }

      this.closed.emit({ facturado: true, respuesta });
    } catch (error: unknown) {
      console.error('Error al facturar mesa:', error);
      this.validationMessage = 'No se pudo completar la facturacion.';
      this.toast.error('No se pudo completar la facturacion.');
    } finally {
      this.loadingFacturacion = false;
      this.cdr.markForCheck();
    }
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

  trackByMoneda(_: number, item: MonedaUI): string {
    return item.codMoneda;
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
          this.actualizarMontoConSaldo();
        },
        error: (error) => {
          console.error('Error al cargar formas de pago:', error);
          this.formasPago = [];
          this.errorFormasPago = 'No se pudieron cargar las formas de pago.';
        }
      });
  }

  private cargarMonedas(): void {
    this.loadingMonedas = true;
    this.errorMonedas = '';
    this.monedaService
      .getAll()
      .pipe(
        finalize(() => {
          this.loadingMonedas = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.monedas = (items || [])
            .filter((item) => Number(item.activo || 0) === 1)
            .map((item) => ({ ...item, codMoneda: this.normalizeCurrency(item.codMoneda) }))
            .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
          this.monedaPagoSeleccionada = this.resolverMonedaPagoInicial();
          this.actualizarMontoConSaldo();
        },
        error: (error) => {
          console.error('Error al cargar monedas:', error);
          this.monedas = this.buildFallbackCurrencies();
          this.monedaPagoSeleccionada = this.resolverMonedaPagoInicial();
          this.errorMonedas = 'No se pudo actualizar el catálogo de monedas.';
          this.actualizarMontoConSaldo();
        }
      });
  }

  private cargarDocumentosPuntoVenta(): void {
    this.loadingDocumentos = true;
    this.errorDocumentos = '';
    this.documentoSelectionMessage = '';
    this.invoiceService
      .obtenerDocumentosPorPuntoVenta(this.data.puntoVenta)
      .pipe(
        finalize(() => {
          this.loadingDocumentos = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.documentosPuntoVenta = (items || []).map((item) => ({
            ...item,
            MPV31_CodPntVenta: (item.MPV31_CodPntVenta || '').trim(),
            MPV31_CodDocu: (item.MPV31_CodDocu || '').trim().toUpperCase(),
            MPV31_Descripcion: (item.MPV31_Descripcion || '').trim(),
            MPV31_Principal: Number(item.MPV31_Principal || 0),
            MPV31_Operador: (item.MPV31_Operador || '').trim()
          }));
          this.seleccionarTipoDocumento();
          if (!this.tipoDocumentoSeleccionado) {
            this.errorDocumentos = 'No hay documentos configurados para este punto de venta.';
          }
        },
        error: (error) => {
          console.error('Error al cargar documentos del punto de venta:', error);
          this.documentosPuntoVenta = [];
          this.tipoDocumentoSeleccionado = null;
          this.errorDocumentos = 'No se pudieron cargar los tipos de documento.';
        }
      });
  }

  private seleccionarTipoDocumento(): void {
    const principal = this.documentosPuntoVenta.find((item) => item.MPV31_Principal === 1)
      ?? this.documentosPuntoVenta[0]
      ?? null;

    if (!this.clienteSeleccionado) {
      this.tipoDocumentoSeleccionado = principal;
      this.documentoSelectionMessage = principal
        ? 'Documento principal configurado para el punto de venta.'
        : '';
      return;
    }

    const requiereFactura = this.clienteSeleccionado.enviarCorreo === true;
    const prefijo = requiereFactura ? 'F' : 'T';
    const documentosCoincidentes = this.documentosPuntoVenta.filter((item) => item.MPV31_CodDocu.startsWith(prefijo));
    const seleccionado = documentosCoincidentes.find((item) => item.MPV31_Principal === 1)
      ?? documentosCoincidentes[0]
      ?? principal;

    this.tipoDocumentoSeleccionado = seleccionado;
    if (!seleccionado) {
      this.documentoSelectionMessage = '';
      return;
    }

    if (!documentosCoincidentes.length) {
      this.documentoSelectionMessage = `No se encontró un documento que inicie con ${prefijo}; se utilizará el documento principal.`;
      return;
    }

    this.documentoSelectionMessage = requiereFactura
      ? 'Factura seleccionada porque el cliente tiene habilitado el envío por correo.'
      : 'Tiquete seleccionado porque el cliente no tiene habilitado el envío por correo.';
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

  private getDocumentoGenerado(
    response: FacturacionPuntoVentaResponse
  ): FacturacionDocumentoGenerado | null {
    const documento = response.tablas?.[1]?.[0];
    const tipDocu = (documento?.TipDocu || '').trim();
    const serie = (documento?.Serie || '').trim();
    const numDocu = (documento?.NumDocu || '').trim();

    return tipDocu && numDocu
      ? { TipDocu: tipDocu, Serie: serie || '000', NumDocu: numDocu }
      : null;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return typeof error === 'string' && error.trim()
      ? error.trim()
      : 'Verifique QZ Tray y la impresora configurada.';
  }

  private actualizarMontoConSaldo(): void {
    const saldo = this.saldoMonedaPago;
    this.montoPagoTexto = saldo !== null && saldo > 0 ? this.formatAmount(saldo) : '';
  }

  private convertirPagoAMonedaDocumento(
    monto: number,
    monedaPago: string
  ): { equivalente: number; tasa: number } | null {
    const paymentCurrency = this.normalizeCurrency(monedaPago);
    const documentCurrency = this.normalizeCurrency(this.data.moneda);

    if (!paymentCurrency || !documentCurrency) {
      return null;
    }
    if (this.sonMismaMoneda(paymentCurrency, documentCurrency)) {
      return { equivalente: this.round(monto), tasa: 1 };
    }

    const paymentRole = this.getCurrencyRole(paymentCurrency);
    const documentRole = this.getCurrencyRole(documentCurrency);
    const compra = Number(this.data.tipoCambioCompra || 0);
    const venta = Number(this.data.tipoCambioVenta || 0);

    if (documentRole === 'base' && paymentRole === 'reference' && compra > 0) {
      return { equivalente: this.round(monto * compra), tasa: this.round(compra) };
    }
    if (documentRole === 'reference' && paymentRole === 'base' && venta > 0) {
      return { equivalente: this.round(monto / venta), tasa: this.round(venta) };
    }

    return null;
  }

  private convertirSaldoAMonedaPago(saldoDocumento: number, monedaPago: string): number | null {
    const paymentCurrency = this.normalizeCurrency(monedaPago);
    const documentCurrency = this.normalizeCurrency(this.data.moneda);

    if (!paymentCurrency || !documentCurrency) {
      return null;
    }
    if (this.sonMismaMoneda(paymentCurrency, documentCurrency)) {
      return this.round(saldoDocumento);
    }

    const paymentRole = this.getCurrencyRole(paymentCurrency);
    const documentRole = this.getCurrencyRole(documentCurrency);
    const compra = Number(this.data.tipoCambioCompra || 0);
    const venta = Number(this.data.tipoCambioVenta || 0);

    if (documentRole === 'base' && paymentRole === 'reference' && compra > 0) {
      return this.round(saldoDocumento / compra);
    }
    if (documentRole === 'reference' && paymentRole === 'base' && venta > 0) {
      return this.round(saldoDocumento * venta);
    }

    return null;
  }

  private getConversionRoundingTolerance(monedaPago: string): number {
    const paymentRole = this.getCurrencyRole(monedaPago);
    const documentRole = this.getCurrencyRole(this.data.moneda);
    const compra = Number(this.data.tipoCambioCompra || 0);
    const venta = Number(this.data.tipoCambioVenta || 0);

    if (documentRole === 'base' && paymentRole === 'reference' && compra > 0) {
      return this.round(compra / 200);
    }
    if (documentRole === 'reference' && paymentRole === 'base' && venta > 0) {
      return Math.max(0.01, this.round(1 / (venta * 200)));
    }
    return 0.01;
  }

  private getCurrencyRole(currency: string): 'base' | 'reference' | 'other' {
    const normalized = this.normalizeCurrency(currency);
    const base = this.normalizeCurrency(this.data.monedaBaseTipoCambio || 'COL');
    const reference = this.normalizeCurrency(this.data.monedaReferenciaTipoCambio || 'USD');

    if (normalized === base || (this.isCostaRicanColon(normalized) && this.isCostaRicanColon(base))) {
      return 'base';
    }
    if (normalized === reference) {
      return 'reference';
    }
    return 'other';
  }

  private sonMismaMoneda(a: string, b: string): boolean {
    const first = this.normalizeCurrency(a);
    const second = this.normalizeCurrency(b);
    return first === second || (this.isCostaRicanColon(first) && this.isCostaRicanColon(second));
  }

  private isCostaRicanColon(currency: string): boolean {
    return currency === 'COL' || currency === 'CRC';
  }

  private resolverMonedaPagoInicial(): string {
    const documentCurrency = this.normalizeCurrency(this.data.moneda);
    const exact = this.monedas.find((item) => this.normalizeCurrency(item.codMoneda) === documentCurrency);
    const equivalent = this.monedas.find((item) => this.sonMismaMoneda(item.codMoneda, documentCurrency));
    const primary = this.monedas.find((item) => Number(item.primario || 0) === 1);
    return this.normalizeCurrency(exact?.codMoneda || equivalent?.codMoneda || primary?.codMoneda || this.monedas[0]?.codMoneda || documentCurrency);
  }

  private buildFallbackCurrencies(): MonedaUI[] {
    const codes = [
      this.normalizeCurrency(this.data.moneda),
      this.normalizeCurrency(this.data.monedaBaseTipoCambio || 'COL'),
      this.normalizeCurrency(this.data.monedaReferenciaTipoCambio || 'USD')
    ].filter((code, index, items) => !!code && items.indexOf(code) === index);

    return codes.map((code, index) => ({
      codMoneda: code,
      moneda: code,
      simbolo: code === 'USD' ? '$' : code === 'COL' || code === 'CRC' ? '₡' : code,
      activo: 1,
      primario: index === 0 ? 1 : 0,
      secundario: index === 1 ? 1 : 0,
      orden: index + 1
    }));
  }

  private parseAmount(value: string): number {
    let normalized = (value || '').replace(/[^\d.,-]/g, '');
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');

    if (lastComma >= 0 && lastDot >= 0) {
      const decimalSeparator = lastComma > lastDot ? ',' : '.';
      const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
      normalized = normalized.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
    } else if (lastComma >= 0) {
      normalized = /,\d{1,2}$/.test(normalized) ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
    } else if ((normalized.match(/\./g) || []).length > 1) {
      const parts = normalized.split('.');
      const decimals = parts.pop();
      normalized = `${parts.join('')}.${decimals}`;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? this.round(parsed) : 0;
  }

  private formatAmount(value: number): string {
    return this.round(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private normalizeCurrency(value: unknown): string {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
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
      tipDocu         : this.tipoDocumentoSeleccionado?.MPV31_CodDocu || '',
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
