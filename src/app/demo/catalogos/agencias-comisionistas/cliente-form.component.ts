import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import Swal from 'sweetalert2';
import { Observable, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private destroyRef = inject(DestroyRef);

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
      this.applyState();
      this.loadCatalogosIniciales();
    }
  }

  private loadCatalogosIniciales(): void {
    this.isLoading = true;
    forkJoin({
      tipoIdentificacion: this.clienteService.getTipoIdentificacionOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar tipos de identificacion:', error);
          return of([]);
        })
      ),
      tipoCliente: this.clienteService.getTipoClienteOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar tipos de cliente:', error);
          return of([]);
        })
      ),
      zonas: this.clienteService.getZonaOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar zonas:', error);
          return of([]);
        })
      ),
      provincias: this.clienteService.getProvinciasOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar provincias:', error);
          return of([]);
        })
      )
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe(({ tipoIdentificacion, tipoCliente, zonas, provincias }) => {
        this.tipoIdentificacionOptions = this.mergeSelectedOption(tipoIdentificacion, this.form.get('tCliente')?.value);
        this.tipoClienteOptions = this.mergeSelectedOption(tipoCliente, this.form.get('tipoCli')?.value);
        this.zonaOptions = this.mergeSelectedOption(zonas, this.form.get('zona')?.value);
        this.provinciaOptions = provincias;
      });
  }

  private listenProvinciaChanges(): void {
    const control = this.form.get('idProvincia');
    if (!control) {
      return;
    }

    control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
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
    this.isLoadingCantones = true;
    this.clienteService
      .getCantonesOptions(idProvincia)
      .pipe(
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
      )
      .subscribe((options) => {
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

    cantonControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
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
    this.isLoadingDistritos = true;
    this.clienteService
      .getDistritosOptions(idProvincia, idCanton)
      .pipe(
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
      )
      .subscribe((options) => {
        this.distritoOptions = options;
      });
  }

  private buildForm(): void {
    this.form = this.fb.group({
      codigo: [''],
      nombreCli: ['', [Validators.required]],
      ruc: ['', [Validators.required]],
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

  private loadUbicacionChain(cliente: ClienteUI): Observable<void> {
    const provincia = String(cliente.idProvincia || '');
    const canton = String(cliente.idCanton || '');
    const distrito = String(cliente.idDistrito || '');
    if (!provincia) {
      return of(void 0);
    }
    this.form.get('idProvincia')?.setValue(provincia, { emitEvent: false });
    this.isLoadingCantones = true;
    return this.clienteService.getCantonesOptions(provincia).pipe(
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
      }),
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
        this.isLoadingDistritos = true;
        return this.clienteService.getDistritosOptions(provincia, canton).pipe(
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
      tipoIdentificacion: this.clienteService.getTipoIdentificacionOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar tipos de identificacion:', error);
          return of([]);
        })
      ),
      tipoCliente: this.clienteService.getTipoClienteOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar tipos de cliente:', error);
          return of([]);
        })
      ),
      zonas: this.clienteService.getZonaOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar zonas:', error);
          return of([]);
        })
      ),
      provincias: this.clienteService.getProvinciasOptions().pipe(
        catchError((error) => {
          console.error('Error al cargar provincias:', error);
          return of([]);
        })
      )
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
    request
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
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
        }
      });
  }

  cancelForm(): void {
    this.router.navigate(['/catalogos/clientes']);
  }

  setActividadPrincipal(actividad: { MPV32_CodigoAMH?: string } | null | undefined): void {
    const codigo = actividad?.MPV32_CodigoAMH;
    if (codigo) {
      this.form.patchValue({ tCliente: codigo });
    }
  }
}
