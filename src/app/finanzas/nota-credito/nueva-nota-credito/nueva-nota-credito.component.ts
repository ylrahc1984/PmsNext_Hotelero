import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { NotasCreditoService } from 'src/app/finanzas/nota-credito/services/notas-credito.service';
import { DocumentoDetalleService } from 'src/app/finanzas/services/documento-detalle.service';
import { MotivoAnulacionService } from 'src/app/finanzas/services/motivo-anulacion.service';
import { DocumentoNotaCreditoService } from 'src/app/finanzas/services/documento-nota-credito.service';
import { Documento } from 'src/app/finanzas/pages-factura/consulta-documentos/consulta-documentos.interface';
import { MotivoAnulacion } from 'src/app/finanzas/nota-credito/interfaces/motivo-anulacion.interface';
import { DocumentoNotaCredito } from 'src/app/finanzas/nota-credito/interfaces/documento-nota-credito.interface';
import { NotaCreditoDetalle, NotaCreditoRequest } from 'src/app/finanzas/nota-credito/interfaces/notas-credito.interface';
import { BuscarDocumentoModalComponent } from './components/buscar-documento-modal/buscar-documento-modal.component';

type DetalleNCForm = {
  pfD08_TipNC: FormControl<string>;
  pfD08_SerieNC: FormControl<string>;
  pfD08_NumeroNC: FormControl<string>;
  pfD08_Codigo: FormControl<string>;
  pfD08_Articulo: FormControl<string>;
  pfD08_Almacen: FormControl<string>;
  pfD08_Cantidad: FormControl<number>;
  pfD08_UndMedida: FormControl<string>;
  pfD08_Exento: FormControl<number>;
  pfD08_SubTotal: FormControl<number>;
  pfD08_MtoIndi: FormControl<number>;
  pfD08_PorImpto: FormControl<number>;
  pfD08_MtoImpto: FormControl<number>;
  pfD08_Total: FormControl<number>;
  pfD08_Incluido: FormControl<number>;
  pfD08_Grabado: FormControl<number>;
  pfD08_Moneda: FormControl<string>;
  pfD08_Tcambio: FormControl<number>;
  pfD08_Orden: FormControl<number>;
  pfD08_PntVenta: FormControl<string>;
  pfD08_CCosto: FormControl<string>;
  pfD08_Operador: FormControl<string>;
};

type NuevaNotaCreditoForm = {
  tipNC: FormControl<string>;
  serieNC: FormControl<string>;
  numNC: FormControl<string>;
  fecha: FormControl<string>;
  motivoAnulacion: FormControl<string>;
  observacion: FormControl<string>;
  codCliente: FormControl<string>;
  nomCliente: FormControl<string>;
  tipDocCli: FormControl<string>;
  serieDocCli: FormControl<string>;
  numDocCli: FormControl<string>;
  nElectronico: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  comentario: FormControl<string>;
  detalle: FormArray<FormGroup<DetalleNCForm>>;
};

interface NotaCreditoResumen {
  subtotal: number;
  impuesto: number;
  total: number;
}

type DocumentoRecord = Record<string, unknown>;

@Component({
  selector: 'app-nueva-nota-credito',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, BuscarDocumentoModalComponent],
  templateUrl: './nueva-nota-credito.component.html',
  styleUrls: ['./nueva-nota-credito.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaNotaCreditoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notasService = inject(NotasCreditoService);
  private readonly documentoService = inject(DocumentoDetalleService);
  private readonly motivoAnulacionService = inject(MotivoAnulacionService);
  private readonly documentoNotaCreditoService = inject(DocumentoNotaCreditoService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly empresa = this.empresaContext.empresa;

  readonly form: FormGroup<NuevaNotaCreditoForm> = this.fb.group({
    tipNC: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    serieNC: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    numNC: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    fecha: this.fb.nonNullable.control(this.getTodayIsoDate(), { validators: [Validators.required] }),
    motivoAnulacion: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    observacion: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.minLength(5)] }),
    codCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    nomCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    tipDocCli: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    serieDocCli: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    numDocCli: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    nElectronico: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    moneda: this.fb.nonNullable.control({ value: '', disabled: true }),
    tCambio: this.fb.nonNullable.control({ value: 0, disabled: true }),
    comentario: this.fb.nonNullable.control(''),
    detalle: this.fb.array<FormGroup<DetalleNCForm>>([], { validators: [Validators.required] })
  });

  resumen: NotaCreditoResumen = { subtotal: 0, impuesto: 0, total: 0 };
  showDocumentoModal = false;
  loadingDocumento = false;
  isSubmitting = false;
  errorMessage: string | null = null;
  rucCliente = '';
  motivosAnulacion: MotivoAnulacion[] = [];
  motivosAnulacionLoading = false;
  tiposNotaCredito: DocumentoNotaCredito[] = [];
  tiposNotaCreditoLoading = false;

  ngOnInit(): void {
    this.detalleArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.calcularTotales();
      this.cdr.markForCheck();
    });
    this.form.controls.tipNC.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.syncTipoNCData((value || '').toString());
      });
    this.cargarMotivosAnulacion();
    this.cargarTiposNotaCredito();
    this.initDocumentoOrigenFromRoute();
  }

  get detalleArray(): FormArray<FormGroup<DetalleNCForm>> {
    return this.form.controls.detalle;
  }

  get canSave(): boolean {
    return !this.isSubmitting && this.form.valid && this.detalleArray.length > 0 && !this.loadingDocumento;
  }

  abrirBuscarDocumento(): void {
    this.showDocumentoModal = true;
    this.cdr.markForCheck();
  }

  cerrarBuscarDocumento(): void {
    this.showDocumentoModal = false;
    this.cdr.markForCheck();
  }

  onDocumentoSelected(documento: Documento): void {
    this.showDocumentoModal = false;
    const tipo = documento.PPV00_TipoDocu;
    const serie = documento.PPV00_Serie || '000';
    const numero = documento.PPV00_NumDocu;
    this.cargarDocumentoOrigen(tipo, serie, numero);
  }

  removeDetalle(index: number): void {
    this.detalleArray.removeAt(index);
    this.calcularTotales();
  }

  calcularLinea(index: number): void {
    const group = this.detalleArray.at(index);
    if (!group) return;
    this.recalcularGrupo(group);
  }

  calcularTotales(): void {
    const acumulado = this.detalleArray.controls.reduce(
      (acc, group) => {
        acc.subtotal += this.toNumber(group.controls.pfD08_SubTotal.value);
        acc.impuesto += this.toNumber(group.controls.pfD08_MtoImpto.value);
        acc.total += this.toNumber(group.controls.pfD08_Total.value);
        return acc;
      },
      { subtotal: 0, impuesto: 0, total: 0 }
    );

    this.resumen = {
      subtotal: this.round(acumulado.subtotal),
      impuesto: this.round(acumulado.impuesto),
      total: this.round(acumulado.total)
    };
  }

  async guardarNotaCredito(): Promise<void> {
    if (!this.canSave) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const confirm = await Swal.fire({
      title: 'Confirmar nota de credito',
      text: 'Se registrara la nota de credito para el documento seleccionado. Desea continuar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirm.isConfirmed) {
      return;
    }

    const payload = this.buildPayload();
    console.log('[NotasCredito] Payload crearNotaCredito', payload);
    this.isSubmitting = true;
    this.errorMessage = null;

    this.notasService
      .crearNotaCredito(payload)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          void Swal.fire({
            title: 'Nota de crédito creada',
            text: 'La nota de crédito fue registrada correctamente.',
            icon: 'success',
            timer: 1600,
            showConfirmButton: false
          });
          this.router.navigate(['/finanzas/notas-credito']);
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error);
          void Swal.fire({ title: 'Error', text: this.errorMessage, icon: 'error' });
        }
      });
  }

  cancelar(): void {
    this.router.navigate(['/finanzas/notas-credito']);
  }

  trackByDetalle(index: number, _item: FormGroup<DetalleNCForm>): number {
    return index;
  }

  trackByMotivo(_index: number, item: MotivoAnulacion): string {
    return item.CPV04_IDMotivo;
  }

  trackByTipoNC(_index: number, item: DocumentoNotaCredito): string {
    return item.CA04_CodDocu;
  }

  getLineaSubtotal(index: number): number {
    return this.detalleArray.at(index)?.controls.pfD08_SubTotal.value ?? 0;
  }

  getLineaImpuesto(index: number): number {
    return this.detalleArray.at(index)?.controls.pfD08_MtoImpto.value ?? 0;
  }

  getLineaTotal(index: number): number {
    return this.detalleArray.at(index)?.controls.pfD08_Total.value ?? 0;
  }

  private cargarDocumentoOrigen(tipo: string, serie: string, numero: string): void {
    this.loadingDocumento = true;
    this.errorMessage = null;
    this.cdr.markForCheck();

    this.documentoService
      .getDetalle(tipo, serie, numero, this.getOperador().trim() || 'charly')
      .pipe(
        finalize(() => {
          this.loadingDocumento = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const normalized = this.normalizeDocumentoResponse(response ?? {});
          const header = normalized.encabezado;
          const validationMessage = this.validateDocumentoParaNotaCredito(header);
          if (validationMessage) {
            this.clearDocumentoOrigen();
            this.errorMessage = validationMessage;
            void Swal.fire({ title: 'Documento no permitido', text: validationMessage, icon: 'warning' });
            return;
          }

          const moneda = this.readString(header, 'ppV00_Moneda', 'PPV00_Moneda');
          const tCambio = this.readNumber(header, 'ppV00_TCambio', 'PPV00_TCambio', 'tCambio');
          this.rucCliente = this.readString(header, 'ppV00_RucCliente', 'PPV00_RucCliente');

          this.form.patchValue(
            {
              codCliente: this.readString(header, 'ppV00_CodCliente', 'PPV00_CodCliente'),
              nomCliente: this.readString(header, 'ppV00_NomCliente', 'PPV00_NomCliente'),
              tipDocCli: this.readString(header, 'ppV00_TipoDocu', 'PPV00_TipoDocu') || tipo,
              serieDocCli: this.readString(header, 'ppV00_Serie', 'PPV00_Serie') || serie,
              numDocCli: this.readString(header, 'ppV00_NumDocu', 'PPV00_NumDocu') || numero,
              nElectronico:
                this.readString(
                  header,
                  'ppV15_NumeroConsecutivo',
                  'PPV15_NumeroConsecutivo',
                  'ppv15_NumeroConsecutivo'
                ),
              moneda,
              tCambio
            },
            { emitEvent: false }
          );

          const detalle = normalized.detalle ?? [];
          this.detalleArray.clear();
          detalle.forEach((item, index) => {
            const group = this.createDetalleGroup(item, index + 1, moneda, tCambio);
            this.bindDetalleRecalculo(group);
            this.detalleArray.push(group);
          });

          this.calcularTotales();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.errorMessage = this.getErrorMessage(error);
          void Swal.fire({ title: 'Error', text: this.errorMessage, icon: 'error' });
        }
      });
  }

  private initDocumentoOrigenFromRoute(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tipo = (params.get('tipoDocu') ?? '').toString().trim();
      const serie = (params.get('serie') ?? '000').toString().trim() || '000';
      const numero = (params.get('numero') ?? '').toString().trim();
      if (!tipo || !numero) {
        return;
      }
      this.cargarDocumentoOrigen(tipo, serie, numero);
    });
  }

  private createDetalleGroup(raw: DocumentoRecord, orden: number, moneda: string, tCambio: number): FormGroup<DetalleNCForm> {
    const cantidad = this.readNumberNullable(raw, 'ppV01_Cantidad', 'PPV01_Cantidad') ?? 1;
    const lineAmounts = this.resolveDetalleOrigenAmounts(raw, cantidad);
    const precioUnit = cantidad > 0 ? lineAmounts.subtotal / cantidad : 0;

    return this.fb.nonNullable.group({
      pfD08_TipNC: this.fb.nonNullable.control(this.form.controls.tipNC.value),
      pfD08_SerieNC: this.fb.nonNullable.control(this.form.controls.serieNC.value),
      pfD08_NumeroNC: this.fb.nonNullable.control(this.form.controls.numNC.value),
      pfD08_Codigo: this.fb.nonNullable.control(this.readString(raw, 'ppV01_CodProdu', 'PPV01_CodProdu')),
      pfD08_Articulo: this.fb.nonNullable.control(this.readString(raw, 'ppV01_Descripcion', 'PPV01_Descripcion')),
      pfD08_Almacen: this.fb.nonNullable.control(this.readString(raw, 'ppV01_Almacen', 'PPV01_Almacen')),
      pfD08_Cantidad: this.fb.nonNullable.control(cantidad),
      pfD08_UndMedida: this.fb.nonNullable.control(this.readString(raw, 'ppV01_UMedida', 'PPV01_UMedida')),
      pfD08_Exento: this.fb.nonNullable.control(this.readNumber(raw, 'ppV01_MtoExonera', 'PPV01_MtoExonera')),
      pfD08_SubTotal: this.fb.nonNullable.control(this.round(lineAmounts.subtotal)),
      pfD08_MtoIndi: this.fb.nonNullable.control(precioUnit),
      pfD08_PorImpto: this.fb.nonNullable.control(this.round(lineAmounts.porImpto)),
      pfD08_MtoImpto: this.fb.nonNullable.control(this.round(lineAmounts.impuesto)),
      pfD08_Total: this.fb.nonNullable.control(this.round(lineAmounts.total)),
      pfD08_Incluido: this.fb.nonNullable.control(0),
      pfD08_Grabado: this.fb.nonNullable.control(lineAmounts.porImpto > 0 ? 1 : 0),
      pfD08_Moneda: this.fb.nonNullable.control(moneda),
      pfD08_Tcambio: this.fb.nonNullable.control(tCambio),
      pfD08_Orden: this.fb.nonNullable.control(orden),
      pfD08_PntVenta: this.fb.nonNullable.control(this.readString(raw, 'ppV01_PntVenta', 'PPV01_PntVenta')),
      pfD08_CCosto: this.fb.nonNullable.control(this.readString(raw, 'ppV01_Area', 'PPV01_Area')),
      pfD08_Operador: this.fb.nonNullable.control(this.getOperador())
    });
  }

  private resolveDetalleOrigenAmounts(raw: DocumentoRecord, cantidad: number): { subtotal: number; impuesto: number; total: number; porImpto: number } {
    const precioUnit =
      this.readNumberNullable(raw, 'ppV01_UniSinImp', 'PPV01_UniSinImp', 'ppV01_PrecioSinImp', 'PPV01_PrecioSinImp') ??
      this.readNumberNullable(raw, 'uniSinImp', 'precioSinImp') ??
      0;
    const subtotalCandidate =
      this.readNumberNullable(raw, 'subtotal', 'subTotal', 'ppV01_SubTotal', 'PPV01_SubTotal', 'ppV01_Neto', 'PPV01_Neto') ??
      undefined;
    const totalCandidate = this.readNumberNullable(
      raw,
      'total',
      'monto',
      'ppV01_Total',
      'PPV01_Total',
      'ppV01_Precio',
      'PPV01_Precio',
      'ppV01_TotalNeto',
      'PPV01_TotalNeto'
    );
    const impuestoCandidate = this.readNumberNullable(raw, 'impuesto', 'ppV01_Impuestos', 'PPV01_Impuestos') ?? 0;
    const porImptoCandidate = this.readNumberNullable(raw, 'porImp', 'ppV01_PorImp', 'PPV01_PorImp') ?? 0;

    const subtotal =
      subtotalCandidate ??
      (totalCandidate !== undefined ? Math.max(totalCandidate - impuestoCandidate, 0) : cantidad * precioUnit);
    const impuesto =
      impuestoCandidate ||
      (porImptoCandidate > 0 ? subtotal * (porImptoCandidate / 100) : 0);
    const total = totalCandidate ?? subtotal + impuesto;
    const porImpto = subtotal > 0 ? (impuesto / subtotal) * 100 : porImptoCandidate;

    return {
      subtotal: this.round(subtotal),
      impuesto: this.round(impuesto),
      total: this.round(total),
      porImpto: this.round(porImpto)
    };
  }

  private bindDetalleRecalculo(group: FormGroup<DetalleNCForm>): void {
    group.controls.pfD08_Cantidad.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.recalcularGrupo(group);
    });
    group.controls.pfD08_MtoIndi.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.recalcularGrupo(group);
    });
    group.controls.pfD08_PorImpto.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.recalcularGrupo(group);
    });
  }

  private recalcularGrupo(group: FormGroup<DetalleNCForm>): void {
    const cantidad = this.toNumber(group.controls.pfD08_Cantidad.value);
    const precioUnit = this.toNumber(group.controls.pfD08_MtoIndi.value);
    const porImpto = this.toNumber(group.controls.pfD08_PorImpto.value);

    const subtotal = cantidad * precioUnit;
    const impuesto = subtotal * (porImpto / 100);
    const total = subtotal + impuesto;

    group.controls.pfD08_SubTotal.setValue(this.round(subtotal), { emitEvent: false });
    group.controls.pfD08_MtoImpto.setValue(this.round(impuesto), { emitEvent: false });
    group.controls.pfD08_Total.setValue(this.round(total), { emitEvent: false });
    group.controls.pfD08_Grabado.setValue(porImpto > 0 ? 1 : 0, { emitEvent: false });

    this.calcularTotales();
  }

  private buildPayload(): NotaCreditoRequest {
    const raw = this.form.getRawValue();
    const operador = this.getOperador();

    const detalle = this.detalleArray.controls.map((group, index) => {
      const item = group.getRawValue();
      const cantidad = this.toNumber(item.pfD08_Cantidad);
      const precioUnit = this.toNumber(item.pfD08_MtoIndi);
      const subtotal = this.round(item.pfD08_SubTotal);
      const impuesto = this.round(item.pfD08_MtoImpto);
      const total = this.round(item.pfD08_Total);
      const incluido = this.toNumber(item.pfD08_Incluido);
      const grabado = this.toNumber(item.pfD08_Grabado);

      const detallePayload: NotaCreditoDetalle = {
        pfD08_TipNC: raw.tipNC,
        pfD08_SerieNC: raw.serieNC,
        pfD08_NumeroNC: raw.numNC,
        pfD08_Codigo: item.pfD08_Codigo,
        pfD08_Articulo: item.pfD08_Articulo,
        pfD08_Almacen: item.pfD08_Almacen,
        pfD08_Cantidad: cantidad,
        pfD08_UndMedida: item.pfD08_UndMedida,
        pfD08_Exento: this.toNumber(item.pfD08_Exento),
        pfD08_SubTotal: subtotal,
        pfD08_MtoIndi: precioUnit,
        pfD08_PorImpto: this.toNumber(item.pfD08_PorImpto),
        pfD08_MtoImpto: impuesto,
        pfD08_Total: total,
        pfD08_Incluido: String(incluido),
        pfD08_Grabado: String(grabado),
        pfD08_Moneda: raw.moneda,
        pfD08_Tcambio: this.toNumber(raw.tCambio),
        pfD08_Orden: index + 1,
        pfD08_PntVenta: item.pfD08_PntVenta,
        pfD08_CCosto: item.pfD08_CCosto,
        pfD08_Operador: operador
      };
      return detallePayload;
    });

    return {
      proceso: 1,
      tipNC: raw.tipNC,
      serieNC: raw.serieNC,
      numNC: raw.numNC,
      fecha: this.formatDate(raw.fecha),
      fechaFin: this.formatDate(raw.fecha),
      motivoAnulacion: raw.motivoAnulacion,
      observacion: raw.observacion,
      codCliente: raw.codCliente,
      nomCliente: raw.nomCliente,
      tipDocCli: raw.tipDocCli,
      serieDocCli: raw.serieDocCli,
      numDocCli: raw.numDocCli,
      nElectronico: raw.nElectronico,
      total: this.resumen.total,
      moneda: raw.moneda,
      tCambio: this.toNumber(raw.tCambio),
      comentario: raw.observacion,
      asiento: '',
      idNC: raw.motivoAnulacion,
      operador,
      detalle
    };
  }

  private cargarMotivosAnulacion(): void {
    this.motivosAnulacionLoading = true;
    this.form.controls.motivoAnulacion.disable({ emitEvent: false });
    this.motivoAnulacionService
      .getMotivos(90)
      .pipe(
        finalize(() => {
          this.motivosAnulacionLoading = false;
          this.form.controls.motivoAnulacion.enable({ emitEvent: false });
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.motivosAnulacion = response ?? [];
          const current = this.form.controls.motivoAnulacion.value;
          const exists = this.motivosAnulacion.some((item) => item.CPV04_IDMotivo === current);
          if (!current || !exists) {
            const nextValue = this.motivosAnulacion[0]?.CPV04_IDMotivo ?? '';
            if (nextValue) {
              this.form.controls.motivoAnulacion.setValue(nextValue, { emitEvent: false });
            }
          }
        },
        error: () => {
          this.motivosAnulacion = [];
        }
      });
  }

  private cargarTiposNotaCredito(): void {
    this.tiposNotaCreditoLoading = true;
    this.form.controls.tipNC.disable({ emitEvent: false });
    this.documentoNotaCreditoService
      .getTipos(1)
      .pipe(
        finalize(() => {
          this.tiposNotaCreditoLoading = false;
          this.form.controls.tipNC.enable({ emitEvent: false });
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.tiposNotaCredito = (response ?? []).filter((item) => Number(item.CA04_Venta) === 1);
          const current = this.form.controls.tipNC.value;
          const exists = this.tiposNotaCredito.some((item) => item.CA04_CodDocu === current);
          if (!current || !exists) {
            const nextValue = this.tiposNotaCredito[0]?.CA04_CodDocu ?? '';
            if (nextValue) {
              this.form.controls.tipNC.setValue(nextValue, { emitEvent: false });
            }
          }
          this.syncTipoNCData(this.form.controls.tipNC.value);
        },
        error: () => {
          this.tiposNotaCredito = [];
        }
      });
  }

  private syncTipoNCData(codDocu: string): void {
    const selected = this.tiposNotaCredito.find((item) => item.CA04_CodDocu === codDocu);
    if (!selected) {
      this.form.controls.serieNC.setValue('', { emitEvent: false });
      this.form.controls.numNC.setValue('', { emitEvent: false });
      return;
    }
    this.form.controls.serieNC.setValue(String(selected.CA04_Serie ?? ''), { emitEvent: false });
    this.form.controls.numNC.setValue(String(selected.CA04_Numero ?? ''), { emitEvent: false });
  }

  private normalizeDocumentoResponse(response: unknown): { encabezado: DocumentoRecord; detalle: DocumentoRecord[] } {
    const record = this.toRecord(response);
    const data = this.toRecord(record['data'] ?? record['datos'] ?? record);
    return {
      encabezado: this.toRecord(data['encabezado'] ?? data['cabecera'] ?? data['header'] ?? data),
      detalle: this.toRecordArray(data['detalle'] ?? data['detalles'] ?? data['lineas'] ?? [])
    };
  }

  private validateDocumentoParaNotaCredito(header: DocumentoRecord): string {
    const estadoDocumento = this.readString(header, 'estadoDocu', 'ppV00_EstadoDocumento', 'PPV00_EstadoDocumento').toUpperCase();
    const estadoElectronico = this.readString(
      header,
      'estadoElectronico',
      'ppV15_EstadoElectronico',
      'PPV15_EstadoElectronico'
    ).toUpperCase();

    if (this.isDocumentoAnulado(estadoDocumento)) {
      return 'No se puede aplicar nota de crédito a un documento anulado.';
    }
    if (estadoElectronico === 'RECHAZADO') {
      return 'No se puede aplicar nota de crédito a un documento rechazado.';
    }
    if (estadoElectronico !== 'ACEPTADO') {
      return 'La nota de crédito solo aplica para documentos aceptados.';
    }
    return '';
  }

  private isDocumentoAnulado(estadoDocumento: string): boolean {
    return estadoDocumento === 'A' || estadoDocumento.includes('ANU') || estadoDocumento.includes('CANCEL');
  }

  private clearDocumentoOrigen(): void {
    this.rucCliente = '';
    this.detalleArray.clear();
    this.resumen = { subtotal: 0, impuesto: 0, total: 0 };
    this.form.patchValue(
      {
        codCliente: '',
        nomCliente: '',
        tipDocCli: '',
        serieDocCli: '',
        numDocCli: '',
        nElectronico: '',
        moneda: '',
        tCambio: 0
      },
      { emitEvent: false }
    );
    this.cdr.markForCheck();
  }

  private toRecord(value: unknown): DocumentoRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as DocumentoRecord;
  }

  private toRecordArray(value: unknown): DocumentoRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is DocumentoRecord => !!item && typeof item === 'object' && !Array.isArray(item));
  }

  private readString(record: DocumentoRecord, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined) {
        const asString = String(value).trim();
        if (asString) return asString;
      }
    }
    return '';
  }

  private readNumber(record: DocumentoRecord, ...keys: string[]): number {
    const value = this.readNumberNullable(record, ...keys);
    return value ?? 0;
  }

  private readNumberNullable(record: DocumentoRecord, ...keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key];
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatDate(value: string): string {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) return '';
    if (trimmed.includes('/')) {
      return trimmed;
    }
    const parts = trimmed.split('-');
    if (parts.length !== 3) {
      return trimmed;
    }
    const [year, month, day] = parts;
    if (!year || !month || !day) {
      return trimmed;
    }
    return `${day}/${month}/${year}`;
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Ocurrió un error al guardar la nota de crédito.';
  }
}
