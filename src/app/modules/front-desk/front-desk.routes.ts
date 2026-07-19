import { Data, Routes } from '@angular/router';

import { AdminComponent } from 'src/app/theme/layout/admin/admin.component';
import { RoomStayManagementComponent } from './pages/room-stay-management/room-stay-management.component';

const loadPmsPlaceholder = () => import('src/app/pages/pms-placeholder/pms-placeholder.component').then((c) => c.PmsPlaceholderComponent);

const frontDeskSectionUrls: Record<string, string> = {
  Habitaciones: '/front-desk/room-rack',
  'Cierre de Caja': '/front-desk/cierre-caja',
  'Consulta de Documentos': '/front-desk/consulta-documentos',
  'Notas de Crédito': '/front-desk/notas-credito',
  Configuraciones: '/front-desk/configuraciones'
};

const frontDeskData = (title: string, section?: string, extra: Data = {}): Data => ({
  ...extra,
  breadcrumbTrail: [
    { title: 'Front Desk', url: '/front-desk/room-rack' },
    ...(section ? [{ title: section, url: frontDeskSectionUrls[section] || '/front-desk/room-rack' }] : []),
    { title }
  ]
});

export const FRONT_DESK_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        redirectTo: 'room-rack',
        pathMatch: 'full'
      },
      {
        path: 'room-rack',
        data: frontDeskData('Habitaciones'),
        loadComponent: () => import('./pages/room-rack/room-rack.component').then((c) => c.RoomRackComponent)
      },
      {
        path: 'habitaciones-bloqueadas',
        data: frontDeskData('Habitaciones Bloqueadas'),
        loadComponent: () => import('./pages/blocked-rooms/blocked-rooms.component').then((c) => c.BlockedRoomsComponent)
      },
      {
        path: 'walk-in',
        data: frontDeskData('Nuevo Walk In', 'Habitaciones'),
        loadComponent: () => import('./walk-in/walk-in.component').then((c) => c.WalkInComponent)
      },
      {
        path: 'habitaciones/room-stay-management/:roomNumber',
        data: frontDeskData('Gestión de Estadía', 'Habitaciones'),
        component: RoomStayManagementComponent
      },
      {
        path: 'habitaciones',
        redirectTo: 'room-rack',
        pathMatch: 'full'
      },
      {
        path: 'habitaciones/estado',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Estado de Habitaciones', 'Habitaciones', { module: 'Front Desk / Habitaciones', title: 'Estado de Habitaciones' })
      },
      {
        path: 'habitaciones/rooming-asignaciones',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Rooming - Asignaciones', 'Habitaciones', { module: 'Front Desk / Habitaciones', title: 'Rooming - Asignaciones' })
      },
      {
        path: 'factura-directa',
        data: frontDeskData('Factura Directa', 'Habitaciones'),
        loadComponent: () =>
          import('src/app/finanzas/pages-factura/nueva-factura/nueva-factura/nueva-factura.component').then(
            (c) => c.NuevaFacturaComponent
          )
      },
      {
        path: 'rooming-asignaciones',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Rooming - Asignaciones', 'Habitaciones', { module: 'Front Desk', title: 'Rooming - Asignaciones' })
      },
      {
        path: 'arribos-dia',
        data: frontDeskData('Arribos del Día', 'Habitaciones'),
        loadComponent: () => import('./check-in-arrivals/check-in-arrivals.component').then((c) => c.CheckInArrivalsComponent)
      },
      {
        path: 'huespedes-in-house',
        data: frontDeskData('Huéspedes In House', 'Habitaciones'),
        loadComponent: () => import('./in-house-guests/in-house-guests.component').then((c) => c.InHouseGuestsComponent)
      },
      {
        path: 'pronostico-ocupacion',
        redirectTo: 'occupancy-forecast',
        pathMatch: 'full'
      },
      {
        path: 'occupancy-forecast',
        data: frontDeskData('Pronóstico de Ocupación'),
        loadComponent: () => import('./pages/occupancy-forecast/occupancy-forecast.component').then((c) => c.OccupancyForecastComponent)
      },
      {
        path: 'forecast-ocupacion',
        data: {
          breadcrumbTrail: [
            { title: 'Reservas', url: '/reservas/calendario' },
            { title: 'Forecast de Ocupación' }
          ]
        },
        loadComponent: () => import('./pages/forecast-ocupacion/forecast-ocupacion.component').then((c) => c.ForecastOcupacionComponent)
      },
      {
        path: 'estado-habitaciones',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Estado de Habitaciones', 'Habitaciones', { module: 'Front Desk', title: 'Estado de Habitaciones' })
      },
      {
        path: 'cierre-caja',
        data: frontDeskData('Cierre de Caja'),
        loadComponent: () => import('src/app/operaciones/cierre-caja/cierre-caja-list.component').then((c) => c.CierreCajaListComponent)
      },
      {
        path: 'cierre-caja/nuevo',
        data: frontDeskData('Nueva Apertura', 'Cierre de Caja'),
        loadComponent: () => import('src/app/operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
      },
      {
        path: 'cierre-caja/:numCierre/detalle',
        data: frontDeskData('Detalle', 'Cierre de Caja'),
        loadComponent: () =>
          import('src/app/operaciones/cierre-caja/cierre-caja-detalle.component').then((c) => c.CierreCajaDetalleComponent)
      },
      {
        path: 'cierre-caja/:id',
        data: frontDeskData('Gestión de Cierre', 'Cierre de Caja'),
        loadComponent: () => import('src/app/operaciones/cierre-caja/cierre-caja-form.component').then((c) => c.CierreCajaFormComponent)
      },
      {
        path: 'consulta-documentos',
        data: frontDeskData('Consulta de Documentos', undefined, { origenConsulta: 'front-desk' }),
        loadComponent: () =>
          import('src/app/finanzas/pages-factura/consulta-documentos/consulta-documentos.component').then(
            (c) => c.ConsultaDocumentosComponent
          )
      },
      {
        path: 'documento/:tipo/:serie/:numero',
        data: frontDeskData('Detalle del Documento', 'Consulta de Documentos'),
        loadComponent: () =>
          import('src/app/finanzas/pages-factura/documento-detalle/documento-detalle.component').then(
            (c) => c.DocumentoDetalleComponent
          )
      },
      {
        path: 'notas-credito',
        data: frontDeskData('Notas de Crédito'),
        loadComponent: () =>
          import('src/app/finanzas/nota-credito/notas-credito-consulta/notas-credito-consulta.component').then(
            (c) => c.NotasCreditoConsultaComponent
          )
      },
      {
        path: 'notas-credito/nueva',
        data: frontDeskData('Nueva Nota de Crédito', 'Notas de Crédito'),
        loadComponent: () =>
          import('src/app/finanzas/nota-credito/nueva-nota-credito/nueva-nota-credito.component').then(
            (c) => c.NuevaNotaCreditoComponent
          )
      },
      {
        path: 'notas-credito/detalle/:tipo/:serie/:numero',
        data: frontDeskData('Detalle', 'Notas de Crédito'),
        loadComponent: () =>
          import('src/app/finanzas/nota-credito/nota-credito-detalle/nota-credito-detalle.component').then(
            (c) => c.NotaCreditoDetalleComponent
          )
      },
      {
        path: 'configuraciones',
        data: frontDeskData('Configuraciones'),
        loadComponent: () => import('./pages/front-desk-settings/front-desk-settings.component').then((c) => c.FrontDeskSettingsComponent)
      },
      {
        path: 'configuraciones/tipos-habitacion',
        data: frontDeskData('Tipos de Habitaciones', 'Configuraciones'),
        loadComponent: () => import('./settings/room-types/room-types.component').then((c) => c.RoomTypesComponent)
      },
      {
        path: 'configuraciones/categorias',
        data: frontDeskData('Categorías de Habitaciones', 'Configuraciones'),
        loadComponent: () => import('./settings/room-categories/room-categories.component').then((c) => c.RoomCategoriesComponent)
      },
      {
        path: 'configuraciones/tipos-pax',
        data: frontDeskData('Tipos de Pax', 'Configuraciones'),
        loadComponent: () => import('./settings/pax-types/pax-types.component').then((c) => c.PaxTypesComponent)
      },
      {
        path: 'configuraciones/nacionalidades',
        data: frontDeskData('Nacionalidades', 'Configuraciones'),
        loadComponent: () => import('./settings/nationalities/nationalities.component').then((c) => c.NationalitiesComponent)
      },
      {
        path: 'configuraciones/grupos-habitaciones',
        data: frontDeskData('Grupos de Habitaciones', 'Configuraciones'),
        loadComponent: () => import('./settings/room-groups/room-groups.component').then((c) => c.RoomGroupsComponent)
      },
      {
        path: 'configuraciones/habitaciones',
        data: frontDeskData('Habitaciones', 'Configuraciones'),
        loadComponent: () => import('./settings/rooms/rooms.component').then((c) => c.RoomsComponent)
      },
      {
        path: 'configuraciones/planes-alimentacion',
        data: frontDeskData('Planes de Alimentación', 'Configuraciones'),
        loadComponent: () => import('./settings/meal-plans/meal-plans.component').then((c) => c.MealPlansComponent)
      },
      {
        path: 'configuraciones/lista-habitaciones',
        data: frontDeskData('Lista de Habitaciones', 'Configuraciones'),
        loadComponent: () => import('./settings/rooms/rooms.component').then((c) => c.RoomsComponent)
      },
      {
        path: 'configuraciones/motivos-bloqueo',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Motivos de Bloqueo', 'Configuraciones', { module: 'Front Desk / Configuraciones', title: 'Motivos de Bloqueo' })
      },
      {
        path: 'configuraciones/estados',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Estados', 'Configuraciones', { module: 'Front Desk / Configuraciones', title: 'Estados' })
      },
      {
        path: 'configuraciones/parametros',
        loadComponent: loadPmsPlaceholder,
        data: frontDeskData('Parámetros Front Desk', 'Configuraciones', { module: 'Front Desk / Configuraciones', title: 'Parametros Front Desk' })
      }
    ]
  }
];
