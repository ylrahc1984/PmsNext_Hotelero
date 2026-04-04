import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ActividadComercialService } from 'src/app/demo/catalogos/agencias-comisionistas/actividad-comercial/actividad-comercial.service';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ListaPrecioUI } from 'src/app/demo/catalogos/listas-precios/lista-precio.models';
import { ListaPrecioService } from 'src/app/demo/catalogos/listas-precios/lista-precio.service';
import { PlanesTarifasService, PlanTarifaUI } from 'src/app/demo/catalogos/listas-precios/planes-tarifas.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { TipoCambio, TipoCambioService } from 'src/app/demo/administracion/tipo-cambio/tipo-cambio.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { NuevaFacturaClienteModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/nueva-factura-cliente-modal/nueva-factura-cliente-modal.component';
import { ReservaPendienteModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/reserva-pendiente-modal/reserva-pendiente-modal.component';
import { SelectorServiciosModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/selector-servicios-modal/selector-servicios-modal.component';
import { ModoPrecio, ServicioListaPrecioItem } from 'src/app/finanzas/services/servicios-lista-precio.service';
import { ReservaPendienteDetalle, ReservasFacturacionService } from 'src/app/finanzas/services/reservas-facturacion.service';
import { ReservasService } from 'src/app/demo/reservas/services/reservas.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  OrdenPedidoCreatePayload,
  OrdenPedidoDetalleItem,
  OrdenPedidoExoneracion,
  OrdenPedidoPagoItem
} from '../../interfaces/orden-pedido.interface';
import { OrdenPedidoService } from '../../services/orden-pedido.service';

@Component({
  selector: 'app-orden-pedido-form',
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
  templateUrl: './orden-pedido-form.component.html',
  styleUrls: ['./orden-pedido-form.component.scss']
})
export class OrdenPedidoFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly actividadComercialService = inject(ActividadComercialService);
  private readonly clienteService = inject(ClienteService);
  private readonly planesTarifasService = inject(PlanesTarifasService);
  private readonly listaPrecioService = inject(ListaPrecioService);
  private readonly monedaService = inject(MonedaService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordenPedidoService = inject(OrdenPedidoService);
  private readonly reservasFacturacionService = inject(ReservasFacturacionService);
  private readonly reservasService = inject(ReservasService);

  private clienteActividadCedula = '';
  private singlePagoAutoMonto: number | null = null;
  private previousListaPrecio = '';
  private suppressListaPrecioChange = false;
  
  readonly empresa = this.empresaContext.empresa;
  readonly tiposDocumento = [
    { value: 'NDP', label: 'Orden de Pedido' },
    { value: 'COT', label: 'Proforma' }
  ];

  readonly form = this.fb.group({
    tipNDP                : this.fb.control('NDP', { validators: [Validators.required] }),
    pntVenta              : this.fb.control(''),
    moneda                : this.fb.control(''),
    planTarifario         : this.fb.control(''),
    listaPrecio           : this.fb.control(''),
    fecNDP                : this.fb.control(this.getTodayIsoDate(), { validators: [Validators.required] }),
    horaNDP               : this.fb.control(this.getCurrentTime(), { validators: [Validators.required] }),
    codVendedor           : this.fb.control(''),
    codCliente            : this.fb.control(''),
    rucCliente            : this.fb.control(''),
    nomCliente            : this.fb.control('', { validators: [Validators.required] }),
    observaciones         : this.fb.control(''),
    detalle               : this.fb.array<FormGroup>([], { validators: [Validators.required] }),
    pagos                 : this.fb.array<FormGroup>([]),
    subTotal              : this.fb.control(0),
    impuesto              : this.fb.control(0),
    totDocu               : this.fb.control(0),
    totalPago             : this.fb.control(0),
    exoneracionActiva     : this.fb.control(false),
    exoneracion           : this.fb.group({
      tipoDocumentoEX1        : this.fb.control(''),
      numeroDocumento         : this.fb.control(''),
      nombreInstitucion       : this.fb.control(''),
      tarifaExonerada         : this.fb.control(0),
      montoExoneracion        : this.fb.control(0)
    })
  });

  isSubmitting                   = false;
  errorMessage                   = '';
  successMessage                 = '';
  monedasCatalogo                : MonedaUI[] = [];
  formasPagoCatalogo             : FormaPago[] = [];
  puntosVentaCatalogo            : PuntoVentaUI[] = [];
  planesTarifariosCatalogo       : PlanTarifaUI[] = [];
  listasPrecioCatalogo           : ListaPrecioUI[] = [];
  monedasLoading                 = false;
  tipoCambioActual               : TipoCambio | null = null;
  tipoCambioLoading              = false;
  tipoCambioError                : string | null = null;
  formasPagoLoading              = false;
  puntosVentaLoading             = false;
  planesTarifariosLoading        = false;
  listasPrecioLoading            = false;
  showClienteModal               = false;
  selectedCliente                : ClienteUI | null = null;
  showServicioModal              = false;
  showReservaModal               = false;
  modoReserva                    = false;
  reservaActual                  : string | null = null;
  reservaLoading                 = false;
  reservaErrorMessage            = '';
  clienteCorreo                  = '';
  clienteCodigoActividad         = '000000';
  clienteActividadLoading        = false;
  clienteSearchResults           : ClienteUI[] = [];
  clienteSearchLoading           = false;
  clienteSearchError             = '';
  pagosValid                     = true;
  

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.usuario) {
      this.form.controls.codVendedor.setValue(currentUser.usuario);
    }

    this.addPago();

    this.detalleArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateTotals());
    this.pagosArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncPagosFormaPago();
      this.updateTotalPago();
    });
    this.form.controls.moneda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((moneda) => {
      this.syncPagosMoneda(moneda);
      this.loadTipoCambio();
    });
    this.form.controls.fecNDP.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncPagosFormaPago();
      this.loadTipoCambio();
    });
    this.form.controls.codCliente.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const query = String(value ?? '').trim();
        if (!query || this.isSubmitting) {
          this.clearClienteSearchResults();
          return;
        }
        this.searchClientes(query);
      });
    this.form.controls.listaPrecio.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((listaPrecio) => {
        this.onListaPrecioChange((listaPrecio || '').toString());
        this.syncDetalleCatalogCodes();
      });
    this.form.controls.planTarifario.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncDetalleCatalogCodes();
      });
    this.form.controls.exoneracionActiva.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((active) => {
      if (!active) {
        this.form.controls.exoneracion.reset({
          tipoDocumentoEX1      : '',
          numeroDocumento       : '',
          nombreInstitucion     : '',
          tarifaExonerada       : 0,
          montoExoneracion      : 0
        });
      }
      this.recalculateTotals();
    });
    this.form.controls.exoneracion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateTotals());

    this.loadMonedas();
    this.loadFormasPago();
    this.loadPuntosVenta();
    this.loadPlanesTarifarios();
    this.loadListasPrecio();
    this.initReservaFromQuery();
    this.loadTipoCambio();
    this.recalculateTotals();
  }

  get detalleArray(): FormArray<FormGroup> {
    return this.form.controls.detalle;
  }

  get pagosArray(): FormArray<FormGroup> {
    return this.form.controls.pagos;
  }

  removeDetalle(index: number): void {
    this.detalleArray.removeAt(index);
    this.recalculateTotals();
  }

  addPago(): void {
    const pending = this.getPendingAmountForNewPago();
    const group = this.fb.group({
      orden             : this.fb.control(this.pagosArray.length + 1),
      frmPago           : this.fb.control(this.formasPagoCatalogo[0]?.codigo ?? ''),
      tipo              : this.fb.control(''),
      numTarjeta        : this.fb.control(''),
      referencia        : this.fb.control(''),
      moneda            : this.fb.control(this.form.controls.moneda.value || ''),
      monto             : this.fb.control(0),
      montoOri          : this.fb.control(0),
      tCambio           : this.fb.control(this.getHeaderTipoCambio()),
      vencimiento       : this.fb.control(this.formatDateForApi(this.form.controls.fecNDP.value)),
      caja              : this.fb.control(''),
      turno             : this.fb.control('')
    });
    this.pagosArray.push(group);
    this.syncPagosFormaPago();
    this.populatePagoPendingAmount(group, pending);
    this.updateTotalPago();
  }

  removePago(index: number): void {
    if (this.pagosArray.length === 1) {
      return;
    }
    this.pagosArray.removeAt(index);
    this.updateTotalPago();
  }

  volverListado(): void {
    void this.router.navigate(['/demo/ordenes-pedido']);
  }

  abrirModalClientes(): void {
    if (this.isSubmitting) {
      return;
    }
    this.showClienteModal = true;
  }

  abrirModalServicios(): void {
    if (this.modoReserva) {
      return;
    }
    const codLista = (this.form.controls.listaPrecio.value || '').toString().trim();
    if (!codLista) {
      window.alert('Seleccione la lista de precios antes de agregar servicios.');
      return;
    }
    this.showServicioModal = true;
  }

  cerrarModalServicios(): void {
    this.showServicioModal = false;
  }

  abrirModalReserva(): void {
    if (this.isSubmitting || this.modoReserva) {
      return;
    }
    this.showReservaModal = true;
    this.reservaErrorMessage = '';
  }

  cerrarModalReserva(): void {
    this.showReservaModal = false;
  }

  onReservaSeleccionada(selection: { codReserva: string; codAgencia: string }): void {
    this.showReservaModal = false;
    if (this.isSubmitting) {
      return;
    }
    this.cargarReservaDesdeSeleccion(selection);
  }

  quitarReserva(): void {
    if (this.isSubmitting || this.reservaLoading) {
      return;
    }
    this.reservaActual = null;
    this.reservaErrorMessage = '';
    this.setModoReserva(false);
    this.clearDetalle();
  }

  onClienteSelected(cliente: ClienteUI): void {
    if (this.isSubmitting) {
      return;
    }
    this.selectedCliente = cliente;
    this.clienteCorreo = cliente.emailPrincipal || cliente.email || '';
    this.form.patchValue(
      {
        codCliente: cliente.codigo,
        nomCliente: cliente.nombre,
        rucCliente: cliente.ruc
      },
      { emitEvent: false }
    );
    this.loadClienteActividad(cliente.ruc);
    this.showClienteModal = false;
    this.clearClienteSearchResults();
  }

  onServicioSelected(servicio: ServicioListaPrecioItem): void {
    if (this.modoReserva) {
      return;
    }
    this.showServicioModal = false;
    this.addDetalleFromServicio(servicio);
  }

  limpiarSeleccionCliente(): void {
    if (this.isSubmitting) {
      return;
    }
    this.selectedCliente = null;
    this.clienteCorreo = '';
    this.clienteCodigoActividad = '000000';
    this.clienteActividadLoading = false;
    this.clienteActividadCedula = '';
    this.form.patchValue(
      {
        codCliente: '',
        nomCliente: '',
        rucCliente: ''
      },
      { emitEvent: false }
    );
    this.clearClienteSearchResults();
  }

  async guardar(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    const validationMessage = this.buildGuardarValidationMessage();
    if (validationMessage) {
      this.form.markAllAsTouched();
      await Swal.fire({
        title: 'No se puede guardar',
        html: validationMessage,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const confirmation = await Swal.fire({
      title: 'Confirmar guardado',
      text: `¿Desea guardar esta ${this.form.controls.tipNDP.value === 'COT' ? 'proforma' : 'orden de pedido'}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const payload = this.buildPayload();
    this.isSubmitting = true;

    this.ordenPedidoService
      .crearOrden(payload)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          const successMessage = this.buildCreateSuccessMessage(response);
          if (this.cleanText(response?.respuesta).toUpperCase() === 'OK') {
            void Swal.fire({
              title: 'Guardado',
              text: successMessage,
              icon: 'success',
              confirmButtonText: 'Aceptar'
            }).then(() => {
              void this.router.navigate(['/demo/ordenes-pedido']);
            });
            return;
          }

          void Swal.fire({
            title: 'Resultado',
            text: successMessage,
            icon: 'info',
            confirmButtonText: 'Aceptar'
          });
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'No se pudo crear la orden.';
          void Swal.fire({
            title: 'Error',
            text: this.errorMessage,
            icon: 'error',
            confirmButtonText: 'Aceptar'
          });
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  getLineaSubTotal(index: number): number {
    const group = this.detalleArray.at(index);
    if (!group) {
      return 0;
    }
    const cantidad = this.toNumber(group.get('canProdu')?.value);
    const precio = this.toNumber(group.get('pUndLst')?.value);
    return this.round(cantidad * precio);
  }

  getLineaImpuesto(index: number): number {
    const group = this.detalleArray.at(index);
    if (!group) {
      return 0;
    }
    return this.round(this.toNumber(group.get('mtoImpu')?.value));
  }

  getLineaTotal(index: number): number {
    const group = this.detalleArray.at(index);
    if (!group) {
      return 0;
    }
    return this.round(this.toNumber(group.get('mtoTotal')?.value));
  }

  private buildGuardarValidationMessage(): string {
    const issues: string[] = [];

    if (this.form.controls.tipNDP.invalid) {
      issues.push('Seleccione el tipo de documento.');
    }
    if (this.form.controls.fecNDP.invalid) {
      issues.push('Indique la fecha del documento.');
    }
    if (this.form.controls.horaNDP.invalid) {
      issues.push('Indique la hora del documento.');
    }
    if (this.form.controls.nomCliente.invalid || !this.cleanText(this.form.controls.nomCliente.value)) {
      issues.push('Seleccione o escriba un cliente valido.');
    }
    if (this.detalleArray.length === 0) {
      issues.push('Agregue al menos una linea en el detalle.');
    } else if (this.detalleArray.controls.some((group) => group.invalid)) {
      issues.push('Revise el detalle: hay productos, cantidades o precios invalidos.');
    }
    if (!this.pagosValid) {
      issues.push(
        `El total de pagos (${this.round(this.form.controls.totalPago.value).toFixed(2)}) no coincide con el total del documento (${this.round(this.form.controls.totDocu.value).toFixed(2)}).`
      );
    }

    return issues.length
      ? `<div style="text-align:left">${issues.map((issue) => `- ${issue}`).join('<br>')}</div>`
      : '';
  }

  get tipoDocumentoLabel(): string {
    return this.form.controls.tipNDP.value === 'COT' ? 'Proforma Comercial' : 'Recibo Comercial';
  }

  get saldoPendiente(): number {
    return Number((this.form.controls.totDocu.value - this.form.controls.totalPago.value).toFixed(2));
  }

  get modoPrecioSeleccionado(): ModoPrecio {
    const planId = Number(this.form.controls.planTarifario.value ?? 0) || 0;
    const plan = this.planesTarifariosCatalogo.find((item) => Number(item.planId ?? 0) === planId);
    const tipo = (plan?.tipoTarifa || '').toString().trim().toUpperCase();
    return tipo === 'N' ? 'N' : 'R';
  }

  private recalculateTotals(): void {
    let subtotal = 0;
    let impuestoBruto = 0;

    this.detalleArray.controls.forEach((group) => {
      const cantidad = this.toNumber(group.get('canProdu')?.value);
      const precio = this.toNumber(group.get('pUndLst')?.value);
      const porDescuento = this.toNumber(group.get('porDescu')?.value);
      const porImpuesto = this.toNumber(group.get('porImpu')?.value);

      const bruto = cantidad * precio;
      const mtoDescu = bruto * (porDescuento / 100);
      const totalNeto = bruto - mtoDescu;
      const mtoImpu = totalNeto * (porImpuesto / 100);
      const mtoTotal = totalNeto + mtoImpu;

      group.patchValue(
        {
          mtoDescu: this.round(mtoDescu),
          totalNeto: this.round(totalNeto),
          mtoImpu: this.round(mtoImpu),
          mtoTotal: this.round(mtoTotal)
        },
        { emitEvent: false }
      );

      subtotal += totalNeto;
      impuestoBruto += mtoImpu;
    });

    const exoneracion = this.calculateExoneracion(impuestoBruto);
    const impuesto = Math.max(impuestoBruto - exoneracion, 0);
    const total = subtotal + impuesto;

    this.form.patchValue(
      {
        subTotal: this.round(subtotal),
        impuesto: this.round(impuesto),
        totDocu: this.round(total)
      },
      { emitEvent: false }
    );

    this.updateTotalPago();
  }

  private updateTotalPago(): void {
    this.enforceSinglePagoAutoMonto();
    const totalPago = this.getPagosTotalInDocCurrency();
    this.form.controls.totalPago.setValue(this.round(totalPago), { emitEvent: false });
    this.pagosValid = this.round(totalPago) === this.round(this.form.controls.totDocu.value);
  }

  private createDetalleGroup(): FormGroup {
    return this.fb.group({
      codProdu          : this.fb.control(''),
      producto          : this.fb.control('', { validators: [Validators.required] }),
      area              : this.fb.control('TOURS'),
      uMedida           : this.fb.control('Unid'),
      lstPrecio         : this.fb.control(this.form.controls.listaPrecio.value),
      planTarifa        : this.fb.control(this.form.controls.planTarifario.value),
      canProdu          : this.fb.control(1, { validators: [Validators.required, Validators.min(0.01)] }),
      saldoPendiente    : this.fb.control(0),
      pUndLst           : this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      porDescu          : this.fb.control(0),
      mtoDescu          : this.fb.control(0),
      totalNeto         : this.fb.control(0),
      porImpu           : this.fb.control(13),
      mtoImpu           : this.fb.control(0),
      mtoTotal          : this.fb.control(0)
    });
  }

  private addDetalleFromServicio(servicio: ServicioListaPrecioItem): void {
    const group = this.createDetalleGroup();
    group.patchValue(
      {
        codProdu      : (servicio.codigoServicio || '').toString(),
        producto      : (servicio.nombreServicio || '').toString(),
        area          : 'TOURS',
        uMedida       : 'Unid',
        lstPrecio     : this.form.controls.listaPrecio.value,
        planTarifa    : this.form.controls.planTarifario.value,
        canProdu      : 1,
        pUndLst       : Number(servicio.precioUnitario ?? 0) || 0,
        porDescu      : 0,
        porImpu       : 13
      },
      { emitEvent: false }
    );
    this.detalleArray.push(group);
    this.recalculateTotals();
  }

  private loadMonedas(): void {
    this.monedasLoading = true;
    this.monedaService
      .getAll()
      .pipe(
        finalize(() => {
          this.monedasLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const monedas = (response ?? [])
            .filter((item) => Number(item.activo) !== 0)
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

          this.monedasCatalogo = monedas;

          const current = this.form.controls.moneda.value;
          const exists = monedas.some((item) => item.codMoneda === current);
          const defaultMoneda =
            monedas.find((item) => Number(item.primario) !== 0)?.codMoneda ??
            monedas[0]?.codMoneda ??
            '';

          if (!current || !exists) {
            this.form.controls.moneda.setValue(defaultMoneda, { emitEvent: false });
          }

          this.syncPagosMoneda(this.form.controls.moneda.value);
          this.loadTipoCambio();
        },
        error: () => {
          this.monedasCatalogo = [];
        }
      });
  }

  private loadFormasPago(): void {
    this.formasPagoLoading = true;
    this.formaPagoService
      .getAll()
      .pipe(
        finalize(() => {
          this.formasPagoLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.formasPagoCatalogo = (response ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          this.syncPagosFormaPago();
        },
        error: () => {
          this.formasPagoCatalogo = [];
        }
      });
  }

  private loadPuntosVenta(): void {
    const currentUser = this.authService.getCurrentUser()?.usuario ?? '';
    if (!currentUser) {
      this.loadPuntosVentaCatalogo();
      return;
    }

    this.puntosVentaLoading = true;
    this.usuarioService
      .getPuntosVentaUsuario(currentUser)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const puntosVenta = (response ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          if (puntosVenta.length > 0) {
            this.applyPuntosVentaCatalogo(puntosVenta);
            this.puntosVentaLoading = false;
            return;
          }
          this.loadPuntosVentaCatalogo();
        },
        error: () => this.loadPuntosVentaCatalogo()
      });
  }

  private syncPagosFormaPago(): void {
    const defaultFrmPago = this.formasPagoCatalogo[0]?.codigo ?? '';
    this.pagosArray.controls.forEach((group, index) => {
      const orden = index + 1;
      if (this.toNumber(group.get('orden')?.value) !== orden) {
        group.get('orden')?.setValue(orden, { emitEvent: false });
      }

      const frmPago = String(group.get('frmPago')?.value ?? '').trim();
      const exists = this.formasPagoCatalogo.some((item) => item.codigo === frmPago);
      const codigo = !frmPago || !exists ? defaultFrmPago : frmPago;

      if (codigo && frmPago !== codigo) {
        group.get('frmPago')?.setValue(codigo, { emitEvent: false });
      }

      const formaPago = this.formasPagoCatalogo.find((item) => item.codigo === codigo);
      const tipo = formaPago?.tipoPago ?? '';
      if (String(group.get('tipo')?.value ?? '') !== tipo) {
        group.get('tipo')?.setValue(tipo, { emitEvent: false });
      }

      const monto = this.round(this.toNumber(group.get('monto')?.value));
      if (this.toNumber(group.get('montoOri')?.value) !== monto) {
        group.get('montoOri')?.setValue(monto, { emitEvent: false });
      }

      const tCambio = this.toNumber(group.get('tCambio')?.value) || 1;
      if (this.toNumber(group.get('tCambio')?.value) !== tCambio) {
        group.get('tCambio')?.setValue(tCambio, { emitEvent: false });
      }

      const vencimiento = this.calculatePagoVencimiento(codigo);
      if (vencimiento && String(group.get('vencimiento')?.value ?? '') !== vencimiento) {
        group.get('vencimiento')?.setValue(vencimiento, { emitEvent: false });
      }

    });
  }

  private loadPuntosVentaCatalogo(): void {
    this.puntosVentaLoading = true;
    this.usuarioService
      .getPuntosVenta()
      .pipe(
        finalize(() => {
          this.puntosVentaLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const puntosVenta = (response ?? []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          this.applyPuntosVentaCatalogo(puntosVenta);
        },
        error: () => {
          this.puntosVentaCatalogo = [];
        }
      });
  }

  private loadPlanesTarifarios(): void {
    this.planesTarifariosLoading = true;
    this.planesTarifasService
      .getPlanesTarifas(1, 50)
      .pipe(
        finalize(() => {
          this.planesTarifariosLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.planesTarifariosCatalogo = response ?? [];
          const current = this.form.controls.planTarifario.value;
          const exists = this.planesTarifariosCatalogo.some((item) => String(item.planId) === String(current));
          const defaultValue = this.planesTarifariosCatalogo[0]?.planId;

          if (!current || !exists) {
            this.form.controls.planTarifario.setValue(defaultValue !== undefined ? String(defaultValue) : '', {
              emitEvent: false
            });
          }
          this.syncDetalleCatalogCodes();
        },
        error: () => {
          this.planesTarifariosCatalogo = [];
        }
      });
  }

  private loadListasPrecio(): void {
    this.listasPrecioLoading = true;
    this.listaPrecioService
      .getListas({ pageNumber: 1, pageSize: 10 })
      .pipe(
        finalize(() => {
          this.listasPrecioLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.listasPrecioCatalogo = response?.data ?? [];
          const current = this.form.controls.listaPrecio.value;
          const exists = this.listasPrecioCatalogo.some((item) => item.codigo === current);
          const defaultValue = this.listasPrecioCatalogo[0]?.codigo ?? '';

          if (!current || !exists) {
            this.form.controls.listaPrecio.setValue(defaultValue, { emitEvent: false });
            this.previousListaPrecio = defaultValue;
            this.syncDetalleCatalogCodes();
            return;
          }

          this.previousListaPrecio = (current || '').toString();
          this.syncDetalleCatalogCodes();
        },
        error: () => {
          this.listasPrecioCatalogo = [];
          this.form.controls.listaPrecio.setValue('', { emitEvent: false });
          this.previousListaPrecio = '';
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
      const confirmed = window.confirm('Cambiar la lista de precios eliminará las líneas actuales. ¿Desea continuar?');
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
    this.recalculateTotals();
  }

  private cargarReservaDesdeSeleccion(selection: { codReserva: string; codAgencia: string }): void {
    const codReserva = (selection?.codReserva ?? '').toString().trim();
    const codAgencia = (selection?.codAgencia ?? '').toString().trim();

    if (!codReserva) {
      return;
    }

    this.reservaLoading = true;
    this.reservaErrorMessage = '';

    forkJoin({
      detalle: this.reservasFacturacionService.getDetalle(codReserva),
      cliente: codAgencia
        ? this.clienteService.getClienteByCodigo(codAgencia).pipe(catchError(() => of(null)))
        : of(null)
    })
      .pipe(
        finalize(() => {
          this.reservaLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ detalle, cliente }) => {
          this.reservaActual = codReserva;
          this.aplicarClienteReserva(cliente, codAgencia);
          this.aplicarCatalogosReserva(detalle ?? []);
          this.setModoReserva(true);
          this.aplicarDetalleReserva(detalle ?? []);
        },
        error: (error: unknown) => {
          this.reservaErrorMessage = error instanceof Error ? error.message : 'No se pudo cargar la reserva seleccionada.';
        }
      });
  }

  private initReservaFromQuery(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const codReserva = (params.get('codReserva') ?? '').toString().trim();
      const codAgencia = (params.get('codAgencia') ?? '').toString().trim();

      if (!codReserva || this.isSubmitting) {
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
      this.reservaErrorMessage = '';

      this.reservasService
        .getReservaByCod(codReserva)
        .pipe(
          finalize(() => {
            this.reservaLoading = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (reserva) => {
            const agencia = (reserva?.PRV01_CodAgencia ?? '').toString().trim();
            if (!agencia) {
              this.reservaErrorMessage = 'No se pudo determinar el código de agencia para cargar la reserva.';
              return;
            }
            this.cargarReservaDesdeSeleccion({ codReserva, codAgencia: agencia });
          },
          error: (error: unknown) => {
            this.reservaErrorMessage = error instanceof Error ? error.message : 'No se pudo cargar la reserva seleccionada.';
          }
        });
    });
  }

  private aplicarClienteReserva(cliente: ClienteUI | null, codAgencia: string): void {
    if (cliente) {
      this.selectedCliente = cliente;
      this.clienteCorreo = cliente.emailPrincipal || cliente.email || '';
      this.form.patchValue(
        {
          codCliente: cliente.codigo,
          nomCliente: cliente.nombre,
          rucCliente: cliente.ruc
        },
        { emitEvent: false }
      );
      this.loadClienteActividad(cliente.ruc);
    } else {
      this.selectedCliente = null;
      this.clienteCorreo = '';
      this.clienteCodigoActividad = '000000';
      this.form.patchValue(
        {
          codCliente: codAgencia,
          nomCliente: '',
          rucCliente: ''
        },
        { emitEvent: false }
      );
    }

    this.setClienteEditable(true);
    this.clearClienteSearchResults();
  }

  private aplicarDetalleReserva(detalles: ReservaPendienteDetalle[]): void {
    this.detalleArray.clear();

    detalles
      .filter((item) => this.toNumber(item.saldoPendiente) > 0)
      .forEach((item) => {
        const saldo = this.toNumber(item.saldoPendiente);
        const totalPax = this.toNumber(item.totalPax);
        const subTotal = this.toNumber(item.subTotal);
        const neto = this.toNumber(item.neto);
        const impuestoMonto = this.toNumber(item.impuesto);
        const porImp = neto > 0 ? (impuestoMonto / neto) * 100 : 0;
        const precioUnit = totalPax > 0 ? subTotal / totalPax : 0;

        const group = this.createDetalleGroup();
        group.patchValue(
          {
            codProdu          : (item.codServicio || '').toString(),
            producto          : (item.nomServicio || '').toString(),
            area              : (item.codGrupo || 'TOURS').toString(),
            uMedida           : (item.uMedida || 'Unid').toString(),
            lstPrecio         : (item.codLstPrecio || this.form.controls.listaPrecio.value || '').toString(),
            planTarifa        : (item.planTarifario || this.form.controls.planTarifario.value || '').toString(),
            canProdu          : saldo,
            saldoPendiente    : saldo,
            pUndLst           : this.round(precioUnit),
            porDescu          : this.toNumber(item.porDescuento),
            porImpu           : this.round(porImp)
          },
          { emitEvent: false }
        );

        const validators = [Validators.required, Validators.min(0.01)];
        if (saldo > 0) {
          validators.push(Validators.max(saldo));
        }
        group.controls['canProdu'].setValidators(validators);
        group.controls['canProdu'].updateValueAndValidity({ emitEvent: false });

        this.detalleArray.push(group);
      });

    this.recalculateTotals();
  }

  private setModoReserva(active: boolean): void {
    this.modoReserva = active;
    this.setClienteEditable(true);
    this.setPlanTarifarioEditable(!active);
    this.setListaPrecioEditable(!active);
  }

  private setClienteEditable(enabled: boolean): void {
    const controls = [this.form.controls.codCliente, this.form.controls.nomCliente];

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

  private applyPuntosVentaCatalogo(puntosVenta: PuntoVentaUI[]): void {
    this.puntosVentaCatalogo = puntosVenta;

    const current = this.form.controls.pntVenta.value;
    const exists = puntosVenta.some((item) => item.codigo === current);
    if (!current || !exists) {
      this.form.controls.pntVenta.setValue(puntosVenta[0]?.codigo ?? '', { emitEvent: false });
    }
  }

  private searchClientes(query: string): void {
    this.clienteSearchLoading = true;
    this.clienteSearchError = '';
    this.clienteSearchResults = [];

    this.clienteService
      .getClientes(1, 6, query)
      .pipe(
        finalize(() => {
          this.clienteSearchLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.clienteSearchResults = response.data ?? [];
        },
        error: (error: unknown) => {
          this.clienteSearchError = error instanceof Error ? error.message : 'No se pudo buscar clientes.';
        }
      });
  }

  private clearClienteSearchResults(): void {
    this.clienteSearchResults = [];
    this.clienteSearchLoading = false;
    this.clienteSearchError = '';
  }

  private calculateExoneracion(impuestoBruto: number): number {
    if (!this.form.controls.exoneracionActiva.value) {
      return 0;
    }

    const exoneracionForm = this.form.controls.exoneracion;
    const tarifa = this.toNumber(exoneracionForm.controls.tarifaExonerada.value);
    const montoManual = this.toNumber(exoneracionForm.controls.montoExoneracion.value);
    const montoCalculado = impuestoBruto * (tarifa / 100);
    const monto = montoManual > 0 ? montoManual : montoCalculado;

    exoneracionForm.controls.montoExoneracion.setValue(this.round(monto), { emitEvent: false });
    return this.round(monto);
  }

  private syncDetalleCatalogCodes(): void {
    if (this.modoReserva) {
      return;
    }

    const lstPrecio = (this.form.controls.listaPrecio.value || '').toString();
    const planTarifa = (this.form.controls.planTarifario.value || '').toString();

    this.detalleArray.controls.forEach((group) => {
      if (String(group.get('lstPrecio')?.value ?? '') !== lstPrecio) {
        group.get('lstPrecio')?.setValue(lstPrecio, { emitEvent: false });
      }
      if (String(group.get('planTarifa')?.value ?? '') !== planTarifa) {
        group.get('planTarifa')?.setValue(planTarifa, { emitEvent: false });
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

  private loadClienteActividad(cedula: string): void {
    const cedulaNormalizada = String(cedula ?? '').trim();
    this.clienteActividadCedula = cedulaNormalizada;
    this.clienteCodigoActividad = '';

    if (!cedulaNormalizada) {
      this.clienteActividadLoading = false;
      return;
    }

    this.clienteActividadLoading = true;
    this.actividadComercialService
      .getActividades(cedulaNormalizada)
      .pipe(
        finalize(() => {
          this.clienteActividadLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (actividades) => {
          if (this.clienteActividadCedula !== cedulaNormalizada) {
            return;
          }
          const actividadPrincipal =
            (actividades ?? []).find((item) => Number(item.MPV32_Principal) === 1) ??
            (actividades ?? [])[0] ??
            null;
          this.clienteCodigoActividad = actividadPrincipal?.MPV32_CodigoAMH ?? '';
        },
        error: () => {
          if (this.clienteActividadCedula === cedulaNormalizada) {
            this.clienteCodigoActividad = '';
          }
        }
      });
  }

  private buildPayload(): OrdenPedidoCreatePayload {
    const moneda = this.cleanText(this.form.controls.moneda.value);
    const tCambio = this.getHeaderTipoCambio();
    const detalle = this.buildDetallePayload(moneda, tCambio);
    const formasPago = this.pagosArray.getRawValue().map((item, index) => this.mapPago(item as Record<string, unknown>, index + 1));
    const exento = this.form.controls.exoneracionActiva.value ? 1 : 0;
    const fecVenc = formasPago[0]?.vencimiento || this.formatDateForApi(this.form.controls.fecNDP.value);
    const referencia =
      formasPago.find((item) => this.cleanText(item.referencia))?.referencia ||
      this.cleanText(this.form.controls.observaciones.value);

    return {
      proceso             : 1,
      detalle             ,
      formasPago          ,
      tipNDP              : this.form.controls.tipNDP.value,
      serieNDP            : '',
      numeroNDP           : '',
      pntVenta            : this.form.controls.pntVenta.value,
      fecNDP              : this.formatDateForApi(this.form.controls.fecNDP.value),
      horaNDP             : this.form.controls.horaNDP.value,
      codVendedor         : this.form.controls.codVendedor.value,
      codCliente          : this.form.controls.codCliente.value,
      rucCliente          : this.form.controls.rucCliente.value,
      nomCliente          : this.form.controls.nomCliente.value,
      exento              ,
      subTotal            : this.round(this.form.controls.subTotal.value),
      impuesto            : this.round(this.form.controls.impuesto.value),
      totDocu             : this.round(this.form.controls.totDocu.value),
      totalPago           : this.round(this.form.controls.totalPago.value),
      estadoNDP           : 'ABI',
      moneda              ,
      tCambio             ,
      fecVenc             ,
      lstPrecio           : this.cleanText(this.form.controls.listaPrecio.value),
      items               : detalle.length,
      nReferencia         : referencia,
      observaciones       : this.form.controls.observaciones.value,
      operador            : this.getOperador(),
      idBeep              : this.cleanText(this.reservaActual),
      cActividad          : this.normalizeCodigoActividad(this.clienteCodigoActividad),
      pageNumber          : 1,
      pageSize            : 10,
      respuesta           : ''
    };
  }

  private buildDetallePayload(moneda: string, tCambio: number): OrdenPedidoDetalleItem[] {
    const detalleRaw = this.detalleArray.getRawValue().map((item) => item as Record<string, unknown>);
    const exoneracionTarifa = this.getExoneracionRate();
    const lineas = detalleRaw.map((item) => {
      const canProdu = this.toNumber(item['canProdu']);
      const pUndLst = this.round(this.toNumber(item['pUndLst']));
      const porDescu = this.toNumber(item['porDescu']);
      const porImpu = this.toNumber(item['porImpu']);
      const totSinImp = this.round(canProdu * pUndLst);
      const mtoDescu = this.round(totSinImp * (porDescu / 100));
      const totalNeto = this.round(totSinImp - mtoDescu);
      const mtoImpuBruto = this.round(totalNeto * (porImpu / 100));

      return {
        item,
        canProdu,
        pUndLst,
        porDescu,
        porImpu,
        totSinImp,
        mtoDescu,
        totalNeto,
        mtoImpuBruto
      };
    });

    const totalImpuestoBruto = this.round(lineas.reduce((acc, linea) => acc + linea.mtoImpuBruto, 0));
    const exoneracionTotal = this.form.controls.exoneracionActiva.value ? this.calculateExoneracion(totalImpuestoBruto) : 0;
    let exoneracionRestante = exoneracionTotal;

    return lineas.map((linea, index) => {
      const isLast = index === lineas.length - 1;
      const proporcion = totalImpuestoBruto > 0 ? linea.mtoImpuBruto / totalImpuestoBruto : 0;
      const mtoExonera =
        exoneracionTotal > 0
          ? this.round(isLast ? exoneracionRestante : exoneracionTotal * proporcion)
          : 0;

      exoneracionRestante = this.round(Math.max(exoneracionRestante - mtoExonera, 0));

      const mtoImpu = this.round(Math.max(linea.mtoImpuBruto - mtoExonera, 0));
      const mtoTotal = this.round(linea.totalNeto + mtoImpu);
      const uniConImp = linea.canProdu > 0 ? this.round(mtoTotal / linea.canProdu) : this.round(linea.pUndLst);
      const raw = linea.item;

      return {
        codProdu        : this.cleanText(raw['codProdu']),
        producto        : this.cleanText(raw['producto']),
        area            : this.cleanText(raw['area']) || 'TOURS',
        uMedida         : this.cleanText(raw['uMedida']) || 'Unid',
        canProdu        : linea.canProdu,
        pUndLst         : linea.pUndLst,
        uniSinImp       : linea.pUndLst,
        totSinImp       : linea.totSinImp,
        porDescu        : linea.porDescu,
        mtoDescu        : linea.mtoDescu,
        totalNeto       : linea.totalNeto,
        porImpu         : linea.porImpu,
        mtoImpu         ,
        porExonera      : exoneracionTarifa,
        mtoExonera      ,
        uniConImp       ,
        mtoTotal        ,
        grabado         : linea.porImpu > 0 ? 'G' : 'E',
        moneda          ,
        tCambio         ,
        orden           : index + 1,
        uMedidaDos      : '',
        canProduDos     : 0,
        lstPrecio       : this.cleanText(raw['lstPrecio']) || this.cleanText(this.form.controls.listaPrecio.value),
        planTarifa      : this.cleanText(raw['planTarifa']) || this.cleanText(this.form.controls.planTarifario.value)
      };
    });
  }

  private mapPago(item: Record<string, unknown>, orden: number): OrdenPedidoPagoItem {
    const frmPago = this.cleanText(item['frmPago']);
    const formaPago = this.formasPagoCatalogo.find((entry) => entry.codigo === frmPago);
    const monto = this.round(this.toNumber(item['monto']));
    const tCambio = this.toNumber(item['tCambio']) || 1;

    return {
      orden,
      frmPago,
      tipo        : this.cleanText(item['tipo']) || formaPago?.tipoPago || '',
      numTarjeta  : this.cleanText(item['numTarjeta']),
      referencia  : this.cleanText(item['referencia']),
      moneda      : this.cleanText(item['moneda']) || this.cleanText(this.form.controls.moneda.value),
      monto,
      montoOri    : this.round(this.toNumber(item['montoOri']) || monto),
      tCambio,
      vencimiento : this.cleanText(item['vencimiento']) || this.calculatePagoVencimiento(frmPago),
      caja        : this.cleanText(item['caja']),
      turno       : this.cleanText(item['turno'])
    };
  }

  private mapExoneracion(): OrdenPedidoExoneracion {
    const ex = this.form.controls.exoneracion.getRawValue();
    return {
      tipoDocumentoEX1      : ex.tipoDocumentoEX1,
      numeroDocumento       : ex.numeroDocumento,
      nombreInstitucion     : ex.nombreInstitucion,
      tarifaExonerada       : this.toNumber(ex.tarifaExonerada),
      montoExoneracion      : this.toNumber(ex.montoExoneracion)
    };
  }

  private toNumber(value: unknown): number {
    const normalized = String(value ?? '').replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private cleanText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private syncPagosMoneda(moneda: string): void {
    const selectedMoneda = String(moneda ?? '').trim();
    if (!selectedMoneda) {
      return;
    }

    this.pagosArray.controls.forEach((group) => {
      group.controls['moneda'].setValue(selectedMoneda, { emitEvent: false });
    });
    this.updateTotalPago();
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private getHeaderTipoCambio(): number {
    const firstPago = this.pagosArray.controls[0];
    const tCambio = this.toNumber(firstPago?.get('tCambio')?.value);
    return tCambio > 0 ? tCambio : 1;
  }

  private loadTipoCambio(): void {
    const fechaParam = this.formatDateForApi(this.form.controls.fecNDP.value);
    const moneda = (this.form.controls.moneda.value || '').toString().trim();
    if (!fechaParam || !moneda) {
      this.tipoCambioActual = null;
      return;
    }

    this.tipoCambioLoading = true;
    this.tipoCambioError = null;

    this.tipoCambioService
      .fetchTipoCambio(fechaParam, moneda)
      .pipe(
        finalize(() => {
          this.tipoCambioLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          this.tipoCambioActual = items[0] ?? null;
          const valor = this.tipoCambioActual?.venta ?? this.getHeaderTipoCambio();
          if (valor !== null && valor !== undefined) {
            this.pagosArray.controls.forEach((group, index) => {
              if (index === 0) {
                group.get('tCambio')?.setValue(valor, { emitEvent: false });
              }
            });
          }
        },
        error: (error: unknown) => {
          this.tipoCambioError = error instanceof Error ? error.message : 'No se pudo cargar el tipo de cambio.';
          this.tipoCambioActual = null;
        }
      });
  }

  private getDocCurrency(): string {
    return String(this.form.controls.moneda.value || '').trim().toUpperCase();
  }

  private getPagoTipoCambio(group: FormGroup): number {
    const rate = this.toNumber(group.get('tCambio')?.value);
    return rate > 0 ? rate : this.getHeaderTipoCambio();
  }

  private convertAmountToDocCurrency(amount: number, currency: string, rate: number): number {
    if (!amount) return 0;
    const docCurrency = this.getDocCurrency();
    const payCurrency = String(currency || '').trim().toUpperCase();
    if (!payCurrency || payCurrency === docCurrency) return amount;
    if (!rate) return amount;
    if (docCurrency === 'USD') {
      return amount / rate;
    }
    if (payCurrency === 'USD') {
      return amount * rate;
    }
    return amount;
  }

  private convertAmountFromDocCurrency(amount: number, currency: string, rate: number): number {
    if (!amount) return 0;
    const docCurrency = this.getDocCurrency();
    const payCurrency = String(currency || '').trim().toUpperCase();
    if (!payCurrency || payCurrency === docCurrency) return amount;
    if (!rate) return amount;
    if (docCurrency === 'USD') {
      return amount * rate;
    }
    if (payCurrency === 'USD') {
      return amount / rate;
    }
    return amount;
  }

  private normalizeCodigoActividad(value: string | null | undefined): string {
    const normalized = (value ?? '').toString().trim();
    if (/^\d{6}$/.test(normalized)) {
      return normalized;
    }
    return '000000';
  }

  private getPagosTotalInDocCurrency(): number {
    return this.pagosArray.controls.reduce((sum, group) => {
      const monto = this.toNumber(group.get('monto')?.value);
      const moneda = this.cleanText(group.get('moneda')?.value);
      const rate = this.getPagoTipoCambio(group);
      return sum + this.convertAmountToDocCurrency(monto, moneda, rate);
    }, 0);
  }

  private getPendingAmountForNewPago(): number {
    const pending = this.form.controls.totDocu.value - this.getPagosTotalInDocCurrency();
    return pending > 0 ? this.round(pending) : 0;
  }

  private populatePagoPendingAmount(group: FormGroup, pendingAmount: number): void {
    const moneda = this.cleanText(group.get('moneda')?.value);
    const rate = this.getPagoTipoCambio(group);
    const monto = this.convertAmountFromDocCurrency(pendingAmount, moneda, rate);
    this.setPagoMontoFormatted(group, monto);
  }

  private enforceSinglePagoAutoMonto(): void {
    if (this.pagosArray.length !== 1) {
      this.singlePagoAutoMonto = null;
      return;
    }
    const group = this.pagosArray.controls[0];
    const moneda = this.cleanText(group.get('moneda')?.value);
    const rate = this.getPagoTipoCambio(group);
    const currentMonto = this.round(this.toNumber(group.get('monto')?.value));
    const autoMonto = this.round(this.convertAmountFromDocCurrency(this.form.controls.totDocu.value, moneda, rate));
    if (this.singlePagoAutoMonto === null || this.singlePagoAutoMonto === currentMonto) {
      this.setPagoMontoFormatted(group, autoMonto);
      this.singlePagoAutoMonto = autoMonto;
    }
  }

  private setPagoMontoFormatted(group: FormGroup, monto: number): void {
    const rounded = this.round(monto);
    const formatted = rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    group.get('monto')?.setValue(formatted, { emitEvent: false });
    group.get('montoOri')?.setValue(rounded, { emitEvent: false });
  }

  formatPagoMonto(index: number): void {
    const group = this.pagosArray.at(index);
    const monto = this.toNumber(group?.get('monto')?.value);
    this.setPagoMontoFormatted(group, monto);
    this.updateTotalPago();
  }

  private getExoneracionRate(): number {
    if (!this.form.controls.exoneracionActiva.value) {
      return 0;
    }

    const impuestoBruto = this.detalleArray.controls.reduce((acc, group) => acc + this.toNumber(group.get('mtoImpu')?.value), 0);
    if (impuestoBruto <= 0) {
      return 0;
    }

    const tarifa = this.toNumber(this.form.controls.exoneracion.controls.tarifaExonerada.value);
    if (tarifa > 0) {
      return this.round(tarifa);
    }

    const monto = this.toNumber(this.form.controls.exoneracion.controls.montoExoneracion.value);
    return this.round((monto / impuestoBruto) * 100);
  }

  private calculatePagoVencimiento(frmPago: string): string {
    const fechaBase = this.cleanText(this.form.controls.fecNDP.value);
    if (!fechaBase) {
      return '';
    }

    const formaPago = this.formasPagoCatalogo.find((item) => item.codigo === frmPago);
    const dias = Number(formaPago?.nDias ?? 0) || 0;
    const parsedDate = this.parseDateValue(fechaBase);
    if (!parsedDate) {
      return this.formatDateForApi(fechaBase);
    }

    parsedDate.setDate(parsedDate.getDate() + dias);
    return this.formatDateForApi(
      `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
    );
  }

  private parseDateValue(value: string): Date | null {
    const raw = this.cleanText(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-').map((part) => Number(part));
      return new Date(year, month - 1, day);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/').map((part) => Number(part));
      return new Date(year, month - 1, day);
    }
    return null;
  }

  private getOperador(): string {
    const currentUser = this.authService.getCurrentUser();
    return this.cleanText(currentUser?.usuario) || this.cleanText(this.form.controls.codVendedor.value);
  }

  private buildCreateSuccessMessage(response: { mensaje?: string; respuesta?: string; datos?: Array<{ TipNDP?: string; Serie?: string; NumNDP?: string }> }): string {
    const data = response?.datos?.[0];
    const tipNDP = this.cleanText(data?.TipNDP);
    const serie = this.cleanText(data?.Serie);
    const numNDP = this.cleanText(data?.NumNDP);
    const identificador = [tipNDP, serie, numNDP].filter(Boolean).join(' ');
    const baseMessage = this.cleanText(response?.mensaje) || this.cleanText(response?.respuesta) || 'La orden fue creada correctamente.';

    return identificador ? `${baseMessage}\nDocumento: ${identificador}` : baseMessage;
  }

  private formatDateForApi(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split('-');
      return `${day}/${month}/${year}`;
    }
    return raw;
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
