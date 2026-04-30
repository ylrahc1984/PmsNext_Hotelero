import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, startWith, debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ClienteService, SelectOption } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ActividadComercialService } from 'src/app/demo/catalogos/agencias-comisionistas/actividad-comercial/actividad-comercial.service';
import { NuevaFacturaClienteModalComponent } from '../nueva-factura-cliente-modal/nueva-factura-cliente-modal.component';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { DocumentoDto } from 'src/app/demo/administracion/documento/documento.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { PlanesTarifasService, PlanTarifaUI } from 'src/app/demo/catalogos/listas-precios/planes-tarifas.service';
import { ListaPrecioService } from 'src/app/demo/catalogos/listas-precios/lista-precio.service';
import { ListaPrecioUI } from 'src/app/demo/catalogos/listas-precios/lista-precio.models';
import { SelectorServiciosModalComponent } from '../selector-servicios-modal/selector-servicios-modal.component';
import { ReservaPendienteModalComponent } from '../reserva-pendiente-modal/reserva-pendiente-modal.component';
import { ModoPrecio, ServicioListaPrecioItem } from 'src/app/finanzas/services/servicios-lista-precio.service';
import {
  ReservaPendienteDetalle,
  ReservasFacturacionService
} from 'src/app/finanzas/services/reservas-facturacion.service';
import { ReservasService } from 'src/app/demo/reservas/services/reservas.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { calculateFiscalTotals } from 'src/app/core/config/fiscal.utils';
import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import type {
  ConfirmarFacturaPayload,
  ConfirmarFacturaResponse,
  DetalleForm,
  LineaCalculo,
  NuevaFacturaForm,
  PagoForm,
  TotalesResumen
} from '../nueva-factura.interface';
import { C } from '@angular/cdk/scrolling-module.d-C_w4tIrZ';

@Component({
  selector: 'app-nueva-factura',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    NuevaFacturaClienteModalComponent,
    SelectorServiciosModalComponent,
    ReservaPendienteModalComponent
  ],
  templateUrl: './nueva-factura.component.html',
  styleUrls: ['./nueva-factura.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaFacturaComponent implements OnInit {
  private readonly fb                            = inject(FormBuilder);
  private readonly http                          = inject(HttpClient);
  private readonly router                        = inject(Router);
  private readonly route                         = inject(ActivatedRoute);
  private readonly destroyRef                    = inject(DestroyRef);
  private readonly cdr                           = inject(ChangeDetectorRef);
  private readonly monedaService                 = inject(MonedaService);
  private readonly authService                   = inject(AuthService);
  private readonly empresaContext                = inject(EmpresaContextService);
  private readonly clienteService                = inject(ClienteService);
  private readonly actividadComercialService     = inject(ActividadComercialService);
  private readonly usuarioService                = inject(UsuarioService);
  private readonly formaPagoService              = inject(FormaPagoService);
  private readonly planesTarifasService          = inject(PlanesTarifasService);
  private readonly listaPrecioService            = inject(ListaPrecioService);
  private readonly reservasFacturacionService    = inject(ReservasFacturacionService);
  private readonly reservasService               = inject(ReservasService);
  private readonly tipoCambioService             = inject(TipoCambioService);
  private readonly auth                          = inject(AuthService);

  private readonly apiUrl = `${environment.apiUrl}/facturacion/confirmar`;

  readonly empresa = this.empresaContext.empresa;

  readonly form: FormGroup<NuevaFacturaForm> = this.fb.group({
    tipDocu               : this.fb.nonNullable.control('01', { validators: [Validators.required] }),
    codCliente            : this.fb.nonNullable.control('', { validators: [Validators.required] }),
    rucCliente            : this.fb.nonNullable.control(''),
    nomCliente            : this.fb.nonNullable.control('', { validators: [Validators.required] }),
    correoCliente         : this.fb.nonNullable.control(''),
    codReserva            : this.fb.nonNullable.control(''),
    fechaInicio           : this.fb.nonNullable.control(''),
    fechaFin              : this.fb.nonNullable.control(''),
    voucherRsv            : this.fb.nonNullable.control(''),
    nProveedor            : this.fb.nonNullable.control(''),
    habitacion            : this.fb.nonNullable.control(''),
    master                : this.fb.nonNullable.control(''),
    fechaDocu             : this.fb.nonNullable.control(this.getTodayIsoDate()),
    pntVenta              : this.fb.nonNullable.control(''),
    numMesa               : this.fb.nonNullable.control(''),
    numPax                : this.fb.nonNullable.control(0),
    codVendedor           : this.fb.nonNullable.control(''),
    condicionVenta        : this.fb.nonNullable.control('01', { validators: [Validators.required] }),
    moneda                : this.fb.nonNullable.control('USD', { validators: [Validators.required] }),
    codigoActividad       : this.fb.nonNullable.control(''),
    observacion           : this.fb.nonNullable.control(''),
    planTarifario         : this.fb.nonNullable.control(''),
    listaPrecio           : this.fb.nonNullable.control(''),
    tCambio               : this.fb.nonNullable.control(1),
    operador              : this.fb.nonNullable.control(this.getOperador()),
    respuesta             : this.fb.nonNullable.control(''),
    serie                 : this.fb.nonNullable.control(''),
    numero                : this.fb.nonNullable.control(''),
    detalle               : this.fb.array<FormGroup<DetalleForm>>([], { validators: [Validators.required] }),
    pagos                 : this.fb.array<FormGroup<PagoForm>>([])
  });

  readonly nuevoClienteForm = this.fb.group({
    nombreCli            : ['', [Validators.required]],
    ruc                  : ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
    direccion            : [''],
    email                : ['', [Validators.required, Validators.email, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)]],
    telefono1            : [''],
    tCliente             : ['', [Validators.required]],
    enviarCorreo         : [false],
    actividadCodigoAMH   : [''],
    actividadDescripcion : ['']
  });

  readonly lineasCalculo: LineaCalculo[] = [];
  resumen                   : TotalesResumen = { subtotal: 0, descuento: 0, neto: 0, impuesto: 0, total: 0 };

  mostrarPagos              = true;
  pagosTotal                = 0;
  pagosValid                = true;

  selectedCliente           : ClienteUI | null = null;
  clienteSearchResults      : ClienteUI[] = [];
  clienteSearchLoading      = false;
  clienteSearchError        : string | null = null;
  showClienteModal          = false;
  showNuevoClienteModal     = false;
  showServicioModal         = false;
  showReservaModal          = false;
  showDescuentoModal        = false;
  descuentoGlobalTipo       : 'porcentaje' | 'monto' = 'porcentaje';
  descuentoGlobalValor      = 0;
  descuentoGlobalError      : string | null = null;
  descuentoGlobalSnapshot   : number[] | null = null;
  showDescuentoLineaModal   = false;
  descuentoLineaTipo        : 'porcentaje' | 'monto' = 'porcentaje';
  descuentoLineaValor       = 0;
  descuentoLineaError       : string | null = null;
  descuentoLineaIndex       : number | null = null;
  modoReserva               = false;
  reservaActual             : string | null = null;
  reservaLoading            = false;
  reservaErrorMessage       : string | null = null;

  @ViewChildren('cantidadInput') cantidadInputs?: QueryList<ElementRef<HTMLInputElement>>;

  private previousListaPrecio         = '';
  private suppressListaPrecioChange   = false;
  private singlePagoAutoMonto         : number | null = null;
  private tiposDocumentoBase          : DocumentoDto[] = [];
  private readonly pagoMonedaAnterior = new WeakMap<FormGroup<PagoForm>, string>();

  monedas                 : MonedaUI[] = [];
  monedasLoading          = false;

  tiposDocumento          : DocumentoDto[] = [];
  tiposDocumentoLoading   = false;

  puntosVenta             : PuntoVentaUI[] = [];
  puntosVentaLoading      = false;

  formasPago              : FormaPago[] = [];
  formasPagoLoading       = false;

  planesTarifarios        : PlanTarifaUI[] = [];
  planesTarifariosLoading = false;

  listasPrecio             : ListaPrecioUI[] = [];
  listasPrecioLoading      = false;

  tipoClienteOptions       : SelectOption[] = [];
  tipoClienteOptionsLoading = false;
  nuevoClienteSaving       = false;
  nuevoClienteError        : string | null = null;

  isSubmitting             = false;
  showConfirmModal         = false;
  errorMessage             : string | null = null;
  successMessage           : string | null = null;
  facturaSerie             = '';
  facturaNumero            = '';
  locked                   = false;

  tipoCambioActual        : TipoCambio | null = null;
  tipoCambioLoading       = false;
  tipoCambioError         : string | null = null;

  constructor() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.usuario) {
      this.form.controls.codVendedor.setValue(currentUser.usuario, { emitEvent: false });
    }

    this.addPago();

    this.form.controls.condicionVenta.valueChanges
      .pipe(startWith(this.form.controls.condicionVenta.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.mostrarPagos = value === '01';
        if (!this.mostrarPagos) {
          this.pagosArray.clear();
        } else if (this.pagosArray.length === 0) {
          this.addPago();
        }
        this.updateCalculos();
        this.cdr.markForCheck();
      });

    this.detalleArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateCalculos();
      this.cdr.markForCheck();
    });

    this.pagosArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateCalculos();
      this.cdr.markForCheck();
    });

    this.form.controls.listaPrecio.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.onListaPrecioChange((value || '').toString());
        this.syncDetalleCatalogCodes();
      });

    this.form.controls.planTarifario.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncDetalleCatalogCodes();
      });

    this.form.controls.codCliente.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => {
        const query = (value ?? '').toString().trim();
        if (!query || this.locked) {
          this.clearClienteSearchResults();
          return;
        }

        if (this.selectedCliente && this.selectedCliente.codigo.trim() !== query) {
          this.selectedCliente = null;
        }

        this.searchClientes(query);
      });

    this.form.controls.fechaDocu.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.loadTipoCambio());

    this.form.controls.moneda.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.loadTipoCambio());

    this.nuevoClienteForm.controls.enviarCorreo.valueChanges
      .pipe(startWith(this.nuevoClienteForm.controls.enviarCorreo.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncNuevoClienteActividadValidators();
        this.cdr.markForCheck();
      });

  }

  ngOnInit(): void {
    this.cargarMonedas();
    //this.cargarTiposDocumento();
    this.cargarPuntosVenta();
    this.cargarFormasPago();
    this.cargarPlanesTarifarios();
    this.cargarListasPrecio();
    this.initReservaFromQuery();
    this.loadTipoCambio();
  }

  private getOperador(): string {
    return this.auth.getCurrentUser()?.usuario ?? '';
  }

  get detalleArray(): FormArray<FormGroup<DetalleForm>> {
    return this.form.controls.detalle;
  }

  get pagosArray(): FormArray<FormGroup<PagoForm>> {
    return this.form.controls.pagos;
  }

  get canConfirm(): boolean {
    return (
      !this.locked &&
      !this.isSubmitting &&
      !this.reservaLoading &&
      this.form.valid &&
      this.detalleArray.length > 0 &&
      this.pagosValid &&
      !this.reservaDetalleInvalid
    );
  }

  get reservaDetalleInvalid(): boolean {
    if (!this.modoReserva) {
      return false;
    }
    return this.detalleArray.controls.some((group) => group.controls.cantidad.invalid);
  }

  get hasDescuentoAplicado(): boolean {
    return this.detalleArray.controls.some((group) => this.toNumber(group.controls.porDescu.value) > 0);
  }

  removeDetalle(index: number): void {
    if (this.locked) return;
    this.detalleArray.removeAt(index);
    this.reindexDetalle();
    this.updateCalculos();
  }

  addPago(): void {
    if (this.locked) return;
    const pendingAmount = this.getPendingAmountForNewPago();
    const group = this.createPagoGroup();
    this.pagosArray.push(group);
    this.pagoMonedaAnterior.set(group, group.controls.moneda.value);
    this.syncPagosDefaults();
    this.populatePagoPendingAmount(group, pendingAmount);
    this.updateCalculos();
  }

  removePago(index: number): void {
    if (this.locked) return;
    this.pagosArray.removeAt(index);
    this.updateCalculos();
  }

  onPagoMontoFocus(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement | null;
    const group = this.pagosArray.at(index);
    if (!input || !group) {
      return;
    }
    const monto = this.round(this.toNumber(group.controls.monto.value));
    input.value = monto > 0 ? monto.toFixed(2) : '';
  }

  onPagoMontoBlur(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement | null;
    const group = this.pagosArray.at(index);
    if (!group) {
      return;
    }

    const rawValue = input?.value ?? group.controls.monto.value;
    const monto = this.round(this.toNumber(rawValue));
    this.setPagoMontoFormatted(group, monto);

    if (input) {
      input.value = group.controls.monto.value.toString();
    }

    this.updateCalculos();
    this.cdr.markForCheck();
  }

  onDetalleDescuentoFocus(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement | null;
    const group = this.detalleArray.at(index);
    if (!input || !group) {
      return;
    }
    const descuento = this.round(this.toNumber(group.controls.porDescu.value));
    input.value = descuento > 0 ? descuento.toFixed(2) : '';
  }

  onDetalleDescuentoBlur(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement | null;
    const group = this.detalleArray.at(index);
    if (!group) {
      return;
    }

    const rawValue = input?.value ?? group.controls.porDescu.value;
    const descuento = this.round(this.toNumber(rawValue));
    this.setDetalleDescuentoFormatted(group, descuento);

    if (input) {
      input.value = group.controls.porDescu.value.toString();
    }

    this.updateCalculos();
    this.cdr.markForCheck();
  }

  onPagoMonedaChange(index: number): void {
    const group = this.pagosArray.at(index);
    if (!group) {
      return;
    }

    const nextCurrency = (group.controls.moneda.value || '').toString().trim();
    const previousCurrency = this.pagoMonedaAnterior.get(group) || nextCurrency;

    if (!nextCurrency || previousCurrency === nextCurrency) {
      this.pagoMonedaAnterior.set(group, nextCurrency);
      return;
    }

    const currentAmount = this.toNumber(group.controls.monto.value);
    const wasAutoAmount = this.pagosArray.length === 1 && this.singlePagoAutoMonto === this.round(currentAmount);
    const amountInDocCurrency = this.convertAmountToDocCurrency(currentAmount, previousCurrency);
    const convertedAmount = this.convertAmountFromDocCurrency(amountInDocCurrency, nextCurrency);

    this.setPagoMontoFormatted(group, convertedAmount);
    this.pagoMonedaAnterior.set(group, nextCurrency);
    this.singlePagoAutoMonto = wasAutoAmount ? this.round(convertedAmount) : null;
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  onPagoVencimientoBlur(index: number): void {
    const group = this.pagosArray.at(index);
    if (!group) {
      return;
    }
    const normalized = this.normalizeCardExpiry(group.controls.vencimiento.value);
    group.controls.vencimiento.setValue(normalized, { emitEvent: false });
  }

  openConfirm(): void {
    if (!this.canConfirm) {
      this.form.markAllAsTouched();
      return;
    }
    this.showConfirmModal = true;
  }

  closeConfirm(): void {
    if (this.isSubmitting) return;
    this.showConfirmModal = false;
  }

  confirmSubmit(): void {
    if (this.isSubmitting) return;
    this.showConfirmModal = false;
    this.submitFactura();
  }

  irOperacionDiaria(): void {
    this.router.navigate(['/operaciones/operacion-diaria']);
  }

  irConsulta(): void {
    this.router.navigate(['/finanzas/consulta-documentos']);
  }

  verDocumento(): void {
    if (!this.facturaNumero) return;
    const tipo = this.form.controls.tipDocu.value;
    const serie = this.facturaSerie || '000';
    this.router.navigate(['/finanzas/documento', tipo, serie, this.facturaNumero]);
  }

  trackByDetalle(index: number): number {
    return index;
  }

  trackByPago(index: number): number {
    return index;
  }

  getLineaSubTotal(index: number): number {
    return this.lineasCalculo[index]?.subtotal ?? 0;
  }

  getLineaNeto(index: number): number {
    return this.lineasCalculo[index]?.neto ?? 0;
  }

  getLineaImpuesto(index: number): number {
    return this.lineasCalculo[index]?.impuesto ?? 0;
  }

  getLineaTotal(index: number): number {
    return this.lineasCalculo[index]?.total ?? 0;
  }

  getLineaDescripcion(index: number): string {
    const group = this.detalleArray.at(index);
    return group?.controls.descripcion.value || `Linea ${index + 1}`;
  }

  getLineaSubtotalBase(index: number): number {
    const group = this.detalleArray.at(index);
    return group ? this.round(this.getDetalleLineaSubtotalBase(group)) : 0;
  }

  getLineaTotalSinDescuento(index: number): number {
    const group = this.detalleArray.at(index);
    return group ? this.round(this.getDetalleLineaTotalSinDescuento(group)) : 0;
  }

  get hasDescuentoLineaSeleccionada(): boolean {
    const group = this.getDescuentoLineaGroup();
    return group ? this.toNumber(group.controls.porDescu.value) > 0 : false;
  }

  public abrirModalClientes(): void {
    if (this.locked) return;
    this.showClienteModal = true;
    this.cdr.markForCheck();
  }

  public abrirModalNuevoCliente(): void {
    if (this.locked) return;
    this.nuevoClienteError = null;
    this.showNuevoClienteModal = true;
    this.resetNuevoClienteForm();
    this.loadTipoIdentificacionOptionsParaNuevoCliente();
    this.cdr.markForCheck();
  }

  public cerrarModalNuevoCliente(): void {
    if (this.nuevoClienteSaving) return;
    this.showNuevoClienteModal = false;
    this.nuevoClienteError = null;
    this.cdr.markForCheck();
  }

  public abrirModalServicios(): void {
    if (this.locked || this.modoReserva) return;
    const codLista = (this.form.controls.listaPrecio.value || '').toString().trim();
    if (!codLista) {
      window.alert('Seleccione la lista de precios antes de agregar servicios.');
      return;
    }
    this.showServicioModal = true;
    this.cdr.markForCheck();
  }

  public cerrarModalServicios(): void {
    this.showServicioModal = false;
    this.cdr.markForCheck();
  }

  public abrirModalReserva(): void {
    if (this.locked || this.modoReserva) return;
    this.showReservaModal = true;
    this.reservaErrorMessage = null;
    this.cdr.markForCheck();
  }

  public cerrarModalReserva(): void {
    this.showReservaModal = false;
    this.cdr.markForCheck();
  }

  public abrirModalDescuentoGlobal(): void {
    if (this.locked || this.detalleArray.length === 0) return;
    this.descuentoGlobalTipo = 'porcentaje';
    this.descuentoGlobalValor = 0;
    this.descuentoGlobalError = null;
    this.showDescuentoModal = true;
    this.cdr.markForCheck();
  }

  public cerrarModalDescuentoGlobal(): void {
    this.showDescuentoModal = false;
    this.descuentoGlobalError = null;
    this.cdr.markForCheck();
  }

  public setDescuentoGlobalTipo(tipo: 'porcentaje' | 'monto'): void {
    this.descuentoGlobalTipo = tipo;
    this.descuentoGlobalValor = 0;
    this.descuentoGlobalError = null;
  }

  public setDescuentoGlobalValor(value: string | number): void {
    this.descuentoGlobalValor = this.toNumber(value);
    this.descuentoGlobalError = null;
  }

  public aplicarDescuentoGlobal(): void {
    if (this.locked) return;

    const valor = this.round(this.toNumber(this.descuentoGlobalValor));
    const subtotal = this.getDetalleSubtotalBase();
    const totalSinDescuento = this.getDetalleTotalSinDescuento();

    if (this.detalleArray.length === 0 || subtotal <= 0) {
      this.descuentoGlobalError = 'Agregue lineas con subtotal mayor a cero antes de aplicar descuento.';
      return;
    }

    if (valor < 0) {
      this.descuentoGlobalError = 'El descuento no puede ser negativo.';
      return;
    }

    this.descuentoGlobalSnapshot = this.detalleArray.controls.map((group) => {
      return this.toNumber(group.controls.porDescu.value);
    });

    if (this.descuentoGlobalTipo === 'porcentaje') {
      if (valor > 100) {
        this.descuentoGlobalError = 'El porcentaje no puede ser mayor a 100%.';
        return;
      }

      this.detalleArray.controls.forEach((group) => {
        this.setDetalleDescuentoFormatted(group, valor);
      });
    } else {
      if (valor > this.round(totalSinDescuento)) {
        this.descuentoGlobalError = 'El monto no puede superar el total del documento.';
        return;
      }

      this.detalleArray.controls.forEach((group) => {
        const lineTotal = this.getDetalleLineaTotalSinDescuento(group);
        const lineDiscountOnTotal = totalSinDescuento > 0 ? valor * (lineTotal / totalSinDescuento) : 0;
        const percent = this.getDetalleLineaPorcentajeDesdeDescuentoTotal(group, lineDiscountOnTotal);
        this.setDetalleDescuentoFormatted(group, percent);
      });
    }

    this.showDescuentoModal = false;
    this.descuentoGlobalError = null;
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  public revertirDescuentoGlobal(): void {
    if (this.locked || this.detalleArray.length === 0) return;

    const snapshot = this.descuentoGlobalSnapshot;
    this.detalleArray.controls.forEach((group, index) => {
      const previousValue = snapshot && snapshot.length === this.detalleArray.length
        ? snapshot[index] ?? 0
        : 0;
      this.setDetalleDescuentoFormatted(group, previousValue);
    });

    this.descuentoGlobalSnapshot = null;
    this.showDescuentoModal = false;
    this.descuentoGlobalError = null;
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  public abrirModalDescuentoLinea(index: number): void {
    if (this.locked) return;
    const group = this.detalleArray.at(index);
    if (!group) return;

    this.descuentoLineaIndex = index;
    this.descuentoLineaTipo = 'porcentaje';
    this.descuentoLineaValor = this.toNumber(group.controls.porDescu.value);
    this.descuentoLineaError = null;
    this.showDescuentoLineaModal = true;
    this.cdr.markForCheck();
  }

  public cerrarModalDescuentoLinea(): void {
    this.showDescuentoLineaModal = false;
    this.descuentoLineaError = null;
    this.descuentoLineaIndex = null;
    this.cdr.markForCheck();
  }

  public setDescuentoLineaTipo(tipo: 'porcentaje' | 'monto'): void {
    this.descuentoLineaTipo = tipo;
    this.descuentoLineaValor = 0;
    this.descuentoLineaError = null;
  }

  public setDescuentoLineaValor(value: string | number): void {
    this.descuentoLineaValor = this.toNumber(value);
    this.descuentoLineaError = null;
  }

  public aplicarDescuentoLinea(): void {
    if (this.locked) return;

    const group = this.getDescuentoLineaGroup();
    if (!group) {
      this.descuentoLineaError = 'Seleccione una linea valida para aplicar descuento.';
      return;
    }

    const valor = this.round(this.toNumber(this.descuentoLineaValor));
    const lineSubtotal = this.getDetalleLineaSubtotalBase(group);
    const lineTotal = this.getDetalleLineaTotalSinDescuento(group);

    if (lineSubtotal <= 0 || lineTotal <= 0) {
      this.descuentoLineaError = 'La linea debe tener subtotal mayor a cero.';
      return;
    }

    if (valor < 0) {
      this.descuentoLineaError = 'El descuento no puede ser negativo.';
      return;
    }

    if (this.descuentoLineaTipo === 'porcentaje') {
      if (valor > 100) {
        this.descuentoLineaError = 'El porcentaje no puede ser mayor a 100%.';
        return;
      }
      this.setDetalleDescuentoFormatted(group, valor);
    } else {
      if (valor > this.round(lineTotal)) {
        this.descuentoLineaError = 'El monto no puede superar el total de la linea.';
        return;
      }

      const percent = this.getDetalleLineaPorcentajeDesdeDescuentoTotal(group, valor);
      this.setDetalleDescuentoFormatted(group, percent);
    }

    this.showDescuentoLineaModal = false;
    this.descuentoLineaError = null;
    this.descuentoLineaIndex = null;
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  public quitarDescuentoLinea(): void {
    if (this.locked) return;

    const group = this.getDescuentoLineaGroup();
    if (!group) return;

    this.setDetalleDescuentoFormatted(group, 0);
    this.showDescuentoLineaModal = false;
    this.descuentoLineaError = null;
    this.descuentoLineaIndex = null;
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  public onReservaSeleccionada(selection: { codReserva: string; codAgencia: string }): void {
    this.showReservaModal = false;
    if (this.locked) return;
    this.cargarReservaDesdeSeleccion(selection);
  }

  public quitarReserva(): void {
    if (this.locked || this.reservaLoading) return;
    this.reservaActual = null;
    this.reservaLoading = false;
    this.reservaErrorMessage = null;
    this.form.controls.codReserva.setValue('', { emitEvent: false });
    this.setModoReserva(false);
    this.clearDetalle();
    this.cdr.markForCheck();
  }

  public onServicioSelected(servicio: ServicioListaPrecioItem): void {
    if (this.locked || this.modoReserva) return;
    this.showServicioModal = false;
    this.addDetalleFromServicio(servicio);
  }

  public onClienteSelected(cliente: ClienteUI): void {
    if (this.locked) return;
    this.selectedCliente = cliente;
    this.form.patchValue(
      {
        codCliente        : cliente.codigo,
        nomCliente        : cliente.nombre,
        rucCliente        : cliente.ruc,
        correoCliente     : cliente.email || '',
        codigoActividad   : this.formatCodigoActividadDisplay(cliente.codigoActividad),
      },
      { emitEvent: false }
    );
    this.syncTiposDocumentoCliente(cliente.enviarCorreo);
    this.cdr.markForCheck();
    this.clearClienteSearchResults();
  }

  public guardarNuevoCliente(): void {
    if (this.locked || this.nuevoClienteSaving) return;
    this.syncNuevoClienteActividadValidators();
    this.nuevoClienteForm.markAllAsTouched();
    if (this.nuevoClienteForm.invalid) {
      this.nuevoClienteError = 'Complete los campos requeridos antes de guardar el cliente.';
      this.cdr.markForCheck();
      return;
    }

    const raw = this.nuevoClienteForm.getRawValue();
    const nombre = (raw.nombreCli || '').toString().trim();
    const ruc = (raw.ruc || '').toString().trim();
    const email = (raw.email || '').toString().trim();
    const telefono1 = (raw.telefono1 || '').toString().trim();
    const enviarCorreo = !!raw.enviarCorreo;
    const codigoActividadRaw = this.normalizeCodigoAmhInput(raw.actividadCodigoAMH);
    const codigoActividad = this.formatCodigoActividadDisplay(codigoActividadRaw);
    const cliente = this.buildNuevoClienteUI({
      nombre,
      ruc,
      direccion: (raw.direccion || '').toString().trim(),
      email,
      telefono1,
      tCliente: (raw.tCliente || '').toString().trim(),
      enviarCorreo,
      codigoActividad: enviarCorreo ? codigoActividad : ''
    });
    const clientePayload = this.clienteService.buildPayloadFromUI(cliente, 1);
    const actividadPayload = this.actividadComercialService.buildPayload(
      {
        id: 0,
        cedula: ruc,
        codigoAMH: codigoActividadRaw,
        descripcion: (raw.actividadDescripcion || '').toString().trim(),
        principal: 1
      },
      1
    );

    this.nuevoClienteSaving = true;
    this.nuevoClienteError = null;
    this.clienteService
      .crearCliente(clientePayload)
      .pipe(
        switchMap((response) => {
          if (!enviarCorreo) {
            return of(response);
          }
          return this.actividadComercialService.crearActividad(actividadPayload).pipe(switchMap(() => of(response)));
        }),
        switchMap((response) => {
          const codigo = this.extractCodigoClienteFromResponse(response?.respuesta);
          if (codigo) {
            return this.clienteService.getClienteByCodigo(codigo).pipe(catchError(() => of(null)));
          }
          return of(null);
        }),
        switchMap((clientePorCodigo) => {
          if (clientePorCodigo) {
            return of(clientePorCodigo);
          }
          return this.clienteService.getClientes(1, 20, nombre).pipe(
            switchMap((response) => {
              const nuevoCliente =
                (response.data ?? []).find((item) => item.ruc.trim() === ruc) ??
                (response.data ?? []).find((item) => item.nombre.trim().toLowerCase() === nombre.toLowerCase()) ??
                null;
              return of(nuevoCliente);
            })
          );
        }),
        finalize(() => {
          this.nuevoClienteSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (clienteCreado) => {
          if (!clienteCreado) {
            this.nuevoClienteError = 'El cliente fue creado, pero no se pudo recuperar automaticamente. Busquelo por nombre o cedula.';
            return;
          }
          const clienteSeleccionable: ClienteUI = {
            ...clienteCreado,
            codigoActividad: this.formatCodigoActividadDisplay(clienteCreado.codigoActividad || (enviarCorreo ? codigoActividad : ''))
          };
          this.showNuevoClienteModal = false;
          this.onClienteSelected(clienteSeleccionable);
        },
        error: (error: unknown) => {
          this.nuevoClienteError = this.resolveErrorMessage(error, 'No se pudo crear el cliente.');
        }
      });
  }

  public onNuevoClienteRucInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const sanitized = (input?.value || '').replace(/\D/g, '');
    if (input && input.value !== sanitized) {
      input.value = sanitized;
    }
    this.nuevoClienteForm.controls.ruc.setValue(sanitized, { emitEvent: false });
  }

  public onNuevoClienteEmailBlur(): void {
    const normalized = (this.nuevoClienteForm.controls.email.value || '').toString().trim().toLowerCase();
    this.nuevoClienteForm.controls.email.setValue(normalized, { emitEvent: false });
    this.nuevoClienteForm.controls.email.updateValueAndValidity({ emitEvent: false });
  }

  public onNuevoClienteCodigoAmhInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const sanitized = this.normalizeCodigoAmhInput(input?.value);
    if (input && input.value !== sanitized) {
      input.value = sanitized;
    }
    this.nuevoClienteForm.controls.actividadCodigoAMH.setValue(sanitized, { emitEvent: false });
  }

  public limpiarSeleccionCliente(): void {
    if (this.locked) return;
    this.selectedCliente = null;
    this.form.patchValue(
      {
        codCliente          : '',
        nomCliente          : '',
        rucCliente          : '',
        correoCliente       : '',
        codigoActividad     : '',
      },
      { emitEvent: false }
    );
    this.syncTiposDocumentoCliente(null);
    this.cdr.markForCheck();
    this.clearClienteSearchResults();
  }

  private submitFactura(): void {
    if (!this.canConfirm) return;
    this.isSubmitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    const payload = this.buildPayload();
    console.log('POST Factura payload', payload);

    this.http
      .post<ConfirmarFacturaResponse>(this.apiUrl, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => this.handleSuccess(response),
        error: (error: HttpErrorResponse) => {
          this.errorMessage = error.error?.mensaje || error.error?.respuesta || error.message || 'No se pudo confirmar la factura.';
        }
      });
  }

  private handleSuccess(response: ConfirmarFacturaResponse): void {
    const serie = response?.serie ?? response?.data?.serie ?? '';
    const numero = response?.numero ?? response?.data?.numero ?? '';
    this.facturaSerie = serie;
    this.facturaNumero = numero;

    this.successMessage =
      response?.mensaje ||
      response?.respuesta ||
      'Factura confirmada correctamente.';

    this.locked = true;
    this.form.disable({ emitEvent: false });
    this.router.navigate(['/finanzas/consulta-documentos']);
  }

  private createDetalleGroup(orden: number): FormGroup<DetalleForm> {
    return this.fb.nonNullable.group({
      reglaPrecioId         : this.fb.nonNullable.control(0),
      orden                 : this.fb.nonNullable.control(orden),
      fechaConsumo          : this.fb.nonNullable.control(this.form.controls.fechaDocu.value),
      lstPrecio             : this.fb.nonNullable.control(this.form.controls.listaPrecio.value),
      planTarifa            : this.fb.nonNullable.control(this.form.controls.planTarifario.value),
      codProdu              : this.fb.nonNullable.control(''),
      areaProdu             : this.fb.nonNullable.control(''),
      descripcion           : this.fb.nonNullable.control(''),
      cantidad              : this.fb.nonNullable.control(1),
      uMedida               : this.fb.nonNullable.control(''),
      pUndLst               : this.fb.nonNullable.control(0),
      uniSinImp             : this.fb.nonNullable.control(0),
      porDescu              : this.fb.nonNullable.control<number | string>('0.00'),
      porImp                : this.fb.nonNullable.control(0),
      porExonera            : this.fb.nonNullable.control(0),
      mtoImpVarios          : this.fb.nonNullable.control(0),
      saldoPendiente        : this.fb.nonNullable.control(0),
      almacen               : this.fb.nonNullable.control(''),
      area                  : this.fb.nonNullable.control(''),
      tipComanda            : this.fb.nonNullable.control(''),
      comanda               : this.fb.nonNullable.control(''),
      pntVenta              : this.fb.nonNullable.control(this.form.controls.pntVenta.value),
      mozo                  : this.fb.nonNullable.control(''),
      numHabita             : this.fb.nonNullable.control('')
    });
  }

  private createPagoGroup(): FormGroup<PagoForm> {
    return this.fb.nonNullable.group({
      orden         : this.fb.nonNullable.control(0),
      frmPago       : this.fb.nonNullable.control(''),
      tipo          : this.fb.nonNullable.control(''),
      tCambio       : this.fb.nonNullable.control(this.form.controls.tCambio.value),
      monto         : this.fb.nonNullable.control<number | string>('0.00'),
      moneda        : this.fb.nonNullable.control(this.form.controls.moneda.value),
      referencia    : this.fb.nonNullable.control(''),
      numTarjeta    : this.fb.nonNullable.control(''),
      vencimiento   : this.fb.nonNullable.control('')
    });
  }

  private reindexDetalle(): void {
    this.detalleArray.controls.forEach((group, index) => {
      group.controls.orden.setValue(index + 1, { emitEvent: false });
    });
  }

  private addDetalleFromServicio(servicio: ServicioListaPrecioItem): void {
    const orden = this.detalleArray.length + 1;
    const group = this.createDetalleGroup(orden);
    group.patchValue(
      {
        reglaPrecioId     : Number(servicio.reglaPrecioId ?? 0) || 0,
        codProdu          : (servicio.codigoServicio || '').toString(),
        descripcion       : (servicio.nombreServicio || '').toString(),
        cantidad          : 1,
        pUndLst           : Number(servicio.precioUnitario ?? 0) || 0,
        uniSinImp         : Number(servicio.precioUnitario ?? 0) || 0,
        porDescu          : '0.00',
        porImp            : 0,
        fechaConsumo      : this.form.controls.fechaDocu.value,
        lstPrecio         : this.form.controls.listaPrecio.value,
        planTarifa        : this.form.controls.planTarifario.value,
        pntVenta          : this.form.controls.pntVenta.value
      },
      { emitEvent: false }
    );
    this.detalleArray.push(group);
    this.updateCalculos();
    this.cdr.markForCheck();
    this.focusCantidadInput(orden - 1);
  }

  private updateCalculos(): void {
    const lineas: LineaCalculo[] = [];
    const pricesIncludeTax = FISCAL_CONFIG.pricesIncludeTax;
    let resumenSubtotal = 0;
    let resumenDescuento = 0;
    let resumenNeto = 0;
    let resumenImpuesto = 0;
    let resumenTotal = 0;

    for (const group of this.detalleArray.controls) {
      const cantidad = this.toNumber(group.controls.cantidad.value);
      const precio = this.toNumber(group.controls.pUndLst.value);
      const porDescu = this.toNumber(group.controls.porDescu.value);
      const porImp = this.toNumber(group.controls.porImp.value);

      const subtotalBruto = cantidad * precio;
      const descuentoBruto = subtotalBruto * (porDescu / 100);
      const baseBruta = Math.max(0, subtotalBruto - descuentoBruto);
      const taxRate = (porImp > 0 ? porImp : 13) / 100;

      let subtotal: number;
      let descuento: number;
      let neto: number;
      let impuesto: number;
      let total: number;

      if (pricesIncludeTax && taxRate > 0) {
        // Precios incluyen impuestos: mostrar subtotal/descuento netos y conservar el total bruto.
        const factor = 1 + taxRate;
        subtotal = subtotalBruto / factor;
        descuento = descuentoBruto / factor;
        neto = baseBruta / factor;
        impuesto = baseBruta - neto;
        total = baseBruta;
      } else {
        subtotal = subtotalBruto;
        descuento = descuentoBruto;
        neto = baseBruta;
        impuesto = neto * taxRate;
        total = neto + impuesto;
      }

      const linea = {
        subtotal    : this.round(subtotal),
        descuento   : this.round(descuento),
        neto        : this.round(neto),
        impuesto    : this.round(impuesto),
        total       : this.round(total)
      };

      resumenSubtotal += linea.subtotal;
      resumenDescuento += linea.descuento;
      resumenNeto += linea.neto;
      resumenImpuesto += linea.impuesto;
      resumenTotal += linea.total;
      lineas.push(linea);
    }

    this.lineasCalculo.splice(0, this.lineasCalculo.length, ...lineas);

    this.resumen = {
      subtotal    : this.round(resumenSubtotal),
      descuento   : this.round(resumenDescuento),
      neto        : this.round(resumenNeto),
      impuesto    : this.round(resumenImpuesto),
      total       : this.round(resumenTotal)
    };

    this.enforceSinglePagoAutoMonto();

    this.pagosTotal = this.round(this.getPagosTotalInDocCurrency());

    if (!this.mostrarPagos) {
      this.pagosValid = true;
    } else {
      this.pagosValid = this.round(this.pagosTotal) === this.round(this.resumen.total);
    }

    this.syncPagoTipos();
    this.syncPuntoVentaLock();
  }

  private getDetalleSubtotalBase(): number {
    return this.detalleArray.controls.reduce((sum, group) => {
      return sum + this.getDetalleLineaSubtotalBase(group);
    }, 0);
  }

  private getDetalleTotalSinDescuento(): number {
    return this.detalleArray.controls.reduce((sum, group) => {
      return sum + this.getDetalleLineaTotalSinDescuento(group);
    }, 0);
  }

  private getDescuentoLineaGroup(): FormGroup<DetalleForm> | null {
    if (this.descuentoLineaIndex === null) {
      return null;
    }
    return this.detalleArray.at(this.descuentoLineaIndex) ?? null;
  }

  private getDetalleLineaSubtotalBase(group: FormGroup<DetalleForm>): number {
    const cantidad = this.toNumber(group.controls.cantidad.value);
    const precio = this.toNumber(group.controls.pUndLst.value);
    const subtotalBruto = cantidad * precio;

    if (!FISCAL_CONFIG.pricesIncludeTax) {
      return subtotalBruto;
    }

    const taxRate = this.getDetalleLineaTaxRate(group);
    return taxRate > 0 ? subtotalBruto / (1 + taxRate) : subtotalBruto;
  }

  private getDetalleLineaTotalSinDescuento(group: FormGroup<DetalleForm>): number {
    const cantidad = this.toNumber(group.controls.cantidad.value);
    const precio = this.toNumber(group.controls.pUndLst.value);
    const subtotalBruto = cantidad * precio;

    if (FISCAL_CONFIG.pricesIncludeTax) {
      return subtotalBruto;
    }

    return subtotalBruto * (1 + this.getDetalleLineaTaxRate(group));
  }

  private getDetalleLineaPorcentajeDesdeDescuentoTotal(
    group: FormGroup<DetalleForm>,
    descuentoTotal: number
  ): number {
    const cantidad = this.toNumber(group.controls.cantidad.value);
    const precio = this.toNumber(group.controls.pUndLst.value);
    const subtotalBruto = cantidad * precio;

    if (subtotalBruto <= 0) {
      return 0;
    }

    if (FISCAL_CONFIG.pricesIncludeTax) {
      return (descuentoTotal / subtotalBruto) * 100;
    }

    const descuentoSubtotal = descuentoTotal / (1 + this.getDetalleLineaTaxRate(group));
    return (descuentoSubtotal / subtotalBruto) * 100;
  }

  private getDetalleLineaTaxRate(group: FormGroup<DetalleForm>): number {
    const porImp = this.toNumber(group.controls.porImp.value);
    return (porImp > 0 ? porImp : 13) / 100;
  }

  private getDocCurrency(): string {
    return ((this.form.controls.moneda.value ?? 'USD').toString().trim().toUpperCase()) || 'USD';
  }

  private getVentaTipoCambio(): number {
    const valor = this.tipoCambioMostrar;
    return valor > 0 ? valor : 0;
  }

  private convertAmountToDocCurrency(amount: number, currency: string): number {
    if (!amount) {
      return 0;
    }
    const paymentCurrency = (currency ?? '').toString().trim().toUpperCase();
    const docCurrency = this.getDocCurrency();
    if (!paymentCurrency || paymentCurrency === docCurrency) {
      return amount;
    }
    const rate = this.getVentaTipoCambio();
    if (!rate) {
      return amount;
    }
    if (docCurrency === 'USD') {
      return amount / rate;
    }
    if (paymentCurrency === 'USD') {
      return amount * rate;
    }
    return amount;
  }

  private convertAmountFromDocCurrency(amount: number, currency: string): number {
    if (!amount) {
      return 0;
    }
    const paymentCurrency = (currency ?? '').toString().trim().toUpperCase();
    const docCurrency = this.getDocCurrency();
    if (!paymentCurrency || paymentCurrency === docCurrency) {
      return amount;
    }
    const rate = this.getVentaTipoCambio();
    if (!rate) {
      return amount;
    }
    if (docCurrency === 'USD') {
      return amount * rate;
    }
    if (paymentCurrency === 'USD') {
      return amount / rate;
    }
    return amount;
  }

  private getPagosTotalInDocCurrency(): number {
    return this.pagosArray.controls.reduce((sum, group) => {
      const monto = this.toNumber(group.controls.monto.value);
      return sum + this.convertAmountToDocCurrency(monto, group.controls.moneda.value);
    }, 0);
  }

  private getPendingAmountForNewPago(): number {
    const pending = this.resumen.total - this.getPagosTotalInDocCurrency();
    return pending > 0 ? pending : 0;
  }

  private populatePagoPendingAmount(group: FormGroup<PagoForm>, pendingAmount: number): void {
    const currency = group.controls.moneda.value;
    const monto = this.convertAmountFromDocCurrency(pendingAmount, currency);
    this.setPagoMontoFormatted(group, monto);
  }

  private enforceSinglePagoAutoMonto(): void {
    if (this.pagosArray.length !== 1) {
      this.singlePagoAutoMonto = null;
      return;
    }
    const group = this.pagosArray.controls[0];
    const currency = group.controls.moneda.value;
    const currentMonto = this.round(this.toNumber(group.controls.monto.value));
    const autoMonto = this.round(this.convertAmountFromDocCurrency(this.resumen.total, currency));
    if (this.singlePagoAutoMonto === null || this.singlePagoAutoMonto === currentMonto) {
      this.setPagoMontoFormatted(group, autoMonto);
      this.singlePagoAutoMonto = autoMonto;
    }
  }

  private setPagoMontoFormatted(group: FormGroup<PagoForm>, amount: number): void {
    const rounded = this.round(amount);
    group.controls.monto.setValue(this.formatAmountWithThousands(rounded), { emitEvent: false });
  }

  private setDetalleDescuentoFormatted(group: FormGroup<DetalleForm>, percent: number): void {
    const bounded = Math.min(Math.max(0, this.round(percent)), 100);
    group.controls.porDescu.setValue(bounded.toFixed(2), { emitEvent: false });
  }

  private cargarMonedas(): void {
    this.monedasLoading = true;
    this.monedaService
      .getAll()
      .pipe(
        finalize(() => {
          this.monedasLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.monedas = res ?? [];
          const current = this.form.controls.moneda.value;
          const exists = this.monedas.some((item) => item.codMoneda === current);
          if (!current || !exists) {
            const nextValue = this.monedas[0]?.codMoneda ?? '';
            if (nextValue) {
              this.form.controls.moneda.setValue(nextValue, { emitEvent: false });
            }
          }
          this.syncPagosDefaults();
        },
        error: () => {
          this.monedas = [];
        }
      });
  }

  private cargarPuntosVenta(): void {
    this.puntosVentaLoading = true;
    this.usuarioService
      .getPuntosVenta()
      .pipe(
        finalize(() => {
          this.puntosVentaLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.puntosVenta = res ?? [];
          const current = this.form.controls.pntVenta.value;
          const exists = this.puntosVenta.some((pv) => pv.codigo === current);
          if (!current || !exists) {
            const nextValue = this.puntosVenta[0]?.codigo ?? '';
            if (nextValue) {
              this.form.controls.pntVenta.setValue(nextValue, { emitEvent: false });
            }
          }
        },
        error: () => {
          this.puntosVenta = [];
        }
      });
  }

  private cargarFormasPago(): void {
    this.formasPagoLoading = true;
    this.formaPagoService
      .getAll()
      .pipe(
        finalize(() => {
          this.formasPagoLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.formasPago = (res ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          this.syncPagosDefaults();
        },
        error: () => {
          this.formasPago = [];
        }
      });
  }

  private cargarPlanesTarifarios(): void {
    this.planesTarifariosLoading = true;
    this.planesTarifasService
      .getPlanesTarifas(1, 50)
      .pipe(
        finalize(() => {
          this.planesTarifariosLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.planesTarifarios = res ?? [];
          const current = this.form.controls.planTarifario.value;
          const exists = this.planesTarifarios.some((plan) => String(plan.planId) === String(current));
          if (!current || !exists) {
            const nextValue = this.planesTarifarios[0]?.planId;
            if (nextValue !== undefined) {
              this.form.controls.planTarifario.setValue(String(nextValue), { emitEvent: false });
            }
          }
          this.syncDetalleCatalogCodes();
        },
        error: () => {
          this.planesTarifarios = [];
        }
      });
  }

  private cargarListasPrecio(): void {
    this.listasPrecioLoading = true;
    this.listaPrecioService
      .getListas({ pageNumber: 1, pageSize: 10 })
      .pipe(
        finalize(() => {
          this.listasPrecioLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          this.listasPrecio = res?.data ?? [];
          const current = this.form.controls.listaPrecio.value;
          const exists = this.listasPrecio.some((lista) => String(lista.codigo) === String(current));
          if (!current || !exists) {
            const nextValue = this.listasPrecio[0]?.codigo ?? '';
            if (nextValue) {
              this.form.controls.listaPrecio.setValue(nextValue, { emitEvent: false });
              this.previousListaPrecio = nextValue;
            }
          } else {
            this.previousListaPrecio = (current || '').toString();
          }
          this.syncDetalleCatalogCodes();
        },
        error: () => {
          this.listasPrecio = [];
        }
      });
  }

  private onListaPrecioChange(nextValue: string): void {
    if (this.suppressListaPrecioChange) {
      this.suppressListaPrecioChange = false;
      return;
    }

    const next = (nextValue || '').toString().trim();

    if (!this.previousListaPrecio) {
      this.previousListaPrecio = next;
      return;
    }

    if (next === this.previousListaPrecio) {
      return;
    }

    if (this.detalleArray.length > 0) {
      const confirmed = window.confirm(
        'Cambiar la lista de precios eliminará las líneas actuales. ¿Desea continuar?'
      );
      if (!confirmed) {
        this.suppressListaPrecioChange = true;
        this.form.controls.listaPrecio.setValue(this.previousListaPrecio, { emitEvent: false });
        return;
      }
      this.clearDetalle();
    }

    this.previousListaPrecio = next;
  }

  private clearDetalle(): void {
    this.detalleArray.clear();
    this.lineasCalculo.splice(0, this.lineasCalculo.length);
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  private cargarReservaDesdeSeleccion(selection: { codReserva: string; codAgencia: string }): void {
    const codReserva = (selection?.codReserva ?? '').toString().trim();
    const codAgencia = (selection?.codAgencia ?? '').toString().trim();
    if (!codReserva) {
      return;
    }

    this.reservaLoading = true;
    this.reservaErrorMessage = null;
    this.cdr.markForCheck();

    forkJoin({
      detalle: this.reservasFacturacionService.getDetalle(codReserva),
      cliente: this.clienteService.getClienteByCodigo(codAgencia)
      
    })
      .pipe(
        finalize(() => {
          this.reservaLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ detalle, cliente }) => {
          this.reservaActual = codReserva;
          this.form.controls.codReserva.setValue(codReserva, { emitEvent: false });
          this.aplicarClienteReserva(cliente, codAgencia);
          this.aplicarCatalogosReserva(detalle ?? []);
          this.setModoReserva(true);
          this.aplicarDetalleReserva(detalle ?? []);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.reservaErrorMessage =
            error instanceof Error ? error.message : 'No se pudo cargar la reserva seleccionada.';
          this.cdr.markForCheck();
        }
      });
  }

  private initReservaFromQuery(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const codReserva = (params.get('codReserva') ?? '').toString().trim();
      const codAgencia = (params.get('codAgencia') ?? '').toString().trim();

      if (!codReserva || this.locked) {
        return;
      }

      if (this.modoReserva && this.reservaActual === codReserva) {
        return;
      }

      if (codAgencia) {
        this.cargarReservaDesdeSeleccion({ codReserva, codAgencia });
        return;
      }

      this.reservaLoading = true;
      this.reservaErrorMessage = null;
      this.cdr.markForCheck();

      this.reservasService
        .getReservaByCod(codReserva)
        .pipe(
          finalize(() => {
            this.reservaLoading = false;
            this.cdr.markForCheck();
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (reserva) => {
            const agencia = (reserva?.PRV01_CodAgencia ?? '').toString().trim();
            if (!agencia) {
              this.reservaErrorMessage = 'No se pudo determinar el código de agencia para facturar.';
              this.cdr.markForCheck();
              return;
            }
            this.cargarReservaDesdeSeleccion({ codReserva, codAgencia: agencia });
          },
          error: (error: unknown) => {
            this.reservaErrorMessage =
              error instanceof Error ? error.message : 'No se pudo cargar la reserva seleccionada.';
            this.cdr.markForCheck();
          }
        });
    });
  }

  private aplicarClienteReserva(cliente: ClienteUI | null, codAgencia: string): void {
    if (cliente) {
      this.selectedCliente = cliente;
      this.form.patchValue(
        {
          codCliente        : cliente.codigo,
          nomCliente        : cliente.nombre,
          rucCliente        : cliente.ruc,
          correoCliente     : cliente.email || '',
          codigoActividad   : this.formatCodigoActividadDisplay(cliente.codigoActividad),

        },
        { emitEvent: false }
      );
    } else {
      this.selectedCliente = null;
      this.form.patchValue(
        {
          codCliente        : codAgencia,
          nomCliente        : '',
          rucCliente        : '',
          correoCliente     : '',
          codigoActividad   : ''

        },
        { emitEvent: false }
      );
    }
 
    this.setClienteEditable(true);
    this.syncTiposDocumentoCliente(cliente?.enviarCorreo ?? null);
    this.clearClienteSearchResults();
  }

  private searchClientes(query: string): void {
    this.clienteSearchLoading = true;
    this.clienteSearchError = null;
    this.clienteSearchResults = [];

    this.clienteService
      .getClientes(1, 6, query)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.clienteSearchLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          const resultados = response.data ?? [];
          const queryNormalizado = query.trim().toLowerCase();
          const coincidenciasExactas = resultados.filter(
            (cliente) => cliente.codigo.trim().toLowerCase() === queryNormalizado
          );

          if (coincidenciasExactas.length === 1) {
            this.onClienteSelected(coincidenciasExactas[0]);
            return;
          }

          this.clienteSearchResults = resultados;
        },
        error: (error: unknown) => {
          this.clienteSearchError =
            error instanceof Error ? error.message : 'No se pudo buscar clientes.';
        }
      });
  }

  private clearClienteSearchResults(): void {
    this.clienteSearchResults = [];
    this.clienteSearchLoading = false;
    this.clienteSearchError = null;
  }

  private resetNuevoClienteForm(): void {
    this.nuevoClienteForm.reset(
      {
        nombreCli: '',
        ruc: '',
        direccion: '',
        email: '',
        telefono1: '',
        tCliente: this.tipoClienteOptions[0]?.value?.toString() || '',
        enviarCorreo: false,
        actividadCodigoAMH: '',
        actividadDescripcion: ''
      },
      { emitEvent: false }
    );
    this.syncNuevoClienteActividadValidators();
  }

  private loadTipoIdentificacionOptionsParaNuevoCliente(): void {
    if (this.tipoClienteOptions.length || this.tipoClienteOptionsLoading) {
      return;
    }
    this.tipoClienteOptionsLoading = true;
    this.clienteService
      .getTipoIdentificacionOptions()
      .pipe(
        finalize(() => {
          this.tipoClienteOptionsLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (options) => {
          this.tipoClienteOptions = options ?? [];
          const current = this.nuevoClienteForm.controls.tCliente.value;
          if (!current && this.tipoClienteOptions[0]?.value) {
            this.nuevoClienteForm.controls.tCliente.setValue(this.tipoClienteOptions[0].value.toString(), { emitEvent: false });
          }
        },
        error: () => {
          this.tipoClienteOptions = [];
        }
      });
  }

  private syncNuevoClienteActividadValidators(): void {
    const requiereActividad = !!this.nuevoClienteForm.controls.enviarCorreo.value;
    const codigoControl = this.nuevoClienteForm.controls.actividadCodigoAMH;
    const descripcionControl = this.nuevoClienteForm.controls.actividadDescripcion;
    if (requiereActividad) {
      codigoControl.setValidators([Validators.required, Validators.pattern(/^(?=.*\d)[0-9.]+$/)]);
      descripcionControl.setValidators([Validators.required]);
    } else {
      codigoControl.clearValidators();
      descripcionControl.clearValidators();
      codigoControl.setValue('', { emitEvent: false });
      descripcionControl.setValue('', { emitEvent: false });
    }
    codigoControl.updateValueAndValidity({ emitEvent: false });
    descripcionControl.updateValueAndValidity({ emitEvent: false });
  }

  private normalizeCodigoAmhInput(value: string | null | undefined): string {
    return (value ?? '').toString().replace(/[^0-9.]/g, '');
  }

  private buildNuevoClienteUI(value: {
    nombre: string;
    ruc: string;
    direccion: string;
    email: string;
    telefono1: string;
    tCliente: string;
    enviarCorreo: boolean;
    codigoActividad: string;
  }): ClienteUI {
    const contacto = {
      id: 0,
      nomContacto: value.nombre,
      cargo: '',
      email: value.email,
      telefono1: value.telefono1,
      telefono2: '',
      movil: value.telefono1,
      ext: '',
      principal: true,
      activo: true,
      observacion: '',
      accion: 'I',
      operador: this.getOperador(),
      fechaRegistro: null
    };

    return {
      codigo: '',
      nombre: value.nombre,
      ruc: value.ruc,
      contacto: value.nombre,
      nombreContacto: value.nombre,
      contactoPrincipal: value.nombre,
      emailPrincipal: value.email,
      telefonoPrincipal: value.telefono1,
      cargoPrincipal: '',
      direccion: value.direccion,
      provincia: '',
      ciudad: '',
      pais: '',
      zona: '',
      email: value.email,
      telefono1: value.telefono1,
      telefono2: '',
      fax: '',
      tipoCli: 'AGE',
      mtoCredito: 0,
      idProvincia: '',
      idCanton: '',
      idDistrito: '',
      tCliente: value.tCliente,
      enviarCorreo: value.enviarCorreo,
      totalContactos: 1,
      contactos: [contacto],
      operador: this.getOperador(),
      codigoActividad: value.codigoActividad,
      nombreActividad: ''
    };
  }

  private extractCodigoClienteFromResponse(respuesta: string | undefined): string {
    const text = (respuesta || '').toString().trim();
    if (!text) {
      return '';
    }
    const explicitMatch = /(?:codigo|cliente)\s*[:=]\s*([A-Za-z0-9_-]+)/i.exec(text);
    if (explicitMatch?.[1]) {
      return explicitMatch[1].trim();
    }
    return /^[A-Za-z0-9_-]{1,20}$/.test(text) ? text : '';
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      if (typeof body === 'string' && body.trim()) {
        return body.trim();
      }
      return body?.mensaje || body?.respuesta || error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  }

  private aplicarDetalleReserva(detalles: ReservaPendienteDetalle[]): void {
    this.detalleArray.clear();
    this.lineasCalculo.splice(0, this.lineasCalculo.length);

    detalles
      .filter((item) => this.toNumber(item.saldoPendiente) > 0)
      .forEach((item, index) => {
        const saldo = this.toNumber(item.saldoPendiente);
        const subTotal = this.toNumber(item.subTotal);
        const neto = this.toNumber(item.neto);
        const impuestoMonto = this.toNumber(item.impuesto);
        const porImp = neto > 0 ? (impuestoMonto / neto) * 100 : 0;
        const precioBase = this.getReservaPrecioBaseParaFactura(item, porImp);
        const precioUnitario = saldo > 0 ? Number((precioBase / saldo).toFixed(6)) : 0;

        const group = this.createDetalleGroup(index + 1);
        group.patchValue(
          {
            codProdu        : (item.codServicio || '').toString(),
            descripcion     : (item.nomServicio || '').toString(),
            areaProdu       : (item.codGrupo || '').toString(),
            area            : (item.codGrupo || '').toString(),
            uMedida         : (item.uMedida || '').toString(),
            cantidad        : saldo,
            pUndLst         : precioUnitario,
            uniSinImp       : saldo > 0 ? Number((subTotal / saldo).toFixed(6)) : 0,
            porDescu        : this.round(this.toNumber(item.porDescuento)).toFixed(2),
            porImp          : this.round(porImp),
            comanda         : (item.id ?? '').toString(),
            saldoPendiente  : saldo,
            fechaConsumo    : this.form.controls.fechaDocu.value,
            lstPrecio       : (item.codLstPrecio || this.form.controls.listaPrecio.value || '').toString(),
            planTarifa      : (item.planTarifario || this.form.controls.planTarifario.value || '').toString(),
            pntVenta        : this.form.controls.pntVenta.value
          },
          { emitEvent: false }
        );

        const validators = [Validators.required, Validators.min(0.01)];
        if (saldo > 0) {
          validators.push(Validators.max(saldo));
        }
        group.controls.cantidad.setValidators(validators);
        group.controls.cantidad.updateValueAndValidity({ emitEvent: false });

        this.detalleArray.push(group);
      });

    this.reindexDetalle();
    this.updateCalculos();
    this.cdr.markForCheck();
  }

  private getReservaPrecioBaseParaFactura(item: ReservaPendienteDetalle, porImp: number): number {
    const subTotal = this.toNumber(item.subTotal);
    if (!FISCAL_CONFIG.pricesIncludeTax) {
      return subTotal;
    }

    const taxRate = porImp > 0 ? porImp / 100 : FISCAL_CONFIG.taxRate;
    return subTotal * (1 + taxRate);
  }

  private setModoReserva(active: boolean): void {
    this.modoReserva = active;
    this.setClienteEditable(true);
    this.setPlanTarifarioEditable(!active);
    this.setListaPrecioEditable(!active);
  }

  private setClienteEditable(enabled: boolean): void {
    const controls = [
      this.form.controls.codCliente,
      this.form.controls.nomCliente,
      this.form.controls.rucCliente,
      this.form.controls.correoCliente,
      this.form.controls.codigoActividad
    ];

    controls.forEach((control) => {
      if (enabled && control.disabled) {
        control.enable({ emitEvent: false });
      }
      if (!enabled && control.enabled) {
        control.disable({ emitEvent: false });
      }
    });
  }

  private setListaPrecioEditable(enabled: boolean): void {
    const control = this.form.controls.listaPrecio;
    if (enabled && control.disabled) {
      control.enable({ emitEvent: false });
    }
    if (!enabled && control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private setPlanTarifarioEditable(enabled: boolean): void {
    const control = this.form.controls.planTarifario;
    if (enabled && control.disabled) {
      control.enable({ emitEvent: false });
    }
    if (!enabled && control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private focusCantidadInput(index: number): void {
    setTimeout(() => {
      const input = this.cantidadInputs?.get(index)?.nativeElement;
      input?.focus();
      input?.select();
    }, 0);
  }

  get modoPrecioSeleccionado(): ModoPrecio {
    const planId = Number(this.form.controls.planTarifario.value ?? 0) || 0;
    const plan = (this.planesTarifarios ?? []).find((item) => Number(item?.planId ?? 0) === planId);
    const tipo = (plan?.tipoTarifa || '').toString().trim().toUpperCase();
    return tipo === 'N' ? 'N' : 'R';
  }

  get tipoCambioMostrar(): number {
    return this.tipoCambioActual?.venta ?? this.form.controls.tCambio.value ?? 0;
  }

  private cargarTiposDocumento(): void {
    this.tiposDocumentoLoading = true;
    const params = new HttpParams().set('venta', '1').set('docu', '1');

    this.http
      .get<DocumentoDto[] | DocumentoDto | { datos?: DocumentoDto[] }>(
        `${environment.apiUrl}/documento/venta-docu`,
        { params }
      )
      .pipe(
        finalize(() => {
          this.tiposDocumentoLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => {
          const dataArray = Array.isArray(res)
            ? res
            : Array.isArray((res as { datos?: DocumentoDto[] })?.datos)
              ? (res as { datos?: DocumentoDto[] }).datos ?? []
              : res
                ? [res as DocumentoDto]
                : [];

          this.tiposDocumentoBase = dataArray ?? [];
          this.refreshTiposDocumentoPorCorreo(this.selectedCliente?.enviarCorreo ?? null);
        },
        error: () => {
          this.tiposDocumento = [];
        }
    });
  }

  private syncTiposDocumentoCliente(enviarCorreo: boolean | number | string | null | undefined): void {
    if (this.tiposDocumentoBase.length) {
      this.refreshTiposDocumentoPorCorreo(enviarCorreo);
      return;
    }
    this.cargarTiposDocumento();
  }

  private refreshTiposDocumentoPorCorreo(enviarCorreo: boolean | number | string | null | undefined = null): void {

  
    if (!this.tiposDocumentoBase.length) {
      this.tiposDocumento = [];
      return;
    }
    const envioCorreoNormalizado = this.normalizeEnviarCorreo(enviarCorreo);
    if (envioCorreoNormalizado === null) {
      this.tiposDocumento = [...this.tiposDocumentoBase];
      this.ensureTipoDocumentoSeleccionado();
      return;
    }

    const preferCode = envioCorreoNormalizado ? '01' : '04';
    const preferidoPorFe = this.tiposDocumentoBase.filter((item) => this.resolveTipoDocumentoFe(item) === preferCode);

    if (preferidoPorFe.length) {
      this.tiposDocumento = [...preferidoPorFe];
      this.ensureTipoDocumentoSeleccionado();
      return;
    }

    this.tiposDocumento = [...this.tiposDocumentoBase];
    this.ensureTipoDocumentoSeleccionado();
  }

  private resolveTipoDocumentoFe(doc: DocumentoDto): string {
    const raw = (doc as DocumentoDto & { CA404_TDocFE?: string; CA04_TDocFE?: string; tDocFE?: string });
    return (
      (raw.CA404_TDocFE ?? raw.CA04_TDocFE ?? raw.tDocFE ?? '')
        .toString()
        .trim()
    );
  }

  private normalizeEnviarCorreo(value: boolean | number | string | null | undefined): boolean | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized === '1' || normalized === 'true') {
      return true;
    }
    if (normalized === '0' || normalized === 'false') {
      return false;
    }
    return null;
  }

  private ensureTipoDocumentoSeleccionado(): void {
    if (!this.tiposDocumento.length) {
      return;
    }
    const current = this.form.controls.tipDocu.value;
    const exists = this.tiposDocumento.some((doc) => doc.CA04_CodDocu === current);
    if (current && exists) {
      return;
    }
    const nextValue = this.tiposDocumento[0]?.CA04_CodDocu ?? '';
    if (nextValue) {
      this.form.controls.tipDocu.setValue(nextValue, { emitEvent: false });
    }
  }

  private loadTipoCambio(): void {
    const fechaParam = this.buildFechaParaTipoCambio(this.form.controls.fechaDocu.value);
    const moneda = (this.form.controls.moneda.value || '').toString().trim();
    if (!fechaParam || !moneda) {
      this.tipoCambioActual = null;
      return;
    }

    this.tipoCambioLoading = true;
    this.tipoCambioError = null;

    console.log('Cargando tipo de cambio para', { fecha: fechaParam, moneda });

    this.tipoCambioService
      .fetchTipoCambio(fechaParam, moneda)
      .pipe(
        finalize(() => {
          this.tipoCambioLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.tipoCambioActual = items[0] ?? null;
          const valor = this.tipoCambioActual?.venta ?? this.form.controls.tCambio.value;
          if (valor !== null && valor !== undefined) {
            this.form.controls.tCambio.setValue(valor, { emitEvent: false });
          }

          console.log('Tipo de cambio cargado', this.tipoCambioActual);

        },
        error: (error: unknown) => {
          this.tipoCambioError =
            error instanceof Error ? error.message : 'No se pudo cargar el tipo de cambio.';
          this.tipoCambioActual = null;
        }
      });
  }

  private buildFechaParaTipoCambio(value: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) {
      const today = new Date();
      const day = `${today.getDate()}`.padStart(2, '0');
      const month = `${today.getMonth() + 1}`.padStart(2, '0');
      const year = today.getFullYear();
      return `${day}/${month}/${year}`;
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
      return trimmed;
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    return trimmed;
  }

  private buildPayload(): ConfirmarFacturaPayload {
    const value = this.form.getRawValue();
    const fechaDocu = this.formatDateForSql(value.fechaDocu);
    const detalle = this.detalleArray.controls.map((group, index) => {
      const raw = group.getRawValue();
      return {
        orden           : index + 1,
        fechaConsumo    : this.formatDateForSql(raw.fechaConsumo || value.fechaDocu),
        codProdu        : raw.codProdu,
        areaProdu       : raw.areaProdu,
        descripcion     : raw.descripcion,
        cantidad        : this.toNumber(raw.cantidad),
        uMedida         : raw.uMedida,
        pUndLst         : this.toNumber(raw.pUndLst),
        uniSinImp       : this.toNumber(raw.uniSinImp || raw.pUndLst),
        porDescu        : this.toNumber(raw.porDescu),
        porImp          : this.toNumber(raw.porImp),
        porExonera      : this.toNumber(raw.porExonera),
        mtoImpVarios    : this.toNumber(raw.mtoImpVarios),
        almacen         : raw.almacen,
        area            : raw.area,
        tipComanda      : raw.tipComanda,
        comanda         : raw.comanda,
        pntVenta        : value.pntVenta,
        mozo            : raw.mozo,
        numHabita       : raw.numHabita,
        lstPrecio       : (raw.lstPrecio || value.listaPrecio || '').toString(),
        planTarifa      : (raw.planTarifa || value.planTarifario || '').toString()
      };
    });

    const pagos = this.mostrarPagos
      ? this.pagosArray.controls.map((group, index) => {
          const raw = group.getRawValue();
          return {
            orden         : index + 1,
            frmPago       : raw.frmPago,
            tipo          : raw.tipo,
            moneda        : raw.moneda,
            monto         : this.toNumber(raw.monto),
            tCambio       : this.toNumber(raw.tCambio || value.tCambio),
            referencia    : raw.referencia,
            numTarjeta    : raw.numTarjeta,
            vencimiento   : this.normalizeCardExpiry(raw.vencimiento)
          };
        })
      : [];

    return {
      tipDocu           : value.tipDocu,
      codCliente        : value.codCliente,
      rucCliente        : value.rucCliente,
      nomCliente        : value.nomCliente,
      condicionVenta    : value.condicionVenta,
      codReserva        : value.codReserva,
      fechaInicio       : this.formatDateForSql(value.fechaInicio),
      fechaFin          : this.formatDateForSql(value.fechaFin),
      voucherRsv        : value.voucherRsv,
      nProveedor        : value.nProveedor,
      habitacion        : value.habitacion,
      master            : value.master,
      fechaDocu         ,
      pntVenta          : value.pntVenta,
      numMesa           : value.numMesa,
      numPax            : this.toNumber(value.numPax),
      codVendedor       : value.codVendedor,
      moneda            : value.moneda,
      tCambio           : this.toNumber(value.tCambio),
      codigoActividad   : this.normalizeCodigoActividad(value.codigoActividad),
      observacion       : value.observacion,
      operador          : value.operador,
      detalle           ,
      pagos             ,
      respuesta         : value.respuesta,
      serie             : value.serie,
      numero            : value.numero
    };
  }

  private toNumber(value: number | string): number {
    if (typeof value === 'string') {
      const sanitized = value.replace(/,/g, '').trim();
      if (!sanitized) {
        return 0;
      }
      const parsed = Number(sanitized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatAmountWithThousands(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private normalizeCardExpiry(value: string | null | undefined): string {
    const raw = (value ?? '').toString().trim();
    if (!raw) {
      return '';
    }

    const compact = raw.replace(/\s+/g, '');
    const match = /^(\d{1,2})[\/-]?(\d{2}|\d{4})$/.exec(compact);
    if (!match) {
      return '';
    }

    const month = Number(match[1]);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return '';
    }

    const monthText = String(month).padStart(2, '0');
    const yearText = match[2].length === 2 ? `20${match[2]}` : match[2];
    return `${monthText}/${yearText}`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundPercent(value: number): number {
    return Math.round(value * 1000000) / 1000000;
  }

  private normalizeCodigoActividad(value: string | null | undefined): string {
    const normalized = (value ?? '').toString().trim();
    if (!normalized) {
      return '000000';
    }

    const digitsOnly = normalized.replace(/\D/g, '');
    if (digitsOnly.length >= 1 && digitsOnly.length <= 6) {
      return digitsOnly.padStart(6, '0');
    }

    return '000000';
  }

  private formatCodigoActividadDisplay(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private formatDateForSql(value: string): string {
    const trimmed = (value || '').toString().trim();
    if (!trimmed) return '';

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return trimmed;
  }

  private syncPuntoVentaLock(): void {
    const shouldLock = this.locked || this.detalleArray.length > 0;
    const control = this.form.controls.pntVenta;
    if (shouldLock && control.enabled) {
      control.disable({ emitEvent: false });
      return;
    }
    if (!shouldLock && control.disabled) {
      control.enable({ emitEvent: false });
    }
  }

  private syncDetalleCatalogCodes(): void {
    if (this.modoReserva) {
      return;
    }

    const lstPrecio = (this.form.controls.listaPrecio.value || '').toString();
    const planTarifa = (this.form.controls.planTarifario.value || '').toString();

    this.detalleArray.controls.forEach((group) => {
      if (group.controls.lstPrecio.value !== lstPrecio) {
        group.controls.lstPrecio.setValue(lstPrecio, { emitEvent: false });
      }
      if (group.controls.planTarifa.value !== planTarifa) {
        group.controls.planTarifa.setValue(planTarifa, { emitEvent: false });
      }
    });
  }

  private aplicarCatalogosReserva(detalles: ReservaPendienteDetalle[]): void {
    const primerDetalle = detalles.find((item) => (item.codLstPrecio || item.planTarifario || '').toString().trim());
    if (!primerDetalle) {
      return;
    }

    const lstPrecio = (primerDetalle.codLstPrecio || '').toString().trim();
    const planTarifario = (primerDetalle.planTarifario || '').toString().trim();

    if (lstPrecio) {
      this.form.controls.listaPrecio.setValue(lstPrecio, { emitEvent: false });
      this.previousListaPrecio = lstPrecio;
    }

    if (planTarifario) {
      this.form.controls.planTarifario.setValue(planTarifario, { emitEvent: false });
    }
  }

  private syncPagoTipos(): void {
    if (!this.formasPago.length) return;
    this.pagosArray.controls.forEach((group) => {
      const codigo = group.controls.frmPago.value;
      const tipo = this.formasPago.find((fp) => fp.codigo === codigo)?.tipoPago ?? '';
      if (group.controls.tipo.value !== tipo) {
        group.controls.tipo.setValue(tipo, { emitEvent: false });
      }
    });
  }

  private syncPagosDefaults(): void {
    const defaultFrmPago = this.formasPago[0]?.codigo ?? '';
    const headerMoneda = this.form.controls.moneda.value;
    const defaultMoneda =
      this.monedas.find((item) => item.codMoneda === headerMoneda)?.codMoneda ??
      this.monedas[0]?.codMoneda ??
      headerMoneda ??
      '';

    this.pagosArray.controls.forEach((group) => {
      const frmPago = group.controls.frmPago.value;
      if (defaultFrmPago && (!frmPago || !this.formasPago.some((fp) => fp.codigo === frmPago))) {
        group.controls.frmPago.setValue(defaultFrmPago, { emitEvent: false });
      }

      const moneda = group.controls.moneda.value;
      if (defaultMoneda && (!moneda || !this.monedas.some((m) => m.codMoneda === moneda))) {
        group.controls.moneda.setValue(defaultMoneda, { emitEvent: false });
      }

      this.pagoMonedaAnterior.set(group, group.controls.moneda.value);
    });

    this.syncPagoTipos();
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
