# Guía Visual - Orden de Trabajo UI/UX

## 📐 Layout Desktop (≥992px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Orden de Trabajo                                     [Estado: ACT] │
│  Asigne servicios a suplidores y genere la orden operativa          │
├─────────────────────────────────────────────────────────────────────┤
│  [📅 Fecha] [Estado ▼] [🔍 Búsqueda...]  [Buscar] [X]              │
│  [Todos] [06:00] [08:00] [11:00] [11:30] [14:00] [16:00] [18:00]   │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────┬──────────────────────────────┬────────────────────┐
│   SUPLIDORES   │     SERVICIOS PENDIENTES     │      RESUMEN       │
├────────────────┼──────────────────────────────┼────────────────────┤
│                │                              │                    │
│ ┌────────────┐ │ ┌──────────────────────────┐ │ Suplidor:          │
│ │ Transport  │ │ │☐ 08:00 SJO→JAC 4pax     │ │ Transportes Exp.   │
│ │ Express    │ │ │☐ 11:00 JAC→SJO 2pax     │ │                    │
│ │ [Parcial]  │ │ │☑ 14:00 SJO→MAN 6pax     │ │ Servicios: [3]     │
│ │ ████░░ 60% │ │ │☐ 16:00 MAN→SJO 3pax     │ │ Pax: [12]          │
│ │ 30/50      │ │ └──────────────────────────┘ │                    │
│ └────────────┘ │                              │ Observaciones:     │
│                │ [+ Agregar seleccionados(1)] │ ┌────────────────┐ │
│ ┌────────────┐ │                              │ │                │ │
│ │ Costa Rica │ │                              │ └────────────────┘ │
│ │ Tours      │ │                              │                    │
│ │ [Sin asig] │ │                              │ ─── Secuencia ───  │
│ │ ░░░░░░  0% │ │                              │ ① SJO→JAC 4pax    │
│ │ 0/40       │ │                              │    [↑][↓] [X]      │
│ └────────────┘ │                              │ ② JAC→MAN 6pax    │
│                │                              │    [↑][↓] [X]      │
│ ┌────────────┐ │                              │ ③ MAN→SJO 3pax    │
│ │ Tropical   │ │                              │    [↑][↓] [X]      │
│ │ Shuttle    │ │                              │                    │
│ │ [Completo] │ │                              │ ───────────────── │
│ │ ██████100% │ │                              │ [Guardar borrador]│
│ │ 30/30      │ │                              │ [Generar OT]      │
│ └────────────┘ │                              │ [Cancelar]        │
│                │                              │ [← Volver]        │
└────────────────┴──────────────────────────────┴────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ▶ Detalle de la OT                                                  │
│ ▶ Historial                                                         │
│ ▶ Adjuntos / Boletas                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 📱 Layout Móvil (<768px)

```
┌─────────────────────────┐
│ Orden de Trabajo  [ACT] │
│ Asigne servicios...     │
├─────────────────────────┤
│ [📅 Fecha de Servicio]  │
│ [Estado ▼]              │
│ [🔍 Búsqueda...]        │
│ [Buscar] [X]            │
├─────────────────────────┤
│ [Todos] [06:00] [08:00] │
│ [11:00] [11:30] [14:00] │
└─────────────────────────┘

┌─────────────────────────┐
│ SERVICIOS PENDIENTES    │
├─────────────────────────┤
│ ☐ 08:00 SJO→JAC 4pax   │
│ ☐ 11:00 JAC→SJO 2pax   │
│ ☑ 14:00 SJO→MAN 6pax   │
└─────────────────────────┘

┌─────────────────────────┐
│ SUPLIDORES              │
├─────────────────────────┤
│ Transportes Express     │
│ [Parcial] 30/50         │
│ ████░░░ 60%             │
│ [Asignar aquí]          │
├─────────────────────────┤
│ Costa Rica Tours        │
│ [Sin asignar] 0/40      │
│ ░░░░░░░ 0%              │
│ [Asignar aquí]          │
└─────────────────────────┘

┌─────────────────────────┐
│ RESUMEN                 │
├─────────────────────────┤
│ Suplidor: Transport Exp │
│ Servicios: [3]          │
│ Pax: [12]               │
│                         │
│ ① SJO→JAC [↑][↓][X]    │
│ ② JAC→MAN [↑][↓][X]    │
│ ③ MAN→SJO [↑][↓][X]    │
│                         │
│ [Guardar borrador]      │
│ [Generar OT]            │
│ [Cancelar]              │
└─────────────────────────┘
```

## 🎨 Paleta de Colores

```scss
// Colores principales
$primary: #4680ff;           // Azul principal
$primary-light: #f0f4ff;     // Fondo selección
$primary-hover: #3366e6;     // Hover botones

// Estados
$success: #28a745;           // Completo/Finalizado
$warning: #ffc107;           // Parcial/En proceso
$danger: #dc3545;            // Error/Cancelar
$info: #17a2b8;              // Información/Pax
$secondary: #6c757d;         // Sin asignar/Pendiente

// Neutrales
$bg-light: #f8f9fa;          // Fondo header paneles
$border: #e9ecef;            // Bordes
$text-muted: #6c757d;        // Texto secundario
$text-dark: #495057;         // Texto principal
```

## 📊 Estados Visuales

### Chip de Horario
```
Inactivo:  [06:00]         (border gris, fondo blanco)
Hover:     [06:00]         (border gris oscuro, fondo gris claro)
Activo:    [06:00]         (border azul, fondo azul, texto blanco)
```

### Card de Suplidor
```
Normal:      ┌─────────────┐  (border gris)
             │ Suplidor    │
             └─────────────┘

Hover:       ┌─────────────┐  (border azul, sombra, lift)
             │ Suplidor    │
             └─────────────┘

Seleccionado:┌═════════════┐  (border azul grueso, fondo azul claro)
             ║ Suplidor  ✓ ║
             └═════════════┘
```

### Fila de Servicio
```
Normal:    □  08:00  SJO→JAC  4pax        (fondo blanco)
Hover:     □  08:00  SJO→JAC  4pax        (fondo gris claro)
Seleccionado: ☑ 08:00  SJO→JAC  4pax      (fondo azul claro)
```

### Badges
```
Estado Suplidor:
[Sin asignar]  - badge-secondary (gris)
[Parcial]      - badge-warning (amarillo)
[Completo]     - badge-success (verde)

Estado Orden:
[Pendiente]    - badge-secondary (gris)
[Asignada]     - badge-primary (azul)
[En Proceso]   - badge-warning (amarillo)
[Finalizada]   - badge-success (verde)
[Anulada]      - badge-danger (rojo)
```

## 🔄 Interacciones del Usuario

### 1. Flujo Principal
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario selecciona fecha                                 │
│    ↓ Sistema carga servicios disponibles                    │
├─────────────────────────────────────────────────────────────┤
│ 2. Usuario filtra por horario (opcional)                    │
│    ↓ Lista se filtra por chips de hora                      │
├─────────────────────────────────────────────────────────────┤
│ 3. Usuario selecciona un suplidor                           │
│    ↓ Card se resalta, botones se habilitan                  │
├─────────────────────────────────────────────────────────────┤
│ 4. Usuario marca servicios (checkboxes)                     │
│    ↓ Contador aumenta, filas se resaltan                    │
├─────────────────────────────────────────────────────────────┤
│ 5. Usuario hace click en "Agregar seleccionados"            │
│    ↓ Servicios pasan al panel de secuencia                  │
├─────────────────────────────────────────────────────────────┤
│ 6. Usuario reordena secuencia (↑↓)                          │
│    ↓ Lista se reorganiza visualmente                        │
├─────────────────────────────────────────────────────────────┤
│ 7. Usuario revisa resumen y observaciones                   │
│    ↓ Modifica campos si necesario                           │
├─────────────────────────────────────────────────────────────┤
│ 8. Usuario genera la orden                                  │
│    ↓ Sistema valida y crea OT                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. Click en Suplidor
```typescript
// Estado inicial
selectedSupplierId = null;
card.classList = ['suplidor-card'];

// Usuario hace click
selectSuplidor('SUP001');

// Estado final
selectedSupplierId = 'SUP001';
card.classList = ['suplidor-card', 'selected'];
form.patchValue({ suplidor: 'Transportes Express' });
```

### 3. Selección de Servicio
```typescript
// Click en checkbox o fila completa
toggleSeleccion(detalle, true);

// Resultado visual
- checkbox checked: ☑
- fila clase: 'row-selected'
- detallesSeleccionados.add(detalle.key)
- contador actualiza: "(2)"
```

### 4. Reordenar Secuencia
```typescript
// Usuario hace click en [↑]
moverDetalle(2, 'up');

// Antes:
// ① Servicio A
// ② Servicio B
// ③ Servicio C

// Después:
// ① Servicio A
// ② Servicio C  (subió)
// ③ Servicio B  (bajó)
```

## 📱 Breakpoints Responsive

```scss
// Desktop grande
@media (min-width: 1200px) {
  .ot-grid {
    grid-template-columns: 25% 50% 25%;
    gap: 1.5rem;
  }
}

// Desktop estándar
@media (min-width: 992px) and (max-width: 1199px) {
  .ot-grid {
    grid-template-columns: 30% 40% 30%;
    gap: 1rem;
  }
}

// Tablet
@media (min-width: 768px) and (max-width: 991px) {
  .ot-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .panel-body {
    max-height: 400px;
  }
}

// Móvil
@media (max-width: 767px) {
  .ot-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .panel-body {
    max-height: 350px;
  }
  
  .time-chip {
    font-size: 0.8rem;
    padding: 0.25rem 0.75rem;
  }
  
  .table {
    font-size: 0.75rem;
  }
}
```

## 🎯 Puntos de Atención UX

### ✅ Feedback Visual Inmediato
- Todo click/hover tiene respuesta visual
- Colores semánticos claros
- Animaciones suaves (0.2s ease)

### ✅ Jerarquía Clara
- Encabezado → Filtros → Paneles → Acciones
- Títulos con uppercase y peso 600
- Espaciado generoso (padding 1rem)

### ✅ Estados Deshabilitados
- Campos disabled con opacity reducida
- Botones disabled con cursor not-allowed
- Mensajes explicativos cuando faltan datos

### ✅ Scroll Independiente
- Cada panel con scroll propio
- No afecta navegación general
- Scrollbar personalizado (webkit)

### ✅ Accesibilidad
- Labels descriptivos
- Contraste WCAG AA
- Navegación por teclado
- Textos alternativos en iconos

## 🚀 Próximos Pasos

### Fase 2: Interactividad Avanzada
- [ ] Drag & drop para reordenar
- [ ] Double-click para agregar servicio
- [ ] Búsqueda en tiempo real
- [ ] Filtros avanzados (modal)

### Fase 3: Validaciones
- [ ] Validar capacidad de suplidor
- [ ] Detectar conflictos de horario
- [ ] Validar distancias/rutas
- [ ] Sugerir optimización de ruta

### Fase 4: Integración
- [ ] API real de suplidores
- [ ] WebSocket para actualizaciones live
- [ ] Cálculo automático de precios
- [ ] Generación de PDF de OT

---

**Nota:** Este documento sirve como referencia visual para desarrolladores y diseñadores. Todos los elementos descritos están implementados en el código refactorizado.
