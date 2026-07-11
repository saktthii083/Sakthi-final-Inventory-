const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySettings.tsx', 'utf8');
code = code.replace("    </div>\n    </>\n  );\n}", "    </>\n  );\n}");
fs.writeFileSync('src/components/CompanySettings.tsx', code);
