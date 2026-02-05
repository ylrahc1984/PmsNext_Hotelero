# Persistencia de Órdenes de Trabajo - Diseño de API

## 📋 Descripción General

Este documento describe la implementación de la persistencia de Órdenes de Trabajo utilizando dos endpoints REST distintos: uno para el encabezado y otro para los detalles.

---

## 🎯 Problema Identificado

El usuario preguntó:
> "Podemos analizar la forma más correcta de guardar esta información en la base de datos. Como ves en el endpoint, hay dos: uno para guardar un encabezado y otro para guardar los detalles de uno a uno."

**Desafío**: La API requiere guardar los detalles **uno por uno** mediante llamadas POST individuales, lo que podría ser lento si se hace secuencialmente.

---

## ✅ Solución Implementada

### Estrategia: Transacción Manual con Paralelización

```
┌─────────────────────────────────────────────────────────────┐
│                   FLUJO DE GUARDADO                          │
└─────────────────────────────────────────────────────────────┘

1️⃣ POST /api/ordentrabajo (Encabezado)
   ↓
   ✅ Response: { codOT: "OT-2025-001", respuesta: "..." }
   ↓
2️⃣ Con codOT, guardar detalles EN PARALELO usando forkJoin
   ↓
   ┌──────────────────────────────────────┐
   │  POST detalle 1 (línea 1)   ║      │
   │  POST detalle 2 (línea 2)   ║  →   │ forkJoin
   │  POST detalle 3 (línea 3)   ║      │
   │  ...                        ║      │
   └──────────────────────────────────────┘
   ↓
3️⃣ Resultado consolidado:
   {
     codOT: "OT-2025-001",
     detallesGuardados: 8,
     errores: []
   }
```

### Ventajas de esta Estrategia

| Aspecto | Beneficio |
|---------|-----------|
| **Performance** | Los detalles se guardan en paralelo, no secuencialmente |
| **Resiliencia** | Si un detalle falla, los demás se siguen guardando |
| **Feedback** | El usuario ve cuántos detalles se guardaron vs errores |
| **Transaccionalidad parcial** | Encabezado siempre se guarda; detalles con manejo individual |

---

## 🏗️ Estructura de DTOs

### OrdenTrabajoEncabezadoDTO

```typescript
{
  tipo: number;              // Tipo de orden (0=Normal, 1=Especial, etc.)
  codOT: string;            // Código generado por backend (POST) o existente (PUT)
  codReserva: string;       // Código de reserva asociada
  codSuplidor: string;      // Código del suplidor asignado
  fecServicio: string;      // Fecha del servicio (YYYY-MM-DD)
  rutaCodigo: string;       // Código de ruta
  rotulacion: string;       // Rotulación del vehículo
  conexion: string;         // Información de conexión
  kmInicial: number;        // Kilometraje inicial
  kmFinal: number;          // Kilometraje final
  observaciones: string;    // Observaciones generales
  estado: string;           // PENDIENTE | ASIGNADA | EN PROCESO | FINALIZADA | ANULADA
  moneda: string;           // USD | EUR | DOP
  tCambio: number;          // Tipo de cambio
  totalOT: number;          // Total calculado de la orden
  operador: string;         // Usuario que crea/modifica
  fechaInicio: string;      // Fecha de inicio (timestamp)
  fechaFin: string;         // Fecha de fin
  nombreSuplidor: string;   // Nombre del suplidor (opcional)
  pageNumber: number;       // Para paginación (solo lectura)
  pageSize: number;         // Para paginación (solo lectura)
  respuesta: string;        // Mensaje de respuesta del backend
}
```

### OrdenTrabajoDetalleDTO

```typescript
{
  tipo: number;              // Tipo de detalle
  id: number;                // ID del detalle (generado por backend)
  codOT: string;             // ← IMPORTANTE: Código de OT (obtenido del POST encabezado)
  linea: number;             // Número de línea secuencial (1, 2, 3...)
  codReserva: string;        // Código de reserva origen
  idDetReserva: number;      // ID del detalle de reserva
  codServicio: string;       // Código del servicio
  nomServicio: string;       // Nombre del servicio
  origenTexto: string;       // ← Origen de la OT (puede diferir de reserva)
  destinoTexto: string;      // ← Destino de la OT (puede diferir de reserva)
  origenPlaceId: string;     // Google Place ID del origen
  destinoPlaceId: string;    // Google Place ID del destino
  origenLat: number;         // Latitud origen
  origenLng: number;         // Longitud origen
  destinoLat: number;        // Latitud destino
  destinoLng: number;        // Longitud destino
  horaPax: string;           // Hora del servicio
  adultos: number;           // Cantidad de adultos
  ninos: number;             // Cantidad de niños
  totalPax: number;          // Total de pasajeros
  boleta: string;            // Número de boleta
  voucher: string;           // Número de voucher
  agenciaCobro: string;      // Agencia de cobro
  estado: string;            // Estado del detalle
  observacion: string;       // Observaciones específicas
  operador: string;          // Usuario operador
  respuesta: string;         // Respuesta del backend
}
```

---

## 🔧 Métodos Implementados en OrdenesService

### 1. `guardarEncabezado(dto: OrdenTrabajoEncabezadoDTO)`

**Endpoint**: `POST http://localhost:5000/api/ordentrabajo`

**Propósito**: Crear el encabezado de la orden y obtener el `codOT` generado.

**Response**: 
```typescript
{
  codOT: "OT-2025-0001",
  respuesta: "Orden creada exitosamente"
}
```

---

### 2. `actualizarEncabezado(codOT: string, dto: OrdenTrabajoEncabezadoDTO)`

**Endpoint**: `PUT http://localhost:5000/api/ordentrabajo`

**Propósito**: Actualizar un encabezado existente.

---

### 3. `guardarDetalle(dto: OrdenTrabajoDetalleDTO)`

**Endpoint**: `POST http://localhost:5000/api/orden-trabajo/detalle`

**Propósito**: Guardar un detalle individual asociado a una orden mediante su `codOT`.

**Nota**: Este método se ejecuta **N veces en paralelo**, donde N = cantidad de servicios en la orden.

---

### 4. `guardarOrdenCompleta()` ⭐

**Propósito**: Método orquestador que coordina el guardado completo.

**Implementación**:

```typescript
guardarOrdenCompleta(
  encabezadoDTO: OrdenTrabajoEncabezadoDTO, 
  detalles: OrdenTrabajoDetalle[],
  operador: string = 'Admin'
): Observable<{ codOT: string; detallesGuardados: number; errores: any[] }>
```

**Flujo interno**:

```typescript
return this.guardarEncabezado(encabezadoDTO).pipe(
  switchMap(responseEncabezado => {
    const codOT = responseEncabezado.codOT;
    
    // Mapear detalles a DTOs con el codOT
    const detallesDTO = detalles.map((detalle, index) => 
      this.mapDetalleToDTO(detalle, codOT, index + 1, operador)
    );

    // Crear observables con manejo de errores individual
    const detalleObservables = detallesDTO.map(dto => 
      this.guardarDetalle(dto).pipe(
        map(() => ({ success: true, dto, error: null })),
        catchError(error => of({ success: false, dto, error }))
      )
    );

    // Ejecutar todas las llamadas EN PARALELO
    return forkJoin(detalleObservables).pipe(
      map(resultados => ({
        codOT,
        detallesGuardados: resultados.filter(r => r.success).length,
        errores: resultados.filter(r => !r.success)
      }))
    );
  })
);
```

**Características clave**:
- ✅ **Paralelización**: `forkJoin` ejecuta todas las llamadas simultáneamente
- ✅ **Resiliencia**: Si un detalle falla, no detiene el resto
- ✅ **Reporte detallado**: Retorna cantidad de éxitos y errores
- ✅ **Manejo de errores**: Cada detalle tiene su propio `catchError`

---

### 5. Métodos de Mapeo

#### `mapFormToEncabezadoDTO(formValue, detalles)`

Convierte los valores del formulario reactivo al DTO del encabezado.

**Lógica especial**:
- Calcula `totalOT` automáticamente desde los detalles
- Asigna valores por defecto (moneda=USD, tCambio=1)
- Usa `codReserva` del primer detalle si hay múltiples

```typescript
mapFormToEncabezadoDTO(formValue: any, detalles: OrdenTrabajoDetalle[]): OrdenTrabajoEncabezadoDTO {
  const totales = this.recalcularTotales(detalles, formValue.totalPagar);
  
  return {
    tipo: formValue.tipo ?? 0,
    codOT: '', // Se genera en backend
    codReserva: detalles[0]?.reservaId || '',
    codSuplidor: formValue.suplidor || '',
    fecServicio: formValue.fechaServicio || new Date().toISOString().split('T')[0],
    rutaCodigo: formValue.rutaCodigo || '',
    rotulacion: formValue.rotulacion || '',
    conexion: formValue.conexion || '',
    kmInicial: formValue.kmInicial || 0,
    kmFinal: formValue.kmFinal || 0,
    observaciones: formValue.observaciones || '',
    estado: formValue.estado || 'PENDIENTE',
    moneda: formValue.moneda || 'USD',
    tCambio: formValue.tCambio || 1,
    totalOT: totales.totalPagar, // ← Calculado
    operador: formValue.operador || 'Admin',
    fechaInicio: formValue.fechaCreacion || new Date().toISOString(),
    fechaFin: formValue.fechaServicio || new Date().toISOString().split('T')[0],
    nombreSuplidor: '',
    pageNumber: 0,
    pageSize: 0,
    respuesta: ''
  };
}
```

---

#### `mapDetalleToDTO(detalle, codOT, linea, operador)`

Convierte un `OrdenTrabajoDetalle` al DTO para la API.

**Lógica de origen/destino diferenciado**:

```typescript
origenTexto: detalle.origenOT || detalle.origenReserva || '',
destinoTexto: detalle.destinoOT || detalle.destinoReserva || '',
```

- Si el usuario editó `origenOT`/`destinoOT`, se usan esos valores
- Si no, se usan `origenReserva`/`destinoReserva` (backup)

---

## 🎨 Integración en el Componente

### Método `guardar()` Actualizado

```typescript
guardar(estado?: EstadoOrden): void {
  if (this.form.invalid || !this.detallesOrden.length) {
    this.form.markAllAsTouched();
    return;
  }

  const raw = this.form.getRawValue();
  const estadoFinal = estado ?? raw.estado ?? 'Pendiente';

  // 1. Preparar DTO
  const encabezadoDTO = this.ordenesService.mapFormToEncabezadoDTO(raw, this.detallesOrden);
  encabezadoDTO.estado = estadoFinal;

  // 2. Deshabilitar formulario
  this.form.disable();

  // 3. Mostrar loading con SweetAlert2
  const loadingAlert = Swal.fire({
    title: 'Guardando Orden de Trabajo...',
    html: `Guardando encabezado y ${this.detallesOrden.length} servicio(s)...`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  // 4. Guardar en API
  this.ordenesService.guardarOrdenCompleta(encabezadoDTO, this.detallesOrden, raw.operador || 'Admin')
    .subscribe({
      next: (resultado) => {
        loadingAlert.close();

        // Verificar errores parciales
        if (resultado.errores && resultado.errores.length > 0) {
          Swal.fire({
            title: 'Guardado con advertencias',
            html: `
              <p>Código de orden: <strong>${resultado.codOT}</strong></p>
              <p>${resultado.detallesGuardados} de ${this.detallesOrden.length} servicios guardados.</p>
              <p>Hubo ${resultado.errores.length} error(es).</p>
            `,
            icon: 'warning'
          });
        } else {
          // Todo exitoso
          Swal.fire({
            title: '¡Orden Guardada!',
            html: `
              <p>Código: <strong>${resultado.codOT}</strong></p>
              <p>${resultado.detallesGuardados} servicios guardados.</p>
            `,
            icon: 'success',
            timer: 2000
          });
        }

        // 5. Actualizar estado local (compatibilidad con mock)
        // ... código de actualización ...

        // 6. Navegar al listado
        setTimeout(() => {
          this.router.navigate(['/operaciones/ordenes-trabajo']);
        }, 2100);
      },
      error: (error) => {
        loadingAlert.close();
        this.form.enable();
        this.updateFormDisabledState();

        Swal.fire({
          title: 'Error al guardar',
          text: error.message,
          icon: 'error'
        });
      }
    });
}
```

---

## 📊 Escenarios de Uso

### Caso 1: Guardado Exitoso Total

```
INPUT: Orden con 5 servicios
RESULT:
  codOT: "OT-2025-0042"
  detallesGuardados: 5
  errores: []
  
UI: "¡Orden Guardada! 5 servicios guardados."
```

---

### Caso 2: Guardado con Errores Parciales

```
INPUT: Orden con 8 servicios
RESULT:
  codOT: "OT-2025-0043"
  detallesGuardados: 6
  errores: [
    { dto: {...}, error: "Servicio duplicado" },
    { dto: {...}, error: "Validación fallida" }
  ]
  
UI: "Guardado con advertencias. 6 de 8 servicios guardados. 2 errores."
```

---

### Caso 3: Error en Encabezado

```
INPUT: Orden con datos inválidos en encabezado
RESULT: Observable error en guardarEncabezado()
  
UI: "Error al guardar: El suplidor no existe"
ESTADO: Formulario se habilita nuevamente, no se guardan detalles
```

---

## ⚡ Optimizaciones Implementadas

### 1. Paralelización con `forkJoin`

**Problema**: Guardar 10 detalles secuencialmente = 10 × 200ms = 2 segundos

**Solución**: Guardar 10 detalles en paralelo = max(200ms) = 200ms

```typescript
// ❌ SECUENCIAL (lento)
for (const detalle of detalles) {
  await guardarDetalle(detalle); // Espera uno por uno
}

// ✅ PARALELO (rápido)
forkJoin(detalles.map(d => guardarDetalle(d)))
```

---

### 2. Manejo Resiliente de Errores

Cada detalle tiene su propio `catchError`, por lo que:
- ✅ Un error en detalle 3 NO detiene el guardado de los demás
- ✅ Se reporta qué detalles fallaron exactamente
- ✅ El usuario puede reintentar solo los fallidos (futuro MVP)

```typescript
catchError(error => of({ success: false, dto, error }))
// NO hace throwError, sino que retorna un observable con el error
```

---

### 3. Feedback en Tiempo Real

```typescript
Swal.fire({
  html: `Guardando encabezado y ${this.detallesOrden.length} servicio(s)...`
});
```

El usuario ve cuántos servicios se están guardando.

---

## 🔮 Mejoras Futuras

### Fase 2: Retry Automático

```typescript
guardarDetalle(dto).pipe(
  retry({ count: 3, delay: 1000 }) // Reintentar 3 veces con 1s de delay
)
```

---

### Fase 3: Progress Bar

```typescript
let guardados = 0;
detalleObservables.forEach((obs, i) => {
  obs.subscribe(() => {
    guardados++;
    Swal.update({
      html: `Guardando ${guardados}/${total} servicios...`
    });
  });
});
```

---

### Fase 4: Rollback de Encabezado

Si TODOS los detalles fallan, eliminar el encabezado creado:

```typescript
if (resultado.detallesGuardados === 0 && resultado.errores.length > 0) {
  // Llamar a DELETE /api/ordentrabajo/{codOT}
  this.eliminarEncabezado(resultado.codOT).subscribe();
}
```

---

## 🧪 Testing

### Test del Servicio

```typescript
it('debe guardar encabezado y detalles en paralelo', (done) => {
  const encabezado = {...};
  const detalles = [{...}, {...}, {...}];
  
  service.guardarOrdenCompleta(encabezado, detalles, 'TestUser')
    .subscribe(resultado => {
      expect(resultado.codOT).toBeTruthy();
      expect(resultado.detallesGuardados).toBe(3);
      expect(resultado.errores.length).toBe(0);
      done();
    });
});
```

---

### Test del Componente

```typescript
it('debe deshabilitar formulario durante guardado', fakeAsync(() => {
  component.guardar();
  expect(component.form.disabled).toBe(true);
  
  tick(1000);
  expect(component.form.disabled).toBe(false);
}));
```

---

## 📚 Referencias

- **RxJS forkJoin**: https://rxjs.dev/api/index/function/forkJoin
- **Angular HttpClient**: https://angular.io/guide/http
- **SweetAlert2**: https://sweetalert2.github.io/

---

## ✅ Checklist de Implementación

- [x] DTOs definidos (OrdenTrabajoEncabezadoDTO, OrdenTrabajoDetalleDTO)
- [x] Métodos HTTP (guardarEncabezado, guardarDetalle)
- [x] Método orquestador (guardarOrdenCompleta)
- [x] Mapeo form → DTO (mapFormToEncabezadoDTO)
- [x] Mapeo detalle → DTO (mapDetalleToDTO)
- [x] Integración en componente (método guardar)
- [x] SweetAlert2 para feedback
- [x] Manejo de errores con degradación parcial
- [x] Paralelización con forkJoin
- [ ] Tests unitarios
- [ ] Tests e2e
- [ ] Documentación de usuario

---

## 👥 Autor

Implementado por: GitHub Copilot  
Fecha: 2025-01-XX  
Versión: 1.0
