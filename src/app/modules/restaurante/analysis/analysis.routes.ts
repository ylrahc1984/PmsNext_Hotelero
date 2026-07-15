import { Routes } from '@angular/router';

export const ANALYSIS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'productos-mas-vendidos'
  },
  {
    path: 'productos-mas-vendidos',
    loadComponent: () =>
      import('./productos-mas-vendidos/productos-mas-vendidos.component').then(
        (component) => component.ProductosMasVendidosComponent
      )
  },
  {
    path: 'ventas-por-mesero',
    loadComponent: () =>
      import('./ventas-por-mesero/ventas-por-mesero.component').then(
        (component) => component.VentasPorMeseroComponent
      )
  }
];
