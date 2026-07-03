import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/core/services/auth.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AgencyPagination } from './models/agency-pagination.model';
import { AgencyRequest } from './models/agency-request.model';
import { Agency } from './models/agency.model';
import { AgencyManagementService } from './services/agency-management.service';

interface AgencyForm {
  codigo: FormControl<string>;
  ruc: FormControl<string>;
  nombreAgencia: FormControl<string>;
  direccion: FormControl<string>;
  ciudad: FormControl<string>;
  pais: FormControl<string>;
  primario: FormControl<number>;
  mercado: FormControl<string>;
  contacto: FormControl<string>;
  telefono1: FormControl<string>;
  telefono2: FormControl<string>;
  fax: FormControl<string>;
  email: FormControl<string>;
  codHabita: FormControl<string>;
  numHabita: FormControl<number>;
  codReserva: FormControl<string>;
  numReserva: FormControl<number>;
  porDescu: FormControl<number>;
  activo: FormControl<number>;
  operador: FormControl<string>;
}

@Component({
  selector: 'app-agency-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, SharedModule],
  templateUrl: './agency-management.component.html',
  styleUrls: ['./agency-management.component.scss']
})
export class AgencyManagementComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly agencyService = inject(AgencyManagementService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = this.fb.control('');
  readonly pageSizeControl = this.fb.control(20);
  readonly pageSizeOptions = [10, 20, 50, 100];

  readonly agencyForm: FormGroup<AgencyForm> = this.fb.group({
    codigo: this.fb.control('', { validators: [Validators.required, Validators.maxLength(20)] }),
    ruc: this.fb.control('', { validators: [Validators.maxLength(30)] }),
    nombreAgencia: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    direccion: this.fb.control('', { validators: [Validators.maxLength(250)] }),
    ciudad: this.fb.control('', { validators: [Validators.maxLength(80)] }),
    pais: this.fb.control('', { validators: [Validators.maxLength(80)] }),
    primario: this.fb.control(0),
    mercado: this.fb.control('', { validators: [Validators.maxLength(60)] }),
    contacto: this.fb.control('', { validators: [Validators.required, Validators.maxLength(120)] }),
    telefono1: this.fb.control('', { validators: [Validators.maxLength(40)] }),
    telefono2: this.fb.control('', { validators: [Validators.maxLength(40)] }),
    fax: this.fb.control('', { validators: [Validators.maxLength(40)] }),
    email: this.fb.control('', { validators: [Validators.email, Validators.maxLength(150)] }),
    codHabita: this.fb.control('', { validators: [Validators.maxLength(20)] }),
    numHabita: this.fb.control(0, { validators: [Validators.min(0)] }),
    codReserva: this.fb.control('', { validators: [Validators.maxLength(20)] }),
    numReserva: this.fb.control(0, { validators: [Validators.min(0)] }),
    porDescu: this.fb.control(0, { validators: [Validators.min(0), Validators.max(100)] }),
    activo: this.fb.control(1),
    operador: this.fb.control('', { validators: [Validators.maxLength(50)] })
  });

  agencies: Agency[] = [];
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  isLoading = false;
  isSaving = false;
  isDeleting = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';

  ngOnInit(): void {
    this.bindSearch();
    this.bindPageSize();
    this.loadAgencies();
  }

  loadAgencies(pageNumber = this.currentPage): void {
    this.currentPage = pageNumber;
    const term = this.searchControl.value.trim();
    const request = term
      ? this.agencyService.searchAgency(term, this.currentPage, this.pageSizeControl.value)
      : this.agencyService.getAgencies(this.currentPage, this.pageSizeControl.value);

    this.fetchAgencies(request);
  }

  refresh(): void {
    this.loadAgencies(this.currentPage);
  }

  openCreateModal(): void {
    this.isEditing = false;
    this.errorMessage = '';
    this.agencyForm.reset(this.getDefaultFormValue(), { emitEvent: false });
    this.agencyForm.controls.codigo.enable({ emitEvent: false });
    this.showModal = true;
  }

  openEditModal(agency: Agency): void {
    this.isEditing = true;
    this.errorMessage = '';
    this.agencyForm.reset(
      {
        codigo: agency.MR01_CodAgencia,
        ruc: agency.MR01_Ruc,
        nombreAgencia: agency.MR01_NomAgencia,
        direccion: agency.MR01_Direccion,
        ciudad: agency.MR01_Ciudad,
        pais: agency.MR01_Pais,
        primario: this.toNumber(agency.MR01_Primario),
        mercado: agency.MR01_Mercado,
        contacto: agency.MR01_Contacto,
        telefono1: agency.MR01_Telefono1,
        telefono2: agency.MR01_Telefono2,
        fax: agency.MR01_Fax1,
        email: agency.MR01_Email,
        codHabita: agency.MR01_CodHabita,
        numHabita: this.toNumber(agency.MR01_Numhabita),
        codReserva: agency.MR01_CodReserva,
        numReserva: this.toNumber(agency.MR01_Correlativo),
        porDescu: this.toNumber(agency.MR01_PorDescu),
        activo: this.toNumber(agency.MR01_Activo),
        operador: agency.MR01_Operador || this.getOperador()
      },
      { emitEvent: false }
    );
    this.agencyForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showModal = false;
    this.agencyForm.markAsUntouched();
  }

  saveAgency(): void {
    if (this.agencyForm.invalid) {
      this.agencyForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload = this.buildPayload();
    const action = this.isEditing ? this.agencyService.updateAgency(payload.codigo, payload) : this.agencyService.createAgency(payload);

    action
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo guardar la agencia.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.isSaving = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.toastService.addToast({
          title: 'Exito',
          message: response.respuesta || (this.isEditing ? 'Agencia actualizada correctamente.' : 'Agencia creada correctamente.'),
          type: 'success'
        });

        if (this.isEditing) {
          this.updateAgencyLocally(payload);
        } else {
          this.loadAgencies(this.currentPage);
        }

        this.closeModal();
      });
  }

  deleteAgency(agency: Agency): void {
    Swal.fire({
      title: 'Eliminar Agencia',
      text: '¿Desea eliminar esta Agencia?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isDeleting = true;
      this.agencyService
        .deleteAgency(agency.MR01_CodAgencia)
        .pipe(
          catchError((error) => {
            this.handleError('No se pudo eliminar la agencia.', error);
            return EMPTY;
          }),
          finalize(() => {
            this.isDeleting = false;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((response) => {
          this.toastService.addToast({
            title: 'Exito',
            message: response.respuesta || 'Agencia eliminada correctamente.',
            type: 'success'
          });

          const nextPage = this.agencies.length === 1 && this.currentPage > 1 ? this.currentPage - 1 : this.currentPage;
          this.loadAgencies(nextPage);
        });
    });
  }

  goToPage(pageNumber: number): void {
    const nextPage = Math.min(Math.max(pageNumber, 1), this.totalPages);
    if (nextPage === this.currentPage || this.isLoading) {
      return;
    }

    this.loadAgencies(nextPage);
  }

  exportAgencies(): void {
    this.toastService.addToast({
      title: 'Exportar',
      message: 'La exportacion de agencias se habilitara en una proxima etapa.',
      type: 'info'
    });
  }

  isFieldInvalid(field: keyof AgencyForm): boolean {
    const control = this.agencyForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: keyof AgencyForm): string {
    const control = this.agencyForm.controls[field];

    if (control.errors?.['required']) {
      return 'Campo requerido';
    }

    if (control.errors?.['email']) {
      return 'Correo invalido';
    }

    if (control.errors?.['min']) {
      return 'Debe ser mayor o igual a 0';
    }

    if (control.errors?.['max']) {
      return 'Debe ser menor o igual a 100';
    }

    if (control.errors?.['maxlength']) {
      const maxlengthError = control.errors['maxlength'] as { requiredLength: number };
      return `Máximo ${maxlengthError.requiredLength} caracteres`;
    }

    return '';
  }

  get modalTitle(): string {
    return this.isEditing ? 'Editar Agencia' : 'Nueva Agencia';
  }

  get emptyMessage(): string {
    return this.searchControl.value.trim() ? 'No existen agencias que coincidan con la busqueda.' : 'No existen agencias registradas.';
  }

  trackByCode(_: number, item: Agency): string {
    return item.MR01_CodAgencia;
  }

  isActive(agency: Agency): boolean {
    return this.toNumber(agency.MR01_Activo) === 1;
  }

  private bindSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loadAgencies(1);
      });
  }

  private bindPageSize(): void {
    this.pageSizeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadAgencies(1);
    });
  }

  private fetchAgencies(request: ReturnType<AgencyManagementService['getAgencies']>): void {
    this.isLoading = true;
    this.errorMessage = '';

    request
      .pipe(
        catchError((error) => {
          this.handleError('No se pudieron cargar las agencias.', error);
          return of({
            datos: [],
            totalRegistros: 0,
            paginaActual: this.currentPage,
            tamanoPagina: this.pageSizeControl.value,
            totalPaginas: 1
          } as AgencyPagination);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.agencies = response.datos;
        this.totalRecords = response.totalRegistros;
        this.currentPage = response.paginaActual;
        this.totalPages = Math.max(response.totalPaginas, 1);
        this.pageSizeControl.setValue(response.tamanoPagina, { emitEvent: false });
      });
  }

  private updateAgencyLocally(payload: AgencyRequest): void {
    const updatedAgency = this.mapPayloadToAgency(payload);
    this.agencies = this.agencies.map((agency) => (agency.MR01_CodAgencia === payload.codigo ? updatedAgency : agency));
  }

  private buildPayload(): AgencyRequest {
    const raw = this.agencyForm.getRawValue();

    return {
      proceso: this.isEditing ? 2 : 1,
      codigo: this.sanitize(raw.codigo).toUpperCase(),
      ruc: this.sanitize(raw.ruc),
      nombreAgencia: this.sanitize(raw.nombreAgencia),
      direccion: this.sanitize(raw.direccion),
      ciudad: this.sanitize(raw.ciudad),
      pais: this.sanitize(raw.pais),
      primario: this.toNumber(raw.primario),
      mercado: this.sanitize(raw.mercado),
      contacto: this.sanitize(raw.contacto),
      telefono1: this.sanitize(raw.telefono1),
      telefono2: this.sanitize(raw.telefono2),
      fax: this.sanitize(raw.fax),
      email: this.sanitize(raw.email),
      codHabita: this.sanitize(raw.codHabita).toUpperCase(),
      numHabita: this.toNumber(raw.numHabita),
      codReserva: this.sanitize(raw.codReserva).toUpperCase(),
      numReserva: this.toNumber(raw.numReserva),
      porDescu: this.toNumber(raw.porDescu),
      activo: this.toNumber(raw.activo),
      operador: this.sanitize(raw.operador) || this.getOperador(),
      pageNumber: this.currentPage,
      pageSize: this.pageSizeControl.value,
      respuesta: ''
    };
  }

  private mapPayloadToAgency(payload: AgencyRequest): Agency {
    return {
      MR01_CodAgencia: payload.codigo,
      MR01_Ruc: payload.ruc,
      MR01_NomAgencia: payload.nombreAgencia,
      MR01_Direccion: payload.direccion,
      MR01_Ciudad: payload.ciudad,
      MR01_Pais: payload.pais,
      MR01_Primario: payload.primario,
      MR01_Mercado: payload.mercado,
      MR01_Contacto: payload.contacto,
      MR01_Telefono1: payload.telefono1,
      MR01_Telefono2: payload.telefono2,
      MR01_Fax1: payload.fax,
      MR01_Email: payload.email,
      MR01_CodHabita: payload.codHabita,
      MR01_Numhabita: payload.numHabita,
      MR01_CodReserva: payload.codReserva,
      MR01_Correlativo: payload.numReserva,
      MR01_PorDescu: payload.porDescu,
      MR01_Activo: payload.activo,
      MR01_Operador: payload.operador,
      MR01_CodCliente: null,
      MR01_CodCHM: null,
      MR01_Prepago: null
    };
  }

  private getDefaultFormValue(): ReturnType<FormGroup<AgencyForm>['getRawValue']> {
    return {
      codigo: '',
      ruc: '',
      nombreAgencia: '',
      direccion: '',
      ciudad: '',
      pais: '',
      primario: 0,
      mercado: '',
      contacto: '',
      telefono1: '',
      telefono2: '',
      fax: '',
      email: '',
      codHabita: '',
      numHabita: 0,
      codReserva: '',
      numReserva: 0,
      porDescu: 0,
      activo: 1,
      operador: this.getOperador()
    };
  }

  private getOperador(): string {
    return this.authService.getCurrentUser()?.usuario ?? '';
  }

  private sanitize(value: string): string {
    return value.trim();
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage = message;
    this.toastService.addToast({
      title: 'Error',
      message,
      type: 'error'
    });
  }
}
