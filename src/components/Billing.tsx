import React from 'react';
import { Product, Transaction, Bill, BillItem, Language } from '../types';
import { translations } from '../translations';
import { 
  ShoppingCart, Trash2, Plus, Minus, Printer, Save, RefreshCw, 
  Search, User, Phone, Sparkles, Receipt, X, ArrowUpCircle,
  ChevronDown, ChevronUp, Eye, Send, Share2, Download, FileText, Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface SizeItem {
  sizeName: string;
  quantity: number;
  price: number;
  sku: string;
  product: Product;
}

interface ColorGroup {
  colorName: string;
  totalQuantity: number;
  sizes: SizeItem[];
}

interface ProductGroup {
  name: string;
  category: string;
  totalQuantity: number;
  minPrice: number;
  maxPrice: number;
  colors: Record<string, ColorGroup>;
}

interface BillingProps {
  language: Language;
  products: Product[];
  onAddBill: (bill: Omit<Bill, 'id' | 'userId'>) => Promise<void>;
  onEditProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  lastScannedSku?: string | null;
  clearLastScannedSku?: () => void;
  companyDetails?: {
    name: string;
    gstin: string;
    address: string;
    phone: string;
  };
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

export default function Billing({ 
  language, products, onAddBill, onEditProduct, onAddTransaction, lastScannedSku, clearLastScannedSku, companyDetails 
}: BillingProps) {
  const t = translations[language];

  // --- POS CART STATE ---
  const [cart, setCart] = React.useState<BillItem[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customerName, setCustomerName] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_customerName');
      return saved !== null && saved !== '' ? saved : '';
    } catch {
      return '';
    }
  });
  const [customerPhone, setCustomerPhone] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_customerPhone');
      return saved !== null && saved !== '' ? saved : '';
    } catch {
      return '';
    }
  });
  const [paymentMethod, setPaymentMethod] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_paymentMethod');
      return saved !== null ? saved : 'Cash';
    } catch {
      return 'Cash';
    }
  });
  const [discountAmount, setDiscountAmount] = React.useState<number | ''>(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_discountAmount');
      if (saved === '') return '';
      return saved ? Number(saved) : '';
    } catch {
      return '';
    }
  });
  const [includeGst, setIncludeGst] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_includeGst');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [showTaxFields, setShowTaxFields] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_showTaxFields');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [customerGst, setCustomerGst] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_customerGst');
      return saved !== null && saved !== '' ? saved : '';
    } catch {
      return '';
    }
  });

  const [customerAddress, setCustomerAddress] = React.useState(() => {
    try {
      const saved = localStorage.getItem('inventory_billing_draft_customerAddress');
      return saved !== null && saved !== '' ? saved : '';
    } catch {
      return '';
    }
  });

  const taxPercent = includeGst ? 5 : 0;
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState<'pdf' | 'image' | null>(null);

  // Auto-save billing draft state to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('inventory_billing_draft_cart', JSON.stringify(cart));
      localStorage.setItem('inventory_billing_draft_customerName', customerName);
      localStorage.setItem('inventory_billing_draft_customerPhone', customerPhone);
      localStorage.setItem('inventory_billing_draft_paymentMethod', paymentMethod);
      localStorage.setItem('inventory_billing_draft_discountAmount', discountAmount.toString());
      localStorage.setItem('inventory_billing_draft_includeGst', includeGst.toString());
      localStorage.setItem('inventory_billing_draft_showTaxFields', showTaxFields.toString());
      localStorage.setItem('inventory_billing_draft_customerGst', customerGst);
      localStorage.setItem('inventory_billing_draft_customerAddress', customerAddress);
    } catch (e) {
      console.error('Failed to save billing draft to localStorage:', e);
    }
  }, [cart, customerName, customerPhone, paymentMethod, discountAmount, includeGst, showTaxFields, customerGst, customerAddress]);

  // Search Catalog State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedName, setExpandedName] = React.useState<string | null>(null);
  const [selectedColorForProduct, setSelectedColorForProduct] = React.useState<Record<string, string>>({});
  const [selectedColorModal, setSelectedColorModal] = React.useState<{ productName: string, colorName: string, sizes: SizeItem[] } | null>(null);
  const [showPrintInvoice, setShowPrintInvoice] = React.useState<Bill | null>(null);
  const [showReviewInvoice, setShowReviewInvoice] = React.useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = React.useState('');

  // Auto-fill WhatsApp phone when showPrintInvoice becomes active
  React.useEffect(() => {
    if (showPrintInvoice) {
      setWhatsAppPhone(showPrintInvoice.customerPhone || '');
    } else {
      setWhatsAppPhone('');
    }
  }, [showPrintInvoice]);

  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = React.useState<'catalog' | 'cart'>('catalog');

  // Scroll indicators for Cart List
  const cartContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = React.useState(false);

  const handleCartScroll = () => {
    if (cartContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = cartContainerRef.current;
      // Show indicator if there is content to scroll down to (more than 10px remaining)
      const hasMoreToScroll = scrollHeight - scrollTop - clientHeight > 10;
      setShowScrollIndicator(hasMoreToScroll);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleCartScroll();
    }, 150);
    return () => clearTimeout(timer);
  }, [cart]);

  // Auto-inject last scanned SKU from camera barcode scanner
  React.useEffect(() => {
    if (lastScannedSku) {
      handleProductSelectBySku(lastScannedSku);
      if (clearLastScannedSku) clearLastScannedSku();
    }
  }, [lastScannedSku]);

  // Show Toast
  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Safe formatting
  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Add Product to Cart
  const handleProductSelectBySku = (sku: string) => {
    const matchedProd = products.find(p => p.sku === sku);
    if (!matchedProd) {
      triggerFeedback('error', language === 'en' ? `SKU "${sku}" not found in stock.` : `SKU "${sku}" கையிருப்பில் இல்லை.`);
      return;
    }

    if (matchedProd.quantity <= 0) {
      triggerFeedback('error', language === 'en' ? `"${matchedProd.name}" is completely out of stock.` : `"${matchedProd.name}" கையிருப்பு இல்லை.`);
      return;
    }

    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.sku === sku);
      
      if (existingIdx > -1) {
        // Increase quantity
        const existingItem = prevCart[existingIdx];
        if (existingItem.quantity >= matchedProd.quantity) {
          triggerFeedback('error', language === 'en' 
            ? `Cannot exceed total available stock (${matchedProd.quantity} ${matchedProd.unit}).` 
            : `இருப்பு அளவை விட அதிகமாக விற்க இயலாது (${matchedProd.quantity} ${matchedProd.unit}).`);
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIdx] = {
          ...existingItem,
          quantity: existingItem.quantity + 1,
          total: (existingItem.quantity + 1) * existingItem.price
        };
        triggerFeedback('success', `${matchedProd.name} added to cart.`);
        return updated;
      } else {
        // Add new item
        triggerFeedback('success', `${matchedProd.name} added to cart.`);
        return [...prevCart, {
          sku: matchedProd.sku,
          name: matchedProd.name,
          quantity: 1,
          price: matchedProd.sellingPrice,
          total: matchedProd.sellingPrice,
          unit: matchedProd.unit
        }];
      }
    });
  };

  // Adjust Cart Quantities
  const updateCartQty = (sku: string, change: number) => {
    const matchedProd = products.find(p => p.sku === sku);
    if (!matchedProd) return;

    setCart(prevCart => {
      const idx = prevCart.findIndex(item => item.sku === sku);
      if (idx === -1) return prevCart;

      const item = prevCart[idx];
      const newQty = item.quantity + change;

      if (newQty <= 0) {
        // Delete item
        return prevCart.filter(i => i.sku !== sku);
      }

      if (newQty > matchedProd.quantity) {
        triggerFeedback('error', language === 'en' 
          ? `Max stock reached (${matchedProd.quantity} available).` 
          : `கூடுதல் கையிருப்பு இல்லை (${matchedProd.quantity} மட்டுமே உள்ளது).`);
        return prevCart;
      }

      const updated = [...prevCart];
      updated[idx] = {
        ...item,
        quantity: newQty,
        total: newQty * item.price
      };
      return updated;
    });
  };

  // Remove completely from cart
  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(item => item.sku !== sku));
    triggerFeedback('success', 'Item removed from bill.');
  };

  // --- SUMMARY CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalMaxDiscount = cart.reduce((sum, item) => {
    const prod = products.find(p => p.sku === item.sku);
    return sum + (item.quantity * (prod?.maxDiscount || 0));
  }, 0);
  const discount = Number(discountAmount);
  const calculatedGst = subtotal > 0 ? Math.round(((subtotal - discount) * (taxPercent / 100)) * 100) / 100 : 0;
  const grandTotal = Math.max(0, subtotal - discount + calculatedGst);

  // Clear Billing Screen
  const handleClearBill = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount('');
    setIncludeGst(false);
    setShowTaxFields(false);
    setCustomerGst('');
    setCustomerAddress('');
  };

  // Submit and Finalize Invoice
  const handleSaveBill = async () => {
    if (isGenerating) return;
    if (cart.length === 0) {
      triggerFeedback('error', 'Billing cart is empty!');
      return;
    }

    setIsGenerating(true);
    try {
      const generatedBillNo = `INV-${Date.now().toString().slice(-8)}`;
      const newBill: Omit<Bill, 'id' | 'userId'> = {
        billNo: generatedBillNo,
        items: cart,
        subtotal,
        discount,
        gst: calculatedGst,
        grandTotal,
        customerName: customerName.trim() || '',
        customerPhone: customerPhone.trim(),
        paymentMethod,
        date: new Date().toISOString()
      };

      if (showTaxFields && customerGst.trim()) {
        newBill.customerGst = customerGst.trim();
      }
      if (showTaxFields && customerAddress.trim()) {
        newBill.customerAddress = customerAddress.trim();
      }

      // Save Bill Record
      await onAddBill(newBill);

      // Loop through items: update stock level, log individual transaction
      for (const item of cart) {
        const prod = products.find(p => p.sku === item.sku);
        if (prod) {
          // Log sales transaction
          await onAddTransaction({
            type: 'sales',
            sku: item.sku,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            referenceNo: generatedBillNo,
            counterParty: customerName.trim() || '',
            paymentMethod,
            date: new Date().toISOString()
          });

          // Update stock quantity (deduct)
          await onEditProduct(prod.id!, {
            quantity: Math.max(0, prod.quantity - item.quantity),
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Display print overlay
      setShowPrintInvoice({ ...newBill, id: 'temp-print-id' });
      setShowReviewInvoice(false);
      triggerFeedback('success', language === 'en' ? 'Bill saved & finalized!' : 'விலைப்பட்டியல் வெற்றிகரமாகச் சேமிக்கப்பட்டது!');
      handleClearBill();
    } catch (err) {
      triggerFeedback('error', 'Failed to save bill. Verify stock levels or permissions.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Share Bill via WhatsApp
  const handleShareWhatsApp = () => {
    if (!showPrintInvoice) return;
    if (!whatsAppPhone || whatsAppPhone.length < 10) {
      triggerFeedback('error', language === 'en' ? 'Please enter a valid 10-digit WhatsApp number.' : 'தயவுசெய்து சரியான 10-இலக்க வாட்ஸ்அப் எண்ணை உள்ளிடவும்.');
      return;
    }

    // Clean phone number
    const cleanedPhone = whatsAppPhone.replace(/\D/g, '');
    const formattedPhone = cleanedPhone.startsWith('91') && cleanedPhone.length > 10 ? cleanedPhone : `91${cleanedPhone}`;

    // Open WhatsApp deep link directly to contact chat as requested (without any pre-typed message)
    const whatsappUrl = `https://wa.me/${formattedPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  // Print Bill via standard browser print
  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (err) {
      console.error("Print failed:", err);
      triggerFeedback('error', language === 'en' 
        ? 'Print dialog blocked by browser. Please open in a new tab.' 
        : 'அச்சிடும் சாளரம் தடுக்கப்பட்டது. தயவுசெய்து புதிய டேப்பில் திறந்து முயற்சிக்கவும்.'
      );
    }
  };

  // Download Bill as PDF
  const handleDownloadPDF = async () => {
    if (!showPrintInvoice) return;
    const element = document.getElementById('printable-receipt-area');
    if (!element) {
      triggerFeedback('error', 'Bill content not found.');
      return;
    }

    setIsDownloading('pdf');
    const originalOverflowY = element.style.overflowY;
    const originalMaxHeight = element.style.maxHeight;
    const originalHeight = element.style.height;

    try {
      // Temporarily expand the element to full size
      element.style.overflowY = 'visible';
      element.style.maxHeight = 'none';
      element.style.height = 'auto';

      // Use html2canvas inside the safe stylesheet wrapper to render the receipt
      const canvas = await runWithSafeStylesheets(() => 
        html2canvas(element, {
          scale: 3, // Premium high-resolution print scaling
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX
        })
      );

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate width/height in mm. Standard thermal receipt is 80mm wide.
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [imgWidth, imgHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Bill_${showPrintInvoice.billNo}.pdf`);
      triggerFeedback('success', language === 'en' ? 'PDF downloaded successfully!' : 'PDF வெற்றிகரமாக பதிவிறக்கம் செய்யப்பட்டது!');
    } catch (err) {
      console.error(err);
      triggerFeedback('error', language === 'en' ? 'Failed to generate PDF.' : 'PDF உருவாக்கத் தவறிவிட்டது.');
    } finally {
      // Restore styles
      element.style.overflowY = originalOverflowY;
      element.style.maxHeight = originalMaxHeight;
      element.style.height = originalHeight;
      setIsDownloading(null);
    }
  };

  // Download Bill as JPEG Image
  const handleDownloadImage = async () => {
    if (!showPrintInvoice) return;
    const element = document.getElementById('printable-receipt-area');
    if (!element) {
      triggerFeedback('error', 'Bill content not found.');
      return;
    }

    setIsDownloading('image');
    const originalOverflowY = element.style.overflowY;
    const originalMaxHeight = element.style.maxHeight;
    const originalHeight = element.style.height;

    try {
      // Temporarily expand the element to full size
      element.style.overflowY = 'visible';
      element.style.maxHeight = 'none';
      element.style.height = 'auto';

      const canvas = await runWithSafeStylesheets(() =>
        html2canvas(element, {
          scale: 3, // Very sharp image resolution
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
      link.download = `Bill_${showPrintInvoice.billNo}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerFeedback('success', language === 'en' ? 'Image downloaded successfully!' : 'பில் படம் வெற்றிகரமாக பதிவிறக்கம் செய்யப்பட்டது!');
    } catch (err) {
      console.error(err);
      triggerFeedback('error', language === 'en' ? 'Failed to generate image.' : 'படம் உருவாக்கத் தவறிவிட்டது.');
    } finally {
      // Restore styles
      element.style.overflowY = originalOverflowY;
      element.style.maxHeight = originalMaxHeight;
      element.style.height = originalHeight;
      setIsDownloading(null);
    }
  };

  // Filtering catalog search
  const filteredCatalog = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.color && p.color.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.size && p.size.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && p.quantity > 0;
  });

  // Group products by name -> color -> size
  const groupedProducts: ProductGroup[] = React.useMemo(() => {
    const groups: Record<string, ProductGroup> = {};

    filteredCatalog.forEach(p => {
      const name = p.name;
      const category = p.category;
      const color = p.color?.trim() || '';
      const size = p.size?.trim() || '';
      
      const displayColor = color || (language === 'en' ? 'Standard' : 'வழக்கமானது');
      const displaySize = size || (language === 'en' ? 'Standard' : 'வழக்கமானது');

      if (!groups[name]) {
        groups[name] = {
          name,
          category,
          totalQuantity: 0,
          minPrice: p.sellingPrice,
          maxPrice: p.sellingPrice,
          colors: {}
        };
      }

      const g = groups[name];
      g.totalQuantity += p.quantity;
      if (p.sellingPrice < g.minPrice) g.minPrice = p.sellingPrice;
      if (p.sellingPrice > g.maxPrice) g.maxPrice = p.sellingPrice;

      if (!g.colors[displayColor]) {
        g.colors[displayColor] = {
          colorName: displayColor,
          totalQuantity: 0,
          sizes: []
        };
      }

      const c = g.colors[displayColor];
      c.totalQuantity += p.quantity;
      
      c.sizes.push({
        sizeName: displaySize,
        quantity: p.quantity,
        price: p.sellingPrice,
        sku: p.sku,
        product: p
      });
    });

    // Sort sizes inside each color beautifully (XS, S, M, L, XL, XXL...)
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'];
    Object.values(groups).forEach(g => {
      Object.values(g.colors).forEach(c => {
        c.sizes.sort((a, b) => {
          const idxA = sizeOrder.indexOf(a.sizeName.toUpperCase());
          const idxB = sizeOrder.indexOf(b.sizeName.toUpperCase());
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.sizeName.localeCompare(b.sizeName);
        });
      });
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredCatalog, language]);

  const toggleProductExpand = (prodName: string, colorsList: string[]) => {
    if (expandedName === prodName) {
      setExpandedName(null);
    } else {
      setExpandedName(prodName);
      if (!selectedColorForProduct[prodName] && colorsList.length > 0) {
        setSelectedColorForProduct(prev => ({
          ...prev,
          [prodName]: colorsList[0]
        }));
      }
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Mobile Sub-tab Selector */}
      <div className="xl:hidden flex bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs">
        <button
          onClick={() => setActiveSubTab('catalog')}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            activeSubTab === 'catalog'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {language === 'en' ? 'Product Catalog' : 'தயாரிப்புகள் பட்டியல்'}
        </button>
        <button
          onClick={() => setActiveSubTab('cart')}
          className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors cursor-pointer relative flex items-center justify-center gap-1.5 ${
            activeSubTab === 'cart'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{language === 'en' ? 'Active Bill' : 'விலைப்பட்டியல்'}</span>
          {cart.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black animate-pulse">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Toast Feedback */}
        {feedback && (
          <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl shadow-xl transition-all border ${
            feedback.type === 'success' 
              ? 'bg-slate-950 border-slate-800 text-white font-semibold' 
              : 'bg-red-950 border-red-900 text-red-50 font-semibold'
          }`}>
            <ShoppingCart className="h-4.5 w-4.5 shrink-0 text-blue-500" />
            <span className="text-xs uppercase tracking-wider font-bold">{feedback.text}</span>
          </div>
        )}

        {/* COLUMN LEFT: Catalog & Search (7 cols) */}
        <div className={`xl:col-span-7 space-y-4 ${activeSubTab === 'catalog' ? 'block' : 'hidden'} xl:block`}>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">
              {language === 'en' ? 'Stock Selection Catalog' : 'தயாரிப்புகள் பட்டியல்'}
            </h3>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {products.filter(p => p.quantity > 0).length} {language === 'en' ? 'items in stock' : 'விற்பனைக்கு உள்ளன'}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search items by name, SKU or category to add...' : 'பில்லில் சேர்க்க தயாரிப்பு பெயர் அல்லது பார்கோடு தேடுக...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Catalog container - clean single column list vertically scrolling */}
        <div className="flex flex-col gap-4 h-auto md:h-[calc(100vh-240px)] md:min-h-[600px] overflow-y-auto pr-1 pb-10">
          {groupedProducts.map((g: ProductGroup) => {
            const colorsList = Object.keys(g.colors);
            const itemsInGroup = Object.values(g.colors).flatMap((c: ColorGroup) => c.sizes);
            
            // A product is simple if it has only 1 item and its color and size are empty/Standard
            const isSimple = itemsInGroup.length === 1 && 
                             (!itemsInGroup[0].product.color || itemsInGroup[0].product.color.trim() === '') && 
                             (!itemsInGroup[0].product.size || itemsInGroup[0].product.size.trim() === '');
            
            const isExpanded = expandedName === g.name;
            const selectedColor = selectedColorForProduct[g.name] || colorsList[0];
            const sizeOptions = g.colors[selectedColor]?.sizes || [];

            // Low stock indicator across the group
            const isLowStock = g.totalQuantity <= 5;

            // Find image url for currently selected color first, fallback to any group image
            const selectedColorSizes = g.colors[selectedColor]?.sizes || [];
            const activeColorImageUrl = selectedColorSizes.find((item: SizeItem) => item.product.imageUrl)?.product.imageUrl;
            const fallbackImageUrl = itemsInGroup.find((item: SizeItem) => item.product.imageUrl)?.product.imageUrl;
            const groupImageUrl = activeColorImageUrl || fallbackImageUrl;

            return (
              <div 
                key={g.name} 
                className={`w-full bg-white border rounded-xl shadow-xs transition-all flex flex-col justify-between h-auto sm:h-fit ${
                  isExpanded 
                    ? 'border-slate-400 ring-2 ring-slate-100/50 bg-slate-50/5 overflow-visible' 
                    : 'border-slate-200 hover:border-slate-350 hover:shadow-xs overflow-hidden'
                }`}
              >
                <div 
                  onClick={() => {
                    if (!isSimple) {
                      toggleProductExpand(g.name, colorsList);
                    } else {
                      handleProductSelectBySku(itemsInGroup[0].sku);
                    }
                  }}
                  className={`p-5 cursor-pointer select-none transition-colors flex items-center justify-between gap-4 ${
                    isExpanded ? 'bg-slate-50/50 border-b border-slate-100' : 'hover:bg-slate-50/20'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{g.category}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isLowStock ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {g.totalQuantity} {language === 'en' ? 'left' : 'இருப்பு'}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-2">
                      {g.name}
                    </h4>

                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm font-black text-slate-900">
                        {g.minPrice === g.maxPrice 
                          ? formatCurrency(g.minPrice) 
                          : `${formatCurrency(g.minPrice)} - ${formatCurrency(g.maxPrice)}`
                        }
                      </span>
                      
                      {isSimple ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                          + {t.addToBill}
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {colorsList.length} {language === 'en' ? 'Colors' : 'வண்ணங்கள்'} • {itemsInGroup.length} {language === 'en' ? 'Options' : 'வகைகள்'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail Image on the Right */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-150 overflow-hidden flex items-center justify-center relative">
                      {groupImageUrl ? (
                        <img 
                          src={groupImageUrl} 
                          alt={g.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold text-xs uppercase">
                          {g.name.substring(0, 2)}
                        </div>
                      )}
                    </div>
                    {!isSimple && (
                      <span className="text-slate-400">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Modern Grid-based Expand Transition to prevent any clipping */}
                <div className={`grid transition-all duration-300 ease-in-out ${isExpanded && !isSimple ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 overflow-hidden'}`}>
                  <div className="overflow-visible min-h-0">
                    <div className="p-5 bg-white space-y-4 border-t border-slate-100">
                      
                      <div className="space-y-2">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                          {language === 'en' ? 'Select Color to Choose Sizes' : 'அளவுகளை தேர்வு செய்ய வண்ணத்தை கிளிக் செய்யவும்'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {colorsList.map(cName => {
                            const isColorActive = selectedColor === cName;
                            const colorQty = g.colors[cName]?.totalQuantity || 0;
                            return (
                              <button
                                key={cName}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedColorForProduct(prev => ({
                                    ...prev,
                                    [g.name]: cName
                                  }));
                                  setSelectedColorModal({
                                    productName: g.name,
                                    colorName: cName,
                                    sizes: g.colors[cName].sizes
                                  });
                                }}
                                className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all border flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 ${
                                  isColorActive
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-100'
                                }`}
                              >
                                <span className={`h-2.5 w-2.5 rounded-full ${
                                  isColorActive ? 'bg-white' : 'bg-slate-450'
                                }`} />
                                <span>{cName}</span>
                                <span className={`text-[10px] font-bold ${
                                  isColorActive ? 'text-blue-100' : 'text-slate-450'
                                }`}>({colorQty})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredCatalog.length === 0 && (
            <div className="col-span-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl py-12 text-center text-slate-400 text-xs font-semibold">
              {language === 'en' ? 'No items found matching criteria.' : 'இருப்பில் தயாரிப்புகள் ஏதுமில்லை.'}
            </div>
          )}
        </div>
      </div>

        {/* COLUMN RIGHT: Checkout POS Cart & Customer (5 cols) */}
        <div className={`xl:col-span-5 space-y-6 ${activeSubTab === 'cart' ? 'block' : 'hidden'} xl:block`}>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col h-full justify-between">
          
          {/* Header Cart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4.5 w-4.5 text-slate-800" />
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">{language === 'en' ? 'Active Checkout Bill' : 'விலைப்பட்டியல்'}</h3>
                {cart.length > 0 && (
                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse">
                    {language === 'en' ? 'Draft Autosaved' : 'வரைவு சேமிக்கப்பட்டது'}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button 
                  onClick={handleClearBill}
                  className="text-[10px] text-red-500 hover:text-red-700 font-extrabold uppercase tracking-wider transition-all"
                >
                  {t.clearBill}
                </button>
              )}
            </div>

            {/* Customer entry inputs */}
            <div className="space-y-2.5 pb-3 border-b border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.customer}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="block w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={language === 'en' ? 'Customer Phone' : 'வாடிக்கையாளர் போன்'}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="block w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tax toggle checkbox */}
              <div className="flex items-center gap-2 px-1 py-1">
                <input
                  type="checkbox"
                  id="toggle-tax-fields"
                  checked={showTaxFields}
                  onChange={(e) => setShowTaxFields(e.target.checked)}
                  className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="toggle-tax-fields" className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                  {language === 'en' ? 'Add GSTIN & Address' : 'வாடிக்கையாளர் GSTIN & முகவரி சேர்க்க'}
                </label>
              </div>

              {/* Conditional GST & Address Inputs */}
              {showTaxFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">
                      {language === 'en' ? 'Customer GSTIN' : 'வாடிக்கையாளர் GSTIN'}
                    </label>
                    <input
                      type="text"
                      placeholder={language === 'en' ? 'e.g. 33AAAAA1111A1Z1' : 'உதாரணம்: 33AAAAA1111A1Z1'}
                      value={customerGst}
                      onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                      className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">
                      {language === 'en' ? 'Customer Address' : 'வாடிக்கையாளர் முகவரி'}
                    </label>
                    <input
                      type="text"
                      placeholder={language === 'en' ? 'Enter billing address' : 'முகவரியை உள்ளிடவும்'}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="block w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items list */}
            <div className="relative">
              <div 
                ref={cartContainerRef}
                onScroll={handleCartScroll}
                className="space-y-3 h-[calc(100vh-420px)] min-h-[300px] max-h-[500px] overflow-y-auto pr-1 scroll-smooth"
              >
                {cart.map((item) => {
                  const prod = products.find(p => p.sku === item.sku);
                  const colorVal = prod?.color;
                  const sizeVal = prod?.size;
                  return (
                    <div key={item.sku} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {colorVal && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-md">
                              {language === 'en' ? 'Color: ' : 'வண்ணம்: '} {colorVal}
                            </span>
                          )}
                          {sizeVal && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                              {language === 'en' ? 'Size: ' : 'அளவு: '} {sizeVal}
                            </span>
                          )}
                          {(colorVal || sizeVal) && <span className="text-slate-300">•</span>}
                          <span className="font-mono text-slate-500">{formatCurrency(item.price)}</span>
                        </div>
                      </div>

                    {/* Quantity adjustments */}
                    <div className="flex items-center gap-2 mr-3">
                      <button 
                        onClick={() => updateCartQty(item.sku, -1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-extrabold text-slate-900 w-5 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQty(item.sku, 1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Total item amount & delete */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-950">{formatCurrency(item.total)}</span>
                      <button 
                        onClick={() => removeFromCart(item.sku)}
                        className="text-slate-400 hover:text-red-500 p-1 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

                {cart.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                    <ShoppingCart className="h-8 w-8 text-slate-200 animate-bounce" />
                    <span className="font-semibold">{language === 'en' ? 'Your billing cart is empty. Scan barcode or click catalog items to add!' : 'விலைப்பட்டியல் காலியாக உள்ளது. பார்கோடு ஸ்கேன் செய்தோ, பட்டியலில் உள்ள தயாரிப்பை கிளிக் செய்தோ சேர்க்கலாம்.'}</span>
                  </div>
                )}
              </div>

              {/* Scroll indicator overlay */}
              {showScrollIndicator && cart.length > 0 && (
                <div 
                  onClick={() => {
                    if (cartContainerRef.current) {
                      cartContainerRef.current.scrollTo({
                        top: cartContainerRef.current.scrollHeight,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-slate-900 hover:bg-black text-white text-[10px] font-black px-3 py-2 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer animate-bounce z-10 transition-all active:scale-[0.96] border border-slate-800"
                >
                  <span>{language === 'en' ? 'More items' : 'கூடுதல் பொருட்கள்'}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Checkout controls */}
          {cart.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              
              {/* Payment Select and discount entry */}
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                <div className="flex flex-col justify-end">
                  <div className="flex items-center h-5 mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.paymentMethod}</label>
                  </div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="block w-full h-[50px] bg-slate-50 border border-slate-200 rounded-lg p-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="NetBanking">Net Banking</option>
                    <option value="Credit">Customer Credit</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex justify-between items-center h-5 mb-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.discount}</label>
                    {totalMaxDiscount > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {language === 'en' ? 'Max:' : 'அதி:'} ₹{totalMaxDiscount}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount === 0 ? '' : discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className="block w-full h-[50px] bg-slate-50 border border-slate-200 rounded-lg p-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* GST 5% inclusion check */}
              <div 
                onClick={() => setIncludeGst(!includeGst)} 
                className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none transition-colors shadow-2xs"
              >
                <input
                  type="checkbox"
                  id="include-gst"
                  checked={includeGst}
                  onChange={(e) => setIncludeGst(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-800">
                    {language === 'en' ? 'Plus 5% GST' : 'கூடுதல் 5% ஜிஎஸ்டி சேர்க்கவும்'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {language === 'en' ? 'Check to add 5% tax to the final bill' : 'பில்லில் 5% வரி சேர்க்க இதை டிக் செய்யவும்'}
                  </span>
                </div>
              </div>

              {/* Invoicing aggregates */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs font-bold text-slate-500 border border-slate-150">
                <div className="flex justify-between">
                  <span className="uppercase tracking-wider text-[10px] text-slate-400">{t.subtotal}</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span className="uppercase tracking-wider text-[10px]">{t.discount}</span>
                    <span>- {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="uppercase tracking-wider text-[10px] text-slate-400">
                    {includeGst ? 'GST (5%)' : 'GST (0%)'}
                  </span>
                  <span className="text-slate-900 font-bold">{formatCurrency(calculatedGst)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-xs font-extrabold text-slate-900">
                  <span className="uppercase tracking-widest text-[10px] text-slate-500">{t.grandTotal}</span>
                  <span className="text-sm text-slate-950 font-black">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <button
                onClick={() => {
                  if (cart.length === 0) {
                    triggerFeedback('error', language === 'en' ? 'Billing cart is empty!' : 'பில் பட்டியல் காலியாக உள்ளது!');
                    return;
                  }
                  setShowReviewInvoice(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-slate-900 hover:bg-black text-white transition-colors cursor-pointer shadow-md active:scale-[0.99]"
              >
                <Eye className="h-4.5 w-4.5" />
                <span>
                  {language === 'en' ? 'View Bill' : 'பில்லைப் பார்'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

    </div>

      {/* --- Review Invoice draft modal Overlay --- */}
      {showReviewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]">
            
            {/* Modal header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-1.5 uppercase tracking-wide">
                <Receipt className="h-5 w-5 text-blue-400" />
                {language === 'en' ? 'Review Bill Details' : 'பில் விவரங்கள் சரிபார்ப்பு'}
              </h4>
              <button 
                onClick={() => setShowReviewInvoice(false)} 
                disabled={isGenerating}
                className="text-slate-400 hover:text-white transition-all disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Draft Body */}
            <div className="p-6 overflow-y-auto space-y-5 font-sans text-slate-800 bg-slate-50 flex-1">
              
              {/* Customer Details Box */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-xs">
                <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  {language === 'en' ? 'Customer & Payment Info' : 'வாடிக்கையாளர் & கட்டண விபரம்'}
                </h5>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block">
                      {language === 'en' ? 'Customer Name:' : 'வாடிக்கையாளர் பெயர்:'}
                    </span>
                    <span className="text-slate-800 font-extrabold text-sm block mt-0.5">
                      {customerName || (language === 'en' ? '' : '')}
                    </span>
                  </div>
                  {customerPhone && (
                    <div>
                      <span className="text-slate-400 font-bold block">
                        {language === 'en' ? 'Contact Phone:' : 'தொடர்பு எண்:'}
                      </span>
                      <span className="text-slate-800 font-bold block mt-0.5">
                        {customerPhone}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 font-bold block">
                      {language === 'en' ? 'Payment Method:' : 'கட்டண முறை:'}
                    </span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">
                      {language === 'en' ? 'Bill Date:' : 'தேதி:'}
                    </span>
                    <span className="text-slate-800 font-bold block mt-0.5">
                      {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'ta-IN')}
                    </span>
                  </div>
                  {showTaxFields && customerGst && (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-400 font-bold block">
                        {language === 'en' ? 'Customer GSTIN:' : 'வாடிக்கையாளர் GSTIN:'}
                      </span>
                      <span className="text-slate-800 font-extrabold font-mono block mt-0.5">
                        {customerGst.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {showTaxFields && customerAddress && (
                    <div className="col-span-2">
                      <span className="text-slate-400 font-bold block">
                        {language === 'en' ? 'Customer Address:' : 'வாடிக்கையாளர் முகவரி:'}
                      </span>
                      <span className="text-slate-800 font-bold block mt-0.5 whitespace-pre-wrap">
                        {customerAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                  <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    {language === 'en' ? 'Purchased Items List' : 'தேர்ந்தெடுக்கப்பட்ட பொருட்கள்'}
                  </h5>
                </div>
                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
                  {cart.map((item) => {
                    const prod = products.find(p => p.sku === item.sku);
                    return (
                      <div key={item.sku} className="p-4 flex justify-between items-start text-xs">
                        <div className="space-y-1 flex-1 pr-4 min-w-0">
                          <p className="font-extrabold text-slate-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold font-mono">SKU: {item.sku}</p>
                          {prod && (
                            <div className="flex flex-wrap gap-1 mt-1 text-[9px] font-bold">
                              {prod.color && (
                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-sm">
                                  {language === 'en' ? 'Color: ' : 'வண்ணம்: '} {prod.color}
                                </span>
                              )}
                              {prod.size && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-sm">
                                  {language === 'en' ? 'Size: ' : 'அளவு: '} {prod.size}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 min-w-[100px]">
                          <p className="font-semibold text-slate-500">
                            {item.quantity} {item.unit || 'pcs'} × {formatCurrency(item.price)}
                          </p>
                          <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                            {formatCurrency(item.total)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial aggregates */}
              <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 space-y-2 text-xs font-bold text-slate-600 shadow-xs">
                <div className="flex justify-between">
                  <span className="uppercase tracking-wider text-[10px] text-slate-500">{t.subtotal}</span>
                  <span className="text-slate-950 font-extrabold">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="uppercase tracking-wider text-[10px] font-bold">{t.discount}</span>
                    <span className="font-extrabold">- {formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="uppercase tracking-wider text-[10px] text-slate-500">
                    {includeGst ? 'GST (5%)' : 'GST (0%)'}
                  </span>
                  <span className="text-slate-950 font-extrabold">{formatCurrency(calculatedGst)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-slate-950">
                  <span className="uppercase tracking-widest text-xs text-slate-600">{t.grandTotal}</span>
                  <span className="text-base text-slate-950 font-black">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

            </div>

            {/* Modal footer with Back and Generate Bill buttons */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReviewInvoice(false)}
                disabled={isGenerating}
                className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center shadow-xs disabled:opacity-50"
              >
                {language === 'en' ? 'Back to Edit' : 'திருத்தச் செல்க'}
              </button>
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}
                <span>
                  {isGenerating 
                    ? (language === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...') 
                    : (language === 'en' ? 'Generate Bill' : 'பில் உருவாக்கு')}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- thermal printable invoice view modal Overlay --- */}
      {showPrintInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal action bar */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-1.5 uppercase tracking-wide">
                <Receipt className="h-5 w-5" />
                {language === 'en' ? 'Invoice Receipt' : 'ரசீது விவரங்கள்'}
              </h4>
              <button onClick={() => setShowPrintInvoice(null)} className="text-slate-400 hover:text-white transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Receipt Body (printable area) */}
            <div id="printable-receipt-area" className="p-6 overflow-y-auto space-y-4 font-sans text-slate-800 bg-white">
              
              {/* Thermal Invoice Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-4">
                <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                  {companyDetails?.name || t.inventoryApp}
                </h3>
                {companyDetails?.gstin && (
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                    GSTIN: {companyDetails.gstin.toUpperCase()}
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
              <div className="space-y-1 text-xs font-semibold text-slate-500 border-b border-dashed border-slate-200 pb-3">
                <div className="flex justify-between">
                  <span>{t.billNo}:</span>
                  <span className="text-slate-900 font-mono">{showPrintInvoice.billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.date}:</span>
                  <span className="text-slate-900">{new Date(showPrintInvoice.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.customer}:</span>
                  <span className="text-slate-900 font-bold">{showPrintInvoice.customerName}</span>
                </div>
                {showPrintInvoice.customerPhone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span className="text-slate-900">{showPrintInvoice.customerPhone}</span>
                  </div>
                )}
                {showPrintInvoice.customerGst && (
                  <div className="flex justify-between">
                    <span>Customer GSTIN:</span>
                    <span className="text-slate-900 font-mono font-bold uppercase">{showPrintInvoice.customerGst.toUpperCase()}</span>
                  </div>
                )}
                {showPrintInvoice.customerAddress && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="flex-shrink-0">Address:</span>
                    <span className="text-slate-900 text-right whitespace-pre-wrap">{showPrintInvoice.customerAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="text-slate-900">{showPrintInvoice.paymentMethod}</span>
                </div>
              </div>

              {/* Table list of Items purchased */}
              <div className="space-y-2 border-b border-dashed border-slate-300 pb-4">
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-6">{t.productName}</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Price</span>
                  <span className="col-span-2 text-right">Total</span>
                </div>
                {showPrintInvoice.items.map((item) => {
                  const prod = products.find(p => p.sku === item.sku);
                  return (
                    <div key={item.sku} className="grid grid-cols-12 text-xs font-semibold text-slate-700 py-1 border-b border-slate-50 last:border-none">
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
              <div className="space-y-1.5 text-xs font-semibold text-slate-500 text-right max-w-xs ml-auto">
                <div className="flex justify-between">
                  <span>{t.subtotal}:</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(showPrintInvoice.subtotal)}</span>
                </div>
                {showPrintInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>{t.discount}:</span>
                    <span>- {formatCurrency(showPrintInvoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{showPrintInvoice.gst > 0 ? 'GST (5%)' : 'GST (0%)'}:</span>
                  <span className="text-slate-900 font-bold">{formatCurrency(showPrintInvoice.gst)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-950">
                  <span>{t.grandTotal}:</span>
                  <span className="text-base text-slate-950 font-extrabold">{formatCurrency(showPrintInvoice.grandTotal)}</span>
                </div>
              </div>

              {/* Welcome Footer thermal receipt */}
              <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-400 font-bold">
                <p>{language === 'en' ? 'Thank You For Your Business!' : 'வணிகத்திற்கு மிக்க நன்றி!'}</p>
                <p className="mt-0.5">{language === 'en' ? 'Visit Again' : 'மீண்டும் வருக'}</p>
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
                    className="w-full pl-10 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all bg-white"
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

              {/* Desktop Iframe Print Help Tip */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-800 font-bold space-y-2">
                <p className="flex items-center gap-1.5 font-extrabold text-amber-900">
                  ⚠️ {language === 'en' ? 'Print Notice for Desktop Users:' : 'கம்ப்யூட்டர் பயனர்களுக்கான குறிப்பு:'}
                </p>
                <p className="leading-relaxed font-medium">
                  {language === 'en' 
                    ? "If clicking 'Print Bill' does not open the print window, it is because this preview is sandboxed. Please click the button below to load the app directly in a new tab, where printing works perfectly!"
                    : "பிரிண்ட் பட்டன் வேலை செய்யவில்லை என்றால், கீழே உள்ள பட்டனை கிளிக் செய்து புதிய விண்டோவில் இந்த ஆப்பைத் திறந்து பிரிண்ட் செய்யவும். அது சரியாக வேலை செய்யும்!"}
                </p>
                <a 
                  href={window.location.href}
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-center text-xs transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink className="h-4 w-4" />
                  {language === 'en' ? 'Open App in New Tab' : 'பிரிண்ட் செய்ய புதிய டேப்பில் திறக்கவும்'}
                </a>
              </div>

              {/* Print and Close buttons */}
              <div className="flex gap-2 border-t border-slate-200/60 pt-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  {t.printBill}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintInvoice(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {language === 'en' ? 'Close' : 'மூடு'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SIZE SELECTION DIALOG (சைஸ் தேர்வு செய்யும் டயலாக் பாக்ஸ்) */}
      {selectedColorModal && (
        <div 
          id="size-selection-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedColorModal(null)}
        >
          <div 
            id="size-selection-container"
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                  {language === 'en' ? 'Select Size' : 'அளவு தேர்வு செய்க'}
                </span>
                <h4 className="font-bold text-sm tracking-tight truncate max-w-[280px]">
                  {selectedColorModal.productName}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-medium text-slate-300">
                    {language === 'en' ? 'Color' : 'வண்ணம்'}: {selectedColorModal.colorName}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedColorModal(null)}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                id="close-size-modal-btn"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sizes List */}
            <div className="p-5 max-h-[400px] overflow-y-auto space-y-3 bg-slate-50/50">
              {selectedColorModal.sizes.map((s) => {
                const latestProduct = products.find(p => p.sku === s.sku) || s.product;
                const isOutOfStock = latestProduct.quantity <= 0;
                const cartItem = cart.find(item => item.sku === s.sku);
                const currentCartQty = cartItem ? cartItem.quantity : 0;

                return (
                  <div 
                    key={s.sku}
                    className={`flex items-center justify-between p-4 rounded-xl border bg-white shadow-2xs transition-all ${
                      isOutOfStock 
                        ? 'opacity-50 border-slate-200' 
                        : 'border-slate-150 hover:border-slate-300'
                    }`}
                  >
                    {/* Size and Info */}
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                          {s.sizeName}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isOutOfStock ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {isOutOfStock 
                            ? (language === 'en' ? 'Out of stock' : 'கையிருப்பு இல்லை') 
                            : `${latestProduct.quantity} ${latestProduct.unit || 'pcs'} ${language === 'en' ? 'left' : 'இருப்பு'}`}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1">
                        {formatCurrency(s.price)}
                      </div>
                    </div>

                    {/* Quantity Selector / Add trigger */}
                    <div>
                      {isOutOfStock ? (
                        <span className="inline-block px-3 py-1.5 bg-slate-100 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider rounded-lg border border-slate-200 select-none">
                          {language === 'en' ? 'Unavailable' : 'இல்லை'}
                        </span>
                      ) : currentCartQty > 0 ? (
                        <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-0.5 shadow-2xs">
                          <button
                            onClick={() => updateCartQty(s.sku, -1)}
                            className="p-1.5 hover:bg-white text-blue-700 hover:text-blue-900 rounded-md transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                            title={language === 'en' ? 'Decrease' : 'குறைக்கவும்'}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-black text-blue-700 min-w-[20px] text-center select-none font-mono">
                            {currentCartQty}
                          </span>
                          <button
                            onClick={() => updateCartQty(s.sku, 1)}
                            className="p-1.5 hover:bg-white text-blue-700 hover:text-blue-900 rounded-md transition-colors cursor-pointer active:scale-95 flex items-center justify-center"
                            title={language === 'en' ? 'Increase' : 'அதிகரிக்கவும்'}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            handleProductSelectBySku(s.sku);
                          }}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all active:scale-[0.96] flex items-center gap-1 cursor-pointer border border-slate-900"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{t.addToBill}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {selectedColorModal.sizes.length} {language === 'en' ? 'options' : 'வகைகள்'}
              </span>
              <button 
                onClick={() => setSelectedColorModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
              >
                {language === 'en' ? 'Close' : 'மூடு'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
