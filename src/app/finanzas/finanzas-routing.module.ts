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
        loadComponent: () => import('./cuentas-cobrar/cuentas-cobrar.component').then((c) => c.CuentasCobrarComponent)
      },
      {
        path: 'cuentas-pagar',
        loadComponent: () => import('./cuentas-pagar/cuentas-pagar.component').then((c) => c.CuentasPagarComponent)
      },
      {
        path: 'recibos',
        loadComponent: () => import('./recibos/recibos.component').then((c) => c.RecibosComponent)
      },
      {
        path: 'consulta-documentos',
        loadComponent: () =>
          import('./pages-factura/consulta-documentos/consulta-documentos.component').then((c) => c.ConsultaDocumentosComponent)
      },
      {
        path: 'notas-credito/nueva',
        loadComponent: () =>
          import('./nota-credito/nueva-nota-credito/nueva-nota-credito.component').then(
            (c) => c.NuevaNotaCreditoComponent
          )
      },
      {
        path: 'notas-credito',
        loadComponent: () =>
          import('./nota-credito/notas-credito-consulta/notas-credito-consulta.component').then(
            (c) => c.NotasCreditoConsultaComponent
          )
      },
      {
        path: 'documento/:tipo/:serie/:numero',
        loadComponent: () =>
          import('./pages-factura/documento-detalle/documento-detalle.component').then((c) => c.DocumentoDetalleComponent)
      },
      {
        path: 'documento/:tipo/:numero',
        loadComponent: () =>
          import('./pages-factura/documento-detalle/documento-detalle.component').then((c) => c.DocumentoDetalleComponent)
      },
      {
        path: 'nueva-factura',
        loadComponent: () =>
          import('./pages-factura/nueva-factura/nueva-factura/nueva-factura.component').then((c) => c.NuevaFacturaComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FinanzasRoutingModule {}
