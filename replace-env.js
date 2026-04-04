const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'src', 'assets', 'env.template.js');
const outputPath = path.join(__dirname, 'dist', 'assets', 'env.js');

// Validaciones
if (!process.env.API_URL) {
  console.error('❌ ERROR: API_URL no está definida');
  process.exit(1);
}

if (!fs.existsSync(templatePath)) {
  console.error('❌ ERROR: env.template.js no existe');
  process.exit(1);
}

// Leer template
const template = fs.readFileSync(templatePath, 'utf8');

// Reemplazar variable
const result = template.split('${API_URL}').join(process.env.API_URL);

// Escribir archivo final
fs.writeFileSync(outputPath, result, 'utf8');

console.log('✅ env.js generado correctamente');
console.log('📍', outputPath);
console.log('🌐 API:', process.env.API_URL);