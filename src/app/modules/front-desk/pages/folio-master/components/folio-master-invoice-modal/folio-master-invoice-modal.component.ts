import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import {
  PointOfSalePaymentMethodApi,
  PointOfSaleDocumentApi,
  RoomInvoicePayload,
  RoomStayManagementService
} from '../../../room-stay-management/services/room-stay-management.service';
import { FolioMasterChargeHeader } from '../../models/folio-master-charge.model';
import { FolioMaster } from '../../models/folio-master.model';

interface InvoiceClient {
  code: string;
  name: string;
  document: string;
  address: string;
  email?: string;
  enviarCorreo: boolean;
}

interface InvoicePaymentMethod {
  code: string;
  description: string;
  tipo: string;
  tipPago: string;
}

interface InvoicePaymentDraft {
  methodCode: string;
  moneda: string;
  amount: number | null;
  numTarjeta: string;
  vencimiento: string;
  tCambio: number;
}

interface InvoiceAppliedPayment {
  frmPago: string;
  tipo: string;
  numTarjeta: string;
  moneda: string;
  monto: number;
  vencimiento: string;
  mtoTotal: number;
  tCambio: number;
  orden: number;
  description: string;
}

interface SelectableCharge extends FolioMasterChargeHeader {
  invoiceSelected: boolean;
}

@Component({
  selector: 'app-folio-master-invoice-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './folio-master-invoice-modal.component.html',
  styleUrls: ['./folio-master-invoice-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolioMasterInvoiceModalComponent implements OnInit {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly monedaService = inject(MonedaService);
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly clienteService = inject(ClienteService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly invoiceBaseCurrency = 'USD';
  private readonly clientSearchChanges = new Subject<string>();

  @Input({ required: true }) folio!: FolioMaster;
  @Input({ required: true }) charges: FolioMasterChargeHeader[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() invoiced = new EventEmitter<void>();

  selectableCharges: SelectableCharge[] = [];
  paymentMethods: InvoicePaymentMethod[] = [];
  pointOfSaleDocuments: PointOfSaleDocumentApi[] = [];
  selectedDocument: PointOfSaleDocumentApi | null = null;
  currencies: MonedaUI[] = [];
  appliedPayments: InvoiceAppliedPayment[] = [];
  selectedClient: InvoiceClient | null = null;
  clientSearch = '';
  clientSearchResults: InvoiceClient[] = [];
  clientSearchError = '';
  isClientSearchLoading = false;
  validationMessage = '';
  showChargeSelection = false;
  isCatalogLoading = false;
  isDocumentsLoading = false;
  documentSelectionMessage = '';
  documentSelectionError = '';
  isExchangeRateLoading = false;
  isSubmitting = false;
  paymentDraft: InvoicePaymentDraft = this.createPaymentDraft();

  ngOnInit(): void {
    this.selectableCharges = this.charges.map((charge) => ({ ...charge, invoiceSelected: true }));
    this.paymentDraft = this.createPaymentDraft(this.invoiceTotal);
    this.setupClientSearch();
    this.loadCatalogs();
  }

  get consumerFinal(): InvoiceClient {
    return { code: '000000000', name: 'CLIENTE EN GENERAL', document: '0000000000', address: 'S/D', email: '', enviarCorreo: false };
  }

  get invoiceClient(): InvoiceClient {
    return this.selectedClient ?? this.consumerFinal;
  }

  get selectedDocumentIsInvoice(): boolean {
    return this.clean(this.selectedDocument?.MPV31_CodDocu).startsWith('F');
  }

  get selectedDocumentLabel(): string {
    return this.selectedDocumentIsInvoice ? 'Factura Electrónica' : 'Tiquete Electrónico';
  }

  get selectedCharges(): SelectableCharge[] {
    return this.selectableCharges.filter((charge) => charge.invoiceSelected);
  }

  get invoiceTotal(): number {
    return this.round(this.selectedCharges.reduce((sum, charge) => sum + Number(charge.mtoTot || 0), 0));
  }

  get invoiceSubtotal(): number {
    return this.round(this.invoiceTotal / 1.18);
  }

  get invoiceTaxes(): number {
    return this.round(this.invoiceTotal - this.invoiceSubtotal);
  }

  get invoiceTip(): number {
    return 0;
  }

  get invoicePaid(): number {
    return this.round(this.appliedPayments.reduce((sum, payment) => sum + payment.mtoTotal, 0));
  }

  get invoicePending(): number {
    return this.round(Math.max(this.invoiceTotal - this.invoicePaid, 0));
  }

  get invoiceChange(): number {
    return this.round(Math.max(this.invoicePaid - this.invoiceTotal, 0));
  }

  get invoiceCanConfirm(): boolean {
    return !!this.selectedDocument && this.selectedCharges.length > 0 && this.appliedPayments.length > 0 && this.invoicePaid >= this.invoiceTotal;
  }

  get convertedDraftAmount(): number {
    return this.round(this.convertToInvoiceCurrency(Number(this.paymentDraft.amount || 0), this.paymentDraft.moneda, this.getExchangeRate()));
  }

  get currencyOptions(): MonedaUI[] {
    return this.currencies.length ? this.currencies : [{ codMoneda: 'USD', moneda: 'DOLAR', simbolo: '$', activo: 1, primario: 0, secundario: 1, orden: 1 }];
  }

  get folioNumber(): string {
    return this.clean(this.folio.PRV09_NumFolio || this.folio.PRV01_Folio);
  }

  get reservationNumber(): string {
    return this.clean(this.folio.PRV09_CodReserva || this.folio.PRV01_CodReserva);
  }

  selectClient(client: InvoiceClient): void {
    this.selectedClient = client;
    this.clientSearch = client.name;
    this.clientSearchResults = [];
    this.clientSearchError = '';
    this.selectDocumentForClient();
  }

  clearClient(): void {
    this.selectedClient = null;
    this.clientSearch = '';
    this.clientSearchResults = [];
    this.clientSearchError = '';
    this.selectDocumentForClient();
  }

  onClientSearchChange(value: string): void {
    this.clientSearch = value;
    if (this.selectedClient && this.selectedClient.name !== value) {
      this.selectedClient = null;
      this.selectDocumentForClient();
    }
    this.clientSearchChanges.next(value);
  }

  updatePaymentDraft(patch: Partial<InvoicePaymentDraft>): void {
    this.paymentDraft = { ...this.paymentDraft, ...patch };
    if (patch.moneda !== undefined) this.loadExchangeRate(patch.moneda);
  }

  toggleCharge(charge: SelectableCharge, selected: boolean): void {
    charge.invoiceSelected = selected;
    this.resetPaymentsForChargeChange();
  }

  addPayment(): void {
    const method = this.paymentMethods.find((item) => item.code === this.paymentDraft.methodCode);
    const moneda = this.clean(this.paymentDraft.moneda).toUpperCase();
    const amount = this.round(Number(this.paymentDraft.amount || 0));
    const exchangeRate = this.getExchangeRate();
    this.validationMessage = '';

    if (!method) return this.setValidation('Selecciona una forma de pago.');
    if (!moneda) return this.setValidation('Selecciona la moneda del pago.');
    if (amount <= 0) return this.setValidation('El monto debe ser mayor a 0.');
    if (moneda !== this.invoiceBaseCurrency && exchangeRate <= 0) return this.setValidation('No se pudo determinar el tipo de cambio para la moneda seleccionada.');

    this.appliedPayments = [
      ...this.appliedPayments,
      {
        frmPago: method.code,
        tipo: method.tipo || method.tipPago,
        numTarjeta: this.clean(this.paymentDraft.numTarjeta),
        moneda,
        monto: amount,
        vencimiento: this.clean(this.paymentDraft.vencimiento),
        mtoTotal: this.round(this.convertToInvoiceCurrency(amount, moneda, exchangeRate)),
        tCambio: exchangeRate,
        orden: this.appliedPayments.length + 1,
        description: method.description
      }
    ];

    const nextAmount = this.round(this.convertFromInvoiceCurrency(this.invoicePending, moneda, exchangeRate));
    this.paymentDraft = { ...this.paymentDraft, amount: nextAmount > 0 ? nextAmount : null, numTarjeta: '00000', vencimiento: '00/00' };
  }

  removePayment(order: number): void {
    this.appliedPayments = this.appliedPayments.filter((payment) => payment.orden !== order).map((payment, index) => ({ ...payment, orden: index + 1 }));
  }

  submitInvoice(): void {
    if (!this.selectedCharges.length) return this.setValidation('Selecciona al menos un cargo para facturar.');
    if (this.selectedCharges.some((charge) => !this.clean(charge.numCrgHab))) return this.setValidation('Uno o más cargos seleccionados no tienen número de cargo de habitación.');
    if (!this.selectedDocument) return this.setValidation('No hay un tipo de documento configurado para el punto de venta PF.');
    if (!this.invoiceCanConfirm) {
      return this.setValidation(this.appliedPayments.length ? 'El total pagado debe cubrir el total de la cuenta.' : 'Agrega al menos una forma de pago para confirmar la facturación.');
    }

    const payload = this.buildPayload();
    console.log('[FolioMaster] POST /facturacion-fdesk payload', payload);
    this.isSubmitting = true;
    this.validationMessage = '';

    this.roomStayService.invoiceRoom(payload).pipe(
      finalize(() => { this.isSubmitting = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (this.isFailedResponse(response)) {
          this.validationMessage = response.message || 'No se pudo facturar el Folio Master.';
          this.cdr.markForCheck();
          return;
        }
        this.toastService.success('Facturación del Folio Master confirmada correctamente.', 4000, 'Documentos');
        this.invoiced.emit();
      },
      error: (error) => {
        console.error('No se pudo facturar el Folio Master.', error);
        this.validationMessage = 'No se pudo facturar el Folio Master. Revise la conexión con el API.';
        this.toastService.warning('No se pudo facturar el Folio Master.', 4000, 'Documentos');
        this.cdr.markForCheck();
      }
    });
  }

  trackCharge(_: number, charge: SelectableCharge): string {
    return `${charge.tipCrgHab}|${charge.numCrgHab}`;
  }

  trackPayment(_: number, payment: InvoiceAppliedPayment): number {
    return payment.orden;
  }

  trackClient(_: number, client: InvoiceClient): string {
    return client.code;
  }

  private setupClientSearch(): void {
    this.clientSearchChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((value) => {
        const query = this.clean(value);
        this.clientSearchError = '';

        if (query.length < 2) {
          this.clientSearchResults = [];
          this.isClientSearchLoading = false;
          this.cdr.markForCheck();
          return of(null);
        }

        this.isClientSearchLoading = true;
        this.cdr.markForCheck();
        return this.clienteService.getClientes(1, 8, query).pipe(
          catchError((error) => {
            console.error('No se pudieron buscar los clientes.', error);
            this.clientSearchError = 'No se pudieron consultar los clientes.';
            return of({ data: [] as ClienteUI[], totalRegistros: 0, paginaActual: 1, pageSize: 8, totalPages: 1 });
          }),
          finalize(() => {
            this.isClientSearchLoading = false;
            this.cdr.markForCheck();
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      this.clientSearchResults = response?.data?.map((client) => this.mapClient(client)) ?? [];
      this.cdr.markForCheck();
    });
  }

  private mapClient(client: ClienteUI): InvoiceClient {
    return {
      code: this.clean(client.codigo),
      name: this.clean(client.nombre) || 'CLIENTE SIN NOMBRE',
      document: this.clean(client.ruc),
      address: this.clean(client.direccion) || 'S/D',
      email: this.clean(client.email || client.emailPrincipal),
      enviarCorreo: client.enviarCorreo === true
    };
  }

  private loadCatalogs(): void {
    this.isCatalogLoading = true;
    this.roomStayService.getPointOfSalePaymentMethods('PF').pipe(
      catchError((error) => {
        console.error('No se pudieron cargar las formas de pago.', error);
        this.toastService.warning('No se pudieron cargar las formas de pago.', 3500, 'Facturación');
        return of([] as PointOfSalePaymentMethodApi[]);
      }),
      finalize(() => { this.isCatalogLoading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((methods) => {
      this.paymentMethods = methods.map((method) => ({
        code: this.clean(method.CA05_Codigo),
        description: this.clean(method.CA05_Descripcion) || this.clean(method.CA05_Codigo),
        tipo: this.clean(method.CA05_Tipo),
        tipPago: this.clean(method.CA05_TipPago)
      }));
      this.paymentDraft = { ...this.paymentDraft, methodCode: this.paymentMethods[0]?.code ?? '' };
      this.cdr.markForCheck();
    });

    this.monedaService.getAll().pipe(
      catchError((error) => {
        console.error('No se pudo cargar el catálogo de monedas.', error);
        return of([] as MonedaUI[]);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((currencies) => {
      this.currencies = currencies.filter((currency) => Number(currency.activo) !== 0).sort((a, b) => Number(a.orden) - Number(b.orden));
      const defaultCurrency = this.currencies.find((currency) => this.clean(currency.codMoneda).toUpperCase() === this.invoiceBaseCurrency)?.codMoneda || this.invoiceBaseCurrency;
      this.paymentDraft = { ...this.paymentDraft, moneda: defaultCurrency, tCambio: defaultCurrency === this.invoiceBaseCurrency ? 1 : 0 };
      this.cdr.markForCheck();
    });

    this.loadPointOfSaleDocuments();
  }

  private loadPointOfSaleDocuments(): void {
    this.isDocumentsLoading = true;
    this.documentSelectionError = '';
    this.roomStayService.getPointOfSaleDocuments('PF').pipe(
      catchError((error) => {
        console.error('No se pudieron cargar los documentos del punto de venta PF.', error);
        this.documentSelectionError = 'No se pudieron cargar los tipos de documento.';
        return of([] as PointOfSaleDocumentApi[]);
      }),
      finalize(() => {
        this.isDocumentsLoading = false;
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((documents) => {
      this.pointOfSaleDocuments = documents.map((document) => ({
        ...document,
        MPV31_CodPntVenta: this.clean(document.MPV31_CodPntVenta).toUpperCase(),
        MPV31_CodDocu: this.clean(document.MPV31_CodDocu).toUpperCase(),
        MPV31_Descripcion: this.clean(document.MPV31_Descripcion),
        MPV31_Principal: Number(document.MPV31_Principal || 0),
        MPV31_Operador: this.clean(document.MPV31_Operador)
      }));
      this.selectDocumentForClient();
      if (!this.selectedDocument && !this.documentSelectionError) {
        this.documentSelectionError = 'No hay documentos configurados para el punto de venta PF.';
      }
      this.cdr.markForCheck();
    });
  }

  private selectDocumentForClient(): void {
    const principal = this.pointOfSaleDocuments.find((document) => document.MPV31_Principal === 1)
      ?? this.pointOfSaleDocuments[0]
      ?? null;
    const requiresInvoice = this.invoiceClient.enviarCorreo === true;
    const prefix = requiresInvoice ? 'F' : 'T';
    const matches = this.pointOfSaleDocuments.filter((document) => document.MPV31_CodDocu.startsWith(prefix));

    this.selectedDocument = matches.find((document) => document.MPV31_Principal === 1) ?? matches[0] ?? principal;
    if (!this.selectedDocument) {
      this.documentSelectionMessage = '';
      return;
    }

    this.documentSelectionMessage = matches.length
      ? requiresInvoice
        ? 'Factura Electrónica seleccionada porque el cliente tiene habilitado el envío por correo.'
        : 'Tiquete Electrónico seleccionado porque el cliente no tiene habilitado el envío por correo.'
      : `No se encontró un documento que inicie con ${prefix}; se utilizará el documento principal.`;
  }

  private loadExchangeRate(currency: string): void {
    const moneda = this.clean(currency).toUpperCase();
    if (!moneda || moneda === this.invoiceBaseCurrency) {
      this.paymentDraft = {
        ...this.paymentDraft,
        moneda: moneda || this.invoiceBaseCurrency,
        tCambio: 1,
        amount: this.invoicePending > 0 ? this.invoicePending : null
      };
      return;
    }

    this.isExchangeRateLoading = true;
    // La factura está expresada en USD. Para recibir un pago en moneda local
    // necesitamos la venta del USD (unidades locales por cada USD), no la tasa
    // 1:1 de la moneda primaria.
    this.tipoCambioService.fetchTipoCambio(this.today(), this.invoiceBaseCurrency.toLowerCase()).pipe(
      catchError((error) => {
        console.error('No se pudo cargar el tipo de cambio.', error);
        this.toastService.warning('No se pudo cargar el tipo de cambio para la moneda seleccionada.', 3500, 'Facturación');
        return of([]);
      }),
      finalize(() => { this.isExchangeRateLoading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((items) => {
      if (this.clean(this.paymentDraft.moneda).toUpperCase() !== moneda) {
        return;
      }

      const exchangeRate = Number(items[0]?.venta ?? 0);
      const normalizedRate = exchangeRate > 0 ? this.round(exchangeRate) : 0;
      this.paymentDraft = {
        ...this.paymentDraft,
        moneda,
        tCambio: normalizedRate,
        amount: normalizedRate > 0 && this.invoicePending > 0
          ? this.round(this.convertFromInvoiceCurrency(this.invoicePending, moneda, normalizedRate))
          : null
      };
      this.cdr.markForCheck();
    });
  }

  private resetPaymentsForChargeChange(): void {
    this.appliedPayments = [];
    this.validationMessage = '';
    this.paymentDraft = { ...this.paymentDraft, amount: this.round(this.convertFromInvoiceCurrency(this.invoiceTotal, this.paymentDraft.moneda, this.getExchangeRate())) };
  }

  private buildPayload(): RoomInvoicePayload {
    const firstPayment = this.appliedPayments[0];
    const client = this.invoiceClient;
    const fecha = this.today();
    const operador = this.getOperator();

    return {
      proceso: 1, tipDocu: this.clean(this.selectedDocument?.MPV31_CodDocu), serieDocu: '', numDocu: 'GENERA',
      codCliente: this.clean(client.code), rucClie: this.clean(client.document) || '0000000000',
      nomClie: this.clean(client.name) || 'CLIENTE EN GENERAL', direccion: this.clean(client.address) || 'S/D',
      numInterno: '', codReserva: this.reservationNumber, habita: this.folioNumber, master: this.folioNumber,
      fechaDocu: fecha, fechaPago: fecha, fechaVen: fecha,
      subTotal: this.invoiceSubtotal, descuento: 0, neto: this.invoiceSubtotal, impuesto: this.invoiceTaxes,
      exonera: 0, totDocumento: this.invoiceTotal, totPago: this.invoicePaid, totPropina: this.invoiceTip,
      pntVenta: 'PF', codVendedor: operador, moneda: this.invoiceBaseCurrency, tCambio: 1, estado: 'P',
      formaPago: this.clean(firstPayment?.frmPago), numCuenta: 0, tipo: firstPayment ? 'CONTADO' : '',
      tipNdp: '', numeroNdp: '', operador,
      detDocumento: this.selectedCharges.map((charge, index) => ({
        orden: index + 1, fecha: normalizePmsDateDDMMYYYY(charge.fecha) || fecha, grupo: '', codConsumo: '', nomConsumo: '',
        cantidad: 0, precio: 0, subTotal: 0, porDescuento: 0, descuento: 0, neto: 0, impuest: 0, total: 0,
        tipNPedido: this.clean(charge.tipCrgHab), numNPedido: this.clean(charge.numCrgHab), codMozo: '', pntVenta: '',
        almacen: '', incluido: '', moneda: '', operador: ''
      })),
      frmPago: this.appliedPayments.map((payment, index) => ({
        orden: index + 1, frmPago: this.clean(payment.frmPago), tipo: this.clean(payment.tipo), numTarjeta: this.clean(payment.numTarjeta),
        moneda: this.clean(payment.moneda), monto: this.round(payment.monto), vencimiento: this.clean(payment.vencimiento),
        mtoTotal: this.round(payment.mtoTotal), tCambio: this.round(payment.tCambio)
      }))
    };
  }

  private createPaymentDraft(amount: number | null = null): InvoicePaymentDraft {
    return { methodCode: '', moneda: this.invoiceBaseCurrency, amount, numTarjeta: '00000', vencimiento: '00/00', tCambio: 1 };
  }

  private getExchangeRate(): number {
    return this.paymentDraft.moneda === this.invoiceBaseCurrency ? 1 : Math.max(Number(this.paymentDraft.tCambio || 0), 0);
  }

  private convertToInvoiceCurrency(amount: number, currency: string, rate: number): number {
    return !amount || !currency || currency === this.invoiceBaseCurrency || !rate ? amount || 0 : amount / rate;
  }

  private convertFromInvoiceCurrency(amount: number, currency: string, rate: number): number {
    return !amount || !currency || currency === this.invoiceBaseCurrency || !rate ? amount || 0 : amount * rate;
  }

  private getOperator(): string {
    const user = this.authService.getCurrentUser();
    return this.clean(user?.usuario || user?.nombre || this.folio.PRV09_Operador || this.folio.PRV01_Operador || 'SISTEMA');
  }

  private isFailedResponse(response: unknown): response is { success: false; message?: string } {
    return typeof response === 'object' && response !== null && Object.prototype.hasOwnProperty.call(response, 'success') && (response as { success?: boolean }).success === false;
  }

  private setValidation(message: string): void {
    this.validationMessage = message;
  }

  private today(): string {
    return normalizePmsDateDDMMYYYY(new Date());
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private clean(value: unknown): string {
    return (value ?? '').toString().trim();
  }
}
