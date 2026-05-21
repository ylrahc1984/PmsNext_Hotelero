import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { ServicioUI, ServiciosService } from 'src/app/demo/catalogos/servicios/servicios.service';
import { ServicioComisionable, ServicioComisionablePayload } from '../../interfaces/config-comision.interface';
import { ServicioComisionableService } from '../../services/servicio-comisionable.service';

@Component({
  selector: 'app-servicio-comisionable-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './servicio-comisionable-drawer.component.html',
  styleUrl: './servicio-comisionable-drawer.component.scss'
})
export class ServicioComisionableDrawerComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly catalogoService = inject(ServiciosService);
  private readonly service = inject(ServicioComisionableService);
  private readonly authService = inject(AuthService);

  @Input() open = false;
  @Input() empresaId = 1;
  @Input() selected: ServicioComisionable | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ServicioComisionablePayload>();

  readonly servicios = signal<ServicioUI[]>([]);
  readonly searchingServicios = signal(false);
  readonly checkingDuplicate = signal(false);
  readonly duplicateMessage = signal('');
  readonly selectedServicio = signal<ServicioUI | null>(null);

  readonly form = this.fb.group({
    aD16_Id: [0],
    aD16_EmpresaId: [1, Validators.required],
    servicioSearch: ['', Validators.required],
    aD16_CodServicio: ['', Validators.required],
    aD16_Comisionable: [true],
    aD16_PermiteOverride: [true],
    aD16_Activo: [true],
    aD16_Observaciones: ['']
  });

  ngOnInit(): void {
    this.form.controls.servicioSearch.valueChanges.subscribe((value) => {
      const selectedLabel = this.selectedServicio() ? this.buildServicioLabel(this.selectedServicio()!) : '';
      const currentValue = String(value ?? '').trim();

      if (currentValue.length < 2) {
        this.servicios.set([]);
      }

      if (!this.selected?.AD16_Id && currentValue !== selectedLabel) {
        this.form.controls.aD16_CodServicio.setValue('', { emitEvent: false });
        this.duplicateMessage.set('');
        this.checkingDuplicate.set(false);
      }
    });

    this.form.controls.servicioSearch.valueChanges
      .pipe(
        debounceTime(260),
        distinctUntilChanged(),
        filter((value) => String(value ?? '').trim().length >= 2),
        switchMap((value) => {
          this.searchingServicios.set(true);
          return this.catalogoService.buscarServicios(String(value ?? '').trim(), 1, 1, 8).pipe(catchError(() => of({ data: [] } as any)));
        })
      )
      .subscribe((result) => {
        this.servicios.set(result.data ?? []);
        this.searchingServicios.set(false);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['empresaId']) {
      this.form.controls.aD16_EmpresaId.setValue(this.empresaId, { emitEvent: false });
    }

    if (changes['selected'] || changes['open']) {
      this.resetForm();
    }
  }

  selectServicio(servicio: ServicioUI): void {
    const codServicio = String(servicio.codReceta ?? '').trim();

    this.selectedServicio.set(servicio);
    this.servicios.set([]);
    this.duplicateMessage.set('');
    this.form.patchValue(
      {
        servicioSearch: this.buildServicioLabel(servicio),
        aD16_CodServicio: codServicio
      },
      { emitEvent: false }
    );

    if (!this.selected?.AD16_Id && codServicio) {
      this.checkingDuplicate.set(true);
      this.service
        .exists(this.empresaId, codServicio)
        .pipe(
          catchError(() => of(false)),
          finalize(() => this.checkingDuplicate.set(false))
        )
        .subscribe((exists) => {
          if (this.form.controls.aD16_CodServicio.value !== codServicio) {
            return;
          }

          this.duplicateMessage.set(exists ? 'Este servicio ya posee configuracion de comision.' : '');
        });
    }
  }

  submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.checkingDuplicate() || this.duplicateMessage()) {
      return;
    }

    const raw = this.form.getRawValue();
    const id = Number(raw.aD16_Id ?? 0);

    this.save.emit({
      proceso: id > 0 ? 2 : 1,
      aD16_Id: id,
      aD16_EmpresaId: Number(raw.aD16_EmpresaId ?? this.empresaId),
      aD16_CodServicio: String(raw.aD16_CodServicio ?? '').trim(),
      aD16_Comisionable: Boolean(raw.aD16_Comisionable),
      aD16_PermiteOverride: Boolean(raw.aD16_PermiteOverride),
      aD16_Activo: Boolean(raw.aD16_Activo),
      aD16_Observaciones: String(raw.aD16_Observaciones ?? '').trim(),
      aD16_Operador: this.getOperador()
    });
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  private resetForm(): void {
    this.duplicateMessage.set('');
    this.servicios.set([]);
    this.checkingDuplicate.set(false);
    this.selectedServicio.set(null);

    if (this.selected) {
      this.form.reset(
        {
          aD16_Id: this.selected.AD16_Id,
          aD16_EmpresaId: this.selected.AD16_EmpresaId || this.empresaId,
          servicioSearch: this.buildPersistedLabel(this.selected),
          aD16_CodServicio: this.selected.AD16_CodServicio,
          aD16_Comisionable: this.selected.AD16_Comisionable,
          aD16_PermiteOverride: this.selected.AD16_PermiteOverride,
          aD16_Activo: this.selected.AD16_Activo,
          aD16_Observaciones: this.selected.AD16_Observaciones || ''
        },
        { emitEvent: false }
      );
      return;
    }

    this.form.reset(
      {
        aD16_Id: 0,
        aD16_EmpresaId: this.empresaId,
        servicioSearch: '',
        aD16_CodServicio: '',
        aD16_Comisionable: true,
        aD16_PermiteOverride: true,
        aD16_Activo: true,
        aD16_Observaciones: ''
      },
      { emitEvent: false }
    );
  }

  private buildServicioLabel(servicio: ServicioUI): string {
    return `${servicio.codReceta} - ${servicio.nomReceta}`.trim();
  }

  private buildPersistedLabel(servicio: ServicioComisionable): string {
    return `${servicio.AD16_CodServicio}${servicio.AD16_NombreServicio ? ' - ' + servicio.AD16_NombreServicio : ''}`.trim();
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }
}
