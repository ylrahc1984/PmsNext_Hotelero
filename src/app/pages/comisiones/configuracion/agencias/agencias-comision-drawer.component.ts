import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ClienteService } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from 'src/app/demo/catalogos/agencias-comisionistas/cliente.models';
import { AgenciaComision, AgenciaComisionPayload } from '../../interfaces/config-comision.interface';
import { AgenciaComisionService } from '../../services/agencia-comision.service';

@Component({
  selector: 'app-agencias-comision-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agencias-comision-drawer.component.html',
  styleUrl: './agencias-comision-drawer.component.scss'
})
export class AgenciasComisionDrawerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly clienteService = inject(ClienteService);
  private readonly agenciaService = inject(AgenciaComisionService);
  private readonly authService = inject(AuthService);

  @Input() open = false;
  @Input() empresaId = 1;
  @Input() selected: AgenciaComision | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<AgenciaComisionPayload>();

  readonly clientes = signal<ClienteUI[]>([]);
  readonly searchingClientes = signal(false);
  readonly checkingDuplicate = signal(false);
  readonly duplicateMessage = signal('');
  readonly selectedCliente = signal<ClienteUI | null>(null);

  readonly form = this.fb.group({
    aD15_Id: [0],
    aD15_EmpresaId: [1],
    agenciaSearch: ['', Validators.required],
    aD15_CodAgencia: ['', Validators.required],
    aD15_Comisiona: [true],
    aD15_TipoComisionDefault: ['PORCENTAJE', Validators.required],
    aD15_ValorDefault: [10, [Validators.required, Validators.min(0.01)]],
    aD15_FechaInicio: ['', Validators.required],
    aD15_FechaFin: ['', Validators.required],
    aD15_Activo: [true],
    aD15_Observaciones: ['']
  });

  ngOnInit(): void {
    this.form.controls.agenciaSearch.valueChanges.subscribe((value) => {
      const selectedLabel = this.selectedCliente() ? this.buildClienteLabel(this.selectedCliente()!) : '';
      const currentValue = String(value ?? '').trim();

      if (currentValue.length < 2) {
        this.clientes.set([]);
      }

      if (!this.selected?.aD15_Id && currentValue !== selectedLabel) {
        this.form.controls.aD15_CodAgencia.setValue('', { emitEvent: false });
        this.duplicateMessage.set('');
        this.checkingDuplicate.set(false);
      }
    });

    this.form.controls.agenciaSearch.valueChanges
      .pipe(
        debounceTime(260),
        distinctUntilChanged(),
        filter((value) => String(value ?? '').trim().length >= 2),
        switchMap((value) => {
          this.searchingClientes.set(true);
          return this.clienteService.getClientes(1, 8, String(value ?? '').trim()).pipe(catchError(() => of({ data: [] } as any)));
        })
      )
      .subscribe((result) => {
        this.clientes.set(result.data ?? []);
        this.searchingClientes.set(false);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['empresaId']) {
      this.form.controls.aD15_EmpresaId.setValue(this.empresaId, { emitEvent: false });
    }

    if (changes['selected'] || changes['open']) {
      this.resetForm();
    }
  }

  selectCliente(cliente: ClienteUI): void {
    const codAgencia = String(cliente.codigo ?? '').trim();

    this.selectedCliente.set(cliente);
    this.clientes.set([]);
    this.duplicateMessage.set('');
    this.form.patchValue({
      agenciaSearch: this.buildClienteLabel(cliente),
      aD15_CodAgencia: codAgencia
    }, { emitEvent: false });

    if (!this.selected?.aD15_Id && codAgencia) {
      this.checkingDuplicate.set(true);
      this.agenciaService
        .exists(this.empresaId, codAgencia)
        .pipe(
          catchError(() => of(false)),
          finalize(() => this.checkingDuplicate.set(false))
        )
        .subscribe((exists) => {
          if (this.form.controls.aD15_CodAgencia.value !== codAgencia) {
            return;
          }

          this.duplicateMessage.set(exists ? 'Esta agencia ya posee configuracion de comision.' : '');
        });
    }
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.hasInvalidDates() || this.checkingDuplicate() || this.duplicateMessage()) {
      return;
    }

    const raw = this.form.getRawValue();
    this.save.emit({
      proceso: Number(raw.aD15_Id ?? 0) > 0 ? 2 : 1,
      aD15_Id: Number(raw.aD15_Id ?? 0),
      aD15_EmpresaId: Number(raw.aD15_EmpresaId ?? this.empresaId),
      aD15_CodAgencia: String(raw.aD15_CodAgencia ?? '').trim(),
      aD15_Comisiona: Boolean(raw.aD15_Comisiona),
      aD15_TipoComisionDefault: String(raw.aD15_TipoComisionDefault ?? '').trim(),
      aD15_ValorDefault: Number(raw.aD15_ValorDefault ?? 0),
      aD15_FechaInicio: this.toApiDate(raw.aD15_FechaInicio),
      aD15_FechaFin: this.toApiDate(raw.aD15_FechaFin),
      aD15_Activo: Boolean(raw.aD15_Activo),
      aD15_Observaciones: String(raw.aD15_Observaciones ?? '').trim(),
      aD15_Operador: this.getOperador()
    });
  }

  hasInvalidDates(): boolean {
    const inicio = this.form.controls.aD15_FechaInicio.value;
    const fin = this.form.controls.aD15_FechaFin.value;
    return !!inicio && !!fin && fin < inicio;
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  private resetForm(): void {
    this.duplicateMessage.set('');
    this.clientes.set([]);
    this.checkingDuplicate.set(false);
    this.selectedCliente.set(null);

    const today = new Date().toISOString().slice(0, 10);
    const end = `${new Date().getFullYear()}-12-31`;

    if (this.selected) {
      this.form.reset({
        aD15_Id: this.selected.aD15_Id,
        aD15_EmpresaId: this.selected.aD15_EmpresaId || this.empresaId,
        agenciaSearch: this.selected.aD15_CodAgencia,
        aD15_CodAgencia: this.selected.aD15_CodAgencia,
        aD15_Comisiona: this.selected.aD15_Comisiona,
        aD15_TipoComisionDefault: this.selected.aD15_TipoComisionDefault || 'PORCENTAJE',
        aD15_ValorDefault: this.selected.aD15_ValorDefault || 0,
        aD15_FechaInicio: this.toInputDate(this.selected.aD15_FechaInicio) || today,
        aD15_FechaFin: this.toInputDate(this.selected.aD15_FechaFin) || end,
        aD15_Activo: this.selected.aD15_Activo,
        aD15_Observaciones: this.selected.aD15_Observaciones || ''
      }, { emitEvent: false });
      return;
    }

    this.form.reset({
      aD15_Id: 0,
      aD15_EmpresaId: this.empresaId,
      agenciaSearch: '',
      aD15_CodAgencia: '',
      aD15_Comisiona: true,
      aD15_TipoComisionDefault: 'PORCENTAJE',
      aD15_ValorDefault: 10,
      aD15_FechaInicio: today,
      aD15_FechaFin: end,
      aD15_Activo: true,
      aD15_Observaciones: ''
    }, { emitEvent: false });
  }

  private buildClienteLabel(cliente: ClienteUI): string {
    return `${cliente.codigo} - ${cliente.nombre}`.trim();
  }

  private toApiDate(value: unknown): string {
    const normalized = String(value ?? '').trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return normalized;
  }

  private toInputDate(value: unknown): string {
    const normalized = String(value ?? '').trim();
    const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);

    if (slashMatch) {
      return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
    }

    return normalized.slice(0, 10);
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
