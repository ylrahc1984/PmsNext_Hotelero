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
import { Mercado } from './models/mercado.model';
import { AgencyManagementService } from './services/agency-management.service';
import { MercadoService } from './services/mercado.service';

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
  private readonly mercadoService = inject(MercadoService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = this.fb.control('');
  readonly pageSizeControl = this.fb.control(20);
  readonly pageSizeOptions = [10, 20, 50, 100];

  readonly agencyForm: FormGroup<AgencyForm> = this.fb.group({
    codigo: this.fb.control(''),
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
    fax: this.fb.control(''),
    email: this.fb.control('', { validators: [Validators.email, Validators.maxLength(150)] }),
    codHabita: this.fb.control(''),
    numHabita: this.fb.control(0),
    codReserva: this.fb.control(''),
    numReserva: this.fb.control(0),
    porDescu: this.fb.control(0),
    activo: this.fb.control(1),
    operador: this.fb.control('')
  });

  agencies: Agency[] = [];
  mercados: Mercado[] = [];
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  isLoading = false;
  isSaving = false;
  isConfirmingSave = false;
  isDeleting = false;
  loadingAgencyCode = '';
  isMercadosLoading = false;
  showModal = false;
  isEditing = false;
  errorMessage = '';
  mercadoError = '';

  ngOnInit(): void {
    this.bindSearch();
    this.bindPageSize();
    this.loadMercados();
    this.loadAgencies();
  }

  loadMercados(): void {
    this.isMercadosLoading = true;
    this.mercadoError = '';

    this.mercadoService
      .getMercados()
      .pipe(
        catchError(() => {
          this.mercados = [];
          this.mercadoError = 'No se pudo cargar el catálogo de mercados.';
          return EMPTY;
        }),
        finalize(() => {
          this.isMercadosLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((mercados) => {
        this.mercados = mercados;

        if (mercados.length === 0) {
          this.mercadoError = 'No hay mercados configurados.';
          return;
        }

        const control = this.agencyForm.controls.mercado;
        const resolvedCode = this.resolveMercadoCode(control.value);
        if (resolvedCode !== control.value) {
          control.setValue(resolvedCode, { emitEvent: false });
        }
      });
  }

  hasMercadoOption(value: string): boolean {
    const normalizedValue = this.normalizeCatalogValue(value);
    return this.mercados.some((mercado) => this.normalizeCatalogValue(mercado.MR02_Codigo) === normalizedValue);
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
    const codigo = agency.MR01_CodAgencia?.trim();
    if (!codigo || this.loadingAgencyCode) {
      return;
    }

    this.loadingAgencyCode = codigo;
    this.errorMessage = '';

    this.agencyService
      .getAgencyByCode(codigo)
      .pipe(
        catchError((error) => {
          this.handleError('No se pudo cargar el detalle de la agencia.', error);
          return EMPTY;
        }),
        finalize(() => {
          this.loadingAgencyCode = '';
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((agencyDetail) => {
        if (!agencyDetail) {
          this.handleError('No se encontró la agencia seleccionada.', { codigo });
          return;
        }

        this.populateEditModal(agencyDetail);
      });
  }

  private populateEditModal(agency: Agency): void {
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
        mercado: this.resolveMercadoCode(agency.MR01_Mercado),
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
        operador: this.getOperador()
      },
      { emitEvent: false }
    );
    this.agencyForm.controls.codigo.disable({ emitEvent: false });
    this.showModal = true;
  }

  closeModal(force = false): void {
    if (this.isSaving && !force) {
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

    if (this.isSaving || this.isConfirmingSave) {
      return;
    }

    const agencyName = this.agencyForm.controls.nombreAgencia.value.trim() || 'esta agencia';
    this.isConfirmingSave = true;

    Swal.fire({
      title: this.isEditing ? 'Confirmar actualización' : 'Confirmar registro',
      text: this.isEditing
        ? `¿Está seguro de guardar los cambios de ${agencyName}?`
        : `¿Está seguro de guardar la agencia ${agencyName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      focusCancel: true,
      reverseButtons: true,
      customClass: {
        container: 'next-confirm-container'
      }
    }).then((result) => {
      this.isConfirmingSave = false;

      if (result.isConfirmed) {
        this.persistAgency();
      }
    });
  }

  private persistAgency(): void {
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
          message: response.mensaje || response.respuesta || (this.isEditing ? 'Agencia actualizada correctamente.' : 'Agencia creada correctamente.'),
          type: 'success'
        });

        if (this.isEditing) {
          this.updateAgencyLocally(payload);
        } else {
          this.loadAgencies(this.currentPage);
        }

        this.closeModal(true);
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
        .deleteAgency(agency.MR01_CodAgencia, this.getOperador())
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
            message: response.mensaje || response.respuesta || 'Agencia eliminada correctamente.',
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
      numReserva: String(this.toNumber(raw.numReserva)),
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
      MR01_Correlativo: this.toNumber(payload.numReserva),
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

  private resolveMercadoCode(value: string): string {
    const normalizedValue = this.normalizeCatalogValue(value);
    if (!normalizedValue) {
      return '';
    }

    const mercado = this.mercados.find(
      (item) =>
        this.normalizeCatalogValue(item.MR02_Codigo) === normalizedValue ||
        this.normalizeCatalogValue(item.MR02_Mercado) === normalizedValue
    );

    return mercado?.MR02_Codigo.trim() || value.trim();
  }

  private normalizeCatalogValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLocaleUpperCase('es');
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
