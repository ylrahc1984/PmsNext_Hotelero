import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import Swal from 'sweetalert2';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ClienteService } from './cliente.service';
import { ClienteUI } from './cliente.models';
import { ActividadComercialComponent } from './actividad-comercial/actividad-comercial.component';

@Component({
  selector: 'app-cliente-form',
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, SharedModule, RouterLink, ActividadComercialComponent],
  templateUrl: './cliente-form.component.html',
  styleUrls: ['./cliente-form.component.scss']
})
export class ClienteFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clienteService = inject(ClienteService);
  private http = inject(HttpClient);

  form!: FormGroup;
  isEditing = false;
  isLoading = false;
  readOnly = false;
  private codigoCliente = '';

  tipoClienteOptions: Array<{ value: string; label: string }> = [];

  tipoIdentificacionOptions: Array<{ value: string; label: string }> = [];
  zonaOptions: Array<{ value: string; label: string }> = [];
  provinciaOptions: Array<{ value: number; label: string }> = [];
  cantonOptions: Array<{ value: string; label: string }> = [];
  isLoadingCantones = false;
  distritoOptions: Array<{ value: string; label: string }> = [];
  isLoadingDistritos = false;

  ngOnInit(): void {
    this.buildForm();
    this.readOnly = !!this.route.snapshot.data?.['readOnly'];
    this.listenProvinciaChanges();
    this.listenCantonChanges();
    this.codigoCliente = this.route.snapshot.paramMap.get('codigo') ?? '';
    if (this.codigoCliente) {
      this.isEditing = true;
      this.loadCliente(this.codigoCliente);
    } else {
      this.loadTipoIdentificacion();
      this.loadTipoCliente();
      this.loadZonas();
      this.loadProvincias();
      this.applyState();
    }
  }

  private loadTipoIdentificacion(): void {
    this.fetchTipoIdentificacionOptions().subscribe((options) => {
      const selected = this.form.get('tCliente')?.value;
      this.tipoIdentificacionOptions = this.mergeSelectedOption(options, selected);
    });
  }

  private loadTipoCliente(): void {
    this.fetchTipoClienteOptions().subscribe((options) => {
      const selected = this.form.get('tipoCli')?.value;
      this.tipoClienteOptions = this.mergeSelectedOption(options, selected);
    });
  }

  private loadZonas(): void {
    this.fetchZonaOptions().subscribe((options) => {
      const selected = this.form.get('zona')?.value;
      this.zonaOptions = this.mergeSelectedOption(options, selected);
    });
  }

  private loadProvincias(): void {
    this.fetchProvincias().subscribe((options) => {
      this.provinciaOptions = options;
    });
  }

  private listenProvinciaChanges(): void {
    const control = this.form.get('idProvincia');
    if (!control) {
      return;
    }

    control.valueChanges.subscribe((value) => {
      const provincia = value ? String(value) : '';
      if (!provincia) {
        this.cantonOptions = [];
        this.form.get('idCanton')?.setValue('');
        this.distritoOptions = [];
        this.form.get('idDistrito')?.setValue('');
        return;
      }
      this.loadCantones(provincia);
    });
  }

  private loadCantones(idProvincia: string): void {
    if (!idProvincia) {
      this.cantonOptions = [];
      return;
    }
    this.fetchCantones(idProvincia).subscribe((options) => {
      this.cantonOptions = options;
      this.distritoOptions = [];
      this.form.get('idDistrito')?.setValue('');
    });
  }

  private listenCantonChanges(): void {
    const provinciaControl = this.form.get('idProvincia');
    const cantonControl = this.form.get('idCanton');
    if (!provinciaControl || !cantonControl) {
      return;
    }

    cantonControl.valueChanges.subscribe((value) => {
      const provincia = provinciaControl.value ? String(provinciaControl.value) : '';
      const canton = value ? String(value) : '';
      if (!provincia || !canton) {
        this.distritoOptions = [];
        this.form.get('idDistrito')?.setValue('');
        return;
      }
      this.loadDistritos(provincia, canton);
    });
  }

  private loadDistritos(idProvincia: string, idCanton: string): void {
    if (!idProvincia || !idCanton) {
      this.distritoOptions = [];
      return;
    }
    this.fetchDistritos(idProvincia, idCanton).subscribe((options) => {
      this.distritoOptions = options;
    });
  }

  private buildForm(): void {
    this.form = this.fb.group({
      codigo: [''],
      nombreCli: ['', [Validators.required]],
      ruc: [''],
      contacto: [''],
      direccion: [''],
      provincia: [''],
      ciudad: [''],
      pais: [''],
      zona: [''],
      email: ['', [Validators.email]],
      telefono1: [''],
      telefono2: [''],
      fax: [''],
      tipoCli: ['AGE', [Validators.required]],
      mtoCredito: [0],
      idProvincia: [''],
      idCanton: [''],
      idDistrito: [''],
      tCliente: [''],
      enviarCorreo: [false]
    });
  }

  private applyState(cliente?: ClienteUI, emitEvent = true): void {
    if (cliente) {
      this.form.patchValue({
        codigo: cliente.codigo,
        nombreCli: cliente.nombre,
        ruc: cliente.ruc,
        contacto: cliente.contacto,
        direccion: cliente.direccion,
        provincia: cliente.provincia,
        ciudad: cliente.ciudad,
        pais: cliente.pais,
        zona: cliente.zona,
        email: cliente.email,
        telefono1: cliente.telefono1,
        telefono2: cliente.telefono2,
        fax: cliente.fax,
        tipoCli: cliente.tipoCli || 'AGE',
        mtoCredito: cliente.mtoCredito ?? 0,
        idProvincia: cliente.idProvincia,
        idCanton: cliente.idCanton,
        idDistrito: cliente.idDistrito,
        tCliente: this.normalizeSelectValue(cliente.tCliente),
        enviarCorreo: cliente.enviarCorreo ?? false
      }, { emitEvent });
      this.tipoIdentificacionOptions = this.mergeSelectedOption(this.tipoIdentificacionOptions, cliente.tCliente);
      this.tipoClienteOptions = this.mergeSelectedOption(this.tipoClienteOptions, cliente.tipoCli);
      this.zonaOptions = this.mergeSelectedOption(this.zonaOptions, cliente.zona);
    } else {
      this.form.reset({
        codigo: '',
        nombreCli: '',
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
        tipoCli: 'AGE',
        mtoCredito: 0,
        idProvincia: '',
        idCanton: '',
        idDistrito: '',
        tCliente: '',
        enviarCorreo: false
      }, { emitEvent });
      this.cantonOptions = [];
      this.distritoOptions = [];
    }
    this.toggleReadOnly();
    if (this.isEditing && !this.readOnly) {
      this.form.get('codigo')?.disable({ emitEvent: false });
    }
  }

  private mergeSelectedOption(
    options: Array<{ value: string; label: string }>,
    selected: string | null | undefined
  ): Array<{ value: string; label: string }> {
    const normalized = this.normalizeSelectValue(selected);
    const merged =
      normalized && !options.some((item) => this.normalizeSelectValue(item.value) === normalized)
        ? [...options, { value: normalized, label: normalized }]
        : [...options];
    return merged.sort((a, b) => this.normalizeSelectValue(a.value).localeCompare(this.normalizeSelectValue(b.value)));
  }

  private normalizeSelectValue(value: string | null | undefined): string {
    return (value ?? '').toString().trim();
  }

  private fetchTipoIdentificacionOptions(): Observable<Array<{ value: string; label: string }>> {
    const apiUrl = 'http://localhost:5000/api/tipoidentificacion';
    return this.http.get<Array<{ CA24_Codigo: string; CA24_Tipo: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: this.normalizeSelectValue(item.CA24_Codigo),
          label: this.normalizeSelectValue(item.CA24_Tipo)
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar tipos de identificacion:', error);
        return of([]);
      })
    );
  }

  private fetchTipoClienteOptions(): Observable<Array<{ value: string; label: string }>> {
    const apiUrl = 'http://localhost:5000/api/tipocliente';
    return this.http.get<Array<{ CPV00_Codigo: string; CPV00_Descripcion: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: this.normalizeSelectValue(item.CPV00_Codigo),
          label: this.normalizeSelectValue(item.CPV00_Descripcion)
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar tipos de cliente:', error);
        return of([]);
      })
    );
  }

  private fetchZonaOptions(): Observable<Array<{ value: string; label: string }>> {
    const apiUrl = 'http://localhost:5000/api/zona';
    return this.http.get<Array<{ CPV01_Codigo: string; CPV01_Zona: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: this.normalizeSelectValue(item.CPV01_Codigo),
          label: this.normalizeSelectValue(item.CPV01_Zona)
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar zonas:', error);
        return of([]);
      })
    );
  }

  private fetchProvincias(): Observable<Array<{ value: number; label: string }>> {
    const apiUrl = 'http://localhost:5000/api/provincia';
    return this.http.get<Array<{ CA23_numeroProvincia: number; CA23_nombre: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: item.CA23_numeroProvincia,
          label: item.CA23_nombre
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar provincias:', error);
        return of([]);
      })
    );
  }

  private fetchCantones(idProvincia: string): Observable<Array<{ value: string; label: string }>> {
    if (!idProvincia) {
      return of([]);
    }
    this.isLoadingCantones = true;
    const apiUrl = `http://localhost:5000/api/canton?idProvincia=${encodeURIComponent(idProvincia)}`;
    return this.http.get<Array<{ CA21_numeroCanton: string; CA21_nombre: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: item.CA21_numeroCanton,
          label: item.CA21_nombre
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar cantones:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los cantones. Verifique la provincia seleccionada.',
          icon: 'error'
        });
        return of([]);
      }),
      finalize(() => {
        this.isLoadingCantones = false;
      })
    );
  }

  private fetchDistritos(idProvincia: string, idCanton: string): Observable<Array<{ value: string; label: string }>> {
    if (!idProvincia || !idCanton) {
      return of([]);
    }
    this.isLoadingDistritos = true;
    const apiUrl = `http://localhost:5000/api/distrito?idProvincia=${encodeURIComponent(idProvincia)}&idCanton=${encodeURIComponent(idCanton)}`;
    return this.http.get<Array<{ CA22_DIS_CODIGO: string; CA22_DIS_NOMBRE: string }> | null>(apiUrl).pipe(
      map((response) => {
        const data = response ?? [];
        return data.map((item) => ({
          value: item.CA22_DIS_CODIGO,
          label: item.CA22_DIS_NOMBRE
        }));
      }),
      catchError((error) => {
        console.error('Error al cargar distritos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los distritos. Verifique la provincia y canton seleccionados.',
          icon: 'error'
        });
        return of([]);
      }),
      finalize(() => {
        this.isLoadingDistritos = false;
      })
    );
  }

  private loadUbicacionChain(cliente: ClienteUI): Observable<void> {
    const provincia = String(cliente.idProvincia || '');
    const canton = String(cliente.idCanton || '');
    const distrito = String(cliente.idDistrito || '');
    if (!provincia) {
      return of(void 0);
    }
    this.form.get('idProvincia')?.setValue(provincia, { emitEvent: false });
    return this.fetchCantones(provincia).pipe(
      tap((options) => {
        this.cantonOptions = this.mergeSelectedOption(options, canton);
        if (canton) {
          this.form.get('idCanton')?.setValue(canton, { emitEvent: false });
        }
      }),
      switchMap(() => {
        if (!provincia || !canton) {
          this.distritoOptions = [];
          this.form.get('idDistrito')?.setValue('', { emitEvent: false });
          return of([]);
        }
        return this.fetchDistritos(provincia, canton);
      }),
      tap((options) => {
        this.distritoOptions = this.mergeSelectedOption(options, distrito);
        if (distrito) {
          this.form.get('idDistrito')?.setValue(distrito, { emitEvent: false });
        }
      }),
      map(() => void 0)
    );
  }

  private toggleReadOnly(): void {
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private loadCliente(codigo: string): void {
    this.isLoading = true;
    forkJoin({
      cliente: this.clienteService.getClienteByCodigo(codigo),
      tipoIdentificacion: this.fetchTipoIdentificacionOptions(),
      tipoCliente: this.fetchTipoClienteOptions(),
      zonas: this.fetchZonaOptions(),
      provincias: this.fetchProvincias()
    })
      .pipe(
        switchMap(({ cliente, tipoIdentificacion, tipoCliente, zonas, provincias }) => {
          if (!cliente) {
            Swal.fire({
              title: 'No encontrado',
              text: 'No se encontro el cliente.',
              icon: 'warning'
            });
            this.router.navigate(['/catalogos/clientes']);
            return of(null);
          }
          this.tipoIdentificacionOptions = this.mergeSelectedOption(tipoIdentificacion, cliente.tCliente);
          this.tipoClienteOptions = this.mergeSelectedOption(tipoCliente, cliente.tipoCli);
          this.zonaOptions = this.mergeSelectedOption(zonas, cliente.zona);
          this.provinciaOptions = provincias;
          this.applyState(cliente, false);
          return this.loadUbicacionChain(cliente).pipe(map(() => cliente));
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        error: (error) => {
          console.error('Error al cargar cliente:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo cargar el cliente.',
            icon: 'error'
          });
        }
      });
  }

  onCodigoInput(): void {
    const control = this.form.get('codigo');
    if (!control || this.readOnly) {
      return;
    }
    const value = (control.value || '').toString().toUpperCase();
    control.setValue(value, { emitEvent: false });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload: ClienteUI = {
      codigo: raw.codigo || '',
      nombre: raw.nombreCli || '',
      ruc: raw.ruc || '',
      contacto: raw.contacto || '',
      direccion: raw.direccion || '',
      provincia: raw.provincia || '',
      ciudad: raw.ciudad || '',
      pais: raw.pais || '',
      zona: raw.zona || '',
      email: raw.email || '',
      telefono1: raw.telefono1 || '',
      telefono2: raw.telefono2 || '',
      fax: raw.fax || '',
      tipoCli: raw.tipoCli || 'AGE',
      mtoCredito: Number(raw.mtoCredito || 0),
      idProvincia: raw.idProvincia || '',
      idCanton: raw.idCanton || '',
      idDistrito: raw.idDistrito || '',
      tCliente: raw.tCliente || '',
      enviarCorreo: !!raw.enviarCorreo
    };

    const request = this.isEditing
      ? this.clienteService.editarCliente(payload.codigo, this.clienteService.buildPayloadFromUI(payload, 2))
      : this.clienteService.crearCliente(this.clienteService.buildPayloadFromUI(payload, 1));

    this.isLoading = true;
    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.',
          icon: 'success'
        });
        this.router.navigate(['/catalogos/clientes']);
      },
      error: (error) => {
        console.error('Error al guardar cliente:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar el cliente.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelForm(): void {
    this.router.navigate(['/catalogos/clientes']);
  }

  setActividadPrincipal(actividad: any): void {
    if (actividad) {
      this.form.patchValue({ tCliente: actividad.MPV32_CodigoAMH });
    }
  }
}
