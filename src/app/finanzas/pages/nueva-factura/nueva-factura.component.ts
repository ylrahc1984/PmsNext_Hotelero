import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { finalize, startWith } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { NuevaFacturaClienteModalComponent } from './nueva-factura-cliente-modal.component';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { DocumentoDto } from 'src/app/demo/administracion/documento/documento.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { PuntoVentaUI } from 'src/app/demo/administracion/usuarios/usuario.models';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';

type DetalleForm = {
  orden: FormControl<number>;
  codProdu: FormControl<string>;
  areaProdu: FormControl<string>;
  descripcion: FormControl<string>;
  cantidad: FormControl<number>;
  uMedida: FormControl<string>;
  pUndLst: FormControl<number>;
  uniSinImp: FormControl<number>;
  porDescu: FormControl<number>;
  porImp: FormControl<number>;
  porExonera: FormControl<number>;
  mtoImpVarios: FormControl<number>;
  almacen: FormControl<string>;
  area: FormControl<string>;
  tipComanda: FormControl<string>;
  comanda: FormControl<string>;
  mozo: FormControl<string>;
  numHabita: FormControl<string>;
};

type PagoForm = {
  formaPago: FormControl<string>;
  monto: FormControl<number>;
  moneda: FormControl<string>;
  referencia: FormControl<string>;
  tarjeta: FormControl<string>;
  vencimiento: FormControl<string>;
};

type NuevaFacturaForm = {
  tipDocu: FormControl<string>;
  codCliente: FormControl<string>;
  rucCliente: FormControl<string>;
  nomCliente: FormControl<string>;
  correoCliente: FormControl<string>;
  codActividadComercial: FormControl<string>;
  puntoVenta: FormControl<string>;
  fechaDocu: FormControl<string>;
  condicionVenta: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  operador: FormControl<string>;
  detalle: FormArray<FormGroup<DetalleForm>>;
  pagos: FormArray<FormGroup<PagoForm>>;
};

interface LineaCalculo {
  subtotal: number;
  descuento: number;
  base: number;
  impuesto: number;
  total: number;
}

interface TotalesResumen {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

interface ConfirmarFacturaResponse {
  serie?: string;
  numero?: string;
  mensaje?: string;
  respuesta?: string;
  data?: {
    serie?: string;
    numero?: string;
  };
}

@Component({
  selector: 'app-nueva-factura',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule, NuevaFacturaClienteModalComponent],
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
  private readonly usuarioService = inject(UsuarioService);
  private readonly formaPagoService = inject(FormaPagoService);

  private readonly apiUrl = `${environment.apiUrl}/facturacion/confirmar`;

  readonly form: FormGroup<NuevaFacturaForm> = this.fb.group({
    tipDocu: this.fb.nonNullable.control('FAC', { validators: [Validators.required] }),
    codCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    rucCliente: this.fb.nonNullable.control(''),
    nomCliente: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    correoCliente: this.fb.nonNullable.control(''),
    codActividadComercial: this.fb.nonNullable.control(''),
    puntoVenta: this.fb.nonNullable.control(''),
    fechaDocu: this.fb.nonNullable.control(this.getTodayIsoDate()),
    condicionVenta: this.fb.nonNullable.control('01', { validators: [Validators.required] }),
    moneda: this.fb.nonNullable.control('CRC', { validators: [Validators.required] }),
    tCambio: this.fb.nonNullable.control(1),
    operador: this.fb.nonNullable.control('admin'),
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

  monedas: MonedaUI[] = [];
  monedasLoading = false;

  tiposDocumento: DocumentoDto[] = [];
  tiposDocumentoLoading = false;

  puntosVenta: PuntoVentaUI[] = [];
  puntosVentaLoading = false;

  formasPago: FormaPago[] = [];
  formasPagoLoading = false;

  isSubmitting = false;
  showConfirmModal = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  facturaSerie = '';
  facturaNumero = '';
  locked = false;

  constructor() {
    this.addDetalle();
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

  }

  ngOnInit(): void {
    this.cargarMonedas();
    this.cargarTiposDocumento();
    this.cargarPuntosVenta();
    this.cargarFormasPago();
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
      this.form.valid &&
      this.detalleArray.length > 0 &&
      this.pagosValid
    );
  }

  addDetalle(): void {
    if (this.locked) return;
    const orden = this.detalleArray.length + 1;
    this.detalleArray.push(this.createDetalleGroup(orden));
    this.updateCalculos();
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
    this.router.navigate(['/finanzas/documento', tipo, this.facturaNumero]);
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
    if (this.locked) return;
    this.showClienteModal = true;
    this.cdr.markForCheck();
  }

  public onClienteSelected(cliente: ClienteUI): void {
    if (this.locked) return;
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
    if (this.locked) return;
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
  }

  private createDetalleGroup(orden: number): FormGroup<DetalleForm> {
    return this.fb.nonNullable.group({
      orden: this.fb.nonNullable.control(orden),
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
      almacen: this.fb.nonNullable.control(''),
      area: this.fb.nonNullable.control(''),
      tipComanda: this.fb.nonNullable.control(''),
      comanda: this.fb.nonNullable.control(''),
      mozo: this.fb.nonNullable.control(''),
      numHabita: this.fb.nonNullable.control('')
    });
  }

  private createPagoGroup(): FormGroup<PagoForm> {
    return this.fb.nonNullable.group({
      formaPago: this.fb.nonNullable.control(''),
      monto: this.fb.nonNullable.control(0),
      moneda: this.fb.nonNullable.control(this.form.controls.moneda.value),
      referencia: this.fb.nonNullable.control(''),
      tarjeta: this.fb.nonNullable.control(''),
      vencimiento: this.fb.nonNullable.control('')
    });
  }

  private reindexDetalle(): void {
    this.detalleArray.controls.forEach((group, index) => {
      group.controls.orden.setValue(index + 1, { emitEvent: false });
    });
  }

  private updateCalculos(): void {
    const lineas: LineaCalculo[] = this.detalleArray.controls.map((group) => {
      const cantidad = this.toNumber(group.controls.cantidad.value);
      const precio = this.toNumber(group.controls.pUndLst.value);
      const porDescu = this.toNumber(group.controls.porDescu.value);

      const subtotal = cantidad * precio;
      const descuento = subtotal * (porDescu / 100);
      const base = subtotal - descuento;
      const impuesto = base * 0.13;
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
          const current = this.form.controls.puntoVenta.value;
          const exists = this.puntosVenta.some((pv) => pv.codigo === current);
          if (!current || !exists) {
            const nextValue = this.puntosVenta[0]?.codigo ?? '';
            if (nextValue) {
              this.form.controls.puntoVenta.setValue(nextValue, { emitEvent: false });
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
        },
        error: () => {
          this.formasPago = [];
        }
      });
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

  private buildPayload(): {
    tipDocu: string;
    codCliente: string;
    rucCliente: string;
    nomCliente: string;
    condicionVenta: string;
    moneda: string;
    tCambio: number;
    operador: string;
    detalle: Array<{
      orden: number;
      codProdu: string;
      areaProdu: string;
      descripcion: string;
      cantidad: number;
      uMedida: string;
      pUndLst: number;
      uniSinImp: number;
      porDescu: number;
      porImp: number;
      porExonera: number;
      mtoImpVarios: number;
      almacen: string;
      area: string;
      tipComanda: string;
      comanda: string;
      mozo: string;
      numHabita: string;
    }>;
    pagos: Array<{
      formaPago: string;
      monto: number;
      moneda: string;
      referencia: string;
      tarjeta: string;
      vencimiento: string;
    }>;
    serie: string;
    numero: string;
  } {
    const value = this.form.getRawValue();
    const detalle = this.detalleArray.controls.map((group, index) => {
      const raw = group.getRawValue();
      return {
        orden: index + 1,
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
        mozo: raw.mozo,
        numHabita: raw.numHabita
      };
    });

    const pagos = this.mostrarPagos
      ? this.pagosArray.controls.map((group) => {
          const raw = group.getRawValue();
          return {
            formaPago: raw.formaPago,
            monto: this.toNumber(raw.monto),
            moneda: raw.moneda,
            referencia: raw.referencia,
            tarjeta: raw.tarjeta,
            vencimiento: raw.vencimiento
          };
        })
      : [];

    return {
      tipDocu: value.tipDocu,
      codCliente: value.codCliente,
      rucCliente: value.rucCliente,
      nomCliente: value.nomCliente,
      condicionVenta: value.condicionVenta,
      moneda: value.moneda,
      tCambio: this.toNumber(value.tCambio),
      operador: value.operador,
      detalle,
      pagos,
      serie: '',
      numero: ''
    };
  }

  private toNumber(value: number | string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getTodayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
