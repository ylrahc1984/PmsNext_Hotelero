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
            title: 'Ordenes de Trabajo',
            type: 'item',
            url: '/operaciones/ordenes-trabajo',
            icon: 'feather icon-clipboard',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'catalogos',
        title: 'CATALOGOS',
        type: 'collapse',
        icon: 'feather icon-list',
        children: [
          {
            id: 'servicios',
            title: 'Servicios',
            type: 'item',
            url: '/servicios',
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
            title: 'Suplidores',
            type: 'item',
            url: '/catalogos/suplidores',
            icon: 'feather icon-box',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'administracion',
        title: 'ADMINISTRACION',
        type: 'collapse',
        icon: 'feather icon-settings',
        children: [
          {
            id: 'configuracion-sistema',
            title: 'Configuración del Sistema',
            type: 'item',
            url: '/administracion/configuracion',
            icon: 'feather icon-sliders',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'contabilidad',
        title: 'CONTABILIDAD',
        type: 'collapse',
        icon: 'feather icon-pie-chart',
        children: [
          {
            id: 'cuentas-cobrar',
            title: 'Cuentas por Cobrar',
            type: 'item',
            url: '/cuentas-cobrar',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'cuentas-pagar',
            title: 'Cuentas por Pagar',
            type: 'item',
            url: '/cuentas-pagar',
            icon: 'feather icon-credit-card',
            classes: 'nav-item'
          },
          {
            id: 'facturas',
            title: 'Facturas',
            type: 'item',
            url: '/facturas',
            icon: 'feather icon-file-text',
            classes: 'nav-item'
          },
          {
            id: 'recibos',
            title: 'Recibos',
            type: 'item',
            url: '/recibos',
            icon: 'feather icon-file-text',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'reportes',
        title: 'REPORTES',
        type: 'collapse',
        icon: 'feather icon-bar-chart-2',
        children: [
          {
            id: 'ventas',
            title: 'Ventas',
            type: 'item',
            url: '/reportes/ventas',
            icon: 'feather icon-bar-chart',
            classes: 'nav-item'
          },
          {
            id: 'reservas-reporte',
            title: 'Reservas',
            type: 'item',
            url: '/reportes/reservas',
            icon: 'feather icon-calendar',
            classes: 'nav-item'
          },
          {
            id: 'ingresos',
            title: 'Ingresos',
            type: 'item',
            url: '/reportes/ingresos',
            icon: 'feather icon-trending-up',
            classes: 'nav-item'
          },
          {
            id: 'comisiones',
            title: 'Comisiones',
            type: 'item',
            url: '/reportes/comisiones',
            icon: 'feather icon-bar-chart-2',
            classes: 'nav-item'
          }
        ]
      }
    ]
  }
];
