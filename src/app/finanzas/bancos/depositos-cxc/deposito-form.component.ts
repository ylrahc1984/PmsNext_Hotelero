import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ToastService } from 'src/app/core/services/toast.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { BancosService } from '../bancos.service';
import { CuentaBancoService } from '../../cuenta-banco/cuenta-banco.service';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { DepositoCxcService } from './deposito.service';
import { DepositoCxc, DepositoCxcCobranza, DepositoCxcDetalle } from './models/deposito-cxc.model';

type DepositoForm = {
  codBanco: FormControl<string>;
  codCtaBanco: FormControl<string>;
  fecha: FormControl<string>;
  frmPago: FormControl<string>;
  numOpera: FormControl<string>;
  moneda: FormControl<string>;
  tCambio: FormControl<number>;
  numDepositante: FormControl<string>;
  depositante: FormControl<string>;
  concepto: FormControl<string>;
  monto: FormControl<number>;
  cobranzas: FormArray<FormGroup<CobranzaForm>>;
  detalle: FormArray<FormGroup<DetalleForm>>;
};

type CobranzaForm = {
  tipoDocu: FormControl<string>;
  serie: FormControl<string>;
  numDocu: FormControl<string>;
  fechaCobra: FormControl<string>;
  moneda: FormControl<string>;
  saldo: FormControl<number>;
  montoPago: FormControl<number>;
  estado: FormControl<string>;
  referencia: FormControl<string>;
  frmPago: FormControl<string>;
  descripcion: FormControl<string>;
  tCambio: FormControl<number>;
  tipo: FormControl<string>;
};

type DetalleForm = {
  codConcepto: FormControl<string>;
  descripcion: FormControl<string>;
  moneda: FormControl<string>;
  monto: FormControl<number>;
  tCambio: FormControl<number>;
};

interface DocumentoSeleccionado {
  tipoDocu: string;
  serie: string;
  numDocu: string;
  fechaDocu: string;
  codCliente: string;
  nomCliente: string;
  totalDocu: number;
  totalPago: number;
  saldo: number;
  moneda: string;
  tCambio: number;
  estadoElectronico: string;
}

interface CuentaBancoOption {
  value: string;
  label: string;
  moneda?: string;
}

@Component({
  selector: 'app-deposito-form',
  standalone: true,
  imports: [CommonModule, SharedModule, ReactiveFormsModule],
  templateUrl: './deposito-form.component.html',
  styleUrls: ['./deposito-form.component.scss'],
  animations: [
    trigger('fadeSlideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class DepositoFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly depositoService = inject(DepositoCxcService);
  private readonly bancosService = inject(BancosService);
  private readonly cuentaService = inject(CuentaBancoService);
  private readonly clienteService = inject(ClienteService);
  private readonly authService = inject(AuthService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly toast = inject(ToastService);

  readonly frmPagoOptions = ['Transferencia', 'Efectivo', 'Cheque'];
  readonly monedaOptions = ['USD', 'CRC', 'EUR'];

  readonly depositoForm: FormGroup<DepositoForm> = this.fb.group({
    codBanco: this.fb.control('', { validators: [Validators.required] }),
    codCtaBanco: this.fb.control('', { validators: [Validators.required] }),
    fecha: this.fb.control(this.formatDateToInput(new Date()), { validators: [Validators.required] }),
    frmPago: this.fb.control('', { validators: [Validators.required] }),
    numOpera: this.fb.control('', { validators: [Validators.required] }),
    moneda: this.fb.control('', { validators: [Validators.required] }),
    tCambio: this.fb.control(1, { validators: [Validators.required, Validators.min(0)] }),
    numDepositante: this.fb.control('', { validators: [Validators.required] }),
    depositante: this.fb.control('', { validators: [Validators.required] }),
    concepto: this.fb.control('', { validators: [Validators.required] }),
    monto: this.fb.control({ value: 0, disabled: true }),
    cobranzas: this.fb.array<FormGroup<CobranzaForm>>([]),
    detalle: this.fb.array<FormGroup<DetalleForm>>([])
  });

  bancos: Array<{ codBanco: string; descripcion: string }> = [];
  cuentas: CuentaBancoOption[] = [];
  cuentasLoading = false;

  clienteSuggestions: ClienteUI[] = [];
  clienteLoading = false;
  showClienteDropdown = false;
  selectedCliente: ClienteUI | null = null;

  loading = false;
  saving = false;
  clienteLocked = false;
  readonlyMode = false;
  idOperacion: string | null = null;

  get cobranzasArray(): FormArray<FormGroup<CobranzaForm>> {
    return this.depositoForm.controls.cobranzas;
  }

  get detalleArray(): FormArray<FormGroup<DetalleForm>> {
    return this.depositoForm.controls.detalle;
  }

  ngOnInit(): void {
    this.readonlyMode = this.route.snapshot.data['readOnly'] === true;
    this.idOperacion = this.route.snapshot.paramMap.get('idOperacion');
    this.empresaContext.restaurarDesdeStorage();
    this.empresaContext.cargarEmpresaPrincipal();

    this.depositoForm.controls.codBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onBancoChange(value));

    this.depositoForm.controls.codCtaBanco.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onCuentaChange(value));

    this.cobranzasArray.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcularTotales());

    this.detalleArray.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcularDetalle());

    this.depositoForm.controls.depositante.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => this.buscarCliente());

    void this.loadBancos();

    if (this.idOperacion) {
      void this.loadDeposito(this.idOperacion);
    } else {
      this.preloadFromState();
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.canDeactivate()) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  }

  canDeactivate(): boolean {
    if (this.readonlyMode || this.saving) {
      return true;
    }
    return !this.depositoForm.dirty || window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
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
      this.depositoForm.controls.codCtaBanco.setValue('');
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
      const current = this.depositoForm.controls.codCtaBanco.value;
      if (current && !this.cuentas.some((item) => item.value === current)) {
        this.depositoForm.controls.codCtaBanco.setValue('');
      }
    } catch (error) {
      console.error('Error al cargar cuentas bancarias:', error);
      this.cuentas = [];
      this.toast.error(this.getErrorMessage(error, 'No se pudieron cargar las cuentas bancarias.'));
    } finally {
      this.cuentasLoading = false;
    }
  }

  onCuentaChange(codCtaBanco: string): void {
    const selected = this.cuentas.find((item) => item.value === codCtaBanco);
    if (selected?.moneda && !this.depositoForm.controls.moneda.value) {
      this.depositoForm.controls.moneda.setValue(selected.moneda);
    }
  }

  seleccionarCliente(cliente: ClienteUI): void {
    this.selectedCliente = cliente;
    this.depositoForm.controls.numDepositante.setValue(cliente.codigo);
    this.depositoForm.controls.depositante.setValue(cliente.nombre);
    this.showClienteDropdown = false;
  }

  ocultarClientes(): void {
    setTimeout(() => {
      this.showClienteDropdown = false;
    }, 150);
  }

  async cargarClientePorCodigo(): Promise<void> {
    if (this.clienteLocked) {
      return;
    }
    const cod = this.normalize(this.depositoForm.controls.numDepositante.value);
    if (!cod) {
      this.depositoForm.controls.depositante.setValue('');
      return;
    }
    try {
      const cliente = await firstValueFrom(this.clienteService.getClienteByCodigo(cod));
      if (cliente) {
        this.selectedCliente = cliente;
        this.depositoForm.controls.numDepositante.setValue(cliente.codigo);
        this.depositoForm.controls.depositante.setValue(cliente.nombre);
      }
    } catch (error) {
      console.error('Error al cargar cliente:', error);
    }
  }

  agregarDetalle(): void {
    if (this.readonlyMode) {
      return;
    }
    this.detalleArray.push(this.createDetalleForm());
  }

  eliminarDetalle(index: number): void {
    if (this.readonlyMode) {
      return;
    }
    this.detalleArray.removeAt(index);
    this.detalleArray.markAsDirty();
  }

  eliminarCobranza(index: number): void {
    if (this.readonlyMode) {
      return;
    }
    this.cobranzasArray.removeAt(index);
    this.recalcularTotales();
  }

  guardar(): void {
    if (this.readonlyMode) {
      return;
    }
    if (this.depositoForm.invalid) {
      this.depositoForm.markAllAsTouched();
      this.toast.warning('Completa los campos obligatorios antes de guardar.');
      return;
    }
    if (!this.cobranzasArray.length) {
      this.toast.warning('Debes agregar al menos un documento para aplicar la cobranza.');
      return;
    }
    if (!this.detalleArray.length) {
      this.toast.warning('Debes registrar el detalle contable antes de guardar.');
      return;
    }
    if (this.cobranzasArray.controls.some((ctrl) => ctrl.invalid)) {
      this.toast.warning('Revisa los montos aplicados en los documentos.');
      return;
    }
    if (this.detalleArray.controls.some((ctrl) => ctrl.invalid)) {
      this.toast.warning('Revisa el detalle contable antes de guardar.');
      return;
    }
    if (this.diferenciaDetalle !== 0) {
      this.toast.warning('El total de detalle contable debe ser igual al monto del depósito.');
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    const request = this.idOperacion
      ? this.depositoService.updateDeposito(this.idOperacion, payload)
      : this.depositoService.createDeposito(payload);

    firstValueFrom(request)
      .then(() => {
        this.toast.success(this.idOperacion ? 'Depósito actualizado correctamente.' : 'Depósito registrado correctamente.');
        this.router.navigate(['/finanzas/bancos/depositos-cxc']);
      })
      .catch((error) => {
        this.toast.error(this.getErrorMessage(error, 'No se pudo guardar el depósito.'));
      })
      .finally(() => {
        this.saving = false;
      });
  }

  cancelar(): void {
    if (!this.canDeactivate()) {
      return;
    }
    this.router.navigate(['/finanzas/bancos/depositos-cxc']);
  }

  trackByIndex(index: number): number {
    return index;
  }

  saldoRestante(index: number): number {
    const cobranza = this.cobranzasArray.at(index).getRawValue();
    return this.roundNumber(this.normalizeNumber(cobranza.saldo) - this.normalizeNumber(cobranza.montoPago));
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

  get totalCobranza(): number {
    return this.cobranzasArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.montoPago), 0);
  }

  get totalDetalle(): number {
    return this.detalleArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.monto), 0);
  }

  get diferenciaDetalle(): number {
    return this.roundNumber(this.totalCobranza - this.totalDetalle);
  }

  get saldoPendienteTotal(): number {
    return this.cobranzasArray.getRawValue().reduce((sum, item) => sum + this.normalizeNumber(item.saldo), 0);
  }

  get documentosSeleccionadosCount(): number {
    return this.cobranzasArray.length;
  }

  isInvalid(control: FormControl | null): boolean {
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private preloadFromState(): void {
    const documentos = this.getDocumentosFromState();
    const cliente = this.getClienteFromState();
    if (cliente) {
      this.selectedCliente = cliente;
      this.depositoForm.controls.numDepositante.setValue(cliente.codigo);
      this.depositoForm.controls.depositante.setValue(cliente.nombre);
      this.clienteLocked = true;
    }
    if (documentos.length) {
      if (!this.selectedCliente) {
        const first = documentos[0];
        this.selectedCliente = {
          codigo: this.normalize(first.codCliente),
          nombre: this.normalize(first.nomCliente),
          ruc: '',
          contacto: '',
          direccion: '',
          provincia: '',
          ciudad: '',
          pais: '',
          zona: '',
          email: '',
          telefono1: '',
          telefono2: '',
          fax: '',
          tipoCli: '',
          mtoCredito: 0,
          idProvincia: '',
          idCanton: '',
          idDistrito: '',
          tCliente: '',
          enviarCorreo: false
        };
      }
      this.setCobranzas(documentos);
    }
  }

  private async loadDeposito(idOperacion: string): Promise<void> {
    this.loading = true;
    try {
      const deposito = await firstValueFrom(this.depositoService.getDepositoById(idOperacion));
      if (!deposito) {
        this.toast.warning('No se encontró el depósito solicitado.');
        this.router.navigate(['/finanzas/bancos/depositos-cxc']);
        return;
      }
      this.setDeposito(deposito);
      if (this.readonlyMode) {
        this.depositoForm.disable({ emitEvent: false });
      }
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo cargar el depósito.'));
    } finally {
      this.loading = false;
    }
  }

  private setDeposito(deposito: DepositoCxc): void {
    this.depositoForm.patchValue({
      codBanco: this.normalize(deposito.codBanco),
      codCtaBanco: this.normalize(deposito.codCtaBanco),
      fecha: this.formatDateFromApi(this.normalize(deposito.fecha)),
      frmPago: this.normalize(deposito.frmPago),
      numOpera: this.normalize(deposito.numOpera),
      moneda: this.normalize(deposito.moneda),
      tCambio: this.normalizeNumber(deposito.tCambio),
      numDepositante: this.normalize(deposito.numDepositante),
      depositante: this.normalize(deposito.depositante),
      concepto: this.normalize(deposito.concepto),
      monto: this.normalizeNumber(deposito.monto)
    });

    this.cobranzasArray.clear();
    (deposito.cobranzas || []).forEach((cobranza) => {
      this.cobranzasArray.push(this.createCobranzaForm({
        ...cobranza,
        saldo: cobranza.montoPago
      }));
    });

    this.detalleArray.clear();
    (deposito.detalle || []).forEach((detalle) => this.detalleArray.push(this.createDetalleForm(detalle)));

    this.recalcularTotales();
    this.recalcularDetalle();
  }

  private setCobranzas(documentos: DocumentoSeleccionado[]): void {
    const validos = documentos.filter((item) => this.normalizeNumber(item.saldo) > 0);
    if (!validos.length) {
      return;
    }

    const clienteBase = validos[0].codCliente;
    const documentosFiltrados = validos.filter((item) => item.codCliente === clienteBase);
    if (documentosFiltrados.length !== validos.length) {
      this.toast.warning('Solo puedes aplicar documentos del mismo cliente. Se filtraron los seleccionados.');
    }

    const clienteNombre = documentosFiltrados[0].nomCliente;
    this.clienteLocked = true;
    this.depositoForm.controls.numDepositante.setValue(clienteBase);
    this.depositoForm.controls.depositante.setValue(clienteNombre);

    const moneda = documentosFiltrados[0].moneda;
    if (moneda) {
      this.depositoForm.controls.moneda.setValue(moneda);
    }
    const tipoCambio = this.normalizeNumber(documentosFiltrados[0].tCambio || 1);
    if (tipoCambio > 0) {
      this.depositoForm.controls.tCambio.setValue(tipoCambio);
    }

    this.cobranzasArray.clear();
    documentosFiltrados.forEach((item) => {
      this.cobranzasArray.push(
        this.createCobranzaForm({
          tipoDocu: item.tipoDocu,
          serie: item.serie,
          numDocu: item.numDocu,
          fechaCobra: this.depositoForm.controls.fecha.value,
          moneda: item.moneda,
          saldo: this.normalizeNumber(item.saldo),
          montoPago: this.normalizeNumber(item.saldo),
          estado: 'PENDIENTE',
          referencia: this.normalize(this.depositoForm.controls.numOpera.value),
          frmPago: this.normalize(this.depositoForm.controls.frmPago.value),
          descripcion: item.estadoElectronico || '',
          tCambio: this.normalizeNumber(item.tCambio || 1),
          tipo: item.tipoDocu
        })
      );
    });
    this.recalcularTotales();
  }

  private createCobranzaForm(cobranza?: Partial<DepositoCxcCobranza> & { saldo?: number }): FormGroup<CobranzaForm> {
    const saldo = this.normalizeNumber(cobranza?.saldo);
    const montoPago = this.normalizeNumber(cobranza?.montoPago ?? saldo);
    return this.fb.group({
      tipoDocu: this.fb.control(this.normalize(cobranza?.tipoDocu)),
      serie: this.fb.control(this.normalize(cobranza?.serie)),
      numDocu: this.fb.control(this.normalize(cobranza?.numDocu)),
      fechaCobra: this.fb.control(this.formatDateFromApi(this.normalize(cobranza?.fechaCobra))),
      moneda: this.fb.control(this.normalize(cobranza?.moneda)),
      saldo: this.fb.control(saldo),
      montoPago: this.fb.control(montoPago, {
        validators: [Validators.required, Validators.min(0), this.maxSaldoValidator(saldo)]
      }),
      estado: this.fb.control(this.normalize(cobranza?.estado) || 'PENDIENTE'),
      referencia: this.fb.control(this.normalize(cobranza?.referencia)),
      frmPago: this.fb.control(this.normalize(cobranza?.frmPago)),
      descripcion: this.fb.control(this.normalize(cobranza?.descripcion)),
      tCambio: this.fb.control(this.normalizeNumber(cobranza?.tCambio || 1)),
      tipo: this.fb.control(this.normalize(cobranza?.tipo))
    });
  }

  private createDetalleForm(detalle?: Partial<DepositoCxcDetalle>): FormGroup<DetalleForm> {
    return this.fb.group({
      codConcepto: this.fb.control(this.normalize(detalle?.codConcepto), { validators: [Validators.required] }),
      descripcion: this.fb.control(this.normalize(detalle?.descripcion), { validators: [Validators.required] }),
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
    this.cobranzasArray.controls.forEach((control) => {
      const saldo = this.normalizeNumber(control.controls.saldo.value);
      const monto = this.normalizeNumber(control.controls.montoPago.value);
      const restante = this.roundNumber(saldo - monto);
      const estado = restante <= 0 ? 'PAGADO' : restante < saldo ? 'PARCIAL' : 'PENDIENTE';
      control.controls.estado.setValue(estado, { emitEvent: false });
    });
    const total = this.roundNumber(this.totalCobranza);
    this.depositoForm.controls.monto.setValue(total, { emitEvent: false });
  }

  private recalcularDetalle(): void {
    // No-op: se recalcula vía getters, pero se mantiene para disparar change detection.
  }

  private buildPayload(): DepositoCxc {
    const raw = this.depositoForm.getRawValue();
    const operador = this.getOperador();
    const empresa = this.getEmpresa();
    const fechaIso = this.toIsoDate(raw.fecha);

    return {
      idOperacion: this.idOperacion ?? '',
      codBanco: this.normalize(raw.codBanco),
      codCtaBanco: this.normalize(raw.codCtaBanco),
      fecha: fechaIso,
      numDepositante: this.normalize(raw.numDepositante),
      depositante: this.normalize(raw.depositante),
      concepto: this.normalize(raw.concepto),
      frmPago: this.normalize(raw.frmPago),
      numOpera: this.normalize(raw.numOpera),
      moneda: this.normalize(raw.moneda),
      monto: this.roundNumber(this.normalizeNumber(raw.monto)),
      tCambio: this.normalizeNumber(raw.tCambio),
      operador,
      empresa,
      movCon: 0,
      fechaCon: fechaIso,
      operCon: '',
      detalle: raw.detalle.map((item) => ({
        codConcepto: this.normalize(item.codConcepto),
        descripcion: this.normalize(item.descripcion),
        moneda: this.normalize(item.moneda),
        monto: this.normalizeNumber(item.monto),
        tCambio: this.normalizeNumber(item.tCambio)
      })),
      cobranzas: raw.cobranzas.map((item) => ({
        tipoDocu: this.normalize(item.tipoDocu),
        serie: this.normalize(item.serie),
        numDocu: this.normalize(item.numDocu),
        fechaCobra: this.toIsoDate(item.fechaCobra || raw.fecha),
        tipo: this.normalize(item.tipo),
        moneda: this.normalize(item.moneda),
        montoPago: this.normalizeNumber(item.montoPago),
        tCambio: this.normalizeNumber(item.tCambio),
        estado: this.normalize(item.estado),
        descripcion: this.normalize(item.descripcion),
        frmPago: this.normalize(item.frmPago || raw.frmPago),
        referencia: this.normalize(item.referencia || raw.numOpera)
      }))
    };
  }

  private buscarCliente(): void {
    if (this.clienteLocked) {
      this.clienteLoading = false;
      this.clienteSuggestions = [];
      this.showClienteDropdown = false;
      return;
    }
    const term = this.normalize(this.depositoForm.controls.depositante.value);
    if (term.length < 2) {
      this.clienteSuggestions = [];
      this.showClienteDropdown = false;
      return;
    }
    this.clienteLoading = true;
    this.clienteService
      .getClientes(1, 10, term)
      .pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([]))
      )
      .subscribe((clientes) => {
        this.clienteSuggestions = clientes;
        this.showClienteDropdown = clientes.length > 0;
        this.clienteLoading = false;
      });
  }

  private getDocumentosFromState(): DocumentoSeleccionado[] {
    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    const documentos = state?.documentosSeleccionados;
    if (!Array.isArray(documentos)) {
      return [];
    }
    return documentos.filter((item) => item && typeof item === 'object') as DocumentoSeleccionado[];
  }

  private getClienteFromState(): ClienteUI | null {
    const state = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    return state?.clienteSeleccionado ?? null;
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
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (year && month && day) {
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
    }
    if (trimmed.includes('-')) {
      return trimmed;
    }
    return trimmed;
  }

  private toIsoDate(value: string): string {
    const trimmed = this.normalize(value);
    if (!trimmed) {
      return new Date().toISOString();
    }
    if (trimmed.includes('T')) {
      return trimmed;
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
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
