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
import { ToastService } from 'src/app/core/services/toast.service';
import { BancosService } from '../bancos.service';
import { CuentaBancoService } from '../../cuenta-banco/cuenta-banco.service';
import { ProveedorService, ProveedorUI } from 'src/app/demo/compras/proveedores/proveedor.service';
import { RetiroCxpService } from './retiro.service';
import { RetiroCxp, RetiroCxpDetalleContable, RetiroCxpFactura } from './models/retiro-cxp.model';

type RetiroForm = {
  codBanco: FormControl<string>;
  ctaBanco: FormControl<string>;
  fecha: FormControl<string>;
  numOperacion: FormControl<string>;
  tipoOperacion: FormControl<string>;
  moneda: FormControl<string>;
  tipoCambio: FormControl<number>;
  codProve: FormControl<string>;
  nomProve: FormControl<string>;
  concepto: FormControl<string>;
  montoTotal: FormControl<number>;
  facturas: FormArray<FormGroup<FacturaForm>>;
  detalles: FormArray<FormGroup<DetalleForm>>;
};

type FacturaForm = {
  tipDocPrv: FormControl<string>;
  serie: FormControl<string>;
  numFactura: FormControl<string>;
  fecFactu: FormControl<string>;
  fecVen: FormControl<string>;
  totalDocu: FormControl<number>;
  saldo: FormControl<number>;
  montoPagar: FormControl<number>;
  estado: FormControl<string>;
  moneda: FormControl<string>;
};

type DetalleForm = {
  concepto: FormControl<string>;
  descripcion: FormControl<string>;
  moneda: FormControl<string>;
  monto: FormControl<number>;
  tCambio: FormControl<number>;
};

interface FacturaSeleccionada {
  tipDocPrv: string;
  serie: string;
  numFactura: string;
  fecFactu?: string;
  fecVen?: string;
  totalDocu: number;
  saldo: number;
  moneda: string;
  estado: string;
  tCambio?: number;
  codProve: string;
  nomProve: string;
}

interface CuentaBancoOption {
  value: string;
  label: string;
  moneda?: string;
}

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
  private readonly retiroService = inject(RetiroCxpService);
  private readonly bancosService = inject(BancosService);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly proveedorService = inject(ProveedorService);
  private readonly toast = inject(ToastService);

  readonly tipoOperacionOptions = ['CHQ', 'Transferencia', 'Débito', 'Efectivo', 'Otro'];
  readonly monedaOptions = ['USD', 'CRC', 'EUR'];

  readonly retiroForm: FormGroup<RetiroForm> = this.fb.group({
    codBanco: this.fb.control('', { validators: [Validators.required] }),
    ctaBanco: this.fb.control('', { validators: [Validators.required] }),
    fecha: this.fb.control(this.formatDateToInput(new Date()), { validators: [Validators.required] }),
    numOperacion: this.fb.control('', { validators: [Validators.required] }),
    tipoOperacion: this.fb.control('', { validators: [Validators.required] }),
    moneda: this.fb.control('', { validators: [Validators.required] }),
    tipoCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0)] }),
    codProve: this.fb.control('', { validators: [Validators.required] }),
    nomProve: this.fb.control('', { validators: [Validators.required] }),
    concepto: this.fb.control('', { validators: [Validators.required] }),
    montoTotal: this.fb.control({ value: 0, disabled: true }),
    facturas: this.fb.array<FormGroup<FacturaForm>>([]),
    detalles: this.fb.array<FormGroup<DetalleForm>>([])
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

  get facturasArray(): FormArray<FormGroup<FacturaForm>> {
    return this.retiroForm.controls.facturas;
  }

  get detallesArray(): FormArray<FormGroup<DetalleForm>> {
    return this.retiroForm.controls.detalles;
  }

  ngOnInit(): void {
    this.readonlyMode = this.route.snapshot.data['readOnly'] === true;
    this.idOperacion = this.route.snapshot.paramMap.get('idOperacion');

    this.retiroForm.controls.codBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onBancoChange(value));

    this.retiroForm.controls.ctaBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onCuentaChange(value));

    this.facturasArray.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalcularTotales());

    this.retiroForm.controls.codProve.valueChanges
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
      this.retiroForm.controls.ctaBanco.setValue('');
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
      const current = this.retiroForm.controls.ctaBanco.value;
      if (current && !this.cuentas.some((item) => item.value === current)) {
        this.retiroForm.controls.ctaBanco.setValue('');
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
    if (selected?.moneda && !this.retiroForm.controls.moneda.value) {
      this.retiroForm.controls.moneda.setValue(selected.moneda);
    }
  }

  seleccionarProveedor(proveedor: ProveedorUI): void {
    this.retiroForm.controls.codProve.setValue(proveedor.codigo);
    this.retiroForm.controls.nomProve.setValue(proveedor.descripcion);
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
    const cod = this.normalize(this.retiroForm.controls.codProve.value);
    if (!cod) {
      this.retiroForm.controls.nomProve.setValue('');
      return;
    }
    try {
      const proveedor = await firstValueFrom(this.proveedorService.getProveedorByCodigo(cod));
      if (proveedor) {
        this.retiroForm.controls.codProve.setValue(proveedor.codigo);
        this.retiroForm.controls.nomProve.setValue(proveedor.descripcion);
      }
    } catch (error) {
      console.error('Error al cargar proveedor:', error);
    }
  }

  agregarDetalle(): void {
    if (this.readonlyMode) {
      return;
    }
    this.detallesArray.push(this.createDetalleForm());
  }

  eliminarDetalle(index: number): void {
    if (this.readonlyMode) {
      return;
    }
    this.detallesArray.removeAt(index);
    this.detallesArray.markAsDirty();
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
    if (this.detallesArray.controls.some((ctrl) => ctrl.invalid)) {
      this.toast.warning('Revisa el detalle contable antes de guardar.');
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    const request = this.idOperacion
      ? this.retiroService.updateRetiro(this.idOperacion, payload)
      : this.retiroService.createRetiro(payload);

    firstValueFrom(request)
      .then(() => {
        this.toast.success(this.idOperacion ? 'Retiro actualizado correctamente.' : 'Retiro registrado correctamente.');
        this.router.navigate(['/finanzas/bancos/retiros-cxp']);
      })
      .catch((error) => {
        this.toast.error(this.getErrorMessage(error, 'No se pudo guardar el retiro.'));
      })
      .finally(() => {
        this.saving = false;
      });
  }

  cancelar(): void {
    this.router.navigate(['/finanzas/bancos/retiros-cxp']);
  }

  trackByIndex(index: number): number {
    return index;
  }

  saldoRestante(index: number): number {
    const factura = this.facturasArray.at(index).getRawValue();
    return this.roundNumber(factura.saldo - factura.montoPagar);
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
    return this.facturasArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.montoPagar), 0);
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
      ctaBanco: this.normalize(retiro.ctaBanco),
      fecha: this.formatDateFromApi(this.normalize(retiro.fecha)),
      numOperacion: this.normalize(retiro.numOperacion),
      tipoOperacion: this.normalize(retiro.tipoOperacion),
      moneda: this.normalize(retiro.moneda),
      tipoCambio: this.normalizeNumber(retiro.tipoCambio),
      codProve: this.normalize(retiro.codProve),
      nomProve: this.normalize(retiro.nomProve),
      concepto: this.normalize(retiro.concepto),
      montoTotal: this.normalizeNumber(retiro.montoTotal)
    });

    this.providerLocked = true;
    this.facturasArray.clear();
    (retiro.facturas || []).forEach((factura) => this.facturasArray.push(this.createFacturaForm(factura)));

    this.detallesArray.clear();
    (retiro.detalles || []).forEach((detalle) => this.detallesArray.push(this.createDetalleForm(detalle)));

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
    this.retiroForm.controls.codProve.setValue(proveedorBase);
    this.retiroForm.controls.nomProve.setValue(proveedorNombre);
    this.providerLocked = true;
    this.showProveedorDropdown = false;

    const moneda = facturasFiltradas[0].moneda;
    if (moneda) {
      this.retiroForm.controls.moneda.setValue(moneda);
    }
    const tipoCambio = this.normalizeNumber(facturasFiltradas[0].tCambio || 1);
    if (tipoCambio > 0) {
      this.retiroForm.controls.tipoCambio.setValue(tipoCambio);
    }

    this.facturasArray.clear();
    facturasFiltradas.forEach((item) => {
      this.facturasArray.push(
        this.createFacturaForm({
          tipDocPrv: item.tipDocPrv,
          serie: item.serie,
          numFactura: item.numFactura,
          fecFactu: item.fecFactu || '',
          fecVen: item.fecVen || '',
          totalDocu: this.normalizeNumber(item.totalDocu),
          saldo: this.normalizeNumber(item.saldo),
          montoPagar: this.normalizeNumber(item.saldo),
          estado: item.estado || '',
          moneda: item.moneda
        })
      );
    });
    this.recalcularTotales();
  }

  private createFacturaForm(factura?: Partial<RetiroCxpFactura>): FormGroup<FacturaForm> {
    const saldo = this.normalizeNumber(factura?.saldo);
    const montoPagar = this.normalizeNumber(factura?.montoPagar ?? saldo);
    const group = this.fb.group({
      tipDocPrv: this.fb.control(this.normalize(factura?.tipDocPrv)),
      serie: this.fb.control(this.normalize(factura?.serie)),
      numFactura: this.fb.control(this.normalize(factura?.numFactura)),
      fecFactu: this.fb.control(this.normalize(factura?.fecFactu)),
      fecVen: this.fb.control(this.normalize(factura?.fecVen)),
      totalDocu: this.fb.control(this.normalizeNumber(factura?.totalDocu)),
      saldo: this.fb.control(saldo),
      montoPagar: this.fb.control(montoPagar, {
        validators: [Validators.required, Validators.min(0), this.maxSaldoValidator(saldo)]
      }),
      estado: this.fb.control(this.normalize(factura?.estado)),
      moneda: this.fb.control(this.normalize(factura?.moneda))
    });
    return group;
  }

  private createDetalleForm(detalle?: Partial<RetiroCxpDetalleContable>): FormGroup<DetalleForm> {
    return this.fb.group({
      concepto: this.fb.control(this.normalize(detalle?.concepto), { validators: [Validators.required] }),
      descripcion: this.fb.control(this.normalize(detalle?.descripcion)),
      moneda: this.fb.control(this.normalize(detalle?.moneda), { validators: [Validators.required] }),
      monto: this.fb.control(this.normalizeNumber(detalle?.monto), { validators: [Validators.required, Validators.min(0.01)] }),
      tCambio: this.fb.control(this.normalizeNumber(detalle?.tCambio || 1), { validators: [Validators.required, Validators.min(0)] })
    });
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
    this.retiroForm.controls.montoTotal.setValue(total, { emitEvent: false });
  }

  private buildPayload(): RetiroCxp {
    const raw = this.retiroForm.getRawValue();
    return {
      idOperacion: this.idOperacion || undefined,
      codBanco: this.normalize(raw.codBanco),
      ctaBanco: this.normalize(raw.ctaBanco),
      fecha: this.formatDateForApi(this.normalize(raw.fecha)),
      numOperacion: this.normalize(raw.numOperacion),
      tipoOperacion: this.normalize(raw.tipoOperacion),
      moneda: this.normalize(raw.moneda),
      tipoCambio: this.normalizeNumber(raw.tipoCambio),
      codProve: this.normalize(raw.codProve),
      nomProve: this.normalize(raw.nomProve),
      concepto: this.normalize(raw.concepto),
      montoTotal: this.normalizeNumber(raw.montoTotal),
      facturas: raw.facturas.map((factura) => ({
        ...factura,
        totalDocu: this.normalizeNumber(factura.totalDocu),
        saldo: this.normalizeNumber(factura.saldo),
        montoPagar: this.normalizeNumber(factura.montoPagar)
      })),
      detalles: raw.detalles.map((detalle) => ({
        ...detalle,
        monto: this.normalizeNumber(detalle.monto),
        tCambio: this.normalizeNumber(detalle.tCambio)
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
