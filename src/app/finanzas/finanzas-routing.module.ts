import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminComponent } from '../theme/layout/admin/admin.component';
import { CanDeactivateReservaCreateGuard } from 'src/app/core/guards/can-deactivate-reserva-create.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./configuracion/configuracion.component').then((c) => c.ConfiguracionFinanzasComponent)
      },
      {
        path: 'bancos/retiros-cxp',
        loadComponent: () => import('./bancos/retiros-cxp/retiro-list.component').then((c) => c.RetiroListComponent)
      },
      {
        path: 'bancos/depositos-cxc',
        loadComponent: () => import('./bancos/depositos-cxc/deposito-list.component').then((c) => c.DepositoListComponent)
      },
      {
        path: 'bancos/retiros-cxp/nuevo',
        loadComponent: () => import('./bancos/retiros-cxp/retiro-form.component').then((c) => c.RetiroFormComponent)
      },
      {
        path: 'bancos/depositos-cxc/nuevo',
        loadComponent: () => import('./bancos/depositos-cxc/deposito-form.component').then((c) => c.DepositoFormComponent),
        canDeactivate: [CanDeactivateReservaCreateGuard]
      },
      {
        path: 'bancos/retiros-cxp/:idOperacion/editar',
        loadComponent: () => import('./bancos/retiros-cxp/retiro-form.component').then((c) => c.RetiroFormComponent)
      },
      {
        path: 'bancos/depositos-cxc/:idOperacion/editar',
        loadComponent: () => import('./bancos/depositos-cxc/deposito-form.component').then((c) => c.DepositoFormComponent),
        canDeactivate: [CanDeactivateReservaCreateGuard]
      },
      {
        path: 'bancos/retiros-cxp/:idOperacion',
        loadComponent: () => import('./bancos/retiros-cxp/retiro-form.component').then((c) => c.RetiroFormComponent),
        data: { readOnly: true }
      },
      {
        path: 'bancos/depositos-cxc/:idOperacion',
        loadComponent: () => import('./bancos/depositos-cxc/deposito-form.component').then((c) => c.DepositoFormComponent),
        data: { readOnly: true }
      },
      {
        path: 'bancos',
        loadComponent: () => import('./bancos/bancos.component').then((c) => c.BancosComponent)
      },
      {
        path: 'cuenta-banco',
        loadComponent: () => import('./cuenta-banco/cuenta-banco.component').then((c) => c.CuentaBancoComponent)
      },
      {
        path: 'conceptos',
        loadComponent: () => import('./conceptos/conceptos.component').then((c) => c.ConceptosComponent)
      },
      {
        path: 'cuentas-cobrar',
        loadComponent: () => import('./cuentas-cobrar/cuentas-cobrar.component').then((c) => c.CuentasCobrarComponent)
      },
      {
        path: 'cuentas-cobrar-comerciales',
        loadComponent: () =>
          import('./cuentas-cobrar-comerciales/cuentas-cobrar-comerciales.component').then(
            (c) => c.CuentasCobrarComercialesComponent
          )
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
        path: 'notas-credito/detalle/:tipo/:serie/:numero',
        loadComponent: () =>
          import('./nota-credito/nota-credito-detalle/nota-credito-detalle.component').then(
            (c) => c.NotaCreditoDetalleComponent
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
        path: 'reporte-ventas-iva',
        loadComponent: () =>
          import('./reporte-ventas-iva/reporte-ventas-iva.component').then((c) => c.ReporteVentasIvaComponent)
      },
      {
        path: 'reporte-compras-iva',
        loadComponent: () =>
          import('./reporte-compras-iva/reporte-compras-iva.component').then((c) => c.ReporteComprasIvaComponent)
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

