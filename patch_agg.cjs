const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "const aggQuery = query(collection(db, 'transactions'), where('type', '==', 'sales'));",
  "const aggQuery = query(collection(db, 'transactions'), where('userId', '==', uId), where('type', '==', 'sales'));"
);

code = code.replace(
  "getAggregateFromServer(query(collection(db, 'transactions'), where('type', '==', 'sales')), {",
  "getAggregateFromServer(query(collection(db, 'transactions'), where('userId', '==', uId), where('type', '==', 'sales')), {"
);

fs.writeFileSync('src/App.tsx', code);
