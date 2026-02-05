# Refactorización Orden de Trabajo - Documentación

## Resumen del Refactor

Se ha refactorizado completamente el componente `orden-trabajo-form.component` para convertirlo en una interfaz operativa moderna y funcional para la gestión de Órdenes de Trabajo, manteniendo la compatibilidad con el diseño y componentes existentes del sistema.

## Cambios Implementados

### 1. Estructura de TypeScript (orden-trabajo-form.component.ts)

#### Nuevas Interfaces
```typescript
interface SuplidorUI {
  id: string;
  nombre: string;
  capacidad: number;
  ocupados: number;
  estado: 'sin-asignar' | 'parcial' | 'completo';
}
```

#### Propiedades UI/UX Agregadas
- `selectedSupplierId`: Control de suplidor seleccionado
- `selectedTime`: Filtro de horario activo
- `selectedRows`: Set de filas seleccionadas
- `searchText`: Texto de búsqueda general
- `showDetalleOT`, `showHistorial`, `showAdjuntos`: Control de acordeones
- `horariosDisponibles`: Array de horarios para filtrado
- `suplidoresMock`: Datos mock de suplidores para UI

#### Nuevos Métodos Públicos
- `selectSuplidor(suplidorId: string)`: Selecciona/deselecciona un suplidor
- `selectTime(time: string)`: Filtra servicios por horario
- `clearFilters()`: Limpia todos los filtros aplicados
- `getSuplidorEstadoBadge(estado: string)`: Retorna clase CSS para badge de estado
- `getSuplidorEstadoTexto(estado: string)`: Retorna texto descriptivo del estado
- `getVacantes(suplidor: SuplidorUI)`: Calcula vacantes disponibles
- `moverDetalle(index: number, direccion: 'up' | 'down')`: Reordena servicios
- `getSuplidorSeleccionado()`: Obtiene nombre del suplidor activo
- `refreshDisponibles()`: Ahora es público (antes privado)

### 2. Estructura HTML (orden-trabajo-form.component.html)

#### Layout Principal
Se implementó un diseño en 3 columnas con grid CSS:

**Desktop (≥992px)**
```
[25%: Suplidores] [50%: Reservas] [25%: Resumen]
```

**Tablet/Móvil (<992px)**
```
[100%: Filtros]
[100%: Reservas]
[100%: Suplidores]
[100%: Resumen]
```

#### Secciones Principales

##### A. Encabezado Superior (ot-header)
1. **Título y Subtítulo**
   - Descripción clara del propósito de la pantalla
   - Badge de estado de la orden

2. **Controles de Filtro**
   - Fecha de servicio (obligatorio)
   - Estado (select)
   - Búsqueda general
   - Botones Buscar/Limpiar

3. **Chips de Horario**
   - Botones tipo chip para filtrar por hora
   - Estado activo/inactivo visual
   - Opción "Todos" por defecto

##### B. Panel Izquierdo - Suplidores (ot-panel-suplidores)
- **Cards de Suplidor** con:
  - Nombre y estado (badge)
  - Barra de progreso de capacidad/ocupación
  - Indicador visual de selección
  - Botón "Asignar aquí"
  - Efecto hover y selección con animación

##### C. Panel Central - Reservas (ot-panel-reservas)
- **Tabla de servicios pendientes** con:
  - Checkbox para selección múltiple
  - Columnas: Hora, Origen, Destino, Pax, Cliente, Reserva, Estado
  - Filas seleccionables (click completo)
  - Scroll vertical automático
  - Contador de servicios
  - Botón "Agregar seleccionados" con contador

- **Mensajes informativos**:
  - "Seleccione una fecha para cargar los servicios"
  - "Seleccione un suplidor para asignar servicios"
  - "No hay servicios para los filtros aplicados"

##### D. Panel Derecho - Resumen (ot-panel-resumen)
1. **Resumen de Información**
   - Suplidor seleccionado
   - Servicios asignados (badge)
   - Total Pax (badge)
   - Observaciones (textarea)

2. **Secuencia de Servicios**
   - Lista ordenada con número de secuencia
   - Origen → Destino con hora y pax
   - Botones para mover arriba/abajo
   - Botón eliminar
   - Scroll independiente

3. **Acciones Principales**
   - Input: Total a pagar
   - Botones:
     - "Guardar borrador" (outline)
     - "Generar Orden de Trabajo" (primario)
     - "Cancelar" (danger)
     - "Volver al listado" (link)

##### E. Sección Inferior - Accordion
- **Detalle de la OT**: Campos adicionales (Ruta, Conexión, KM, Rotulación)
- **Historial**: Placeholder para futuro desarrollo
- **Adjuntos/Boletas**: Placeholder para futuro desarrollo

### 3. Estilos SCSS (orden-trabajo-form.component.scss)

#### Características Principales

##### Grid Responsive
```scss
.ot-grid {
  display: grid;
  grid-template-columns: 25% 50% 25%; // Desktop
  gap: 1rem;
  
  @media (max-width: 991px) {
    grid-template-columns: 1fr; // Móvil apilado
  }
}
```

##### Chips de Horario
- Estilo pill con borde redondeado
- Estado activo: fondo azul (#4680ff)
- Transiciones suaves
- Responsive con wrap

##### Paneles (ot-panel)
- Estructura flex con header y body
- Scroll vertical personalizado en panel-body
- Max-height: 600px desktop, 400px móvil
- Scrollbar personalizado (webkit)

##### Cards de Suplidor
- Borde y hover effect
- Estado selected: fondo azul claro con sombra
- Barra de progreso con colores semánticos
- Animación de hover (translateY)

##### Tabla de Reservas
- Font-size reducido (0.875rem)
- Header con fondo gris (#f8f9fa)
- Filas con hover y selección visual
- Estado row-selected: fondo azul claro

##### Secuencia de Servicios
- Números de secuencia circulares
- Scroll independiente (max-height: 250px)
- Botones de reordenamiento verticales
- Animación hover sutil

##### Accordion Simple
- Sin dependencia de NgbAccordion
- Animación slideDown
- Estilos consistentes con el sistema

##### Responsive Breakpoints
- Desktop: ≥992px (3 columnas)
- Tablet: 768-991px (ajuste de columnas)
- Móvil: <768px (apilado + ajustes de tamaño)

## Compatibilidad Mantenida

### Componentes Reutilizados
- `app-card`: Wrapper principal del formulario
- `SharedModule`: Componentes compartidos
- `ReactiveFormsModule` y `FormsModule`: Manejo de formularios
- Iconos `feather`: Sistema de iconos existente
- Badges de Bootstrap: Estilos de badges nativos

### Estilos Existentes
- Tipografía del sistema
- Colores primarios (#4680ff)
- Espaciado y padding estándar
- Clases utilitarias de Bootstrap

### Funcionalidad Original Preservada
- CRUD de órdenes (crear/editar)
- Selección de servicios/reservas
- Cálculo de totales
- Validación de formularios
- Navegación y routing
- Estados de orden (Pendiente, Asignada, etc.)

## Mejoras de UX Implementadas

### 1. Flujo Visual Claro
Usuario sigue un flujo natural:
```
Filtrar fecha/horario → Seleccionar suplidor → Elegir servicios → Revisar resumen → Generar OT
```

### 2. Feedback Visual Inmediato
- Suplidor seleccionado: borde azul + sombra
- Servicios seleccionados: fondo azul claro
- Chips activos: fondo azul con texto blanco
- Hover effects en cards y botones

### 3. Organización Espacial
- Paneles independientes con scroll
- No satura la vista
- Información jerárquica clara
- Resumen siempre visible

### 4. Estados y Mensajes
- Mensajes informativos contextuales
- Badges de estado semánticos
- Contadores en tiempo real
- Validación visual de campos requeridos

### 5. Accesibilidad
- Botones con texto descriptivo
- Estados disabled claros
- Contraste adecuado
- Navegación por teclado (nativo)

## Preparación para Funcionalidad Futura

### Drag & Drop
El panel de secuencia está preparado para implementar drag-and-drop:
- Estructura de lista ordenada
- Botones de reordenamiento ya funcionales
- ID único por servicio

### Validaciones Avanzadas
Estructura lista para:
- Validación de capacidad de suplidor
- Conflictos de horario
- Distancias/rutas
- Reglas de negocio personalizadas

### Integración API
Los métodos mock pueden reemplazarse fácilmente:
- `suplidoresMock` → llamada a API real
- Filtros → query params a backend
- Estados → desde servicio

### Websockets/Real-time
Panel de suplidores preparado para actualizaciones en vivo:
- Estado de ocupación
- Disponibilidad
- Cambios de capacidad

## Instrucciones de Uso

### Para Desarrolladores

1. **Agregar suplidores reales**
```typescript
// Reemplazar suplidoresMock con llamada a servicio
this.suplidorService.getSuplidores().subscribe(suplidores => {
  this.suplidoresMock = suplidores;
});
```

2. **Implementar filtrado por horario**
```typescript
selectTime(time: string): void {
  this.selectedTime = time;
  this.detallesDisponibles = this.detallesDisponibles.filter(
    det => !time || det.hora === time
  );
}
```

3. **Agregar drag-and-drop**
```bash
npm install @angular/cdk
```
```typescript
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

drop(event: CdkDragDrop<OrdenTrabajoDetalle[]>): void {
  moveItemInArray(this.detallesOrden, event.previousIndex, event.currentIndex);
}
```

### Para Testing

**Componente está listo para pruebas E2E:**
```typescript
// Ejemplo de test
it('should select a supplier when clicked', () => {
  const card = fixture.debugElement.query(By.css('.suplidor-card'));
  card.nativeElement.click();
  expect(component.selectedSupplierId).toBeTruthy();
  expect(card.nativeElement.classList).toContain('selected');
});
```

## Archivos Modificados

1. ✅ `orden-trabajo-form.component.ts` - Lógica y estado visual
2. ✅ `orden-trabajo-form.component.html` - Estructura de 3 columnas
3. ✅ `orden-trabajo-form.component.scss` - Estilos responsive

## Estado del Proyecto

- ✅ Sin errores de compilación
- ✅ Diseño responsive completo
- ✅ Componentes UI consistentes
- ✅ Navegación preservada
- ✅ Funcionalidad original mantenida
- ⏳ Listo para implementar lógica de negocio avanzada
- ⏳ Preparado para drag-and-drop
- ⏳ Listo para integración con API real

## Notas Finales

Este refactor se enfocó **exclusivamente en UI/UX**, creando una base sólida y escalable sin romper la funcionalidad existente. El código está preparado para recibir mejoras de lógica de negocio, validaciones avanzadas y características interactivas sin necesidad de restructuración adicional.

---

**Fecha de refactorización:** 2026-02-03  
**Desarrollador:** GitHub Copilot (Claude Sonnet 4.5)  
**Versión:** 1.0.0
