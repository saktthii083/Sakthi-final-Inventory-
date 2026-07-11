const fs = require('fs');
let code = fs.readFileSync('src/components/CompanySettings.tsx', 'utf8');

// I will just remove the stuff I appended and put it properly.
const badCodeStart = '      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">';

let idx = code.lastIndexOf(badCodeStart);
if(idx !== -1) {
    code = code.substring(0, idx).trim();
}

// Now I will append the proper code right before the last closing div of the main return
const cleanCode = `

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {language === 'en' ? 'System Maintenance' : 'கணினி பராமரிப்பு'}
        </h2>
        <p className="text-sm text-gray-500 mb-4 font-medium leading-relaxed">
          {language === 'en' 
            ? 'Clean up duplicate system logs (e.g., duplicate INITIAL STOCK entries) to reduce backend database reads and improve loading performance. If opening the app causes high reads, this will reduce them.' 
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
          className="flex items-center gap-2 px-6 py-3 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-200 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isCleaning ? (language === 'en' ? 'Cleaning...' : 'சுத்தம் செய்கிறது...') : (language === 'en' ? 'Clean Duplicate Logs' : 'நகல் பதிவுகளை அழி')}
        </button>
      </div>
    </div>
  );
}
`;

// remove the last `</div>\n  );\n}` from code
code = code.replace(/<\/div>\s*\);\s*}\s*$/, cleanCode);

fs.writeFileSync('src/components/CompanySettings.tsx', code);
