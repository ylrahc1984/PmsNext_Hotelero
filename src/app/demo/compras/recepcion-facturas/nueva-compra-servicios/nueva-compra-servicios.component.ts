import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, merge, of, firstValueFrom } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { ProveedorService, ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';
import { MonedaService, MonedaUI } from 'src/app/demo/administracion/monedas/moneda.service';
import { FormaPagoService } from 'src/app/demo/administracion/forma-pago/forma-pago.service';
import { FormaPago } from 'src/app/demo/administracion/forma-pago/forma-pago.models';
import { ComprasServiciosService } from './compras-servicios.service';
import { environment } from 'src/environments/environment';
import { CompraServicioDetalleData } from '../interfaces/compra-servicio-detalle.interface';

interface CompraServicioDetalleForm {
  codigo: FormControl<string>;
  servicio: FormControl<string>;
  cantidad: FormControl<number>;
  grabado: FormControl<string>;
  exento: FormControl<boolean>;
  subTotal: FormControl<number>;
  porImp: FormControl<number>;
  impuesto: FormControl<number>;
  total: FormControl<number>;
  orden: FormControl<number>;
}

interface CompraServicioDetalleFormModel {
  codigo: string;
  servicio: string;
  cantidad: number;
  grabado: string;
  exento: boolean;
  subTotal: number;
  porImp: number;
  impuesto: number;
  total: number;
  orden: number;
}

interface CompraServicioForm {
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
  operador: FormControl<string>;
  totDeta: FormControl<number>;
  totNeto: FormControl<number>;
  exonera: FormControl<number>;
  subTotal: FormControl<number>;
  totImpu: FormControl<number>;
  totalDocu: FormControl<number>;
  totPago: FormControl<number>;
  observaciones: FormControl<string>;
  montoFlete: FormControl<number>;
  docPercep: FormControl<string>;
  montoPercep: FormControl<number>;
  detalle: FormArray<FormGroup<CompraServicioDetalleForm>>;
}

interface CompraServicioDetalle {
  codProdu: string;
  producto: string;
  cantidad: number;
  grabado: string;
  exento: number;
  subTotal: number;
  porImp: number;
  impuesto: number;
  total: number;
  tcambio: number;
  orden: number;
}

interface ServicioDto {
  codServicio: string;
  servicio: string;
  ctaConta: string;
  descripcionCuenta: string;
  ctaCtaPrv: string;
  nomCtaPrv: string;
  operador: string;
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

interface CompraServicioRequest {
  tipDocu: string;
  numDocu: string;
  fechaIngreso: string;
  moneda: string;
  tCambio: number;
  codProve: string;
  rucProve: string;
  nomProve: string;
  tipDocProve: string;
  serie: string;
  numFactura: string;
  fechaFactura: string;
  fechaVenci: string;
  totDeta: number;
  totNeto: number;
  exonera: number;
  subTotal: number;
  totImpu: number;
  totalDocu: number;
  totPago: number;
  observaciones: string;
  montoFlete: number;
  docPercep: string;
  montoPercep: number;
  frmPago: string;
  numOrdenCmp: string;
  operador: string;
  detalle: CompraServicioDetalle[];
}

@Component({
  selector: 'app-nueva-compra-servicios',
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './nueva-compra-servicios.component.html',
  styleUrls: ['./nueva-compra-servicios.component.scss']
})
export class NuevaCompraServiciosComponent implements OnInit {
  private static readonly TIPO_DOCUMENTO_SERVICIO = 'SRV';
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly monedaService = inject(MonedaService);
  private readonly formaPagoService = inject(FormaPagoService);
  private readonly comprasServiciosService = inject(ComprasServiciosService);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: FormGroup<CompraServicioForm> = this.fb.group(
    {
      tipDocu: this.fb.control('', { validators: [Validators.required] }),
      fechaIngreso: this.fb.control(this.todayIso(), { validators: [Validators.required] }),
      moneda: this.fb.control('', { validators: [Validators.required] }),
      tCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0.0001)] }),
      codProve: this.fb.control('', { validators: [Validators.required] }),
      rucProve: this.fb.control('', { validators: [Validators.required] }),
      nomProve: this.fb.control('', { validators: [Validators.required] }),
      tipDocProve: this.fb.control('', { validators: [Validators.required] }),
      serie: this.fb.control('000', { validators: [Validators.required] }),
      numFactura: this.fb.control('', { validators: [Validators.required] }),
      fechaFactura: this.fb.control('', { validators: [Validators.required] }),
      fechaVenci: this.fb.control('', { validators: [Validators.required] }),
      frmPago: this.fb.control('', { validators: [Validators.required] }),
      numOrdenCmp: this.fb.control(''),
      operador: this.fb.control(''),
      totDeta: this.fb.control(0),
      totNeto: this.fb.control(0),
      exonera: this.fb.control(0),
      subTotal: this.fb.control(0),
      totImpu: this.fb.control(0),
      totalDocu: this.fb.control(0),
      totPago: this.fb.control(0),
      observaciones: this.fb.control(''),
      montoFlete: this.fb.control(0, { validators: [Validators.min(0)] }),
      docPercep: this.fb.control(''),
      montoPercep: this.fb.control(0, { validators: [Validators.min(0)] }),
      detalle: this.fb.array<FormGroup<CompraServicioDetalleForm>>([], { validators: [this.minArrayLength(1)] })
    },
    { validators: [this.dateRangeValidator(), this.tipoCambioValidator()] }
  );

  tiposDocumento: { value: string; label: string }[] = [];

  readonly proveedorSearchForm: FormGroup<{ codigo: FormControl<string>; descripcion: FormControl<string> }> = this.fb.group({
    codigo: this.fb.control(''),
    descripcion: this.fb.control('')
  });

  readonly servicioSearchForm: FormGroup<{ search: FormControl<string> }> = this.fb.group({
    search: this.fb.control('')
  });

  documentosCompra: DocumentoCompra[] = [];
  documentosCompraLoading = false;
  proveedores: ProveedorUI[] = [];
  monedas: MonedaUI[] = [];
  formasPago: FormaPago[] = [];
  servicios: ServicioDto[] = [];
  serviciosFiltered: ServicioDto[] = [];

  proveedoresLoading = false;
  monedasLoading = false;
  formasPagoLoading = false;
  serviciosLoading = false;
  isSaving = false;
  isEditMode = false;
  loadingDocument = false;
  errorMessage = '';
  editingTipDocu = '';
  editingNumDocu = '';

  showProveedorModal = false;
  showServicioModal = false;
  proveedorPage = 1;
  proveedorPageSize = 10;
  proveedorTotalRegistros = 0;
  proveedorTotalPages = 1;
  readonly proveedorPageSizeOptions = [10, 20, 50];

  servicioPage = 1;
  servicioPageSize = 8;
  readonly servicioPageSizeOptions = [8, 15, 25];

  baseMoneda = 'CRC';
  private readonly documentoCompraUrl = `${environment.apiUrl}/documento/compra/1`;
  private readonly serviciosUrl = `${environment.apiUrl}/Servicios`;

  ngOnInit(): void {
    this.form.controls.operador.setValue(this.getOperador(), { emitEvent: false });
    this.editingTipDocu = this.sanitizeString(this.route.snapshot.paramMap.get('tipDocu'));
    this.editingNumDocu = this.sanitizeString(this.route.snapshot.paramMap.get('numDocu'));
    this.isEditMode = this.editingTipDocu === NuevaCompraServiciosComponent.TIPO_DOCUMENTO_SERVICIO && !!this.editingNumDocu;
    this.loadCatalogs();
    this.loadDocumentosCompra();
    this.registerHeaderSubscriptions();
    if (this.isEditMode) {
      void this.loadCompraServicioForEdit(this.editingTipDocu, this.editingNumDocu);
    }
  }

  get detalleArray(): FormArray<FormGroup<CompraServicioDetalleForm>> {
    return this.form.controls.detalle;
  }

  get canSubmit(): boolean {
    return this.form.valid && this.detalleArray.length > 0 && !this.isSaving && !this.loadingDocument;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Editar Compra de Servicios' : 'Nueva Compra de Servicios';
  }

  get pageSubtitle(): string {
    return this.isEditMode ? 'Actualiza la factura de servicios registrada.' : 'Registro de factura de servicios';
  }

  get submitLabel(): string {
    return this.isEditMode ? 'Actualizar' : 'Guardar';
  }

  addDetalle(): void {
    this.openServicioModal();
  }

  removeDetalle(index: number): void {
    this.detalleArray.removeAt(index);
    this.updateOrdenes();
    this.recalcularTotales();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.detalleArray.length === 0) {
      this.form.markAllAsTouched();
      this.detalleArray.controls.forEach((group) => group.markAllAsTouched());
      return;
    }

    const confirmation = await Swal.fire({
      title: this.isEditMode ? 'Actualizar compra' : 'Registrar compra',
      text: this.isEditMode ? '¿Desea actualizar la compra de servicios?' : '¿Desea registrar la compra de servicios?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: this.isEditMode ? 'Sí, actualizar' : 'Sí, registrar',
      cancelButtonText: 'No'
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const payload = this.buildDto();
    this.isSaving = true;
    this.errorMessage = '';

    try {
      const request = this.isEditMode
        ? this.comprasServiciosService.actualizarCompraServicio(this.editingTipDocu, this.editingNumDocu, payload)
        : this.comprasServiciosService.crearCompraServicio(payload);
      await firstValueFrom(request);
      await Swal.fire({
        title: 'Exito',
        text: this.isEditMode
          ? 'Compra de servicios actualizada correctamente.'
          : 'Compra de servicios registrada correctamente.',
        icon: 'success'
      });
      this.cancel();
    } catch (error) {
      this.handleError('No se pudo guardar la compra de servicios.', error);
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/compras/recepcion-facturas']);
  }

  openProveedorModal(): void {
    this.showProveedorModal = true;
    this.proveedorPage = 1;
    this.buscarProveedores();
  }

  closeProveedorModal(): void {
    this.showProveedorModal = false;
  }

  buscarProveedores(page: number = this.proveedorPage): void {
    this.proveedoresLoading = true;
    const codigo = this.normalizeValue(this.proveedorSearchForm.controls.codigo.value);
    const descripcion = this.normalizeValue(this.proveedorSearchForm.controls.descripcion.value);

    this.proveedorService
      .getProveedores(page, this.proveedorPageSize, codigo, descripcion)
      .pipe(
        catchError((error) => {
          console.error('Error al cargar proveedores', error);
          return of({ data: [], totalRegistros: 0, paginaActual: 1, pageSize: this.proveedorPageSize, totalPages: 1 });
        }),
        finalize(() => {
          this.proveedoresLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.proveedores = response.data ?? [];
        this.proveedorTotalRegistros = response.totalRegistros ?? 0;
        this.proveedorTotalPages = response.totalPages ?? 1;
        this.proveedorPage = response.paginaActual ?? page;
        this.proveedorPageSize = response.pageSize ?? this.proveedorPageSize;
      });
  }

  limpiarBusquedaProveedores(): void {
    this.proveedorSearchForm.reset({ codigo: '', descripcion: '' });
    this.proveedorPage = 1;
    this.buscarProveedores();
  }

  goToProveedorPageRelative(delta: number): void {
    const next = this.proveedorPage + delta;
    if (next < 1 || next > this.proveedorTotalPages) {
      return;
    }
    this.proveedorPage = next;
    this.buscarProveedores();
  }

  onProveedorPageSizeChange(sizeValue: string): void {
    const size = Number(sizeValue);
    this.proveedorPageSize = Number.isFinite(size) && size > 0 ? size : this.proveedorPageSize;
    this.proveedorPage = 1;
    this.buscarProveedores();
  }

  seleccionarProveedor(proveedor: ProveedorUI): void {
    this.form.patchValue(
      {
        codProve: proveedor.codigo,
        nomProve: proveedor.descripcion,
        rucProve: proveedor.ruc
      },
      { emitEvent: false }
    );
    this.closeProveedorModal();
  }

  openServicioModal(): void {
    this.showServicioModal = true;
    this.servicioPage = 1;
    this.loadServicios();
  }

  closeServicioModal(): void {
    this.showServicioModal = false;
  }

  buscarServicios(): void {
    this.servicioPage = 1;
    this.applyServicioFilter();
  }

  limpiarBusquedaServicios(): void {
    this.servicioSearchForm.reset({ search: '' });
    this.servicioPage = 1;
    this.applyServicioFilter();
  }

  goToServicioPageRelative(delta: number): void {
    const next = this.servicioPage + delta;
    if (next < 1 || next > this.servicioTotalPages) {
      return;
    }
    this.servicioPage = next;
  }

  onServicioPageSizeChange(sizeValue: string): void {
    const size = Number(sizeValue);
    this.servicioPageSize = Number.isFinite(size) && size > 0 ? size : this.servicioPageSize;
    this.servicioPage = 1;
  }

  get servicioTotalPages(): number {
    return Math.max(1, Math.ceil(this.serviciosFiltered.length / this.servicioPageSize));
  }

  get paginatedServicios(): ServicioDto[] {
    const start = (this.servicioPage - 1) * this.servicioPageSize;
    return this.serviciosFiltered.slice(start, start + this.servicioPageSize);
  }

  seleccionarServicio(servicio: ServicioDto): void {
    const group = this.createDetalleGroup();
    group.patchValue(
      {
        codigo: servicio.codServicio,
        servicio: servicio.servicio
      },
      { emitEvent: false }
    );
    this.detalleArray.push(group);
    this.registerRowSubscriptions(group);
    this.updateOrdenes();
    this.recalcularLinea(this.detalleArray.length - 1);
    this.closeServicioModal();
  }

  isFieldInvalid(controlName: keyof CompraServicioForm): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  isDetalleInvalid(index: number, controlName: keyof CompraServicioDetalleForm): boolean {
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

  recalcularTotales(): void {
    const values = this.detalleArray.getRawValue();
    const totDeta = values.reduce((sum, item) => sum + this.toNumber(item.subTotal), 0);
    const exonera = values.reduce(
      (sum, item) => sum + (item.exento || !item.grabado ? this.toNumber(item.subTotal) : 0),
      0
    );
    const totNeto = totDeta - exonera;
    const totImpu = values.reduce((sum, item) => sum + this.toNumber(item.impuesto), 0);
    const totalDocu = totNeto + exonera + totImpu;

    this.form.patchValue(
      {
        totDeta,
        totNeto,
        exonera,
        subTotal: totNeto,
        totImpu,
        totalDocu,
        totPago: totalDocu
      },
      { emitEvent: false }
    );
  }

  private createDetalleGroup(): FormGroup<CompraServicioDetalleForm> {
    return this.fb.group({
      codigo: this.fb.control('', { validators: [Validators.required] }),
      servicio: this.fb.control('', { validators: [Validators.required] }),
      cantidad: this.fb.control(1, { validators: [Validators.required, Validators.min(0.01)] }),
      grabado: this.fb.control('1'),
      exento: this.fb.control(false),
      subTotal: this.fb.control(0, { validators: [Validators.required, Validators.min(0)] }),
      porImp: this.fb.control(0, { validators: [Validators.required, Validators.min(0), Validators.max(100)] }),
      impuesto: this.fb.control(0),
      total: this.fb.control(0),
      orden: this.fb.control(this.detalleArray.length + 1)
    });
  }

  private recalcImpuesto(subTotal: number, porImp: number, grabado: string, exento: boolean): number {
    if (grabado !== '1' || exento) {
      return 0;
    }
    return subTotal * (porImp / 100);
  }

  private recalcTotal(subTotal: number, impuesto: number): number {
    return subTotal + impuesto;
  }

  private recalcularLinea(index: number): void {
    const group = this.detalleArray.at(index);
    if (!group) {
      return;
    }

    const subTotal = this.toNumber(group.controls.subTotal.value);
    const porImp = this.toNumber(group.controls.porImp.value);
    const grabado = group.controls.grabado.value;
    const exento = group.controls.exento.value;

    const impuesto = this.recalcImpuesto(subTotal, porImp, grabado, exento);
    const total = this.recalcTotal(subTotal, impuesto);

    group.patchValue(
      {
        impuesto,
        total
      },
      { emitEvent: false }
    );

    this.recalcularTotales();
  }

  private async loadCompraServicioForEdit(tipDocu: string, numDocu: string): Promise<void> {
    this.loadingDocument = true;
    this.errorMessage = '';

    try {
      const data = await firstValueFrom(this.comprasServiciosService.getCompraServicioDetalle(tipDocu, numDocu));
      if (!data?.encabezado) {
        this.errorMessage = 'No se encontró la compra de servicios solicitada para edición.';
        return;
      }
      this.applyCompraServicioData(data);
    } catch (error) {
      this.handleError('No se pudo cargar la compra de servicios para edición.', error);
    } finally {
      this.loadingDocument = false;
    }
  }

  private applyCompraServicioData(data: CompraServicioDetalleData): void {
    const header = data.encabezado;

    this.form.patchValue(
      {
        tipDocu: this.resolveTipoDocumentoCode(header.PAC00_TipDocu),
        fechaIngreso: this.formatDateToInput(header.PAC00_Fecha),
        moneda: this.sanitizeString(header.PAC00_Moneda),
        tCambio: this.toNumber(header.PAC00_TCambio),
        codProve: this.sanitizeString(header.PAC00_CodProve),
        rucProve: this.sanitizeString(header.PAC00_RucProve),
        nomProve: this.sanitizeString(header.PAC00_NomProve),
        tipDocProve: this.resolveTipoDocumentoCode(header.PAC00_TipDocu),
        serie: this.sanitizeString(header.PAC00_Serie),
        numFactura: this.sanitizeString(header.PAC00_NumFactura),
        fechaFactura: this.formatDateToInput(header.PAC00_FecFactu),
        fechaVenci: this.formatDateToInput(header.PAC00_FecVen),
        frmPago: this.sanitizeString(header.PAC00_FrmPago),
        numOrdenCmp: this.sanitizeString(header.PAC00_NumOrden),
        operador: this.sanitizeString(header.PAC00_Operador) || this.getOperador(),
        totDeta: this.toNumber(header.PAC00_TotDeta),
        totNeto: this.toNumber(header.PAC00_Neto),
        exonera: this.toNumber(header.PAC00_Exento),
        subTotal: this.toNumber(header.PAC00_SubTotal),
        totImpu: this.toNumber(header.PAC00_Impuesto),
        totalDocu: this.toNumber(header.PAC00_TotalDocu),
        totPago: this.toNumber(header.PAC00_TotPagado),
        observaciones: this.sanitizeString(header.PAC00_Concepto),
        montoFlete: this.toNumber(header.PAC00_MontoFlete),
        docPercep: this.sanitizeString(header.PAC00_DocPercep),
        montoPercep: this.toNumber(header.PAC00_MontoPercep)
      },
      { emitEvent: false }
    );

    this.detalleArray.clear();
    (data.detalle || []).forEach((item) => {
      const group = this.createDetalleGroup();
      group.patchValue(
        {
          codigo: this.sanitizeString(item.PAC02_CodProdu),
          servicio: this.sanitizeString(item.PAC02_Producto),
          cantidad: this.toNumber(item.PAC02_Cantidad),
          grabado: this.sanitizeString(item.PAC02_Grabado) === '1' ? '1' : '0',
          exento: this.toNumber(item.PAC02_Exento) > 0,
          subTotal: this.toNumber(item.PAC02_SubTotal),
          porImp: this.toNumber(item.PAC02_PorImp),
          impuesto: this.toNumber(item.PAC02_Impuesto),
          total: this.toNumber(item.PAC02_Total),
          orden: this.toNumber(item.PAC02_Orden)
        },
        { emitEvent: false }
      );
      this.detalleArray.push(group);
      this.registerRowSubscriptions(group);
    });

    this.updateOrdenes();
    this.recalcularTotales();
  }

  private loadCatalogs(): void {
    this.monedasLoading = true;
    this.formasPagoLoading = true;

    forkJoin({
      monedas: this.monedaService.getAll().pipe(catchError(() => of([]))),
      formasPago: this.formaPagoService.getAll().pipe(catchError(() => of([])))
    })
      .pipe(
        finalize(() => {
          this.monedasLoading = false;
          this.formasPagoLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ monedas, formasPago }) => {
        this.monedas = monedas ?? [];
        this.formasPago = formasPago ?? [];

        const base = this.monedas.find((item) => item.primario === 1)?.codMoneda ?? this.baseMoneda;
        this.baseMoneda = base || this.baseMoneda;

        if (!this.form.controls.moneda.value) {
          this.form.controls.moneda.setValue(this.baseMoneda, { emitEvent: false });
        }

        if (!this.form.controls.frmPago.value && this.formasPago.length > 0) {
          this.form.controls.frmPago.setValue(this.formasPago[0].codigo, { emitEvent: false });
        }

        this.updateTipoCambioValidators();
      });
  }

  private registerHeaderSubscriptions(): void {
    this.form.controls.moneda.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateTipoCambioValidators();
    });

    this.form.controls.tipDocu.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const tipDocu = this.resolveTipoDocumentoCode(value);
      this.form.controls.tipDocProve.setValue(tipDocu, { emitEvent: false });
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
        this.tiposDocumento = this.documentosCompra.map((doc) => ({
          value: doc.CA04_CodDocu,
          label: `${doc.CA04_CodDocu} - ${doc.CA04_NomDocu}`
        }));

        const selectedDoc =
          this.documentosCompra.find((doc) => doc.CA04_CodDocu === NuevaCompraServiciosComponent.TIPO_DOCUMENTO_SERVICIO) ??
          this.documentosCompra.find((doc) => doc.CA04_CodDocu === this.form.controls.tipDocu.value) ??
          this.documentosCompra[0];

        const selectedCode = this.resolveTipoDocumentoCode(selectedDoc?.CA04_CodDocu);
        this.form.controls.tipDocu.setValue(selectedCode, { emitEvent: false });
        this.form.controls.tipDocProve.setValue(selectedCode, { emitEvent: false });
      });
  }

  private loadServicios(): void {
    this.serviciosLoading = true;
    this.http
      .get<{ datos?: ServicioDto[] }>(this.serviciosUrl)
      .pipe(
        catchError((error) => {
          console.error('Error al cargar servicios', error);
          return of({ datos: [] });
        }),
        finalize(() => {
          this.serviciosLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.servicios = response?.datos ?? [];
        this.applyServicioFilter();
      });
  }

  private applyServicioFilter(): void {
    const term = this.normalizeValue(this.servicioSearchForm.controls.search.value);
    if (!term) {
      this.serviciosFiltered = [...this.servicios];
      return;
    }
    const lower = term.toLowerCase();
    this.serviciosFiltered = this.servicios.filter((item) => {
      return (
        item.codServicio?.toLowerCase().includes(lower) ||
        item.servicio?.toLowerCase().includes(lower) ||
        item.descripcionCuenta?.toLowerCase().includes(lower)
      );
    });
  }

  private registerRowSubscriptions(group: FormGroup<CompraServicioDetalleForm>): void {
    merge(
      group.controls.cantidad.valueChanges,
      group.controls.subTotal.valueChanges,
      group.controls.porImp.valueChanges,
      group.controls.grabado.valueChanges,
      group.controls.exento.valueChanges
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const currentIndex = this.detalleArray.controls.indexOf(group);
        if (currentIndex >= 0) {
          this.recalcularLinea(currentIndex);
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

  private updateOrdenes(): void {
    this.detalleArray.controls.forEach((group, index) => {
      group.controls.orden.setValue(index + 1, { emitEvent: false });
    });
  }

  private buildDto(): CompraServicioRequest {
    const raw = this.form.getRawValue();
    const detalle = this.detalleArray.getRawValue().map((item, index) => this.mapDetalle(item, index + 1));
    const tCambio = this.roundNumber(this.toNumber(raw.tCambio), 4);

    return {
      tipDocu: 'SRV',
      numDocu: this.isEditMode ? this.editingNumDocu : '',
      fechaIngreso: this.formatDateForApi(raw.fechaIngreso),
      moneda: this.sanitizeString(raw.moneda),
      tCambio,
      codProve: this.sanitizeString(raw.codProve),
      rucProve: this.sanitizeString(raw.rucProve),
      nomProve: this.sanitizeString(raw.nomProve),
      tipDocProve: this.resolveTipoDocumentoCode(raw.tipDocu),
      serie: this.sanitizeString(raw.serie),
      numFactura: this.sanitizeString(raw.numFactura),
      fechaFactura: this.formatDateForApi(raw.fechaFactura),
      fechaVenci: this.formatDateForApi(raw.fechaVenci),
      totDeta: this.roundNumber(this.toNumber(raw.totDeta)),
      totNeto: this.roundNumber(this.toNumber(raw.totNeto)),
      exonera: this.roundNumber(this.toNumber(raw.exonera)),
      subTotal: this.roundNumber(this.toNumber(raw.subTotal)),
      totImpu: this.roundNumber(this.toNumber(raw.totImpu)),
      totalDocu: this.roundNumber(this.toNumber(raw.totalDocu)),
      totPago: 0,
      observaciones: this.sanitizeString(raw.observaciones),
      montoFlete: this.roundNumber(this.toNumber(raw.montoFlete)),
      docPercep: this.sanitizeString(raw.docPercep),
      montoPercep: this.roundNumber(this.toNumber(raw.montoPercep)),
      frmPago: this.sanitizeString(raw.frmPago),
      numOrdenCmp: this.sanitizeString(raw.numOrdenCmp),
      operador: this.sanitizeString(raw.operador),
      detalle
    };
  }

  private mapDetalle(item: CompraServicioDetalleFormModel, orden: number): CompraServicioDetalle {
    const tCambio = this.roundNumber(this.toNumber(this.form.controls.tCambio.value), 4);
    return {
      codProdu: this.sanitizeString(item.codigo),
      producto: this.sanitizeString(item.servicio),
      cantidad: this.roundNumber(this.toNumber(item.cantidad)),
      grabado: item.grabado === '1' ? '1' : '0',
      exento: item.exento ? 1 : 0,
      subTotal: this.roundNumber(this.toNumber(item.subTotal)),
      porImp: this.roundNumber(this.toNumber(item.porImp)),
      impuesto: this.roundNumber(this.toNumber(item.impuesto)),
      total: this.roundNumber(this.toNumber(item.total)),
      tcambio: tCambio,
      orden
    };
  }

  private buildNumDocu(serie: string, numFactura: string): string {
    const serieClean = this.sanitizeString(serie);
    const numClean = this.sanitizeString(numFactura);
    if (serieClean && numClean) {
      return `${serieClean}-${numClean}`;
    }
    return numClean || serieClean;
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

  private roundNumber(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private resolveTipoDocumentoCode(value?: string | null): string {
    const requestedCode = this.sanitizeString(value);
    const matchedDoc = requestedCode
      ? this.documentosCompra.find((doc) => this.sanitizeString(doc.CA04_CodDocu) === requestedCode)
      : undefined;
    const fallbackDoc =
      this.documentosCompra.find((doc) => this.sanitizeString(doc.CA04_CodDocu) === NuevaCompraServiciosComponent.TIPO_DOCUMENTO_SERVICIO) ??
      this.documentosCompra[0];

    return this.sanitizeString(matchedDoc?.CA04_CodDocu ?? fallbackDoc?.CA04_CodDocu ?? requestedCode);
  }

  private sanitizeString(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private formatDateForApi(value: string | null | undefined): string {
    const trimmed = this.sanitizeString(value);
    if (!trimmed) {
      return '';
    }
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

  private formatDateToInput(value: string | null | undefined): string {
    const trimmed = this.sanitizeString(value);
    if (!trimmed) {
      return '';
    }
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      const day = `${date.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (year && month && day) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }
    return trimmed;
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
      const group = control as FormGroup<CompraServicioForm>;
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
      const group = control as FormGroup<CompraServicioForm>;
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
