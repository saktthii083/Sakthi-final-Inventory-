const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
if (!code.includes('writeBatch')) {
  code = code.replace("import { collection, query, where, getDocs", "import { collection, query, where, getDocs, writeBatch");
} else if (!code.includes('writeBatch,')) {
  code = code.replace("getDocs, ", "getDocs, writeBatch, ");
}
fs.writeFileSync('src/App.tsx', code);
