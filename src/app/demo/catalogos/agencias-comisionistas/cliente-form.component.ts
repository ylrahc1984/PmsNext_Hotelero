import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import Swal from 'sweetalert2';
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
    this.loadTipoIdentificacion();
    this.loadTipoCliente();
    this.loadZonas();
    this.loadProvincias();
    this.listenProvinciaChanges();
    this.listenCantonChanges();
    this.codigoCliente = this.route.snapshot.paramMap.get('codigo') ?? '';
    if (this.codigoCliente) {
      this.isEditing = true;
      this.loadCliente(this.codigoCliente);
    } else {
      this.applyState();
    }
  }

  private loadTipoIdentificacion(): void {
    const apiUrl = 'http://localhost:5000/api/tipoidentificacion';
    this.http.get<Array<{ CA24_Codigo: string; CA24_Tipo: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tipoIdentificacionOptions = data.map((item) => ({
          value: item.CA24_Codigo,
          label: item.CA24_Tipo
        }));
      },
      error: (error) => {
        console.error('Error al cargar tipos de identificacion:', error);
        this.tipoIdentificacionOptions = [];
      }
    });
  }

  private loadTipoCliente(): void {
    const apiUrl = 'http://localhost:5000/api/tipocliente';
    this.http.get<Array<{ CPV00_Codigo: string; CPV00_Descripcion: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tipoClienteOptions = data.map((item) => ({
          value: item.CPV00_Codigo,
          label: item.CPV00_Descripcion
        }));
      },
      error: (error) => {
        console.error('Error al cargar tipos de cliente:', error);
        this.tipoClienteOptions = [];
      }
    });
  }

  private loadZonas(): void {
    const apiUrl = 'http://localhost:5000/api/zona';
    this.http.get<Array<{ CPV01_Codigo: string; CPV01_Zona: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.zonaOptions = data.map((item) => ({
          value: item.CPV01_Codigo,
          label: item.CPV01_Zona
        }));
      },
      error: (error) => {
        console.error('Error al cargar zonas:', error);
        this.zonaOptions = [];
      }
    });
  }

  private loadProvincias(): void {
    const apiUrl = 'http://localhost:5000/api/provincia';
    this.http.get<Array<{ CA23_numeroProvincia: number; CA23_nombre: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.provinciaOptions = data.map((item) => ({
          value: item.CA23_numeroProvincia,
          label: item.CA23_nombre
        }));
      },
      error: (error) => {
        console.error('Error al cargar provincias:', error);
        this.provinciaOptions = [];
      }
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

    this.isLoadingCantones = true;
    const apiUrl = `http://localhost:5000/api/canton?idProvincia=${encodeURIComponent(idProvincia)}`;
    this.http.get<Array<{ CA21_numeroCanton: string; CA21_nombre: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.cantonOptions = data.map((item) => ({
          value: item.CA21_numeroCanton,
          label: item.CA21_nombre
        }));
        this.isLoadingCantones = false;
        this.distritoOptions = [];
        this.form.get('idDistrito')?.setValue('');
      },
      error: (error) => {
        console.error('Error al cargar cantones:', error);
        this.cantonOptions = [];
        this.isLoadingCantones = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los cantones. Verifique la provincia seleccionada.',
          icon: 'error'
        });
      }
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

    this.isLoadingDistritos = true;
    const apiUrl = `http://localhost:5000/api/distrito?idProvincia=${encodeURIComponent(idProvincia)}&idCanton=${encodeURIComponent(idCanton)}`;
    this.http.get<Array<{ CA22_DIS_CODIGO: string; CA22_DIS_NOMBRE: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.distritoOptions = data.map((item) => ({
          value: item.CA22_DIS_CODIGO,
          label: item.CA22_DIS_NOMBRE
        }));
        this.isLoadingDistritos = false;
      },
      error: (error) => {
        console.error('Error al cargar distritos:', error);
        this.distritoOptions = [];
        this.isLoadingDistritos = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los distritos. Verifique la provincia y canton seleccionados.',
          icon: 'error'
        });
      }
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

  private applyState(cliente?: ClienteUI): void {
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
        tCliente: cliente.tCliente,
        enviarCorreo: cliente.enviarCorreo ?? false
      });
      if (cliente.idProvincia) {
        this.loadCantones(String(cliente.idProvincia));
      }
      if (cliente.idProvincia && cliente.idCanton) {
        this.loadDistritos(String(cliente.idProvincia), String(cliente.idCanton));
      }
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
      });
      this.cantonOptions = [];
      this.distritoOptions = [];
    }
    this.toggleReadOnly();
    if (this.isEditing && !this.readOnly) {
      this.form.get('codigo')?.disable({ emitEvent: false });
    }
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
    this.clienteService.getClienteByCodigo(codigo).subscribe({
      next: (cliente) => {
        if (!cliente) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el cliente.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/catalogos/clientes']);
          return;
        }
        this.applyState(cliente);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar cliente:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el cliente.',
          icon: 'error'
        });
        this.isLoading = false;
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
