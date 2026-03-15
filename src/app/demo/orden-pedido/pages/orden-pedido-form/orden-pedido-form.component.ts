import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormArray, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, finalize } from 'rxjs/operators';

import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { ActividadComercialService } from 'src/app/demo/catalogos/agencias-comisionistas/actividad-comercial/actividad-comercial.service';
import { ListaPrecioUI } from 'src/app/demo/catalogos/listas-precios/lista-precio.models';
import { ListaPrecioService } from 'src/app/demo/catalogos/listas-precios/lista-precio.service';
import { PlanesTarifasService, PlanTarifaUI } from 'src/app/demo/catalogos/listas-precios/planes-tarifas.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { NuevaFacturaClienteModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/nueva-factura-cliente-modal/nueva-factura-cliente-modal.component';
import { SelectorServiciosModalComponent } from 'src/app/finanzas/pages-factura/nueva-factura/selector-servicios-modal/selector-servicios-modal.component';
import { ModoPrecio, ServicioListaPrecioItem } from 'src/app/finanzas/services/servicios-lista-precio.service';
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
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, NuevaFacturaClienteModalComponent, SelectorServiciosModalComponent],
  templateUrl: './orden-pedido-form.component.html',
  styleUrls: ['./orden-pedido-form.component.scss']
})
export class OrdenPedidoFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly actividadComercialService = inject(ActividadComercialService);
  private readonly planesTarifasService = inject(PlanesTarifasService);
  private readonly listaPrecioService = inject(ListaPrecioService);
  private readonly monedaService = inject(MonedaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordenPedidoService = inject(OrdenPedidoService);

  readonly empresa = this.empresaContext.empresa;
  readonly tiposDocumento = [
    { value: 'ORD', label: 'Orden de Pedido' },
    { value: 'PRO', label: 'Proforma' }
  ];
  readonly formasPagoDisponibles = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CREDITO'];

  readonly form = this.fb.group({
    tipNDP: this.fb.control('ORD', { validators: [Validators.required] }),
    pntVenta: this.fb.control(''),
    moneda: this.fb.control(''),
    planTarifario: this.fb.control(''),
    listaPrecio: this.fb.control(''),
    fecNDP: this.fb.control(this.getTodayIsoDate(), { validators: [Validators.required] }),
    horaNDP: this.fb.control(this.getCurrentTime(), { validators: [Validators.required] }),
    codVendedor: this.fb.control(''),
    codCliente: this.fb.control(''),
    rucCliente: this.fb.control(''),
    nomCliente: this.fb.control('', { validators: [Validators.required] }),
    observaciones: this.fb.control(''),
    detalle: this.fb.array<FormGroup>([], { validators: [Validators.required] }),
    pagos: this.fb.array<FormGroup>([]),
    subTotal: this.fb.control(0),
    impuesto: this.fb.control(0),
    totDocu: this.fb.control(0),
    totalPago: this.fb.control(0),
    exoneracionActiva: this.fb.control(false),
    exoneracion: this.fb.group({
      tipoDocumentoEX1: this.fb.control(''),
      numeroDocumento: this.fb.control(''),
      nombreInstitucion: this.fb.control(''),
      tarifaExonerada: this.fb.control(0),
      montoExoneracion: this.fb.control(0)
    })
  });

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';
  monedasCatalogo: MonedaUI[] = [];
  puntosVentaCatalogo: PuntoVentaUI[] = [];
  planesTarifariosCatalogo: PlanTarifaUI[] = [];
  listasPrecioCatalogo: ListaPrecioUI[] = [];
  monedasLoading = false;
  puntosVentaLoading = false;
  planesTarifariosLoading = false;
  listasPrecioLoading = false;
  showClienteModal = false;
  selectedCliente: ClienteUI | null = null;
  showServicioModal = false;
  clienteCorreo = '';
  clienteCodigoActividad = '';
  clienteActividadLoading = false;
  private clienteActividadCedula = '';
  private previousListaPrecio = '';
  private suppressListaPrecioChange = false;

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.usuario) {
      this.form.controls.codVendedor.setValue(currentUser.usuario);
    }

    this.addPago();

    this.detalleArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateTotals());
    this.pagosArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updateTotalPago());
    this.form.controls.moneda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((moneda) => {
      this.syncPagosMoneda(moneda);
    });
    this.form.controls.listaPrecio.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((listaPrecio) => {
        this.onListaPrecioChange((listaPrecio || '').toString());
      });
    this.form.controls.exoneracionActiva.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((active) => {
      if (!active) {
        this.form.controls.exoneracion.reset({
          tipoDocumentoEX1: '',
          numeroDocumento: '',
          nombreInstitucion: '',
          tarifaExonerada: 0,
          montoExoneracion: 0
        });
      }
      this.recalculateTotals();
    });
    this.form.controls.exoneracion.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateTotals());

    this.loadMonedas();
    this.loadPuntosVenta();
    this.loadPlanesTarifarios();
    this.loadListasPrecio();
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
    this.pagosArray.push(
      this.fb.group({
        frmPago: this.fb.control('EFECTIVO'),
        referencia: this.fb.control(''),
        moneda: this.fb.control(this.form.controls.moneda.value || ''),
        monto: this.fb.control(0),
        tCambio: this.fb.control(1)
      })
    );
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
    this.showClienteModal = true;
  }

  abrirModalServicios(): void {
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

  onClienteSelected(cliente: ClienteUI): void {
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
  }

  onServicioSelected(servicio: ServicioListaPrecioItem): void {
    this.showServicioModal = false;
    this.addDetalleFromServicio(servicio);
  }

  limpiarSeleccionCliente(): void {
    this.selectedCliente = null;
    this.clienteCorreo = '';
    this.clienteCodigoActividad = '';
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
  }

  guardar(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.form.invalid || this.detalleArray.length === 0) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Complete la información general y agregue al menos un producto válido.';
      return;
    }

    const payload = this.buildPayload();
    this.isSubmitting = true;

    this.ordenPedidoService
      .crearOrden(payload)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          this.successMessage = response?.mensaje || response?.respuesta || 'La orden fue creada correctamente.';
        },
        error: (error: Error) => {
          this.errorMessage = error.message || 'No se pudo crear la orden.';
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  get tipoDocumentoLabel(): string {
    return this.form.controls.tipNDP.value === 'PRO' ? 'Proforma Comercial' : 'Orden de Pedido Comercial';
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
    const totalPago = this.pagosArray.controls.reduce((acc, group) => acc + this.toNumber(group.get('monto')?.value), 0);
    this.form.controls.totalPago.setValue(this.round(totalPago), { emitEvent: false });
  }

  private createDetalleGroup(): FormGroup {
    return this.fb.group({
      codProdu: this.fb.control(''),
      producto: this.fb.control('', { validators: [Validators.required] }),
      area: this.fb.control(''),
      uMedida: this.fb.control('UND'),
      canProdu: this.fb.control(1, { validators: [Validators.required, Validators.min(0.01)] }),
      pUndLst: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      porDescu: this.fb.control(0),
      mtoDescu: this.fb.control(0),
      totalNeto: this.fb.control(0),
      porImpu: this.fb.control(13),
      mtoImpu: this.fb.control(0),
      mtoTotal: this.fb.control(0)
    });
  }

  private addDetalleFromServicio(servicio: ServicioListaPrecioItem): void {
    const group = this.createDetalleGroup();
    group.patchValue(
      {
        codProdu: (servicio.codigoServicio || '').toString(),
        producto: (servicio.nombreServicio || '').toString(),
        canProdu: 1,
        pUndLst: Number(servicio.precioUnitario ?? 0) || 0,
        porDescu: 0,
        porImpu: 13
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
        },
        error: () => {
          this.monedasCatalogo = [];
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
            return;
          }

          this.previousListaPrecio = (current || '').toString();
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

  private applyPuntosVentaCatalogo(puntosVenta: PuntoVentaUI[]): void {
    this.puntosVentaCatalogo = puntosVenta;

    const current = this.form.controls.pntVenta.value;
    const exists = puntosVenta.some((item) => item.codigo === current);
    if (!current || !exists) {
      this.form.controls.pntVenta.setValue(puntosVenta[0]?.codigo ?? '', { emitEvent: false });
    }
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
    const detalle = this.detalleArray.getRawValue().map((item) => this.mapDetalle(item as Record<string, unknown>));
    const formasPago = this.pagosArray.getRawValue().map((item) => this.mapPago(item as Record<string, unknown>));
    const exoneracion = this.form.controls.exoneracionActiva.value ? this.mapExoneracion() : null;

    return {
      tipNDP: this.form.controls.tipNDP.value,
      serieNDP: '',
      numeroNDP: '',
      pntVenta: this.form.controls.pntVenta.value,
      fecNDP: this.formatDateForApi(this.form.controls.fecNDP.value),
      horaNDP: this.form.controls.horaNDP.value,
      codVendedor: this.form.controls.codVendedor.value,
      codCliente: this.form.controls.codCliente.value,
      rucCliente: this.form.controls.rucCliente.value,
      nomCliente: this.form.controls.nomCliente.value,
      observaciones: this.form.controls.observaciones.value,
      detalle,
      formasPago,
      subTotal: this.round(this.form.controls.subTotal.value),
      impuesto: this.round(this.form.controls.impuesto.value),
      totDocu: this.round(this.form.controls.totDocu.value),
      totalPago: this.round(this.form.controls.totalPago.value),
      exoneracion
    };
  }

  private mapDetalle(item: Record<string, unknown>): OrdenPedidoDetalleItem {
    return {
      codProdu: String(item['codProdu'] ?? ''),
      producto: String(item['producto'] ?? ''),
      area: String(item['area'] ?? ''),
      uMedida: String(item['uMedida'] ?? ''),
      canProdu: this.toNumber(item['canProdu']),
      pUndLst: this.toNumber(item['pUndLst']),
      porDescu: this.toNumber(item['porDescu']),
      mtoDescu: this.toNumber(item['mtoDescu']),
      totalNeto: this.toNumber(item['totalNeto']),
      porImpu: this.toNumber(item['porImpu']),
      mtoImpu: this.toNumber(item['mtoImpu']),
      mtoTotal: this.toNumber(item['mtoTotal'])
    };
  }

  private mapPago(item: Record<string, unknown>): OrdenPedidoPagoItem {
    return {
      frmPago: String(item['frmPago'] ?? ''),
      referencia: String(item['referencia'] ?? ''),
      moneda: String(item['moneda'] ?? ''),
      monto: this.toNumber(item['monto']),
      tCambio: this.toNumber(item['tCambio'])
    };
  }

  private mapExoneracion(): OrdenPedidoExoneracion {
    const ex = this.form.controls.exoneracion.getRawValue();
    return {
      tipoDocumentoEX1: ex.tipoDocumentoEX1,
      numeroDocumento: ex.numeroDocumento,
      nombreInstitucion: ex.nombreInstitucion,
      tarifaExonerada: this.toNumber(ex.tarifaExonerada),
      montoExoneracion: this.toNumber(ex.montoExoneracion)
    };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private syncPagosMoneda(moneda: string): void {
    const selectedMoneda = String(moneda ?? '').trim();
    if (!selectedMoneda) {
      return;
    }

    this.pagosArray.controls.forEach((group) => {
      group.controls['moneda'].setValue(selectedMoneda, { emitEvent: false });
    });
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
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
