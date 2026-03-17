export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;

  children?: NavigationItem[];
}
export const NavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    type: 'item',
    url: '/dashboard',
    icon: 'feather icon-home',
    classes: 'nav-item'
  },
  {
    id: 'main-navigation',
    title: 'NAVEGACION PRINCIPAL',
    type: 'group',
    children: [

      // =========================
      // OPERACIONES
      // =========================
      {
        id: 'operaciones',
        title: 'OPERACIONES',
        type: 'collapse',
        icon: 'feather icon-briefcase',
        children: [
          {
            id: 'reservas',
            title: 'Reservas',
            type: 'item',
            url: '/operaciones/reservas',
            icon: 'feather icon-calendar',
            classes: 'nav-item'
          },
          {
            id: 'ordenes-trabajo',
            title: 'Órdenes de Trabajo',
            type: 'item',
            url: '/operaciones/ordenes-trabajo',
            icon: 'feather icon-clipboard',
            classes: 'nav-item'
          },
          {
            id: 'operacion-diaria',
            title: 'Operación Diaria',
            type: 'item',
            url: '/operaciones/operacion-diaria',
            icon: 'feather icon-clock',
            classes: 'nav-item'
          },
          {
            id: 'cierre-caja',
            title: 'Cierre de Caja',
            type: 'item',
            url: '/operaciones/cierre-caja',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'lista-pickup',
            title: 'Lista Pickup',
            type: 'item',
            url: '/operaciones/lista-pickup',
            icon: 'feather icon-map-pin',
            classes: 'nav-item'
          }
        ]
      },

      // =========================
      // COMERCIAL
      // =========================
      {
        id: 'comercial',
        title: 'COMERCIAL',
        type: 'collapse',
        icon: 'feather icon-shopping-cart',
        children: [
          {
            id: 'servicios',
            title: 'Servicios',
            type: 'item',
            url: '/catalogos/servicios',
            icon: 'feather icon-settings',
            classes: 'nav-item'
          },
          {
            id: 'listas-precios',
            title: 'Listas de Precios',
            type: 'item',
            url: '/catalogos/listas-precios',
            icon: 'feather icon-tag',
            classes: 'nav-item'
          },
          {
            id: 'agencias-comisionistas',
            title: 'Agencias / Comisionistas',
            type: 'item',
            url: '/catalogos/clientes',
            icon: 'feather icon-briefcase',
            classes: 'nav-item'
          },
          {
            id: 'suplidores',
            title: 'Transportistas',
            type: 'item',
            url: '/comercial/suplidores',
            icon: 'feather icon-users',
            classes: 'nav-item'
          },
        {
            id: 'ordenes-pedido',
            title: 'Ordenes de Pedido',
            type: 'item',
            url: '/demo/ordenes-pedido',
            icon: 'feather icon-file-text',
            classes: 'nav-item'
          },
          {
            id: 'consulta-documentos-comercial',
            title: 'Consulta Documentos',
            type: 'item',
            url: '/finanzas/consulta-documentos',
            icon: 'feather icon-search',
            classes: 'nav-item'
          },
          {
            id: 'notas-credito-comercial',
            title: 'Notas de Crédito',
            type: 'item',
            url: '/finanzas/notas-credito',
            icon: 'feather icon-file-minus',
            classes: 'nav-item'
          }
        ]
      },

      // =========================
      // COMPRAS E INVENTARIO
      // =========================
      {
        id: 'compras',
        title: 'COMPRAS E INVENTARIO',
        type: 'collapse',
        icon: 'feather icon-package',
        children: [
          {
            id: 'proveedores',
            title: 'Proveedores',
            type: 'item',
            url: '/compras/proveedores',
            icon: 'feather icon-users',
            classes: 'nav-item'
          },
          {
            id: 'producto-list',
            title: 'Productos',
            type: 'item',
            url: '/compras/producto-list',
            icon: 'feather icon-box',
            classes: 'nav-item'
          },
          {
            id: 'servicios-compras',
            title: 'Servicios',
            type: 'item',
            url: '/compras/servicios',
            icon: 'feather icon-briefcase',
            classes: 'nav-item'
          },
          {
            id: 'ordenes-compra',
            title: 'Ordenes de Compra',
            type: 'item',
            url: '/compras/ordenes-compra',
            icon: 'feather icon-clipboard',
            classes: 'nav-item'
          },
          {
            id: 'recepcion-facturas',
            title: 'Recepcion de Facturas',
            type: 'item',
            url: '/compras/recepcion-facturas',
            icon: 'feather icon-inbox',
            classes: 'nav-item'
          },
          {
            id: 'historia-pagos',
            title: 'Historia de Pagos',
            type: 'item',
            url: '/compras/historia-pagos',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'configuracion-compras',
            title: 'Configuracion',
            type: 'item',
            url: '/compras/configuracion',
            icon: 'feather icon-settings',
            classes: 'nav-item'
          }
          // Futuro:
          // Órdenes de Compra
          // Inventario
          // Ajustes
        ]
      },

      // =========================
      // FINANZAS
      // =========================
      {
        id: 'finanzas',
        title: 'FINANZAS',
        type: 'collapse',
        icon: 'feather icon-pie-chart',
        children: [
          {
            id: 'cuentas-cobrar',
            title: 'Cuentas por Cobrar',
            type: 'item',
            url: '/finanzas/cuentas-cobrar',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'cuentas-pagar',
            title: 'Cuentas por Pagar',
            type: 'item',
            url: '/finanzas/cuentas-pagar',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'depositos',
            title: 'Depósitos Bancarios',
            type: 'item',
            url: '/finanzas/bancos/depositos-cxc',
            icon: 'feather icon-download',
            classes: 'nav-item'
          },
          {
            id: 'retiros',
            title: 'Retiros Bancarios',
            type: 'item',
            url: '/finanzas/bancos/retiros-cxp',
            icon: 'feather icon-upload',
            classes: 'nav-item'
          },
          {
            id: 'recibos',
            title: 'Recibos',
            type: 'item',
            url: '/finanzas/recibos',
            icon: 'feather icon-file-text',
            classes: 'nav-item'
          },
          {
            id: 'consulta-documentos',
            title: 'Consulta Documentos',
            type: 'item',
            url: '/finanzas/consulta-documentos',
            icon: 'feather icon-search',
            classes: 'nav-item'
          },
          {
            id: 'notas-credito',
            title: 'Notas de Crédito',
            type: 'item',
            url: '/finanzas/notas-credito',
            icon: 'feather icon-file-minus',
            classes: 'nav-item'
          },
          {
            id: 'configuracion-finanzas',
            title: 'Configuracion',
            type: 'item',
            url: '/finanzas/configuracion',
            icon: 'feather icon-settings',
            classes: 'nav-item'
          }
          // Futuro:
          // Caja
          // Bancos
          // Asientos contables
        ]
      },

      // =========================
      // ADMINISTRACIÓN
      // =========================
      {
        id: 'administracion',
        title: 'ADMINISTRACIÓN',
        type: 'collapse',
        icon: 'feather icon-settings',
        children: [
          {
            id: 'configuracion-sistema',
            title: 'Configuración',
            type: 'item',
            url: '/administracion/configuracion',
            icon: 'feather icon-sliders',
            classes: 'nav-item'
          },
          {
            id: 'usuarios',
            title: 'Usuarios',
            type: 'item',
            url: '/usuarios',
            icon: 'feather icon-user',
            classes: 'nav-item'
          }
          // Futuro:
          // Usuarios
          // Roles
          // Permisos
        ]
      },

      // =========================
      // REPORTES
      // =========================
      {
        id: 'reportes',
        title: 'REPORTES',
        type: 'collapse',
        icon: 'feather icon-bar-chart-2',
        children: [
          {
            id: 'reporte-operaciones',
            title: 'Operaciones',
            type: 'item',
            url: '/reportes/operaciones',
            icon: 'feather icon-activity',
            classes: 'nav-item'
          },
          {
            id: 'reporte-finanzas',
            title: 'Finanzas',
            type: 'item',
            url: '/reportes/finanzas',
            icon: 'feather icon-trending-up',
            classes: 'nav-item'
          },
          {
            id: 'reporte-comercial',
            title: 'Comercial',
            type: 'item',
            url: '/reportes/comercial',
            icon: 'feather icon-dollar-sign',
            classes: 'nav-item'
          }
        ]
      }

    ]
  }
];
