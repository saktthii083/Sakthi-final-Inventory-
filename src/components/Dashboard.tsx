import React from 'react';
import { Product, Transaction, Language, Bill, UserProfile } from '../types';
import { translations } from '../translations';
import { 
  Package, AlertTriangle, ShoppingBag, X, Trash2, Lock, ArrowDownUp, Search, Users, UserPlus, User, ChevronRight,
  Layers, Sliders, Palette, Ruler, MapPin, Activity, Tag
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  language: Language;
  products: Product[];
  transactions: Transaction[];
  bills: Bill[];
  userRole?: 'admin' | 'user' | null;
  deletionPower?: boolean;
  onDeleteBill?: (id: string, billNo: string) => Promise<void>;
  onDeleteTransaction?: (id: string) => Promise<void>;
  usersList?: UserProfile[];
  onUpdateUserRole?: (targetUid: string, newRole: 'admin' | 'user') => Promise<void>;
  onDeleteUser?: (targetUid: string) => Promise<void>;
  onAddUser?: (newUser: Omit<UserProfile, 'updatedAt'>) => Promise<void>;
  totalSalesAggregate?: number;
}

export default function Dashboard({ 
  language, products, transactions, bills, userRole, deletionPower, onDeleteBill, onDeleteTransaction,
  usersList, onUpdateUserRole, onDeleteUser, onAddUser, totalSalesAggregate
}: DashboardProps) {
  const t = translations[language];
  const [selectedBill, setSelectedBill] = React.useState<Bill | null>(null);
  const [selectedUserToEdit, setSelectedUserToEdit] = React.useState<UserProfile | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  // Product Breakdown Analytics state
  const [selectedProductName, setSelectedProductName] = React.useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = React.useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = React.useState<boolean>(false);
  const [selectedColorFilter, setSelectedColorFilter] = React.useState<string>('all');
  const [selectedGsmFilter, setSelectedGsmFilter] = React.useState<string>('all');
  const [selectedMaterialFilter, setSelectedMaterialFilter] = React.useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState<string>('all');
  const [largeImageUrl, setLargeImageUrl] = React.useState<string | null>(null);

  // Add User Modal State
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [newUserEmail, setNewUserEmail] = React.useState('');
  const [newUserDisplayName, setNewUserDisplayName] = React.useState('');
  const [newUserRole, setNewUserRole] = React.useState<'admin' | 'user'>('user');
  const [newUserUid, setNewUserUid] = React.useState('');

  const openAddUserModal = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    setNewUserUid(`USR-${randomSuffix}`);
    setNewUserEmail('');
    setNewUserDisplayName('');
    setNewUserRole('user');
    setIsAddUserOpen(true);
  };

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserDisplayName.trim()) {
      alert(language === 'en' ? "Please fill in all fields!" : "அனைத்து விவரங்களையும் உள்ளிடவும்!");
      return;
    }
    if (onAddUser) {
      await onAddUser({
        uid: newUserUid.trim(),
        email: newUserEmail.trim(),
        displayName: newUserDisplayName.trim(),
        role: newUserRole
      });
      setIsAddUserOpen(false);
    }
  };

  // Helper formatting for currency
  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- RECENT SALES (LAST WEEK) ---
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);

  const recentBills = [...(bills || [])]
    .filter(b => {
      const billDate = new Date(b.date);
      return billDate >= oneWeekAgo;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- STATS COMPUTATION ---
  
  // Total Products Count
  const totalProducts = products.length;

  // Total Stock Valuation (quantity * purchasePrice)
  const totalStockValue = products.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0);

  // Total Sales (sum of totals of outward/sales transactions)
  const totalSalesRevenue = totalSalesAggregate !== undefined
    ? totalSalesAggregate
    : transactions.filter(tx => tx.type === 'sales').reduce((sum, tx) => sum + tx.total, 0);

  // Low Stock Count (quantity <= minStock)
  const lowStockItems = products.filter(item => item.quantity <= item.minStock);
  const lowStockCount = lowStockItems.length;

  // Out of Stock Count (quantity === 0)
  const outOfStockCount = products.filter(item => item.quantity === 0).length;

  // --- CHART 1: Category Stock Levels ---
  const categoryDataMap: Record<string, { name: string; quantity: number; value: number }> = {};
  products.forEach(p => {
    const cat = p.category || 'Other';
    if (!categoryDataMap[cat]) {
      categoryDataMap[cat] = { name: cat, quantity: 0, value: 0 };
    }
    categoryDataMap[cat].quantity += p.quantity;
    categoryDataMap[cat].value += (p.quantity * p.purchasePrice);
  });
  const categoryData = Object.values(categoryDataMap);

  // --- CHART 2: Sales Trend (Grouped by Date) ---
  const salesTrendMap: Record<string, { date: string; amount: number; count: number }> = {};
  
  // Sort transactions to get chronological trend
  const sortedSales = [...transactions]
    .filter(tx => tx.type === 'sales')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedSales.forEach(tx => {
    // Format to short date e.g. "Jul 05" or "YYYY-MM-DD"
    const dateStr = new Date(tx.date).toLocaleDateString(
      language === 'ta' ? 'ta-IN' : 'en-US', 
      { month: 'short', day: 'numeric' }
    );
    if (!salesTrendMap[dateStr]) {
      salesTrendMap[dateStr] = { date: dateStr, amount: 0, count: 0 };
    }
    salesTrendMap[dateStr].amount += tx.total;
    salesTrendMap[dateStr].count += tx.quantity;
  });
  const salesTrendData = Object.values(salesTrendMap).slice(-7); // take last 7 data points

  // --- CHART 3: Top Selling Products ---
  const topSellersMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  transactions
    .filter(tx => tx.type === 'sales')
    .forEach(tx => {
      if (!topSellersMap[tx.sku]) {
        topSellersMap[tx.sku] = { name: tx.productName, quantity: 0, revenue: 0 };
      }
      topSellersMap[tx.sku].quantity += tx.quantity;
      topSellersMap[tx.sku].revenue += tx.total;
    });
  const topSellersData = Object.values(topSellersMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // top 5 sellers

  // --- DYNAMIC PRODUCT BREAKDOWN ANALYTICS ---
  // List of all unique product names
  const uniqueProductNames = React.useMemo(() => {
    const names = new Set(products.map(p => p.name).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Handle auto-selection of product name if not set
  React.useEffect(() => {
    if (uniqueProductNames.length > 0 && (!selectedProductName || !uniqueProductNames.includes(selectedProductName))) {
      setSelectedProductName(uniqueProductNames[0]);
    }
  }, [uniqueProductNames, selectedProductName]);

  // Filter unique product names by search query
  const filteredProductNames = React.useMemo(() => {
    const q = searchProductQuery.toLowerCase().trim();
    if (!q) return uniqueProductNames;
    return uniqueProductNames.filter(name => name.toLowerCase().includes(q));
  }, [uniqueProductNames, searchProductQuery]);

  // List of all unique colors for selected product name
  const availableColorsForSelectedProduct = React.useMemo(() => {
    if (!selectedProductName) return [];
    const colors = new Set(
      products
        .filter(p => p.name === selectedProductName)
        .map(p => p.color?.trim())
        .filter(Boolean)
    );
    return Array.from(colors).sort((a, b) => a.localeCompare(b));
  }, [products, selectedProductName]);

  // List of all unique GSM values for selected product name
  const availableGsmForSelectedProduct = React.useMemo(() => {
    if (!selectedProductName) return [];
    const gsms = new Set(
      products
        .filter(p => p.name === selectedProductName)
        .map(p => p.gsm?.trim())
        .filter(Boolean)
    );
    return Array.from(gsms).sort((a, b) => a.localeCompare(b));
  }, [products, selectedProductName]);

  // List of all unique Material values for selected product name
  const availableMaterialsForSelectedProduct = React.useMemo(() => {
    if (!selectedProductName) return [];
    const materials = new Set(
      products
        .filter(p => p.name === selectedProductName)
        .map(p => p.material?.trim())
        .filter(Boolean)
    );
    return Array.from(materials).sort((a, b) => a.localeCompare(b));
  }, [products, selectedProductName]);

  // List of all unique Category values for selected product name
  const availableCategoriesForSelectedProduct = React.useMemo(() => {
    if (!selectedProductName) return [];
    const categories = new Set(
      products
        .filter(p => p.name === selectedProductName)
        .map(p => p.category?.trim())
        .filter(Boolean)
    );
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [products, selectedProductName]);

  // Find matching image url for selected product and color
  const selectedProductImage = React.useMemo(() => {
    if (!selectedProductName) return null;
    
    // First, find a product with both name matching and color matching that has an imageUrl
    if (selectedColorFilter && selectedColorFilter !== 'all') {
      const exactMatch = products.find(p => p.name === selectedProductName && p.color === selectedColorFilter && p.imageUrl);
      if (exactMatch) return exactMatch.imageUrl;
    }
    
    // If no exact match (or 'all' colors selected), find ANY product under this name with an imageUrl
    const fallbackMatch = products.find(p => p.name === selectedProductName && p.imageUrl);
    return fallbackMatch ? fallbackMatch.imageUrl : null;
  }, [products, selectedProductName, selectedColorFilter]);

  // Reset filters when product name changes
  React.useEffect(() => {
    setSelectedColorFilter('all');
    setSelectedGsmFilter('all');
    setSelectedMaterialFilter('all');
    setSelectedCategoryFilter('all');
  }, [selectedProductName]);

  // Color mapping for graphs & indicators matching user selected color
  const activeColorDetails = React.useMemo(() => {
    if (!selectedColorFilter || selectedColorFilter === 'all') {
      return {
        primary: '#4f46e5',
        secondary: '#818cf8',
        tailwindBg: 'bg-indigo-600',
        tailwindDot: 'bg-indigo-500',
        customStyles: false
      };
    }

    const normalized = selectedColorFilter.trim().toLowerCase();
    
    // Mapping of common Tamil/English names to colors
    const colorMap: Record<string, { primary: string; secondary: string; tailwindBg: string; tailwindDot: string; customStyles: boolean }> = {
      // English
      red: { primary: '#ef4444', secondary: '#fca5a5', tailwindBg: 'bg-red-600', tailwindDot: 'bg-red-500', customStyles: false },
      blue: { primary: '#3b82f6', secondary: '#93c5fd', tailwindBg: 'bg-blue-600', tailwindDot: 'bg-blue-500', customStyles: false },
      green: { primary: '#22c55e', secondary: '#86efac', tailwindBg: 'bg-green-600', tailwindDot: 'bg-green-500', customStyles: false },
      yellow: { primary: '#eab308', secondary: '#fde047', tailwindBg: 'bg-yellow-500', tailwindDot: 'bg-yellow-400', customStyles: false },
      black: { primary: '#1e293b', secondary: '#475569', tailwindBg: 'bg-slate-800', tailwindDot: 'bg-slate-700', customStyles: false },
      white: { primary: '#94a3b8', secondary: '#cbd5e1', tailwindBg: 'bg-slate-400', tailwindDot: 'bg-slate-300', customStyles: false },
      orange: { primary: '#f97316', secondary: '#fdba74', tailwindBg: 'bg-orange-600', tailwindDot: 'bg-orange-500', customStyles: false },
      pink: { primary: '#ec4899', secondary: '#f9a8d4', tailwindBg: 'bg-pink-600', tailwindDot: 'bg-pink-500', customStyles: false },
      purple: { primary: '#a855f7', secondary: '#d8b4fe', tailwindBg: 'bg-purple-600', tailwindDot: 'bg-purple-500', customStyles: false },
      grey: { primary: '#64748b', secondary: '#cbd5e1', tailwindBg: 'bg-slate-600', tailwindDot: 'bg-slate-500', customStyles: false },
      gray: { primary: '#64748b', secondary: '#cbd5e1', tailwindBg: 'bg-slate-600', tailwindDot: 'bg-slate-500', customStyles: false },
      brown: { primary: '#78350f', secondary: '#b45309', tailwindBg: 'bg-amber-900', tailwindDot: 'bg-amber-800', customStyles: false },
      indigo: { primary: '#4f46e5', secondary: '#818cf8', tailwindBg: 'bg-indigo-600', tailwindDot: 'bg-indigo-500', customStyles: false },
      gold: { primary: '#d97706', secondary: '#f59e0b', tailwindBg: 'bg-amber-600', tailwindDot: 'bg-amber-500', customStyles: false },
      silver: { primary: '#94a3b8', secondary: '#cbd5e1', tailwindBg: 'bg-slate-400', tailwindDot: 'bg-slate-300', customStyles: false },

      // Tamil
      'சிவப்பு': { primary: '#ef4444', secondary: '#fca5a5', tailwindBg: 'bg-red-600', tailwindDot: 'bg-red-500', customStyles: false },
      'சிகப்பு': { primary: '#ef4444', secondary: '#fca5a5', tailwindBg: 'bg-red-600', tailwindDot: 'bg-red-500', customStyles: false },
      'நீலம்': { primary: '#3b82f6', secondary: '#93c5fd', tailwindBg: 'bg-blue-600', tailwindDot: 'bg-blue-500', customStyles: false },
      'பச்சை': { primary: '#22c55e', secondary: '#86efac', tailwindBg: 'bg-green-600', tailwindDot: 'bg-green-500', customStyles: false },
      'மஞ்சள்': { primary: '#eab308', secondary: '#fde047', tailwindBg: 'bg-yellow-500', tailwindDot: 'bg-yellow-400', customStyles: false },
      'கருப்பு': { primary: '#1e293b', secondary: '#475569', tailwindBg: 'bg-slate-800', tailwindDot: 'bg-slate-700', customStyles: false },
      'வெள்ளை': { primary: '#94a3b8', secondary: '#cbd5e1', tailwindBg: 'bg-slate-400', tailwindDot: 'bg-slate-300', customStyles: false },
      'ஆரஞ்சு': { primary: '#f97316', secondary: '#fdba74', tailwindBg: 'bg-orange-600', tailwindDot: 'bg-orange-500', customStyles: false },
      'இளஞ்சிவப்பு': { primary: '#ec4899', secondary: '#f9a8d4', tailwindBg: 'bg-pink-600', tailwindDot: 'bg-pink-500', customStyles: false },
      'ஊதா': { primary: '#a855f7', secondary: '#d8b4fe', tailwindBg: 'bg-purple-600', tailwindDot: 'bg-purple-500', customStyles: false },
      'சாம்பல்': { primary: '#64748b', secondary: '#cbd5e1', tailwindBg: 'bg-slate-600', tailwindDot: 'bg-slate-500', customStyles: false },
      'பழுப்பு': { primary: '#78350f', secondary: '#b45309', tailwindBg: 'bg-amber-900', tailwindDot: 'bg-amber-800', customStyles: false },
      'தங்கம்': { primary: '#d97706', secondary: '#f59e0b', tailwindBg: 'bg-amber-600', tailwindDot: 'bg-amber-500', customStyles: false },
      'வெள்ளி': { primary: '#94a3b8', secondary: '#cbd5e1', tailwindBg: 'bg-slate-400', tailwindDot: 'bg-slate-300', customStyles: false },
    };

    if (colorMap[normalized]) return colorMap[normalized];

    const matchedKey = Object.keys(colorMap).find(key => normalized.includes(key));
    if (matchedKey) return colorMap[matchedKey];

    // Fallback if not found but has value: generate color from name string hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return {
      primary: `hsl(${h}, 75%, 45%)`,
      secondary: `hsl(${h}, 70%, 70%)`,
      tailwindBg: '',
      tailwindDot: '',
      customStyles: true
    };
  }, [selectedColorFilter]);

  // Products that match the selected name
  const matchedSelectedProducts = React.useMemo(() => {
    if (!selectedProductName) return [];
    let filtered = products.filter(p => p.name === selectedProductName);
    if (selectedColorFilter && selectedColorFilter !== 'all') {
      filtered = filtered.filter(p => p.color?.trim() === selectedColorFilter);
    }
    if (selectedGsmFilter && selectedGsmFilter !== 'all') {
      filtered = filtered.filter(p => p.gsm?.trim() === selectedGsmFilter);
    }
    if (selectedMaterialFilter && selectedMaterialFilter !== 'all') {
      filtered = filtered.filter(p => p.material?.trim() === selectedMaterialFilter);
    }
    if (selectedCategoryFilter && selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category?.trim() === selectedCategoryFilter);
    }
    return filtered;
  }, [products, selectedProductName, selectedColorFilter, selectedGsmFilter, selectedMaterialFilter, selectedCategoryFilter]);

  // Breakdown metrics
  const productBreakdownStats = React.useMemo(() => {
    const sizeStock: Record<string, number> = {};
    const colorStock: Record<string, number> = {};
    let totalQty = 0;
    const locations = new Set<string>();
    const skus: string[] = [];
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    matchedSelectedProducts.forEach(p => {
      const sz = p.size?.trim() || (language === 'en' ? 'Standard' : 'இயல்பான அளவு');
      const clr = p.color?.trim() || (language === 'en' ? 'Standard' : 'இயல்பான நிறம்');
      
      sizeStock[sz] = (sizeStock[sz] || 0) + p.quantity;
      colorStock[clr] = (colorStock[clr] || 0) + p.quantity;
      totalQty += p.quantity;
      if (p.location) locations.add(p.location);
      if (p.sku) skus.push(p.sku);
      if (p.sellingPrice < minPrice) minPrice = p.sellingPrice;
      if (p.sellingPrice > maxPrice) maxPrice = p.sellingPrice;
    });

    return {
      sizeData: Object.entries(sizeStock).map(([size, quantity]) => ({ name: size, value: quantity })),
      colorData: Object.entries(colorStock).map(([color, quantity]) => ({ name: color, value: quantity })),
      totalQty,
      locations: Array.from(locations),
      skus,
      priceRange: minPrice === Infinity ? 'N/A' : (minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`)
    };
  }, [matchedSelectedProducts, language]);

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Header Metrics Card Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        
        {/* Metric 1: Stock Value */}
        <div className="bg-white p-3.5 md:p-5 rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{t.totalValue}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 truncate">{formatCurrency(totalStockValue)}</p>
          </div>
          <p className="text-[8px] sm:text-[10px] text-blue-600 font-bold mt-2 truncate">
            {language === 'en' ? 'Calculated asset cost' : 'சரக்குகளின் மொத்த அடக்க மதிப்பு'}
          </p>
        </div>

        {/* Metric 2: Gross Sales */}
        <div className="bg-white p-3.5 md:p-5 rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{language === 'en' ? 'Total Sales' : 'மொத்த விற்பனை'}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 truncate">{formatCurrency(totalSalesRevenue)}</p>
          </div>
          <p className="text-[8px] sm:text-[10px] text-emerald-600 font-bold mt-2 truncate">
            {language === 'en' ? 'Inward billing income' : 'பில்லிங் மூலம் கிடைத்த வருவாய்'}
          </p>
        </div>

        {/* Metric 3: Total Products */}
        <div className="bg-white p-3.5 md:p-5 rounded-xl border border-slate-200 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 truncate">{language === 'en' ? 'Active Items' : 'தயாரிப்புகள் எண்ணிக்கை'}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 truncate">{totalProducts}</p>
          </div>
          <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold mt-2 truncate">
            {language === 'en' ? 'Unique SKUs registered' : 'பதிவுசெய்யப்பட்ட தயாரிப்புகள்'}
          </p>
        </div>

        {/* Metric 4: Low Stock Warnings */}
        <div 
          id="kpi-low-stock-warnings-card"
          onClick={() => {
            const el = document.getElementById('low-stock-section');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={`p-3.5 md:p-5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
            lowStockCount > 0 
              ? 'bg-slate-900 border-slate-800 text-white shadow-lg hover:bg-slate-800' 
              : 'bg-white border-slate-200 text-slate-900 shadow-sm hover:border-slate-350'
          }`}
          title={language === 'en' ? 'Click to view low stock items' : 'குறைந்த இருப்பு விவரங்களைக் காண கிளிக் செய்க'}
        >
          <div>
            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-1 truncate ${lowStockCount > 0 ? 'text-slate-400 italic' : 'text-slate-500'}`}>{t.lowStock}</p>
            <p className={`text-lg sm:text-xl md:text-2xl font-black truncate ${lowStockCount > 0 ? 'text-red-500 font-black' : 'text-slate-900'}`}>{lowStockCount}</p>
          </div>
          <p className={`text-[8px] sm:text-[10px] mt-2 font-bold truncate ${lowStockCount > 0 ? 'text-blue-400 uppercase font-black' : 'text-slate-400'}`}>
            {lowStockCount > 0 
              ? `${lowStockCount} items need reordering` 
              : (language === 'en' ? 'All stocks safe' : 'அனைத்தும் போதுமான அளவில் உள்ளது')
            }
          </p>
        </div>
      </div>

      {/* 1.5. Dynamic Product stock size/color breakdown chart and analytics card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
        {/* Card Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                {language === 'en' ? 'Product Stock Breakdown' : 'தயாரிப்பு இருப்புப் பகுப்பாய்வு'}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {language === 'en' 
                  ? 'Select a product to view stock distribution by size, color, and location.' 
                  : 'அளவு, நிறம் மற்றும் இருப்பு வாரியாக தயாரிப்பு விவரங்களை வரைபடம் மற்றும் எண்களில் காண்க.'}
              </p>
            </div>
          </div>

          {/* Selected Product Image Thumbnail */}
          {selectedProductName && (
            <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs max-w-[260px] md:max-w-xs transition-all hover:bg-slate-50/80 shrink-0 mx-auto md:mx-0">
              {selectedProductImage ? (
                <div 
                  onClick={() => setLargeImageUrl(selectedProductImage)}
                  className="relative group cursor-pointer h-10 w-10 shrink-0 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center transition-transform hover:scale-105"
                  title={language === 'en' ? 'Click to view full size' : 'பெரிதாக்க கிளிக் செய்க'}
                >
                  <img 
                    src={selectedProductImage} 
                    alt={selectedProductName} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                    {language === 'en' ? 'View' : 'காண்க'}
                  </div>
                </div>
              ) : (
                <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-350 shrink-0">
                  <Package className="h-5 w-5" />
                </div>
              )}
              <div className="text-left overflow-hidden">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">
                  {language === 'en' ? 'SELECTED PRODUCT' : 'தேர்ந்தெடுக்கப்பட்ட தயாரிப்பு'}
                </span>
                <span className="block text-[11px] font-extrabold text-slate-700 truncate mt-0.5" title={selectedProductName}>
                  {selectedColorFilter && selectedColorFilter !== 'all' ? `${selectedProductName} (${selectedColorFilter})` : selectedProductName}
                </span>
                {selectedProductImage ? (
                  <button
                    type="button"
                    onClick={() => setLargeImageUrl(selectedProductImage)}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline mt-0.5 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {language === 'en' ? 'Click to enlarge' : 'பெரிதாக்க கிளிக் செய்க'}
                  </button>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                    {language === 'en' ? 'No image uploaded' : 'படம் பதிவேற்றப்படவில்லை'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Selectors */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 shrink-0 w-full md:w-auto items-end">
            {/* Product Search & Dropdown Selector */}
            <div className="relative w-full sm:w-56 md:w-60">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {language === 'en' ? 'Select Product' : 'தயாரிப்பைத் தேர்ந்தெடுக்கவும்'}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 text-left flex items-center justify-between shadow-xs hover:border-slate-300 transition-all cursor-pointer h-[34px]"
                >
                  <span className="truncate">
                    {selectedProductName || (language === 'en' ? 'Select a product...' : 'ஒரு தயாரிப்பைத் தேர்வுசெய்க...')}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-90' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100 max-h-80 flex flex-col">
                    {/* Search bar within dropdown */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50 relative">
                      <Search className="absolute left-4 top-4 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={searchProductQuery}
                        onChange={(e) => setSearchProductQuery(e.target.value)}
                        placeholder={language === 'en' ? 'Search product name...' : 'தயாரிப்புப் பெயரைத் தேடுக...'}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      />
                      {searchProductQuery && (
                        <button 
                          type="button"
                          onClick={() => setSearchProductQuery('')}
                          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable products list */}
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                      {filteredProductNames.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-medium">
                          {language === 'en' ? 'No products found' : 'தயாரிப்புகள் ஏதுமில்லை'}
                        </div>
                      ) : (
                        filteredProductNames.map(name => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedProductName(name);
                              setIsDropdownOpen(false);
                              setSearchProductQuery('');
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-indigo-50/50 transition-colors cursor-pointer block truncate ${
                              selectedProductName === name ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'
                            }`}
                          >
                            {name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Filter Selector */}
            <div className="w-full sm:w-28 md:w-32">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {language === 'en' ? 'Category' : 'வகை'}
              </label>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px] uppercase"
              >
                <option value="all">{language === 'en' ? 'All' : 'அனைத்தும்'}</option>
                {availableCategoriesForSelectedProduct.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Material Filter Selector */}
            <div className="w-full sm:w-28 md:w-32">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {language === 'en' ? 'Material' : 'மெட்டீரியல்'}
              </label>
              <select
                value={selectedMaterialFilter}
                onChange={(e) => setSelectedMaterialFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px] uppercase"
              >
                <option value="all">{language === 'en' ? 'All' : 'அனைத்தும்'}</option>
                {availableMaterialsForSelectedProduct.map(mat => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>

            {/* GSM Filter Selector */}
            <div className="w-full sm:w-24 md:w-28">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {language === 'en' ? 'GSM' : 'ஜிஎஸ்எம்'}
              </label>
              <select
                value={selectedGsmFilter}
                onChange={(e) => setSelectedGsmFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px] uppercase"
              >
                <option value="all">{language === 'en' ? 'All' : 'அனைத்தும்'}</option>
                {availableGsmForSelectedProduct.map(gsm => (
                  <option key={gsm} value={gsm}>{gsm}</option>
                ))}
              </select>
            </div>

            {/* Color Filter Selector */}
            <div className="w-full sm:w-28 md:w-32">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {language === 'en' ? 'Color' : 'வண்ணம்'}
              </label>
              <select
                value={selectedColorFilter}
                onChange={(e) => setSelectedColorFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px]"
              >
                <option value="all">{language === 'en' ? 'All Colors' : 'அனைத்து வண்ணங்கள்'}</option>
                {availableColorsForSelectedProduct.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card Body */}
        {uniqueProductNames.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            {language === 'en' ? 'No products registered in the inventory.' : 'சரக்குப்பட்டியலில் தயாரிப்புகள் எதுவும் பதிவு செய்யப்படவில்லை.'}
          </div>
        ) : !selectedProductName ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            {language === 'en' ? 'Please select a product to see details.' : 'தயாரிப்பைத் தேர்ந்தெடுத்து விவரங்களைப் பார்க்கவும்.'}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Activity className="h-3 w-3 text-slate-400" />
                  {language === 'en' ? 'Total Pieces Available' : 'மொத்த இருப்பு'}
                </span>
                <span className="block text-lg font-black text-slate-800 mt-1">
                  {productBreakdownStats.totalQty} {matchedSelectedProducts[0]?.unit || 'pcs'}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="h-3 w-3 text-slate-400" />
                  {language === 'en' ? 'Price Range' : 'விலை வரம்பு'}
                </span>
                <span className="block text-lg font-black text-indigo-600 mt-1">
                  {productBreakdownStats.priceRange}
                </span>
              </div>
            </div>

            {/* Breakdowns Row (Size Distribution) */}
            <div className="w-full">
              
              {/* Size Breakdown */}
              <div className="border border-slate-100 rounded-xl p-6 bg-white shadow-xs">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-5 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Ruler className="h-4 w-4 text-indigo-500" />
                  {language === 'en' ? 'Stock Distribution by Size' : 'அளவு வாரியாக இருப்புப் பங்கீடு'}
                </h5>

                {productBreakdownStats.sizeData.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium">
                    {language === 'en' ? 'No size data available for this product/color combination.' : 'இந்த தயாரிப்பு/வண்ண அமைப்பிற்கு அளவுத் தகவல்கள் ஏதுமில்லை.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Visual Bars List */}
                    <div className="space-y-4 flex flex-col justify-center">
                      {productBreakdownStats.sizeData.map((item, idx) => {
                        const pct = productBreakdownStats.totalQty > 0 
                          ? Math.round((item.value / productBreakdownStats.totalQty) * 100) 
                          : 0;
                        return (
                          <div key={`${selectedProductName}-${selectedColorFilter}-${item.name}-${idx}`} className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-semibold">
                              <span className="text-slate-700 flex items-center gap-1.5">
                                <span 
                                  className={`h-2 w-2 rounded-full ${activeColorDetails.tailwindDot || ''}`}
                                  style={activeColorDetails.customStyles ? { backgroundColor: activeColorDetails.primary } : undefined}
                                />
                                {item.name}
                              </span>
                              <span className="text-slate-900 font-bold">
                                {item.value} {matchedSelectedProducts[0]?.unit || 'pcs'} <span className="text-slate-400 text-[10px] font-medium">({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${activeColorDetails.tailwindBg || ''} rounded-full transition-all duration-500`} 
                                style={{ 
                                  width: `${pct}%`,
                                  ...(activeColorDetails.customStyles ? { backgroundColor: activeColorDetails.primary } : {})
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recharts Graphical bar chart */}
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%" key={`${selectedProductName}-${selectedColorFilter}`}>
                        <BarChart data={productBreakdownStats.sizeData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {productBreakdownStats.sizeData.map((entry, index) => (
                              <Cell 
                                key={`cell-${selectedProductName}-${selectedColorFilter}-${index}`} 
                                fill={index % 2 === 0 ? activeColorDetails.primary : activeColorDetails.secondary} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

      {/* 2. Low Stock Alerts Card */}
      <div id="low-stock-section" className="bg-white border border-slate-200 rounded-2xl shadow-sm py-5 px-6 animate-in fade-in duration-200">
        <h4 className="font-bold text-slate-800 mb-4 text-xs uppercase tracking-wide flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" />
          {t.lowStockAlert}
        </h4>
        {lowStockItems.length === 0 ? (
          <div className="text-emerald-600 text-xs py-8 text-center bg-emerald-50/50 rounded-xl border border-dashed border-emerald-100 font-bold">
            {language === 'en' ? 'Splendid! No items are low in stock.' : 'அற்புதம்! குறைந்த இருப்பு தயாரிப்புகள் ஏதுமில்லை.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{t.productName}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Current Stock' : 'இருப்பு அளவு'}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Minimum Stock Limit' : 'குறைந்தபட்ச அளவு'}</th>
                  <th className="p-4 text-right">{language === 'en' ? 'Status' : 'நிலை'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {lowStockItems.map((item) => (
                  <tr key={item.id || item.sku} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-semibold flex flex-wrap items-center gap-1.5 mt-0.5">
                        {item.color && (
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm">
                            {language === 'en' ? 'Color: ' : 'வண்ணம்: '}{item.color}
                          </span>
                        )}
                        {item.size && (
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-sm">
                            {language === 'en' ? 'Size: ' : 'அளவு: '}{item.size}
                          </span>
                        )}
                        {!item.color && !item.size && (
                          <span className="text-slate-400 italic">
                            {language === 'en' ? 'Standard' : 'இயல்பானது'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-900">
                      <span className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded text-xs font-black inline-block">
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-500 font-semibold">
                      {item.minStock} {item.unit}
                    </td>
                    <td className="p-4 text-right">
                      {item.quantity === 0 ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[9px] font-extrabold bg-red-100 text-red-800 uppercase tracking-wider border border-red-200">
                          {t.outOfStock}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-800 uppercase tracking-wider border border-amber-200">
                          {t.lowStock}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3.5 User Directory & Role Management (Admins Only) */}
      {userRole === 'admin' && usersList && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600 animate-pulse" />
                {language === 'en' ? 'User Directory & Role Management' : 'பயனர் அடைவு & பொறுப்பு மேலாண்மை'}
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                {language === 'en' ? 'Manage system access roles for registered store members.' : 'பதிவுசெய்யப்பட்ட பயனர்களின் பொறுப்புகளை நிர்வகிக்கவும்.'}
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="text-[10px] bg-slate-100 px-2.5 py-1.5 rounded-md text-slate-600 font-bold">
                {usersList.length} {language === 'en' ? 'Users Registered' : 'பயனர்கள் பதிவு செய்யப்பட்டுள்ளனர்'}
              </div>
            </div>
          </div>

          {usersList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/30 text-xs text-slate-400 font-medium flex flex-col items-center gap-3">
              <p>{language === 'en' ? 'No users found in the system directory.' : 'அடைவில் பயனர்கள் யாரும் இல்லை.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-4">{language === 'en' ? 'User Info' : 'பயனர் விவரம்'}</th>
                    <th className="p-4">{language === 'en' ? 'Current Role' : 'தற்போதைய பொறுப்பு'}</th>
                    <th className="p-4 text-right pr-6">{language === 'en' ? 'Manage' : 'நிர்வகி'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {usersList.map((usr) => (
                    <tr 
                      key={usr.uid} 
                      onClick={() => { setSelectedUserToEdit(usr); setIsDeleteConfirming(false); }}
                      className="hover:bg-indigo-50/30 active:bg-indigo-100/20 transition-all cursor-pointer group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-extrabold text-sm uppercase shadow-xs group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            {usr.displayName ? usr.displayName.charAt(0) : usr.email.charAt(0)}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-800 text-xs group-hover:text-indigo-600 transition-colors">
                              {usr.displayName || (language === 'en' ? 'Anonymous User' : 'அறியப்படாத பயனர்')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{usr.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          usr.role === 'admin' 
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${usr.role === 'admin' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          {usr.role === 'admin' ? (language === 'en' ? 'Admin' : 'நிர்வாகி') : (language === 'en' ? 'User' : 'பயனர்')}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="inline-flex items-center justify-center h-7 px-3 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all group-hover:bg-indigo-600 group-hover:text-white cursor-pointer gap-1">
                          <span>{language === 'en' ? 'Manage' : 'நிர்வகி'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.6 Selected User Detail & Role Management Overlay (Modal) */}
      {selectedUserToEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs tracking-wide uppercase">
                  {language === 'en' ? 'User Access & Roles' : 'பயனர் அணுகல் & பொறுப்புகள்'}
                </h3>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {selectedUserToEdit.uid}</p>
              </div>
              <button 
                onClick={() => { setSelectedUserToEdit(null); setIsDeleteConfirming(false); }}
                className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Info Card */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col items-center text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl uppercase shadow-xs">
                {selectedUserToEdit.displayName ? selectedUserToEdit.displayName.charAt(0) : selectedUserToEdit.email.charAt(0)}
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-xs">
                  {selectedUserToEdit.displayName || (language === 'en' ? 'Anonymous User' : 'அறியப்படாத பயனர்')}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{selectedUserToEdit.email}</p>
              </div>

              {/* Current Role Indicator */}
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  selectedUserToEdit.role === 'admin' 
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${selectedUserToEdit.role === 'admin' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  {selectedUserToEdit.role === 'admin' ? (language === 'en' ? 'Administrator' : 'நிர்வாகி') : (language === 'en' ? 'Standard User' : 'சாதாரண பயனர்')}
                </span>
              </div>
            </div>

            {/* Role Assignment & Configuration Options */}
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  {language === 'en' ? 'Assign New Role' : 'புதிய பொறுப்பை வழங்கு'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Standard User */}
                  <button
                    onClick={async () => {
                      if (onUpdateUserRole) {
                        await onUpdateUserRole(selectedUserToEdit.uid, 'user');
                        setSelectedUserToEdit({ ...selectedUserToEdit, role: 'user' });
                      }
                    }}
                    className={`p-3.5 border rounded-xl text-left transition-all flex flex-col justify-between h-24 cursor-pointer relative ${
                      selectedUserToEdit.role === 'user'
                        ? 'border-indigo-600 bg-indigo-50/25 ring-1 ring-indigo-500/30 font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <User className={`h-5 w-5 ${selectedUserToEdit.role === 'user' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-[11px] font-extrabold ${selectedUserToEdit.role === 'user' ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {language === 'en' ? 'Standard User' : 'சாதாரண பயனர்'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold leading-none mt-1">
                        {language === 'en' ? 'Billing & Viewer' : 'பில்லிங் மற்றும் பார்வை'}
                      </p>
                    </div>
                    {selectedUserToEdit.role === 'user' && (
                      <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                    )}
                  </button>

                  {/* Option 2: Administrator */}
                  <button
                    onClick={async () => {
                      if (onUpdateUserRole) {
                        await onUpdateUserRole(selectedUserToEdit.uid, 'admin');
                        setSelectedUserToEdit({ ...selectedUserToEdit, role: 'admin' });
                      }
                    }}
                    className={`p-3.5 border rounded-xl text-left transition-all flex flex-col justify-between h-24 cursor-pointer relative ${
                      selectedUserToEdit.role === 'admin'
                        ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30 font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Lock className={`h-5 w-5 ${selectedUserToEdit.role === 'admin' ? 'text-amber-500' : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-[11px] font-extrabold ${selectedUserToEdit.role === 'admin' ? 'text-amber-900' : 'text-slate-700'}`}>
                        {language === 'en' ? 'Administrator' : 'நிர்வாகி'}
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold leading-none mt-1">
                        {language === 'en' ? 'Full System Control' : 'முழு அமைப்பு கட்டுப்பாடு'}
                      </p>
                    </div>
                    {selectedUserToEdit.role === 'admin' && (
                      <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    )}
                  </button>
                </div>
              </div>

              {/* Danger Zone: Delete Section */}
              <div className="pt-5 border-t border-slate-100">
                {!isDeleteConfirming ? (
                  <button
                    onClick={() => setIsDeleteConfirming(true)}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {language === 'en' ? 'Remove User From System' : 'அமைப்பிலிருந்து பயனரை நீக்கு'}
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <p className="text-[10px] font-bold text-red-800 leading-tight">
                      {language === 'en' 
                        ? 'Are you absolutely sure? This action cannot be undone and will revoke all access.' 
                        : 'நிச்சயமாக நீக்க வேண்டுமா? இந்த நடவடிக்கையை ரத்து செய்ய முடியாது மற்றும் அனைத்து அணுகலும் ரத்து செய்யப்படும்.'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setIsDeleteConfirming(false)}
                        className="py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-50 transition-all"
                      >
                        {language === 'en' ? 'Cancel' : 'ரத்து செய்'}
                      </button>
                      <button
                        onClick={async () => {
                          if (onDeleteUser) {
                            await onDeleteUser(selectedUserToEdit.uid);
                            setSelectedUserToEdit(null);
                            setIsDeleteConfirming(false);
                          }
                        }}
                        className="py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase cursor-pointer hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Trash2 className="h-3 w-3" />
                        {language === 'en' ? 'Yes, Delete' : 'ஆம், நீக்கு'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => { setSelectedUserToEdit(null); setIsDeleteConfirming(false); }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-xs transition-all"
              >
                {language === 'en' ? 'Done' : 'முடிந்தது'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Selected Bill Receipt Overlay (Modal showing what they purchased) */}
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">
                  {language === 'en' ? 'Sale Details' : 'விற்பனை விவரங்கள்'}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedBill.billNo}</p>
              </div>
              <button 
                onClick={() => setSelectedBill(null)}
                className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bill Meta */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'en' ? 'Customer:' : 'வாடிக்கையாளர்:'}</span>
                <span className="font-bold text-slate-800">{selectedBill.customerName || (language === 'en' ? 'Guest Customer' : 'விருந்தினர்')}</span>
              </div>
              {selectedBill.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === 'en' ? 'Phone:' : 'தொலைபேசி:'}</span>
                  <span className="font-bold text-slate-800">{selectedBill.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'en' ? 'Date & Time:' : 'தேதி & நேரம்:'}</span>
                <span className="font-medium text-slate-600">
                  {new Date(selectedBill.date).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-US')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{language === 'en' ? 'Payment Method:' : 'பணம் செலுத்தும் முறை:'}</span>
                <span className="font-semibold text-slate-700 uppercase">{selectedBill.paymentMethod}</span>
              </div>
            </div>

            {/* Items Purchased */}
            <div className="p-4 max-h-60 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {language === 'en' ? 'Items Purchased' : 'வாங்கப்பட்ட பொருட்கள்'}
              </p>
              <div className="divide-y divide-slate-100">
                {selectedBill.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-start text-xs">
                    <div className="pr-4">
                      <p className="font-bold text-slate-800 leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.quantity} {item.unit || 'pcs'} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    <span className="font-bold text-slate-800 shrink-0">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Totals */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500">
                <span>{language === 'en' ? 'Subtotal' : 'துணைத் தொகை'}</span>
                <span>{formatCurrency(selectedBill.subtotal)}</span>
              </div>
              {selectedBill.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>{language === 'en' ? 'Discount' : 'தள்ளுபடி'}</span>
                  <span>-{formatCurrency(selectedBill.discount)}</span>
                </div>
              )}
              {selectedBill.gst > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>GST (5%)</span>
                  <span>{formatCurrency(selectedBill.gst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                <span>{language === 'en' ? 'Grand Total' : 'மொத்த தொகை'}</span>
                <span>{formatCurrency(selectedBill.grandTotal)}</span>
              </div>
            </div>

            {/* Footer Close Button */}
            <div className="p-3 bg-white border-t border-slate-100 flex justify-between items-center">
              {userRole === 'admin' && (
                <button
                  onClick={async () => {
                    if (confirm(language === 'en' ? `Are you sure you want to delete invoice ${selectedBill.billNo}? This will also delete its transaction records and revert stock changes.` : `இன்வாய்ஸ் ${selectedBill.billNo} ஐ நீக்க வேண்டுமா?`)) {
                      if (onDeleteBill) {
                        await onDeleteBill(selectedBill.id!, selectedBill.billNo);
                        setSelectedBill(null);
                      }
                    }
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Delete Invoice' : 'அழி இன்வாய்ஸ்'}
                </button>
              )}
              <button
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {language === 'en' ? 'Done' : 'முடிந்தது'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal Overlay */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">
                  {language === 'en' ? 'Add New User Profile' : 'புதிய பயனர் சுயவிவரத்தைச் சேர்'}
                </h3>
                <p className="text-[10px] text-indigo-200 mt-0.5 font-semibold">
                  {language === 'en' ? 'Create access credentials for store staff members.' : 'விற்பனை நிலைய ஊழியர்களுக்கான அணுகலை உருவாக்கவும்.'}
                </p>
              </div>
              <button 
                onClick={() => setIsAddUserOpen(false)}
                className="text-indigo-200 hover:text-white bg-indigo-700 p-1.5 rounded-lg transition-colors cursor-pointer animate-in duration-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="p-5 space-y-4 text-xs">
              {/* User ID Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'en' ? 'User ID (Auth UID)' : 'பயனர் ஐடி (Auth UID)'}
                </label>
                <input
                  type="text"
                  required
                  value={newUserUid}
                  onChange={(e) => setNewUserUid(e.target.value)}
                  placeholder="e.g. USR-XXXXX or Firebase UID"
                  className="w-full px-3.5 py-2 border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400 font-mono text-xs"
                />
                <p className="text-[9px] text-slate-400">
                  {language === 'en' 
                    ? 'Note: Auto-generated. If matching a registered Firebase auth user, use their authentic UID.' 
                    : 'குறிப்பு: தானாக உருவாக்கப்பட்டது. ஒருவேளை ஏற்கனவே பதிவுசெய்த பயனர் எனில் அவர்களின் உண்மையான Firebase UID ஐ வழங்கவும்.'}
                </p>
              </div>

              {/* Display Name Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'en' ? 'Display Name / Staff Name' : 'பயனர் பெயர் / ஊழியர் பெயர்'}
                </label>
                <input
                  type="text"
                  required
                  value={newUserDisplayName}
                  onChange={(e) => setNewUserDisplayName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Sakthi Bala' : 'எ.கா. சக்தி பாலா'}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400 text-xs"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'en' ? 'Email Address' : 'மின்னஞ்சல் முகவரி'}
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. example@gmail.com"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400 text-xs"
                />
              </div>

              {/* Role Select Field */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'en' ? 'System Role Access' : 'அமைப்பு அணுகல் பொறுப்பு (Role)'}
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-xs font-bold"
                >
                  <option value="user">{language === 'en' ? 'User (Billing / Scanner / Viewer)' : 'பயனர் (பில்லிங் / ஸ்கேனர் / வியூவர்)'}</option>
                  <option value="admin">{language === 'en' ? 'Admin (Full Dashboard & Inventory Access)' : 'அட்மின் (முழு முகப்பு பலகை & இருப்பு அணுகல்)'}</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {language === 'en' ? 'Cancel' : 'ரத்து செய்'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Save User' : 'பயனரைச் சேமி'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Image Lightbox Modal */}
      {largeImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setLargeImageUrl(null)}
        >
          <div 
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                  {language === 'en' ? 'Product Image Zoom' : 'தயாரிப்பு படம் - பெரிய வடிவம்'}
                </span>
                <h4 className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {selectedColorFilter && selectedColorFilter !== 'all' ? `${selectedProductName} (${selectedColorFilter})` : selectedProductName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setLargeImageUrl(null)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body with Large Image */}
            <div className="p-6 bg-slate-50 flex items-center justify-center min-h-[250px] max-h-[70vh] overflow-y-auto">
              <img 
                src={largeImageUrl} 
                alt={selectedProductName} 
                className="max-h-[50vh] w-auto object-contain rounded-xl border border-slate-200 shadow-md bg-white animate-in zoom-in-95 duration-300"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setLargeImageUrl(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                {language === 'en' ? 'Close View' : 'மூடவும்'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
