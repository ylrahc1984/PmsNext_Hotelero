/**
 * GUÍA RÁPIDA DE PRUEBA - Componente Monedas con API Real
 * 
 * Este archivo contiene ejemplos de cómo probar el componente
 * con la API configurada en `environment.apiUrl` (endpoint `/moneda`)
 */

import { environment } from 'src/environments/environment';

// ============================================
// 1. VERIFICAR QUE LA API ESTÁ CORRIENDO
// ============================================

/*
En la consola del navegador (F12), ejecutar:

fetch(`${environment.apiUrl}/moneda`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proceso: 90,
    codMoneda: '',
    moneda: '',
    simbolo: '',
    activo: 0,
    primario: 0,
    secundario: 0,
    orden: 0,
    operador: 'TEST',
    respuesta: ''
  })
})
.then(r => r.json())
.then(d => console.log('Respuesta API:', d))
.catch(e => console.error('Error:', e));

Resultado esperado: Array de objetos con estructura CA02_*
*/

// ============================================
// 2. EJEMPLO DE CONSULTA (PROCESO=90)
// ============================================

/*
REQUEST (Cliente → API):
{
  "proceso": 90,
  "codMoneda": "",
  "moneda": "",
  "simbolo": "",
  "activo": 0,
  "primario": 0,
  "secundario": 0,
  "orden": 0,
  "operador": "USUARIO_ACTUAL",
  "respuesta": ""
}

RESPONSE (API → Cliente):
[
  {
    "CA02_CodMoneda": "USD",
    "CA02_DesMoneda": "Dólar Estadounidense",
    "CA02_SimMoneda": "$",
    "CA02_Activo": 1,
    "CA02_Primaria": 1,
    "CA02_Secundario": 0,
    "CA02_Orden": 1,
    "CA02_IDMoneda": "US",
    "CA02_Operador": "SISTEMA"
  },
  {
    "CA02_CodMoneda": "EUR",
    "CA02_DesMoneda": "Euro",
    "CA02_SimMoneda": "€",
    "CA02_Activo": 1,
    "CA02_Primaria": 0,
    "CA02_Secundario": 0,
    "CA02_Orden": 2,
    "CA02_IDMoneda": "EU",
    "CA02_Operador": "SISTEMA"
  }
]

El componente las mapea al modelo interno (MonedaUI) automáticamente.
*/

// ============================================
// 3. EJEMPLO DE INSERT (PROCESO=1)
// ============================================

/*
REQUEST (Cliente → API):
{
  "proceso": 1,
  "codMoneda": "GBP",
  "moneda": "Libra Esterlina",
  "simbolo": "£",
  "activo": 1,
  "primario": 0,
  "secundario": 0,
  "orden": 3,
  "operador": "USUARIO_ACTUAL",
  "respuesta": ""
}

RESPONSE (API → Cliente):
{
  "respuesta": "Moneda creada exitosamente"
}
o
{
  "respuesta": "Error: La moneda ya existe"
}

El toast mostrará automáticamente el mensaje de respuesta.
*/

// ============================================
// 4. EJEMPLO DE UPDATE (PROCESO=2)
// ============================================

/*
REQUEST (Cliente → API):
{
  "proceso": 2,
  "codMoneda": "GBP",
  "moneda": "Libra Esterlina Británica",
  "simbolo": "£",
  "activo": 1,
  "primario": 0,
  "secundario": 0,
  "orden": 3,
  "operador": "USUARIO_ACTUAL",
  "respuesta": ""
}

RESPONSE (API → Cliente):
{
  "respuesta": "Moneda actualizada exitosamente"
}

La tabla se refresca automáticamente con los datos nuevos.
*/

// ============================================
// 5. EJEMPLO DE DELETE (PROCESO=3)
// ============================================

/*
REQUEST (Cliente → API):
{
  "proceso": 3,
  "codMoneda": "GBP",
  "moneda": "",
  "simbolo": "",
  "activo": 0,
  "primario": 0,
  "secundario": 0,
  "orden": 0,
  "operador": "USUARIO_ACTUAL",
  "respuesta": ""
}

RESPONSE (API → Cliente):
{
  "respuesta": "Moneda eliminada exitosamente"
}
o
{
  "respuesta": "Error: No se puede eliminar, la moneda está en uso"
}

Se muestra confirmación antes, y el toast informa el resultado.
*/

// ============================================
// 6. FLUJO DE PRUEBA MANUAL
// ============================================

/*
PASO 1: Cargar el componente
- Ir a: `/monedas` (normalmente con `ng serve` en el puerto 4200)
- Debería ver tabla vacía o con datos de la API
- Si hay error, revisar consola (F12)

PASO 2: Crear nueva moneda
- Click en "Nueva Moneda"
- Llenar:
  - Código: JPY
  - Moneda: Yen Japonés
  - Símbolo: ¥
  - Orden: 4
  - Activa: Sí
  - Primaria: No
  - Secundaria: No
- Click en "Crear Moneda"
- Debería aparecer en la tabla

PASO 3: Editar moneda
- Click en ícono de lápiz
- Cambiar nombre a "Yen Japonés Moderno"
- Click en "Actualizar Moneda"
- Tabla se actualiza

PASO 4: Eliminar moneda
- Click en ícono de papelera
- Confirmar en diálogo
- La fila desaparece de la tabla

PASO 5: Filtrar
- Escribir en búsqueda: "EUR"
- Debe mostrar solo EUR
- Cambiar filtro a "Inactivas"
- Debe mostrar solo inactivas
*/

// ============================================
// 7. VERIFICAR EN LA CONSOLA DEL NAVEGADOR
// ============================================

/*
Ejecutar después de cada operación:

// Ver datos cargados
console.log('Monedas:', this.monedas);

// Ver formulario
console.log('Form valid:', this.monedaForm.valid);
console.log('Form value:', this.monedaForm.value);

// Ver estado de carga
console.log('Is loading:', this.isLoading);
*/

// ============================================
// 8. ERRORES COMUNES Y SOLUCIONES
// ============================================

/*
ERROR: "Cannot read property 'CA02_CodMoneda' of undefined"
CAUSA: La respuesta de la API no tiene la estructura esperada
SOLUCIÓN: Verificar que la API devuelve un array con objetos CA02_*

ERROR: "No provider for HttpClient"
CAUSA: HttpClientModule no está importado
SOLUCIÓN: Verificar imports en el componente

ERROR: "operador es requerido pero está vacío"
CAUSA: El usuario no está autenticado
SOLUCIÓN: Iniciar sesión primero

ERROR: "La API no responde"
CAUSA: API no está corriendo en localhost:5000
SOLUCIÓN: Iniciar la API o verificar puerto

ERROR: "CORS error"
CAUSA: API no permite requests desde localhost:4200
SOLUCIÓN: Configurar CORS en la API
*/

// ============================================
// 9. ESTRUCTURA DE DATOS EN MEMORIA
// ============================================

/*
Después de loadMonedas(), el componente mantiene:

this.monedas: MonedaUI[] = [
  {
    codMoneda: "USD",
    moneda: "Dólar Estadounidense",
    simbolo: "$",
    activo: 1,
    primario: 1,
    secundario: 0,
    orden: 1,
    idISO: "US",
    operador: "SISTEMA"
  }
  // ... más monedas
]

this.filteredMonedas: MonedaUI[] = [
  // Monedas después de aplicar filtros
]

this.currentPage = 1
this.itemsPerPage = 10
this.totalPages = Math.ceil(monedas.length / 10)
*/

// ============================================
// 10. MÉTODOS PARA LLAMAR MANUALMENTE
// ============================================

/*
En la consola:

// Cargar todas las monedas
monedas.loadMonedas();

// Aplicar filtros
monedas.applyFilters();

// Ir a página 2
monedas.goToPage(2);

// Crear nueva moneda
monedas.createNewMoneda();

// Editar una moneda
monedas.editMoneda(monedas.filteredMonedas[0]);

// Guardar moneda actual
monedas.saveMoneda();

// Eliminar una moneda
monedas.deleteMoneda(monedas.filteredMonedas[0]);
*/

export const TESTING_NOTES = {
  apiUrl: `${environment.apiUrl}/moneda`,
  processes: {
    INSERT: 1,
    UPDATE: 2,
    DELETE: 3,
    QUERY: 90
  },
  fields: {
    codMoneda: 'string (ej: USD)',
    moneda: 'string (ej: Dólar Estadounidense)',
    simbolo: 'string (ej: $)',
    activo: 'number 0 o 1',
    primario: 'number 0 o 1',
    secundario: 'number 0 o 1',
    orden: 'number (ej: 1)',
    operador: 'string (del usuario autenticado)',
    respuesta: 'string (vacío en entrada, respuesta en salida)'
  },
  testData: {
    new: {
      codMoneda: 'JPY',
      moneda: 'Yen Japonés',
      simbolo: '¥',
      activo: 1,
      primario: 0,
      secundario: 0,
      orden: 4
    }
  }
};
