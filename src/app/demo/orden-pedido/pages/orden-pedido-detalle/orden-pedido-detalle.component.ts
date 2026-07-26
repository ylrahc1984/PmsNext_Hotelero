import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  CambioFormaPagoPedidoPayload,
  OrdenPedidoCompletaCliente,
  OrdenPedidoCompletaDetalleItem,
  OrdenPedidoCompletaEncabezado,
  OrdenPedidoCompletaFormaPago
} from '../../interfaces/orden-pedido.interface';
import { OrdenPedidoService } from '../../services/orden-pedido.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { AuthService } from 'src/app/core/services/auth.service';

type TotalesResumen = {
  subtotal      : number;
  descuento     : number;
  impuesto      : number;
  total         : number;
};

type CambioPagoPedidoForm = {
  orden           : FormControl<number>;
  frmPago         : FormControl<string>;
  tipo            : FormControl<string>;
  moneda          : FormControl<string>;
  monto           : FormControl<number>;
  tCambio         : FormControl<number>;
  referencia      : FormControl<string>;
  numTarjeta      : FormControl<string>;
  vencimiento     : FormControl<string>;
};

type CambioFormaPagoPedidoForm = {
  motivo            : FormControl<string>;
  pagos             : FormArray<FormGroup<CambioPagoPedidoForm>>;
};

@Component({
  selector: 'app-orden-pedido-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './orden-pedido-detalle.component.html',
  styleUrls: ['./orden-pedido-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdenPedidoDetalleComponent implements OnInit {
  private readonly fb   = inject(NonNullableFormBuilder);
  tipOrden              = '';
  serie                 = '';
  numero                = '';

  encabezado            : OrdenPedidoCompletaEncabezado | null = null;
  cliente               : OrdenPedidoCompletaCliente | null = null;
  detalle               : OrdenPedidoCompletaDetalleItem[] = [];
  formasPago            : OrdenPedidoCompletaFormaPago[] = [];

  resumen               : TotalesResumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
  totalFormasPago       = 0;

  loading                      = false;
  errorMsg                     : string | null = null;
  showCambioFormaPagoModal     = false;
  formasPagoCatalogo           : FormaPago[] = [];
  formasPagoLoading            = false;
  cambioFormaPagoSaving        = false;
  cambioFormaPagoError         : string | null = null;
  cambioFormaPagoSuccess       : string | null = null;

  private readonly route              = inject(ActivatedRoute);
  private readonly router             = inject(Router);
  private readonly service            = inject(OrdenPedidoService);
  private readonly formaPagoService   = inject(FormaPagoService);
  private readonly authService        = inject(AuthService);
  private readonly destroyRef         = inject(DestroyRef);
  private readonly cdr                = inject(ChangeDetectorRef);

  readonly cambioFormaPagoForm: FormGroup<CambioFormaPagoPedidoForm> = this.fb.group({
    motivo: this.fb.control('', { validators: [Validators.required, Validators.minLength(5), Validators.maxLength(250)] }),
    pagos: this.fb.array<FormGroup<CambioPagoPedidoForm>>([])
  });

  private activeRequest?: Subscription;

  ngOnInit(): void {
    this.cargarFormasPago();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tip = (params.get('tipOrden') ?? '').toString().trim();
      const serie = (params.get('serie') ?? '').toString().trim() || '000';
      const numero = (params.get('numero') ?? '').toString().trim();

      if (!tip || !numero) {
        void this.router.navigate([this.listRoute]);
        return;
      }

      this.tipOrden = tip;
      this.serie = serie;
      this.numero = numero;
      this.loadDetalle();
    });
  }

  get documentoCodigo(): string {
    const tip = this.encabezado?.tipNDP || this.tipOrden;
    const serie = this.encabezado?.serieNDP || this.serie;
    const numero = this.encabezado?.numNDP || this.numero;
    return [tip, serie, numero].filter((item) => !!item).join(' / ');
  }

  get isFrontDeskContext(): boolean {
    return this.router.url.startsWith('/front-desk/recibos-comerciales');
  }

  get estadoDocumentoLabel(): string {
    const raw = (this.encabezado?.estadoDocumento ?? '').toString().trim();
    return raw || 'N/D';
  }

  get estadoBadgeClass(): string {
    const normalized = this.normalizeEstado(this.encabezado?.estadoDocumento);
    if (normalized === 'OPEN') return 'is-open';
    if (normalized === 'CONFIRMED') return 'is-confirmed';
    if (normalized === 'CANCELLED') return 'is-cancelled';
    return 'is-unknown';
  }

  get monedaDocumento(): string {
    return this.encabezado?.moneda || this.detalle[0]?.moneda || this.formasPago[0]?.moneda || 'N/D';
  }

  get subtotalGeneral(): number {
    return this.resumen.subtotal || this.encabezado?.subtotal || 0;
  }

  get descuentoGeneral(): number {
    return this.resumen.descuento || 0;
  }

  get impuestoGeneral(): number {
    return this.resumen.impuesto || this.encabezado?.impuesto || 0;
  }

  get totalGeneral(): number {
    return this.encabezado?.totalDocumento || this.resumen.total || 0;
  }

  get totalPagadoVista(): number {
    if (this.totalFormasPago > 0) return this.totalFormasPago;
    return this.encabezado?.totalPago || 0;
  }

  get isPagoCompleto(): boolean {
    const total = this.totalGeneral;
    if (total <= 0) return false;
    return this.totalPagadoVista + 0.01 >= total;
  }

  get cambioPagoArray(): FormArray<FormGroup<CambioPagoPedidoForm>> {
    return this.cambioFormaPagoForm.controls.pagos;
  }

  get cambioFormaPagoPuedeGuardar(): boolean {
    return (
      this.cambioFormaPagoForm.valid &&
      this.cambioPagoArray.length > 0 &&
      !this.cambioFormaPagoSaving &&
      !this.formasPagoLoading
    );
  }

  get operadorActual(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  reload(): void {
    this.loadDetalle();
  }

  backToList(): void {
    void this.router.navigate([this.listRoute]);
  }

  abrirCambioFormaPago(): void {
    if (this.loading || !this.encabezado || this.formasPago.length === 0) return;
    this.cambioFormaPagoError = null;
    this.cambioFormaPagoSuccess = null;
    this.rebuildCambioFormaPagoForm();
    this.showCambioFormaPagoModal = true;
    if (!this.formasPagoCatalogo.length && !this.formasPagoLoading) {
      this.cargarFormasPago();
    }
    this.cdr.markForCheck();
  }

  cerrarCambioFormaPago(): void {
    if (this.cambioFormaPagoSaving) return;
    this.showCambioFormaPagoModal = false;
    this.cambioFormaPagoError = null;
    this.cdr.markForCheck();
  }

  onCambioFrmPagoChange(index: number): void {
    const group = this.cambioPagoArray.at(index);
    if (!group) return;
    const codigo = group.controls.frmPago.value;
    const tipo = this.formasPagoCatalogo.find((fp) => fp.codigo === codigo)?.tipoPago ?? '';
    group.controls.tipo.setValue(tipo, { emitEvent: false });
  }

  guardarCambioFormaPago(): void {
    this.cambioFormaPagoForm.markAllAsTouched();
    this.cambioFormaPagoError = null;
    if (!this.cambioFormaPagoPuedeGuardar) {
      this.cambioFormaPagoError = 'Complete la forma de pago y el motivo antes de guardar.';
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildCambioFormaPagoPayload();
    console.log('POST cambio-forma-pago-pedido payload', payload);
    this.cambioFormaPagoSaving = true;
    this.service
      .cambiarFormaPagoPedido(payload)
      .pipe(
        finalize(() => {
          this.cambioFormaPagoSaving = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.cambioFormaPagoSuccess = response?.mensaje || response?.respuesta || 'Forma de pago actualizada correctamente.';
          this.showCambioFormaPagoModal = false;
          this.loadDetalle();
        },
        error: (error: unknown) => {
          this.cambioFormaPagoError = this.getErrorMessage(error, 'No se pudo cambiar la forma de pago del pedido.');
        }
      });
  }

  trackByDetalle(index: number, item: OrdenPedidoCompletaDetalleItem): string {
    return `${item.orden}-${item.codProducto}-${index}`;
  }

  trackByPago(index: number, item: OrdenPedidoCompletaFormaPago): string {
    return `${item.orden}-${item.formaPago}-${index}`;
  }

  getCategoriaClass(categoria: string): string {
    const raw = (categoria ?? '').toString().trim().toUpperCase();
    if (!raw) return 'op-pill--neutral';
    if (raw.includes('TOUR')) return 'op-pill--tours';
    if (raw.includes('TRANSP')) return 'op-pill--transporte';
    if (raw.includes('SERV')) return 'op-pill--servicios';
    return 'op-pill--neutral';
  }

  formatFecha(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return 'N/D';
    }

    const normalized = raw.replace('T', ' ');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return raw;
  }

  private loadDetalle(): void {
    this.activeRequest?.unsubscribe();
    this.loading = true;
    this.errorMsg = null;
    this.cdr.markForCheck();

    this.activeRequest = this.service
      .getOrdenCompleta(this.tipOrden, this.serie, this.numero)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.encabezado = response.encabezado;
          this.cliente = response.cliente;
          this.detalle = response.detalle;
          this.formasPago = response.formasPago;
          this.updateResumen();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.encabezado = null;
          this.cliente = null;
          this.detalle = [];
          this.formasPago = [];
          this.resumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
          this.totalFormasPago = 0;
          this.loading = false;
          this.errorMsg = this.getErrorMessage(error);
          this.cdr.markForCheck();
        }
      });
  }

  private updateResumen(): void {
    this.resumen = this.detalle.reduce<TotalesResumen>(
      (acc, item) => {
        acc.subtotal += item.subtotalSinImpuesto;
        acc.descuento += item.descuento;
        acc.impuesto += item.impuesto;
        acc.total += item.totalLinea;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    );

    this.totalFormasPago = this.formasPago.reduce((acc, item) => acc + item.monto, 0);
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
        next: (response) => {
          this.formasPagoCatalogo = (response ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          this.syncCambioPagoTipos();
        },
        error: () => {
          this.formasPagoCatalogo = [];
        }
      });
  }

  private get listRoute(): string {
    return this.isFrontDeskContext
      ? '/front-desk/recibos-comerciales'
      : '/demo/ordenes-pedido';
  }

  private rebuildCambioFormaPagoForm(): void {
    this.cambioPagoArray.clear();
    this.formasPago.forEach((pago, index) => {
      this.cambioPagoArray.push(this.createCambioPagoGroup(pago, index));
    });
    this.cambioFormaPagoForm.controls.motivo.setValue('', { emitEvent: false });
    this.cambioFormaPagoForm.markAsPristine();
    this.cambioFormaPagoForm.markAsUntouched();
    this.syncCambioPagoTipos();
  }

  private createCambioPagoGroup(pago: OrdenPedidoCompletaFormaPago, index: number): FormGroup<CambioPagoPedidoForm> {
    return this.fb.group({
      orden: this.fb.control(this.toNumber(pago.orden || index + 1)),
      frmPago: this.fb.control((pago.formaPago ?? '').toString(), { validators: [Validators.required] }),
      tipo: this.fb.control((pago.tipo ?? '').toString()),
      moneda: this.fb.control((pago.moneda ?? '').toString()),
      monto: this.fb.control(this.toNumber(pago.monto)),
      tCambio: this.fb.control(this.toNumber(pago.tipoCambio)),
      referencia: this.fb.control((pago.referencia ?? '').toString(), { validators: [Validators.maxLength(50)] }),
      numTarjeta: this.fb.control((pago.numeroTarjeta ?? '').toString(), { validators: [Validators.maxLength(30)] }),
      vencimiento: this.fb.control((pago.vencimiento ?? '').toString(), { validators: [Validators.maxLength(20)] })
    });
  }

  private syncCambioPagoTipos(): void {
    if (!this.formasPagoCatalogo.length || this.cambioPagoArray.length === 0) return;
    this.cambioPagoArray.controls.forEach((group) => {
      const codigo = group.controls.frmPago.value;
      const tipo = this.formasPagoCatalogo.find((fp) => fp.codigo === codigo)?.tipoPago ?? group.controls.tipo.value;
      group.controls.tipo.setValue(tipo, { emitEvent: false });
    });
  }

  private buildCambioFormaPagoPayload(): CambioFormaPagoPedidoPayload {
    const raw = this.cambioFormaPagoForm.getRawValue();
    return {
      tipoDocu: this.encabezado?.tipNDP || this.tipOrden,
      serie: this.encabezado?.serieNDP || this.serie || '000',
      numDocu: this.encabezado?.numNDP || this.numero,
      pagos: raw.pagos.map((pago, index) => ({
        orden: this.toNumber(pago.orden || index + 1),
        frmPago: (pago.frmPago || '').trim(),
        tipo: (pago.tipo || '').trim(),
        numTarjeta: (pago.numTarjeta || '').trim(),
        referencia: (pago.referencia || '').trim(),
        moneda: (pago.moneda || '').trim(),
        monto: this.toNumber(pago.monto),
        tCambio: this.toNumber(pago.tCambio),
        vencimiento: (pago.vencimiento || '').trim()
      })),
      operador: this.operadorActual,
      motivo: raw.motivo.trim()
    };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getErrorMessage(error: unknown, fallback = 'No se pudo cargar el detalle de la orden de pedido.'): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
    return fallback;
  }

  private normalizeEstado(estado: string | null | undefined): 'OPEN' | 'CONFIRMED' | 'CANCELLED' | 'UNKNOWN' {
    const value = (estado ?? '').toString().trim().toUpperCase();
    if (!value) return 'UNKNOWN';

    if (
      value === 'ABI' ||
      value === 'ABIERTO' ||
      value === 'PEN' ||
      value === 'PENDIENTE' ||
      value === 'BORRADOR'
    ) {
      return 'OPEN';
    }

    if (
      value === 'CON' ||
      value === 'CONFIRMADO' ||
      value === 'CONFIRMADA' ||
      value === 'CER' ||
      value === 'CERRADO'
    ) {
      return 'CONFIRMED';
    }

    if (
      value === 'CAN' ||
      value === 'ANU' ||
      value === 'ANULADO' ||
      value === 'ANULADA'
    ) {
      return 'CANCELLED';
    }

    return 'UNKNOWN';
  }
}
