import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, merge, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ProveedorService, ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { ProductoService } from 'src/app/demo/compras/producto-list/producto.service';
import { Producto } from 'src/app/demo/compras/producto-list/interfaces/Producto.interface';
import { AlmacenService } from 'src/app/demo/compras/almacen/almacen.service';
import { Almacen } from 'src/app/demo/compras/almacen/interfaces/Almacen.interface';
import { ComprasService } from '../compras.service';
import { CompraArticuloRequest } from './interfaces/CompraArticuloRequest.interface';
import { CompraArticuloDetalle } from './interfaces/CompraArticuloDetalle.interface';
import { CompraArticuloDetalleFormModel } from './interfaces/CompraArticuloFormModel.interface';

interface CompraArticuloDetalleForm {
  codProdu: FormControl<string>;
  producto: FormControl<string>;
  almacen: FormControl<string>;
  cantidad: FormControl<number>;
  undMedida: FormControl<string>;
  exento: FormControl<boolean>;
  subTotal: FormControl<number>;
  unitSImp: FormControl<number>;
  porDesc: FormControl<number>;
  mtoDesc: FormControl<number>;
  mtoNeto: FormControl<number>;
  porImpto: FormControl<number>;
  mtoImpto: FormControl<number>;
  porExonera: FormControl<number>;
  mtoExonera: FormControl<number>;
  unitCImp: FormControl<number>;
  total: FormControl<number>;
  ultCosto: FormControl<number>;
  observaciones: FormControl<string>;
  imponible: FormControl<number>;
  fleteInd: FormControl<number>;
  fleteTot: FormControl<number>;
  moneda: FormControl<string>;
  tcambio: FormControl<number>;
  orden: FormControl<number>;
  codProduProv: FormControl<string>;
  productoProv: FormControl<string>;
}

interface DocumentoCompra {
  CA04_CodDocu: string;
  CA04_NomDocu: string;
  CA04_Serie?: number;
  CA04_Numero?: number;
  CA04_Visible?: number;
  CA04_Auto?: number;
  CA04_Compra?: number;
  CA04_Venta?: number;
  CA04_Docu?: number;
  CA04_NotaC?: number;
  CA04_NotaD?: number;
  CA04_Guia?: string;
  CA04_Observacion1?: string;
  CA04_Observacion2?: string;
  CA04_NFactElectronica?: number;
  CA404_TDocFE?: string;
  CA04_Operador?: string;
}

interface CompraArticuloForm {
  tipDocu: FormControl<string>;
  fechaIngreso: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  codProve: FormControl<string>;
  rucProve: FormControl<string>;
  nomProve: FormControl<string>;
  tipDocProve: FormControl<string>;
  serie: FormControl<string>;
  numFactura: FormControl<string>;
  fechaFactura: FormControl<string>;
  fechaVenci: FormControl<string>;
  frmPago: FormControl<string>;
  numOrdenCmp: FormControl<string>;
  docFlete: FormControl<string>;
  montoFlete: FormControl<number>;
  docPercep: FormControl<string>;
  montoPercep: FormControl<number>;
  operador: FormControl<string>;
  totDeta: FormControl<number>;
  totNeto: FormControl<number>;
  exonera: FormControl<number>;
  subTotal: FormControl<number>;
  totImpu: FormControl<number>;
  totalDocu: FormControl<number>;
  totPago: FormControl<number>;
  detalle: FormArray<FormGroup<CompraArticuloDetalleForm>>;
}

@Component({
  selector: 'app-nueva-compra-articulos',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './nueva-compra-articulos.component.html',
  styleUrls: ['./nueva-compra-articulos.component.scss']
})
export class NuevaCompraArticulosComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly monedaService = inject(MonedaService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly productoService = inject(ProductoService);
  private readonly almacenService = inject(AlmacenService);
  private readonly comprasService = inject(ComprasService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: FormGroup<CompraArticuloForm> = this.fb.group(
    {
      tipDocu: this.fb.control('COM', { validators: [Validators.required] }),
      fechaIngreso: this.fb.control(this.todayIso()),
      moneda: this.fb.control('', { validators: [Validators.required] }),
      tCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0.0001)] }),
      codProve: this.fb.control('', { validators: [Validators.required] }),
      rucProve: this.fb.control(''),
      nomProve: this.fb.control('', { validators: [Validators.required] }),
      tipDocProve: this.fb.control(''),
      serie: this.fb.control('000', { validators: [Validators.required] }),
      numFactura: this.fb.control('', { validators: [Validators.required] }),
      fechaFactura: this.fb.control('', { validators: [Validators.required] }),
      fechaVenci: this.fb.control('', { validators: [Validators.required] }),
      frmPago: this.fb.control('', { validators: [Validators.required] }),
      numOrdenCmp: this.fb.control(''),
      docFlete: this.fb.control(''),
      montoFlete: this.fb.control(0, { validators: [Validators.min(0)] }),
      docPercep: this.fb.control(''),
      montoPercep: this.fb.control(0, { validators: [Validators.min(0)] }),
      operador: this.fb.control(''),
      totDeta: this.fb.control(0),
      totNeto: this.fb.control(0),
      exonera: this.fb.control(0),
      subTotal: this.fb.control(0),
      totImpu: this.fb.control(0),
      totalDocu: this.fb.control(0),
      totPago: this.fb.control(0),
      detalle: this.fb.array<FormGroup<CompraArticuloDetalleForm>>([], { validators: [this.minArrayLength(1)] })
    },
    { validators: [this.dateRangeValidator(), this.tipoCambioValidator()] }
  );

  readonly proveedorSearchForm: FormGroup<{ search: FormControl<string> }> = this.fb.group({
    search: this.fb.control('')
  });

  readonly productoSearchForm: FormGroup<{ search: FormControl<string> }> = this.fb.group({
    search: this.fb.control('')
  });

  readonly almacenSearchForm: FormGroup<{ search: FormControl<string> }> = this.fb.group({
    search: this.fb.control('')
  });

  monedas: MonedaUI[] = [];
  formasPago: FormaPago[] = [];
  almacenes: Almacen[] = [];
  almacenesFiltered: Almacen[] = [];
  documentosCompra: DocumentoCompra[] = [];
  proveedores: ProveedorUI[] = [];
  productos: Producto[] = [];

  monedasLoading = false;
  formasPagoLoading = false;
  almacenesLoading = false;
  proveedoresLoading = false;
  productosLoading = false;
  isSaving = false;
  documentosCompraLoading = false;

  errorMessage = '';

  showProveedorModal = false;
  showProductoModal = false;
  showAlmacenModal = false;
  selectedDetalleIndex: number | null = null;
  pendingProductoIndex: number | null = null;
  selectedAlmacenIndex: number | null = null;

  almacenPage = 1;
  almacenPageSize = 8;

  baseMoneda = 'CRC';
  private readonly documentoCompraUrl = 'http://localhost:5000/api/documento/compra/1';

  ngOnInit(): void {
    this.form.controls.operador.setValue(this.getOperador(), { emitEvent: false });
    this.loadCatalogs();
    this.loadDocumentosCompra();
    this.registerHeaderSubscriptions();
  }

  get detalleArray(): FormArray<FormGroup<CompraArticuloDetalleForm>> {
    return this.form.controls.detalle;
  }

  get canSubmit(): boolean {
    return this.form.valid && this.detalleArray.length > 0 && !this.isSaving;
  }

  openProveedorModal(): void {
    this.showProveedorModal = true;
    this.buscarProveedores();
  }

  closeProveedorModal(): void {
    this.showProveedorModal = false;
  }

  buscarProveedores(): void {
    this.proveedoresLoading = true;
    const term = this.normalizeValue(this.proveedorSearchForm.controls.search.value);
    this.proveedorService
      .getProveedores(1, 25, undefined, term)
      .pipe(
        catchError((error) => {
          console.error('Error al cargar proveedores', error);
          return of({ data: [], totalRegistros: 0, paginaActual: 1, pageSize: 25, totalPages: 1 });
        }),
        finalize(() => {
          this.proveedoresLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.proveedores = response.data ?? [];
      });
  }

  limpiarBusquedaProveedores(): void {
    this.proveedorSearchForm.reset({ search: '' });
    this.buscarProveedores();
  }

  seleccionarProveedor(proveedor: ProveedorUI): void {
    this.form.patchValue(
      {
        codProve: proveedor.codigo,
        nomProve: proveedor.descripcion,
        rucProve: proveedor.ruc,
        tipDocProve: proveedor.tipCedula
      },
      { emitEvent: false }
    );
    this.closeProveedorModal();
  }

  limpiarProveedor(): void {
    this.form.patchValue(
      {
        codProve: '',
        nomProve: '',
        rucProve: '',
        tipDocProve: ''
      },
      { emitEvent: false }
    );
  }

  openProductoModal(index: number, fromAdd = false): void {
    this.selectedDetalleIndex = index;
    this.pendingProductoIndex = fromAdd ? index : null;
    this.showProductoModal = true;
    this.buscarProductos();
  }

  openAlmacenModal(index: number): void {
    this.selectedAlmacenIndex = index;
    this.showAlmacenModal = true;
    this.buscarAlmacenes();
  }

  closeProductoModal(): void {
    if (this.pendingProductoIndex !== null) {
      const index = this.pendingProductoIndex;
      const group = this.detalleArray.at(index);
      const codProdu = group?.controls.codProdu.value;
      if (!codProdu) {
        this.detalleArray.removeAt(index);
        this.updateOrdenes();
        this.recalculateTotals();
      }
    }
    this.showProductoModal = false;
    this.selectedDetalleIndex = null;
    this.pendingProductoIndex = null;
  }

  closeAlmacenModal(): void {
    this.showAlmacenModal = false;
    this.selectedAlmacenIndex = null;
  }

  buscarProductos(): void {
    this.productosLoading = true;
    const term = this.normalizeValue(this.productoSearchForm.controls.search.value);
    this.productoService
      .getProductos({
        nomProducto: term,
        linea: undefined,
        categoria: undefined,
        codigoBarra: undefined,
        pageNumber: 1,
        pageSize: 25
      })
      .pipe(
        catchError((error) => {
          console.error('Error al cargar productos', error);
          return of({ datos: [], paginacion: [] });
        }),
        finalize(() => {
          this.productosLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.productos = response?.datos ?? [];
      });
  }

  limpiarBusquedaProductos(): void {
    this.productoSearchForm.reset({ search: '' });
    this.buscarProductos();
  }

  seleccionarProducto(producto: Producto): void {
    if (this.selectedDetalleIndex === null) {
      return;
    }
    const group = this.detalleArray.at(this.selectedDetalleIndex);
    const grabado = (producto.MAC02_Grabado || '').trim().toUpperCase();
    const exento = grabado === 'N';
    group.patchValue(
      {
        codProdu: producto.MAC02_CodProducto,
        producto: producto.MAC02_NomProducto,
        undMedida: producto.MAC02_UnmProdu,
        ultCosto: this.toNumber(producto.MAC02_UltimoCto),
        unitSImp: this.toNumber(producto.MAC02_CostoPro),
        porImpto: this.toNumber(producto.MAC02_PorImpto),
        exento,
        moneda: this.form.controls.moneda.value,
        tcambio: this.form.controls.tCambio.value
      },
      { emitEvent: false }
    );
    this.recalculateRow(this.selectedDetalleIndex);
    this.closeProductoModal();
  }

  seleccionarAlmacen(almacen: Almacen): void {
    if (this.selectedAlmacenIndex === null) {
      return;
    }
    const group = this.detalleArray.at(this.selectedAlmacenIndex);
    if (group) {
      group.controls.almacen.setValue(almacen.CAC05_CodAlmacen);
    }
    this.closeAlmacenModal();
  }

  buscarAlmacenes(): void {
    const term = this.normalizeValue(this.almacenSearchForm.controls.search.value) ?? '';
    const normalized = term.toLowerCase();
    this.almacenPage = 1;
    this.almacenesFiltered = normalized
      ? this.almacenes.filter(
          (item) =>
            item.CAC05_CodAlmacen?.toLowerCase().includes(normalized) ||
            item.CAC05_NomAlmacen?.toLowerCase().includes(normalized)
        )
      : [...this.almacenes];
  }

  limpiarBusquedaAlmacenes(): void {
    this.almacenSearchForm.reset({ search: '' });
    this.buscarAlmacenes();
  }

  prevAlmacenPage(): void {
    if (this.almacenPage > 1) {
      this.almacenPage -= 1;
    }
  }

  nextAlmacenPage(): void {
    if (this.almacenPage < this.almacenTotalPages) {
      this.almacenPage += 1;
    }
  }

  get almacenTotalPages(): number {
    return Math.max(1, Math.ceil(this.almacenesFiltered.length / this.almacenPageSize));
  }

  get paginatedAlmacenes(): Almacen[] {
    const start = (this.almacenPage - 1) * this.almacenPageSize;
    return this.almacenesFiltered.slice(start, start + this.almacenPageSize);
  }

  addDetalleRow(): void {
    const group = this.fb.group({
      codProdu: this.fb.control('', { validators: [Validators.required] }),
      producto: this.fb.control('', { validators: [Validators.required] }),
      almacen: this.fb.control('PRINCIP', { validators: [Validators.required] }),
      cantidad: this.fb.control(1, { validators: [Validators.required, Validators.min(0.01)] }),
      undMedida: this.fb.control(''),
      exento: this.fb.control(false),
      subTotal: this.fb.control(0),
      unitSImp: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      porDesc: this.fb.control(0, { validators: [Validators.min(0), Validators.max(100)] }),
      mtoDesc: this.fb.control(0),
      mtoNeto: this.fb.control(0),
      porImpto: this.fb.control(0, { validators: [Validators.min(0), Validators.max(100)] }),
      mtoImpto: this.fb.control(0),
      porExonera: this.fb.control(0, { validators: [Validators.min(0), Validators.max(100)] }),
      mtoExonera: this.fb.control(0),
      unitCImp: this.fb.control(0),
      total: this.fb.control(0),
      ultCosto: this.fb.control(0),
      observaciones: this.fb.control(''),
      imponible: this.fb.control(1),
      fleteInd: this.fb.control(0),
      fleteTot: this.fb.control(0),
      moneda: this.fb.control(this.form.controls.moneda.value),
      tcambio: this.fb.control(this.form.controls.tCambio.value),
      orden: this.fb.control(this.detalleArray.length + 1),
      codProduProv: this.fb.control(''),
      productoProv: this.fb.control('')
    });

    this.detalleArray.push(group);
    this.registerRowSubscriptions(group);
    this.recalculateRow(this.detalleArray.length - 1);
  }

  addDetalleAndOpenProducto(): void {
    this.addDetalleRow();
    const index = this.detalleArray.length - 1;
    if (index >= 0) {
      this.openProductoModal(index, true);
    }
  }

  removeDetalleRow(index: number): void {
    this.detalleArray.removeAt(index);
    this.updateOrdenes();
    this.recalculateTotals();
  }

  recalculateRow(index: number): void {
    const group = this.detalleArray.at(index);
    const cantidad = this.toNumber(group.controls.cantidad.value);
    const unitSImp = this.toNumber(group.controls.unitSImp.value);
    const porDesc = this.toNumber(group.controls.porDesc.value);
    const porImpto = this.toNumber(group.controls.porImpto.value);
    const porExonera = this.toNumber(group.controls.porExonera.value);
    const exento = group.controls.exento.value;

    const subTotal = cantidad * unitSImp;
    const mtoDesc = subTotal * (porDesc / 100);
    const mtoNeto = subTotal - mtoDesc;
    const impuestoBase = exento ? 0 : mtoNeto * (porImpto / 100);
    const mtoExonera = impuestoBase * (porExonera / 100);
    const total = mtoNeto + (impuestoBase - mtoExonera);
    const unitCImp = cantidad > 0 ? total / cantidad : 0;

    group.patchValue(
      {
        subTotal,
        mtoDesc,
        mtoNeto,
        mtoImpto: impuestoBase,
        mtoExonera,
        total,
        unitCImp
      },
      { emitEvent: false }
    );

    this.recalculateTotals();
  }

  recalculateTotals(): void {
    const values = this.detalleArray.getRawValue();
    const totDeta = values.reduce((sum, item) => sum + this.toNumber(item.subTotal), 0);
    const totNeto = values.reduce((sum, item) => sum + this.toNumber(item.mtoNeto), 0);
    const totImpu = values.reduce(
      (sum, item) => sum + (this.toNumber(item.mtoImpto) - this.toNumber(item.mtoExonera)),
      0
    );
    const exonera = values.reduce((sum, item) => sum + this.toNumber(item.mtoExonera), 0);
    const montoFlete = this.toNumber(this.form.controls.montoFlete.value);
    const montoPercep = this.toNumber(this.form.controls.montoPercep.value);
    const totalDocu = totNeto + totImpu + montoFlete + montoPercep;

    this.form.patchValue(
      {
        totDeta,
        totNeto,
        exonera,
        subTotal: totNeto,
        totImpu,
        totalDocu
      },
      { emitEvent: false }
    );
  }

  submit(): void {
    this.save(false);
  }

  submitAndNew(): void {
    this.save(true);
  }

  cancel(): void {
    this.router.navigate(['/compras/recepcion-facturas']);
  }

  isFieldInvalid(controlName: keyof CompraArticuloForm): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  isDetalleInvalid(index: number, controlName: keyof CompraArticuloDetalleForm): boolean {
    const control = this.detalleArray.at(index).get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  hasFechaRangoError(): boolean {
    return !!this.form.errors?.['fechaRango'] && (this.form.controls.fechaVenci.dirty || this.form.controls.fechaVenci.touched);
  }

  isTipoCambioInvalid(): boolean {
    return !!this.form.errors?.['tipoCambio'] && (this.form.controls.tCambio.dirty || this.form.controls.tCambio.touched);
  }

  getMonedaSimbolo(): string {
    const moneda = this.form.controls.moneda.value;
    return this.monedas.find((item) => item.codMoneda === moneda)?.simbolo || moneda || '₡';
  }

  trackByDetalle(index: number): number {
    return index;
  }

  private save(resetAfter: boolean): void {
    if (this.form.invalid || this.detalleArray.length === 0) {
      this.form.markAllAsTouched();
      this.detalleArray.controls.forEach((group) => group.markAllAsTouched());
      return;
    }

    const payload = this.buildDto();
    this.isSaving = true;
    this.errorMessage = '';

    this.comprasService
      .crearCompraArticulo(payload)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la compra.', error);
          return of({ respuesta: 'ERROR' });
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        Swal.fire({
          title: 'Éxito',
          text: 'Compra registrada correctamente.',
          icon: 'success'
        });
        if (resetAfter) {
          this.resetForm();
        } else {
          this.cancel();
        }
      });
  }

  private resetForm(): void {
    this.form.reset(
      {
        tipDocu: this.documentosCompra[0]?.CA04_CodDocu ?? 'COM',
        fechaIngreso: this.todayIso(),
        moneda: this.baseMoneda,
        tCambio: 1,
        codProve: '',
        rucProve: '',
        nomProve: '',
        tipDocProve: '',
        serie: '000',
        numFactura: '',
        fechaFactura: '',
        fechaVenci: '',
        frmPago: this.formasPago[0]?.codigo ?? '',
        numOrdenCmp: '',
        docFlete: '',
        montoFlete: 0,
        docPercep: '',
        montoPercep: 0,
        operador: this.getOperador(),
        totDeta: 0,
        totNeto: 0,
        exonera: 0,
        subTotal: 0,
        totImpu: 0,
        totalDocu: 0,
        totPago: 0
      },
      { emitEvent: false }
    );
    this.detalleArray.clear();
  }

  private buildDto(): CompraArticuloRequest {
    const raw = this.form.getRawValue();
    const detalle = this.detalleArray.getRawValue().map((item, index) => this.mapDetalle(item, index + 1));

    return {
      proceso: 0,
      tipDocu: this.sanitizeString(raw.tipDocu),
      fechaIngreso: this.sanitizeString(raw.fechaIngreso),
      moneda: this.sanitizeString(raw.moneda),
      tCambio: this.toNumber(raw.tCambio),
      codProve: this.sanitizeString(raw.codProve),
      rucProve: this.sanitizeString(raw.rucProve),
      nomProve: this.sanitizeString(raw.nomProve),
      tipDocProve: this.sanitizeString(raw.tipDocProve),
      serie: this.sanitizeString(raw.serie),
      numFactura: this.sanitizeString(raw.numFactura),
      fechaFactura: this.sanitizeString(raw.fechaFactura),
      fechaVenci: this.sanitizeString(raw.fechaVenci),
      totDeta: this.toNumber(raw.totDeta),
      totNeto: this.toNumber(raw.totNeto),
      exonera: this.toNumber(raw.exonera),
      subTotal: this.toNumber(raw.subTotal),
      totImpu: this.toNumber(raw.totImpu),
      totalDocu: this.toNumber(raw.totalDocu),
      totPago: this.toNumber(raw.totPago),
      docFlete: this.sanitizeString(raw.docFlete),
      montoFlete: this.toNumber(raw.montoFlete),
      docPercep: this.sanitizeString(raw.docPercep),
      montoPercep: this.toNumber(raw.montoPercep),
      frmPago: this.sanitizeString(raw.frmPago),
      numOrdenCmp: this.sanitizeString(raw.numOrdenCmp),
      operador: this.sanitizeString(raw.operador),
      detalle
    };
  }

  private mapDetalle(item: CompraArticuloDetalleFormModel, orden: number): CompraArticuloDetalle {
    return {
      codProdu: this.sanitizeString(item.codProdu),
      producto: this.sanitizeString(item.producto),
      almacen: this.sanitizeString(item.almacen),
      cantidad: this.toNumber(item.cantidad),
      undMedida: this.sanitizeString(item.undMedida),
      exento: item.exento ? 1 : 0,
      subTotal: this.toNumber(item.subTotal),
      unitSImp: this.toNumber(item.unitSImp),
      porDesc: this.toNumber(item.porDesc),
      mtoDesc: this.toNumber(item.mtoDesc),
      mtoNeto: this.toNumber(item.mtoNeto),
      porImpto: this.toNumber(item.porImpto),
      mtoImpto: this.toNumber(item.mtoImpto),
      porExonera: this.toNumber(item.porExonera),
      mtoExonera: this.toNumber(item.mtoExonera),
      unitCImp: this.toNumber(item.unitCImp),
      total: this.toNumber(item.total),
      ultCosto: this.toNumber(item.ultCosto),
      observaciones: this.sanitizeString(item.observaciones),
      imponible: this.toNumber(item.imponible),
      fleteInd: this.toNumber(item.fleteInd),
      fleteTot: this.toNumber(item.fleteTot),
      moneda: this.sanitizeString(item.moneda),
      tcambio: this.toNumber(item.tcambio),
      orden,
      codProduProv: this.sanitizeString(item.codProduProv),
      productoProv: this.sanitizeString(item.productoProv)
    };
  }

  private loadCatalogs(): void {
    this.monedasLoading = true;
    this.formasPagoLoading = true;
    this.almacenesLoading = true;

    forkJoin({
      monedas: this.monedaService.getAll().pipe(catchError(() => of([]))),
      formasPago: this.formaPagoService.getAll().pipe(catchError(() => of([]))),
      almacenes: this.almacenService.getAlmacenes().pipe(catchError(() => of([])))
    })
      .pipe(
        finalize(() => {
          this.monedasLoading = false;
          this.formasPagoLoading = false;
          this.almacenesLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ monedas, formasPago, almacenes }) => {
        this.monedas = monedas ?? [];
    this.formasPago = formasPago ?? [];
    this.almacenes = almacenes ?? [];
    this.almacenesFiltered = [...this.almacenes];

        const base = this.monedas.find((item) => item.primario === 1)?.codMoneda ?? this.baseMoneda;
        this.baseMoneda = base || this.baseMoneda;

        if (!this.form.controls.moneda.value) {
          this.form.controls.moneda.setValue(this.baseMoneda, { emitEvent: false });
        }

        if (!this.form.controls.frmPago.value && this.formasPago.length > 0) {
          this.form.controls.frmPago.setValue(this.formasPago[0].codigo, { emitEvent: false });
        }

        this.updateTipoCambioValidators();
        this.syncDetalleMoneda();
      });
  }

  private registerHeaderSubscriptions(): void {
    this.form.controls.moneda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateTipoCambioValidators();
      this.syncDetalleMoneda();
    });

    this.form.controls.tCambio.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncDetalleMoneda();
    });

    merge(this.form.controls.montoFlete.valueChanges, this.form.controls.montoPercep.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recalculateTotals();
      });
  }

  private registerRowSubscriptions(group: FormGroup<CompraArticuloDetalleForm>): void {
    merge(
      group.controls.cantidad.valueChanges,
      group.controls.unitSImp.valueChanges,
      group.controls.porDesc.valueChanges,
      group.controls.porImpto.valueChanges,
      group.controls.porExonera.valueChanges,
      group.controls.exento.valueChanges
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const currentIndex = this.detalleArray.controls.indexOf(group);
        if (currentIndex >= 0) {
          this.recalculateRow(currentIndex);
        }
      });
  }

  private loadDocumentosCompra(): void {
    this.documentosCompraLoading = true;
    this.http
      .get<DocumentoCompra[] | DocumentoCompra>(this.documentoCompraUrl)
      .pipe(
        catchError(() => of([])),
        finalize(() => {
          this.documentosCompraLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        const items = Array.isArray(response) ? response : response ? [response] : [];
        this.documentosCompra = items;
        const current = this.form.controls.tipDocu.value;
        const exists = !!current && this.documentosCompra.some((doc) => doc.CA04_CodDocu === current);
        if (!exists) {
          const next = this.documentosCompra[0]?.CA04_CodDocu ?? '';
          if (next) {
            this.form.controls.tipDocu.setValue(next, { emitEvent: false });
          }
        }
      });
  }

  private updateTipoCambioValidators(): void {
    const control = this.form.controls.tCambio;
    const moneda = this.form.controls.moneda.value;
    if (this.isMonedaBase(moneda)) {
      control.setValidators([Validators.required, Validators.min(0.0001)]);
      control.setValue(1, { emitEvent: false });
    } else {
      control.setValidators([Validators.required, Validators.min(0.0001)]);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private syncDetalleMoneda(): void {
    const moneda = this.form.controls.moneda.value;
    const tcambio = this.form.controls.tCambio.value;
    this.detalleArray.controls.forEach((group) => {
      group.patchValue({ moneda, tcambio }, { emitEvent: false });
    });
  }

  private updateOrdenes(): void {
    this.detalleArray.controls.forEach((group, index) => {
      group.controls.orden.setValue(index + 1, { emitEvent: false });
    });
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error'
    });
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private isMonedaBase(moneda: string): boolean {
    return moneda === this.baseMoneda;
  }

  private normalizeValue(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toNumber(value: number | string | null | undefined): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private sanitizeString(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }

  private minArrayLength(min: number): ValidatorFn {
    return (control) => {
      const value = control as FormArray;
      return value && value.length >= min ? null : { minArrayLength: { min } };
    };
  }

  private dateRangeValidator(): ValidatorFn {
    return (control) => {
      const group = control as FormGroup<CompraArticuloForm>;
      const inicio = group.controls.fechaFactura.value;
      const fin = group.controls.fechaVenci.value;
      if (!inicio || !fin) {
        return null;
      }
      return fin >= inicio ? null : { fechaRango: true };
    };
  }

  private tipoCambioValidator(): ValidatorFn {
    return (control) => {
      const group = control as FormGroup<CompraArticuloForm>;
      const moneda = group.controls.moneda.value;
      const tcambio = this.toNumber(group.controls.tCambio.value);
      if (!moneda) {
        return null;
      }
      if (this.isMonedaBase(moneda)) {
        return null;
      }
      return tcambio > 0 ? null : { tipoCambio: true };
    };
  }
}
