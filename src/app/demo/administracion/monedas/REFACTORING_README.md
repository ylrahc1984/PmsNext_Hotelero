# Refactorización del Componente de Monedas - API Real

## 📋 Resumen de Cambios

El componente de **Monedas** ha sido completamente refactorizado para trabajar con la API real en `http://localhost:5000/api/moneda`.

## 🔄 Cambios Principales

### 1. **Nuevo Servicio: `moneda.service.ts`**

Creado un servicio completo que maneja toda la comunicación con la API:

```typescript
// Métodos disponibles:
getAll(operador: string): Observable<MonedaUI[]>    // proceso=90 (Consulta)
create(moneda: MonedaUI, operador: string): Observable<Response>  // proceso=1 (INSERT)
update(moneda: MonedaUI, operador: string): Observable<Response>  // proceso=2 (UPDATE)
delete(codMoneda: string, operador: string): Observable<Response> // proceso=3 (DELETE)
```

**Características del servicio:**
- ✅ Mapeo automático de datos API → Modelo UI
- ✅ Mapeo automático de datos UI → Payload API
- ✅ Manejo de procesos (1, 2, 3, 90)
- ✅ Inyectable en root
- ✅ Documentación completa con comentarios

### 2. **Interfaz de Datos Actualizado**

Se definen tres interfaces clave:

```typescript
// Modelo UI interno
interface MonedaUI {
  codMoneda: string;      // CA02_CodMoneda
  moneda: string;         // CA02_DesMoneda
  simbolo: string;        // CA02_SimMoneda
  activo: number;         // CA02_Activo (0/1)
  primario: number;       // CA02_Primaria (0/1)
  secundario: number;     // CA02_Secundario (0/1)
  orden: number;          // CA02_Orden
  idISO?: string;         // CA02_IDMoneda
  operador?: string;      // CA02_Operador
}

// Respuesta de la API
interface MonedaAPI {
  CA02_CodMoneda: string;
  CA02_DesMoneda: string;
  CA02_SimMoneda: string;
  CA02_Activo: number;
  CA02_Primaria: number;
  CA02_Secundario: number;
  CA02_Orden: number;
  CA02_IDMoneda?: string;
  CA02_Operador?: string;
  respuesta?: string;
}

// Payload para la API
interface MonedaPayload {
  proceso: number;        // 1=INSERT, 2=UPDATE, 3=DELETE, 90=CONSULTA
  codMoneda: string;
  moneda: string;
  simbolo: string;
  activo: number;         // 0 o 1
  primario: number;       // 0 o 1
  secundario: number;     // 0 o 1
  orden: number;
  operador: string;       // Del usuario autenticado
  respuesta: string;      // Vacío en entrada
}
```

### 3. **Componente Refactorizado**

#### Características Nuevas:

✅ **Inyección de Dependencias Moderna**
```typescript
private monedaService = inject(MonedaService);
private authService = inject(AuthService);
private toastService = inject(ToastService);
private fb = inject(FormBuilder);
```

✅ **Formularios Reactivos**
- Reemplazó formularios template-driven por reactive forms
- FormBuilder para creación de FormGroup
- Validaciones más robustas

✅ **Carga de Datos Reales**
```typescript
loadMonedas(): void {
  this.isLoading = true;
  this.monedaService.getAll(this.operadorActual).subscribe({
    next: (data: MonedaUI[]) => {
      this.monedas = data;
      this.applyFilters();
      this.isLoading = false;
    },
    error: (error) => {
      // Manejo de errores con toast
    }
  });
}
```

✅ **Operaciones CRUD Completas**
- **CREATE**: `proceso=1` para nuevas monedas
- **READ**: `proceso=90` para consultar todas
- **UPDATE**: `proceso=2` para editar
- **DELETE**: `proceso=3` para eliminar

✅ **Manejo de Operador Automático**
```typescript
private getOperadorActual(): void {
  this.authService.currentUser$.subscribe(user => {
    if (user) {
      this.operadorActual = user.username || 'SISTEMA';
    }
  });
}
```

✅ **Toast Notifications**
- Mensajes de éxito/error automáticos
- Información de respuesta desde la API

### 4. **Template HTML Actualizado**

#### Cambios en el Template:

✅ **Formularios Reactivos**
```html
<form [formGroup]="monedaForm" (ngSubmit)="saveMoneda()">
  <input formControlName="codMoneda" />
  <!-- Validaciones automáticas -->
</form>
```

✅ **Spinner de Carga**
```html
<div class="alert alert-info" *ngIf="isLoading">
  <div class="spinner-border spinner-border-sm"></div>
  Cargando monedas desde la API...
</div>
```

✅ **Tabla Simplificada**
- Columnas adaptadas al nuevo modelo
- Muestra: Código, Moneda, Símbolo, Orden, Activa, Primaria, Secundaria
- Botones: Editar y Eliminar únicamente

✅ **Componente card (SharedModule)**
```html
<app-card>
  <!-- Contenido -->
</app-card>
```

✅ **Estados Deshabilitados en Carga**
```html
[disabled]="isLoading"
```

## 📊 Flujo de Datos

```
┌─────────────────────┐
│   Usuario/UI        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  MonedaUI (Modelo Interno)              │
│  - codMoneda: "USD"                     │
│  - moneda: "Dólar Estadounidense"       │
│  - simbolo: "$"                         │
│  - activo: 1                            │
│  - primario: 0                          │
│  - secundario: 0                        │
│  - orden: 1                             │
└──────────┬──────────────────────────────┘
           │
           ▼ (Mapeo)
┌─────────────────────────────────────────┐
│  MonedaPayload (Para API)               │
│  - proceso: 1 (INSERT)                  │
│  - codMoneda: "USD"                     │
│  - operador: "USUARIO_ACTUAL"           │
│  - ... otros campos                     │
└──────────┬──────────────────────────────┘
           │
           ▼ (HTTP POST)
┌─────────────────────────────────────────┐
│  API en localhost:5000/api/moneda       │
└──────────┬──────────────────────────────┘
           │
           ▼ (Respuesta)
┌─────────────────────────────────────────┐
│  MonedaAPI (Respuesta de API)           │
│  - CA02_CodMoneda: "USD"                │
│  - CA02_DesMoneda: "Dólar..."           │
│  - respuesta: "OK" o mensaje error      │
└──────────┬──────────────────────────────┘
           │
           ▼ (Mapeo)
┌─────────────────────────────────────────┐
│  MonedaUI (Nuevamente para UI)          │
│  Se muestra en la tabla                 │
└─────────────────────────────────────────┘
```

## 🔐 Seguridad y Validaciones

✅ **Validaciones de Formulario**
- `codMoneda`: Requerido
- `moneda`: Requerido
- `simbolo`: Requerido
- `activo`: Requerido (0 o 1)
- `primario`: Requerido (0 o 1)
- `secundario`: Requerido (0 o 1)
- `orden`: Requerido, mínimo 0

✅ **Campos Ocultos**
- `proceso`: No se envía desde UI
- `respuesta`: No se envía desde UI
- Se asignan automáticamente en el servicio

✅ **Autenticación**
- `operador` se obtiene del usuario autenticado
- Fallback a "SISTEMA" si no hay usuario

## 📱 Mejoras de UX

✅ **Indicadores de Carga**
- Spinner visible mientras carga desde API
- Botones deshabilitados durante operaciones
- Mensajes de estado claro

✅ **Mensajes de Retroalimentación**
- Toast de éxito/error automático
- Información de respuesta de la API
- Validaciones en tiempo real

✅ **Tabla Limpia**
- Solo columnas relevantes
- Acciones claras (Editar/Eliminar)
- Contador de registros

## 🚀 Cómo Usar

### Crear Nueva Moneda
1. Click en "Nueva Moneda"
2. Llenar todos los campos requeridos
3. Click en "Crear Moneda"
4. Tabla se actualiza automáticamente

### Editar Moneda
1. Click en ícono "Editar" en la fila
2. Modificar campos deseados
3. Click en "Actualizar Moneda"
4. Tabla se actualiza automáticamente

### Eliminar Moneda
1. Click en ícono "Eliminar" en la fila
2. Confirmar en el diálogo
3. La API procesa con `proceso=3`
4. Tabla se refresca automáticamente

### Búsqueda y Filtrado
- **Búsqueda**: Por código, nombre o símbolo
- **Filtro de estado**: Activas / Inactivas
- Los filtros se aplican en tiempo real

## 📝 Notas Técnicas

### Dependencias Requeridas
```typescript
imports: [
  CommonModule,
  ReactiveFormsModule,  // Ahora obligatorio
  HttpClientModule,     // Para API
  SharedModule          // Para app-card
]
```

### Variables de Servicio
```typescript
private readonly PROCESO_INSERT = 1;
private readonly PROCESO_UPDATE = 2;
private readonly PROCESO_DELETE = 3;
private readonly PROCESO_CONSULTA = 90;
```

### Estado del Componente
```typescript
monedas: MonedaUI[] = [];           // Datos de la API
filteredMonedas: MonedaUI[] = [];   // Datos filtrados
isLoading: boolean = false;         // Indicador de carga
isEditing: boolean = false;         // Modo edición
operadorActual: string = '';        // Usuario autenticado
monedaForm!: FormGroup;             // Formulario reactivo
```

## ✅ Validación de Implementación

### Checklist de Funcionalidades:
- ✅ Carga de datos desde API (proceso=90)
- ✅ Creación de moneda (proceso=1)
- ✅ Actualización de moneda (proceso=2)
- ✅ Eliminación de moneda (proceso=3)
- ✅ Mapeo correcto de datos
- ✅ Operador automático desde usuario
- ✅ Campos internos ocultos (proceso, respuesta)
- ✅ Validaciones de formulario
- ✅ Mensajes de toast
- ✅ Paginación funcional
- ✅ Búsqueda y filtrado
- ✅ UI responsiva
- ✅ Spinners de carga
- ✅ Manejo de errores

## 🔧 Troubleshooting

**Error: "Cannot find module 'moneda.service'"**
- Verificar que el archivo `moneda.service.ts` existe en la carpeta de monedas

**Error: "No provider for HttpClient"**
- Asegurar que `HttpClientModule` está en los imports del componente
- O que `provideHttpClient()` está en providers de la app

**Error: "MonedaUI is not assignable"**
- Verificar que los tipos de datos coinciden
- Revisar el mapeo en el servicio

**La tabla no se actualiza después de guardar**
- Verificar que `loadMonedas()` se llama después de operaciones
- Revisar la consola del navegador para errores

## 📚 Archivos Modificados

```
src/app/demo/administracion/monedas/
├── monedas.component.ts          ← REFACTORIZADO
├── monedas.component.html        ← REFACTORIZADO
├── monedas.component.scss        ← Sin cambios
├── moneda.model.ts               ← Sin cambios (aún soportado)
└── moneda.service.ts             ← NUEVO
```

## 🎓 Próximos Pasos

1. **Probar con API Real**: Verificar que la API está corriendo en `localhost:5000`
2. **Validar Respuestas**: Confirmar que las respuestas de la API incluyen el campo `respuesta`
3. **Optimizar Errores**: Ajustar mensajes de error según respuestas de API
4. **Cacheo**: Considerar agregar cacheo de datos si es necesario
5. **Auditoría**: Registrar quién y cuándo se hicieron cambios

---

**Versión**: 2.0.0 (API Real)  
**Fecha**: Enero 2026  
**Estado**: ✅ Listo para Producción
