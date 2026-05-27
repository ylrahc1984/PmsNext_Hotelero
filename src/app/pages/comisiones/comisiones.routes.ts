import { Routes } from '@angular/router';
import { AdminComponent } from '../../theme/layout/admin/admin.component';

export const COMISIONES_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'calculadas'
      },
      {
        path: 'dashboard',
        redirectTo: 'calculadas'
      },
      {
        path: 'configuracion/general',
        loadComponent: () => import('./configuracion/config-general/config-general.component').then((c) => c.ConfigGeneralComponent)
      },
      {
        path: 'configuracion/agencias',
        loadComponent: () => import('./configuracion/agencias/agencias-comision.component').then((c) => c.AgenciasComisionComponent)
      },
      {
        path: 'configuracion/servicios',
        loadComponent: () => import('./configuracion/servicios/servicios-comisionables.component').then((c) => c.ServiciosComisionablesComponent)
      },
      {
        path: 'reglas',
        loadComponent: () => import('./reglas/reglas-comision.component').then((c) => c.ReglasComisionComponent)
      },
      {
        path: 'calculadas',
        loadComponent: () => import('./calculadas/comisiones-calculadas.component').then((c) => c.ComisionesCalculadasComponent)
      },
      {
        path: 'liquidaciones',
        loadComponent: () => import('./liquidaciones/lista/liquidaciones-lista.component').then((c) => c.LiquidacionesListaComponent)
      },
      {
        path: 'liquidaciones/:id',
        loadComponent: () => import('./liquidaciones/detalle/liquidacion-detalle.component').then((c) => c.LiquidacionDetalleComponent)
      },
      {
        path: 'auditoria',
        loadComponent: () => import('./auditoria/comisiones-auditoria.component').then((c) => c.ComisionesAuditoriaComponent)
      }
    ]
  }
];
