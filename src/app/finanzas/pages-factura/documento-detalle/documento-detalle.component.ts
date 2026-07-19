import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DocumentoDetalleService } from '../../services/documento-detalle.service';
import { FacturacionDocumentosService } from '../../services/facturacion-documentos.service';
import {
  CambioFormaPagoPayload,
  DocumentoDetalleEncabezadoApi,
  DocumentoDetalleFormaPagoApi,
  DocumentoDetalleItem,
  DocumentoDetalleItemApi,
  DocumentoDetalleResponse,
  DocumentoEncabezado,
  DocumentoPago
} from './documento-detalle.interface';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { PosDocumentPrintBuilder } from 'src/app/core/printing/pos-document-print.builder';
import { ToastService } from 'src/app/core/services/toast.service';

type DocumentoResumen = {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
};

type CambioPagoForm = {
  orden: FormControl<number>;
  frmPago: FormControl<string>;
  tipo: FormControl<string>;
  moneda: FormControl<string>;
  monto: FormControl<number>;
  tCambio: FormControl<number>;
  referencia: FormControl<string>;
  numTarjeta: FormControl<string>;
  vencimiento: FormControl<string>;
};

type CambioFormaPagoForm = {
  motivo: FormControl<string>;
  pagos: FormArray<FormGroup<CambioPagoForm>>;
};

type DocumentoElectronicoKey = 'pdf' | 'xmlFirmado' | 'xmlRespuesta';

@Component({
  selector: 'app-documento-detalle',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './documento-detalle.component.html',
  styleUrls: ['./documento-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentoDetalleComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  tipoDocu = '';
  serieDocu = '';
  numeroDocu = '';
  operador = '';

  encabezado: DocumentoEncabezado | null = null;
  detalle: DocumentoDetalleItem[] = [];
  pagos: DocumentoPago[] = [];

  resumen: DocumentoResumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
  pagosTotal = 0;

  loading = false;
  errorMsg: string | null = null;
  busyPos = false;
  downloadingDocumento: Record<DocumentoElectronicoKey, boolean> = {
    pdf: false,
    xmlFirmado: false,
    xmlRespuesta: false
  };
  showCambioFormaPagoModal = false;
  formasPago: FormaPago[] = [];
  formasPagoLoading = false;
  cambioFormaPagoSaving = false;
  cambioFormaPagoError: string | null = null;
  cambioFormaPagoSuccess: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detalleService = inject(DocumentoDetalleService);
  private readonly facturacionDocumentosService = inject(FacturacionDocumentosService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly authService = inject(AuthService);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly posDocumentPrintBuilder = inject(PosDocumentPrintBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly empresaContext = inject(EmpresaContextService);

  readonly empresa = this.empresaContext.empresa;
  readonly cambioFormaPagoForm: FormGroup<CambioFormaPagoForm> = this.fb.group({
    motivo: this.fb.control('', { validators: [Validators.required, Validators.minLength(5), Validators.maxLength(250)] }),
    pagos: this.fb.array<FormGroup<CambioPagoForm>>([])
  });

  private activeRequest?: Subscription;

  ngOnInit(): void {
    this.cargarFormasPago();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tipo = (params.get('tipo') ?? '').toString().trim();
      const serie = (params.get('serie') ?? '000').toString().trim();
      const numero = (params.get('numero') ?? '').toString().trim();
      const operador = (this.route.snapshot.queryParamMap.get('operador') ?? this.operadorActual).toString().trim();
      if (!tipo || !numero || !operador) {
        this.router.navigate(['/finanzas/consulta-documentos']);
        return;
      }
      this.tipoDocu = tipo;
      this.serieDocu = serie || '000';
      this.numeroDocu = numero;
      this.operador = operador;
      this.fetchDetalle();
    });
  }

  get documentoCodigo(): string {
    if (!this.encabezado) return this.numeroDocu;
    const serie = (this.encabezado.serie ?? '').toString().trim();
    const numero = (this.encabezado.numeroConsecutivo ?? this.numeroDocu).toString();
    const fallbackSerie = (this.serieDocu ?? '').toString().trim();
    const serieValue = serie || fallbackSerie;
    return serieValue ? `${numero}` : numero;
  }

  get hasReservaInfo(): boolean {
    const h = this.encabezado;
    if (!h) return false;
    const numMesa = (h.numMesa ?? '').toString().trim();
    const flags = [
      h.codReserva,
      h.fechaInicio,
      h.fechaFin,
      h.voucherRsv,
      h.nProveedor,
      h.habitacion,
      h.master
    ]
      .map((value) => (value ?? '').toString().trim())
      .some(Boolean);
    return flags || (!!numMesa && numMesa !== '0') || Number.isFinite(h.numPax ?? NaN);
  }

  reload(): void {
    this.fetchDetalle();
  }

  descargarDocumentoElectronico(tipoArchivo: DocumentoElectronicoKey): void {
    if (this.downloadingDocumento[tipoArchivo]) return;

    const referencia = this.getDocumentoReferencia();
    if (!referencia.tipo || !referencia.numero) {
      this.toast.warning('No se encontró la referencia del documento para descargar.');
      return;
    }

    const config = this.getDescargaElectronicaConfig(tipoArchivo);
    this.downloadingDocumento = {
      ...this.downloadingDocumento,
      [tipoArchivo]: true
    };
    this.cdr.markForCheck();

    config
      .request(referencia.tipo, referencia.serie, referencia.numero)
      .pipe(
        finalize(() => {
          this.downloadingDocumento = {
            ...this.downloadingDocumento,
            [tipoArchivo]: false
          };
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.downloadBlobResponse(response, config.filename, config.mimeType);
          this.toast.success(`${config.label} descargado correctamente.`, 2500);
        },
        error: (error: unknown) => {
          this.toast.error(this.getErrorMessage(error, 'No fue posible descargar el archivo'));
        }
      });
  }

  get cambioPagoArray(): FormArray<FormGroup<CambioPagoForm>> {
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

  abrirCambioFormaPago(): void {
    if (this.loading || !this.encabezado || this.pagos.length === 0) return;
    this.cambioFormaPagoError = null;
    this.cambioFormaPagoSuccess = null;
    this.rebuildCambioFormaPagoForm();
    this.showCambioFormaPagoModal = true;
    if (!this.formasPago.length && !this.formasPagoLoading) {
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
    const tipo = this.formasPago.find((fp) => fp.codigo === codigo)?.tipoPago ?? '';
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
    console.log('POST cambio-forma-pago payload', payload);
    this.cambioFormaPagoSaving = true;
    this.detalleService
      .cambiarFormaPago(payload)
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
          this.fetchDetalle();
        },
        error: (error: unknown) => {
          this.cambioFormaPagoError = this.getErrorMessage(error, 'No se pudo cambiar la forma de pago.');
        }
      });
  }

  imprimirDocumento(): void {
    this.descargarDocumentoElectronico('pdf');
  }

  async imprimirDocumentoPos(): Promise<void> {
    if (this.busyPos || !this.encabezado) return;

    this.busyPos = true;
    this.cdr.markForCheck();

    try {
      const empresa = this.empresa();
      const commands = this.posDocumentPrintBuilder.build({
        empresaNombre: (empresa?.MA04_Nombre ?? empresa?.MA04_RazonSocial ?? '').toString().trim(),
        empresaRuc: (empresa?.MA04_Ruc ?? '').toString().trim(),
        encabezado: this.encabezado,
        detalle: this.detalle,
        pagos: this.pagos,
        resumen: this.resumen
      });

      await this.qzPrintService.printRaw(commands);
    } catch (error: unknown) {
      window.alert(this.getErrorMessage(error, 'No se pudo imprimir el documento en POS.'));
    } finally {
      this.busyPos = false;
      this.cdr.markForCheck();
    }
  }

  trackByDetalle(index: number, item: DocumentoDetalleItem): string {
    return `${item.orden ?? index}-${item.codProdu ?? ''}-${index}`;
  }

  trackByPago(index: number, item: DocumentoPago): string {
    return `${item.orden ?? index}-${item.frmPago ?? ''}-${index}`;
  }

  estadoDocumentoClass(estado: string | undefined): string {
    const normalized = (estado ?? '').toUpperCase().trim();
    if (normalized === 'C') return 'bg-success';
    if (normalized === 'A') return 'bg-danger';
    if (normalized === 'P') return 'bg-warning';
    return 'bg-secondary';
  }

  estadoElectronicoClass(estado: string | undefined): string {
    const normalized = (estado ?? '').toUpperCase().trim();
    if (normalized === 'ACEPTADO') return 'bg-success';
    if (normalized === 'RECHAZADO') return 'bg-danger';
    if (normalized === 'PENDIENTE') return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  getLineaImpuesto(item: DocumentoDetalleItem): number {
    const subtotal = this.getLineaSubtotal(item);
    const descuento = this.getLineaDescuento(item, subtotal);
    const base = subtotal - descuento;
    return this.round(this.getLineaImpuestoValue(item, base));
  }

  getLineaTotal(item: DocumentoDetalleItem): number {
    const subtotal = this.getLineaSubtotal(item);
    const descuento = this.getLineaDescuento(item, subtotal);
    const base = subtotal - descuento;
    const impuesto = this.getLineaImpuestoValue(item, base);
    const total = this.getLineaTotalValue(item, base, impuesto);
    return this.round(total);
  }

  private fetchDetalle(): void {
    if (!this.tipoDocu || !this.numeroDocu) return;

    this.activeRequest?.unsubscribe();
    this.loading = true;
    this.errorMsg = null;
    this.cdr.markForCheck();

    this.activeRequest = this.detalleService
      .getDetalle(this.tipoDocu, this.serieDocu || '000', this.numeroDocu, this.operador)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyResponse(response);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.encabezado = null;
          this.detalle = [];
          this.pagos = [];
          this.resumen = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
          this.pagosTotal = 0;
          this.errorMsg = this.getErrorMessage(error);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private applyResponse(response: DocumentoDetalleResponse | null | undefined): void {
    this.encabezado = response?.encabezado ? this.mapEncabezado(response.encabezado) : null;
    this.detalle = (response?.detalle ?? []).map((item) => this.mapDetalle(item));
    this.pagos = (response?.formasPago ?? []).map((item) => this.mapPago(item));
    this.updateResumen();
  }

  private mapEncabezado(raw: DocumentoDetalleEncabezadoApi): DocumentoEncabezado {
    return {
      tipDocu: raw.ppV00_TipoDocu || this.tipoDocu,
      serie: raw.ppV00_Serie || this.serieDocu,
      numero: raw.ppV00_NumDocu || this.numeroDocu,
      numeroConsecutivo: raw.ppV15_NumeroConsecutivo || '',
      clave: raw.ppV15_Clave || '',
      fechaDocu: this.formatDate(raw.ppV00_FechaDocu),
      condicionVenta: raw.ppV15_Condicion_Venta || '',
      codCliente: raw.ppV00_CodCliente || '',
      rucCliente: raw.ppV00_RucCliente || '',
      nomCliente: raw.ppV00_NomCliente || '',
      moneda: raw.ppV00_Moneda || '',
      tCambio: this.toNumber(raw.ppV00_TCambio),
      pntVenta: raw.ppV00_PntVenta || '',
      numMesa: raw.ppV00_NumMesa || '',
      numPax: this.toOptionalNumber(raw.ppV00_NumPax),
      codVendedor: raw.ppV15_Vendedor || raw.ppV00_CodMozo || '',
      codReserva: raw.ppV00_CodReserva || '',
      habitacion: raw.ppV00_Habitacion || '',
      master: raw.ppV00_Master || '',
      subtotal: this.toOptionalNumber(raw.ppV00_SubTotal),
      descuento: this.toOptionalNumber(raw.ppV00_Descuento),
      impuesto: this.toOptionalNumber(raw.ppV00_Impuesto),
      totalDocu: this.toOptionalNumber(raw.ppV00_TotalDocu),
      totalPago: this.toOptionalNumber(raw.ppV00_TotalPago),
      estadoDocu: raw.ppV00_EstDocu || '',
      estadoElectronico: raw.ppV15_Estado_Comprobante || ''
    };
  }

  private mapDetalle(raw: DocumentoDetalleItemApi): DocumentoDetalleItem {
    const item: DocumentoDetalleItem = {
      orden: this.toNumber(raw.ppV01_Orden),
      fechaConsumo: this.formatDate(raw.ppV01_FecConsumo),
      codProdu: raw.ppV01_CodProdu || '',
      areaProdu: raw.ppV01_Area || '',
      descripcion: raw.ppV01_Descripcion || '',
      cantidad: this.toNumber(raw.ppV01_Cantidad),
      uMedida: raw.ppV01_UMedida || '',
      pUndLst: this.toNumber(raw.ppV01_PUndLst),
      uniSinImp: this.toNumber(raw.ppV01_UniSinImp),
      porDescu: this.toNumber(raw.ppV01_PorDescu),
      porImp: this.toNumber(raw.ppV01_PorImp),
      porExonera: this.toNumber(raw.ppV01_PorExonera),
      mtoImpVarios: this.toNumber(raw.ppV01_MtoImpVarios),
      almacen: raw.ppV01_Almacen || '',
      area: raw.ppV01_Area || '',
      tipComanda: raw.ppV01_TipComanda || '',
      comanda: raw.ppV01_Comanda || '',
      pntVenta: raw.ppV01_PntVenta || '',
      mozo: raw.ppV01_Mozo || '',
      numHabita: raw.ppV01_NumHabita || '',
      subtotal: this.toOptionalNumber(raw.ppV01_PrecioSinImp),
      descuento: this.toOptionalNumber(raw.ppV01_MtoDescu),
      neto: this.toOptionalNumber(raw.ppV01_TotalNeto),
      total: this.toNumber(raw.ppV01_Precio),
      impuesto: this.toNumber(raw.ppV01_Impuestos)
    };

    const subtotal = this.coalesceNumber(item.subtotal, this.calcularLineaSubtotal(item));
    const descuento = this.getLineaDescuento(item, subtotal);
    const neto = this.coalesceNumber(item.neto, subtotal - descuento);

    return {
      ...item,
      subtotal: this.round(subtotal),
      descuento: this.round(descuento),
      neto: this.round(neto)
    };
  }

  private mapPago(raw: DocumentoDetalleFormaPagoApi): DocumentoPago {
    return {
      orden: this.toNumber(raw.ppV03_Orden),
      frmPago: raw.ppV03_FrmPago || '',
      tipo: raw.ppV03_Tipo || '',
      moneda: raw.ppV03_Moneda || '',
      monto: this.toNumber(raw.ppV03_Monto),
      tCambio: this.toNumber(raw.ppV03_TCambio),
      referencia: '',
      numTarjeta: raw.ppV03_NumTarjeta || '',
      vencimiento: this.formatDate(raw.ppV03_Vencimiento)
    };
  }

  private updateResumen(): void {
    const resumen = this.detalle.reduce<DocumentoResumen>(
      (acc, item) => {
        const subtotal = this.getLineaSubtotal(item);
        const descuento = this.getLineaDescuento(item, subtotal);
        const base = subtotal - descuento;
        const impuesto = this.getLineaImpuestoValue(item, base);
        const total = this.getLineaTotalValue(item, base, impuesto);

        acc.subtotal += subtotal;
        acc.descuento += descuento;
        acc.impuesto += impuesto;
        acc.total += total;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    );

    const header = this.encabezado;
    this.resumen = {
      subtotal: this.round(this.coalesceNumber(header?.subtotal, resumen.subtotal)),
      descuento: this.round(this.coalesceNumber(header?.descuento, resumen.descuento)),
      impuesto: this.round(this.coalesceNumber(header?.impuesto, resumen.impuesto)),
      total: this.round(this.coalesceNumber(header?.totalDocu, resumen.total))
    };

    this.pagosTotal = this.round(
      this.pagos.reduce((sum, item) => sum + this.toNumber(item.monto), 0)
    );
  }

  private getLineaSubtotal(item: DocumentoDetalleItem): number {
    return this.coalesceNumber(item.subtotal, this.calcularLineaSubtotal(item));
  }

  private getLineaDescuento(item: DocumentoDetalleItem, subtotal: number): number {
    if (Number.isFinite(item.descuento)) {
      return item.descuento as number;
    }
    const porDescu = this.toNumber(item.porDescu);
    return subtotal * (porDescu / 100);
  }

  private calcularLineaSubtotal(item: DocumentoDetalleItem): number {
    const subtotalBruto = this.toNumber(item.cantidad) * this.toNumber(item.pUndLst);
    if (!FISCAL_CONFIG.pricesIncludeTax) {
      return subtotalBruto;
    }

    const porImp = this.toNumber(item.porImp);
    const taxRate = porImp > 0 ? porImp : 13;
    const factor = 1 + taxRate / 100;
    return factor > 0 ? subtotalBruto / factor : subtotalBruto;
  }

  private getLineaImpuestoValue(item: DocumentoDetalleItem, base: number): number {
    const impuesto = this.toNumber(item.impuesto);
    if (impuesto) return impuesto;

    const porImp = this.toNumber(item.porImp);
    const taxRate = porImp > 0 ? porImp : 13;

    return base * (taxRate / 100);
  }

  private getLineaTotalValue(item: DocumentoDetalleItem, base: number, impuesto: number): number {
    const total = this.toNumber(item.total);
    if (total) return total;
    const extra = this.toNumber(item.mtoImpVarios);

    return base + impuesto + extra;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private coalesceNumber(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? (value as number) : fallback;
  }

  private formatDate(value: string | undefined): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) return '';
    const raw = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed.split(' ')[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return trimmed;
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
          this.formasPago = (response ?? []).slice().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
          this.syncCambioPagoTipos();
        },
        error: () => {
          this.formasPago = [];
        }
      });
  }

  private rebuildCambioFormaPagoForm(): void {
    this.cambioPagoArray.clear();
    this.pagos.forEach((pago, index) => {
      this.cambioPagoArray.push(this.createCambioPagoGroup(pago, index));
    });
    this.cambioFormaPagoForm.controls.motivo.setValue('', { emitEvent: false });
    this.cambioFormaPagoForm.markAsPristine();
    this.cambioFormaPagoForm.markAsUntouched();
    this.syncCambioPagoTipos();
  }

  private createCambioPagoGroup(pago: DocumentoPago, index: number): FormGroup<CambioPagoForm> {
    return this.fb.group({
      orden: this.fb.control(this.toNumber(pago.orden || index + 1)),
      frmPago: this.fb.control((pago.frmPago ?? '').toString(), { validators: [Validators.required] }),
      tipo: this.fb.control((pago.tipo ?? '').toString()),
      moneda: this.fb.control((pago.moneda ?? '').toString()),
      monto: this.fb.control(this.toNumber(pago.monto)),
      tCambio: this.fb.control(this.toNumber(pago.tCambio)),
      referencia: this.fb.control((pago.referencia ?? '').toString(), { validators: [Validators.maxLength(50)] }),
      numTarjeta: this.fb.control((pago.numTarjeta ?? '').toString(), { validators: [Validators.maxLength(30)] }),
      vencimiento: this.fb.control((pago.vencimiento ?? '').toString(), { validators: [Validators.maxLength(20)] })
    });
  }

  private syncCambioPagoTipos(): void {
    if (!this.formasPago.length || this.cambioPagoArray.length === 0) return;
    this.cambioPagoArray.controls.forEach((group) => {
      const codigo = group.controls.frmPago.value;
      const tipo = this.formasPago.find((fp) => fp.codigo === codigo)?.tipoPago ?? group.controls.tipo.value;
      group.controls.tipo.setValue(tipo, { emitEvent: false });
    });
  }

  private buildCambioFormaPagoPayload(): CambioFormaPagoPayload {
    const raw = this.cambioFormaPagoForm.getRawValue();
    return {
      tipoDocu: this.encabezado?.tipDocu || this.tipoDocu,
      serie: this.encabezado?.serie || this.serieDocu || '000',
      numDocu: this.encabezado?.numero || this.numeroDocu,
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

  private getErrorMessage(error: unknown, fallback = 'No se pudo cargar el detalle del documento.'): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return fallback;
  }

  private getDocumentoReferencia(): { tipo: string; serie: string; numero: string } {
    return {
      tipo: (this.encabezado?.tipDocu || this.tipoDocu || '').toString().trim(),
      serie: (this.encabezado?.serie || this.serieDocu || '000').toString().trim() || '000',
      numero: (this.encabezado?.numero || this.numeroDocu || '').toString().trim()
    };
  }

  private getDescargaElectronicaConfig(tipoArchivo: DocumentoElectronicoKey): {
    label: string;
    filename: string;
    mimeType: string;
    request: (tipo: string, serie: string, numero: string) => Observable<HttpResponse<Blob>>;
  } {
    if (tipoArchivo === 'xmlFirmado') {
      return {
        label: 'XML firmado',
        filename: 'XML_Firmado.xml',
        mimeType: 'application/xml',
        request: (tipo, serie, numero) => this.facturacionDocumentosService.descargarXmlFirmado(tipo, serie, numero)
      };
    }

    if (tipoArchivo === 'xmlRespuesta') {
      return {
        label: 'XML Hacienda',
        filename: 'XML_Respuesta.xml',
        mimeType: 'application/xml',
        request: (tipo, serie, numero) => this.facturacionDocumentosService.descargarXmlRespuesta(tipo, serie, numero)
      };
    }

    return {
      label: 'PDF',
      filename: 'Factura.pdf',
      mimeType: 'application/pdf',
      request: (tipo, serie, numero) => this.facturacionDocumentosService.descargarPdf(tipo, serie, numero)
    };
  }

  private downloadBlobResponse(response: HttpResponse<Blob>, fallbackFilename: string, mimeType: string): void {
    const body = response.body;
    if (!body) {
      throw new Error('No fue posible descargar el archivo');
    }

    const filename = this.getFilenameFromContentDisposition(response.headers.get('content-disposition')) || fallbackFilename;
    const blob = body.type ? body : new Blob([body], { type: mimeType });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
  }

  private getFilenameFromContentDisposition(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;

    const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
    }

    const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return filenameMatch?.[1]?.trim() || null;
  }
}
