import { Routes } from '@angular/router';

import { AdminComponent } from 'src/app/theme/layout/admin/admin.component';
import { RoomStayManagementComponent } from './pages/room-stay-management/room-stay-management.component';

const loadPmsPlaceholder = () => import('src/app/pages/pms-placeholder/pms-placeholder.component').then((c) => c.PmsPlaceholderComponent);

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
        loadComponent: () => import('./pages/room-rack/room-rack.component').then((c) => c.RoomRackComponent)
      },
      {
        path: 'habitaciones-bloqueadas',
        loadComponent: () => import('./pages/blocked-rooms/blocked-rooms.component').then((c) => c.BlockedRoomsComponent)
      },
      {
        path: 'walk-in',
        loadComponent: () => import('./walk-in/walk-in.component').then((c) => c.WalkInComponent)
      },
      {
        path: 'habitaciones/room-stay-management/:roomNumber',
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
        data: { module: 'Front Desk / Habitaciones', title: 'Estado de Habitaciones' }
      },
      {
        path: 'habitaciones/rooming-asignaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Habitaciones', title: 'Rooming - Asignaciones' }
      },
      {
        path: 'factura-directa',
        loadComponent: () =>
          import('src/app/finanzas/pages-factura/nueva-factura/nueva-factura/nueva-factura.component').then(
            (c) => c.NuevaFacturaComponent
          )
      },
      {
        path: 'rooming-asignaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk', title: 'Rooming - Asignaciones' }
      },
      {
        path: 'arribos-dia',
        loadComponent: () => import('./check-in-arrivals/check-in-arrivals.component').then((c) => c.CheckInArrivalsComponent)
      },
      {
        path: 'huespedes-in-house',
        loadComponent: () => import('./in-house-guests/in-house-guests.component').then((c) => c.InHouseGuestsComponent)
      },
      {
        path: 'pronostico-ocupacion',
        redirectTo: 'occupancy-forecast',
        pathMatch: 'full'
      },
      {
        path: 'occupancy-forecast',
        loadComponent: () => import('./pages/occupancy-forecast/occupancy-forecast.component').then((c) => c.OccupancyForecastComponent)
      },
      {
        path: 'forecast-ocupacion',
        loadComponent: () => import('./pages/forecast-ocupacion/forecast-ocupacion.component').then((c) => c.ForecastOcupacionComponent)
      },
      {
        path: 'estado-habitaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk', title: 'Estado de Habitaciones' }
      },
      {
        path: 'cierre-caja',
        loadComponent: () => import('src/app/operaciones/cierre-caja/cierre-caja-list.component').then((c) => c.CierreCajaListComponent)
      },
      {
        path: 'consulta-documentos',
        loadComponent: () =>
          import('src/app/finanzas/pages-factura/consulta-documentos/consulta-documentos.component').then(
            (c) => c.ConsultaDocumentosComponent
          )
      },
      {
        path: 'notas-credito',
        loadComponent: () =>
          import('src/app/finanzas/nota-credito/notas-credito-consulta/notas-credito-consulta.component').then(
            (c) => c.NotasCreditoConsultaComponent
          )
      },
      {
        path: 'configuraciones',
        loadComponent: () => import('./pages/front-desk-settings/front-desk-settings.component').then((c) => c.FrontDeskSettingsComponent)
      },
      {
        path: 'configuraciones/tipos-habitacion',
        loadComponent: () => import('./settings/room-types/room-types.component').then((c) => c.RoomTypesComponent)
      },
      {
        path: 'configuraciones/categorias',
        loadComponent: () => import('./settings/room-categories/room-categories.component').then((c) => c.RoomCategoriesComponent)
      },
      {
        path: 'configuraciones/tipos-pax',
        loadComponent: () => import('./settings/pax-types/pax-types.component').then((c) => c.PaxTypesComponent)
      },
      {
        path: 'configuraciones/nacionalidades',
        loadComponent: () => import('./settings/nationalities/nationalities.component').then((c) => c.NationalitiesComponent)
      },
      {
        path: 'configuraciones/grupos-habitaciones',
        loadComponent: () => import('./settings/room-groups/room-groups.component').then((c) => c.RoomGroupsComponent)
      },
      {
        path: 'configuraciones/habitaciones',
        loadComponent: () => import('./settings/rooms/rooms.component').then((c) => c.RoomsComponent)
      },
      {
        path: 'configuraciones/planes-alimentacion',
        loadComponent: () => import('./settings/meal-plans/meal-plans.component').then((c) => c.MealPlansComponent)
      },
      {
        path: 'configuraciones/lista-habitaciones',
        loadComponent: () => import('./settings/rooms/rooms.component').then((c) => c.RoomsComponent)
      },
      {
        path: 'configuraciones/motivos-bloqueo',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Motivos de Bloqueo' }
      },
      {
        path: 'configuraciones/estados',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Estados' }
      },
      {
        path: 'configuraciones/parametros',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Parametros Front Desk' }
      }
    ]
  }
];
