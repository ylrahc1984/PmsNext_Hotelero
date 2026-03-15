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
        loadComponent: () => import('./demo/reservas/list/reservas.component').then((c) => c.ReservasComponent)
      },
      {
        path: 'ordenes-trabajo',
        loadComponent: () => import('./demo/ordenes/ordenes.component').then((c) => c.OrdenesComponent)
      },
      {
        path: 'operacion-diaria',
        loadComponent: () => import('./operaciones/operacion-diaria/operacion-diaria.component').then((c) => c.OperacionDiariaComponent)
      },
      {
        path: 'lista-pickup',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup.component').then((c) => c.ListaPickupComponent)
      },
      {
        path: 'lista-pickup/nuevo',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup-form.component').then((c) => c.ListaPickupFormComponent)
      },
      {
        path: 'lista-pickup/:id/editar',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup-form.component').then((c) => c.ListaPickupFormComponent)
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
        path: 'ordenes-trabajo/:id/detalle',
        loadComponent: () => import('./demo/ordenes/orden-detalle.component').then((c) => c.OrdenDetalleComponent)
      },
      {
        path: 'reservas/nueva',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/create/reserva-create.component').then((c) => c.ReservaCreateComponent)
      },
      {
        path: 'reservas/nueva-v2',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/create/v2/reserva-create-v2.component').then((c) => c.ReservaCreateV2Component)
      },
      {
        path: 'reservas/:id/editar-v2',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/create/v2/reserva-create-v2.component').then((c) => c.ReservaCreateV2Component)
      },
      {
        path: 'reservas/:id/editar',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () => import('./demo/reservas/create/v2/reserva-create-v2.component').then((c) => c.ReservaCreateV2Component)
      },
      {
        path: 'reservas/:id/detalle',
        loadComponent: () => import('./demo/reservas/detalle/reserva-detalle.component').then((c) => c.ReservaDetalleComponent)
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
    path: 'ordenes-trabajo/:id/detalle',
    redirectTo: 'operaciones/ordenes-trabajo/:id/detalle',
    pathMatch: 'full'
  },
  {
    path: 'operacion-diaria',
    redirectTo: 'operaciones/operacion-diaria',
    pathMatch: 'full'
  },
  {
    path: 'comercial',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'servicios',
        redirectTo: '/catalogos/servicios',
        pathMatch: 'full'
      },
      {
        path: 'servicios/nuevo',
        redirectTo: '/catalogos/servicios/nuevo',
        pathMatch: 'full'
      },
      {
        path: 'servicios/editar/:codReceta',
        redirectTo: '/catalogos/servicios/editar/:codReceta',
        pathMatch: 'full'
      },
      {
        path: 'listas-precios',
        redirectTo: '/catalogos/listas-precios',
        pathMatch: 'full'
      },
      {
        path: 'listas-precios/asignaciones',
        redirectTo: '/catalogos/listas-precios/asignaciones',
        pathMatch: 'full'
      },
      {
        path: 'listas-precios/nuevo',
        redirectTo: '/catalogos/listas-precios/nuevo',
        pathMatch: 'full'
      },
      {
        path: 'listas-precios/:id/editar',
        redirectTo: '/catalogos/listas-precios/:id/editar',
        pathMatch: 'full'
      },
      {
        path: 'listas-precios/:id/detalle',
        redirectTo: '/catalogos/listas-precios/:id/detalle',
        pathMatch: 'full'
      },
      {
        path: 'detalle-lista-precio-v2/:codLstPrecio',
        redirectTo: '/catalogos/detalle-lista-precio-v2/:codLstPrecio',
        pathMatch: 'full'
      },
      {
        path: 'agencias',
        redirectTo: '/catalogos/clientes',
        pathMatch: 'full'
      },
      {
        path: 'agencias/nuevo',
        redirectTo: '/catalogos/clientes/nuevo',
        pathMatch: 'full'
      },
      {
        path: 'agencias/:codigo/editar',
        redirectTo: '/catalogos/clientes/:codigo/editar',
        pathMatch: 'full'
      },
      {
        path: 'agencias/:codigo/detalle',
        redirectTo: '/catalogos/clientes/:codigo/detalle',
        pathMatch: 'full'
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
      },
      {
        path: 'ordenes-pedido',
        redirectTo: '/demo/ordenes-pedido',
        pathMatch: 'full'
      },
      {
        path: 'ordenes-pedido/nuevo',
        redirectTo: '/demo/ordenes-pedido/nuevo',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'demo',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'ordenes-pedido',
        loadComponent: () =>
          import('./demo/orden-pedido/pages/orden-pedido-list/orden-pedido-list.component').then((c) => c.OrdenPedidoListComponent)
      },
      {
        path: 'ordenes-pedido/nuevo',
        loadComponent: () =>
          import('./demo/orden-pedido/pages/orden-pedido-form/orden-pedido-form.component').then((c) => c.OrdenPedidoFormComponent)
      }
    ]
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
    path: 'cuentas-cobrar',
    redirectTo: 'finanzas/cuentas-cobrar',
    pathMatch: 'full'
  },
  {
    path: 'cuentas-pagar',
    redirectTo: 'finanzas/cuentas-pagar',
    pathMatch: 'full'
  },
  {
    path: 'bancos/retiros-cxp',
    redirectTo: 'finanzas/bancos/retiros-cxp',
    pathMatch: 'full'
  },
  {
    path: 'bancos/depositos-cxc',
    redirectTo: 'finanzas/bancos/depositos-cxc',
    pathMatch: 'full'
  },
  {
    path: 'bancos/retiros-cxp/nuevo',
    redirectTo: 'finanzas/bancos/retiros-cxp/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'bancos/depositos-cxc/nuevo',
    redirectTo: 'finanzas/bancos/depositos-cxc/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'bancos/retiros-cxp/:idOperacion/editar',
    redirectTo: 'finanzas/bancos/retiros-cxp/:idOperacion/editar',
    pathMatch: 'full'
  },
  {
    path: 'bancos/depositos-cxc/:idOperacion/editar',
    redirectTo: 'finanzas/bancos/depositos-cxc/:idOperacion/editar',
    pathMatch: 'full'
  },
  {
    path: 'bancos/retiros-cxp/:idOperacion',
    redirectTo: 'finanzas/bancos/retiros-cxp/:idOperacion',
    pathMatch: 'full'
  },
  {
    path: 'bancos/depositos-cxc/:idOperacion',
    redirectTo: 'finanzas/bancos/depositos-cxc/:idOperacion',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'finanzas',
    loadChildren: () => import('./finanzas/finanzas.module').then((m) => m.FinanzasModule)
  },
  {
    path: 'servicios',
    redirectTo: 'catalogos/servicios',
    pathMatch: 'full'
  },
  {
    path: 'servicios/nuevo',
    redirectTo: 'catalogos/servicios/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'servicios/editar/:codReceta',
    redirectTo: 'catalogos/servicios/editar/:codReceta',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    path: 'catalogos',
    component: AdminComponent,
    children: [
      {
        path: 'servicios',
        loadComponent: () => import('./demo/catalogos/servicios/servicios.component').then((c) => c.ServiciosComponent)
      },
      {
        path: 'servicios/nuevo',
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      },
      {
        path: 'servicios/editar/:codReceta',
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      },
      {
        path: 'listas-precios',
        loadComponent: () => import('./demo/catalogos/listas-precios/listas-precios.component').then((c) => c.ListasPreciosComponent)
      },
      {
        path: 'listas-precios/asignaciones',
        loadComponent: () =>
          import('./demo/catalogos/listas-precios/listas-precios-asignaciones.component').then((c) => c.ListasPreciosAsignacionesComponent)
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
        path: 'detalle-lista-precio-v2/:codLstPrecio',
        loadComponent: () => import('./demo/catalogos/listas-precios/detalle-lista-precio-v2.component').then((c) => c.DetalleListaPrecioV2Component)
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
        path: 'lista-pickup',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup.component').then((c) => c.ListaPickupComponent)
      },
      {
        path: 'lista-pickup/nuevo',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup-form.component').then((c) => c.ListaPickupFormComponent)
      },
      {
        path: 'lista-pickup/:id/editar',
        loadComponent: () => import('./demo/catalogos/lista-pickup/lista-pickup-form.component').then((c) => c.ListaPickupFormComponent)
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
          path: 'producto-list',
          loadComponent: () => import('./demo/compras/producto-list/producto-list.component').then((c) => c.ProductoListComponent)
        },
        {
          path: 'servicios',
          loadComponent: () => import('./demo/compras/servicios/servicios.component').then((c) => c.ServiciosComprasComponent)
        },
        {
          path: 'producto-form',
          loadComponent: () => import('./demo/compras/producto-form/producto-form.component').then((c) => c.ProductoFormComponent)
        },
        {
          path: 'producto-form/:codProducto',
          loadComponent: () => import('./demo/compras/producto-form/producto-form.component').then((c) => c.ProductoFormComponent)
        },
        {
          path: 'configuracion',
          loadComponent: () => import('./demo/compras/configuracion/configuracion.component').then((c) => c.ConfiguracionComprasComponent)
        },
        {
          path: 'linea-producto',
          loadComponent: () => import('./demo/compras/linea-producto/linea-producto.component').then((c) => c.LineaProductoComponent)
        },
        {
          path: 'categoria-producto',
          loadComponent: () => import('./demo/compras/categoria-producto/categoria-producto.component').then((c) => c.CategoriaProductoComponent)
        },
        {
          path: 'almacen',
          loadComponent: () => import('./demo/compras/almacen/almacen.component').then((c) => c.AlmacenComponent)
        },
        {
          path: 'ordenes-compra',
          loadComponent: () =>
            import('./demo/compras/ordenes-compra/ordenes-compra.component').then((c) => c.OrdenesCompraComponent)
        },
      {
        path: 'recepcion-facturas',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/recepcion-facturas.component').then((c) => c.RecepcionFacturasComponent)
      },
      {
        path: 'recepcion-facturas/nueva-compra-articulos',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/nueva-compra-articulos/nueva-compra-articulos.component').then(
            (c) => c.NuevaCompraArticulosComponent
          )
      },
      {
        path: 'recepcion-facturas/nueva-compra-servicios',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/nueva-compra-servicios/nueva-compra-servicios.component').then(
            (c) => c.NuevaCompraServiciosComponent
          )
      },
      {
        path: 'recepcion-facturas/editar/:tipDocu/:numDocu',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/nueva-compra-servicios/nueva-compra-servicios.component').then(
            (c) => c.NuevaCompraServiciosComponent
          )
      },
      {
        path: 'recepcion-facturas/editar-articulo/:tipDocu/:numDocu',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/nueva-compra-articulos/nueva-compra-articulos.component').then(
            (c) => c.NuevaCompraArticulosComponent
          )
      },
      {
        path: 'recepcion-facturas/detalle/:tipDocu/:numDocu',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/compra-servicio-detalle/compra-servicio-detalle.component').then(
            (c) => c.CompraServicioDetalleComponent
          )
      },
      {
        path: 'recepcion-facturas/detalle-articulo/:tipDocu/:numDocu',
        loadComponent: () =>
          import('./demo/compras/recepcion-facturas/compra-articulo-detalle/compra-articulo-detalle.component').then(
            (c) => c.CompraArticuloDetalleComponent
          )
      },
      {
        path: 'historia-pagos',
        loadComponent: () =>
          import('./demo/compras/historia-pagos/historia-pagos.component').then((c) => c.HistoriaPagosComponent)
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
    redirectTo: 'comercial/suplidores',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/nuevo',
    redirectTo: 'comercial/suplidores/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/editar/:codSuplidor',
    redirectTo: 'comercial/suplidores/editar/:codSuplidor',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores',
    redirectTo: 'comercial/suplidores',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores/nuevo',
    redirectTo: 'comercial/suplidores/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'catalogos/suplidores/editar/:codSuplidor',
    redirectTo: 'comercial/suplidores/editar/:codSuplidor',
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
    redirectTo: 'finanzas/recibos',
    pathMatch: 'full'
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
        path: 'operaciones',
        loadComponent: () => import('./demo/reportes/reservas/reservas.component').then((c) => c.ReservasComponent)
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./demo/reportes/ingresos/ingresos.component').then((c) => c.IngresosComponent)
      },
      {
        path: 'comercial',
        loadComponent: () => import('./demo/reportes/ventas/ventas.component').then((c) => c.VentasComponent)
      },
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
