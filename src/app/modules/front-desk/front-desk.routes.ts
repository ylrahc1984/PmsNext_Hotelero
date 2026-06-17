import { Routes } from '@angular/router';

import { AdminComponent } from 'src/app/theme/layout/admin/admin.component';

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
        path: 'habitaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk', title: 'Habitaciones' }
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
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk', title: 'Arribos del Dia' }
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
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Tipos de Habitacion' }
      },
      {
        path: 'configuraciones/categorias',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Categorias' }
      },
      {
        path: 'configuraciones/tipos-pax',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Tipos de Pax' }
      },
      {
        path: 'configuraciones/nacionalidades',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Nacionalidades' }
      },
      {
        path: 'configuraciones/grupos-habitaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Grupos de Habitaciones' }
      },
      {
        path: 'configuraciones/lista-habitaciones',
        loadComponent: loadPmsPlaceholder,
        data: { module: 'Front Desk / Configuraciones', title: 'Lista de Habitaciones' }
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
