const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update imports
code = code.replace(
  "doc, getDocs, getDoc, setDoc",
  "doc, getDocs, getDoc, setDoc, orderBy, limit, getAggregateFromServer, sum"
);

// Add totalSalesAggregate state
code = code.replace(
  "const [deletionPower, setDeletionPower] = useState(false);",
  "const [deletionPower, setDeletionPower] = useState(false);\n  const [totalSalesAggregate, setTotalSalesAggregate] = useState<number>(0);"
);

// handleForceRefresh
code = code.replace(
  "const txQuery = query(collection(db, 'transactions'), where('userId', '==', uId));",
  "const txQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(150));"
);
code = code.replace(
  "const billQuery = query(collection(db, 'bills'), where('userId', '==', uId));",
  "const billQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(100));"
);

// Sync Transactions (Ledger)
code = code.replace(
  "const txQuery = query(collection(db, 'transactions'), where('userId', '==', uId));",
  "const txQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(150));"
);

// Sync Bills
code = code.replace(
  "const billQuery = query(collection(db, 'bills'), where('userId', '==', uId));",
  "const billQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(100));"
);

// Add aggregate query in handleForceRefresh
code = code.replace(
  "setTransactions(cleanedTxs);",
  "setTransactions(cleanedTxs);\n\n      const aggQuery = query(collection(db, 'transactions'), where('type', '==', 'sales'));\n      const aggSnap = await getAggregateFromServer(aggQuery, { total: sum('total') });\n      setTotalSalesAggregate(aggSnap.data().total || 0);"
);

// In useEffect
code = code.replace(
  "const cleanedTxs = fetchedTxs.filter(tx => !duplicateIdsToHide.has(tx.id!));\n        setTransactions(cleanedTxs);\n      }, (error) => {\n        handleSyncError(error, 'Transactions');\n      });",
  "const cleanedTxs = fetchedTxs.filter(tx => !duplicateIdsToHide.has(tx.id!));\n        setTransactions(cleanedTxs);\n      }, (error) => {\n        handleSyncError(error, 'Transactions');\n      });\n\n      // Fetch Total Sales Aggregate\n      getAggregateFromServer(query(collection(db, 'transactions'), where('type', '==', 'sales')), {\n        total: sum('total')\n      }).then(snap => {\n        setTotalSalesAggregate(snap.data().total || 0);\n      }).catch(err => console.error('Aggregate error:', err));"
);

// Pass totalSalesAggregate to Dashboard
code = code.replace(
  "bills={bills}",
  "bills={bills}\n                  totalSalesAggregate={totalSalesAggregate}"
);

fs.writeFileSync('src/App.tsx', code);
