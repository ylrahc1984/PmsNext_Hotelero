import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// project import
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { CanDeactivateReservaCreateGuard } from './core/guards/can-deactivate-reserva-create.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: GuestComponent,
    canActivate: [LoginGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/pages/authentication/auth-signin/auth-signin.component').then((c) => c.AuthSigninComponent)
      }
    ]
  },
  {
    path: 'register',
    component: GuestComponent,
    canActivate: [LoginGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/pages/authentication/auth-signup/auth-signup.component').then((c) => c.AuthSignupComponent)
      }
    ]
  },
  {
    path: 'dashboard',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/dashboard/dashboard.component').then((c) => c.DashboardComponent)
      }
    ]
  },
  {
    path: 'operaciones',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'reservas',
        loadComponent: () => import('./demo/reservas/reservas.component').then((c) => c.ReservasComponent)
      },
      {
        path: 'ordenes-trabajo',
        loadComponent: () => import('./demo/ordenes/ordenes.component').then((c) => c.OrdenesComponent)
      },
      {
        path: 'ordenes-trabajo/nueva',
        loadComponent: () => import('./demo/ordenes/orden-trabajo-form.component').then((c) => c.OrdenTrabajoFormComponent)
      },
      {
        path: 'ordenes-trabajo/:id/editar',
        loadComponent: () => import('./demo/ordenes/orden-trabajo-form.component').then((c) => c.OrdenTrabajoFormComponent)
      },
      {
        path: 'reservas/nueva',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/reserva-create.component').then((c) => c.ReservaCreateComponent)
      },
      {
        path: 'reservas/:id/editar',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/reserva-create.component').then((c) => c.ReservaCreateComponent)
      },
      {
        path: 'reservas/:id/detalle',
        loadComponent: () => import('./demo/reservas/reserva-detalle.component').then((c) => c.ReservaDetalleComponent)
      }
    ]
  },
  {
    path: 'reservas',
    redirectTo: 'operaciones/reservas',
    pathMatch: 'full'
  },
  {
    path: 'ordenes-trabajo',
    redirectTo: 'operaciones/ordenes-trabajo',
    pathMatch: 'full'
  },
  {
    path: 'ordenes-trabajo/nueva',
    redirectTo: 'operaciones/ordenes-trabajo/nueva',
    pathMatch: 'full'
  },
  {
    path: 'ordenes-trabajo/:id/editar',
    redirectTo: 'operaciones/ordenes-trabajo/:id/editar',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'clientes',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/clientes/clientes.component').then((c) => c.ClientesComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'cuentas-cobrar',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/contabilidad/cuentas-cobrar/cuentas-cobrar.component').then((c) => c.CuentasCobrarComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'cuentas-pagar',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/contabilidad/cuentas-pagar/cuentas-pagar.component').then((c) => c.CuentasPagarComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'facturas',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/contabilidad/facturas/facturas.component').then((c) => c.FacturasComponent)
      },
      {
        path: 'nueva',
        loadComponent: () => import('./demo/contabilidad/facturas/factura-form.component').then((c) => c.FacturaFormComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'servicios',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/catalogos/servicios/servicios.component').then((c) => c.ServiciosComponent)
      },
      {
        path: 'nuevo',
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      },
      {
        path: 'editar/:codReceta',
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'catalogos',
    component: AdminComponent,
    children: [
      {
        path: 'listas-precios',
        loadComponent: () => import('./demo/catalogos/listas-precios/listas-precios.component').then((c) => c.ListasPreciosComponent)
      },
      {
        path: 'listas-precios/nuevo',
        loadComponent: () => import('./demo/catalogos/listas-precios/lista-precio-form.component').then((c) => c.ListaPrecioFormComponent)
      },
      {
        path: 'listas-precios/:id/editar',
        loadComponent: () => import('./demo/catalogos/listas-precios/lista-precio-form.component').then((c) => c.ListaPrecioFormComponent)
      },
      {
        path: 'listas-precios/:id/detalle',
        loadComponent: () => import('./demo/catalogos/listas-precios/lista-precio-detalle.component').then((c) => c.ListaPrecioDetalleComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/agencias-comisionistas.component').then((c) => c.AgenciasComisionistasComponent)
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent)
      },
      {
        path: 'clientes/:codigo/editar',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent)
      },
      {
        path: 'clientes/:codigo/detalle',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent),
        data: { readOnly: true }
      },
      {
        path: 'suplidores',
        loadComponent: () => import('./demo/catalogos/suplidores/suplidores.component').then((c) => c.SuplidoresComponent)
      },
      {
        path: 'suplidores/nuevo',
        loadComponent: () => import('./demo/catalogos/suplidores/suplidor-form.component').then((c) => c.SuplidorFormComponent)
      },
      {
        path: 'suplidores/editar/:codSuplidor',
        loadComponent: () => import('./demo/catalogos/suplidores/suplidor-form.component').then((c) => c.SuplidorFormComponent)
      }
    ]
  },
  {
    path: 'compras',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'proveedores',
        loadComponent: () => import('./demo/compras/proveedores/proveedores.component').then((c) => c.ProveedoresComponent)
      },
      {
        path: 'proveedores/nuevo',
        loadComponent: () => import('./demo/compras/proveedores/proveedor-form.component').then((c) => c.ProveedorFormComponent)
      },
      {
        path: 'proveedores/editar/:codProve',
        loadComponent: () => import('./demo/compras/proveedores/proveedor-form.component').then((c) => c.ProveedorFormComponent)
      }
    ]
  },
  {
    path: 'agencias-comisionistas',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/agencias-comisionistas.component').then((c) => c.AgenciasComisionistasComponent)
      }
    ]
  },
  {
    path: 'suplidores',
    redirectTo: 'compras/proveedores',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/nuevo',
    redirectTo: 'compras/proveedores/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/editar/:codProve',
    redirectTo: 'compras/proveedores/editar/:codProve',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores',
    redirectTo: 'compras/proveedores',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores/nuevo',
    redirectTo: 'compras/proveedores/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores/editar/:codProve',
    redirectTo: 'compras/proveedores/editar/:codProve',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'usuarios',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/usuarios-list/usuarios-list.component').then((c) => c.UsuariosListComponent)
      },
      {
        path: 'nuevo',
        loadComponent: () => import('./demo/administracion/usuario-form/usuario-form.component').then((c) => c.UsuarioFormComponent)
      },
      {
        path: ':usuario/editar',
        loadComponent: () => import('./demo/administracion/usuario-form/usuario-form.component').then((c) => c.UsuarioFormComponent)
      },
      {
        path: ':usuario/propiedades',
        loadComponent: () =>
          import('./demo/administracion/usuarios/usuario-propiedades/usuario-propiedades.component').then((c) => c.UsuarioPropiedadesComponent)
      }
    ]
  },
  {
    path: 'usuarios-perfiles',
    redirectTo: 'usuarios',
    pathMatch: 'full'
  },
  {
    path: 'usuario-detalle',
    redirectTo: 'usuarios/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'usuario-detalle/:usuario',
    redirectTo: 'usuarios/:usuario/editar',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'usuario-cambiar-clave',
    component: AdminComponent,
    children: [
      {
        path: ':usuario',
        loadComponent: () => import('./demo/administracion/usuarios/usuario-cambiar-clave/usuario-cambiar-clave.component').then((c) => c.UsuarioCambiarClaveComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'formas-pago',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/forma-pago/formas-pago/formas-pago.component').then((c) => c.FormasPagoComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'forma-pago-detalle',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/forma-pago/forma-pago-detalle/forma-pago-detalle').then((c) => c.FormaPagoDetalleComponent)
     },
     {
       path: ':codigo',
       loadComponent: () => import('./demo/administracion/forma-pago/forma-pago-detalle/forma-pago-detalle').then((c) => c.FormaPagoDetalleComponent)
     }
    ]
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'correlativos',
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/correlativos/correlativos.component').then((c) => c.CorrelativosComponent)
      }
    ]
  },
  {
    path: 'monedas',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    component: AdminComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/monedas/monedas.component').then((c) => c.MonedasComponent)
      }
    ]
  },
  {
    path: 'tipo-cambio',
    redirectTo: 'administracion/tipo-cambio',
    pathMatch: 'full'
  },
  {
    path: 'recibos',
    component: AdminComponent,
    children: [
      {
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        path: '',
        loadComponent: () => import('./demo/contabilidad/recibos/recibos.component').then((c) => c.RecibosComponent)
      }
    ]
  },
  {
    path: 'administracion',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'configuracion',
        loadComponent: () => import('./demo/administracion/configuracion-sistema/configuracion-sistema.component').then((c) => c.ConfiguracionSistemaComponent)
      },
      {
        path: 'configuracion/impuestos/nuevo',
        loadComponent: () => import('./demo/administracion/impuesto/impuesto-detalle/impuesto-detalle.component').then((c) => c.ImpuestoDetalleComponent)
      },
      {
        path: 'configuracion/impuestos/editar/:codigo',
        loadComponent: () => import('./demo/administracion/impuesto/impuesto-detalle/impuesto-detalle.component').then((c) => c.ImpuestoDetalleComponent)
      },
      {
        path: 'configuracion/impuestos',
        loadComponent: () => import('./demo/administracion/impuesto/impuesto/impuesto.component').then((c) => c.ImpuestoComponent)
      },
      {
        path: 'configuracion/departamentos/nuevo',
        loadComponent: () => import('./demo/administracion/departamento/departamento-detalle/departamento-detalle.component').then((c) => c.DepartamentoDetalleComponent)
      },
      {
        path: 'configuracion/departamentos/editar/:idDepartamento',
        loadComponent: () => import('./demo/administracion/departamento/departamento-detalle/departamento-detalle.component').then((c) => c.DepartamentoDetalleComponent)
      },
      {
        path: 'configuracion/departamentos',
        loadComponent: () => import('./demo/administracion/departamento/departamento/departamento.component').then((c) => c.DepartamentoComponent)
      },
      {
        path: 'configuracion/centrocosto/nuevo',
        loadComponent: () => import('./demo/administracion/centro-costo/centro-costo-detalle/centro-costo-detalle.component').then((c) => c.CentroCostoDetalleComponent)
      },
      {
        path: 'configuracion/centrocosto/editar/:codGrupo',
        loadComponent: () => import('./demo/administracion/centro-costo/centro-costo-detalle/centro-costo-detalle.component').then((c) => c.CentroCostoDetalleComponent)
      },
      {
        path: 'configuracion/centrocosto',
        loadComponent: () => import('./demo/administracion/centro-costo/centro-costo/centro-costo.component').then((c) => c.CentroCostoComponent)
      },      {
        path: 'configuracion/contadores/nuevo',
        loadComponent: () => import('./demo/administracion/contadores/contador-detalle/contador-detalle.component').then((c) => c.ContadorDetalleComponent)
      },
      {
        path: 'configuracion/contadores/editar/:codigo',
        loadComponent: () => import('./demo/administracion/contadores/contador-detalle/contador-detalle.component').then((c) => c.ContadorDetalleComponent)
      },
      {
        path: 'configuracion/contadores',
        loadComponent: () => import('./demo/administracion/contadores/contador/contador.component').then((c) => c.ContadorComponent)
      },
      {
        path: 'configuracion/documento/nuevo',
        loadComponent: () =>
          import('./demo/administracion/documento/documento-form.component').then((c) => c.DocumentoFormComponent)
      },
      {
        path: 'configuracion/documento/editar/:codigo',
        loadComponent: () =>
          import('./demo/administracion/documento/documento-form.component').then((c) => c.DocumentoFormComponent)
      },
      {
        path: 'configuracion/documento',
        loadComponent: () =>
          import('./demo/administracion/documento/documento.component').then((c) => c.DocumentoComponent)
      },
      {
        path: 'configuracion/tipo-cliente/nuevo',
        loadComponent: () =>
          import('./demo/administracion/tipo-cliente/tipo-cliente-form.component').then((c) => c.TipoClienteFormComponent)
      },
      {
        path: 'configuracion/tipo-cliente/editar/:codTipo',
        loadComponent: () =>
          import('./demo/administracion/tipo-cliente/tipo-cliente-form.component').then((c) => c.TipoClienteFormComponent)
      },
      {
        path: 'configuracion/tipo-cliente',
        loadComponent: () =>
          import('./demo/administracion/tipo-cliente/tipo-cliente.component').then((c) => c.TipoClienteComponent)
      },
      {
        path: 'configuracion/unidad-medida/nuevo',
        loadComponent: () =>
          import('./demo/administracion/unidad-medida/unidad-medida-form.component').then((c) => c.UnidadMedidaFormComponent)
      },
      {
        path: 'configuracion/unidad-medida/editar/:codUMed',
        loadComponent: () =>
          import('./demo/administracion/unidad-medida/unidad-medida-form.component').then((c) => c.UnidadMedidaFormComponent)
      },
      {
        path: 'configuracion/unidad-medida',
        loadComponent: () =>
          import('./demo/administracion/unidad-medida/unidad-medida.component').then((c) => c.UnidadMedidaComponent)
      },
      {
        path: 'configuracion/parametros',
        loadComponent: () => import('./demo/administracion/configuracion-sistema/configuracion-sistema.component').then((c) => c.ConfiguracionSistemaComponent)
      },
      {
        path: 'tipo-cambio',
        loadComponent: () => import('./demo/administracion/tipo-cambio/tipo-cambio.component').then((c) => c.TipoCambioComponent)
      }
    ]
  },
  {
    path: 'reportes',
    component: AdminComponent,
    children: [
      {
        path: 'ventas',
        loadComponent: () => import('./demo/reportes/ventas/ventas.component').then((c) => c.VentasComponent)
      },
      {
        path: 'reservas',
        loadComponent: () => import('./demo/reportes/reservas/reservas.component').then((c) => c.ReservasComponent)
      },
      {
        path: 'ingresos',
        loadComponent: () => import('./demo/reportes/ingresos/ingresos.component').then((c) => c.IngresosComponent)
      },
      {
        path: 'comisiones',
        loadComponent: () => import('./demo/reportes/comisiones/comisiones.component').then((c) => c.ComisionesComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}




