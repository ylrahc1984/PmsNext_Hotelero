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
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { distinctUntilChanged, finalize, startWith } from 'rxjs/operators';
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
import type {
  ConfirmarFacturaPayload,
  ConfirmarFacturaResponse,
  DetalleForm,
  LineaCalculo,
  NuevaFacturaForm,
  PagoForm,
  TotalesResumen
} from '../nueva-factura.interface';

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
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly monedaService = inject(MonedaService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly clienteService = inject(ClienteService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly planesTarifasService = inject(PlanesTarifasService);
  private readonly listaPrecioService = inject(ListaPrecioService);
  private readonly reservasFacturacionService = inject(ReservasFacturacionService);

  private readonly apiUrl = `${environment.apiUrl}/facturacion/confirmar`;

  readonly empresa = this.empresaContext.empresa;

  readonly form: FormGroup<NuevaFacturaForm> = this.fb.group({
    tipDocu: this.fb.nonNullable.control('FAC', { validators: [Validators.required] }),
    codCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    rucCliente: this.fb.nonNullable.control(''),
    nomCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    correoCliente: this.fb.nonNullable.control(''),
    codReserva: this.fb.nonNullable.control(''),
    fechaInicio: this.fb.nonNullable.control(''),
    fechaFin: this.fb.nonNullable.control(''),
    voucherRsv: this.fb.nonNullable.control(''),
    nProveedor: this.fb.nonNullable.control(''),
    habitacion: this.fb.nonNullable.control(''),
    master: this.fb.nonNullable.control(''),
    fechaDocu: this.fb.nonNullable.control(this.getTodayIsoDate()),
    pntVenta: this.fb.nonNullable.control(''),
    numMesa: this.fb.nonNullable.control(''),
    numPax: this.fb.nonNullable.control(0),
    codVendedor: this.fb.nonNullable.control(''),
    condicionVenta: this.fb.nonNullable.control('01', { validators: [Validators.required] }),
    moneda: this.fb.nonNullable.control('CRC', { validators: [Validators.required] }),
    codigoActividad: this.fb.nonNullable.control(''),
    observacion: this.fb.nonNullable.control(''),
    planTarifario: this.fb.nonNullable.control(''),
    listaPrecio: this.fb.nonNullable.control(''),
    tCambio: this.fb.nonNullable.control(1),
    operador: this.fb.nonNullable.control('admin'),
    respuesta: this.fb.nonNullable.control(''),
    serie: this.fb.nonNullable.control(''),
    numero: this.fb.nonNullable.control(''),
    detalle: this.fb.array<FormGroup<DetalleForm>>([], { validators: [Validators.required] }),
    pagos: this.fb.array<FormGroup<PagoForm>>([])
  });

  readonly lineasCalculo: LineaCalculo[] = [];
  resumen: TotalesResumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };

  mostrarPagos = true;
  pagosTotal = 0;
  pagosValid = true;

  selectedCliente: ClienteUI | null = null;
  showClienteModal = false;
  showServicioModal = false;
  showReservaModal = false;
  modoReserva = false;
  reservaActual: string | null = null;
  reservaLoading = false;
  reservaErrorMessage: string | null = null;

  @ViewChildren('cantidadInput') cantidadInputs?: QueryList<ElementRef<HTMLInputElement>>;

  private previousListaPrecio = '';
  private suppressListaPrecioChange = false;

  monedas: MonedaUI[] = [];
  monedasLoading = false;

  tiposDocumento: DocumentoDto[] = [];
  tiposDocumentoLoading = false;

  puntosVenta: PuntoVentaUI[] = [];
  puntosVentaLoading = false;

  formasPago: FormaPago[] = [];
  formasPagoLoading = false;

  planesTarifarios: PlanTarifaUI[] = [];
  planesTarifariosLoading = false;

  listasPrecio: ListaPrecioUI[] = [];
  listasPrecioLoading = false;

  isSubmitting = false;
  showConfirmModal = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  facturaSerie = '';
  facturaNumero = '';
  locked = false;

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
      });

  }

  ngOnInit(): void {
    this.cargarMonedas();
    this.cargarTiposDocumento();
    this.cargarPuntosVenta();
    this.cargarFormasPago();
    this.cargarPlanesTarifarios();
    this.cargarListasPrecio();
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
    this.pagosArray.push(this.createPagoGroup());
    this.syncPagosDefaults();
    this.updateCalculos();
  }

  removePago(index: number): void {
    if (this.locked) return;
    this.pagosArray.removeAt(index);
    this.updateCalculos();
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

  getLineaImpuesto(index: number): number {
    return this.lineasCalculo[index]?.impuesto ?? 0;
  }

  getLineaTotal(index: number): number {
    return this.lineasCalculo[index]?.total ?? 0;
  }

  public abrirModalClientes(): void {
    if (this.locked || this.modoReserva) return;
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
    if (this.locked || this.modoReserva) return;
    this.selectedCliente = cliente;
    this.form.patchValue(
      {
        codCliente: cliente.codigo,
        nomCliente: cliente.nombre,
        rucCliente: cliente.ruc,
        correoCliente: cliente.email || ''
      },
      { emitEvent: false }
    );
    this.cdr.markForCheck();
  }

  public limpiarSeleccionCliente(): void {
    if (this.locked || this.modoReserva) return;
    this.selectedCliente = null;
    this.form.patchValue(
      {
        codCliente: '',
        nomCliente: '',
        rucCliente: '',
        correoCliente: ''
      },
      { emitEvent: false }
    );
    this.cdr.markForCheck();
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
      reglaPrecioId: this.fb.nonNullable.control(0),
      orden: this.fb.nonNullable.control(orden),
      fechaConsumo: this.fb.nonNullable.control(this.form.controls.fechaDocu.value),
      lstPrecio: this.fb.nonNullable.control(this.form.controls.listaPrecio.value),
      codProdu: this.fb.nonNullable.control(''),
      areaProdu: this.fb.nonNullable.control(''),
      descripcion: this.fb.nonNullable.control(''),
      cantidad: this.fb.nonNullable.control(1),
      uMedida: this.fb.nonNullable.control(''),
      pUndLst: this.fb.nonNullable.control(0),
      uniSinImp: this.fb.nonNullable.control(0),
      porDescu: this.fb.nonNullable.control(0),
      porImp: this.fb.nonNullable.control(0),
      porExonera: this.fb.nonNullable.control(0),
      mtoImpVarios: this.fb.nonNullable.control(0),
      saldoPendiente: this.fb.nonNullable.control(0),
      almacen: this.fb.nonNullable.control(''),
      area: this.fb.nonNullable.control(''),
      tipComanda: this.fb.nonNullable.control(''),
      comanda: this.fb.nonNullable.control(''),
      pntVenta: this.fb.nonNullable.control(this.form.controls.pntVenta.value),
      mozo: this.fb.nonNullable.control(''),
      numHabita: this.fb.nonNullable.control('')
    });
  }

  private createPagoGroup(): FormGroup<PagoForm> {
    return this.fb.nonNullable.group({
      orden: this.fb.nonNullable.control(0),
      frmPago: this.fb.nonNullable.control(''),
      tipo: this.fb.nonNullable.control(''),
      tCambio: this.fb.nonNullable.control(this.form.controls.tCambio.value),
      monto: this.fb.nonNullable.control(0),
      moneda: this.fb.nonNullable.control(this.form.controls.moneda.value),
      referencia: this.fb.nonNullable.control(''),
      numTarjeta: this.fb.nonNullable.control(''),
      vencimiento: this.fb.nonNullable.control('')
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
        reglaPrecioId: Number(servicio.reglaPrecioId ?? 0) || 0,
        codProdu: (servicio.codigoServicio || '').toString(),
        descripcion: (servicio.nombreServicio || '').toString(),
        cantidad: 1,
        pUndLst: Number(servicio.precioUnitario ?? 0) || 0,
        uniSinImp: Number(servicio.precioUnitario ?? 0) || 0,
        porDescu: 0,
        porImp: 0,
        fechaConsumo: this.form.controls.fechaDocu.value,
        lstPrecio: this.form.controls.listaPrecio.value,
        pntVenta: this.form.controls.pntVenta.value
      },
      { emitEvent: false }
    );
    this.detalleArray.push(group);
    this.updateCalculos();
    this.cdr.markForCheck();
    this.focusCantidadInput(orden - 1);
  }

  private updateCalculos(): void {
    const lineas: LineaCalculo[] = this.detalleArray.controls.map((group) => {
      const cantidad = this.toNumber(group.controls.cantidad.value);
      const precio = this.toNumber(group.controls.pUndLst.value);
      const porDescu = this.toNumber(group.controls.porDescu.value);
      const porImp = this.toNumber(group.controls.porImp.value);

      const subtotal = cantidad * precio;
      const descuento = subtotal * (porDescu / 100);
      const base = subtotal - descuento;
      const impuestoRate = porImp > 0 ? porImp : 13;
      const impuesto = base * (impuestoRate / 100);
      const total = base + impuesto;

      return {
        subtotal: this.round(subtotal),
        descuento: this.round(descuento),
        base: this.round(base),
        impuesto: this.round(impuesto),
        total: this.round(total)
      };
    });

    this.lineasCalculo.splice(0, this.lineasCalculo.length, ...lineas);

    const resumen = lineas.reduce(
      (acc, item) => {
        acc.subtotal += item.subtotal;
        acc.descuento += item.descuento;
        acc.impuesto += item.impuesto;
        acc.total += item.total;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    );

    this.resumen = {
      subtotal: this.round(resumen.subtotal),
      descuento: this.round(resumen.descuento),
      impuesto: this.round(resumen.impuesto),
      total: this.round(resumen.total)
    };

    const pagos = this.pagosArray.controls.map((group) => this.toNumber(group.controls.monto.value));
    this.pagosTotal = this.round(pagos.reduce((sum, value) => sum + value, 0));

    if (!this.mostrarPagos) {
      this.pagosValid = true;
    } else {
      this.pagosValid = this.round(this.pagosTotal) === this.round(this.resumen.total);
    }

    this.syncPagoTipos();
    this.syncPuntoVentaLock();
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

  private aplicarClienteReserva(cliente: ClienteUI | null, codAgencia: string): void {
    if (cliente) {
      this.selectedCliente = cliente;
      this.form.patchValue(
        {
          codCliente: cliente.codigo,
          nomCliente: cliente.nombre,
          rucCliente: cliente.ruc,
          correoCliente: cliente.email || ''
        },
        { emitEvent: false }
      );
    } else {
      this.selectedCliente = null;
      this.form.patchValue(
        {
          codCliente: codAgencia,
          nomCliente: '',
          rucCliente: '',
          correoCliente: ''
        },
        { emitEvent: false }
      );
    }
    this.setClienteEditable(false);
  }

  private aplicarDetalleReserva(detalles: ReservaPendienteDetalle[]): void {
    this.detalleArray.clear();
    this.lineasCalculo.splice(0, this.lineasCalculo.length);

    detalles
      .filter((item) => this.toNumber(item.saldoPendiente) > 0)
      .forEach((item, index) => {
        const saldo = this.toNumber(item.saldoPendiente);
        const totalPax = this.toNumber(item.totalPax);
        const neto = this.toNumber(item.neto);
        const impuestoMonto = this.toNumber(item.impuesto);
        const porImp = neto > 0 ? (impuestoMonto / neto) * 100 : 0;
        const precioUnit = totalPax > 0 ? neto / totalPax : 0;

        const group = this.createDetalleGroup(index + 1);
        group.patchValue(
          {
            codProdu: (item.codServicio || '').toString(),
            descripcion: (item.nomServicio || '').toString(),
            areaProdu: (item.codGrupo || '').toString(),
            area: (item.codGrupo || '').toString(),
            uMedida: (item.uMedida || '').toString(),
            cantidad: saldo,
            pUndLst: this.round(precioUnit),
            uniSinImp: this.round(precioUnit),
            porDescu: this.toNumber(item.porDescuento),
            porImp: this.round(porImp),
            comanda: (item.id ?? '').toString(),
            saldoPendiente: saldo,
            fechaConsumo: this.form.controls.fechaDocu.value,
            lstPrecio: this.form.controls.listaPrecio.value,
            pntVenta: this.form.controls.pntVenta.value
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

  private setModoReserva(active: boolean): void {
    this.modoReserva = active;
    this.setClienteEditable(!active);
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

          this.tiposDocumento = dataArray ?? [];

          const current = this.form.controls.tipDocu.value;
          const exists = this.tiposDocumento.some((doc) => doc.CA04_CodDocu === current);
          if (!current || !exists) {
            const nextValue = this.tiposDocumento[0]?.CA04_CodDocu ?? '';
            if (nextValue) {
              this.form.controls.tipDocu.setValue(nextValue, { emitEvent: false });
            }
          }
        },
        error: () => {
          this.tiposDocumento = [];
        }
      });
  }

  private buildPayload(): ConfirmarFacturaPayload {
    const value = this.form.getRawValue();
    const fechaDocu = this.formatDate(value.fechaDocu);
    const detalle = this.detalleArray.controls.map((group, index) => {
      const raw = group.getRawValue();
      return {
        orden: index + 1,
        fechaConsumo: fechaDocu,
        lstPrecio: value.listaPrecio,
        codProdu: raw.codProdu,
        areaProdu: raw.areaProdu,
        descripcion: raw.descripcion,
        cantidad: this.toNumber(raw.cantidad),
        uMedida: raw.uMedida,
        pUndLst: this.toNumber(raw.pUndLst),
        uniSinImp: this.toNumber(raw.uniSinImp || raw.pUndLst),
        porDescu: this.toNumber(raw.porDescu),
        porImp: this.toNumber(raw.porImp),
        porExonera: this.toNumber(raw.porExonera),
        mtoImpVarios: this.toNumber(raw.mtoImpVarios),
        almacen: raw.almacen,
        area: raw.area,
        tipComanda: raw.tipComanda,
        comanda: raw.comanda,
        pntVenta: value.pntVenta,
        mozo: raw.mozo,
        numHabita: raw.numHabita
      };
    });

    const pagos = this.mostrarPagos
      ? this.pagosArray.controls.map((group, index) => {
          const raw = group.getRawValue();
          return {
            orden: index + 1,
            frmPago: raw.frmPago,
            tipo: raw.tipo,
            moneda: raw.moneda,
            monto: this.toNumber(raw.monto),
            tCambio: this.toNumber(raw.tCambio || value.tCambio),
            referencia: raw.referencia,
            numTarjeta: raw.numTarjeta,
            vencimiento: this.formatDate(raw.vencimiento)
          };
        })
      : [];

    return {
      tipDocu: value.tipDocu,
      codCliente: value.codCliente,
      rucCliente: value.rucCliente,
      nomCliente: value.nomCliente,
      condicionVenta: value.condicionVenta,
      codReserva: value.codReserva,
      fechaInicio: this.formatDate(value.fechaInicio),
      fechaFin: this.formatDate(value.fechaFin),
      voucherRsv: value.voucherRsv,
      nProveedor: value.nProveedor,
      habitacion: value.habitacion,
      master: value.master,
      fechaDocu,
      pntVenta: value.pntVenta,
      numMesa: value.numMesa,
      numPax: this.toNumber(value.numPax),
      codVendedor: value.codVendedor,
      moneda: value.moneda,
      tCambio: this.toNumber(value.tCambio),
      codigoActividad: value.codigoActividad,
      observacion: value.observacion,
      operador: value.operador,
      detalle,
      pagos,
      respuesta: value.respuesta,
      serie: value.serie,
      numero: value.numero
    };
  }

  private toNumber(value: number | string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
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
