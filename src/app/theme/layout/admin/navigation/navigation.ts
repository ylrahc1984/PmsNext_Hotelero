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
  locked?: boolean;

  children?: NavigationItem[];
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'pms-navigation',
    title: 'PMS HOTELERO',
    type: 'group',
    children: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'collapse',
        icon: 'feather icon-home',
        children: [
          {
            id: 'dashboard-ejecutivo',
            title: 'Dashboard Ejecutivo',
            type: 'item',
            url: '/dashboard',
            icon: 'feather icon-grid',
            classes: 'nav-item'
          },
          {
            id: 'indicadores-operativos',
            title: 'Indicadores Operativos',
            type: 'item',
            url: '/dashboard/indicadores-operativos',
            icon: 'feather icon-bar-chart-2',
            classes: 'nav-item'
          },
          {
            id: 'alertas-sistema',
            title: 'Alertas del Sistema',
            type: 'item',
            url: '/dashboard/alertas-sistema',
            icon: 'feather icon-alert-triangle',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'front-desk',
        title: 'Front Desk',
        type: 'collapse',
        icon: 'feather icon-log-in',
        locked: true,
        children: [
          { id: 'front-desk-habitaciones', title: 'Habitaciones', type: 'item', url: '/front-desk/habitaciones', icon: 'feather icon-home', classes: 'nav-item' },
          { id: 'front-desk-factura-directa', title: 'Factura Directa', type: 'item', url: '/front-desk/factura-directa', icon: 'feather icon-file-plus', classes: 'nav-item' },
          { id: 'front-desk-rooming-asignaciones', title: 'Rooming - Asignaciones', type: 'item', url: '/front-desk/rooming-asignaciones', icon: 'feather icon-users', classes: 'nav-item' },
          { id: 'front-desk-arribos-dia', title: 'Arribos del Día', type: 'item', url: '/front-desk/arribos-dia', icon: 'feather icon-log-in', classes: 'nav-item' },
          { id: 'front-desk-pronostico-ocupacion', title: 'Pronóstico de Ocupación', type: 'item', url: '/front-desk/pronostico-ocupacion', icon: 'feather icon-trending-up', classes: 'nav-item' },
          { id: 'front-desk-estado-habitaciones', title: 'Estado de Habitaciones', type: 'item', url: '/front-desk/estado-habitaciones', icon: 'feather icon-check-circle', classes: 'nav-item' },
          { id: 'front-desk-cierre-caja', title: 'Cierre de Caja', type: 'item', url: '/operaciones/cierre-caja', icon: 'feather icon-lock', classes: 'nav-item' },
          { id: 'front-desk-consulta-documentos', title: 'Consulta de Documentos', type: 'item', url: '/finanzas/consulta-documentos', icon: 'feather icon-search', classes: 'nav-item' },
          { id: 'front-desk-notas-credito', title: 'Notas de Crédito', type: 'item', url: '/finanzas/notas-credito', icon: 'feather icon-file-minus', classes: 'nav-item' },
          {
            id: 'front-desk-configuraciones',
            title: 'Configuraciones',
            type: 'collapse',
            icon: 'feather icon-settings',
            children: [
              { id: 'front-desk-config-room-rack', title: 'Room Rack', type: 'item', url: '/front-desk/configuraciones/room-rack', icon: 'feather icon-grid', classes: 'nav-item' },
              { id: 'front-desk-config-estado', title: 'Estado de Habitaciones', type: 'item', url: '/front-desk/configuraciones/estado', icon: 'feather icon-check-circle', classes: 'nav-item' },
              { id: 'front-desk-config-bloqueos', title: 'Bloqueos de Habitaciones', type: 'item', url: '/front-desk/configuraciones/bloqueos', icon: 'feather icon-lock', classes: 'nav-item' },
              { id: 'front-desk-config-categorias', title: 'Categorías de Habitación', type: 'item', url: '/front-desk/configuraciones/categorias', icon: 'feather icon-layers', classes: 'nav-item' },
              { id: 'front-desk-config-mantenimiento', title: 'Mantenimiento de Habitaciones', type: 'item', url: '/front-desk/configuraciones/mantenimiento', icon: 'feather icon-settings', classes: 'nav-item' }
            ]
          }
        ]
      },
      {
        id: 'reservas-hotel',
        title: 'Reservas',
        type: 'collapse',
        icon: 'feather icon-calendar',
        locked: true,
        children: [
          { id: 'reservas-calendario', title: 'Calendario de Reservas', type: 'item', url: '/reservas/calendario', icon: 'feather icon-calendar', classes: 'nav-item' },
          { id: 'reservas-nueva', title: 'Nueva Reserva', type: 'item', url: '/operaciones/reservas/nueva-v2', icon: 'feather icon-plus-circle', classes: 'nav-item' },
          { id: 'reservas-consulta', title: 'Consulta de Reservas', type: 'item', url: '/operaciones/reservas', icon: 'feather icon-search', classes: 'nav-item' },
          { id: 'reservas-disponibilidad', title: 'Disponibilidad', type: 'item', url: '/reservas/disponibilidad', icon: 'feather icon-check-square', classes: 'nav-item' },
          { id: 'reservas-forecast', title: 'Forecast de Ocupación', type: 'item', url: '/reservas/forecast-ocupacion', icon: 'feather icon-trending-up', classes: 'nav-item' },
          { id: 'reservas-tarifas', title: 'Tarifas y Planes', type: 'item', url: '/reservas/tarifas-planes', icon: 'feather icon-tag', classes: 'nav-item' },
          { id: 'reservas-canales', title: 'Agencias / Canales', type: 'item', url: '/catalogos/clientes', icon: 'feather icon-share-2', classes: 'nav-item' }
        ]
      },
      {
        id: 'housekeeping',
        title: 'Housekeeping',
        type: 'collapse',
        icon: 'feather icon-check-square',
        locked: true,
        children: [
          { id: 'housekeeping-estado-habitaciones', title: 'Estado de Habitaciones', type: 'item', url: '/housekeeping/estado-habitaciones', icon: 'feather icon-check-circle', classes: 'nav-item' },
          { id: 'housekeeping-panel', title: 'Panel de Limpieza', type: 'item', url: '/housekeeping/panel-limpieza', icon: 'feather icon-layout', classes: 'nav-item' },
          { id: 'housekeeping-camareras', title: 'Asignación de Camareras', type: 'item', url: '/housekeeping/asignacion-camareras', icon: 'feather icon-users', classes: 'nav-item' },
          { id: 'housekeeping-supervision', title: 'Supervisión de Limpieza', type: 'item', url: '/housekeeping/supervision', icon: 'feather icon-eye', classes: 'nav-item' }
        ]
      },
      {
        id: 'restaurante',
        title: 'Restaurante',
        type: 'collapse',
        icon: 'feather icon-shopping-cart',
        children: [
          { id: 'restaurante-dashboard', title: 'Dashboard Restaurante', type: 'item', url: '/restaurante/dashboard', icon: 'feather icon-pie-chart', classes: 'nav-item' },
          { id: 'restaurante-facturacion', title: 'Facturación Restaurante', type: 'item', url: '/restaurante/facturacion', icon: 'feather icon-credit-card', classes: 'nav-item' },
          { id: 'restaurante-cargos-habitacion', title: 'Cargos a Habitación', type: 'item', url: '/restaurante/cargos-habitacion', icon: 'feather icon-home', classes: 'nav-item' },
          { id: 'restaurante-configuracion', title: 'Configuración Restaurante', type: 'item', url: '/restaurante/configuracion', icon: 'feather icon-sliders', classes: 'nav-item' }
        ]
      },
      {
        id: 'clientes-huespedes',
        title: 'Clientes / Huéspedes',
        type: 'collapse',
        icon: 'feather icon-users',
        locked: true,
        children: [
          { id: 'huespedes-perfil', title: 'Perfil de Huéspedes', type: 'item', url: '/clientes', icon: 'feather icon-user', classes: 'nav-item' },
          { id: 'huespedes-historial', title: 'Historial de Estadías', type: 'item', url: '/huespedes/historial-estadias', icon: 'feather icon-clock', classes: 'nav-item' },
          { id: 'huespedes-preferencias', title: 'Preferencias', type: 'item', url: '/huespedes/preferencias', icon: 'feather icon-heart', classes: 'nav-item' },
          { id: 'huespedes-documentos', title: 'Documentos de Identificación', type: 'item', url: '/huespedes/documentos-identificacion', icon: 'feather icon-file', classes: 'nav-item' },
          { id: 'huespedes-crm', title: 'CRM de Huéspedes', type: 'item', url: '/huespedes/crm', icon: 'feather icon-message-square', classes: 'nav-item' }
        ]
      },
      {
        id: 'operaciones',
        title: 'Operaciones',
        type: 'collapse',
        icon: 'feather icon-briefcase',
        locked: true,
        children: [
          { id: 'operacion-diaria', title: 'Actividades Diarias', type: 'item', url: '/operaciones/operacion-diaria', icon: 'feather icon-clock', classes: 'nav-item' },
          { id: 'forecast-actividades', title: 'Forecast de Actividades', type: 'item', url: '/operaciones/forecast-actividades', icon: 'feather icon-bar-chart-2', classes: 'nav-item' },
          { id: 'centro-operacional', title: 'Centro Operacional', type: 'item', url: '/operaciones/centro-operacional', icon: 'feather icon-monitor', classes: 'nav-item' },
          { id: 'asignacion-traslados', title: 'Asignación de Traslados', type: 'item', url: '/operaciones/ordenes-trabajo', icon: 'feather icon-navigation', classes: 'nav-item' },
          { id: 'lista-pickup', title: 'Lista Pickup', type: 'item', url: '/operaciones/lista-pickup', icon: 'feather icon-map-pin', classes: 'nav-item' },
          { id: 'ordenes-trabajo', title: 'Órdenes de Trabajo', type: 'item', url: '/operaciones/ordenes-trabajo', icon: 'feather icon-clipboard', classes: 'nav-item' }
        ]
      },
      {
        id: 'compras-inventario',
        title: 'Compras e Inventario',
        type: 'collapse',
        icon: 'feather icon-package',
        children: [
          { id: 'proveedores', title: 'Proveedores', type: 'item', url: '/compras/proveedores', icon: 'feather icon-users', classes: 'nav-item' },
          { id: 'producto-list', title: 'Productos', type: 'item', url: '/compras/producto-list', icon: 'feather icon-box', classes: 'nav-item' },
          { id: 'servicios-compras', title: 'Servicios', type: 'item', url: '/compras/servicios', icon: 'feather icon-briefcase', classes: 'nav-item' },
          { id: 'ordenes-compra', title: 'Órdenes de Compra', type: 'item', url: '/compras/ordenes-compra', icon: 'feather icon-clipboard', classes: 'nav-item' },
          { id: 'recepcion-facturas', title: 'Consulta de Compras', type: 'item', url: '/compras/recepcion-facturas', icon: 'feather icon-inbox', classes: 'nav-item' },
          { id: 'compras-correo', title: 'Compras por Correo', type: 'item', url: '/compras/compras-correo', icon: 'feather icon-mail', classes: 'nav-item' },
          { id: 'historia-pagos', title: 'Historia de Pagos', type: 'item', url: '/compras/historia-pagos', icon: 'feather icon-credit-card', classes: 'nav-item' },
          { id: 'configuracion-inventario', title: 'Configuración de Inventario', type: 'item', url: '/compras/configuracion', icon: 'feather icon-settings', classes: 'nav-item' }
        ]
      },
      {
        id: 'finanzas',
        title: 'Finanzas',
        type: 'collapse',
        icon: 'feather icon-pie-chart',
        children: [
          { id: 'cuentas-cobrar', title: 'Cuentas por Cobrar', type: 'item', url: '/finanzas/cuentas-cobrar', icon: 'feather icon-credit-card', classes: 'nav-item' },
          { id: 'cuentas-pagar', title: 'Cuentas por Pagar', type: 'item', url: '/finanzas/cuentas-pagar', icon: 'feather icon-credit-card', classes: 'nav-item' },
          { id: 'finanzas-facturacion', title: 'Facturación', type: 'item', url: '/finanzas/nueva-factura', icon: 'feather icon-file-plus', classes: 'nav-item' },
          { id: 'finanzas-recibos', title: 'Recibos', type: 'item', url: '/finanzas/recibos', icon: 'feather icon-file-text', classes: 'nav-item' },
          { id: 'finanzas-depositos', title: 'Depósitos Bancarios', type: 'item', url: '/finanzas/bancos/depositos-cxc', icon: 'feather icon-download', classes: 'nav-item' },
          { id: 'finanzas-retiros', title: 'Retiros Bancarios', type: 'item', url: '/finanzas/bancos/retiros-cxp', icon: 'feather icon-upload', classes: 'nav-item' },
          { id: 'finanzas-ventas-iva', title: 'Ventas por IVA', type: 'item', url: '/finanzas/reporte-ventas-iva', icon: 'feather icon-bar-chart-2', classes: 'nav-item' },
          {
            id: 'comisiones-financieras',
            title: 'Comisiones',
            type: 'collapse',
            icon: 'feather icon-percent',
            children: [
              { id: 'comisiones-reglas', title: 'Reglas', type: 'item', url: '/comisiones/reglas', icon: 'feather icon-sliders', classes: 'nav-item' },
              { id: 'comisiones-calculadas', title: 'Calculadas', type: 'item', url: '/comisiones/calculadas', icon: 'feather icon-cpu', classes: 'nav-item' },
              { id: 'comisiones-liquidaciones', title: 'Liquidaciones', type: 'item', url: '/comisiones/liquidaciones', icon: 'feather icon-layers', classes: 'nav-item' },
              { id: 'comisiones-auditoria', title: 'Auditoría', type: 'item', url: '/comisiones/auditoria', icon: 'feather icon-activity', classes: 'nav-item' },
              { id: 'comisiones-config-general', title: 'Configuración General', type: 'item', url: '/comisiones/configuracion/general', icon: 'feather icon-settings', classes: 'nav-item' },
              { id: 'comisiones-config-agencias', title: 'Configuración Agencias', type: 'item', url: '/comisiones/configuracion/agencias', icon: 'feather icon-briefcase', classes: 'nav-item' },
              { id: 'comisiones-config-servicios', title: 'Configuración Servicios', type: 'item', url: '/comisiones/configuracion/servicios', icon: 'feather icon-tag', classes: 'nav-item' }
            ]
          },
          { id: 'configuracion-finanzas', title: 'Configuración Financiera', type: 'item', url: '/finanzas/configuracion', icon: 'feather icon-settings', classes: 'nav-item' }
        ]
      },
      {
        id: 'mantenimiento',
        title: 'Mantenimiento',
        type: 'collapse',
        icon: 'feather icon-settings',
        children: [
          { id: 'mantenimiento-incidentes', title: 'Reporte de Incidentes', type: 'item', url: '/mantenimiento/incidentes', icon: 'feather icon-alert-circle', classes: 'nav-item' },
          { id: 'mantenimiento-ordenes', title: 'Órdenes de Mantenimiento', type: 'item', url: '/mantenimiento/ordenes', icon: 'feather icon-file-text', classes: 'nav-item' },
          { id: 'mantenimiento-preventivo', title: 'Mantenimiento Preventivo', type: 'item', url: '/mantenimiento/preventivo', icon: 'feather icon-shield', classes: 'nav-item' },
          { id: 'mantenimiento-correctivo', title: 'Mantenimiento Correctivo', type: 'item', url: '/mantenimiento/correctivo', icon: 'feather icon-settings', classes: 'nav-item' },
          { id: 'mantenimiento-fuera-servicio', title: 'Habitaciones Fuera de Servicio', type: 'item', url: '/mantenimiento/habitaciones-fuera-servicio', icon: 'feather icon-slash', classes: 'nav-item' },
          { id: 'mantenimiento-historial', title: 'Historial de Reparaciones', type: 'item', url: '/mantenimiento/historial-reparaciones', icon: 'feather icon-clock', classes: 'nav-item' }
        ]
      },
      {
        id: 'reportes',
        title: 'Reportes',
        type: 'collapse',
        icon: 'feather icon-bar-chart-2',
        children: [
          { id: 'reporte-operaciones', title: 'Reportes Operativos', type: 'item', url: '/reportes/operaciones', icon: 'feather icon-activity', classes: 'nav-item' },
          { id: 'reporte-finanzas', title: 'Reportes Financieros', type: 'item', url: '/reportes/finanzas', icon: 'feather icon-trending-up', classes: 'nav-item' },
          { id: 'reporte-comercial', title: 'Reportes Comerciales', type: 'item', url: '/reportes/comercial', icon: 'feather icon-dollar-sign', classes: 'nav-item' },
          { id: 'reporte-restaurante', title: 'Reportes Restaurante', type: 'item', url: '/reportes/restaurante', icon: 'feather icon-shopping-cart', classes: 'nav-item' },
          { id: 'reporte-ocupacion', title: 'Reportes de Ocupación', type: 'item', url: '/reportes/ocupacion', icon: 'feather icon-home', classes: 'nav-item' },
          { id: 'reporte-housekeeping', title: 'Reportes de Housekeeping', type: 'item', url: '/reportes/housekeeping', icon: 'feather icon-check-square', classes: 'nav-item' },
          { id: 'reporte-mantenimiento', title: 'Reportes de Mantenimiento', type: 'item', url: '/reportes/mantenimiento', icon: 'feather icon-settings', classes: 'nav-item' }
        ]
      },
      {
        id: 'administracion',
        title: 'Administración',
        type: 'collapse',
        icon: 'feather icon-settings',
        children: [
          { id: 'usuarios', title: 'Usuarios', type: 'item', url: '/usuarios', icon: 'feather icon-user', classes: 'nav-item' },
          { id: 'roles-permisos', title: 'Roles y Permisos', type: 'item', url: '/administracion/roles-permisos', icon: 'feather icon-shield', classes: 'nav-item' },
          { id: 'configuracion-general', title: 'Configuración General', type: 'item', url: '/administracion/configuracion', icon: 'feather icon-sliders', classes: 'nav-item' },
          { id: 'parametros-sistema', title: 'Parámetros del Sistema', type: 'item', url: '/administracion/configuracion/parametros', icon: 'feather icon-list', classes: 'nav-item' },
          { id: 'catalogos-generales', title: 'Catálogos Generales', type: 'item', url: '/administracion/catalogos-generales', icon: 'feather icon-folder', classes: 'nav-item' },
          { id: 'auditoria-sistema', title: 'Auditoría del Sistema', type: 'item', url: '/administracion/auditoria-sistema', icon: 'feather icon-activity', classes: 'nav-item' }
        ]
      }
    ]
  }
];
