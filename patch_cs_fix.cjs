const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySettings.tsx', 'utf8');

code = code.replace(
  "return (\n    <div className=\"max-w-3xl mx-auto space-y-6\">\n      <div className=\"bg-white p-6 rounded-2xl shadow-sm border border-gray-100\">",
  "return (\n    <>\n    <div className=\"max-w-3xl mx-auto space-y-6\">\n      <div className=\"bg-white p-6 rounded-2xl shadow-sm border border-gray-100\">"
);

code = code.replace(
  "</button>\n      </div>\n    </div>\n  );\n}",
  "</button>\n      </div>\n    </div>\n    </>\n  );\n}"
);

fs.writeFileSync('src/components/CompanySettings.tsx', code);
