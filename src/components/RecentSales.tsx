import React from 'react';
import { Bill, Language, UserProfile, Product, Transaction } from '../types';
import { translations } from '../translations';
import { 
  ShoppingBag, Search, X, Trash2, Calendar, CreditCard, User, Printer, FileText, Filter, ChevronDown, ArrowUpCircle,
  Image as ImageIcon, Send, RefreshCw, Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface RecentSalesProps {
  language: Language;
  bills: Bill[];
  products?: Product[];
  userRole?: 'admin' | 'user' | null;
  onDeleteBill?: (id: string, billNo: string) => Promise<void>;
  onEditProduct?: (id: string, product: Partial<Product>) => Promise<void>;
  onAddTransaction?: (tx: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  onUpdateBill?: (id: string, updatedBill: Partial<Bill>) => Promise<void>;
  companyDetails?: {
    name: string;
    gstin: string;
    address: string;
    phone: string;
  };
  onClearInvoices?: () => Promise<void>;
}

// Helper to temporarily remove/convert styles that use oklch or color-mix during html2canvas render to avoid crashes
const runWithSafeStylesheets = async <T,>(callback: () => Promise<T>): Promise<T> => {
  const originalStylesheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')) as (HTMLStyleElement | HTMLLinkElement)[];
  const tempStyleElements: HTMLStyleElement[] = [];

  for (const sheet of originalStylesheets) {
    try {
      let cssText = '';
      if (sheet.tagName === 'STYLE') {
        cssText = (sheet as HTMLStyleElement).innerHTML;
      } else {
        const linkSheet = sheet as HTMLLinkElement;
        if (linkSheet.sheet) {
          try {
            cssText = Array.from(linkSheet.sheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch {
            // Ignore CORS issues with external stylesheets
          }
        }
      }

      if (cssText && (cssText.includes('oklch') || cssText.includes('color-mix'))) {
        const safeCssText = cssText
          .replace(/oklch\([^)]+\)/g, 'rgb(30, 41, 59)')
          .replace(/color-mix\([^)]+\)/g, 'rgb(30, 41, 59)');
        
        const tempStyle = document.createElement('style');
        tempStyle.textContent = safeCssText;
        tempStyle.setAttribute('data-temp-html2canvas', 'true');
        document.head.appendChild(tempStyle);
        tempStyleElements.push(tempStyle);
        
        sheet.disabled = true;
      }
    } catch (e) {
      console.warn('Could not process stylesheet:', e);
    }
  }

  try {
    return await callback();
  } finally {
    originalStylesheets.forEach(sheet => {
      sheet.disabled = false;
    });
    tempStyleElements.forEach(el => el.remove());
  }
};

export default function RecentSales({ 
  language, bills, products, userRole, onDeleteBill, onEditProduct, onAddTransaction, onUpdateBill, companyDetails, onClearInvoices
}: RecentSalesProps) {
  const t = translations[language];
  const [selectedBill, setSelectedBill] = React.useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [paymentFilter, setPaymentFilter] = React.useState<string>('All');
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  // WhatsApp & Download States
  const [whatsAppPhone, setWhatsAppPhone] = React.useState<string>('');
  const [isDownloading, setIsDownloading] = React.useState<'pdf' | 'image' | null>(null);

  // Deletion States
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; billNo: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Clear Invoices States
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  const handleDeleteClick = (id: string, billNo: string) => {
    setDeleteTarget({ id, billNo });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (onDeleteBill) {
        await onDeleteBill(deleteTarget.id, deleteTarget.billNo);
        setFeedback({
          type: 'success',
          text: language === 'en' ? 'Bill deleted!' : 'பில் வெற்றிகரமாக அழிக்கப்பட்டது!'
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to delete bill.' : 'பில்லை அழிக்க முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setSelectedBill(null); // Close detail modal if open
    }
  };

  const handleConfirmClearInvoices = async () => {
    setIsClearing(true);
    try {
      if (onClearInvoices) {
        await onClearInvoices();
        setFeedback({
          type: 'success',
          text: language === 'en' ? 'All recent sales invoices cleared successfully!' : 'அனைத்து விற்பனை இன்வாய்ஸ்களும் வெற்றிகரமாக நீக்கப்பட்டன!'
        });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to clear sales invoices.' : 'விற்பனை இன்வாய்ஸ்களை நீக்க முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleBackupCSV = () => {
    try {
      const headers = [
        'Date',
        'Invoice No',
        'Customer Name',
        'Customer Phone',
        'Payment Method',
        'Subtotal (INR)',
        'Discount (INR)',
        'GST (INR)',
        'Grand Total (INR)',
        'Items'
      ];

      const csvRows = [headers.join(',')];

      for (const bill of filteredBills) {
        const itemsStr = (bill.items || []).map(item => {
          return `${item.sku}: ${item.name.replace(/,/g, ' ')} (${item.quantity}x${item.price})`;
        }).join(' | ');

        const row = [
          new Date(bill.date).toISOString().split('T')[0],
          `"${bill.billNo}"`,
          `"${(bill.customerName || '').replace(/"/g, '""')}"`,
          `"${bill.customerPhone || ''}"`,
          `"${bill.paymentMethod || ''}"`,
          bill.subtotal,
          bill.discount,
          bill.gst,
          bill.grandTotal,
          `"${itemsStr.replace(/"/g, '""')}"`
        ];

        csvRows.push(row.join(','));
      }

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sales_backup_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedback({
        type: 'success',
        text: language === 'en' ? 'Sales backup CSV downloaded successfully!' : 'விற்பனை காப்புப் பிரதி வெற்றிகரமாக பதிவிறக்கம் செய்யப்பட்டது!'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to export sales backup.' : 'காப்புப் பிரதி எடுக்க முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  React.useEffect(() => {
    if (selectedBill) {
      setWhatsAppPhone(selectedBill.customerPhone || '');
    } else {
      setWhatsAppPhone('');
    }
  }, [selectedBill]);

  const handleShareWhatsApp = () => {
    if (!whatsAppPhone.trim()) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Please enter a WhatsApp number.' : 'வாட்ஸ்அப் எண் ஒன்றை உள்ளிடவும்.'
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    const cleanedPhone = whatsAppPhone.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.startsWith('91') && cleanedPhone.length > 10 ? cleanedPhone : `91${cleanedPhone}`;

    // Open WhatsApp deep link directly to contact chat as requested (without any pre-typed message)
    const whatsappUrl = `https://wa.me/${formattedPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (!selectedBill) return;
    const element = document.getElementById('printable-receipt-area');
    if (!element) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Bill content not found.' : 'பில் விபரம் கண்டறியப்படவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setIsDownloading('pdf');
    const originalOverflowY = element.style.overflowY;
    const originalMaxHeight = element.style.maxHeight;
    const originalHeight = element.style.height;

    try {
      element.style.overflowY = 'visible';
      element.style.maxHeight = 'none';
      element.style.height = 'auto';

      const canvas = await runWithSafeStylesheets(() => 
        html2canvas(element, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX
        })
      );

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidth, imgHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Bill_${selectedBill.billNo}.pdf`);
      
      setFeedback({
        type: 'success',
        text: language === 'en' ? 'PDF downloaded successfully!' : 'PDF வெற்றிகரமாக பதிவிறக்கம் செய்யப்பட்டது!'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to generate PDF.' : 'PDF உருவாக்கத் தவறிவிட்டது.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      element.style.overflowY = originalOverflowY;
      element.style.maxHeight = originalMaxHeight;
      element.style.height = originalHeight;
      setIsDownloading(null);
    }
  };

  const handleDownloadImage = async () => {
    if (!selectedBill) return;
    const element = document.getElementById('printable-receipt-area');
    if (!element) {
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Bill content not found.' : 'பில் விபரம் கண்டறியப்படவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setIsDownloading('image');
    const originalOverflowY = element.style.overflowY;
    const originalMaxHeight = element.style.maxHeight;
    const originalHeight = element.style.height;

    try {
      element.style.overflowY = 'visible';
      element.style.maxHeight = 'none';
      element.style.height = 'auto';

      const canvas = await runWithSafeStylesheets(() =>
        html2canvas(element, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX
        })
      );

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Bill_${selectedBill.billNo}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFeedback({
        type: 'success',
        text: language === 'en' ? 'Image downloaded successfully!' : 'பில் படம் வெற்றிகரமாக பதிவிறக்கம் செய்யப்பட்டது!'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to generate image.' : 'படம் உருவாக்கத் தவறிவிட்டது.'
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      element.style.overflowY = originalOverflowY;
      element.style.maxHeight = originalMaxHeight;
      element.style.height = originalHeight;
      setIsDownloading(null);
    }
  };

  // Product Return States
  const [returningItemSku, setReturningItemSku] = React.useState<string | null>(null);
  const [returnQty, setReturnQty] = React.useState<number>(1);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Return Processing
  const handleConfirmReturn = async (item: any) => {
    if (!selectedBill || !onUpdateBill || !onEditProduct || !onAddTransaction) return;
    
    try {
      // 1. Revert product quantity in inventory
      const prod = products?.find(p => p.sku === item.sku);
      if (prod) {
        const newQty = prod.quantity + returnQty;
        await onEditProduct(prod.id!, {
          quantity: newQty,
          updatedAt: new Date().toISOString()
        });
      }

      // 2. Log return transaction
      await onAddTransaction({
        type: 'inward',
        sku: item.sku,
        productName: item.name,
        quantity: returnQty,
        price: item.price,
        total: returnQty * item.price,
        referenceNo: `${selectedBill.billNo}-RET`,
        counterParty: selectedBill.customerName || '',
        paymentMethod: selectedBill.paymentMethod,
        date: new Date().toISOString()
      });

      // 3. Update Bill Items
      const updatedItems = selectedBill.items.map(it => {
        if (it.sku === item.sku) {
          const nextQty = it.quantity - returnQty;
          return {
            ...it,
            quantity: nextQty,
            total: nextQty * it.price
          };
        }
        return it;
      }).filter(it => it.quantity > 0);

      // 4. Recalculate Totals
      const subtotal = updatedItems.reduce((sum, it) => sum + it.total, 0);
      const discount = Math.min(selectedBill.discount, subtotal);
      const calculatedGst = subtotal > 0 ? Math.round(((subtotal - discount) * 0.05) * 100) / 100 : 0;
      const grandTotal = Math.max(0, subtotal - discount + calculatedGst);

      // 5. Update Bill in DB
      const updatedBillData = {
        items: updatedItems,
        subtotal,
        discount,
        gst: calculatedGst,
        grandTotal
      };
      
      await onUpdateBill(selectedBill.id!, updatedBillData);

      // 6. Update local modal state
      setSelectedBill({
        ...selectedBill,
        ...updatedBillData
      });
      setReturningItemSku(null);
      
      // Toast notification
      setFeedback({
        type: 'success',
        text: language === 'en' 
          ? `Returned ${returnQty} of "${item.name}" to stock!` 
          : `"${item.name}" இன் ${returnQty} பொருட்கள் பழைய ஸ்டாக்கில் சேர்க்கப்பட்டது!`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Return product failed:", err);
      setFeedback({
        type: 'error',
        text: language === 'en' ? 'Failed to process product return.' : 'பொருளைத் திரும்பப் பெற முடியவில்லை.'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Helper formatting for currency
  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Extract unique payment methods
  const paymentMethods = React.useMemo(() => {
    const methods = new Set(bills.map(b => b.paymentMethod).filter(Boolean));
    return ['All', ...Array.from(methods)];
  }, [bills]);

  // Filter bills
  const filteredBills = React.useMemo(() => {
    let list = [...(bills || [])];

    if (paymentFilter !== 'All') {
      list = list.filter(b => b.paymentMethod === paymentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => 
        b.billNo.toLowerCase().includes(q) ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.customerPhone && b.customerPhone.toLowerCase().includes(q))
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter(b => new Date(b.date).getTime() >= start.getTime());
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(b => new Date(b.date).getTime() <= end.getTime());
    }

    // Sort by date newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, paymentFilter, searchQuery, startDate, endDate]);

  // Total sales for filtered bills
  const filteredTotalSales = React.useMemo(() => {
    return filteredBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
  }, [filteredBills]);

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-600" />
            {language === 'en' ? 'Sales Details' : 'விற்பனை விவரங்கள்'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {language === 'en' 
              ? 'View, search, and manage customer billing invoices.' 
              : 'வாடிக்கையாளர் பில்களைப் பார்க்க, தேட, மற்றும் நிர்வகிக்கவும்.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-xs">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span>{filteredBills.length} {language === 'en' ? 'Invoices Found' : 'பில்கள் கண்டறியப்பட்டன'}</span>
          </div>

          {/* Backup CSV Button */}
          <button
            type="button"
            onClick={handleBackupCSV}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100/70 text-emerald-700 hover:text-emerald-800 transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-200 hover:border-emerald-300 shadow-xs"
            title={language === 'en' ? 'Backup all sales details to CSV' : 'விற்பனை விவரங்களை சிஎஸ்வி கோப்பாக காப்புப் பிரதி எடுக்கவும்'}
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span>{language === 'en' ? 'Backup CSV' : 'சிஎஸ்வி காப்புப் பிரதி'}</span>
          </button>

          {/* Clear Invoice Button (Admin only) */}
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100/70 text-rose-700 hover:text-rose-800 transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200 hover:border-rose-300 shadow-xs"
              title={language === 'en' ? 'Clear all invoices' : 'அனைத்து இன்வாய்ஸ்களையும் அழிக்கவும்'}
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>{language === 'en' ? 'Clear Invoice' : 'இன்வாய்ஸை அழி'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'en' ? 'Search by Bill No, Customer, or Phone...' : 'பில் எண், வாடிக்கையாளர் அல்லது தொலைபேசி மூலம் தேடுக...'}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        {/* Payment Method Filter */}
        <div className="relative sm:w-48">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 pr-8 py-2 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full"
          >
            {paymentMethods.map(method => (
              <option key={method} value={method}>
                {method === 'All' ? (language === 'en' ? 'All Methods' : 'அனைத்து முறைகளும்') : method.toUpperCase()}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Date Range & Summary Stats */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-center animate-in fade-in duration-200">
        {/* Date Filters */}
        <div className="md:col-span-7 flex flex-col sm:flex-row gap-3 items-end sm:items-center">
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
        <div className="md:col-span-5 grid grid-cols-2 gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'en' ? 'Total Bills In Range' : 'வரம்பிற்குள் பில்கள்'}
            </span>
            <span className="block text-lg font-black text-slate-800 mt-1">
              {filteredBills.length}
            </span>
          </div>

          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/50">
            <span className="block text-[9px] font-bold text-emerald-800/65 uppercase tracking-wider">
              {language === 'en' ? 'Total Amount' : 'மொத்த தொகை'}
            </span>
            <span className="block text-lg font-black text-emerald-600 mt-1">
              {formatCurrency(filteredTotalSales)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
        <div className="overflow-x-auto">
          {filteredBills.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/20 text-slate-400 font-medium flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="h-10 w-10 text-slate-300 stroke-[1.5]" />
              <p className="text-xs">
                {language === 'en' ? 'No recent sales invoices match your search criteria.' : 'தேடலுக்குப் பொருந்தும் பில்கள் ஏதுமில்லை.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === 'en' ? 'Bill No' : 'பில் எண்'}</th>
                  <th className="p-4">{language === 'en' ? 'Date & Time' : 'தேதி & நேரம்'}</th>
                  <th className="p-4">{language === 'en' ? 'Customer Name' : 'வாடிக்கையாளர்'}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Items' : 'பொருட்கள்'}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Payment' : 'வகை'}</th>
                  <th className="p-4 text-right">{language === 'en' ? 'Grand Total' : 'மொத்த தொகை'}</th>
                  <th className="p-4 text-center">{language === 'en' ? 'Actions' : 'செயல்கள்'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredBills.map((bill) => {
                  const itemCount = bill.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <tr 
                      key={bill.id || bill.billNo} 
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedBill(bill)}
                    >
                      <td className="p-4 font-mono font-bold text-slate-900">
                        {bill.billNo}
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>
                            {new Date(bill.date).toLocaleString(
                              language === 'ta' ? 'ta-IN' : 'en-US', 
                              { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 max-w-[180px] truncate">
                        <div className="font-bold text-slate-800">
                          {bill.customerName || (language === 'en' ? 'Guest Customer' : 'விருந்தினர்')}
                        </div>
                        {bill.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{bill.customerPhone}</div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap text-center font-semibold text-slate-600">
                        {itemCount}
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                          {bill.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-right font-black text-emerald-600 text-sm">
                        {formatCurrency(bill.grandTotal)}
                      </td>
                      <td className="p-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedBill(bill)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-all cursor-pointer inline-flex items-center"
                            title={language === 'en' ? 'View Receipt' : 'பில் காண்க'}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteClick(bill.id!, bill.billNo)}
                              className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all cursor-pointer inline-flex items-center"
                              title={language === 'en' ? 'Delete Bill' : 'பில்லை அழி'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bill Receipt Overlay Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm tracking-wide">
                  {language === 'en' ? 'Sale Invoice Details' : 'விற்பனை பில் விவரங்கள்'}
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
            <div className="p-4 max-h-[280px] overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {language === 'en' ? 'Items Purchased' : 'வாங்கப்பட்ட பொருட்கள்'}
              </p>
              <div className="divide-y divide-slate-100">
                {selectedBill.items.map((item, idx) => {
                  const isReturningThis = returningItemSku === item.sku;
                  const prod = products?.find(p => p.sku === item.sku);

                  return (
                    <div key={idx} className="py-3 flex flex-col text-xs">
                      <div className="flex justify-between items-start">
                        <div className="pr-4">
                          <p className="font-bold text-slate-800 leading-tight">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.quantity} {item.unit || 'pcs'} × {formatCurrency(item.price)}
                          </p>

                          {/* Extra Product Specs (Category, Material, GSM, Color) */}
                          {prod && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {prod.category && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold uppercase tracking-wide">
                                  {language === 'en' ? 'Category: ' : 'வகை: '} {prod.category}
                                </span>
                              )}
                              {prod.material && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-bold uppercase tracking-wide">
                                  {language === 'en' ? 'Material: ' : 'மெட்டீரியல்: '} {prod.material}
                                </span>
                              )}
                              {prod.gsm && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold uppercase tracking-wide">
                                  {language === 'en' ? 'GSM: ' : 'ஜிஎஸ்எம்: '} {prod.gsm}
                                </span>
                              )}
                              {prod.color && (
                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-bold uppercase tracking-wide">
                                  {language === 'en' ? 'Color: ' : 'வண்ணம்: '} {prod.color}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-100 rounded text-[9px] font-mono">
                                SKU: {prod.sku}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 shrink-0">
                            {formatCurrency(item.total)}
                          </span>
                          {!isReturningThis && item.quantity > 0 && (
                            <button
                              onClick={() => {
                                setReturningItemSku(item.sku);
                                setReturnQty(1);
                              }}
                              className="ml-2 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
                              title={language === 'en' ? 'Return Product' : 'பொருளை திரும்பப்பெறு'}
                            >
                              <ArrowUpCircle className="h-3 w-3 rotate-180 text-amber-600" />
                              {language === 'en' ? 'Return' : 'ரிட்டன்'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isReturningThis && (
                        <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2 animate-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500">
                              {language === 'en' ? 'Qty to return:' : 'ரிட்டன் அளவு:'}
                            </span>
                            <button
                              onClick={() => setReturnQty(q => Math.max(1, q - 1))}
                              className="p-1 w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer text-slate-700"
                            >
                              -
                            </button>
                            <span className="text-xs font-black px-1 text-slate-800">{returnQty}</span>
                            <button
                              onClick={() => setReturnQty(q => Math.min(item.quantity, q + 1))}
                              className="p-1 w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-xs font-bold hover:bg-slate-100 cursor-pointer text-slate-700"
                            >
                              +
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleConfirmReturn(item)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              {language === 'en' ? 'Confirm' : 'உறுதி செய்'}
                            </button>
                            <button
                              onClick={() => setReturningItemSku(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                  <span>{language === 'en' ? 'GST (5%)' : 'ஜிஎஸ்டி (5%)'}</span>
                  <span>{formatCurrency(selectedBill.gst)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                <span>{language === 'en' ? 'Grand Total' : 'மொத்த தொகை'}</span>
                <span>{formatCurrency(selectedBill.grandTotal)}</span>
              </div>
            </div>

            {/* WhatsApp send / share action box */}
            <div className="px-6 py-4 bg-emerald-50/50 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                  {language === 'en' ? 'Send via WhatsApp' : 'வாட்ஸ்அப் மூலம் பில் அனுப்ப'}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  {language === 'en' ? 'Direct Message Link' : 'நேரடி வாட்ஸ்அப் இணைப்பு'}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">+91</span>
                  <input
                    type="tel"
                    id="whatsapp-number"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={language === 'en' ? 'Enter 10-digit number' : '10-இலக்க எண்'}
                    className="w-full pl-10 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all bg-white text-slate-800"
                  />
                </div>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{language === 'en' ? 'Send' : 'அனுப்பு'}</span>
                </button>
              </div>
              {/* Informative Help Tip for PDF/JPEG sharing */}
              <p className="text-[10px] text-emerald-800 font-bold leading-relaxed bg-emerald-100/50 p-2 rounded-lg border border-emerald-100 mt-1">
                💡 {language === 'en' 
                  ? "Tip: Use 'Download PDF' or 'Download Image' below to save the bill, then simply paste or attach it on the WhatsApp window." 
                  : "குறிப்பு: கீழே உள்ள 'PDF பதிவிறக்கு' அல்லது 'படம் பதிவிறக்கு' பட்டனைப் பயன்படுத்தி பில்லைச் சேமித்து, வாட்ஸ்அப்பில் எளிதாக அட்டாச் செய்து அனுப்பலாம்."}
              </p>
            </div>

            {/* Print and Download triggers */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
              {/* Download Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isDownloading === 'pdf' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isDownloading === 'pdf' 
                      ? (language === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...') 
                      : (language === 'en' ? 'Download PDF' : 'PDF பதிவிறக்கு')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isDownloading !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isDownloading === 'image' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isDownloading === 'image' 
                      ? (language === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...') 
                      : (language === 'en' ? 'Download Image' : 'படம் பதிவிறக்கு')}
                  </span>
                </button>
              </div>

              {/* Print and Close buttons */}
              <div className="flex gap-2 border-t border-slate-200/60 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  {language === 'en' ? 'Print Bill' : 'பில் அச்சிடு'}
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-white border-t border-slate-100 flex justify-between items-center">
              {userRole === 'admin' && (
                <button
                  onClick={() => handleDeleteClick(selectedBill.id!, selectedBill.billNo)}
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

      {/* Hidden / Print-only Receipt Container */}
      {selectedBill && (
        <div className="absolute -top-[9999px] -left-[9999px] opacity-0 pointer-events-none print:static print:opacity-100 print:pointer-events-auto">
          <div id="printable-receipt-area" className="p-6 font-sans text-slate-800 bg-white max-w-md mx-auto">
            {/* Thermal Invoice Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                {companyDetails?.name || (language === 'en' ? 'Inventory Store' : 'சரக்குக் கடை')}
              </h3>
              {companyDetails?.gstin && (
                <p className="text-[10px] text-slate-500 font-medium">
                  {language === 'en' ? 'GSTIN: ' : 'பதிவு எண்: '} {companyDetails.gstin}
                </p>
              )}
              {companyDetails?.address && (
                <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-relaxed">
                  {companyDetails.address}
                </p>
              )}
              {companyDetails?.phone && (
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {language === 'en' ? 'Tel: ' : 'மொபைல்: '} {companyDetails.phone}
                </p>
              )}
            </div>

            {/* Receipt details */}
            <div className="space-y-1 text-xs font-semibold text-slate-500 border-b border-dashed border-slate-200 pb-3 mt-4">
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Bill No' : 'பில் எண்'}:</span>
                <span className="text-slate-900 font-mono">{selectedBill.billNo}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Date' : 'தேதி'}:</span>
                <span className="text-slate-900">{new Date(selectedBill.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Customer' : 'வாடிக்கையாளர்'}:</span>
                <span className="text-slate-900 font-bold">{selectedBill.customerName}</span>
              </div>
              {selectedBill.customerPhone && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span className="text-slate-900">{selectedBill.customerPhone}</span>
                </div>
              )}
              {selectedBill.customerGst && (
                <div className="flex justify-between">
                  <span>Customer GSTIN:</span>
                  <span className="text-slate-900 font-mono font-bold uppercase">{selectedBill.customerGst}</span>
                </div>
              )}
              {selectedBill.customerAddress && (
                <div className="flex justify-between items-start gap-2">
                  <span className="flex-shrink-0">Address:</span>
                  <span className="text-slate-900 text-right whitespace-pre-wrap">{selectedBill.customerAddress}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="text-slate-900">{selectedBill.paymentMethod}</span>
              </div>
            </div>

            {/* Table list of Items purchased */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-4 mt-4">
              <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="col-span-6">{language === 'en' ? 'Product Name' : 'பொருளின் பெயர்'}</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Price</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {selectedBill.items.map((item, index) => {
                const prod = products?.find(p => p.sku === item.sku);
                return (
                  <div key={index} className="grid grid-cols-12 text-xs font-semibold text-slate-700 py-1 border-b border-slate-50 last:border-none">
                    <div className="col-span-6 pr-1">
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-[9px] text-slate-400 font-normal font-mono">SKU: {item.sku}</p>
                      {prod && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] text-slate-600 font-bold leading-tight">
                          {prod.color && (
                            <span>
                              {language === 'en' ? 'Color: ' : 'வண்ணம்: '} {prod.color}
                            </span>
                          )}
                          {prod.color && prod.size && <span className="text-slate-300 font-normal">|</span>}
                          {prod.size && (
                            <span>
                              {language === 'en' ? 'Size: ' : 'அளவு: '} {prod.size}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="col-span-2 text-center">{item.quantity} {item.unit || 'pcs'}</span>
                    <span className="col-span-2 text-right">{formatCurrency(item.price)}</span>
                    <span className="col-span-2 text-right font-bold text-slate-900">{formatCurrency(item.total)}</span>
                  </div>
                );
              })}
            </div>

            {/* Grand summary receipts */}
            <div className="space-y-1.5 text-xs font-semibold text-slate-500 text-right max-w-xs ml-auto mt-4">
              <div className="flex justify-between">
                <span>{language === 'en' ? 'Subtotal' : 'துணைத் தொகை'}:</span>
                <span className="text-slate-900 font-bold">{formatCurrency(selectedBill.subtotal)}</span>
              </div>
              {selectedBill.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{language === 'en' ? 'Discount' : 'தள்ளுபடி'}:</span>
                  <span>- {formatCurrency(selectedBill.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{selectedBill.gst > 0 ? 'GST (5%)' : 'GST (0%)'}:</span>
                <span className="text-slate-900 font-bold">{formatCurrency(selectedBill.gst)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-950">
                <span>{language === 'en' ? 'Grand Total' : 'மொத்த தொகை'}:</span>
                <span className="text-base text-slate-950 font-extrabold">{formatCurrency(selectedBill.grandTotal)}</span>
              </div>
            </div>

            {/* Welcome Footer thermal receipt */}
            <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-400 font-bold mt-4">
              <p>{language === 'en' ? 'Thank You For Your Business!' : 'வணிகத்திற்கு மிக்க நன்றி!'}</p>
              <p className="mt-0.5">{language === 'en' ? 'Visit Again' : 'மீண்டும் வருக'}</p>
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
                    ? `Are you sure you want to delete invoice "${deleteTarget.billNo}"? This will revert stock counts and remove all associated transaction ledger records.`
                    : `இன்வாய்ஸ் "${deleteTarget.billNo}" ஐ நீங்கள் உறுதியாக அழிக்க விரும்புகிறீர்களா? இது இருப்பு அளவுகளை மாற்றியமைத்து அனைத்து பரிவர்த்தனை பதிவுகளையும் நீக்கும்.`}
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

      {/* --- CUSTOM CLEAR ALL INVOICES CONFIRMATION DIALOG --- */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {language === 'en' ? 'Clear All Invoices?' : 'அனைத்து பில்களையும் அழிக்கலாமா?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {language === 'en' 
                    ? 'Are you absolutely sure you want to clear ALL sales invoices from the database? This action is permanent and cannot be undone.'
                    : 'தரவுத்தளத்தில் இருந்து அனைத்து விற்பனை பில்களையும் முழுமையாக அழிக்க விரும்புகிறீர்களா? இந்த செயல் நிரந்தரமானது மற்றும் மீட்டெடுக்க முடியாது.'}
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
                onClick={handleConfirmClearInvoices}
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
          <ShoppingBag className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
          <span className="text-xs uppercase tracking-wider font-bold text-white">{feedback.text}</span>
        </div>
      )}
    </div>
  );
}
