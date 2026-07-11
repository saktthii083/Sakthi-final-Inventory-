const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const cleanFunc = `
  const handleCleanDuplicates = async () => {
    if (userRole !== 'admin') return;
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', 'bd0jbxr3P0aaiOB5ou6EwiZnhq43'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(docSnap => {
        const ref = docSnap.data().referenceNo;
        if (ref === 'INITIAL STOCK ADDED' || ref === 'INITIAL-STOCK' || ref === 'INITIAL-STOCK-ADDED') {
          batch.delete(docSnap.ref);
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(\`Deleted \${count} duplicates\`);
      }
    } catch (err) {
      console.error('Error cleaning duplicates:', err);
      alert('Error cleaning duplicates. See console.');
    }
  };

  const handleSaveCompanyDetails = async`;

code = code.replace("  const handleSaveCompanyDetails = async", cleanFunc);

code = code.replace(
  "onSave={handleSaveCompanyDetails}\n                />",
  "onSave={handleSaveCompanyDetails}\n                  onCleanDuplicates={handleCleanDuplicates}\n                />"
);

// We need to make sure `writeBatch` is imported from firebase/firestore
if (!code.includes('writeBatch')) {
  code = code.replace("getDocs,", "getDocs, writeBatch,");
}

fs.writeFileSync('src/App.tsx', code);
