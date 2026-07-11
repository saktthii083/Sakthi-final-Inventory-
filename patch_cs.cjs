const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySettings.tsx', 'utf8');

code = code.replace(
  "onSave: (details: CompanyDetails) => Promise<void>;",
  "onSave: (details: CompanyDetails) => Promise<void>;\n  onCleanDuplicates?: () => Promise<void>;"
);

code = code.replace(
  "CompanySettings({ language, companyDetails, onSave }: CompanySettingsProps) {",
  "CompanySettings({ language, companyDetails, onSave, onCleanDuplicates }: CompanySettingsProps) {\n  const [isCleaning, setIsCleaning] = React.useState(false);"
);

const btnHtml = `
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {language === 'en' ? 'System Maintenance' : 'கணினி பராமரிப்பு'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {language === 'en' 
            ? 'Clean up duplicate system logs (e.g., duplicate INITIAL STOCK entries) to reduce backend database reads and improve loading performance.' 
            : 'பின்னணி தரவுத்தள வாசிப்புகளைக் குறைக்கவும் செயல்திறனை மேம்படுத்தவும் நகல் கணினி பதிவுகளை (எ.கா. INITIAL STOCK) அழிக்கவும்.'}
        </p>
        <button
          onClick={async () => {
            if (onCleanDuplicates) {
              setIsCleaning(true);
              await onCleanDuplicates();
              setIsCleaning(false);
              alert(language === 'en' ? 'Cleanup complete!' : 'சுத்தம் முடிந்தது!');
            }
          }}
          disabled={isCleaning}
          className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg font-medium hover:bg-amber-200 disabled:opacity-50"
        >
          {isCleaning ? (language === 'en' ? 'Cleaning...' : 'சுத்தம் செய்கிறது...') : (language === 'en' ? 'Clean Duplicate Logs' : 'நகல் பதிவுகளை அழி')}
        </button>
      </div>
`;

code = code.replace(
  "</form>\n    </div>\n  );\n}",
  "</form>\n    </div>\n" + btnHtml + "\n    </div>\n  );\n}"
);

// We also need to add a wrapper div around the whole component content since we are returning two siblings
code = code.replace(
  "return (\n    <div className=\"max-w-3xl mx-auto space-y-6\">\n      <div className=\"bg-white p-6 rounded-2xl shadow-sm border border-gray-100\">",
  "return (\n    <div className=\"max-w-3xl mx-auto space-y-6\">\n      <div className=\"bg-white p-6 rounded-2xl shadow-sm border border-gray-100\">"
);

fs.writeFileSync('src/components/CompanySettings.tsx', code);
