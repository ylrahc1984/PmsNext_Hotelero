# Feature: Origen y Destino Diferenciado (Reserva vs Orden de Trabajo)

## 📋 Descripción General

Esta funcionalidad permite que una **Orden de Trabajo** tenga origen y destino diferentes a los de la **Reserva original**, facilitando la división de servicios entre múltiples suplidores cuando el recorrido completo se divide en tramos.

---

## 🎯 Caso de Uso

### Escenario Típico:
**Reserva Original:**
- Cliente: Juan Pérez
- Servicio: Transfer Privado
- Origen: Aeropuerto SDQ
- Destino: Hotel Punta Cana
- Distancia: 200 km

**División en Órdenes de Trabajo:**

**OT #1 - Suplidor A:**
- Origen OT: **Aeropuerto SDQ**
- Destino OT: **Hotel Bávaro** *(punto intermedio)*
- Tramo: 150 km

**OT #2 - Suplidor B:**
- Origen OT: **Hotel Bávaro** *(recoge desde donde dejó Suplidor A)*
- Destino OT: **Hotel Punta Cana**
- Tramo: 50 km

**La reserva conserva su información original:**
- Origen Reserva: Aeropuerto SDQ *(inmutable)*
- Destino Reserva: Hotel Punta Cana *(inmutable)*

---

## 🏗️ Arquitectura de la Solución

### 1. **Interfaces Actualizadas**

#### `OrdenTrabajoDetalle` (ordenes.service.ts)
```typescript
export interface OrdenTrabajoDetalle {
  // ... otros campos
  
  // ORIGEN Y DESTINO DE LA RESERVA (Solo lectura, informativo)
  origenReserva: string;        // Origen original de la reserva
  destinoReserva: string;       // Destino original de la reserva
  
  // ORIGEN Y DESTINO DE LA ORDEN DE TRABAJO (Editable)
  origenOT: string;             // Origen para este tramo específico de la OT
  destinoOT: string;            // Destino para este tramo específico de la OT
}
```

### 2. **Flujo de Datos**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Usuario selecciona servicio (checkbox)                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Se muestran inputs editables en la tabla:                │
│    - Info Reserva: Aeropuerto → Hotel (solo lectura, gris)  │
│    - Origen OT: [Input editable] (valor inicial = origen)   │
│    - Destino OT: [Input editable] (valor inicial = destino) │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Usuario edita origen/destino:                            │
│    updateOrigenOT(detalle, "Hotel Bávaro")                  │
│    → Almacena en origenDestinoEditados Map                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Click "Agregar Seleccionados":                           │
│    agregarSeleccionados()                                    │
│    → Lee valores editados del Map                           │
│    → Llama mapDisponibleADetalle() con origenCustom/destino │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Detalle creado en detallesOrden:                         │
│    {                                                         │
│      origenReserva: "Aeropuerto SDQ",                       │
│      destinoReserva: "Hotel Punta Cana",                    │
│      origenOT: "Aeropuerto SDQ",      ← Editado            │
│      destinoOT: "Hotel Bávaro"         ← Editado            │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Muestra en Resumen (panel derecho):                      │
│    Secuencia: Aeropuerto SDQ → Hotel Bávaro                 │
│    Info: Reserva: Aeropuerto SDQ → Hotel Punta Cana        │
│                   (se muestra si difiere)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Componentes Modificados

### 1. **ordenes.service.ts**
- ✅ Actualizada interfaz `OrdenTrabajoDetalle` con 4 campos de ubicación
- ✅ Método `mapDisponibleADetalle()` acepta `origenCustom?` y `destinoCustom?`

### 2. **orden-trabajo-form.component.ts**
- ✅ Agregada propiedad `origenDestinoEditados: Map<string, {origenOT, destinoOT}>`
- ✅ Métodos `updateOrigenOT()` y `updateDestinoOT()` para capturar cambios
- ✅ Métodos `getOrigenOT()` y `getDestinoOT()` para binding en template
- ✅ Actualizado `agregarSeleccionados()` para leer valores editados del Map
- ✅ Map se limpia después de agregar servicios

### 3. **orden-trabajo-form.component.html**
- ✅ Columna "Origen / Destino" fusionada (antes eran 2 columnas)
- ✅ Lógica condicional `*ngIf`:
  - **Sin seleccionar**: Muestra texto simple con iconos
  - **Seleccionado**: Muestra info de reserva + inputs editables
- ✅ Inputs con `(input)` event para capturar cambios
- ✅ `(click)="$event.stopPropagation()"` en inputs para evitar toggle

### 4. **orden-trabajo-form.component.scss**
- ✅ Estilos para `.row-selected input.form-control` (tamaño, padding, bordes)
- ✅ Estilos para labels dentro de filas seleccionadas

---

## 📊 Visualización en UI

### Tabla de Servicios (Panel Central)

#### Servicio NO Seleccionado:
```
┌─────────────────────────────────────┐
│ 📍 Aeropuerto SDQ                   │
│ 🚩 Hotel Punta Cana                 │
└─────────────────────────────────────┘
```

#### Servicio SELECCIONADO (checkbox marcado):
```
┌─────────────────────────────────────────────────────────┐
│ ℹ️ Reserva:                                              │
│   Aeropuerto SDQ → Hotel Punta Cana (gris, solo info)  │
│                                                          │
│ ✏️ Origen OT:                                            │
│ [Aeropuerto SDQ                    ] ← Input editable   │
│                                                          │
│ ✏️ Destino OT:                                           │
│ [Hotel Bávaro                      ] ← Input editable   │
└─────────────────────────────────────────────────────────┘
```

### Panel Resumen (Derecha)

#### Secuencia de Servicios:
```
┌─────────────────────────────────────────┐
│ 1. Aeropuerto SDQ → Hotel Bávaro       │ ← origenOT/destinoOT
│    08:00 | 4 pax                        │
│    ℹ️ Reserva: Aeropuerto → Punta Cana │ ← Solo si difiere
└─────────────────────────────────────────┘
```

---

## 🔐 Consideraciones Importantes

### 1. **Inmutabilidad de Reserva**
- La reserva **NUNCA** se modifica
- Campos `origenReserva` y `destinoReserva` son solo lectura
- Sirven como referencia para trazabilidad

### 2. **Edición Temporal**
- Cambios se almacenan en `origenDestinoEditados` Map (memoria)
- Si el usuario desmarca el checkbox sin agregar, los cambios se pierden
- Solo se persisten al hacer "Agregar Seleccionados"

### 3. **Valores por Defecto**
- Si no se edita, `origenOT` = `origenReserva`
- Si no se edita, `destinoOT` = `destinoReserva`
- El sistema copia automáticamente los valores originales

### 4. **Validación Futura**
- ⚠️ Implementar validación de distancia total (suma de tramos)
- ⚠️ Verificar que destino de OT anterior = origen de OT siguiente
- ⚠️ Alertar si hay brechas en la ruta

---

## 🚀 Próximos Pasos Sugeridos

1. **Validación de Continuidad de Ruta:**
   ```typescript
   validarContinuidadRuta(): boolean {
     for (let i = 0; i < this.detallesOrden.length - 1; i++) {
       if (this.detallesOrden[i].destinoOT !== this.detallesOrden[i+1].origenOT) {
         // Alertar discontinuidad
         return false;
       }
     }
     return true;
   }
   ```

2. **Cálculo de Distancia por Tramo:**
   - Integrar API de geocodificación
   - Calcular km reales entre origenOT y destinoOT
   - Mostrar en UI para confirmación

3. **Sugerencias Inteligentes:**
   - Si se asigna servicio a un suplidor, sugerir destinos de rutas conocidas
   - Autocompletar basado en historial de OTs previas

4. **Persistencia API:**
   - Enviar `origenOT` y `destinoOT` al backend
   - Endpoint: `POST /api/orden-trabajo`
   - Estructura:
     ```json
     {
       "detalles": [{
         "detalleReservaId": 123,
         "origenOT": "Aeropuerto SDQ",
         "destinoOT": "Hotel Bávaro"
       }]
     }
     ```

---

## 📝 Ejemplo de Uso Completo

### Paso a Paso:

1. **Seleccionar fecha**: 2026-02-15
2. **Elegir suplidor**: "Transportes del Caribe"
3. **Marcar checkbox** en servicio de reserva #12345
4. **Aparecen inputs editables:**
   - Info Reserva: Aeropuerto → Hotel (gris)
   - Editar Origen OT: `Aeropuerto` (mantener)
   - Editar Destino OT: `Hotel Bávaro` (cambiar de "Hotel Punta Cana")
5. **Click "Agregar Seleccionados"**
6. **Resultado en Resumen:**
   ```
   1. Aeropuerto → Hotel Bávaro
      ℹ️ Reserva: Aeropuerto → Hotel Punta Cana
   ```
7. **Guardar OT** → Se persiste en base de datos

---

## 🎨 Mejoras de UX Implementadas

- ✅ Iconos visuales (📍 origen, 🚩 destino, ℹ️ info, ✏️ editar)
- ✅ Color de fondo azul claro en filas seleccionadas
- ✅ Inputs con bordes destacados al enfocar
- ✅ Labels en negrita para identificar campos editables
- ✅ Info contextual de reserva siempre visible
- ✅ Comparación visual en resumen (muestra si difiere)

---

## 📞 Contacto y Soporte

Para dudas o sugerencias sobre esta funcionalidad, contactar al equipo de desarrollo.

**Fecha de implementación:** 04/02/2026
**Versión:** 1.0.0
