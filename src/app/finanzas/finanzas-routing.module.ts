import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminComponent } from '../theme/layout/admin/admin.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'cuentas-cobrar',
        loadComponent: () => import('../demo/contabilidad/cuentas-cobrar/cuentas-cobrar.component').then((c) => c.CuentasCobrarComponent)
      },
      {
        path: 'cuentas-pagar',
        loadComponent: () => import('../demo/contabilidad/cuentas-pagar/cuentas-pagar.component').then((c) => c.CuentasPagarComponent)
      },
      {
        path: 'recibos',
        loadComponent: () => import('../demo/contabilidad/recibos/recibos.component').then((c) => c.RecibosComponent)
      },
      {
        path: 'consulta-documentos',
        loadComponent: () =>
          import('./pages/consulta-documentos/consulta-documentos.component').then((c) => c.ConsultaDocumentosComponent)
      },
      {
        path: 'nueva-factura',
        loadComponent: () => import('./pages/nueva-factura/nueva-factura.component').then((c) => c.NuevaFacturaComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FinanzasRoutingModule {}
