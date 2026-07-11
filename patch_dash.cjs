const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  "onAddUser?: (newUser: Omit<UserProfile, 'updatedAt'>) => Promise<void>;",
  "onAddUser?: (newUser: Omit<UserProfile, 'updatedAt'>) => Promise<void>;\n  totalSalesAggregate?: number;"
);

code = code.replace(
  "usersList, onUpdateUserRole, onDeleteUser, onAddUser",
  "usersList, onUpdateUserRole, onDeleteUser, onAddUser, totalSalesAggregate"
);

code = code.replace(
  "// Total Sales (sum of totals of outward/sales transactions)\n  const totalSalesRevenue = transactions\n    .filter(tx => tx.type === 'sales')\n    .reduce((sum, tx) => sum + tx.total, 0);",
  "// Total Sales (sum of totals of outward/sales transactions)\n  const totalSalesRevenue = totalSalesAggregate !== undefined\n    ? totalSalesAggregate\n    : transactions.filter(tx => tx.type === 'sales').reduce((sum, tx) => sum + tx.total, 0);"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
