import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { BancosService } from '../bancos.service';
import { CuentaBancoService } from '../../cuenta-banco/cuenta-banco.service';
import { ProveedorService, ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';
import { RetiroCxpService } from './retiro.service';
import { RetiroCxp, RetiroCxpDetalleContable, RetiroCxpFactura } from './models/retiro-cxp.model';

type RetiroForm = {
  codBanco: FormControl<string>;
  codCtaBanco: FormControl<string>;
  fecha: FormControl<string>;
  numOperacion: FormControl<string>;
  tipoOperacion: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  numBeneficiario: FormControl<string>;
  beneficiario: FormControl<string>;
  concepto: FormControl<string>;
  monto: FormControl<number>;
  pagos: FormArray<FormGroup<FacturaForm>>;
  detalle: FormArray<FormGroup<DetalleForm>>;
};

type FacturaForm = {
  tipoDocu: FormControl<string>;
  numDocu: FormControl<string>;
  tipDocPrv: FormControl<string>;
  serieDocPrv: FormControl<string>;
  numFacPrv: FormControl<string>;
  fechaCobra: FormControl<string>;
  fechaVen: FormControl<string>;
  tipoPago: FormControl<string>;
  totalDocu: FormControl<number>;
  saldo: FormControl<number>;
  moneda: FormControl<string>;
  montoPago: FormControl<number>;
  tCambio: FormControl<number>;
  estado: FormControl<string>;
  descripcion: FormControl<string>;
  tipoOpe: FormControl<string>;
};

type DetalleForm = {
  codConcepto: FormControl<string>;
  concepto: FormControl<string>;
  moneda: FormControl<string>;
  monto: FormControl<number>;
  tCambio: FormControl<number>;
  numAsientoObs: FormControl<string>;
  operador: FormControl<string>;
};

interface FacturaSeleccionada {
  tipoDocu: string;
  numDocu: string;
  tipDocPrv: string;
  serieDocPrv?: string;
  numFacPrv?: string;
  fechaCobra?: string;
  fechaVen?: string;
  tipoPago?: string;
  totalDocu: number;
  saldo: number;
  moneda: string;
  montoPago?: number;
  estado: string;
  tCambio?: number;
  descripcion?: string;
  tipoOpe?: string;
  codProve: string;
  nomProve: string;
}

interface CuentaBancoOption {
  value: string;
  label: string;
  moneda?: string;
}

const DETALLE_CONTABLE_DEFAULTS = {
  codConcepto: 'PAPRO',
  concepto: 'PAGO A PROVEEDORES',
  numAsientoObs: '',
  operador: ''
} as const;

@Component({
  selector: 'app-retiro-form',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule],
  templateUrl: './retiro-form.component.html',
  styleUrls: ['./retiro-form.component.scss'],
  animations: [
    trigger('fadeSlideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class RetiroFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly retiroService = inject(RetiroCxpService);
  private readonly bancosService = inject(BancosService);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly toast = inject(ToastService);

  //readonly tipoOperacionOptions = ['CHQ', 'Transferencia', 'Débito', 'Efectivo', 'Otro'];
  readonly monedaOptions = ['USD', 'COL', 'EUR'];

  readonly retiroForm: FormGroup<RetiroForm> = this.fb.group({
    codBanco: this.fb.control('', { validators: [Validators.required] }),
    codCtaBanco: this.fb.control('', { validators: [Validators.required] }),
    fecha: this.fb.control(this.formatDateToInput(new Date()), { validators: [Validators.required] }),
    numOperacion: this.fb.control('', { validators: [Validators.required] }),
    tipoOperacion: this.fb.control('CXP', { validators: [Validators.required] }),
    moneda: this.fb.control('', { validators: [Validators.required] }),
    tCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0)] }),
    numBeneficiario: this.fb.control('', { validators: [Validators.required] }),
    beneficiario: this.fb.control('', { validators: [Validators.required] }),
    concepto: this.fb.control('PAGO A PROVEEDORES', { validators: [Validators.required] }),
    monto: this.fb.control({ value: 0, disabled: true }),
    pagos: this.fb.array<FormGroup<FacturaForm>>([]),
    detalle: this.fb.array<FormGroup<DetalleForm>>([])
  });

  bancos: Array<{ codBanco: string; descripcion: string }> = [];
  cuentas: CuentaBancoOption[] = [];
  cuentasLoading = false;

  proveedorSuggestions: ProveedorUI[] = [];
  proveedorLoading = false;
  showProveedorDropdown = false;

  loading = false;
  saving = false;

  providerLocked = false;
  readonlyMode = false;
  idOperacion: string | null = null;
  private retiroMeta = {
    operador: '',
    empresa: '',
    movCon: 0 as number | string | boolean,
    fechaCon: '',
    operCon: ''
  };

  get facturasArray(): FormArray<FormGroup<FacturaForm>> {
    return this.retiroForm.controls.pagos;
  }

  get detallesArray(): FormArray<FormGroup<DetalleForm>> {
    return this.retiroForm.controls.detalle;
  }

  ngOnInit(): void {
    this.readonlyMode = this.route.snapshot.data['readOnly'] === true;
    this.idOperacion = this.route.snapshot.paramMap.get('idOperacion');
    this.empresaContext.restaurarDesdeStorage();
    this.empresaContext.cargarEmpresaPrincipal();

    this.retiroForm.controls.codBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onBancoChange(value));

    this.retiroForm.controls.codCtaBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onCuentaChange(value));

    this.facturasArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalcularTotales());

    this.retiroForm.controls.tCambio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDetalleContable());

    this.retiroForm.controls.moneda.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDetalleContable());

    this.retiroForm.controls.numBeneficiario.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.buscarProveedor(value))
      )
      .subscribe((proveedores) => {
        this.proveedorSuggestions = proveedores;
        this.showProveedorDropdown = proveedores.length > 0;
        this.proveedorLoading = false;
      });

    void this.loadBancos();

    if (this.idOperacion) {
      void this.loadRetiro(this.idOperacion);
    } else {
      this.preloadFromState();
    }
  }

  async loadBancos(): Promise<void> {
    try {
      this.bancos = await firstValueFrom(this.bancosService.getBancos());
    } catch (error) {
      this.bancos = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar los bancos.'));
    }
  }

  async onBancoChange(codBanco: string): Promise<void> {
    const normalized = this.normalize(codBanco);
    if (!normalized) {
      this.cuentas = [];
      this.retiroForm.controls.codCtaBanco.setValue('');
      return;
    }
    this.cuentasLoading = true;
    try {
      const cuentas = await firstValueFrom(this.cuentaService.getCuentas(normalized));
      this.cuentas = cuentas.map((cuenta) => ({
        value: cuenta.ctaBanco,
        label: `${cuenta.nombreCta} (${cuenta.ctaBanco})`,
        moneda: cuenta.moneda
      }));
      const current = this.retiroForm.controls.codCtaBanco.value;
      if (current && !this.cuentas.some((item) => item.value === current)) {
        this.retiroForm.controls.codCtaBanco.setValue('');
      } else if (current) {
        this.onCuentaChange(current);
      }
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
      this.cuentas = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas bancarias.'));
    } finally {
      this.cuentasLoading = false;
    }
  }

  onCuentaChange(ctaBanco: string): void {
    const selected = this.cuentas.find((item) => item.value === ctaBanco);
    if (selected?.moneda) {
      this.retiroForm.controls.moneda.setValue(selected.moneda);
    }
    this.syncDetalleContable();
  }

  seleccionarProveedor(proveedor: ProveedorUI): void {
    this.retiroForm.controls.numBeneficiario.setValue(proveedor.codigo);
    this.retiroForm.controls.beneficiario.setValue(proveedor.descripcion);
    this.showProveedorDropdown = false;
  }

  ocultarProveedores(): void {
    setTimeout(() => {
      this.showProveedorDropdown = false;
    }, 150);
  }

  async cargarProveedorPorCodigo(): Promise<void> {
    if (this.providerLocked) {
      return;
    }
    const cod = this.normalize(this.retiroForm.controls.numBeneficiario.value);
    if (!cod) {
      this.retiroForm.controls.beneficiario.setValue('');
      return;
    }
    try {
      const proveedor = await firstValueFrom(this.proveedorService.getProveedorByCodigo(cod));
      if (proveedor) {
        this.retiroForm.controls.numBeneficiario.setValue(proveedor.codigo);
        this.retiroForm.controls.beneficiario.setValue(proveedor.descripcion);
      }
    } catch (error) {
      console.error('Error al cargar proveedor:', error);
    }
  }

  agregarDetalle(): void {
    if (this.readonlyMode) {
      return;
    }
    this.syncDetalleContable();
  }

  eliminarDetalle(index: number): void {
    if (this.readonlyMode) {
      return;
    }
    if (index <= 0) {
      this.syncDetalleContable();
      return;
    }
    this.detallesArray.removeAt(index);
  }

  eliminarFactura(index: number): void {
    if (this.readonlyMode) {
      return;
    }
    this.facturasArray.removeAt(index);
    this.recalcularTotales();
  }

  guardar(): void {
    if (this.readonlyMode) {
      return;
    }
    if (this.retiroForm.invalid) {
      this.retiroForm.markAllAsTouched();
      this.toast.warning('Completa los campos obligatorios antes de guardar.');
      return;
    }
    if (!this.facturasArray.length) {
      this.toast.warning('Debes agregar al menos una factura para aplicar el pago.');
      return;
    }
    if (!this.detallesArray.length) {
      this.toast.warning('Debes registrar el detalle contable antes de guardar.');
      return;
    }
    if (this.facturasArray.controls.some((ctrl) => ctrl.invalid)) {
      this.toast.warning('Revisa los montos aplicados en las facturas.');
      return;
    }
    /*
    if (this.detallesArray.controls.some((ctrl) => ctrl.invalid)) {
      this.toast.warning('Revisa el detalle contable antes de guardar.');
      return;
    }
   */
    const payload = this.buildPayload();
    this.saving = true;
    const request = this.idOperacion
      ? this.retiroService.updateRetiro(this.idOperacion, payload)
      : this.retiroService.createRetiro(payload);

    firstValueFrom(request)
      .then(() => {
        this.toast.success(this.idOperacion ? 'Retiro actualizado correctamente.' : 'Retiro registrado correctamente.');
        this.router.navigate(['/finanzas/cuentas-pagar']);
      })
      .catch((error) => {
        this.toast.error(this.getErrorMessage(error, 'No se pudo guardar el retiro.'));
      })
      .finally(() => {
        this.saving = false;
      });
  }

  cancelar(): void {
    this.router.navigate(['/finanzas/cuentas-pagar']);
  }

  trackByIndex(index: number): number {
    return index;
  }

  saldoRestante(index: number): number {
    const factura = this.facturasArray.at(index).getRawValue();
    return this.roundNumber(factura.saldo - factura.montoPago);
  }

  saldoEstadoClass(index: number): string {
    const restante = this.saldoRestante(index);
    if (restante < 0) {
      return 'saldo-over';
    }
    if (restante === 0) {
      return 'saldo-ok';
    }
    return 'saldo-partial';
  }

  get totalFacturas(): number {
    return this.facturasArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.saldo), 0);
  }

  get totalAplicado(): number {
    return this.facturasArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.montoPago), 0);
  }

  get diferencia(): number {
    return this.roundNumber(this.totalFacturas - this.totalAplicado);
  }

  get monedaResumen(): string {
    const monedas = new Set(this.facturasArray.getRawValue().map((item) => item.moneda).filter(Boolean));
    if (monedas.size === 1) {
      return Array.from(monedas)[0];
    }
    return monedas.size > 1 ? 'MIX' : this.retiroForm.controls.moneda.value || '---';
  }

  isInvalid(control: FormControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private preloadFromState(): void {
    const facturas = this.getFacturasFromState();
    if (!facturas.length) {
      return;
    }
    this.setFacturas(facturas);
  }

  private async loadRetiro(idOperacion: string): Promise<void> {
    this.loading = true;
    try {
      const retiro = await firstValueFrom(this.retiroService.getRetiro(idOperacion));
      if (!retiro) {
        this.toast.warning('No se encontró el retiro solicitado.');
        this.router.navigate(['/finanzas/bancos/retiros-cxp']);
        return;
      }
      this.setRetiro(retiro);
      if (this.readonlyMode) {
        this.retiroForm.disable({ emitEvent: false });
      }
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo cargar el retiro.'));
    } finally {
      this.loading = false;
    }
  }

  private setRetiro(retiro: RetiroCxp): void {
    this.retiroForm.patchValue({
      codBanco: this.normalize(retiro.codBanco),
      codCtaBanco: this.normalize(retiro.codCtaBanco),
      fecha: this.formatDateFromApi(this.normalize(retiro.fecha)),
      numOperacion: this.normalize(retiro.numOperacion),
      tipoOperacion: this.normalize(retiro.tipoOperacion),
      moneda: this.normalize(retiro.moneda),
      tCambio: this.normalizeNumber(retiro.tCambio),
      numBeneficiario: this.normalize(retiro.numBeneficiario),
      beneficiario: this.normalize(retiro.beneficiario),
      concepto: this.normalize(retiro.concepto),
      monto: this.normalizeNumber(retiro.monto)
    });
    this.retiroMeta = {
      operador: this.normalize(retiro.operador),
      empresa: this.normalize(retiro.empresa),
      movCon: retiro.movCon ?? 0,
      fechaCon: this.formatDateForApi(this.normalize(retiro.fechaCon)),
      operCon: this.normalize(retiro.operCon)
    };

    this.providerLocked = true;
    this.facturasArray.clear();
    (retiro.pagos || []).forEach((factura) => this.facturasArray.push(this.createFacturaForm(factura)));

    this.detallesArray.clear();
    this.syncDetalleContable(retiro.detalle?.[0]);

    this.recalcularTotales();
  }

  private setFacturas(facturas: FacturaSeleccionada[]): void {
    const validas = facturas.filter((item) => this.normalizeNumber(item.saldo) > 0);
    if (!validas.length) {
      return;
    }

    const proveedorBase = validas[0].codProve;
    const facturasFiltradas = validas.filter((item) => item.codProve === proveedorBase);
    if (facturasFiltradas.length !== validas.length) {
      this.toast.warning('Solo puedes aplicar facturas del mismo proveedor. Se filtraron las seleccionadas.');
    }

    const proveedorNombre = facturasFiltradas[0].nomProve;
    this.retiroForm.controls.numBeneficiario.setValue(proveedorBase);
    this.retiroForm.controls.beneficiario.setValue(proveedorNombre);
    this.providerLocked = true;
    this.showProveedorDropdown = false;

    const moneda = facturasFiltradas[0].moneda;
    if (moneda) {
      this.retiroForm.controls.moneda.setValue(moneda);
    }
    const tipoCambio = this.normalizeNumber(facturasFiltradas[0].tCambio || 1);
    if (tipoCambio > 0) {
      this.retiroForm.controls.tCambio.setValue(tipoCambio);
    }

    this.facturasArray.clear();
    facturasFiltradas.forEach((item) => {
      const raw = item as FacturaSeleccionada & {
        serie?: string;
        numFactura?: string;
        fecFactu?: string;
        fecVen?: string;
        montoPagar?: number;
      };
      this.facturasArray.push(
        this.createFacturaForm({
          tipoDocu: this.normalize(raw.tipoDocu),
          numDocu: this.normalize(raw.numDocu),
          tipDocPrv: item.tipDocPrv,
          serieDocPrv: this.normalize(raw.serieDocPrv) || this.normalize(raw.serie),
          numFacPrv: this.normalize(raw.numFacPrv) || this.normalize(raw.numFactura),
          fechaCobra: this.formatDateForApi(this.normalize(raw.fechaCobra) || this.normalize(raw.fecFactu)),
          fechaVen: this.formatDateForApi(this.normalize(raw.fechaVen) || this.normalize(raw.fecVen)),
          tipoPago: this.normalize(raw.tipoPago),
          totalDocu: this.normalizeNumber(item.totalDocu),
          saldo: this.normalizeNumber(item.saldo),
          montoPago: this.normalizeNumber(raw.montoPago ?? raw.montoPagar ?? item.saldo),
          estado: item.estado || '',
          moneda: item.moneda,
          tCambio: this.normalizeNumber(item.tCambio),
          descripcion: this.normalize(raw.descripcion),
          tipoOpe: this.normalize(raw.tipoOpe)
        })
      );
    });
    this.recalcularTotales();
  }

  private createFacturaForm(factura?: Partial<RetiroCxpFactura>): FormGroup<FacturaForm> {
    const raw = (factura ?? {}) as Partial<RetiroCxpFactura> & {
      serie?: string;
      numFactura?: string;
      fecFactu?: string;
      fecVen?: string;
      montoPagar?: number;
    };
    const saldo = this.normalizeNumber(raw.saldo ?? raw.montoPago ?? raw.montoPagar ?? raw.totalDocu);
    const montoPago = this.normalizeNumber(raw.montoPago ?? raw.montoPagar ?? saldo);
    const group = this.fb.group({
      tipoDocu: this.fb.control(this.normalize(raw.tipoDocu)),
      numDocu: this.fb.control(this.normalize(raw.numDocu)),
      tipDocPrv: this.fb.control(this.normalize(raw.tipDocPrv)),
      serieDocPrv: this.fb.control(this.normalize(raw.serieDocPrv) || this.normalize(raw.serie)),
      numFacPrv: this.fb.control(this.normalize(raw.numFacPrv) || this.normalize(raw.numFactura)),
      fechaCobra: this.fb.control(this.formatDateForApi(this.normalize(raw.fechaCobra) || this.normalize(raw.fecFactu))),
      fechaVen: this.fb.control(this.formatDateForApi(this.normalize(raw.fechaVen) || this.normalize(raw.fecVen))),
      tipoPago: this.fb.control(this.normalize(raw.tipoPago)),
      totalDocu: this.fb.control(this.normalizeNumber(raw.totalDocu)),
      saldo: this.fb.control(saldo),
      moneda: this.fb.control(this.normalize(raw.moneda)),
      montoPago: this.fb.control(montoPago, {
        validators: [Validators.required, Validators.min(0), this.maxSaldoValidator(saldo)]
      }),
      tCambio: this.fb.control(this.normalizeNumber(raw.tCambio)),
      estado: this.fb.control(this.normalize(raw.estado)),
      descripcion: this.fb.control(this.normalize(raw.descripcion)),
      tipoOpe: this.fb.control(this.normalize(raw.tipoOpe))
    });
    return group;
  }

  private createDetalleForm(detalle?: Partial<RetiroCxpDetalleContable>): FormGroup<DetalleForm> {
    const defaults = this.getDetalleContableValue(detalle);
    const group = this.fb.group({
      codConcepto: this.fb.control(defaults.codConcepto, { validators: [Validators.required] }),
      concepto: this.fb.control(defaults.concepto, { validators: [Validators.required] }),
      moneda: this.fb.control(defaults.moneda, { validators: [Validators.required] }),
      monto: this.fb.control(defaults.monto, { validators: [Validators.required, Validators.min(0.01)] }),
      tCambio: this.fb.control(defaults.tCambio, { validators: [Validators.required, Validators.min(0)] }),
      numAsientoObs: this.fb.control(this.normalize(defaults.numAsientoObs)),
      operador: this.fb.control(this.normalize(defaults.operador))
    });
    group.disable({ emitEvent: false });
    return group;
  }

  private maxSaldoValidator(saldo: number) {
    return (control: FormControl<number>) => {
      const value = this.normalizeNumber(control.value);
      if (value > saldo) {
        return { maxSaldo: true };
      }
      return null;
    };
  }

  private recalcularTotales(): void {
    const total = this.roundNumber(this.totalAplicado);
    this.retiroForm.controls.monto.setValue(total, { emitEvent: false });
    this.syncDetalleContable();
  }

  private syncDetalleContable(base?: Partial<RetiroCxpDetalleContable>): void {
    const detalle = this.getDetalleContableValue(base);

    while (this.detallesArray.length > 1) {
      this.detallesArray.removeAt(this.detallesArray.length - 1);
    }

    if (!this.detallesArray.length) {
      this.detallesArray.push(this.createDetalleForm(detalle));
      return;
    }

    const detalleGroup = this.detallesArray.at(0);
    detalleGroup.patchValue(detalle, { emitEvent: false });
    detalleGroup.disable({ emitEvent: false });
  }

  private getDetalleContableValue(base?: Partial<RetiroCxpDetalleContable>): RetiroCxpDetalleContable {
    const monedaCuenta = this.getCuentaMoneda();
    const tipoCambio = this.normalizeNumber(this.retiroForm.controls.tCambio.value);
    return {
      codConcepto: DETALLE_CONTABLE_DEFAULTS.codConcepto,
      concepto: DETALLE_CONTABLE_DEFAULTS.concepto,
      moneda: monedaCuenta || this.normalize(base?.moneda) || this.normalize(this.retiroForm.controls.moneda.value),
      monto: this.roundNumber(this.totalAplicado),
      tCambio: tipoCambio,
      numAsientoObs: this.normalize(base?.numAsientoObs) || DETALLE_CONTABLE_DEFAULTS.numAsientoObs,
      operador: this.normalize(base?.operador) || DETALLE_CONTABLE_DEFAULTS.operador
    };
  }

  private getCuentaMoneda(): string {
    const cuentaSeleccionada = this.normalize(this.retiroForm.controls.codCtaBanco.value);
    const cuenta = this.cuentas.find((item) => item.value === cuentaSeleccionada);
    return this.normalize(cuenta?.moneda);
  }

  private buildPayload(): RetiroCxp {
    const raw = this.retiroForm.getRawValue();
    const fechaOperacion = this.formatDateForApi(raw.fecha);
    const operador = this.retiroMeta.operador || this.getOperador();
    const empresa = this.retiroMeta.empresa || this.getEmpresa();
    const fechaCon = this.formatDateForApi(this.normalize(this.retiroMeta.fechaCon) || raw.fecha);
    return {
      idOperacion: this.idOperacion || undefined,
      codBanco: this.normalize(raw.codBanco),
      codCtaBanco: this.normalize(raw.codCtaBanco),
      fecha: fechaOperacion,
      numBeneficiario: this.normalize(raw.numBeneficiario),
      beneficiario: this.normalize(raw.beneficiario),
      concepto: this.normalize(raw.concepto),
      numOperacion: this.normalize(raw.numOperacion),
      tipoOperacion: this.normalize(raw.tipoOperacion),
      moneda: this.normalize(raw.moneda),
      monto: this.normalizeNumber(raw.monto),
      tCambio: this.normalizeNumber(raw.tCambio),
      operador,
      empresa,
      movCon: this.retiroMeta.movCon ?? 0,
      fechaCon,
      operCon: this.normalize(this.retiroMeta.operCon),
      pagos: raw.pagos.map((factura) => ({
        tipoOpe: this.normalize(factura.tipoOpe),
        tipoDocu: this.normalize(factura.tipoDocu),
        numDocu: this.normalize(factura.numDocu),
        tipDocPrv: this.normalize(factura.tipDocPrv),
        serieDocPrv: this.normalize(factura.serieDocPrv),
        numFacPrv: this.normalize(factura.numFacPrv),
        fechaCobra: this.formatDateForApi(factura.fechaCobra || raw.fecha),
        fechaVen: this.formatDateForApi(factura.fechaVen || raw.fecha),
        tipoPago: this.normalize(factura.tipoPago),
        moneda: this.normalize(factura.moneda),
        totalDocu: this.normalizeNumber(factura.totalDocu),
        montoPago: this.normalizeNumber(factura.montoPago),
        tCambio: this.normalizeNumber(factura.tCambio),
        estado: this.normalize(factura.estado),
        descripcion: this.normalize(factura.descripcion)
      })),
      detalle: raw.detalle.map((detalle) => ({
        codConcepto: this.normalize(detalle.codConcepto),
        concepto: this.normalize(detalle.concepto),
        moneda: this.normalize(detalle.moneda),
        monto: this.normalizeNumber(detalle.monto),
        tCambio: this.normalizeNumber(detalle.tCambio),
        numAsientoObs: this.normalize(detalle.numAsientoObs),
        operador: this.normalize(detalle.operador)
      }))
    };
  }

  private buscarProveedor(value: string) {
    if (this.providerLocked) {
      this.proveedorLoading = false;
      return of([]);
    }
    const term = this.normalize(value);
    if (term.length < 2) {
      this.proveedorLoading = false;
      return of([]);
    }
    this.proveedorLoading = true;
    const isCode = term.length <= 12 && !term.includes(' ');
    return this.proveedorService.getProveedores(1, 10, isCode ? term : undefined, isCode ? undefined : term).pipe(
      map((response) => response?.data ?? []),
      catchError(() => of([]))
    );
  }

  private getFacturasFromState(): FacturaSeleccionada[] {
    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    const facturas = state?.facturasSeleccionadas;
    if (!Array.isArray(facturas)) {
      return [];
    }
    return facturas.filter((item) => item && typeof item === 'object') as FacturaSeleccionada[];
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private normalizeNumber(value: number | string | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundNumber(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateFromApi(value: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('-') && trimmed.includes('T')) {
      return trimmed.split('T')[0];
    }
    if (trimmed.includes('-')) {
      return trimmed;
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

  private formatDateForApi(value: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day && month && year) {
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(0, 4)}`;
        }
      }
      return trimmed;
    }
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, year, month, day] = compactMatch;
      return `${day}/${month}/${year}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const day = `${parsed.getDate()}`.padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    return trimmed;
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private getEmpresa(): string {
    return this.empresaContext.getSnapshot()?.MA04_Unidad ?? '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message || fallback;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: string }).message;
      if (message) {
        return message;
      }
    }
    return fallback;
  }
}
