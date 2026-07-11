import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch, getDoc, setDoc, orderBy, limit, getAggregateFromServer, sum 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { Product, Transaction, Bill, Language, UserProfile } from './types';
import { translations } from './translations';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Billing from './components/Billing';
import RecentSales from './components/RecentSales';
import SystemLedger from './components/SystemLedger';
import CompanySettings from './components/CompanySettings';
import { 
  LayoutDashboard, Package, Receipt, LogOut, Globe, User, 
  Sparkles, CheckCircle, Database, Smartphone, Menu, X, FolderOpen, Trash2, ShoppingBag, ArrowDownUp, Building2,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';

// --- SEED SELLER DATA ---
const SEED_PRODUCTS = [
  {
    name: "Cotton Slim Fit Men's Shirt (ஆண்கள் பருத்தி சட்டை)",
    sku: "8901234567891",
    category: "Menswear",
    quantity: 12,
    minStock: 5,
    sellingPrice: 550,
    purchasePrice: 480,
    unit: "pcs",
    location: "Rack A1",
    description: "Premium Long-Sleeve Pure Cotton Slim Fit Casual Shirt"
  },
  {
    name: "Kanchipuram Silk Saree (காஞ்சிபுரம் பட்டுப் புடவை)",
    sku: "8901234567892",
    category: "Womenswear",
    quantity: 35,
    minStock: 10,
    sellingPrice: 1400,
    purchasePrice: 1100,
    unit: "pcs",
    location: "Rack B2",
    description: "Traditional South Indian Silk Saree with Elegant Zari Border"
  },
  {
    name: "Classic Blue Men's Denim Jeans (ஆண்கள் டெனிம் ஜீன்ஸ்)",
    sku: "8901234567893",
    category: "Menswear",
    quantity: 4,
    minStock: 10,
    sellingPrice: 950,
    purchasePrice: 750,
    unit: "pcs",
    location: "Rack A2",
    description: "Durable Straight-Fit Blue Denim Jeans for Everyday Wear"
  },
  {
    name: "Printed Cotton Kurti (பெண்கள் பருத்தி குர்தி)",
    sku: "8901234567894",
    category: "Womenswear",
    quantity: 0,
    minStock: 5,
    sellingPrice: 350,
    purchasePrice: 280,
    unit: "pcs",
    location: "Rack C1",
    description: "Daily Wear Breathable Floral Printed Cotton Kurti"
  },
  {
    name: "Kids Organic Cotton Pajama Set (குழந்தைகள் இரவு உடை)",
    sku: "8901234567895",
    category: "Kidswear",
    quantity: 50,
    minStock: 8,
    sellingPrice: 450,
    purchasePrice: 350,
    unit: "pcs",
    location: "Rack D4",
    description: "Super Soft Skin-Friendly Organic Cotton Printed Nightwear"
  }
];

export default function App() {
  const mainSyncUnsubs = useRef<(() => void)[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'ta' || saved === 'en') ? saved : 'en';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'billing' | 'recent-sales' | 'system-ledger' | 'company-settings'>(() => {
    const saved = localStorage.getItem('app_active_tab');
    return (saved === 'dashboard' || saved === 'inventory' || saved === 'billing' || saved === 'recent-sales' || saved === 'system-ledger' || saved === 'company-settings') ? saved : 'dashboard';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  
  // App Core States
  const [products, setProducts] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [companyDetails, setCompanyDetails] = useState<{
    name: string;
    gstin: string;
    address: string;
    phone: string;
    logoUrl?: string;
    deletePassword?: string;
  }>(() => {
    const saved = localStorage.getItem('demo_company');
    return saved ? JSON.parse(saved) : {
      name: 'Kala Inventory',
      gstin: '33AAAAA1111A1Z1',
      address: 'Main Bazaar, Chennai, India',
      phone: '9876543210',
      logoUrl: '',
      deletePassword: ''
    };
  });
  
  // Loading & Sync states
  const [authInitializing, setAuthInitializing] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastScannedSku, setLastScannedSku] = useState<string | null>(null);
  const [scannerNotification, setScannerNotification] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem('app_zoom_level');
    if (saved) {
      const num = parseFloat(saved);
      if (!isNaN(num) && num >= 0.4 && num <= 1.5) {
        return num;
      }
    }
    return 1.0;
  });
  const [totalSalesAggregate, setTotalSalesAggregate] = useState<number>(0);

  const t = translations[language];

  // 1. Sync State Variables to LocalStorage
  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('app_zoom_level', zoomLevel.toString());
  }, [zoomLevel]);

  // Redirect non-admin users if they are on an admin-only tab
  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      if (activeTab === 'system-ledger' || activeTab === 'company-settings') {
        setActiveTab('dashboard');
      }
    }
  }, [userRole, activeTab]);

  // 2. Listen for Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
      }
      setAuthInitializing(false);
    });
    return unsubscribe;
  }, []);

  // 2.5 Sync User Role in the Backend (Firestore)
  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }

    const syncUserProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      try {
        const userSnap = await getDoc(userRef);
        // Default to 'admin' if the email is sakthibala72@gmail.com, otherwise default to 'user' or respect existing
        const defaultRole: 'admin' | 'user' = user.email === 'sakthibala72@gmail.com' ? 'admin' : 'user';

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            userId: user.uid, // Explicitly set both uid and userId to be 100% compatible
            email: user.email || '',
            displayName: user.displayName || '',
            role: defaultRole,
            updatedAt: new Date().toISOString()
          });
          setUserRole(defaultRole);
        } else {
          const existingData = userSnap.data();
          let currentRole = existingData?.role || defaultRole;

          // Force owner to be admin in both database and local state
          if (user.email === 'sakthibala72@gmail.com' && currentRole !== 'admin') {
            currentRole = 'admin';
            await setDoc(userRef, {
              role: 'admin',
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }

          if (!existingData?.userId) {
            await setDoc(userRef, {
              ...existingData,
              userId: user.uid, // Backfill userId if not present
              role: currentRole,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
          setUserRole(currentRole);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('offline') || errMsg.includes('unavailable') || errMsg.includes('network')) {
          console.warn("Firestore is offline, falling back to local user role:", errMsg);
        } else if (errMsg.includes('Quota') || errMsg.includes('quota')) {
          console.warn("Firestore quota exceeded, falling back to local user role:", errMsg);
          setSyncError("Firebase Daily Quota Exceeded. The database has reached its free tier limit and will reset tomorrow.");
        } else {
          console.error("Failed to fetch/save user profile role from backend:", err);
        }
        // Fallback to user in local state to ensure safety
        setUserRole('user');
      }
    };

    syncUserProfile();
  }, [user]);

  // 2.6 Sync Registered Users Directory (For Admins to assign roles)
  useEffect(() => {
    if (!user || userRole !== 'admin') {
      setUsersList([]);
      return;
    }

    const usersQuery = query(collection(db, 'users'));
    const unsub = onSnapshot(usersQuery, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });
      setUsersList(list);
    }, (error) => {
      const msg = error.message || String(error);
      if (msg.includes('Quota') || msg.includes('quota')) {
        console.warn("Firestore quota exceeded, failed to sync registered users.");
        setSyncError("Firebase Daily Quota Exceeded. The database has reached its free tier limit and will reset tomorrow.");
      } else {
        console.error("Failed to sync registered users:", error);
      }
    });

    return () => unsub();
  }, [user?.uid, userRole]);

  const handleUpdateUserRole = async (targetUid: string, newRole: 'admin' | 'user') => {
    try {
      const userRef = doc(db, 'users', targetUid);
      await setDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update user role:", err);
      alert(language === 'en' ? "Failed to update user role. Permissions denied." : "பயனர் பொறுப்பை மாற்ற முடியவில்லை.");
    }
  };

  const handleDeleteUser = async (targetUid: string) => {
    if (user && targetUid === user.uid) {
      alert(language === 'en' ? "You cannot delete your own account!" : "உங்கள் சொந்த கணக்கை நீங்கள் நீக்க முடியாது!");
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUid);
      await deleteDoc(userRef);
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert(language === 'en' ? "Failed to delete user. Permissions denied." : "பயனரை நீக்க முடியவில்லை.");
    }
  };

  const handleAddUser = async (userData: Omit<UserProfile, 'updatedAt'>) => {
    try {
      const userRef = doc(db, 'users', userData.uid);
      await setDoc(userRef, {
        uid: userData.uid,
        userId: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        updatedAt: new Date().toISOString()
      });
      alert(language === 'en' ? "User profile added successfully!" : "பயனர் சுயவிவரம் வெற்றிகரமாகச் சேர்க்கப்பட்டது!");
    } catch (err) {
      console.error("Failed to add user:", err);
      alert(language === 'en' ? "Failed to add user. Permissions denied." : "பயனரைச் சேர்க்க முடியவில்லை.");
    }
  };

  const handleClearAllData = async () => {
    const confirmMsg = language === 'en' 
      ? "This will permanently delete ALL products, stock levels, transactions, bills, and files in your inventory. This action cannot be undone. Continue?" 
      : "இது உங்கள் சரக்கு மேலாண்மைப் பதிவுகள் (தயாரிப்புகள், பரிவர்த்தனைகள், பில்கள், ஆவணங்கள்) அனைத்தையும் நிரந்தரமாக அழித்துவிடும். இதை மீட்டெடுக்க முடியாது. தொடரவா?";
    if (!confirm(confirmMsg)) return;

    if (user) {
      try {
        console.log("Firebase sync triggered for user", user?.uid); setAppReady(false);
        
        // Clear products
        const prodQuery = query(collection(db, 'products'), where('userId', '==', user.uid));
        const prodSnap = await getDocs(prodQuery);
        for (const docSnap of prodSnap.docs) {
          await deleteDoc(doc(db, 'products', docSnap.id));
        }

        // Clear transactions
        const txQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
        const txSnap = await getDocs(txQuery);
        for (const docSnap of txSnap.docs) {
          await deleteDoc(doc(db, 'transactions', docSnap.id));
        }

        // Clear bills
        const billQuery = query(collection(db, 'bills'), where('userId', '==', user.uid));
        const billSnap = await getDocs(billQuery);
        for (const docSnap of billSnap.docs) {
          await deleteDoc(doc(db, 'bills', docSnap.id));
        }

        // Clear files
        const fileQuery = query(collection(db, 'files'), where('userId', '==', user.uid));
        const fileSnap = await getDocs(fileQuery);
        for (const docSnap of fileSnap.docs) {
          await deleteDoc(doc(db, 'files', docSnap.id));
        }

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { hasSeeded: true }, { merge: true });

        alert(language === 'en' ? "All data cleared successfully!" : "சரக்கு விவரங்கள் அனைத்தும் வெற்றிகரமாக அழிக்கப்பட்டன!");
      } catch (err) {
        console.error("Failed to clear data:", err);
        alert(language === 'en' ? "Failed to clear data. Permission denied." : "விவரங்களை அழிக்க முடியவில்லை.");
      } finally {
        setAppReady(true);
      }
    }
  };

  const handleForceRefresh = async () => {
    if (!user?.uid) return;
    console.log("Firebase sync triggered for user", user?.uid); setAppReady(false);
    setSyncError(null);
    const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43';

    try {
      // Force fetch products
      const prodQuery = query(collection(db, 'products'), where('userId', '==', uId));
      const prodSnap = await getDocs(prodQuery);
      const fetchedProds: Product[] = [];
      prodSnap.forEach(docSnap => fetchedProds.push({ id: docSnap.id, ...docSnap.data() } as Product));
      setProducts(fetchedProds);

      // Force fetch transactions
      const txQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(50));
      const txSnap = await getDocs(txQuery);
      const fetchedTxs: Transaction[] = [];
      txSnap.forEach(docSnap => fetchedTxs.push({ id: docSnap.id, ...docSnap.data() } as Transaction));
      
      const txsBySku: { [sku: string]: Transaction[] } = {};
      fetchedTxs.forEach(tx => {
        if (tx.sku) {
          const skuUpper = tx.sku.toUpperCase();
          if (!txsBySku[skuUpper]) txsBySku[skuUpper] = [];
          txsBySku[skuUpper].push(tx);
        }
      });
      const duplicateIdsToHide = new Set<string>();
      Object.keys(txsBySku).forEach(sku => {
        const list = txsBySku[sku];
        const hasAdminInitial = list.find(t => t.referenceNo === 'INITIAL STOCK ADDED');
        if (hasAdminInitial) {
          list.forEach(t => {
            if (t.id !== hasAdminInitial.id && (t.referenceNo === 'INITIAL-STOCK' || t.referenceNo === 'INITIAL-STOCK-ADDED' || t.referenceNo === 'BULK-IMPORT-NEW')) {
              duplicateIdsToHide.add(t.id!);
            }
          });
        }
      });
      const cleanedTxs = fetchedTxs.filter(tx => !duplicateIdsToHide.has(tx.id!));
      setTransactions(cleanedTxs);

      const aggQuery = query(collection(db, 'transactions'), where('userId', '==', uId), where('type', '==', 'sales'));
      const aggSnap = await getAggregateFromServer(aggQuery, { total: sum('total') });
      setTotalSalesAggregate(aggSnap.data().total || 0);

      // Bills
      const billQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(50));
      const billSnap = await getDocs(billQuery);
      const fetchedBills: Bill[] = [];
      billSnap.forEach(docSnap => fetchedBills.push({ id: docSnap.id, ...docSnap.data() } as Bill));
      setBills(fetchedBills);

      // Company
      const companyQuery = query(collection(db, 'company'), where('userId', '==', uId));
      const companySnap = await getDocs(companyQuery);
      if (!companySnap.empty) {
        const data = companySnap.docs[0].data();
        setCompanyDetails({
          name: data.name || '',
          gstin: data.gstin || '',
          address: data.address || '',
          phone: data.phone || '',
          logoUrl: data.logoUrl || '',
          deletePassword: data.deletePassword || ''
        });
      }
    } catch (error: any) {
      console.error("Manual refresh error:", error);
      const msg = error.message || String(error);
      if (msg.includes('Quota') || msg.includes('quota') || msg.includes('Quota limit exceeded')) {
        setSyncError(`Firebase Daily Quota Exceeded. The database has reached its free tier limit and will reset tomorrow.`);
      } else {
        setSyncError(`Manual refresh failed: ${msg}`);
      }
    } finally {
      setAppReady(true);
    }
  };

  // 3. Load and Sync App data (Firestore for Real Auth)
  useEffect(() => {
    if (authInitializing) return;

    // Clean up any existing listeners to prevent duplicates (Strict Mode guard)
    if (mainSyncUnsubs.current.length > 0) {
      mainSyncUnsubs.current.forEach(unsub => unsub());
      mainSyncUnsubs.current = [];
    }

    console.log("Firebase sync triggered for user", user?.uid); setAppReady(false);
    
    if (user?.uid) {
      // --- FIRESTORE REAL SYNC ---
      const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43'; // Shared store owner UID so all users share the same database
      setSyncError(null); // Clear previous errors
      
      const handleSyncError = (error: any, type: string) => {
        console.error(`${type} sync error:`, error);
        const msg = error.message || String(error);
        if (msg.includes('Quota') || msg.includes('quota') || msg.includes('Quota limit exceeded')) {
          setSyncError(`Firebase Daily Quota Exceeded. The database has reached its free tier limit and will reset tomorrow. (Failed to load ${type})`);
        } else {
          setSyncError(`${type} load error: ${msg}`);
        }
      };

      // Sync Products
      const prodQuery = query(collection(db, 'products'), where('userId', '==', uId));
      const unsubProducts = onSnapshot(prodQuery, (snapshot) => {
        const fetchedProds: Product[] = [];
        snapshot.forEach((docSnap) => {
          fetchedProds.push({ id: docSnap.id, ...docSnap.data() } as Product);
        });

        // Auto seed disabled as user wants a blank canvas
        setProducts(fetchedProds);
        setAppReady(true);
      }, (error) => {
        handleSyncError(error, 'Products');
        setAppReady(true);
      });

      // Sync Transactions (Ledger)
      const txQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(50));
      const unsubTransactions = onSnapshot(txQuery, (snapshot) => {
        const fetchedTxs: Transaction[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTxs.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
        });

        // Filter out duplicate initial stock entries in memory
        const txsBySku: { [sku: string]: Transaction[] } = {};
        fetchedTxs.forEach(tx => {
          if (tx.sku) {
            const skuUpper = tx.sku.toUpperCase();
            if (!txsBySku[skuUpper]) txsBySku[skuUpper] = [];
            txsBySku[skuUpper].push(tx);
          }
        });

        const duplicateIdsToHide = new Set<string>();
        Object.keys(txsBySku).forEach(sku => {
          const list = txsBySku[sku];
          const hasAdminInitial = list.find(t => t.referenceNo === 'INITIAL STOCK ADDED');
          if (hasAdminInitial) {
            list.forEach(t => {
              if (t.id !== hasAdminInitial.id && (t.referenceNo === 'INITIAL-STOCK' || t.referenceNo === 'INITIAL-STOCK-ADDED' || t.referenceNo === 'BULK-IMPORT-NEW')) {
                duplicateIdsToHide.add(t.id!);
              }
            });
          }
        });

        const cleanedTxs = fetchedTxs.filter(tx => !duplicateIdsToHide.has(tx.id!));
        setTransactions(cleanedTxs);
      }, (error) => {
        handleSyncError(error, 'Transactions');
      });

      // Fetch Total Sales Aggregate
      getAggregateFromServer(query(collection(db, 'transactions'), where('userId', '==', uId), where('type', '==', 'sales')), {
        total: sum('total')
      }).then(snap => {
        setTotalSalesAggregate(snap.data().total || 0);
      }).catch(err => console.error('Aggregate error:', err));

      // Sync Bills
      const billQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(50));
      const unsubBills = onSnapshot(billQuery, (snapshot) => {
        const fetchedBills: Bill[] = [];
        snapshot.forEach((docSnap) => {
          fetchedBills.push({ id: docSnap.id, ...docSnap.data() } as Bill);
        });
        setBills(fetchedBills);
      }, (error) => {
        handleSyncError(error, 'Bills');
      });

      // Sync Company Details
      const companyQuery = query(collection(db, 'company'), where('userId', '==', uId));
      const unsubCompany = onSnapshot(companyQuery, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          setCompanyDetails({
            name: data.name || '',
            gstin: data.gstin || '',
            address: data.address || '',
            phone: data.phone || '',
            logoUrl: data.logoUrl || '',
            deletePassword: data.deletePassword || ''
          });
        }
      }, (error) => {
        const msg = error.message || String(error);
        if (msg.includes('Quota') || msg.includes('quota')) {
          handleSyncError(error, 'Company');
        } else {
          handleFirestoreError(error, OperationType.GET, 'company');
        }
      });

      mainSyncUnsubs.current = [unsubProducts, unsubTransactions, unsubBills, unsubCompany];

      return () => {
        mainSyncUnsubs.current.forEach(unsub => unsub());
        mainSyncUnsubs.current = [];
      };

    } else {
      // Unauthenticated, reset states
      setProducts([]);
      setTransactions([]);
      setBills([]);
      setAppReady(true);
    }
  }, [user?.uid, authInitializing]);


  // Seed default items into user's Firestore collection to prevent empty board
  const seedFirestoreProducts = async (uId: string) => {
    try {
      for (const item of SEED_PRODUCTS) {
        await addDoc(collection(db, 'products'), {
          ...item,
          userId: uId,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Failed to seed initial products:", err);
    }
  };

  // 3. --- CORE CRUD DATABASE MANIPULATIONS ---

  // Add Product
  const handleAddProduct = async (prodData: Omit<Product, 'id' | 'userId' | 'updatedAt'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'products'), {
          ...prodData,
          userId: 'bd0jbxr3P0aaiOB5ou6EwiZnhq43',
          updatedAt: new Date().toISOString()
        });

        // Add ledger entry for product creation/initial stock if quantity > 0
        if (Number(prodData.quantity) > 0) {
          await handleAddTransaction({
            type: 'inward',
            sku: prodData.sku || '',
            productName: prodData.size ? `${prodData.name} (${prodData.size})` : prodData.name || '',
            quantity: Number(prodData.quantity) || 0,
            price: Number(prodData.purchasePrice) || 0,
            total: (Number(prodData.quantity) || 0) * (Number(prodData.purchasePrice) || 0),
            referenceNo: 'INITIAL STOCK ADDED',
            counterParty: 'ADMIN / SYSTEM',
            paymentMethod: 'System',
            date: new Date().toISOString()
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'products');
      }
    }
  };

  // Edit Product
  const handleEditProduct = async (id: string, prodData: Partial<Product>) => {
    if (user) {
      try {
        const original = products.find(p => p.id === id);

        const docRef = doc(db, 'products', id);
        await updateDoc(docRef, {
          ...prodData,
          updatedAt: new Date().toISOString()
        });

        if (original) {
          const changes: string[] = [];
          const keysToTrack: (keyof Product)[] = [
            'name', 'sku', 'category', 'quantity', 'sellingPrice', 'purchasePrice',
            'material', 'gsm', 'color', 'size', 'maxDiscount'
          ];
          keysToTrack.forEach(key => {
            if (prodData[key] !== undefined && prodData[key] !== original[key]) {
              const labelEn = key === 'name' ? 'Name'
                            : key === 'sku' ? 'SKU'
                            : key === 'category' ? 'Category'
                            : key === 'quantity' ? 'Qty'
                            : key === 'sellingPrice' ? 'Selling Price'
                            : key === 'purchasePrice' ? 'Purchase Price'
                            : key === 'material' ? 'Material'
                            : key === 'gsm' ? 'GSM'
                            : key === 'color' ? 'Color'
                            : key === 'size' ? 'Size'
                            : key === 'maxDiscount' ? 'Max Discount'
                            : key;

              const labelTa = key === 'name' ? 'பெயர்'
                            : key === 'sku' ? 'SKU'
                            : key === 'category' ? 'பிரிவு'
                            : key === 'quantity' ? 'அளவு'
                            : key === 'sellingPrice' ? 'விற்பனை விலை'
                            : key === 'purchasePrice' ? 'கொள்முதல் விலை'
                            : key === 'material' ? 'பொருள்'
                            : key === 'gsm' ? 'ஜிஎஸ்எம்'
                            : key === 'color' ? 'வண்ணம்'
                            : key === 'size' ? 'அளவு (Size)'
                            : key === 'maxDiscount' ? 'அதிகபட்ச தள்ளுபடி'
                            : key;

              changes.push(`${labelEn}/${labelTa}: ${original[key] ?? 'N/A'} -> ${prodData[key]}`);
            }
          });

          if (changes.length > 0) {
            await handleAddTransaction({
              type: 'edited',
              sku: prodData.sku || original.sku || '',
              productName: prodData.name || original.name || '',
              quantity: prodData.quantity !== undefined ? (Number(prodData.quantity) - Number(original.quantity || 0)) : 0,
              price: prodData.sellingPrice !== undefined ? Number(prodData.sellingPrice) : Number(original.sellingPrice || 0),
              total: 0,
              referenceNo: changes.join(', '),
              counterParty: 'PRODUCT EDIT',
              paymentMethod: 'System',
              date: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
      }
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    const productToDelete = products.find(p => p.id === id);

    if (user) {
      try {
        await deleteDoc(doc(db, 'products', id));
        
        // Log "deleted" transaction in the System Ledger (type: 'deleted')
        if (productToDelete) {
          await handleAddTransaction({
            type: 'deleted',
            sku: productToDelete.sku || '',
            productName: productToDelete.name || '',
            quantity: -Number(productToDelete.quantity || 0),
            price: Number(productToDelete.sellingPrice || 0),
            total: -Number(productToDelete.quantity || 0) * Number(productToDelete.sellingPrice || 0),
            referenceNo: 'PRODUCT DELETED',
            counterParty: 'ADMIN / SYSTEM',
            paymentMethod: 'System',
            date: new Date().toISOString()
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
      }
    }
  };

  // Add Transaction (Ledger Log)
  const handleAddTransaction = async (txData: Omit<Transaction, 'id' | 'userId'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'transactions'), {
          ...txData,
          userId: 'bd0jbxr3P0aaiOB5ou6EwiZnhq43',
          createdByEmail: user.email || 'Unknown'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'transactions');
      }
    }
  };

  // Add Bill Invoice
  const handleAddBill = async (billData: Omit<Bill, 'id' | 'userId'>) => {
    if (user) {
      try {
        await addDoc(collection(db, 'bills'), {
          ...billData,
          userId: 'bd0jbxr3P0aaiOB5ou6EwiZnhq43'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'bills');
      }
    }
  };

  // Update Bill Invoice (e.g. for returns)
  const handleUpdateBill = async (id: string, updatedBill: Partial<Bill>) => {
    if (user) {
      try {
        const docRef = doc(db, 'bills', id);
        await updateDoc(docRef, {
          ...updatedBill
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `bills/${id}`);
      }
    }
  };

  // Save Company Details Settings

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
        console.log(`Deleted ${count} duplicates`);
      }
    } catch (err) {
      console.error('Error cleaning duplicates:', err);
      alert('Error cleaning duplicates. See console.');
    }
  };

  const handleSaveCompanyDetails = async (details: { name: string; gstin: string; address: string; phone: string; logoUrl?: string; deletePassword?: string }) => {
    if (user) {
      const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43';
      let snap;
      try {
        const q = query(collection(db, 'company'), where('userId', '==', uId));
        snap = await getDocs(q);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Quota') || msg.includes('quota')) {
          alert('Firebase Daily Quota Exceeded. The database has reached its free tier limit and will reset tomorrow.');
        } else {
          handleFirestoreError(err, OperationType.GET, 'company');
        }
        return;
      }

      if (!snap.empty) {
        const docId = snap.docs[0].id;
        try {
          const docRef = doc(db, 'company', docId);
          await updateDoc(docRef, {
            ...details,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Quota') || msg.includes('quota')) alert('Firebase Daily Quota Exceeded.');
          handleFirestoreError(err, OperationType.UPDATE, `company/${docId}`);
          return;
        }
      } else {
        try {
          await addDoc(collection(db, 'company'), {
            ...details,
            userId: uId,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Quota') || msg.includes('quota')) alert('Firebase Daily Quota Exceeded.');
          handleFirestoreError(err, OperationType.CREATE, 'company');
          return;
        }
      }
      alert(language === 'en' ? "Company details updated successfully!" : "நிறுவனத்தின் விவரங்கள் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டன!");
    }
  };

  // Delete Bill/Invoice and its associated transaction logs
  const handleDeleteBill = async (id: string, billNo: string) => {
    if (user) {
      try {
        // Revert stock counts for products in the deleted bill
        const targetBill = bills.find(b => b.id === id);
        if (targetBill && targetBill.items) {
          for (const item of targetBill.items) {
            const product = products.find(p => p.sku === item.sku);
            if (product && product.id) {
              const productRef = doc(db, 'products', product.id);
              await updateDoc(productRef, {
                quantity: Number(product.quantity) + Number(item.quantity),
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        await deleteDoc(doc(db, 'bills', id));
        // Mark matching transactions as deleted in firestore instead of removing them
        const matchedTxs = transactions.filter(t => t.referenceNo === billNo);
        for (const tx of matchedTxs) {
          if (tx.id) {
            await updateDoc(doc(db, 'transactions', tx.id), {
              type: 'deleted',
              referenceNo: `${tx.referenceNo} (DELETED)`
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `bills/${id}`);
      }
    }
  };

  // Delete Transaction individually
  const handleDeleteTransaction = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  // Clear all Transactions (Ledger Logs)
  const handleClearTransactions = async () => {
    if (user) {
      try {
        const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43';
        const txQuery = query(collection(db, 'transactions'), where('userId', '==', uId));
        const snapshot = await getDocs(txQuery);
        const batchPromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(batchPromises);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'transactions/all');
      }
    }
  };

  // Clear all Invoices (Bills)
  const handleClearInvoices = async () => {
    if (user) {
      try {
        const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43';
        const billQuery = query(collection(db, 'bills'), where('userId', '==', uId));
        const snapshot = await getDocs(billQuery);
        const batchPromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(batchPromises);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'bills/all');
      }
    }
  };

  // Clear all Products
  const handleClearProducts = async () => {
    if (user) {
      try {
        const uId = 'bd0jbxr3P0aaiOB5ou6EwiZnhq43';
        const prodQuery = query(collection(db, 'products'), where('userId', '==', uId));
        const snapshot = await getDocs(prodQuery);
        const batchPromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(batchPromises);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'products/all');
      }
    }
  };

  // Barcode Scan Success Callback (Auto-route to POS Billing Checkout)
  const handleBarcodeScan = (scannedSku: string) => {
    const item = products.find(p => p.sku === scannedSku);
    
    if (item) {
      setLastScannedSku(scannedSku);
      setScannerNotification(
        language === 'en'
          ? `Found product "${item.name}"! Added to invoice cart.`
          : `தயாரிப்பு "${item.name}" கண்டறியப்பட்டது! விலைப்பட்டியலில் சேர்க்கப்பட்டது.`
      );
      // Automatically route user to Billing section so they can see checkout instantly
      setActiveTab('billing');
      
      // Auto clear alert
      setTimeout(() => setScannerNotification(null), 5000);
    } else {
      setScannerNotification(
        language === 'en'
          ? `SKU Barcode "${scannedSku}" is not registered yet! Go to Stock Management to register it.`
          : `பார்கோடு "${scannedSku}" இன்னும் பதிவாகவில்லை! புதிய தயாரிப்பு பதிவில் இதனைச் சேர்க்கவும்.`
      );
      setTimeout(() => setScannerNotification(null), 5000);
    }
  };

  // Logout Trigger
  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
  };

  // Loading Screen
  if (authInitializing || !appReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        <div className="h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{t.loading}</p>
        {syncError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl max-w-md text-xs font-mono text-center shadow-sm">
            <strong className="block text-red-700 mb-1">Database Connection Error:</strong>
            {syncError}
          </div>
        )}
      </div>
    );
  }

  // Auth Screen Guard
  if (!user) {
    return (
      <Auth 
        language={language} 
        setLanguage={setLanguage} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* MOBILE HEADER BAR */}
      <header className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {companyDetails?.logoUrl ? (
            <img src={companyDetails.logoUrl} alt="Logo" className="w-7 h-7 rounded object-cover bg-white" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-extrabold text-white text-xs">A</div>
          )}
          <div className="flex flex-col">
            <h1 className="text-white font-bold tracking-tight uppercase text-xs truncate max-w-[150px]">{t.inventoryApp}</h1>
            <p className="text-[8px] text-slate-400 uppercase tracking-widest flex items-center gap-1 font-extrabold">
              <span className={`h-1.5 w-1.5 rounded-full ${syncError ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></span>
              {syncError 
                ? (language === 'en' ? 'Sync Error' : 'ஒத்திசைவு பிழை') 
                : (language === 'en' ? 'Cloud Sync' : 'கிளவுட் ஒத்திசைவு')}
              <button 
                onClick={handleForceRefresh}
                className="ml-2 hover:text-white underline"
                title="Force Refresh Data"
              >
                <RotateCcw className="w-3 h-3 inline-block" />
              </button>
            </p>
          </div>
        </div>

        {/* Profile Avatar Button */}
        <button
          onClick={() => setIsMobileProfileOpen(true)}
          className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-blue-400 border border-slate-700 transition-all cursor-pointer active:scale-95 animate-in fade-in"
          title={language === 'en' ? 'User Profile' : 'பயனர் சுயவிவரம்'}
        >
          <User className="h-4 w-4" />
        </button>
      </header>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`w-full md:w-64 bg-slate-900 text-slate-300 shrink-0 flex-col justify-between border-r border-slate-800 ${
        isMobileMenuOpen ? 'flex' : 'hidden'
      } md:flex`}>
        <div className="p-6">
          {/* App Logo & Title */}
          <div className="hidden md:flex items-center gap-3 mb-8 pb-6 border-b border-slate-800 relative">
            {companyDetails?.logoUrl ? (
              <img src={companyDetails.logoUrl} alt="Logo" className="w-8 h-8 rounded object-cover bg-white" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-extrabold text-white text-sm">A</div>
            )}
            <h1 className="text-white font-bold tracking-tight uppercase text-sm truncate flex-1">{t.inventoryApp}</h1>
            <button 
              onClick={handleForceRefresh}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title="Force Refresh Data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-8 border-b border-slate-800 pb-5">
            {/* Logged in user details at the top of sidebar */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 border border-slate-700 shrink-0">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {user?.displayName || user?.email || 'Authenticated User'}
                </p>
                <span className="text-[9px] text-slate-400 truncate block">
                  {user?.email}
                </span>
                {userRole && (
                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                    <Sparkles className="h-2 w-2 text-amber-400" />
                    {userRole} Account
                  </span>
                )}
              </div>
            </div>

            <p className="text-[10px] mt-4 text-slate-500 uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              CLOUD STORAGE (மேலாண்மை)
            </p>
          </div>

          <nav className="space-y-1">
            {/* Nav: Dashboard Reports */}
            <button
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-800 text-white border-blue-500' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>{t.dashboard}</span>
            </button>

            {/* Nav: Inventory Stock */}
            <button
              onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                activeTab === 'inventory' 
                  ? 'bg-slate-800 text-white border-blue-500' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Package className="h-4 w-4" />
              <span className="text-left" style={{ textAlign: 'left' }}>{t.stockManagement}</span>
            </button>

            {/* Nav: POS Billing */}
            <button
              onClick={() => { setActiveTab('billing'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                activeTab === 'billing' 
                  ? 'bg-slate-800 text-white border-blue-500' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>{t.billing}</span>
            </button>

            {/* Nav: Recent Sales */}
            <button
              onClick={() => { setActiveTab('recent-sales'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                activeTab === 'recent-sales' 
                  ? 'bg-slate-800 text-white border-blue-500' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{language === 'en' ? 'Sales Details' : 'விற்பனை விவரங்கள்'}</span>
            </button>

            {/* Nav: System Ledger & Sales Log */}
            {userRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('system-ledger'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                  activeTab === 'system-ledger' 
                    ? 'bg-slate-800 text-white border-blue-500' 
                    : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ArrowDownUp className="h-4 w-4" />
                <span>{language === 'en' ? 'System Log' : 'சிஸ்டம் லாக்'}</span>
              </button>
            )}

            {/* Nav: Admin Company Settings */}
            {userRole === 'admin' && (
              <button
                onClick={() => { setActiveTab('company-settings'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border-l-4 ${
                  activeTab === 'company-settings' 
                    ? 'bg-slate-800 text-white border-blue-500' 
                    : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Building2 className="h-4 w-4 text-blue-500" />
                <span className="text-left" style={{ textAlign: 'left' }}>{language === 'en' ? 'Company Details' : 'நிறுவனத்தின் விவரங்கள்'}</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer User controls */}
        <div className="p-6 border-t border-slate-800 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
              className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
            >
              <Globe className="h-3 w-3" />
              {language === 'en' ? 'தமிழ்' : 'English'}
            </button>
            <button
              onClick={handleLogout}
              className="py-1.5 px-3 bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 rounded-lg text-xs font-bold transition-all"
              title={t.logout}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT CANVAS */}
      <main 
        className="flex-1 p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto"
        style={{ zoom: zoomLevel } as React.CSSProperties}
      >
        {syncError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-mono flex flex-col gap-1 shadow-sm">
            <div className="font-bold flex items-center gap-1.5 text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              DATABASE SYNC ERROR (தரவுத்தள ஒத்திசைவு பிழை)
            </div>
            <div>{syncError}</div>
          </div>
        )}
        
        {/* Dynamic scanner success global popup banner */}
        <AnimatePresence>
          {scannerNotification && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-6 p-4 rounded-xl border flex items-center gap-3 shadow-lg ${
                scannerNotification.includes('not registered')
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-900 border-emerald-800 text-emerald-50'
              }`}
            >
              {scannerNotification.includes('not registered') ? (
                <Sparkles className="h-5 w-5 shrink-0 text-amber-500 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-300" />
              )}
              <span className="text-xs font-bold">{scannerNotification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Route Render switcher with motion animations */}
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  language={language} 
                  products={products} 
                  transactions={transactions} 
                  bills={bills}
                  totalSalesAggregate={totalSalesAggregate}
                  userRole={userRole}
                  onDeleteBill={handleDeleteBill}
                  onDeleteTransaction={handleDeleteTransaction}
                  usersList={usersList}
                  onUpdateUserRole={handleUpdateUserRole}
                  onDeleteUser={handleDeleteUser}
                  onAddUser={handleAddUser}
                />
              )}

              {activeTab === 'inventory' && (
                <Inventory 
                  language={language} 
                  products={products}
                  transactions={transactions}
                  onAddProduct={handleAddProduct}
                  onEditProduct={handleEditProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddTransaction={handleAddTransaction}
                  userRole={userRole}
                  onClearProducts={handleClearProducts}
                  companyDetails={companyDetails}
                />
              )}

              {activeTab === 'billing' && (
                <Billing 
                  language={language} 
                  products={products}
                  onAddBill={handleAddBill}
                  onEditProduct={handleEditProduct}
                  onAddTransaction={handleAddTransaction}
                  lastScannedSku={lastScannedSku}
                  clearLastScannedSku={() => setLastScannedSku(null)}
                  companyDetails={companyDetails}
                />
              )}

              {activeTab === 'company-settings' && userRole === 'admin' && (
                <CompanySettings 
                  language={language}
                  companyDetails={companyDetails}
                  onSave={handleSaveCompanyDetails}
                  onCleanDuplicates={handleCleanDuplicates}
                />
              )}

              {activeTab === 'recent-sales' && (
                <RecentSales 
                  language={language}
                  bills={bills}
                  products={products}
                  userRole={userRole}
                  onDeleteBill={handleDeleteBill}
                  onEditProduct={handleEditProduct}
                  onAddTransaction={handleAddTransaction}
                  onUpdateBill={handleUpdateBill}
                  companyDetails={companyDetails}
                  onClearInvoices={handleClearInvoices}
                />
              )}

              {activeTab === 'system-ledger' && userRole === 'admin' && (
                <SystemLedger 
                  language={language}
                  transactions={transactions}
                  products={products}
                  userRole={userRole}
                  onDeleteTransaction={handleDeleteTransaction}
                  onClearTransactions={handleClearTransactions}
                  companyDetails={companyDetails}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center h-16 px-2 shadow-2xl z-40 pb-safe">
        {/* Button 1: System Log (Left Side) */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setActiveTab('system-ledger'); setIsMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors relative cursor-pointer ${
              activeTab === 'system-ledger' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownUp className="h-4.5 w-4.5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight truncate max-w-[64px]">
              {language === 'en' ? 'System' : 'சிஸ்டம்'}
            </span>
            {activeTab === 'system-ledger' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-t-full"></span>
            )}
          </button>
        )}

        {/* Button 2: Stock (Left Side) */}
        <button
          onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors relative cursor-pointer ${
            activeTab === 'inventory' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="h-4.5 w-4.5" />
          <span className="text-[9px] font-bold mt-1 tracking-tight truncate max-w-[64px]">
            {language === 'en' ? 'Stock' : 'இருப்பு'}
          </span>
          {activeTab === 'inventory' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-t-full"></span>
          )}
        </button>

        {/* Button 3: Dashboard (Center Primary) */}
        <div className="flex-1 flex justify-center -mt-6 relative z-50">
          <button
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-full border-4 border-slate-900 transition-all shadow-xl cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-blue-600 text-white hover:bg-blue-500 scale-110 shadow-blue-500/20' 
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5.5 w-5.5" />
          </button>
        </div>

        {/* Button 4: Billing (Right Side) */}
        <button
          onClick={() => { setActiveTab('billing'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors relative cursor-pointer ${
            activeTab === 'billing' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="h-4.5 w-4.5" />
          <span className="text-[9px] font-bold mt-1 tracking-tight truncate max-w-[64px]">
            {language === 'en' ? 'Billing' : 'பில்லிங்'}
          </span>
          {activeTab === 'billing' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-t-full"></span>
          )}
        </button>

        {/* Button 5: Sales (Right Side) */}
        <button
          onClick={() => { setActiveTab('recent-sales'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors relative cursor-pointer ${
            activeTab === 'recent-sales' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="h-4.5 w-4.5" />
          <span className="text-[9px] font-bold mt-1 tracking-tight truncate max-w-[64px]">
            {language === 'en' ? 'Sales' : 'விற்பனை'}
          </span>
          {activeTab === 'recent-sales' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* MOBILE PROFILE DETAILS VIEW */}
      <AnimatePresence>
        {isMobileProfileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileProfileOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            
            {/* Drawer Content */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative bg-white w-full max-h-[85vh] rounded-t-3xl shadow-2xl overflow-hidden border-t border-slate-200 flex flex-col z-10"
            >
              {/* Drag Handle indicator */}
              <div className="mx-auto my-3 w-12 h-1.5 bg-slate-200 rounded-full shrink-0" />
              
              {/* Close Button & Header */}
              <div className="px-6 pb-4 flex items-center justify-between border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {language === 'en' ? 'User Profile' : 'பயனர் சுயவிவரம்'}
                </h3>
                <button
                  onClick={() => setIsMobileProfileOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="p-6 overflow-y-auto space-y-6 pb-12">
                {/* Profile Details Block */}
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-16 w-16 rounded-full bg-slate-100 border-2 border-blue-100 flex items-center justify-center text-blue-600 shadow-sm relative shrink-0">
                    <User className="h-8 w-8" />
                    {userRole === 'admin' && (
                      <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border border-white shadow-xs">
                        <Sparkles className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {user?.email}
                    </p>
                  </div>

                  {userRole && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <Sparkles className="h-3 w-3" />
                      {userRole === 'admin' ? (language === 'en' ? 'Administrator' : 'நிர்வாகி') : (language === 'en' ? 'User' : 'பயனர்')}
                    </span>
                  )}

                  {/* Database / Cloud storage status indicator inside mobile profile/settings menu */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    <span className={`h-1.5 w-1.5 rounded-full ${syncError ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></span>
                    {syncError 
                      ? (language === 'en' ? 'Database Sync Error' : 'தரவுத்தள ஒத்திசைவு பிழை') 
                      : (language === 'en' ? 'Cloud Storage Active' : 'கிளவுட் சேமிப்பு இயங்குகிறது')}
                  </div>
                </div>

                {/* Settings Block */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Language Setting */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      {language === 'en' ? 'App Language' : 'பயன்பாட்டு மொழி'}
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setLanguage('en')}
                        className={`py-2 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                          language === 'en' 
                            ? 'bg-white text-slate-900 shadow-xs' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => setLanguage('ta')}
                        className={`py-2 text-xs font-bold rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                          language === 'ta' 
                            ? 'bg-white text-slate-900 shadow-xs font-bold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        தமிழ்
                      </button>
                    </div>
                  </div>

                  {/* Screen Zoom Control */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
                      {language === 'en' ? 'Screen Zoom' : 'திரை அளவு'}
                    </label>
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                      {/* Zoom Out Button (Supports up to 40% zoom out) */}
                      <button
                        onClick={() => setZoomLevel(prev => Math.max(0.4, prev - 0.1))}
                        disabled={zoomLevel <= 0.4}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg shadow-2xs border border-slate-200/80 transition-all active:scale-90 disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center justify-center"
                        title={language === 'en' ? 'Zoom Out' : 'சிறிதாக்கு'}
                        id="zoom-out-btn-mobile"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>

                      {/* Current Zoom Indicator & Reset Button */}
                      <button
                        onClick={() => setZoomLevel(1.0)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-lg text-xs font-mono font-bold transition-all active:scale-95 border border-blue-200/50 cursor-pointer min-w-[50px] text-center"
                        title={language === 'en' ? 'Reset Zoom (100%)' : 'இயல்பு நிலைக்கு மாற்று (100%)'}
                        id="zoom-reset-btn-mobile"
                      >
                        {Math.round(zoomLevel * 100)}%
                      </button>

                      {/* Zoom In Button */}
                      <button
                        onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                        disabled={zoomLevel >= 1.5}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg shadow-2xs border border-slate-200/80 transition-all active:scale-90 disabled:opacity-45 disabled:pointer-events-none cursor-pointer flex items-center justify-center"
                        title={language === 'en' ? 'Zoom In' : 'பெரிதாக்கு'}
                        id="zoom-in-btn-mobile"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Company Details navigation link on mobile drawer if Admin */}
                  {userRole === 'admin' && (
                    <button
                      onClick={() => {
                        setActiveTab('company-settings');
                        setIsMobileProfileOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="h-4.5 w-4.5 text-blue-600" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-800">
                            {language === 'en' ? 'Company Details' : 'நிறுவனத்தின் விவரங்கள்'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {language === 'en' ? 'Manage GSTIN, Address, Phone' : 'ஜிஎஸ்டி, முகவரி, மொபைல் மேலாண்மை'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">→</span>
                    </button>
                  )}
                </div>

                {/* Actions Block */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsMobileProfileOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {language === 'en' ? 'Sign Out Account' : 'கணக்கிலிருந்து வெளியேறு'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
