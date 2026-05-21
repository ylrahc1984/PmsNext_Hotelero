import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, of } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { TipoPaxService, TipoPaxUI } from 'src/app/demo/reservas/services/tipo-pax.service';
import { AgenciaComision, ServicioComisionable } from '../interfaces/config-comision.interface';
import { ReglaComision, ReglaComisionPayload } from '../interfaces/regla-comision.interface';
import { AgenciaComisionService } from '../services/agencia-comision.service';
import { ServicioComisionableService } from '../services/servicio-comisionable.service';

@Component({
  selector: 'app-regla-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './regla-form.component.html',
  styleUrl: './regla-form.component.scss'
})
export class ReglaFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly agenciaComisionService = inject(AgenciaComisionService);
  private readonly servicioComisionableService = inject(ServicioComisionableService);
  private readonly tipoPaxService = inject(TipoPaxService);
  private readonly authService = inject(AuthService);

  @Input() open = false;
  @Input() empresaId = 1;
  @Input() selected: ReglaComision | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ReglaComisionPayload>();

  readonly agencias = signal<AgenciaComision[]>([]);
  readonly agenciasComisionables = signal<AgenciaComision[]>([]);
  readonly servicios = signal<ServicioComisionable[]>([]);
  readonly serviciosComisionables = signal<ServicioComisionable[]>([]);
  readonly tiposPax = signal<TipoPaxUI[]>([]);
  readonly searchingAgencias = signal(false);
  readonly searchingServicios = signal(false);
  readonly loadingTiposPax = signal(false);
  readonly selectedAgencia = signal<AgenciaComision | null>(null);
  readonly selectedServicio = signal<ServicioComisionable | null>(null);

  readonly form = this.fb.group({
    aD17_Id: [0],
    aD17_EmpresaId: [1],
    agenciaSearch: [''],
    servicioSearch: [''],
    aD17_CodAgencia: [''],
    aD17_CodServicio: [''],
    aD17_TipPax: [''],
    aD17_TipoComision: ['PORCENTAJE', Validators.required],
    aD17_ValorComision: [15, [Validators.required, Validators.min(0.01)]],
    aD17_Prioridad: [10, [Validators.required, Validators.min(1)]],
    aD17_FechaInicio: ['', Validators.required],
    aD17_FechaFin: ['', Validators.required],
    aD17_Activo: [true],
    aD17_Observaciones: ['']
  });

  ngOnInit(): void {
    this.loadTiposPax();

    this.form.controls.agenciaSearch.valueChanges
      .pipe(
        debounceTime(260),
        distinctUntilChanged(),
        filter((value) => {
          const search = String(value ?? '').trim();

          if (search.length < 2) {
            this.agencias.set([]);
            return false;
          }

          return true;
        })
      )
      .subscribe((value) => {
        this.agencias.set(this.filterAgenciasComisionables(String(value ?? '').trim()));
        this.searchingAgencias.set(false);
      });

    this.form.controls.servicioSearch.valueChanges
      .pipe(
        debounceTime(260),
        distinctUntilChanged(),
        filter((value) => {
          const search = String(value ?? '').trim();

          if (search.length < 2) {
            this.servicios.set([]);
            return false;
          }

          return true;
        })
      )
      .subscribe((value) => {
        this.servicios.set(this.filterServiciosComisionables(String(value ?? '').trim()));
        this.searchingServicios.set(false);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['empresaId']) {
      this.form.controls.aD17_EmpresaId.setValue(this.empresaId, { emitEvent: false });
      this.loadAgenciasComisionables();
      this.loadServiciosComisionables();
    }
    if (changes['selected'] || changes['open']) {
      this.resetForm();
      if (this.open) {
        this.loadAgenciasComisionables();
        this.loadServiciosComisionables();
        this.loadTiposPax();
      }
    }
  }

  selectAgencia(agencia: AgenciaComision): void {
    this.selectedAgencia.set(agencia);
    this.agencias.set([]);
    this.form.patchValue(
      { agenciaSearch: this.buildAgenciaLabel(agencia), aD17_CodAgencia: agencia.aD15_CodAgencia },
      { emitEvent: false }
    );
  }

  clearAgencia(): void {
    this.selectedAgencia.set(null);
    this.agencias.set([]);
    this.form.patchValue({ agenciaSearch: '', aD17_CodAgencia: '' }, { emitEvent: false });
  }

  selectServicio(servicio: ServicioComisionable): void {
    this.selectedServicio.set(servicio);
    this.servicios.set([]);
    this.form.patchValue(
      { servicioSearch: this.buildServicioLabel(servicio), aD17_CodServicio: servicio.AD16_CodServicio },
      { emitEvent: false }
    );
  }

  clearServicio(): void {
    this.selectedServicio.set(null);
    this.servicios.set([]);
    this.form.patchValue({ servicioSearch: '', aD17_CodServicio: '' }, { emitEvent: false });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.hasInvalidDates()) return;

    const raw = this.form.getRawValue();
    const id = Number(raw.aD17_Id ?? 0);
    const fechaInicio = this.toApiDate(raw.aD17_FechaInicio);
    const fechaFin = this.toApiDate(raw.aD17_FechaFin);

    this.save.emit({
      proceso: id > 0 ? 2 : 1,
      aD17_Id: id,
      aD17_EmpresaId: Number(raw.aD17_EmpresaId ?? this.empresaId),
      aD17_CodAgencia: String(raw.aD17_CodAgencia ?? '').trim(),
      aD17_CodServicio: String(raw.aD17_CodServicio ?? '').trim(),
      aD17_TipPax: String(raw.aD17_TipPax ?? '').trim().toUpperCase(),
      aD17_TipoComision: String(raw.aD17_TipoComision ?? '').trim(),
      aD17_ValorComision: Number(raw.aD17_ValorComision ?? 0),
      aD17_Prioridad: Number(raw.aD17_Prioridad ?? 0),
      aD17_FechaInicio: fechaInicio,
      aD17_FechaFin: fechaFin,
      aD17_Activo: Boolean(raw.aD17_Activo),
      aD17_Observaciones: String(raw.aD17_Observaciones ?? '').trim(),
      aD17_Operador: this.getOperador(),
      fechaOperacion: this.toApiDate(this.todayAsInputDate())
    });
  }

  hasInvalidDates(): boolean {
    const inicio = this.form.controls.aD17_FechaInicio.value;
    const fin = this.form.controls.aD17_FechaFin.value;
    return !!inicio && !!fin && fin < inicio;
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  isGlobalRule(): boolean {
    return !this.form.controls.aD17_CodAgencia.value && !this.form.controls.aD17_CodServicio.value && !this.form.controls.aD17_TipPax.value;
  }

  buildAgenciaLabel(agencia: AgenciaComision): string {
    const nombre = this.nombreAgencia(agencia);
    return [agencia.aD15_CodAgencia, nombre].filter(Boolean).join(' - ');
  }

  nombreAgencia(agencia: AgenciaComision): string {
    const record = agencia as unknown as Record<string, unknown>;
    return String(record['MPV00_NomClien'] ?? record['aD15_NombreAgencia'] ?? record['AD15_NombreAgencia'] ?? record['nombreAgencia'] ?? '');
  }

  buildServicioLabel(servicio: ServicioComisionable): string {
    const nombre = this.nombreServicio(servicio);
    return [servicio.AD16_CodServicio, nombre].filter(Boolean).join(' - ');
  }

  nombreServicio(servicio: ServicioComisionable): string {
    return String(servicio.AD16_NombreServicio ?? '');
  }

  private resetForm(): void {
    this.agencias.set([]);
    this.servicios.set([]);
    this.selectedAgencia.set(null);
    this.selectedServicio.set(null);
    const today = this.todayAsInputDate();
    const end = `${new Date().getFullYear()}-12-31`;

    if (this.selected) {
      this.form.reset(
        {
          aD17_Id: this.selected.AD17_Id,
          aD17_EmpresaId: this.selected.AD17_EmpresaId || this.empresaId,
          agenciaSearch: this.selected.AD17_CodAgencia,
          servicioSearch: this.selected.AD17_CodServicio,
          aD17_CodAgencia: this.selected.AD17_CodAgencia || '',
          aD17_CodServicio: this.selected.AD17_CodServicio || '',
          aD17_TipPax: this.selected.AD17_TipPax || '',
          aD17_TipoComision: this.selected.AD17_TipoComision || 'PORCENTAJE',
          aD17_ValorComision: this.selected.AD17_ValorComision || 0,
          aD17_Prioridad: this.selected.AD17_Prioridad || 1,
          aD17_FechaInicio: this.toInputDate(this.selected.AD17_FechaInicio) || today,
          aD17_FechaFin: this.toInputDate(this.selected.AD17_FechaFin) || end,
          aD17_Activo: this.selected.AD17_Activo,
          aD17_Observaciones: this.selected.AD17_Observaciones || ''
        },
        { emitEvent: false }
      );
      return;
    }

    this.form.reset(
      {
        aD17_Id: 0,
        aD17_EmpresaId: this.empresaId,
        agenciaSearch: '',
        servicioSearch: '',
        aD17_CodAgencia: '',
        aD17_CodServicio: '',
        aD17_TipPax: '',
        aD17_TipoComision: 'PORCENTAJE',
        aD17_ValorComision: 15,
        aD17_Prioridad: 10,
        aD17_FechaInicio: today,
        aD17_FechaFin: end,
        aD17_Activo: true,
        aD17_Observaciones: ''
      },
      { emitEvent: false }
    );
  }

  private loadAgenciasComisionables(): void {
    const empresaId = Number(this.empresaId || this.form.controls.aD17_EmpresaId.value || 1);

    this.searchingAgencias.set(true);
    this.agenciaComisionService
      .list(empresaId)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.searchingAgencias.set(false))
      )
      .subscribe((agencias) => {
        this.agenciasComisionables.set(
          agencias.filter((agencia) => agencia.aD15_Activo && agencia.aD15_Comisiona && agencia.aD15_CodAgencia)
        );
        this.agencias.set(this.filterAgenciasComisionables(this.form.controls.agenciaSearch.value ?? ''));
      });
  }

  private loadTiposPax(): void {
    if (this.tiposPax().length) {
      return;
    }

    this.loadingTiposPax.set(true);
    this.tipoPaxService
      .getTiposPax()
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loadingTiposPax.set(false))
      )
      .subscribe((tipos) => this.tiposPax.set(tipos ?? []));
  }

  private loadServiciosComisionables(): void {
    const empresaId = Number(this.empresaId || this.form.controls.aD17_EmpresaId.value || 1);

    this.searchingServicios.set(true);
    this.servicioComisionableService
      .list(empresaId)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.searchingServicios.set(false))
      )
      .subscribe((servicios) => {
        this.serviciosComisionables.set(
          servicios.filter((servicio) => servicio.AD16_Activo && servicio.AD16_Comisionable && servicio.AD16_CodServicio)
        );
        this.servicios.set(this.filterServiciosComisionables(this.form.controls.servicioSearch.value ?? ''));
      });
  }

  private filterAgenciasComisionables(value: string): AgenciaComision[] {
    const search = value.trim().toLowerCase();

    if (search.length < 2) {
      return [];
    }

    return this.agenciasComisionables()
      .filter((agencia) =>
        [agencia.aD15_CodAgencia, this.nombreAgencia(agencia), agencia.aD15_Observaciones]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
      .slice(0, 8);
  }

  private filterServiciosComisionables(value: string): ServicioComisionable[] {
    const search = value.trim().toLowerCase();

    if (search.length < 2) {
      return [];
    }

    return this.serviciosComisionables()
      .filter((servicio) =>
        [servicio.AD16_CodServicio, this.nombreServicio(servicio), servicio.AD16_Observaciones]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
      .slice(0, 8);
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private todayAsInputDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toApiDate(value: unknown): string {
    const date = String(value ?? '').trim();
    const inputDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (inputDate) return `${inputDate[3]}/${inputDate[2]}/${inputDate[1]}`;

    const dateTime = /^(\d{4})-(\d{2})-(\d{2})T/.exec(date);
    if (dateTime) return `${dateTime[3]}/${dateTime[2]}/${dateTime[1]}`;

    return date;
  }

  private toInputDate(value: unknown): string {
    const date = String(value ?? '').trim();
    const slashDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (slashDate) return `${slashDate[3]}-${slashDate[2]}-${slashDate[1]}`;

    return date.includes('T') ? date.slice(0, 10) : date;
  }
}
