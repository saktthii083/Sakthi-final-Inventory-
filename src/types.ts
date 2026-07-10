export interface Product {
  id?: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minStock: number;
  sellingPrice: number;
  purchasePrice: number;
  unit: string;
  location: string;
  description: string;
  userId: string;
  updatedAt: string;
  material?: string;
  gsm?: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  maxDiscount?: number;
}

export interface UserProfile {
  uid: string;
  userId?: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  updatedAt: string;
}

export interface Transaction {
  id?: string;
  type: 'inward' | 'sales' | 'deleted' | 'edited';
  sku: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  referenceNo: string;
  counterParty: string; // Supplier (inward) or Customer (sales)
  paymentMethod: string; // Cash, Card, UPI, etc.
  date: string;
  userId: string;
  createdByEmail?: string;
}

export interface BillItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  unit: string;
}

export interface Bill {
  id?: string;
  billNo: string;
  items: BillItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  customerName: string;
  customerPhone?: string;
  customerGst?: string;
  customerAddress?: string;
  paymentMethod: string;
  date: string;
  userId: string;
}

export type Language = 'en' | 'ta';

export interface TranslationSet {
  inventoryApp: string;
  stockManagement: string;
  barcodeScanner: string;
  reports: string;
  inward: string;
  sales: string;
  billing: string;
  dashboard: string;
  login: string;
  logout: string;
  productName: string;
  skuBarcode: string;
  category: string;
  quantity: string;
  minStock: string;
  sellingPrice: string;
  purchasePrice: string;
  maxDiscount: string;
  unit: string;
  location: string;
  description: string;
  actions: string;
  addStock: string;
  outOfStock: string;
  lowStock: string;
  searchProduct: string;
  add: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  scanBarcode: string;
  cameraAccessNeeded: string;
  enterSkuManually: string;
  startScanning: string;
  stopScanning: string;
  supplier: string;
  customer: string;
  referenceNo: string;
  paymentMethod: string;
  date: string;
  addTransaction: string;
  totalValue: string;
  topSelling: string;
  stockLevels: string;
  lowStockAlert: string;
  billingInvoice: string;
  billNo: string;
  subtotal: string;
  discount: string;
  gst: string;
  grandTotal: string;
  printBill: string;
  saveBill: string;
  addToBill: string;
  selectProduct: string;
  clearBill: string;
  allProducts: string;
  lowStockOnly: string;
  welcome: string;
  signInWithGoogle: string;
  guestMode: string;
  success: string;
  error: string;
  loading: string;
  english: string;
  tamil: string;
  material: string;
  gsm: string;
  color: string;
  size: string;
  manufacturingCost: string;
}
