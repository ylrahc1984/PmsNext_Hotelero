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
import { forkJoin } from 'rxjs';
import { distinctUntilChanged, finalize, startWith, debounceTime } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
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

  readonly lineasCalculo: LineaCalculo[] = [];
  resumen                   : TotalesResumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };

  mostrarPagos              = true;
  pagosTotal                = 0;
  pagosValid                = true;

  selectedCliente           : ClienteUI | null = null;
  clienteSearchResults      : ClienteUI[] = [];
  clienteSearchLoading      = false;
  clienteSearchError        : string | null = null;
  showClienteModal          = false;
  showServicioModal         = false;
  showReservaModal          = false;
  modoReserva               = false;
  reservaActual             : string | null = null;
  reservaLoading            = false;
  reservaErrorMessage       : string | null = null;

  @ViewChildren('cantidadInput') cantidadInputs?: QueryList<ElementRef<HTMLInputElement>>;

  private previousListaPrecio         = '';
  private suppressListaPrecioChange   = false;
  private singlePagoAutoMonto         : number | null = null;
  private tiposDocumentoBase          : DocumentoDto[] = [];

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
    group.controls.monto.setValue(monto);

    if (input) {
      input.value = monto > 0 ? this.formatAmountWithThousands(monto) : '';
    }
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

  getLineaImpuesto(index: number): number {
    return this.lineasCalculo[index]?.impuesto ?? 0;
  }

  getLineaTotal(index: number): number {
    return this.lineasCalculo[index]?.total ?? 0;
  }

  public abrirModalClientes(): void {
    if (this.locked) return;
    this.showClienteModal = true;
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
        codigoActividad   : this.normalizeCodigoActividad(cliente.codigoActividad),
      },
      { emitEvent: false }
    );
    this.syncTiposDocumentoCliente(cliente.enviarCorreo);
    this.cdr.markForCheck();
    this.clearClienteSearchResults();
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
        codigoActividad     : this.normalizeCodigoActividad(''),
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
      porDescu              : this.fb.nonNullable.control(0),
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
      monto         : this.fb.nonNullable.control(0),
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
        porDescu          : 0,
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
        base        : this.round(neto),
        impuesto    : this.round(impuesto),
        total       : this.round(total)
      };

      resumenSubtotal += linea.subtotal;
      resumenDescuento += linea.descuento;
      resumenImpuesto += linea.impuesto;
      resumenTotal += linea.total;
      lineas.push(linea);
    }

    this.lineasCalculo.splice(0, this.lineasCalculo.length, ...lineas);

    this.resumen = {
      subtotal    : this.round(resumenSubtotal),
      descuento   : this.round(resumenDescuento),
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
    group.controls.monto.setValue(this.round(monto), { emitEvent: false });
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
      group.controls.monto.setValue(autoMonto, { emitEvent: false });
      this.singlePagoAutoMonto = autoMonto;
    }
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
          codigoActividad   : this.normalizeCodigoActividad(cliente.codigoActividad),

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
          codigoActividad   : this.normalizeCodigoActividad('')

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
            porDescu        : this.toNumber(item.porDescuento),
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
    const fechaDocu = this.formatDate(value.fechaDocu);
    const detalle = this.detalleArray.controls.map((group, index) => {
      const raw = group.getRawValue();
      return {
        orden           : index + 1,
        fechaConsumo    : this.formatDate(raw.fechaConsumo || value.fechaDocu),
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
      fechaInicio       : this.formatDate(value.fechaInicio),
      fechaFin          : this.formatDate(value.fechaFin),
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

  private formatDate(value: string): string {
    const trimmed = (value || '').toString().trim();
    if (!trimmed) return '';
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
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
