# Configuración del Sistema

## 📋 Descripción

Componente HUB central para administrar todas las opciones de configuración del sistema. Diseñado como un panel de control moderno que evita saturar el menú lateral, presentando las opciones de configuración en un formato visual de tarjetas organizadas por categorías.

## 🚀 Características

- **Diseño tipo Panel de Control**: Similar a la app de Configuración de Windows
- **Organización por Grupos**: Tarjetas agrupadas en categorías lógicas
- **Diseño Responsive**: Grid adaptativo (3 columnas en desktop, 2 en tablet, 1 en móvil)
- **Navegación Intuitiva**: Click en cualquier tarjeta para acceder a su módulo
- **Efectos Visuales**: Animaciones suaves y efectos hover modernos
- **Integración Completa**: Respeta el template UI existente del proyecto

## 📍 Ubicación y Acceso

### Ruta Principal
```
/administracion/configuracion
```

### Desde el Menú Lateral
```
Administración → Configuración del Sistema
```

## 🎯 Secciones Disponibles

### 1. Configuración Financiera
| Opción | Descripción | Ruta | Estado |
|--------|-------------|------|--------|
| **Monedas** | Gestionar las monedas del sistema | `/monedas` | ✅ Implementado |
| **Tipo de Cambio** | Configurar tasas de cambio | `/administracion/tipo-cambio` | ✅ Implementado |
| **Formas de Pago** | Administrar métodos de pago | `/formas-pago` | ✅ Implementado |
| **Impuestos** | Configurar impuestos y tasas | `/administracion/configuracion/impuestos` | 🔄 Placeholder |

### 2. Configuración Administrativa
| Opción | Descripción | Ruta | Estado |
|--------|-------------|------|--------|
| **Departamentos** | Gestionar departamentos | `/administracion/configuracion/departamentos` | 🔄 Placeholder |
| **Centros de Costos** | Administrar centros de costos | `/administracion/configuracion/centros-costos` | 🔄 Placeholder |
| **Contadores (Correlativos)** | Configurar numeración de documentos | `/correlativos` | ✅ Implementado |

### 3. Configuración General
| Opción | Descripción | Ruta | Estado |
|--------|-------------|------|--------|
| **Parámetros Generales** | Configuración general del sistema | `/administracion/configuracion/parametros` | 🔄 Placeholder |
| **Seguridad** | Usuarios, roles y permisos | `/usuarios` | ✅ Implementado |

## 🏗️ Estructura de Archivos

```
src/app/demo/administracion/configuracion-sistema/
├── configuracion-sistema.component.ts      # Componente principal
├── configuracion-sistema.component.html    # Template HTML
├── configuracion-sistema.component.scss    # Estilos SCSS
└── README.md                               # Documentación
```

## 💻 Uso del Componente

### Importación
El componente es **standalone** y se carga de forma lazy:

```typescript
{
  path: 'configuracion',
  loadComponent: () => import('./demo/administracion/configuracion-sistema/configuracion-sistema.component')
    .then((c) => c.ConfiguracionSistemaComponent)
}
```

### Navegación Programática
```typescript
import { Router } from '@angular/router';

constructor(private router: Router) {}

navigateToConfig() {
  this.router.navigate(['/administracion/configuracion']);
}
```

## 🎨 Características de Diseño

### Grid Responsive
- **Desktop (xl)**: 3 columnas por fila
- **Laptop (lg)**: 4 tarjetas por fila ajustadas
- **Tablet (md)**: 2 columnas por fila
- **Mobile (sm/xs)**: 1 columna por fila

### Tarjetas Interactivas
- Efectos hover con elevación
- Iconos con colores distintivos por categoría
- Animación de barra superior al hover
- Flecha indicadora que aparece al pasar el mouse
- Transiciones suaves en todos los elementos

### Paleta de Colores
- 🟢 **Verde** (#2ed8b6): Operaciones financieras
- 🔵 **Azul** (#4680ff): Configuraciones de sistema
- 🟣 **Morado** (#a389d4): Opciones de pago
- 🔴 **Rojo** (#ff5370): Impuestos y alertas
- 🟡 **Amarillo** (#ffb64d): Configuraciones administrativas

## 🔧 Personalización

### Agregar Nueva Tarjeta
En [configuracion-sistema.component.ts](configuracion-sistema.component.ts), método `initializeConfigGroups()`:

```typescript
{
  id: 'nuevo-modulo',
  title: 'Nuevo Módulo',
  description: 'Descripción del módulo',
  icon: 'icon-nombre-icono',  // Usar iconos Feather
  route: '/ruta/del/modulo',
  iconColor: 'text-c-blue'
}
```

### Agregar Nuevo Grupo
```typescript
{
  title: 'Nuevo Grupo de Configuración',
  cards: [
    // ... tarjetas del grupo
  ]
}
```

## 📱 Responsive Breakpoints

```scss
// Desktop: Por defecto
// Tablet
@media (max-width: 991px) { ... }

// Mobile
@media (max-width: 767px) { ... }

// Extra Small
@media (max-width: 575px) { ... }
```

## 🔒 Seguridad

- Protegido por `AuthGuard`
- Requiere autenticación para acceder
- Validación en cada ruta hija con `canActivateChild`

## 🚧 Próximos Pasos

Las siguientes opciones están marcadas como placeholder y deben implementarse:

1. **Impuestos**: CRUD completo para gestión de impuestos
2. **Departamentos**: Gestión de estructura departamental
3. **Centros de Costos**: Administración de centros de costo
4. **Parámetros Generales**: Configuraciones globales del sistema

Para implementar estos módulos, crear componentes CRUD similares a los existentes (monedas, formas-pago, etc.) y actualizar las rutas en [app-routing.module.ts](../../../app-routing.module.ts).

## 📚 Dependencias

- **Angular**: Standalone Component
- **CommonModule**: Directivas comunes de Angular
- **RouterModule**: Navegación entre rutas
- **SharedModule**: Componentes compartidos del template (app-card, etc.)
- **Feather Icons**: Iconografía

## 🎓 Notas de Desarrollo

1. **Standalone Component**: No requiere declaración en módulos
2. **Lazy Loading**: Se carga solo cuando se accede a la ruta
3. **Template Compatibility**: 100% compatible con el template existente
4. **No Breaking Changes**: No modifica estilos globales ni componentes existentes

## 📞 Soporte

Para agregar nuevas configuraciones o modificar el comportamiento del componente, editar:
- Estructura de datos: [configuracion-sistema.component.ts](configuracion-sistema.component.ts)
- Diseño visual: [configuracion-sistema.component.html](configuracion-sistema.component.html)
- Estilos: [configuracion-sistema.component.scss](configuracion-sistema.component.scss)

---

**Versión**: 1.0.0  
**Fecha**: Enero 2026  
**Estado**: ✅ Producción Ready
