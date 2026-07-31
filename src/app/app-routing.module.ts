import { NgModule } from '@angular/core';
import { Data, Route, Routes, RouterModule } from '@angular/router';

// project import
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { ModuleAccessGuard } from './core/guards/module-access.guard';
import { CanDeactivateReservaCreateGuard } from './core/guards/can-deactivate-reserva-create.guard';

const loadPmsPlaceholder = () => import('./pages/pms-placeholder/pms-placeholder.component').then((c) => c.PmsPlaceholderComponent);

const reservasSectionUrls: Record<string, string> = {
  'Consulta de Reservas': '/reservas/consulta-reservas',
  'Tarifas y Planes': '/reservas/tarifas-planes',
  'Clientes / Facturación': '/reservas/clientes'
};

const reservasBreadcrumbData = (title: string, section?: string, extra: Data = {}): Data => ({
  ...extra,
  breadcrumbTrail: [
    { title: 'Reservas', url: '/reservas/calendario' },
    ...(section ? [{ title: section, url: reservasSectionUrls[section] || '/reservas/calendario' }] : []),
    { title }
  ]
});

const pmsPlaceholderChildRoutes = (module: string, entries: Array<[string, string]>): Routes =>
  entries.map(([path, title]) => ({
    path,
    loadComponent: loadPmsPlaceholder,
    data: { module, title }
  }));

const pmsPlaceholderSection = (path: string, module: string, entries: Array<[string, string]>): Route => ({
  path,
  component: AdminComponent,
  canActivate: [AuthGuard],
  canActivateChild: [AuthGuard],
  children: pmsPlaceholderChildRoutes(module, entries)
});

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
      },
      {
        path: 'indicadores-operativos',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Dashboard', title: 'Indicadores Operativos' }
      },
      {
        path: 'alertas-sistema',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Dashboard', title: 'Alertas del Sistema' }
      }
    ]
  },
  {
    path: 'front-desk',
    canMatch: [ModuleAccessGuard],
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['FRONT'] },
    loadChildren: () => import('./modules/front-desk/front-desk.routes').then((m) => m.FRONT_DESK_ROUTES)
  },
  {
    path: 'operacion',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () => import('./modules/operacion/cierre-diario/cierre-diario.routes').then((m) => m.CIERRE_DIARIO_ROUTES)
  },
  {
    path: 'hotel',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'listas-precios/:codListaPrecio',
        loadComponent: () =>
          import('./demo/catalogos/listas-precios/lista-precio-detalle-hotel.component').then(
            (c) => c.ListaPrecioDetalleHotelComponent
          )
      }
    ]
  },
  {
    path: 'housekeeping',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'panel-limpieza',
        loadComponent: () =>
          import('./modules/housekeeping/panel-limpieza/panel-limpieza.component').then((c) => c.PanelLimpiezaComponent)
      },
      ...pmsPlaceholderChildRoutes('Housekeeping', [
        ['estado-habitaciones', 'Estado de Habitaciones'],
        ['asignacion-camareras', 'Asignación de Camareras'],
        ['supervision', 'Supervisión de Limpieza']
      ])
    ]
  },
  {
    path: 'restaurante',
    component: AdminComponent,
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['PNTVT', 'PVTCH'], moduleAccessMode: 'any' },
    children: [
      {
        path: 'analysis',
        loadChildren: () => import('./modules/restaurante/analysis/analysis.routes').then((routes) => routes.ANALYSIS_ROUTES)
      },
      ...pmsPlaceholderChildRoutes('Restaurante', [
        ['dashboard', 'Dashboard Restaurante'],
        ['mesas', 'Mesas / Salones'],
        ['nuevo-pedido', 'Nuevo Pedido'],
        ['comandador', 'Comandador'],
        ['pedidos-activos', 'Pedidos Activos'],
        ['cocina-barra', 'Cocina / Barra'],
        ['productos', 'Menú de Productos'],
        ['saloneros', 'Saloneros']
      ]),
      {
        path: 'cargos-habitacion/detalle/:tipCrgHab/:numCrgHab',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cargos a Habitación', url: '/restaurante/cargos-habitacion' },
          { title: 'Detalle' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/cargos-habitacion-detalle/cargos-habitacion-detalle.component').then(
            (c) => c.CargosHabitacionDetalleComponent
          )
      },
      {
        path: 'cargos-habitacion',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cargos a Habitación' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/cargos-habitacion/cargos-habitacion.component').then(
            (c) => c.CargosHabitacionComponent
          )
      },
      {
        path: 'cargos-colaboradores/detalle/:tipOpe/:numOpe',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cargos a Colaboradores', url: '/restaurante/cargos-colaboradores' },
          { title: 'Detalle' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/cargos-colaboradores-detalle/cargos-colaboradores-detalle.component').then(
            (c) => c.CargosColaboradoresDetalleComponent
          )
      },
      {
        path: 'cargos-colaboradores',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cargos a Colaboradores' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/cargos-colaboradores/cargos-colaboradores.component').then(
            (c) => c.CargosColaboradoresComponent
          )
      },
      {
        path: 'facturacion',
        redirectTo: '/restaurant/puntos-venta',
        pathMatch: 'full'
      },
      {
        path: 'cierre-caja',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cierre de Caja' }
        ] },
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-list.component').then((c) => c.CierreCajaListComponent)
      },
      {
        path: 'cierre-caja/nuevo',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cierre de Caja', url: '/restaurante/cierre-caja' },
          { title: 'Nueva apertura' }
        ] },
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
      },
      {
        path: 'cierre-caja/:numCierre/detalle',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cierre de Caja', url: '/restaurante/cierre-caja' },
          { title: 'Detalle' }
        ] },
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-detalle.component').then((c) => c.CierreCajaDetalleComponent)
      },
      {
        path: 'cierre-caja/:id',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Cierre de Caja', url: '/restaurante/cierre-caja' },
          { title: 'Apertura' }
        ] },
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
      },
      {
        path: 'consulta-documentos',
        data: {
          origenConsulta: 'restaurante',
          breadcrumbTrail: [
            { title: 'Restaurante', url: '/restaurant/puntos-venta' },
            { title: 'Consulta de Documentos' }
          ]
        },
        loadComponent: () =>
          import('./finanzas/pages-factura/consulta-documentos/consulta-documentos.component').then(
            (c) => c.ConsultaDocumentosComponent
          )
      },
      {
        path: 'documento/:tipo/:serie/:numero',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Consulta de Documentos', url: '/restaurante/consulta-documentos' },
          { title: 'Detalle del Documento' }
        ] },
        loadComponent: () =>
          import('./finanzas/pages-factura/documento-detalle/documento-detalle.component').then((c) => c.DocumentoDetalleComponent)
      },
      {
        path: 'mesa/:id',
        loadComponent: () =>
          import('./demo/restaurante/restaurant-mesa-detalle/restaurant-mesa-detalle.component').then(
            (c) => c.RestaurantMesaDetalleComponent
          )
      },
      {
        path: 'configuracion',
        pathMatch: 'full',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/configuracion-restaurante/configuracion-restaurante.component').then(
            (c) => c.ConfiguracionRestauranteComponent
          )
      },
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
        path: 'agencias',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/agencias-comisionistas.component').then((c) => c.AgenciasComisionistasComponent)
      },
      {
        path: 'agencias/nuevo',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent)
      },
      {
        path: 'agencias/:codigo/editar',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent)
      },
      {
        path: 'agencias/:codigo/detalle',
        loadComponent: () => import('./demo/catalogos/agencias-comisionistas/cliente-form.component').then((c) => c.ClienteFormComponent),
        data: { readOnly: true }
      },
      {
        path: 'configuracion/categorias',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Categorías' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/categorias-restaurante/categorias-restaurante.component').then(
            (c) => c.CategoriasRestauranteComponent
          )
      },
      {
        path: 'configuracion/puntos-venta',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Puntos de Venta' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/puntos-venta-restaurante/puntos-venta-restaurante.component').then(
            (c) => c.PuntosVentaRestauranteComponent
          )
      },
      {
        path: 'configuracion/servicios',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Catálogo Comercial' }
        ] },
        loadComponent: () => import('./demo/catalogos/servicios/servicios.component').then((c) => c.ServiciosComponent)
      },
      {
        path: 'configuracion/servicios/nuevo',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Catálogo Comercial', url: '/restaurante/configuracion/servicios' },
          { title: 'Nuevo registro' }
        ] },
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      },
      {
        path: 'configuracion/servicios/editar/:codReceta',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Catálogo Comercial', url: '/restaurante/configuracion/servicios' },
          { title: 'Editar registro' }
        ] },
        loadComponent: () => import('./demo/catalogos/servicios/servicio-form.component').then((c) => c.ServicioFormComponent)
      },
      {
        path: 'configuracion/listas-precios',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Listas de Precios' }
        ] },
        loadComponent: () => import('./demo/catalogos/listas-precios/listas-precios.component').then((c) => c.ListasPreciosComponent)
      },
      {
        path: 'configuracion/listas-precios/asignaciones',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Listas de Precios', url: '/restaurante/configuracion/listas-precios' },
          { title: 'Asignaciones' }
        ] },
        loadComponent: () => import('./demo/catalogos/listas-precios/listas-precios-asignaciones.component').then((c) => c.ListasPreciosAsignacionesComponent)
      },
      {
        path: 'configuracion/listas-precios/nuevo',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Listas de Precios', url: '/restaurante/configuracion/listas-precios' },
          { title: 'Nueva lista' }
        ] },
        loadComponent: () => import('./demo/catalogos/listas-precios/lista-precio-form.component').then((c) => c.ListaPrecioFormComponent)
      },
      {
        path: 'configuracion/listas-precios/:id/editar',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Listas de Precios', url: '/restaurante/configuracion/listas-precios' },
          { title: 'Editar lista' }
        ] },
        loadComponent: () => import('./demo/catalogos/listas-precios/lista-precio-form.component').then((c) => c.ListaPrecioFormComponent)
      },
      {
        path: 'configuracion/listas-precios/:codListaPrecio/detalle',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
          { title: 'Listas de Precios', url: '/restaurante/configuracion/listas-precios' },
          { title: 'Detalle' }
        ] },
        loadComponent: () =>
          import('./demo/catalogos/listas-precios/lista-precio-detalle-hotel.component').then(
            (c) => c.ListaPrecioDetalleHotelComponent
          )
      },
      {
        path: 'configuracion/saloneros',
        loadComponent: loadPmsPlaceholder,
        data: {
          module: 'Restaurante',
          title: 'Saloneros',
          breadcrumbTrail: [
            { title: 'Restaurante', url: '/restaurant/puntos-venta' },
            { title: 'Configuración Restaurante', url: '/restaurante/configuracion' },
            { title: 'Saloneros' }
          ]
        }
      }
    ]
  },
  {
    path: 'restaurant',
    component: AdminComponent,
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['PNTVT', 'PVTCH'], moduleAccessMode: 'any' },
    children: [
      {
        path: '',
        redirectTo: 'puntos-venta',
        pathMatch: 'full'
      },
      {
        path: 'puntos-venta',
        data: { breadcrumbTrail: [
          { title: 'Restaurante' },
          { title: 'Facturación Restaurante' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/restaurant-punto-venta/restaurant-punto-venta.component').then(
            (c) => c.RestaurantPuntoVentaComponent
          )
      },
      {
        path: 'dashboard/:codPuntoVenta',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Facturación Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Mesas' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/restaurant-dashboard/restaurant-dashboard.component').then(
            (c) => c.RestaurantDashboardComponent
          )
      },
      {
        path: 'mesa/:id',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Facturación Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Detalle de Mesa' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/restaurant-mesa-detalle/restaurant-mesa-detalle.component').then(
            (c) => c.RestaurantMesaDetalleComponent
          )
      },
      {
        path: 'pos-productos/:id',
        data: { breadcrumbTrail: [
          { title: 'Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Facturación Restaurante', url: '/restaurant/puntos-venta' },
          { title: 'Detalle de Mesa' },
          { title: 'Productos' }
        ] },
        loadComponent: () =>
          import('./demo/restaurante/restaurant-pos-productos/restaurant-pos-productos.component').then(
            (c) => c.RestaurantPosProductosComponent
          )
      }
    ]
  },
  pmsPlaceholderSection('huespedes', 'Clientes / Huéspedes', [
    ['historial-estadias', 'Historial de Estadías'],
    ['preferencias', 'Preferencias'],
    ['documentos-identificacion', 'Documentos de Identificación'],
    ['crm', 'CRM de Huéspedes']
  ]),
  pmsPlaceholderSection('mantenimiento', 'Mantenimiento', [
    ['incidentes', 'Reporte de Incidentes'],
    ['ordenes', 'Órdenes de Mantenimiento'],
    ['preventivo', 'Mantenimiento Preventivo'],
    ['correctivo', 'Mantenimiento Correctivo'],
    ['habitaciones-fuera-servicio', 'Habitaciones Fuera de Servicio'],
    ['historial-reparaciones', 'Historial de Reparaciones']
  ]),
  {
    path: 'acerca-de-pmsnext',
    component: AdminComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/acerca-de-pmsnext/acerca-de-pmsnext.component').then((c) => c.AcercaDePmsnextComponent)
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
        path: 'forecast-actividades',
        loadComponent: () =>
          import('./operaciones/forecast-actividades/forecast-actividades.component').then((c) => c.ForecastActividadesComponent)
      },
      {
        path: 'centro-operacional',
        loadComponent: () =>
          import('./pages/operaciones/centro-operacional/centro-operacional.component').then((c) => c.CentroOperacionalComponent)
      },
      {
        path: 'cierre-caja',
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-list.component').then((c) => c.CierreCajaListComponent)
      },
      {
        path: 'cierre-caja/nuevo',
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
      },
      {
        path: 'cierre-caja/:numCierre/detalle',
        loadComponent: () =>
          import('./operaciones/cierre-caja/cierre-caja-detalle.component').then((c) => c.CierreCajaDetalleComponent)
      },
      {
        path: 'cierre-caja/:id',
        loadComponent: () => import('./operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
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
    path: 'reservas',
    component: AdminComponent,
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['RESER'] },
    children: [
      {
        path: 'calendario',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        data: reservasBreadcrumbData('Calendario de Reservas'),
        loadComponent: () => import('./modules/Reservas/calendar/pages/room-calendar-page.component').then((c) => c.RoomCalendarPageComponent)
      },
      {
        path: 'consulta-reservas',
        data: reservasBreadcrumbData('Consulta de Reservas'),
        loadComponent: () =>
          import('./modules/Reservas/consulta-reservas/consulta-reservas.component').then((c) => c.ConsultaReservasComponent)
      },
      {
        path: 'nueva-hospedaje',
        data: reservasBreadcrumbData('Nueva Reserva', 'Consulta de Reservas'),
        loadComponent: () =>
          import('./modules/Reservas/reserva-hospedaje/reserva-hospedaje.component').then((c) => c.ReservaHospedajeComponent)
      },
      {
        path: 'editar-hospedaje/:codReserva',
        data: reservasBreadcrumbData('Editar Reserva', 'Consulta de Reservas'),
        loadComponent: () =>
          import('./modules/Reservas/reserva-hospedaje/reserva-hospedaje.component').then((c) => c.ReservaHospedajeComponent)
      },
      {
        path: 'detalle-hospedaje/:codReserva',
        data: reservasBreadcrumbData('Detalle de Reserva', 'Consulta de Reservas'),
        loadComponent: () =>
          import('./modules/Reservas/reserva-hospedaje-detalle/reserva-hospedaje-detalle.component').then((c) => c.ReservaHospedajeDetalleComponent)
      },
      {
        path: 'forecast-ocupacion',
        redirectTo: '/front-desk/forecast-ocupacion',
        pathMatch: 'full'
      },
      {
        path: 'tarifas-planes',
        data: reservasBreadcrumbData('Tarifas y Planes'),
        loadComponent: () =>
          import('./modules/Reservas/tarifas-planes/tarifas-planes.component').then((c) => c.TarifasPlanesComponent)
      },
      {
        path: 'tarifas-planes/:codigo/detalle',
        data: reservasBreadcrumbData('Detalle de Tarifa', 'Tarifas y Planes'),
        loadComponent: () =>
          import('./modules/Reservas/detalle-tarifa/detalle-tarifa.component').then((c) => c.DetalleTarifaComponent)
      },
      {
        path: 'configuracion/agencias',
        data: reservasBreadcrumbData('Agencias / Canales'),
        loadComponent: () =>
          import('./modules/Reservas/agency-management/agency-management.component').then((c) => c.AgencyManagementComponent)
      },
      {
        path: 'clientes',
        data: reservasBreadcrumbData('Clientes / Facturación'),
        loadComponent: () =>
          import('./demo/catalogos/agencias-comisionistas/agencias-comisionistas.component').then((c) => c.AgenciasComisionistasComponent)
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
        path: 'disponibilidad',
        loadComponent: loadPmsPlaceholder,
        data: reservasBreadcrumbData('Disponibilidad', undefined, { module: 'Reservas', title: 'Disponibilidad' })
      }
    ]
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
      },
      {
        path: 'ordenes-pedido/detalle/:tipOrden/:serie/:numero',
        loadComponent: () =>
          import('./demo/orden-pedido/pages/orden-pedido-detalle/orden-pedido-detalle.component').then(
            (c) => c.OrdenPedidoDetalleComponent
          )
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
    canMatch: [ModuleAccessGuard],
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'comisiones',
    data: { requiredModules: ['BANCO', 'CONTA'], moduleAccessMode: 'any' },
    loadChildren: () => import('./pages/comisiones/comisiones.routes').then((m) => m.COMISIONES_ROUTES)
  },
  {
    canMatch: [ModuleAccessGuard],
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'finanzas',
    data: { requiredModules: ['BANCO', 'CONTA'], moduleAccessMode: 'any' },
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
        path: 'listas-precios/:codListaPrecio/detalle',
        loadComponent: () =>
          import('./demo/catalogos/listas-precios/lista-precio-detalle-hotel.component').then(
            (c) => c.ListaPrecioDetalleHotelComponent
          )
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
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['INVCO'] },
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
        path: 'compras-correo',
        loadComponent: () => import('./demo/compras/compras-correo/compras-correo.component').then((c) => c.ComprasCorreoComponent)
      },
      {
        path: 'compras-correo/:tipDocu/:numDocu/detalle',
        loadComponent: () =>
          import('./demo/compras/compras-correo/detalle/compras-correo-detalle.component').then(
            (c) => c.ComprasCorreoDetalleComponent
          )
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
    redirectTo: 'catalogos/suplidores',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/nuevo',
    redirectTo: 'catalogos/suplidores/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'suplidores/editar/:codSuplidor',
    redirectTo: 'catalogos/suplidores/editar/:codSuplidor',
    pathMatch: 'full'
  },
  {
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'usuarios',
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
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
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'usuario-cambiar-clave',
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
    children: [
      {
        path: ':usuario',
        loadComponent: () => import('./demo/administracion/usuarios/usuario-cambiar-clave/usuario-cambiar-clave.component').then((c) => c.UsuarioCambiarClaveComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'formas-pago',
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/forma-pago/formas-pago/formas-pago.component').then((c) => c.FormasPagoComponent)
      }
    ]
  },
  {
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'forma-pago-detalle',
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
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
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    path: 'correlativos',
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/administracion/correlativos/correlativos.component').then((c) => c.CorrelativosComponent)
      }
    ]
  },
  {
    path: 'monedas',
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    component: AdminComponent,
    data: { requiredModules: ['CONFI'] },
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
    canActivate: [AuthGuard, ModuleAccessGuard],
    canActivateChild: [AuthGuard],
    data: { requiredModules: ['CONFI'] },
    children: [
      {
        path: 'configuracion/migraciones/reservas',
        canDeactivate: [CanDeactivateReservaCreateGuard],
        loadComponent: () =>
          import('./demo/administracion/migracion-reservas/migracion-reservas.component').then(
            (c) => c.MigracionReservasComponent
          )
      },
      {
        path: 'configuracion/migraciones',
        loadComponent: () =>
          import('./demo/administracion/migraciones/migraciones.component').then((c) => c.MigracionesComponent)
      },
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
        path: 'roles-permisos',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Administración', title: 'Roles y Permisos' }
      },
      {
        path: 'catalogos-generales',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Administración', title: 'Catálogos Generales' }
      },
      {
        path: 'auditoria-sistema',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Administración', title: 'Auditoría del Sistema' }
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
        loadComponent: () => import('./demo/reportes/finanzas/finanzas.component').then((c) => c.FinanzasComponent)
      },
      {
        path: 'comercial',
        loadComponent: () => import('./demo/reportes/comercial/comercial.component').then((c) => c.ComercialComponent)
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
      },
      {
        path: 'restaurante',
        loadComponent: () => import('./demo/reportes/restaurante/restaurante.component').then((c) => c.RestauranteReporteComponent)
      },
      {
        path: 'ocupacion',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Reportes', title: 'Reportes de Ocupación' }
      },
      {
        path: 'housekeeping',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Reportes', title: 'Reportes de Housekeeping' }
      },
      {
        path: 'mantenimiento',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Reportes', title: 'Reportes de Mantenimiento' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
