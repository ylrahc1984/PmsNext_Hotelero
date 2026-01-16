import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { DepartamentoService } from 'src/app/demo/administracion/departamento/departamento.service';
import { DepartamentoUI } from 'src/app/demo/administracion/departamento/departamento.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import {
  DescuentoNivel,
  DescuentoUsuario,
  ModuloCatalogoUI,
  PrivilegioCatalogoUI,
  PuntoVentaUI,
  UsuarioPayload,
  UsuarioResponse,
  UsuarioUI
} from 'src/app/demo/administracion/usuarios/usuario.models';

interface ModuloAsignacion extends ModuloCatalogoUI {
  asignado: boolean;
}

interface DescuentoRow {
  id?: number;
  puntoVenta: string;
  descripcion: string;
  nivelId: number | null;
}

@Component({
  selector: 'app-usuario-propiedades',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './usuario-propiedades.component.html',
  styleUrls: ['./usuario-propiedades.component.scss']
})
export class UsuarioPropiedadesComponent implements OnInit {
  usuario = '';
  activeTab = 'info';
  departamentos: DepartamentoUI[] = [];

  infoForm!: FormGroup;
  isLoadingInfo = false;
  private usuarioInfo: UsuarioUI | null = null;

  modulos: ModuloAsignacion[] = [];
  modulosOriginal = new Map<string, boolean>();
  isLoadingModulos = false;
  isSavingModulos = false;

  moduloSeleccionado = '';
  privilegiosCatalogo: PrivilegioCatalogoUI[] = [];
  privilegiosAsignados = new Set<string>();
  isLoadingPrivilegios = false;

  puntosVentaCatalogo: PuntoVentaUI[] = [];
  puntosVentaUsuario: PuntoVentaUI[] = [];
  puntoVentaForm!: FormGroup;
  isLoadingPuntosVenta = false;

  nivelesDescuento: DescuentoNivel[] = [];
  descuentosUsuario: DescuentoUsuario[] = [];
  descuentosRows: DescuentoRow[] = [];
  isLoadingDescuentos = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private usuarioService: UsuarioService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.usuario = this.route.snapshot.paramMap.get('usuario') ?? '';
    this.initializeForms();
    this.loadInfo();
    this.loadModulos();
    this.loadPuntosVenta();
    this.loadNivelesDescuento();
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'privilegios' && this.moduloSeleccionado) {
      this.loadPrivilegios(this.moduloSeleccionado);
    }
    if (tab === 'descuentos') {
      this.buildDescuentoRows();
    }
  }

  private initializeForms(): void {
    this.infoForm = this.fb.group({
      nombre: ['', [Validators.required]],
      departamento: [null, [Validators.required]],
      telefono: [''],
      correo: ['', [Validators.email]]
    });

    this.puntoVentaForm = this.fb.group({
      puntoVenta: [null, [Validators.required]]
    });
  }

  loadInfo(): void {
    if (!this.usuario) {
      return;
    }
    this.isLoadingInfo = true;
    forkJoin({
      departamentos: this.departamentoService.getAll(),
      usuario: this.usuarioService.getUsuarioById(this.usuario)
    }).subscribe({
      next: (result) => {
        this.departamentos = result.departamentos ?? [];
        this.patchInfoForm(result.usuario);
        this.isLoadingInfo = false;
      },
      error: (error) => {
        console.error('Error al cargar info de usuario:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar la informacion del usuario.',
          icon: 'error'
        });
        this.isLoadingInfo = false;
      }
    });
  }

  private patchInfoForm(usuario: UsuarioUI): void {
    this.usuarioInfo = usuario;
    this.infoForm.patchValue({
      nombre: usuario.nombreUsu,
      departamento: usuario.departamento,
      telefono: usuario.telefono,
      correo: usuario.correo
    });
  }

  guardarInfo(): void {
    if (this.infoForm.invalid || !this.usuario) {
      this.infoForm.markAllAsTouched();
      return;
    }

    const raw = this.infoForm.getRawValue();
    const payload: UsuarioPayload = {
      tipo: 2,
      usuario: this.usuario,
      nombreUsu: raw.nombre,
      departamento: Number(raw.departamento),
      telefono: raw.telefono || '',
      correo: raw.correo || '',
      clave: this.usuarioInfo?.clave || '',
      pntVenta: this.usuarioInfo?.pntVenta ?? 0,
      passPntVenta: this.usuarioInfo?.passPntVenta || '',
      operador: '',
      respuesta: '',
      pageNumber: 0,
      pageSize: 0
    };

    this.isLoadingInfo = true;
    this.usuarioService.actualizarUsuario(payload).subscribe({
      next: (response: UsuarioResponse) => {
        const message = response?.respuesta || 'Informacion actualizada correctamente.';
        if (this.usuarioInfo) {
          this.usuarioInfo = {
            ...this.usuarioInfo,
            nombreUsu: raw.nombre,
            departamento: Number(raw.departamento),
            telefono: raw.telefono || '',
            correo: raw.correo || ''
          };
        }
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        });
        this.isLoadingInfo = false;
      },
      error: (error) => {
        console.error('Error al actualizar info:', error);
        const errorMsg = error?.error?.respuesta || 'Error al actualizar la informacion.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
        this.isLoadingInfo = false;
      }
    });
  }

  loadModulos(): void {
    if (!this.usuario) {
      return;
    }
    this.isLoadingModulos = true;
    forkJoin({
      catalogo: this.usuarioService.getCatalogoModulos(),
      asignados: this.usuarioService.getModulosUsuario(this.usuario)
    }).subscribe({
      next: (result) => {
        const asignadosSet = new Set((result.asignados ?? []).map((item) => item.codigo));
        this.modulos = (result.catalogo ?? []).map((item) => ({
          ...item,
          asignado: asignadosSet.has(item.codigo)
        }));
        this.modulosOriginal = new Map(this.modulos.map((item) => [item.codigo, item.asignado]));
        this.isLoadingModulos = false;
      },
      error: (error) => {
        console.error('Error al cargar modulos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los modulos.',
          icon: 'error'
        });
        this.isLoadingModulos = false;
      }
    });
  }

  guardarModulos(): void {
    if (!this.usuario) {
      return;
    }
    const operaciones = [];
    this.modulos.forEach((modulo) => {
      const asignadoAntes = this.modulosOriginal.get(modulo.codigo) ?? false;
      if (modulo.asignado !== asignadoAntes) {
        if (modulo.asignado) {
          operaciones.push(this.usuarioService.asignarModulo(this.usuario, modulo.codigo));
        } else {
          operaciones.push(this.usuarioService.quitarModulo(this.usuario, modulo.codigo));
        }
      }
    });

    if (operaciones.length === 0) {
      Swal.fire({
        title: 'Sin cambios',
        text: 'No hay cambios pendientes en modulos.',
        icon: 'info'
      });
      return;
    }

    this.isSavingModulos = true;
    forkJoin(operaciones).subscribe({
      next: () => {
        this.modulosOriginal = new Map(this.modulos.map((item) => [item.codigo, item.asignado]));
        Swal.fire({
          title: 'Exito',
          text: 'Modulos actualizados correctamente.',
          icon: 'success'
        });
        this.isSavingModulos = false;
      },
      error: (error) => {
        console.error('Error al guardar modulos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron guardar los cambios de modulos.',
          icon: 'error'
        });
        this.isSavingModulos = false;
      }
    });
  }

  loadPrivilegios(modulo: string): void {
    if (!this.usuario || !modulo) {
      return;
    }
    this.isLoadingPrivilegios = true;
    forkJoin({
      catalogo: this.usuarioService.getPrivilegiosModulo(modulo),
      asignados: this.usuarioService.getPrivilegiosUsuario(this.usuario, modulo)
    }).subscribe({
      next: (result) => {
        this.privilegiosCatalogo = result.catalogo ?? [];
        this.privilegiosAsignados = new Set(result.asignados ?? []);
        this.isLoadingPrivilegios = false;
      },
      error: (error) => {
        console.error('Error al cargar privilegios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los privilegios.',
          icon: 'error'
        });
        this.isLoadingPrivilegios = false;
      }
    });
  }

  onModuloPrivilegiosChange(): void {
    this.privilegiosCatalogo = [];
    this.privilegiosAsignados.clear();
    if (this.moduloSeleccionado) {
      this.loadPrivilegios(this.moduloSeleccionado);
    }
  }

  togglePrivilegio(privilegio: PrivilegioCatalogoUI, checked: boolean): void {
    if (!this.usuario || !this.moduloSeleccionado) {
      return;
    }
    const request$ = checked
      ? this.usuarioService.asignarPrivilegio(this.usuario, this.moduloSeleccionado, privilegio.id)
      : this.usuarioService.quitarPrivilegio(this.usuario, privilegio.id, this.moduloSeleccionado);

    request$.subscribe({
      next: () => {
        if (checked) {
          this.privilegiosAsignados.add(privilegio.id);
        } else {
          this.privilegiosAsignados.delete(privilegio.id);
        }
      },
      error: (error) => {
        console.error('Error al actualizar privilegio:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo actualizar el privilegio.',
          icon: 'error'
        });
      }
    });
  }

  loadPuntosVenta(): void {
    if (!this.usuario) {
      return;
    }
    this.isLoadingPuntosVenta = true;
    forkJoin({
      catalogo: this.usuarioService.getPuntosVenta(),
      asignados: this.usuarioService.getPuntosVentaUsuario(this.usuario)
    }).subscribe({
      next: (result) => {
        this.puntosVentaCatalogo = result.catalogo ?? [];
        this.puntosVentaUsuario = result.asignados ?? [];
        this.buildDescuentoRows();
        this.isLoadingPuntosVenta = false;
      },
      error: (error) => {
        console.error('Error al cargar puntos de venta:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los puntos de venta.',
          icon: 'error'
        });
        this.isLoadingPuntosVenta = false;
      }
    });
  }

  agregarPuntoVenta(): void {
    if (this.puntoVentaForm.invalid || !this.usuario) {
      this.puntoVentaForm.markAllAsTouched();
      return;
    }
    const puntoVenta = this.puntoVentaForm.getRawValue().puntoVenta;
    if (!puntoVenta) {
      return;
    }
    const exists = this.puntosVentaUsuario.some((pv) => pv.codigo === puntoVenta);
    if (exists) {
      Swal.fire({
        title: 'Duplicado',
        text: 'El punto de venta ya esta asignado.',
        icon: 'info'
      });
      return;
    }

    this.usuarioService.asignarPuntoVenta(this.usuario, puntoVenta).subscribe({
      next: () => {
        this.puntoVentaForm.reset();
        this.loadPuntosVenta();
      },
      error: (error) => {
        console.error('Error al asignar punto de venta:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo asignar el punto de venta.',
          icon: 'error'
        });
      }
    });
  }

  quitarPuntoVenta(puntoVenta: PuntoVentaUI): void {
    if (!this.usuario) {
      return;
    }
    this.usuarioService.quitarPuntoVenta(this.usuario, puntoVenta.codigo).subscribe({
      next: () => {
        this.loadPuntosVenta();
      },
      error: (error) => {
        console.error('Error al quitar punto de venta:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo quitar el punto de venta.',
          icon: 'error'
        });
      }
    });
  }

  loadNivelesDescuento(): void {
    this.usuarioService.getNivelesDescuento().subscribe({
      next: (niveles) => {
        this.nivelesDescuento = niveles ?? [];
        this.loadDescuentosUsuario();
      },
      error: (error) => {
        console.error('Error al cargar niveles de descuento:', error);
      }
    });
  }

  loadDescuentosUsuario(): void {
    if (!this.usuario) {
      return;
    }
    this.isLoadingDescuentos = true;
    this.usuarioService.getDescuentosUsuario(this.usuario).subscribe({
      next: (descuentos) => {
        this.descuentosUsuario = descuentos ?? [];
        this.buildDescuentoRows();
        this.isLoadingDescuentos = false;
      },
      error: (error) => {
        console.error('Error al cargar descuentos:', error);
        this.isLoadingDescuentos = false;
      }
    });
  }

  buildDescuentoRows(): void {
    if (this.puntosVentaUsuario.length === 0) {
      this.descuentosRows = [];
      return;
    }
    this.descuentosRows = this.puntosVentaUsuario.map((pv) => {
      const encontrado = this.descuentosUsuario.find((item) => item.puntoVenta === pv.codigo);
      return {
        id: encontrado?.id,
        puntoVenta: pv.codigo,
        descripcion: pv.descripcion,
        nivelId: encontrado?.nivelId ?? null
      };
    });
  }

  guardarDescuento(row: DescuentoRow): void {
    if (!this.usuario) {
      return;
    }
    if (!row.nivelId) {
      Swal.fire({
        title: 'Validacion',
        text: 'Seleccione un nivel de descuento.',
        icon: 'warning'
      });
      return;
    }
    this.usuarioService
      .guardarDescuentoUsuario(this.usuario, { puntoVenta: row.puntoVenta, nivelId: row.nivelId })
      .subscribe({
        next: () => {
          Swal.fire({
            title: 'Exito',
            text: 'Descuento guardado correctamente.',
            icon: 'success'
          });
          this.loadDescuentosUsuario();
        },
        error: (error) => {
          console.error('Error al guardar descuento:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo guardar el descuento.',
            icon: 'error'
          });
        }
      });
  }

  eliminarDescuento(row: DescuentoRow): void {
    if (!this.usuario || !row.id) {
      return;
    }
    this.usuarioService.eliminarDescuentoUsuario(this.usuario, row.id).subscribe({
      next: () => {
        this.loadDescuentosUsuario();
      },
      error: (error) => {
        console.error('Error al eliminar descuento:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo eliminar el descuento.',
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/usuarios']);
  }
}
