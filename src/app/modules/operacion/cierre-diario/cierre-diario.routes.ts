import { Routes } from '@angular/router';

import { AdminComponent } from 'src/app/theme/layout/admin/admin.component';

export const CIERRE_DIARIO_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      { path: '', redirectTo: 'cierre-diario', pathMatch: 'full' },
      {
        path: 'cierre-diario',
        loadComponent: () => import('./cierre-diario.component').then((c) => c.CierreDiarioComponent)
      }
    ]
  }
];
