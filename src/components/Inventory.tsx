import React from 'react';
import { Product, Transaction, Language } from '../types';
import { translations } from '../translations';
import { 
  Plus, Edit3, Trash2, Search, ArrowDownCircle, AlertTriangle, 
  X, Filter, CheckCircle2, ChevronDown, Package, FileText, Lock,
  Download, Upload, FileSpreadsheet, AlertCircle, Loader2, Calendar, PlusCircle
} from 'lucide-react';

// Robust CSV parser function
const parseCSV = (text: string): string[][] => {
  const lines = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      if (row.length > 0 && row.some(c => c !== '')) {
        lines.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }
  return lines;
};

// Helper utility to compress images client-side before Firestore upload (due to Firestore's 1MB document limit)
const compressImage = (base64Str: string, maxWidth = 400, maxHeight = 400, quality = 0.65): Promise<{ dataUrl: string, originalSizeKb: number, compressedSizeKb: number }> => {
  return new Promise((resolve) => {
    // Standard Base64 size estimation in KB
    const originalSizeKb = Math.round((base64Str.length * 3) / 4 / 1024);

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: base64Str, originalSizeKb, compressedSizeKb: originalSizeKb });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      const compressedSizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

      resolve({
        dataUrl: compressedDataUrl,
        originalSizeKb,
        compressedSizeKb
      });
    };
    img.onerror = () => {
      resolve({ dataUrl: base64Str, originalSizeKb, compressedSizeKb: originalSizeKb });
    };
  });
};

interface InventoryProps {
  language: Language;
  products: Product[];
  transactions?: Transaction[];
  onAddProduct: (product: Omit<Product, 'id' | 'userId' | 'updatedAt'>) => Promise<void>;
  onEditProduct: (id: string, product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  userRole?: 'admin' | 'user' | null;
  onClearProducts?: () => Promise<void>;
}

export default function Inventory({ 
  language, products, transactions = [], onAddProduct, onEditProduct, onDeleteProduct, onAddTransaction,
  userRole, onClearProducts
}: InventoryProps) {
  const t = translations[language];

  // --- UI STATE CONTROLS ---
  const [showProductModal, setShowProductModal] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [showClearProductsConfirm, setShowClearProductsConfirm] = React.useState(false);
  const [isClearingProducts, setIsClearingProducts] = React.useState(false);

  // Bulk CSV Import / Export state
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [importedRows, setImportedRows] = React.useState<any[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [importSummary, setImportSummary] = React.useState<{ created: number; updated: number; failed: number } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedProductName, setSelectedProductName] = React.useState('All');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [selectedMaterial, setSelectedMaterial] = React.useState('All');
  const [selectedColor, setSelectedColor] = React.useState('All');
  const [selectedSize, setSelectedSize] = React.useState('All');

  // Expansion states for grouped inventory view
  const [expandedGroupKey, setExpandedGroupKey] = React.useState<string | null>(null);
  const [selectedColorForGroup, setSelectedColorForGroup] = React.useState<Record<string, string>>({});

  // Success message feedback
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Export Modal states
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [exportType, setExportType] = React.useState<'stock' | 'sales' | 'inward' | 'all'>('stock');
  const [exportStartDate, setExportStartDate] = React.useState<string>('');
  const [exportEndDate, setExportEndDate] = React.useState<string>('');

  // Form Fields: Product
  const [prodName, setProdName] = React.useState('');
  const [prodSku, setProdSku] = React.useState('');
  const [prodCategory, setProdCategory] = React.useState('');
  const [prodQuantity, setProdQuantity] = React.useState<number | ''>('');
  const [prodMinStock, setProdMinStock] = React.useState<number | ''>('');
  const [prodSellingPrice, setProdSellingPrice] = React.useState<number | ''>('');
  const [prodPurchasePrice, setProdPurchasePrice] = React.useState<number | ''>('');
  const [prodMaxDiscount, setProdMaxDiscount] = React.useState<number | ''>('');
  const [prodUnit, setProdUnit] = React.useState('pcs');
  const [prodLocation, setProdLocation] = React.useState('');
  const [prodDescription, setProdDescription] = React.useState('');
  const [prodMaterial, setProdMaterial] = React.useState('');
  const [prodGsm, setProdGsm] = React.useState('');
  const [prodColor, setProdColor] = React.useState('');
  const [prodSize, setProdSize] = React.useState('');
  const [prodImageUrl, setProdImageUrl] = React.useState('');
  const [compressionInfo, setCompressionInfo] = React.useState<{ originalSize: string; compressedSize: string; ratio: string } | null>(null);
  const [sizeQuantities, setSizeQuantities] = React.useState<{ size: string; quantity: number | '' }[]>([{ size: '', quantity: '' }]);
  const [restockQty, setRestockQty] = React.useState<number | ''>(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);

  // Trigger feedback banner
  const triggerFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Compress and process selected/dropped image file
  const processAndCompressImageFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const originalBase64 = reader.result;
        try {
          const result = await compressImage(originalBase64);
          setProdImageUrl(result.dataUrl);
          
          const ratio = result.originalSizeKb > 0 
            ? Math.round(((result.originalSizeKb - result.compressedSizeKb) / result.originalSizeKb) * 100)
            : 0;
          
          setCompressionInfo({
            originalSize: `${result.originalSizeKb} KB`,
            compressedSize: `${result.compressedSizeKb} KB`,
            ratio: `${ratio}%`
          });
          
          console.log(`Image Compressed: Original ${result.originalSizeKb}KB, Compressed ${result.compressedSizeKb}KB (${ratio}% reduction)`);
        } catch (error) {
          console.error("Image compression failed, using original", error);
          setProdImageUrl(originalBase64);
          const sizeKb = Math.round((originalBase64.length * 3) / 4 / 1024);
          setCompressionInfo({
            originalSize: `${sizeKb} KB`,
            compressedSize: `${sizeKb} KB`,
            ratio: '0%'
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Preset product names extracted dynamically from products
  const productNames = React.useMemo(() => {
    const list = new Set(products.map(p => p.name?.trim()).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Preset categories extracted dynamically from products
  const categories = React.useMemo(() => {
    const list = new Set(products.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Preset materials extracted dynamically from products
  const materials = React.useMemo(() => {
    const list = new Set(products.map(p => p.material?.trim()).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Preset colors extracted dynamically from products
  const colors = React.useMemo(() => {
    const list = new Set(products.map(p => p.color?.trim()).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Preset sizes extracted dynamically from products
  const sizes = React.useMemo(() => {
    const list = new Set(products.map(p => p.size?.trim()).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [products]);

  // Suggestions lists for form input auto-complete (HTML datalist)
  const formSuggestions = React.useMemo(() => {
    const names = new Set<string>();
    const cats = new Set<string>();
    const mats = new Set<string>();
    const gsms = new Set<string>();
    const cols = new Set<string>();

    products.forEach(p => {
      if (p.name?.trim()) names.add(p.name.trim().toUpperCase());
      if (p.category?.trim()) cats.add(p.category.trim().toUpperCase());
      if (p.material?.trim()) mats.add(p.material.trim().toUpperCase());
      if (p.gsm?.trim()) gsms.add(p.gsm.trim().toUpperCase());
      if (p.color?.trim()) cols.add(p.color.trim().toUpperCase());
    });

    return {
      names: Array.from(names).sort(),
      categories: Array.from(cats).sort(),
      materials: Array.from(mats).sort(),
      gsms: Array.from(gsms).sort(),
      colors: Array.from(cols).sort()
    };
  }, [products]);

  // Handle open modal for product creation
  const openCreateModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdSku('');
    setProdCategory('');
    setProdQuantity('');
    setProdMinStock('');
    setProdSellingPrice('');
    setProdPurchasePrice('');
    setProdMaxDiscount('');
    setProdUnit('pcs');
    setProdLocation('');
    setProdDescription('');
    setProdMaterial('');
    setProdGsm('');
    setProdColor('');
    setProdSize('');
    setProdImageUrl('');
    setCompressionInfo(null);
    setSizeQuantities([{ size: '', quantity: '' }]);
    setRestockQty(0);
    setShowProductModal(true);
  };

  // Handle open modal for product editing
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCategory(p.category);
    setProdQuantity(p.quantity);
    setProdMinStock(p.minStock);
    setProdSellingPrice(p.sellingPrice);
    setProdPurchasePrice(p.purchasePrice);
    setProdMaxDiscount(p.maxDiscount || '');
    setProdUnit(p.unit);
    setProdLocation(p.location);
    setProdDescription(p.description);
    setProdMaterial(p.material || '');
    setProdGsm(p.gsm || '');
    setProdColor(p.color || '');
    setProdSize(p.size || '');
    setProdImageUrl(p.imageUrl || '');
    setCompressionInfo(null);
    setSizeQuantities([{ size: p.size || '', quantity: p.quantity }]);
    setRestockQty(0);
    setShowProductModal(true);
  };

  // Submit Product Add or Edit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!prodName.trim()) {
      triggerFeedback('error', language === 'en' ? 'Product Name is required!' : 'தயாரிப்பு பெயர் தேவை!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        // Edit existing product
        const baseQty = userRole === 'admin' ? Number(prodQuantity || 0) : Number(editingProduct.quantity);
        const finalQuantity = baseQty + Number(restockQty || 0);
        await onEditProduct(editingProduct.id!, {
          name: prodName.trim(),
          sku: editingProduct.sku,
          category: prodCategory.trim() || 'General',
          quantity: finalQuantity,
          minStock: Number(prodMinStock),
          sellingPrice: Number(prodSellingPrice),
          purchasePrice: Number(prodPurchasePrice),
          maxDiscount: prodMaxDiscount === '' ? undefined : Number(prodMaxDiscount),
          unit: prodUnit.trim() || 'pcs',
          location: prodLocation.trim(),
          description: prodDescription.trim(),
          material: prodMaterial.trim(),
          gsm: prodGsm.trim(),
          color: prodColor.trim(),
          size: prodSize.trim(),
          imageUrl: prodImageUrl.trim(),
        });

        if (Number(restockQty) > 0) {
          await onAddTransaction({
            type: 'inward',
            sku: editingProduct.sku,
            productName: `${prodName.trim()} (${prodSize.trim() || 'Standard'})`,
            quantity: Number(restockQty),
            price: Number(prodPurchasePrice),
            total: Number(restockQty) * Number(prodPurchasePrice),
            referenceNo: 'RESTOCK',
            counterParty: 'Self (Restock Entry)',
            paymentMethod: 'N/A',
            date: new Date().toISOString()
          });
        }
        triggerFeedback('success', language === 'en' ? 'Product updated successfully!' : 'தயாரிப்பு விவரங்கள் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன!');
      } else {
        // Create new product
        // Filter out empty sizes
        const activePairs = sizeQuantities.filter(sq => sq.size.trim() !== '');
        const pairsToCreate = activePairs.length > 0 ? activePairs : [{ size: prodSize.trim(), quantity: Number(prodQuantity) }];

        for (const pair of pairsToCreate) {
          let generatedSku = '';
          let exists = true;
          let attempts = 0;
          while (exists && attempts < 10) {
            const randomNum = Math.floor(100000 + Math.random() * 900000);
            generatedSku = `SKU-${randomNum}`;
            exists = products.some(p => p.sku.toLowerCase() === generatedSku.toLowerCase());
            attempts++;
          }

          await onAddProduct({
            name: prodName.trim(),
            sku: generatedSku,
            category: prodCategory.trim() || 'General',
            quantity: Number(pair.quantity),
            minStock: Number(prodMinStock),
            sellingPrice: Number(prodSellingPrice),
            purchasePrice: Number(prodPurchasePrice),
            maxDiscount: prodMaxDiscount === '' ? undefined : Number(prodMaxDiscount),
            unit: prodUnit.trim() || 'pcs',
            location: prodLocation.trim(),
            description: prodDescription.trim(),
            material: prodMaterial.trim(),
            gsm: prodGsm.trim(),
            color: prodColor.trim(),
            size: pair.size.trim(),
            imageUrl: prodImageUrl.trim(),
          });

          // Log transaction if initial quantity was entered
          if (pair.quantity > 0) {
            await onAddTransaction({
              type: 'inward',
              sku: generatedSku,
              productName: `${prodName.trim()} (${pair.size.trim()})`,
              quantity: Number(pair.quantity),
              price: Number(prodPurchasePrice),
              total: Number(pair.quantity) * Number(prodPurchasePrice),
              referenceNo: 'INITIAL-STOCK',
              counterParty: 'Self (Opening Balance)',
              paymentMethod: 'N/A',
              date: new Date().toISOString()
            });
          }
        }

        triggerFeedback('success', language === 'en' ? 'Product added successfully!' : 'தயாரிப்பு வெற்றிகரமாகச் சேர்க்கப்பட்டது!');
      }
      setShowProductModal(false);
    } catch (error) {
      triggerFeedback('error', 'Failed to save product details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product handling
  const handleDeleteClick = (id: string, name: string) => {
    if (userRole !== 'admin') {
      triggerFeedback('error', 'Only admins can perform deletions.');
      return;
    }
    setDeleteTarget({ id, name });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await onDeleteProduct(deleteTarget.id);
      triggerFeedback('success', language === 'en' ? 'Product deleted!' : 'தயாரிப்பு வெற்றிகரமாக அழிக்கப்பட்டது!');
    } catch (err) {
      triggerFeedback('error', 'Failed to delete product.');
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleConfirmClearProducts = async () => {
    setIsClearingProducts(true);
    try {
      if (onClearProducts) {
        await onClearProducts();
        triggerFeedback(
          'success',
          language === 'en' ? 'All products cleared successfully!' : 'அனைத்து தயாரிப்புகளும் வெற்றிகரமாக நீக்கப்பட்டன!'
        );
      }
    } catch (err) {
      triggerFeedback(
        'error',
        language === 'en' ? 'Failed to clear products.' : 'தயாரிப்புகளை நீக்க முடியவில்லை.'
      );
    } finally {
      setIsClearingProducts(false);
      setShowClearProductsConfirm(false);
    }
  };

  // --- CSV EXPORT & IMPORT UTILITIES ---

  const handleExportCSV = () => {
    setExportType('stock');
    setExportStartDate('');
    setExportEndDate('');
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

      let list = [...products];

      // Filter by Category if selected
      if (selectedCategory !== 'All') {
        list = list.filter(p => p.category === selectedCategory);
      }

      // Filter by Search Query if entered
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p => 
          p.name.toLowerCase().includes(q) || 
          p.sku.toLowerCase().includes(q) || 
          p.category.toLowerCase().includes(q)
        );
      }

      // Filter by Date Range (updatedAt)
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
      link.setAttribute('download', `inventory_stock_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerFeedback('success', language === 'en' ? 'Inventory stock CSV exported!' : 'இன்வென்டரி இருப்பு விவரங்கள் பதிவிறக்கம் செய்யப்பட்டன!');
    } else {
      // Export Transactions (Sales / Purchase logs)
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
      if (exportType === 'sales') {
        list = list.filter(tx => tx.type === 'sales');
      } else if (exportType === 'inward') {
        list = list.filter(tx => tx.type === 'inward');
      }

      // Filter by Date Range
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
          tx.type === 'sales' ? (language === 'en' ? 'Sales' : 'விற்பனை') : (language === 'en' ? 'Inward' : 'உள்வரவு'),
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
      link.setAttribute('download', `sales_purchase_ledger_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerFeedback('success', language === 'en' ? 'Transactions CSV exported!' : 'பரிவர்த்தனை விவரங்கள் பதிவிறக்கம் செய்யப்பட்டன!');
    }

    setShowExportDialog(false);
  };

  const handleTemplateDownload = () => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Quantity',
      'Unit',
      'Selling Price',
      'Manufacturing Cost',
      'Min Stock',
      'Material',
      'GSM',
      'Color',
      'Size',
      'Location',
      'Description'
    ];
    
    const sampleRow = [
      'SKU-100201',
      'Cotton Round Neck T-Shirt',
      'Clothing',
      '150',
      'pcs',
      '499',
      '180',
      '15',
      'Cotton',
      '180',
      'Navy Blue',
      'M',
      'Rack A-3',
      'Standard fit casual round neck t-shirt'
    ];

    const csvContent = '\uFEFF' + [headers.join(','), sampleRow.map(v => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          triggerFeedback('error', language === 'en' ? 'CSV file is empty!' : 'சிஎஸ்வி கோப்பு காலியாக உள்ளது!');
          setIsParsing(false);
          return;
        }

        const lines = parseCSV(text);
        if (lines.length === 0) {
          triggerFeedback('error', language === 'en' ? 'No data found in CSV!' : 'சிஎஸ்வி கோப்பில் தரவு ஏதும் இல்லை!');
          setIsParsing(false);
          return;
        }

        // Map headers dynamically or fallback to sequential mapping
        const headers = lines[0].map(h => h.trim().toLowerCase());
        
        const getIndex = (aliases: string[]) => {
          return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
        };

        let skuIdx = getIndex(['sku', 'barcode', 'பார்கோடு']);
        let nameIdx = getIndex(['name', 'title', 'பெயர்', 'தயாரிப்பு']);
        let catIdx = getIndex(['category', 'வகை']);
        let qtyIdx = getIndex(['quantity', 'stock', 'qty', 'இருப்பு']);
        let unitIdx = getIndex(['unit', 'அலகு']);
        let sellPriceIdx = getIndex(['selling', 'sell', 'விற்பனை']);
        let purchPriceIdx = getIndex(['purchase', 'cost', 'manufacturing', 'கொள்முதல்', 'உற்பத்தி']);
        let minStockIdx = getIndex(['min', 'reorder', 'குறைந்தபட்ச']);
        let matIdx = getIndex(['material', 'fabric', 'மெட்டீரியல்']);
        let gsmIdx = getIndex(['gsm', 'ஜிஎஸ்எம்']);
        let colIdx = getIndex(['color', 'shade', 'வண்ணம்', 'கலர்']);
        let sizeIdx = getIndex(['size', 'அளவு', 'சைஸ்']);
        let locIdx = getIndex(['location', 'இடம்']);
        let descIdx = getIndex(['description', 'details', 'விளக்கம்']);

        // Check if headers exist, otherwise fallback sequentially
        const hasHeaders = skuIdx !== -1 || nameIdx !== -1 || catIdx !== -1;
        const startRow = hasHeaders ? 1 : 0;

        if (!hasHeaders) {
          // Default sequential mapping:
          skuIdx = 0;
          nameIdx = 1;
          catIdx = 2;
          qtyIdx = 3;
          unitIdx = 4;
          sellPriceIdx = 5;
          purchPriceIdx = 6;
          minStockIdx = 7;
          matIdx = 8;
          gsmIdx = 9;
          colIdx = 10;
          sizeIdx = 11;
          locIdx = 12;
          descIdx = 13;
        }

        const itemsToImport: any[] = [];
        for (let i = startRow; i < lines.length; i++) {
          const row = lines[i];
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;

          const getValue = (idx: number, fallback = '') => {
            return idx !== -1 && idx < row.length ? row[idx].trim() : fallback;
          };

          const name = getValue(nameIdx);
          if (!name) continue; // Skip rows without name

          const rawSku = getValue(skuIdx);
          const quantity = Number(getValue(qtyIdx, '0')) || 0;
          const unit = getValue(unitIdx, 'pcs');
          const sellingPrice = Number(getValue(sellPriceIdx, '0')) || 0;
          const purchasePrice = Number(getValue(purchPriceIdx, '0')) || 0;
          const minStock = Number(getValue(minStockIdx, '0')) || 0;
          const category = getValue(catIdx, 'General');
          const material = getValue(matIdx);
          const gsm = getValue(gsmIdx);
          const color = getValue(colIdx);
          const size = getValue(sizeIdx);
          const location = getValue(locIdx);
          const description = getValue(descIdx);

          itemsToImport.push({
            name,
            sku: rawSku,
            category,
            quantity,
            unit,
            sellingPrice,
            purchasePrice,
            minStock,
            material,
            gsm,
            color,
            size,
            location,
            description
          });
        }

        setImportedRows(itemsToImport);
        setIsParsing(false);
      } catch (err) {
        console.error(err);
        triggerFeedback('error', language === 'en' ? 'Failed to parse CSV file.' : 'சிஎஸ்வி கோப்பை பகுப்பாய்வு செய்வதில் தோல்வி.');
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importedRows.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (const row of importedRows) {
      try {
        const trimmedSku = (row.sku || '').trim().toUpperCase();
        const existingProduct = trimmedSku 
          ? products.find(p => p.sku.trim().toUpperCase() === trimmedSku) 
          : null;

        if (existingProduct) {
          const currentQty = existingProduct.quantity;
          const newQty = row.quantity;
          const diff = newQty - currentQty;

          await onEditProduct(existingProduct.id!, {
            name: row.name,
            category: row.category || existingProduct.category,
            quantity: newQty,
            minStock: row.minStock !== undefined ? row.minStock : existingProduct.minStock,
            sellingPrice: row.sellingPrice !== undefined ? row.sellingPrice : existingProduct.sellingPrice,
            purchasePrice: row.purchasePrice !== undefined ? row.purchasePrice : existingProduct.purchasePrice,
            unit: row.unit || existingProduct.unit || 'pcs',
            location: row.location !== undefined ? row.location : existingProduct.location,
            description: row.description !== undefined ? row.description : existingProduct.description,
            material: row.material !== undefined ? row.material : existingProduct.material,
            gsm: row.gsm !== undefined ? row.gsm : existingProduct.gsm,
            color: row.color !== undefined ? row.color : existingProduct.color,
            size: row.size !== undefined ? row.size : existingProduct.size,
          });

          if (diff !== 0) {
            await onAddTransaction({
              type: diff > 0 ? 'inward' : 'sales',
              sku: existingProduct.sku,
              productName: `${row.name} (${row.size || existingProduct.size || 'Standard'})`,
              quantity: Math.abs(diff),
              price: diff > 0 ? (row.purchasePrice || existingProduct.purchasePrice) : (row.sellingPrice || existingProduct.sellingPrice),
              total: Math.abs(diff) * (diff > 0 ? (row.purchasePrice || existingProduct.purchasePrice) : (row.sellingPrice || existingProduct.sellingPrice)),
              referenceNo: 'BULK-IMPORT-UPDATE',
              counterParty: diff > 0 ? 'Self (Bulk Import Update)' : 'Customer (Bulk Stock Adjust)',
              paymentMethod: 'N/A',
              date: new Date().toISOString()
            });
          }
          updatedCount++;
        } else {
          let finalSku = trimmedSku;
          if (!finalSku) {
            let exists = true;
            let attempts = 0;
            while (exists && attempts < 10) {
              const randomNum = Math.floor(100000 + Math.random() * 900000);
              finalSku = `SKU-${randomNum}`;
              exists = products.some(p => p.sku.toLowerCase() === finalSku.toLowerCase());
              attempts++;
            }
          }

          await onAddProduct({
            name: row.name,
            sku: finalSku,
            category: row.category || 'General',
            quantity: row.quantity,
            minStock: row.minStock || 0,
            sellingPrice: row.sellingPrice || 0,
            purchasePrice: row.purchasePrice || 0,
            unit: row.unit || 'pcs',
            location: row.location || '',
            description: row.description || '',
            material: row.material || '',
            gsm: row.gsm || '',
            color: row.color || '',
            size: row.size || '',
            imageUrl: '',
          });

          if (row.quantity > 0) {
            await onAddTransaction({
              type: 'inward',
              sku: finalSku,
              productName: `${row.name} (${row.size || 'Standard'})`,
              quantity: row.quantity,
              price: row.purchasePrice || 0,
              total: row.quantity * (row.purchasePrice || 0),
              referenceNo: 'BULK-IMPORT-NEW',
              counterParty: 'Self (Bulk Import Initial)',
              paymentMethod: 'N/A',
              date: new Date().toISOString()
            });
          }
          createdCount++;
        }
      } catch (err) {
        console.error('Error importing row:', row, err);
        failedCount++;
      }
    }

    setIsSubmitting(false);
    setImportSummary({ created: createdCount, updated: updatedCount, failed: failedCount });
    setImportedRows([]);
    triggerFeedback(
      failedCount === 0 ? 'success' : 'error',
      language === 'en' 
        ? `Bulk Import finished! Created: ${createdCount}, Updated: ${updatedCount}, Failed: ${failedCount}` 
        : `மொத்தமாகப் பதிவிறக்கம் முடிந்தது! சேர்க்கப்பட்டது: ${createdCount}, புதுப்பிக்கப்பட்டது: ${updatedCount}, தோல்வி: ${failedCount}`
    );
    if (failedCount === 0) {
      setTimeout(() => {
        setShowImportModal(false);
        setImportSummary(null);
      }, 3000);
    }
  };

  // Filtering products computation
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.material && p.material.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.gsm && p.gsm.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.color && p.color.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.size && p.size.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesProductName = selectedProductName === 'All' || p.name === selectedProductName;
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesMaterial = selectedMaterial === 'All' || (p.material && p.material.trim() === selectedMaterial);
    const matchesColor = selectedColor === 'All' || (p.color && p.color.trim() === selectedColor);
    const matchesSize = selectedSize === 'All' || (p.size && p.size.trim() === selectedSize);

    return matchesSearch && matchesProductName && matchesCategory && matchesMaterial && matchesColor && matchesSize;
  });

  // Group products by name + material + gsm
  interface GroupedInventoryItem {
    groupKey: string;
    name: string;
    category: string;
    material: string;
    gsm: string;
    totalQuantity: number;
    minPrice: number;
    maxPrice: number;
    colors: Record<string, {
      colorName: string;
      totalQuantity: number;
      sizes: {
        sizeName: string;
        quantity: number;
        sku: string;
        product: Product;
      }[];
    }>;
  }

  const groupedInventory = React.useMemo(() => {
    const groups: Record<string, GroupedInventoryItem> = {};

    filteredProducts.forEach(p => {
      const name = p.name.trim();
      const material = p.material?.trim() || '';
      const gsm = p.gsm?.trim() || '';
      const category = p.category;
      
      const groupKey = `${name}_${material}_${gsm}`;
      const displayColor = p.color?.trim() || (language === 'en' ? 'Standard' : 'வழக்கமானது');
      const displaySize = p.size?.trim() || (language === 'en' ? 'Standard' : 'வழக்கமானது');

      if (!groups[groupKey]) {
        groups[groupKey] = {
          groupKey,
          name,
          category,
          material,
          gsm,
          totalQuantity: 0,
          minPrice: p.sellingPrice,
          maxPrice: p.sellingPrice,
          colors: {}
        };
      }

      const g = groups[groupKey];
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
  }, [filteredProducts, language]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Dynamic Toast Feedback Banner */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl shadow-xl transition-all border ${
          feedback.type === 'success' 
            ? 'bg-emerald-900 border-emerald-800 text-emerald-50' 
            : 'bg-red-900 border-red-800 text-red-50'
        }`}>
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-bold">{feedback.text}</span>
        </div>
      )}

      {/* Control panel: search & action buttons */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        {/* Top Row: Search and Add Product */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchProduct}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold text-slate-800"
            />
          </div>

          {/* Add Product Trigger */}
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-black text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t.addStock}
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 pt-2"></div>

        {/* Bottom Row: Filters, Export & Import */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <div className="relative w-full sm:w-40">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-8 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full truncate"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? (language === 'en' ? 'Category: All' : 'வகை: அனைத்தும்') : cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Product Name Dropdown */}
          <div className="relative w-full sm:w-40">
            <select
              value={selectedProductName}
              onChange={(e) => setSelectedProductName(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-8 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full truncate"
            >
              {productNames.map(name => (
                <option key={name} value={name}>
                  {name === 'All' ? (language === 'en' ? 'Product Name' : 'தயாரிப்பு பெயர்') : name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Material Dropdown */}
          <div className="relative w-full sm:w-40">
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-8 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full truncate"
            >
              {materials.map(mat => (
                <option key={mat} value={mat}>
                  {mat === 'All' ? (language === 'en' ? 'Material: All' : 'மெட்டீரியல்: அனைத்தும்') : mat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Color Dropdown */}
          <div className="relative w-full sm:w-36">
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-8 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full truncate"
            >
              {colors.map(col => (
                <option key={col} value={col}>
                  {col === 'All' ? (language === 'en' ? 'Color: All' : 'கலர்: அனைத்தும்') : col}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Size Dropdown */}
          <div className="relative w-full sm:w-36">
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-8 text-xs font-bold text-slate-700 focus:outline-none hover:bg-slate-100 transition-all cursor-pointer w-full truncate"
            >
              {sizes.map(sz => (
                <option key={sz} value={sz}>
                  {sz === 'All' ? (language === 'en' ? 'Size: All' : 'சைஸ்: அனைத்தும்') : sz}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>

          {/* Spacer */}
          <div className="flex-grow hidden xl:block"></div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-slate-200 hover:border-slate-300 w-full sm:w-auto"
            title={language === 'en' ? 'Export Stock as CSV' : 'சிஎஸ்வியாக ஏற்றுமதி செய்'}
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>{language === 'en' ? 'Export CSV' : 'சிஎஸ்வி ஏற்றுமதி'}</span>
          </button>

          {/* Bulk Import Button */}
          <button
            type="button"
            onClick={() => {
              setImportedRows([]);
              setImportSummary(null);
              setShowImportModal(true);
            }}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-slate-200 hover:border-slate-300 w-full sm:w-auto"
            title={language === 'en' ? 'Bulk Import Stock via CSV' : 'மொத்தமாக இறக்குமதி செய்'}
          >
            <Upload className="h-4 w-4 text-slate-500" />
            <span>{language === 'en' ? 'Bulk Import' : 'சிஎஸ்வி இறக்குமதி'}</span>
          </button>

          {/* Clear Products Button (Admin only) */}
          {userRole === 'admin' && (
            <button
              type="button"
              onClick={() => setShowClearProductsConfirm(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100/70 text-rose-700 hover:text-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-rose-200 hover:border-rose-300 w-full sm:w-auto shadow-xs"
              title={language === 'en' ? 'Clear all products from the database' : 'தரவுத்தளத்தில் இருந்து அனைத்து தயாரிப்புகளையும் அழி'}
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>{language === 'en' ? 'Clear Products' : 'தயாரிப்புகளை அழி'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inventory Products Display */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
          <Package className="h-10 w-10 text-slate-300" />
          <span className="font-semibold">{language === 'en' ? 'No matching products found.' : 'தேடலுக்குரிய தயாரிப்புகள் ஏதும் இல்லை.'}</span>
        </div>
      ) : (
        <>
        <div className="flex flex-col gap-4">
          {groupedInventory.map((g) => {
            const colorsList = Object.keys(g.colors);
            const isExpanded = expandedGroupKey === g.groupKey;
            
            // Get selected color for this group (default to first color)
            const selectedColor = selectedColorForGroup[g.groupKey] || colorsList[0] || '';
            const activeColorGroup = g.colors[selectedColor];
            const sizeList = activeColorGroup ? activeColorGroup.sizes : [];

            // Find image for currently selected color first, fallback to any product in group
            const activeProductWithImage = sizeList.find(s => s.product.imageUrl) || 
                                           (Object.values(g.colors) as any[]).flatMap(col => col.sizes).find(s => s.product.imageUrl);
            const groupImageUrl = activeProductWithImage?.product.imageUrl;

            // Check if any item in this group is low stock
            const isAnyLowStock = (Object.values(g.colors) as any[]).flatMap(col => col.sizes).some(s => s.product.quantity <= s.product.minStock);

            return (
              <div 
                key={g.groupKey}
                className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                  isExpanded 
                    ? 'border-slate-400 ring-2 ring-slate-100 bg-slate-50/10' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Master Group Row/Card Header */}
                <div 
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedGroupKey(null);
                    } else {
                      setExpandedGroupKey(g.groupKey);
                      if (!selectedColorForGroup[g.groupKey] && colorsList.length > 0) {
                        setSelectedColorForGroup(prev => ({ ...prev, [g.groupKey]: colorsList[0] }));
                      }
                    }
                  }}
                  className={`p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
                    isExpanded ? 'bg-slate-50/50 border-b border-slate-150' : 'hover:bg-slate-50/10'
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {groupImageUrl ? (
                      <img 
                        src={groupImageUrl} 
                        alt={g.name} 
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                        <Package className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{g.category}</span>
                        {isAnyLowStock && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {language === 'en' ? 'Low Stock' : 'குறைந்த இருப்பு'}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">{g.name}</h4>
                      
                      {/* Material & GSM Badges */}
                      {(g.material || g.gsm) && (
                        <div className="flex gap-1.5 items-center flex-wrap mt-1 text-[10px] text-slate-500 font-semibold">
                          {g.material && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold truncate">
                              {g.material}
                            </span>
                          )}
                          {g.gsm && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                              {g.gsm}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">{language === 'en' ? 'Total Quantity' : 'மொத்த இருப்பு'}</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">
                        {g.totalQuantity} <span className="text-xs font-bold text-slate-400">pcs</span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right hidden md:block">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">{t.sellingPrice}</p>
                      <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                        {g.minPrice === g.maxPrice 
                          ? `₹${g.minPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                          : `₹${g.minPrice.toLocaleString('en-IN')} - ₹${g.maxPrice.toLocaleString('en-IN')}`
                        }
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="text-xs font-bold text-slate-400">
                        {colorsList.length} {language === 'en' ? 'Colors' : 'வண்ணங்கள்'}
                      </span>
                      <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180 text-slate-800' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Color selection & Size inventory list */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/50 border-t border-slate-100 space-y-4">
                    {/* Colors Horizontal selector */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {language === 'en' ? 'Select Color / Shade' : 'வண்ணத்தைத் தேர்ந்தெடுக்கவும்'}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {colorsList.map((colName) => {
                          const isColSelected = selectedColor === colName;
                          const colQty = g.colors[colName].totalQuantity;
                          return (
                            <button
                              key={colName}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedColorForGroup(prev => ({ ...prev, [g.groupKey]: colName }));
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isColSelected 
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-350 hover:bg-slate-50'
                              }`}
                            >
                              <span>{colName}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                                isColSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {colQty}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sizes inside the selected color */}
                    {activeColorGroup && (
                      <div className="space-y-2 border border-slate-150 rounded-xl bg-white overflow-hidden shadow-xs">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
                          <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            {language === 'en' 
                              ? `Inventory for color: ${selectedColor}` 
                              : `${selectedColor} வண்ணத்திற்கான இருப்புகள்`}
                          </h5>
                          <span className="text-[10px] font-black text-slate-500">
                            {sizeList.length} {language === 'en' ? 'Sizes registered' : 'அளவுகள் பதிவு செய்யப்பட்டுள்ளது'}
                          </span>
                        </div>

                        {/* List/Table of Sizes */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-150 text-xs text-slate-700">
                            <thead>
                              <tr className="bg-slate-50/50">
                                <th className="px-4 py-2.5 text-left font-bold text-slate-500">{language === 'en' ? 'Size' : 'அளவு'}</th>
                                <th className="px-4 py-2.5 text-center font-bold text-slate-500">{language === 'en' ? 'Stock Quantity' : 'இருப்பு அளவு'}</th>
                                <th className="px-4 py-2.5 text-right font-bold text-slate-500">{t.sellingPrice}</th>
                                <th className="px-4 py-2.5 text-right font-bold text-slate-500">{t.manufacturingCost}</th>
                                <th className="px-4 py-2.5 text-right font-bold text-slate-500">{t.maxDiscount}</th>
                                <th className="px-4 py-2.5 text-right font-bold text-slate-500">{t.actions}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sizeList.map((szItem) => {
                                const isLow = szItem.product.quantity <= szItem.product.minStock;
                                return (
                                  <tr key={szItem.sku} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="px-4 py-3 font-extrabold text-slate-900 text-sm">
                                      <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                                        {szItem.sizeName}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="inline-flex items-center gap-1.5">
                                        <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                                          isLow 
                                            ? 'text-amber-700 bg-amber-50 border border-amber-100 font-black' 
                                            : 'text-slate-800 bg-slate-50 border border-slate-100'
                                        }`}>
                                          {szItem.quantity} {szItem.product.unit || 'pcs'}
                                        </span>
                                        {isLow && (
                                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" title={language === 'en' ? 'Low Stock!' : 'குறைந்த இருப்பு!'} />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                      ₹{szItem.product.sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500 font-semibold">
                                      ₹{szItem.product.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500 font-semibold">
                                      {szItem.product.maxDiscount !== undefined ? `₹${szItem.product.maxDiscount}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditModal(szItem.product);
                                        }}
                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title={t.edit}
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </button>
                                      {userRole === 'admin' && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(szItem.product.id || '', szItem.product.name);
                                          }}
                                          className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                          title={language === 'en' ? 'Delete SKU' : 'SKU அழி'}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile view stacked items list */}
                        <div className="block sm:hidden divide-y divide-slate-100">
                          {sizeList.map((szItem) => {
                            const isLow = szItem.product.quantity <= szItem.product.minStock;
                            return (
                              <div key={szItem.sku} className="p-4 flex flex-col gap-3 hover:bg-slate-50/40 transition-colors">
                                {/* Top Line: Size Badge & Actions */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="bg-slate-100 px-2.5 py-1 rounded-md font-extrabold text-slate-950 text-xs">
                                      {language === 'en' ? 'Size' : 'அளவு'}: {szItem.sizeName}
                                    </span>
                                    {isLow && (
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                        <AlertTriangle className="h-3 w-3" />
                                        {language === 'en' ? 'Low' : 'குறைவு'}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(szItem.product);
                                      }}
                                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                      title={t.edit}
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                    {userRole === 'admin' && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteClick(szItem.product.id || '', szItem.product.name);
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title={language === 'en' ? 'Delete SKU' : 'SKU அழி'}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom/Middle Info Grid: Stock & Prices */}
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div className="space-y-0.5">
                                    <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">{language === 'en' ? 'Stock' : 'இருப்பு'}</p>
                                    <p className={`font-black text-xs ${isLow ? 'text-amber-700' : 'text-slate-800'}`}>
                                      {szItem.quantity} {szItem.product.unit || 'pcs'}
                                    </p>
                                  </div>
                                  
                                  <div className="space-y-0.5 text-right">
                                    <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">{language === 'en' ? 'Selling' : 'விற்பனை'}</p>
                                    <p className="font-black text-xs text-slate-900">
                                      ₹{szItem.product.sellingPrice.toLocaleString('en-IN')}
                                    </p>
                                  </div>

                                  <div className="space-y-0.5 text-right">
                                    <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">{language === 'en' ? 'Cost' : 'அடக்கம்'}</p>
                                    <p className="font-bold text-xs text-slate-500">
                                      ₹{szItem.product.purchasePrice.toLocaleString('en-IN')}
                                    </p>
                                  </div>

                                  <div className="space-y-0.5 text-right">
                                    <p className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">{language === 'en' ? 'Max Disc.' : 'அதி. தள்ளுபடி'}</p>
                                    <p className="font-bold text-xs text-emerald-600">
                                      {szItem.product.maxDiscount !== undefined ? `₹${szItem.product.maxDiscount}` : '-'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* --- MODAL 1: ADD / EDIT PRODUCT --- */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Package className="h-5 w-5" />
                {editingProduct ? (language === 'en' ? 'Edit Product Details' : 'தயாரிப்பு திருத்தவும்') : (language === 'en' ? 'Register New Product' : 'புதிய தயாரிப்பு பதிவு')}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-400 hover:text-white transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.productName} *</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase"
                    placeholder={language === 'en' ? "e.g. T-SHIRT" : "எ.கா. டீ-சர்ட்"}
                    list="form-names-list"
                  />
                  <datalist id="form-names-list">
                    {formSuggestions.names.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.category} *</label>
                  <input
                    type="text"
                    required
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase"
                    placeholder="e.g. SHIRTS, PANTS, COTTON ROLL"
                    list="form-categories-list"
                  />
                  <datalist id="form-categories-list">
                    {formSuggestions.categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.material}</label>
                  <input
                    type="text"
                    value={prodMaterial}
                    onChange={(e) => setProdMaterial(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase"
                    placeholder="e.g. COTTON, POLYESTER, SILK"
                    list="form-materials-list"
                  />
                  <datalist id="form-materials-list">
                    {formSuggestions.materials.map(mat => (
                      <option key={mat} value={mat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.gsm}</label>
                  <input
                    type="text"
                    value={prodGsm}
                    onChange={(e) => setProdGsm(e.target.value.toUpperCase())}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase"
                    placeholder="e.g. 180 GSM, 220 GSM"
                    list="form-gsms-list"
                  />
                  <datalist id="form-gsms-list">
                    {formSuggestions.gsms.map(gsm => (
                      <option key={gsm} value={gsm} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.color}</label>
                  <input
                    type="text"
                    value={prodColor}
                    onChange={(e) => setProdColor(e.target.value.toUpperCase())}
                    disabled={!!editingProduct && userRole !== 'admin'}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    placeholder="e.g. RED, BLUE, BLACK"
                    list="form-colors-list"
                  />
                  <datalist id="form-colors-list">
                    {formSuggestions.colors.map(col => (
                      <option key={col} value={col} />
                    ))}
                  </datalist>
                </div>

                {!editingProduct ? (
                  <div className="col-span-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {language === 'en' ? 'Sizes & Initial Stock' : 'அளவுகள் & ஆரம்ப இருப்பு'}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setSizeQuantities([...sizeQuantities, { size: '', quantity: '' }])}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        {language === 'en' ? 'Add Size' : 'அளவு சேர்க்க'}
                      </button>
                    </div>

                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                      {sizeQuantities.map((item, index) => (
                        <div key={index} className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {language === 'en' ? `Size #${index + 1}` : `அளவு #${index + 1}`}
                            </label>
                            <input
                              type="text"
                              required
                              value={item.size}
                              onChange={(e) => {
                                const updated = [...sizeQuantities];
                                updated[index].size = e.target.value.toUpperCase();
                                setSizeQuantities(updated);
                              }}
                              className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white uppercase"
                              placeholder="e.g. M, L, XL"
                            />
                          </div>

                          <div className="w-28">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {language === 'en' ? 'Quantity' : 'அளவு (Qty)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...sizeQuantities];
                                updated[index].quantity = e.target.value === '' ? '' : Number(e.target.value);
                                setSizeQuantities(updated);
                              }}
                              className="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
                            />
                          </div>

                          {sizeQuantities.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = sizeQuantities.filter((_, i) => i !== index);
                                setSizeQuantities(updated);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 bg-white"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.size}</label>
                      <input
                        type="text"
                        value={prodSize}
                        onChange={(e) => setProdSize(e.target.value.toUpperCase())}
                        disabled={userRole !== 'admin'}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm uppercase disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                        placeholder="e.g. M, L, XL, XXL, 32"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.quantity}</label>
                      <input
                        type="number"
                        min="0"
                        value={prodQuantity}
                        onChange={(e) => setProdQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={userRole !== 'admin'}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Restock Section (Only in Edit mode) */}
                    <div className="col-span-2 border border-slate-200 rounded-xl p-4 bg-blue-50/25 border-blue-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                          <PlusCircle className="h-4 w-4 text-blue-600" />
                          {language === 'en' ? 'Add / Restock Stock Items' : 'இருப்பு சேர் / ரீஸ்டாக்'}
                        </h4>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                          {language === 'en' ? 'Transaction Logged' : 'பரிவர்த்தனைப் பதிவு'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {language === 'en' ? 'Restock Quantity' : 'ரீஸ்டாக் அளவு'}
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Math.max(0, Number(prev || 0) - 1))}
                              className="w-9 h-9 bg-white border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center select-none cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={restockQty}
                              onChange={(e) => setRestockQty(e.target.value === '' ? '' : Number(e.target.value))}
                              className="flex-1 w-20 h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white text-center font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Number(prev || 0) + 1)}
                              className="w-9 h-9 bg-white border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center select-none cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Quick increment buttons */}
                        <div className="flex flex-col gap-1 w-24">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {language === 'en' ? 'Quick Add' : 'விரைவு சேர்'}
                          </span>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Number(prev || 0) + 5)}
                              className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-md border border-slate-200 cursor-pointer"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Number(prev || 0) + 10)}
                              className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-md border border-slate-200 cursor-pointer"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Number(prev || 0) + 50)}
                              className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-md border border-slate-200 cursor-pointer"
                            >
                              +50
                            </button>
                            <button
                              type="button"
                              onClick={() => setRestockQty(prev => Number(prev || 0) + 100)}
                              className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-md border border-slate-200 cursor-pointer"
                            >
                              +100
                            </button>
                          </div>
                        </div>
                      </div>

                      {Number(restockQty) > 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                          {language === 'en' 
                            ? `✓ Total stock will increase from ${editingProduct.quantity} to ${Number(editingProduct.quantity) + Number(restockQty)}. An inward log entry of +${restockQty} will be recorded.` 
                            : `✓ மொத்த இருப்பு ${editingProduct.quantity} லிருந்து ${Number(editingProduct.quantity) + Number(restockQty)} ஆக அதிகரிக்கும். +${restockQty} அளவுக்கான உள்வரவு பரிவர்த்தனைப் பதிவு செய்யப்படும்.`}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.minStock}</label>
                  <input
                    type="number"
                    min="0"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.sellingPrice} *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodSellingPrice}
                    onChange={(e) => setProdSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.manufacturingCost} *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodPurchasePrice}
                    onChange={(e) => setProdPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.maxDiscount}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodMaxDiscount}
                    onChange={(e) => setProdMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm"
                    placeholder="₹"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t.unit}</label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-xs text-sm"
                  >
                    <option value="pcs">{language === 'en' ? 'Pcs (Pieces)' : 'பீஸ் (Pcs)'}</option>
                    <option value="set">{language === 'en' ? 'Set' : 'செட் (Set)'}</option>
                  </select>
                </div>

                {/* Product Image Section */}
                <div className="col-span-2 space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {language === 'en' ? 'Product Image' : 'தயாரிப்பு படம்'}
                  </label>
                  
                  {prodImageUrl ? (
                    <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-start gap-4">
                      <img 
                        src={prodImageUrl} 
                        alt="Product Preview" 
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 bg-white"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {language === 'en' ? 'Image Selected & Verified' : 'படம் தேர்ந்தெடுக்கப்பட்டு சரிபார்க்கப்பட்டது'}
                          </p>
                        </div>
                        
                        {compressionInfo ? (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 mt-1.5 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              {language === 'en' ? 'Compressed for cloud database (Max size OK)' : 'கிளவுட் சேமிப்பிற்கு உகந்ததாக சுருக்கப்பட்டது'}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-[9px] font-medium text-slate-500">
                              <div>
                                <span className="block text-slate-400">{language === 'en' ? 'Original:' : 'அசல் அளவு:'}</span>
                                <span className="font-bold text-slate-600">{compressionInfo.originalSize}</span>
                              </div>
                              <div>
                                <span className="block text-slate-400">{language === 'en' ? 'Compressed:' : 'சுருக்கப்பட்ட அளவு:'}</span>
                                <span className="font-bold text-emerald-600">{compressionInfo.compressedSize}</span>
                              </div>
                              <div>
                                <span className="block text-slate-400">{language === 'en' ? 'Reduced:' : 'குறைக்கப்பட்டது:'}</span>
                                <span className="font-bold text-emerald-600">↓ {compressionInfo.ratio}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          prodImageUrl.startsWith('data:') && (
                            <div className="text-[10px] text-slate-400">
                              {language === 'en' ? 'Image uploaded' : 'படம் பதிவேற்றப்பட்டது'}
                            </div>
                          )
                        )}
                        
                        <button
                          type="button"
                          onClick={() => {
                            setProdImageUrl('');
                            setCompressionInfo(null);
                          }}
                          className="text-red-600 hover:text-red-700 text-xs font-bold mt-1 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          {language === 'en' ? 'Remove Image' : 'படத்தை நீக்கு'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* File Upload zone (Drag-and-drop or click) */}
                      <div 
                        onClick={() => {
                          const fileInput = document.getElementById('prod-image-file') as HTMLInputElement;
                          fileInput?.click();
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            processAndCompressImageFile(file);
                          }
                        }}
                        className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-1 bg-white min-h-[90px]"
                      >
                        <Plus className="h-5 w-5 text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-600">
                          {language === 'en' ? 'Upload Image' : 'படம் பதிவேற்று'}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {language === 'en' ? 'Drag & Drop or Click (Auto-compressed)' : 'இழுத்து விடவும் அல்லது கிளிக் செய்யவும்'}
                        </span>
                        <input 
                          id="prod-image-file"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              processAndCompressImageFile(file);
                            }
                          }}
                        />
                      </div>

                      {/* URL Input fallback */}
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {language === 'en' ? 'Or Paste Image URL' : 'அல்லது பட முகவரியை ஒட்டவும்'}
                        </span>
                        <input 
                          type="url"
                          value={prodImageUrl}
                          onChange={(e) => {
                            setProdImageUrl(e.target.value);
                            setCompressionInfo(null); // No local file info for pasted URL
                          }}
                          placeholder="https://example.com/image.jpg"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-black shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                      {language === 'en' ? 'Saving...' : 'சேமிக்கிறது...'}
                    </>
                  ) : (
                    t.save
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* --- MODAL 2: BULK CSV IMPORT --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                {language === 'en' ? 'Bulk Import Stock (CSV)' : 'மொத்தமாக இருப்பு இறக்குமதி செய் (CSV)'}
              </h3>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportedRows([]);
                  setImportSummary(null);
                }} 
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {importSummary ? (
                // Success / Summary Screen
                <div className="text-center py-8 space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-slate-900">
                      {language === 'en' ? 'Import Process Completed!' : 'இறக்குமதி செயல்முறை முடிந்தது!'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {language === 'en' 
                        ? 'All rows processed. See summary below:' 
                        : 'அனைத்து வரிசைகளும் செயலாக்கப்பட்டன. சுருக்கம் கீழே:'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="block text-[10px] font-black text-slate-400 uppercase">{language === 'en' ? 'Created' : 'சேர்க்கப்பட்டது'}</span>
                      <span className="text-xl font-black text-emerald-600">{importSummary.created}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="block text-[10px] font-black text-slate-400 uppercase">{language === 'en' ? 'Updated' : 'புதுப்பிக்கப்பட்டது'}</span>
                      <span className="text-xl font-black text-blue-600">{importSummary.updated}</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="block text-[10px] font-black text-slate-400 uppercase">{language === 'en' ? 'Failed' : 'தோல்வி'}</span>
                      <span className="text-xl font-black text-red-500">{importSummary.failed}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportSummary(null);
                    }}
                    className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-md cursor-pointer transition-all"
                  >
                    {language === 'en' ? 'Close Window' : 'சாளரத்தை மூடு'}
                  </button>
                </div>
              ) : isParsing ? (
                // Loading / Parsing Screen
                <div className="text-center py-16 space-y-3">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    {language === 'en' ? 'Parsing CSV File...' : 'சிஎஸ்வி கோப்பை பகுப்பாய்வு செய்கிறது...'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {language === 'en' ? 'Scanning headers, validating columns...' : 'தலைப்புகள் ஸ்கேன் செய்யப்படுகிறது...'}
                  </p>
                </div>
              ) : importedRows.length > 0 ? (
                // Preview Screen
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        {language === 'en' ? `Parsed ${importedRows.length} Products` : `${importedRows.length} தயாரிப்புகள் பகுப்பாய்வு செய்யப்பட்டன`}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {language === 'en' 
                          ? 'Review items below. Existing SKUs will be updated; new SKUs will be created.' 
                          : 'கீழே உள்ள உருப்படிகளைச் சரிபார்க்கவும். இருக்கும் பார்கோடுகள் புதுப்பிக்கப்படும்.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setImportedRows([])}
                      className="text-red-600 hover:text-red-700 text-xs font-bold cursor-pointer"
                    >
                      {language === 'en' ? 'Clear & Re-upload' : 'நீக்கிவிட்டு மீண்டும் பதிவேற்று'}
                    </button>
                  </div>

                  {/* Scrollable table preview of first 10 items */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-150 text-left text-xs">
                      <thead className="bg-slate-50 font-bold text-slate-500">
                        <tr>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Category</th>
                          <th className="px-4 py-2 text-center">Qty</th>
                          <th className="px-4 py-2 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importedRows.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-bold text-slate-800 truncate max-w-[150px]">{row.name}</td>
                            <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{row.sku || '(Auto-gen)'}</td>
                            <td className="px-4 py-2 text-slate-600">{row.category}</td>
                            <td className="px-4 py-2 text-center font-bold text-slate-700">{row.quantity} {row.unit}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-900">₹{row.sellingPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importedRows.length > 20 && (
                    <p className="text-center text-[10px] text-slate-400 font-bold">
                      {language === 'en' 
                        ? `... and ${importedRows.length - 20} more items` 
                        : `... மற்றும் ${importedRows.length - 20} கூடுதல் உருப்படிகள்`}
                    </p>
                  )}

                  <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setImportedRows([])}
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {language === 'en' ? 'Back' : 'பின்செல்'}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleConfirmImport}
                      className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-black shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {language === 'en' ? 'Importing...' : 'இறக்குமதி செய்கிறது...'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {language === 'en' ? `Confirm & Import ${importedRows.length} Items` : `உறுதிசெய்து ${importedRows.length} உருப்படிகளை இறக்குமதி செய்`}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // File Upload Zone & Setup Screen
                <div className="space-y-4">
                  {/* Instructions card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2 text-slate-700 text-xs leading-relaxed">
                      <AlertCircle className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-slate-800">
                          {language === 'en' ? 'CSV File Requirements:' : 'சிஎஸ்வி கோப்பு தேவைகள்:'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {language === 'en' 
                            ? 'Your CSV file should have a header row. We automatically map columns based on aliases. Download the standard template to get started easily.' 
                            : 'உங்கள் சிஎஸ்வி கோப்பில் தலைப்பு வரிசை இருக்க வேண்டும். எளிதாகத் தொடங்க மாதிரி வடிவத்தைப் பதிவிறக்கவும்.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTemplateDownload}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-500" />
                      {language === 'en' ? 'Download CSV Template' : 'மாதிரி வடிவத்தை பதிவிறக்கு'}
                    </button>
                  </div>

                  {/* Drop Zone Box */}
                  <div
                    onClick={() => {
                      document.getElementById('csv-file-selector')?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.name.endsWith('.csv')) {
                        const inputEl = document.getElementById('csv-file-selector') as HTMLInputElement;
                        if (inputEl) {
                          const container = new DataTransfer();
                          container.items.add(file);
                          inputEl.files = container.files;
                          // trigger change
                          const event = new Event('change', { bubbles: true });
                          inputEl.dispatchEvent(event);
                        }
                      } else {
                        triggerFeedback('error', language === 'en' ? 'Please drop a valid .csv file' : 'முறையான .csv கோப்பை இழுத்து விடவும்');
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50/50 bg-white transition-all flex flex-col items-center justify-center gap-2 min-h-[160px]"
                  >
                    <FileSpreadsheet className="h-10 w-10 text-slate-400" />
                    <span className="text-sm font-extrabold text-slate-700">
                      {language === 'en' ? 'Select or drop your CSV file' : 'உங்கள் சிஎஸ்வி கோப்பை தேர்ந்தெடுக்கவும் அல்லது இழுத்து விடவும்'}
                    </span>
                    <span className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      {language === 'en' ? 'Supports files with columns for SKU, Name, Category, Stock Qty, Unit, Price, Cost, Material, Size, Location.' : 'SKU, பெயர், வகை, இருப்பு, விலை, மெட்டீரியல், அளவு நெடுவரிசைகள் கொண்ட கோப்புகளை ஆதரிக்கிறது.'}
                    </span>
                    
                    <input
                      id="csv-file-selector"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleCSVUpload}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportedRows([]);
                  setImportSummary(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                {language === 'en' ? 'Close' : 'மூடு'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div className="grid grid-cols-2 gap-2">
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
                    onClick={() => setExportType('all')}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      exportType === 'all'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-extrabold shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {language === 'en' ? 'All Transactions' : 'அனைத்து பரிவர்த்தனை'}
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
                    ? `Are you absolutely sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
                    : `"${deleteTarget.name}" தயாரிப்பை அழிக்க நீங்கள் உறுதியாக இருக்கிறீர்களா? இந்தச் செயலைத் திரும்பப் பெற முடியாது.`}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-center gap-3 text-xs">
              <button
                type="button"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

      {/* --- CUSTOM CLEAR ALL PRODUCTS CONFIRMATION DIALOG --- */}
      {showClearProductsConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  {language === 'en' ? 'Clear All Products?' : 'அனைத்து தயாரிப்புகளையும் அழிக்கலாமா?'}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {language === 'en' 
                    ? 'Are you absolutely sure you want to clear ALL products from the inventory? This action is permanent and cannot be undone.'
                    : 'தரவுத்தளத்தில் இருந்து அனைத்து தயாரிப்புகளையும் முழுமையாக அழிக்க விரும்புகிறீர்களா? இந்த செயல் நிரந்தரமானது மற்றும் மீட்டெடுக்க முடியாது.'}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-center gap-3 text-xs">
              <button
                type="button"
                disabled={isClearingProducts}
                onClick={() => setShowClearProductsConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                {language === 'en' ? 'No, Cancel' : 'இல்லை, ரத்து செய்'}
              </button>
              <button
                type="button"
                disabled={isClearingProducts}
                onClick={handleConfirmClearProducts}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isClearingProducts ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

    </div>
  );
}
