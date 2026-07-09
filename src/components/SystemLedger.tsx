import React from 'react';
import { Transaction, Language } from '../types';
import { ArrowDownUp, Search, Trash2, Calendar, X, Download, FileSpreadsheet, AlertCircle, RefreshCw } from 'lucide-react';

interface SystemLedgerProps {
  language: Language;
  transactions: Transaction[];
  products?: any[];
  userRole?: 'admin' | 'user' | null;
  onDeleteTransaction?: (id: string) => Promise<void>;
  onClearTransactions?: () => Promise<void>;
}

export default function SystemLedger({
  language,
  transactions,
  products = [],
  userRole,
  onDeleteTransaction,
  onClearTransactions
}: SystemLedgerProps) {
  const [ledgerTypeFilter, setLedgerTypeFilter] = React.useState<'all' | 'sales' | 'inward' | 'restock' | 'deleted'>('all');
  const [ledgerSearch, setLedgerSearch] = React.useState('');
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 20;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [ledgerTypeFilter, ledgerSearch, startDate, endDate]);

  // Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDeleteClick = (tx: Transaction) => {
    setDeleteTarget(tx);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (onDeleteTransaction) {
        await onDeleteTransaction(deleteTarget.id!);
        setFeedback({
          type: 'success',
          text: language === 'en' ? 'Transaction entry deleted!' : 'பரிவர்த்தனை பதிவு நீக்கப்பட்டது!'
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to delete transaction.' : 'பரிவர்த்தனை பதிவை நீக்க முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      if (onClearTransactions) {
        await onClearTransactions();
        setFeedback({
          type: 'success',
          text: language === 'en' ? 'All system logs cleared successfully!' : 'அனைத்து கணினிப் பதிவுகளும் வெற்றிகரமாக நீக்கப்பட்டன!'
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to clear system logs.' : 'கணினிப் பதிவுகளை நீக்க முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  // Export Modal states
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [exportType, setExportType] = React.useState<'sales' | 'inward' | 'stock' | 'all' | 'restock' | 'deleted'>('all');
  const [exportStartDate, setExportStartDate] = React.useState<string>('');
  const [exportEndDate, setExportEndDate] = React.useState<string>('');

  // Helper formatting for currency
  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportCSV = () => {
    // Populate start/end dates from active filters for better UX
    setExportStartDate(startDate);
    setExportEndDate(endDate);
    setExportType(ledgerTypeFilter === 'all' ? 'all' : ledgerTypeFilter);
    setShowExportDialog(true);
  };

  const handleExecuteExport = () => {
    const escapeCSVCell = (val: any) => {
      const str = val === undefined || val === null ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (exportType === 'stock') {
      // Export Stock/Inventory Columns
      const headers = [
        'SKU',
        language === 'en' ? 'Product Name' : 'தயாரிப்பு பெயர்',
        language === 'en' ? 'Category' : 'வகை',
        language === 'en' ? 'Quantity' : 'இருப்பு அளவு',
        language === 'en' ? 'Unit' : 'அலகு',
        language === 'en' ? 'Selling Price' : 'விற்பனை விலை',
        language === 'en' ? 'Manufacturing Cost' : 'உற்பத்தி செலவு',
        language === 'en' ? 'Min Stock' : 'குறைந்தபட்ச இருப்பு',
        language === 'en' ? 'Material' : 'மெட்டீரியல்',
        language === 'en' ? 'GSM' : 'ஜிஎஸ்எம்',
        language === 'en' ? 'Color' : 'வண்ணம்',
        language === 'en' ? 'Size' : 'அளவு',
        language === 'en' ? 'Location' : 'இடம்',
        language === 'en' ? 'Description' : 'விளக்கம்'
      ];

      const csvRows = [headers.map(escapeCSVCell).join(',')];

      let list = [...(products || [])];
      if (exportStartDate) {
        const start = new Date(exportStartDate);
        start.setHours(0, 0, 0, 0);
        list = list.filter(p => p.updatedAt ? new Date(p.updatedAt).getTime() >= start.getTime() : true);
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        list = list.filter(p => p.updatedAt ? new Date(p.updatedAt).getTime() <= end.getTime() : true);
      }

      list.forEach((p) => {
        const row = [
          p.sku,
          p.name,
          p.category,
          p.quantity,
          p.unit || 'pcs',
          p.sellingPrice,
          p.purchasePrice,
          p.minStock,
          p.material || '',
          p.gsm || '',
          p.color || '',
          p.size || '',
          p.location || '',
          p.description || ''
        ];
        csvRows.push(row.map(escapeCSVCell).join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory_stock_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Export Transactions
      const headers = [
        language === 'en' ? 'Date' : 'தேதி',
        language === 'en' ? 'Type' : 'வகை',
        language === 'en' ? 'Product Name' : 'தயாரிப்பு பெயர்',
        language === 'en' ? 'SKU' : 'பார்கோடு',
        language === 'en' ? 'Quantity' : 'அளவு',
        language === 'en' ? 'Price' : 'விலை',
        language === 'en' ? 'Total' : 'மொத்தம்',
        language === 'en' ? 'Reference No' : 'குறிப்பு எண்',
        language === 'en' ? 'Counter Party' : 'எதிர் தரப்பு',
        language === 'en' ? 'Payment Method' : 'பணம் செலுத்தும் முறை'
      ];

      const csvRows = [headers.map(escapeCSVCell).join(',')];

      let list = [...(transactions || [])];
      
      // Filter by type
      if (exportType === 'restock') {
        list = list.filter(tx => tx.type === 'inward' && tx.referenceNo === 'RESTOCK');
      } else if (exportType === 'inward') {
        list = list.filter(tx => tx.type === 'inward');
      } else if (exportType !== 'all') {
        list = list.filter(tx => tx.type === exportType);
      }

      // Filter by date range
      if (exportStartDate) {
        const start = new Date(exportStartDate);
        start.setHours(0, 0, 0, 0);
        list = list.filter(tx => new Date(tx.date).getTime() >= start.getTime());
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        list = list.filter(tx => new Date(tx.date).getTime() <= end.getTime());
      }

      // Sort by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      list.forEach((tx) => {
        const row = [
          new Date(tx.date).toLocaleString(language === 'ta' ? 'ta-IN' : 'en-US'),
          tx.type === 'sales' ? (language === 'en' ? 'Sales' : 'விற்பனை') : tx.type === 'deleted' ? (language === 'en' ? 'Deleted' : 'அழிக்கப்பட்டது') : (tx.type === 'inward' && tx.referenceNo === 'RESTOCK') ? (language === 'en' ? 'Restock' : 'ரீஸ்டாக்') : (language === 'en' ? 'Inward' : 'உள்வரவு'),
          tx.productName,
          tx.sku,
          tx.quantity,
          tx.price,
          tx.total,
          tx.referenceNo,
          tx.counterParty || '',
          tx.paymentMethod || ''
        ];
        csvRows.push(row.map(escapeCSVCell).join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger_export_${exportType}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setShowExportDialog(false);
  };

  // Filtered Ledger Transactions
  const filteredTransactions = React.useMemo(() => {
    let list = [...(transactions || [])];
    if (ledgerTypeFilter !== 'all') {
      if (ledgerTypeFilter === 'restock') {
        list = list.filter(tx => tx.type === 'inward' && tx.referenceNo === 'RESTOCK');
      } else if (ledgerTypeFilter === 'inward') {
        // Only inward transactions that are NOT restock (optional, but probably user means all inward)
        // Wait, inward is usually just all inward. Let's keep it simple: inward shows all inward.
        list = list.filter(tx => tx.type === 'inward');
      } else {
        list = list.filter(tx => tx.type === ledgerTypeFilter);
      }
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      list = list.filter(tx => 
        tx.productName.toLowerCase().includes(q) || 
        tx.sku.toLowerCase().includes(q) || 
        tx.referenceNo.toLowerCase().includes(q) ||
        (tx.counterParty && tx.counterParty.toLowerCase().includes(q))
      );
    }
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter(tx => new Date(tx.date).getTime() >= start.getTime());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(tx => new Date(tx.date).getTime() <= end.getTime());
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, ledgerTypeFilter, ledgerSearch, startDate, endDate]);

  // Compute stats on the filtered dataset
  const stats = React.useMemo(() => {
    let totalSales = 0;
    let totalInward = 0;
    filteredTransactions.forEach(tx => {
      if (tx.type === 'sales') {
        totalSales += (tx.total || 0);
      } else if (tx.type === 'inward') {
        totalInward += (tx.total || 0);
      }
    });
    return { totalSales, totalInward };
  }, [filteredTransactions]);

  const paginatedTransactions = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 animate-in fade-in">
          <ArrowDownUp className="h-6 w-6 text-blue-600" />
          {language === 'en' ? 'System Log' : 'சிஸ்டம் லாக்'}
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {language === 'en' 
            ? 'Audit trail of stock movements, purchase records, and sales logs.' 
            : 'இருப்பு மாற்றங்கள், கொள்முதல் மற்றும் விற்பனைப் பதிவுக்கான தணிக்கை விவரங்கள்.'}
        </p>
      </div>

      {/* Toolbar & Filter Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
          <button
            onClick={() => setLedgerTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
              ledgerTypeFilter === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'en' ? 'All' : 'அனைத்தும்'}
          </button>
          <button
            onClick={() => setLedgerTypeFilter('sales')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
              ledgerTypeFilter === 'sales' 
                ? 'bg-emerald-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'en' ? 'Sales' : 'விற்பனை'}
          </button>
          <button
            onClick={() => setLedgerTypeFilter('inward')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
              ledgerTypeFilter === 'inward' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'en' ? 'Stock Inward' : 'உள்வரவு'}
          </button>
          <button
            onClick={() => setLedgerTypeFilter('restock')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
              ledgerTypeFilter === 'restock' 
                ? 'bg-amber-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'en' ? 'Restock' : 'ரீஸ்டாக்'}
          </button>
          <button
            onClick={() => setLedgerTypeFilter('deleted')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
              ledgerTypeFilter === 'deleted' 
                ? 'bg-red-500 text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language === 'en' ? 'Deleted' : 'அழிக்கப்பட்டது'}
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder={language === 'en' ? 'Search ledger...' : 'லெட்ஜரில் தேட...'}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 hover:border-slate-300 w-full sm:w-auto shrink-0"
            title={language === 'en' ? 'Export Logs as CSV' : 'சிஸ்டம் லாக் ஏற்றுமதி செய்'}
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>{language === 'en' ? 'Export CSV' : 'சிஎஸ்வி ஏற்றுமதி'}</span>
          </button>

          {/* Clear Logs Button (Admin only) */}
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100/70 text-rose-700 hover:text-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200 hover:border-rose-300 w-full sm:w-auto shrink-0"
              title={language === 'en' ? 'Clear all logs from the backend database' : 'தரவுத்தளத்தில் இருந்து அனைத்து பதிவுகளையும் அழி'}
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>{language === 'en' ? 'Clear Logs' : 'பதிவுகளை அழி'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Range & Summary Stats */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-4 items-center animate-in fade-in duration-200">
        {/* Date Filters */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          {/* Start Date */}
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              {language === 'en' ? 'Start Date' : 'தொடக்க தேதி'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium cursor-pointer"
            />
          </div>

          {/* End Date */}
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              {language === 'en' ? 'End Date' : 'முடிவு தேதி'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium cursor-pointer"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 self-end sm:self-auto h-9"
            >
              <X className="h-3.5 w-3.5" />
              {language === 'en' ? 'Clear' : 'அழி'}
            </button>
          )}
        </div>

        {/* Stats Strip */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-4">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {language === 'en' ? 'Total Rows' : 'மொத்த வரிகள்'}
            </span>
            <span className="block text-sm font-black text-slate-800 mt-1">
              {filteredTransactions.length}
            </span>
          </div>

          <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50">
            <span className="block text-[9px] font-bold text-emerald-800/65 uppercase tracking-wider truncate">
              {language === 'en' ? 'Sales Value' : 'விற்பனை'}
            </span>
            <span className="block text-sm font-black text-emerald-600 mt-1 truncate">
              {formatCurrency(stats.totalSales)}
            </span>
          </div>

          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
            <span className="block text-[9px] font-bold text-blue-800/65 uppercase tracking-wider truncate">
              {language === 'en' ? 'Inward Value' : 'உள்வரவு'}
            </span>
            <span className="block text-sm font-black text-blue-600 mt-1 truncate">
              {formatCurrency(stats.totalInward)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/20 text-slate-400 font-medium flex flex-col items-center justify-center gap-2">
              <ArrowDownUp className="h-10 w-10 text-slate-300 stroke-[1.5]" />
              <p className="text-xs">
                {language === 'en' ? 'No transactions found matching your filter criteria.' : 'பொருந்தக்கூடிய பதிவுகள் ஏதுமில்லை.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === 'en' ? 'Date' : 'தேதி'}</th>
                  <th className="p-4">{language === 'en' ? 'Type' : 'வகை'}</th>
                  <th className="p-4">{language === 'en' ? 'Product' : 'தயாரிப்பு'}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Quantity' : 'அளவு'}</th>
                  <th className="p-4 text-right">{language === 'en' ? 'Price' : 'விலை'}</th>
                  <th className="p-4 text-right">{language === 'en' ? 'Total' : 'மொத்தம்'}</th>
                  <th className="p-4">{language === 'en' ? 'Reference' : 'குறிப்பு எண்'}</th>
                  <th className="p-4">{language === 'en' ? 'User' : 'பயனர்'}</th>
                  {userRole === 'admin' && (
                    <th className="p-4 text-center">{language === 'en' ? 'Actions' : 'செயல்கள்'}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 whitespace-nowrap text-slate-500">
                      {new Date(tx.date).toLocaleDateString(language === 'ta' ? 'ta-IN' : 'en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {tx.type === 'sales' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {language === 'en' ? 'Sales' : 'விற்பனை'}
                        </span>
                      ) : tx.type === 'deleted' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-100">
                          {language === 'en' ? 'Deleted' : 'அழிக்கப்பட்டது'}
                        </span>
                      ) : tx.type === 'inward' && tx.referenceNo === 'RESTOCK' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                          {language === 'en' ? 'Restock' : 'ரீஸ்டாக்'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                          {language === 'en' ? 'Inward' : 'உள்வரவு'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 max-w-[220px] truncate">
                      <div className="font-bold text-slate-900">{tx.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">SKU: {tx.sku}</div>
                    </td>
                    <td className="p-4 whitespace-nowrap text-center font-bold text-slate-900">
                      {tx.quantity}
                    </td>
                    <td className="p-4 whitespace-nowrap text-right font-medium text-slate-500">
                      {formatCurrency(tx.price)}
                    </td>
                    <td className="p-4 whitespace-nowrap text-right font-black text-slate-900 text-sm">
                      {formatCurrency(tx.total)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="font-mono text-[10px] text-slate-600 font-bold">{tx.referenceNo}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[150px]">{tx.counterParty || '-'}</div>
                    </td>
                    <td className="p-4 whitespace-nowrap text-[10px] text-slate-500 font-medium">
                      {tx.createdByEmail || 'Admin/System'}
                    </td>
                    {userRole === 'admin' && (
                      <td className="p-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDeleteClick(tx)}
                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all cursor-pointer inline-flex items-center"
                          title={language === 'en' ? 'Delete Ledger Entry' : 'லெட்ஜர் பதிவை அழி'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* --- Table Pagination Controls --- */}
        {totalPages > 1 && (() => {
          const fromIndex = filteredTransactions.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
          const toIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredTransactions.length);
          const totalEntries = filteredTransactions.length;
          const showingText = language === 'en' 
            ? `Showing ${fromIndex} to ${toIndex} of ${totalEntries} entries`
            : `${totalEntries} பதிவுகளில் ${fromIndex} முதல் ${toIndex} வரை காண்பிக்கப்படுகிறது`;

          const pageNumbers = [];
          for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
          }

          return (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
              <div className="text-xs text-slate-500 font-bold">
                {showingText}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer transition-all disabled:cursor-not-allowed"
                >
                  {language === 'en' ? 'Previous' : 'முந்தைய'}
                </button>
                
                {/* Page Numbers Grid */}
                <div className="hidden sm:flex items-center gap-1">
                  {pageNumbers.map((num) => {
                    if (
                      totalPages > 6 &&
                      num !== 1 &&
                      num !== totalPages &&
                      Math.abs(num - currentPage) > 1
                    ) {
                      if (num === 2 && currentPage > 3) {
                        return <span key="ellipsis-start" className="px-1 text-slate-400 font-bold">...</span>;
                      }
                      if (num === totalPages - 1 && currentPage < totalPages - 2) {
                        return <span key="ellipsis-end" className="px-1 text-slate-400 font-bold">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCurrentPage(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          currentPage === num
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Current Indicator */}
                <div className="sm:hidden text-xs font-bold text-slate-600 px-2">
                  {language === 'en' ? `Page ${currentPage} of ${totalPages}` : `பக்கம் ${currentPage} / ${totalPages}`}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer transition-all disabled:cursor-not-allowed"
                >
                  {language === 'en' ? 'Next' : 'அடுத்தது'}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* --- CSV EXPORT SETTINGS DIALOG --- */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                {language === 'en' ? 'Export CSV Data' : 'சிஎஸ்வி தரவு ஏற்றுமதி'}
              </h3>
              <button 
                onClick={() => setShowExportDialog(false)} 
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Export Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  {language === 'en' ? '1. Select Export Type' : '1. ஏற்றுமதி வகையைத் தேர்ந்தெடுக்கவும்'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportType('all')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'all'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'All Transactions' : 'அனைத்து பரிவர்த்தனை'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('sales')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'sales'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'Sales Only' : 'விற்பனை மட்டும்'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('inward')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'inward'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'Inward Only' : 'உள்வரவு மட்டும்'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('stock')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'stock'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'Current Stock' : 'நடப்பு இருப்பு'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('restock')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'restock'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'Restock Only' : 'ரீஸ்டாக் மட்டும்'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('deleted')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'deleted'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'Deleted Only' : 'அழிக்கப்பட்டது மட்டும்'}
                  </button>
                </div>
              </div>

              {/* Date Filters */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {language === 'en' ? '2. Choose Date Range' : '2. தேதி வரம்பைத் தேர்ந்தெடுக்கவும்'}
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Start Date */}
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {language === 'en' ? 'Start Date' : 'தொடக்க தேதி'}
                    </span>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-bold cursor-pointer"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold mb-1">
                      {language === 'en' ? 'End Date' : 'முடிவு தேதி'}
                    </span>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-bold cursor-pointer"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed mt-1 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    {language === 'en'
                      ? 'Leave dates blank to export all historical records. Stock export will filter products by their last modification date.'
                      : 'வரம்பற்ற வரலாற்றுப் பதிவுகளுக்கு தேதிகளை காலியாக விடவும்.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                {language === 'en' ? 'Cancel' : 'ரத்து செய்'}
              </button>
              <button
                type="button"
                onClick={handleExecuteExport}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-lg font-black shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                {language === 'en' ? 'Export CSV' : 'சிஎஸ்வி ஏற்றுமதி'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM DELETION CONFIRMATION DIALOG --- */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {language === 'en' ? 'Confirm Deletion' : 'அழிப்பதை உறுதிசெய்'}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {language === 'en' 
                    ? `Are you sure you want to delete this ${deleteTarget.type} ledger entry for "${deleteTarget.productName}"? This will not revert stock counts automatically.`
                    : `"${deleteTarget.productName}" க்கான இந்த ${deleteTarget.type === 'sales' ? 'விற்பனை' : 'உள்வரவு'} லெட்ஜர் பதிவை உறுதியாக அழிக்க விரும்புகிறீர்களா? இது தானாகவே இருப்பு எண்ணிக்கையை மாற்றியமைக்காது.`}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-center gap-3 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {language === 'en' ? 'No, Cancel' : 'இல்லை, ரத்து செய்'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {language === 'en' ? 'Deleting...' : 'அழிக்கப்படுகிறது...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {language === 'en' ? 'Yes, Delete' : 'ஆம், அழி'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CLEAR ALL LOGS CONFIRMATION DIALOG --- */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {language === 'en' ? 'Clear All Logs?' : 'பதிவுகளை அழிக்கலாமா?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {language === 'en' 
                    ? 'Are you absolutely sure you want to clear ALL transaction ledger entries from the database? This action is permanent and cannot be undone.'
                    : 'தரவுத்தளத்தில் இருந்து அனைத்து பரிவர்த்தனை பதிவுகளையும் முழுமையாக அழிக்க விரும்புகிறீர்களா? இந்த செயல் நிரந்தரமானது மற்றும் மீட்டெடுக்க முடியாது.'}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-center gap-3 text-xs">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {language === 'en' ? 'No, Cancel' : 'இல்லை, ரத்து செய்'}
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleConfirmClear}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {language === 'en' ? 'Clearing...' : 'அழிக்கப்படுகிறது...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {language === 'en' ? 'Yes, Clear All' : 'ஆம், அனைத்தும் அழி'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl shadow-xl transition-all border ${
          feedback.type === 'success' 
            ? 'bg-slate-950 border-slate-800 text-white font-semibold' 
            : 'bg-red-950 border-red-900 text-red-50 font-semibold'
        }`}>
          <ArrowDownUp className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span className="text-xs uppercase tracking-wider font-bold text-white">{feedback.text}</span>
        </div>
      )}

    </div>
  );
}
