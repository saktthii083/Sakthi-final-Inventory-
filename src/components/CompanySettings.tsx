import React, { useRef } from 'react';
import { Language } from '../types';
import { Building2, Save, Sparkles, ShieldCheck, ImagePlus, Trash2 } from 'lucide-react';

interface CompanyDetails {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  logoUrl?: string;
}

interface CompanySettingsProps {
  language: Language;
  companyDetails: CompanyDetails;
  onSave: (details: CompanyDetails) => Promise<void>;
}

export default function CompanySettings({ language, companyDetails, onSave }: CompanySettingsProps) {
  const [name, setName] = React.useState(companyDetails.name || '');
  const [gstin, setGstin] = React.useState(companyDetails.gstin || '');
  const [address, setAddress] = React.useState(companyDetails.address || '');
  const [phone, setPhone] = React.useState(companyDetails.phone || '');
  const [logoUrl, setLogoUrl] = React.useState(companyDetails.logoUrl || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if props change (e.g. on database load)
  React.useEffect(() => {
    setName(companyDetails.name || '');
    setGstin(companyDetails.gstin || '');
    setAddress(companyDetails.address || '');
    setPhone(companyDetails.phone || '');
    setLogoUrl(companyDetails.logoUrl || '');
  }, [companyDetails]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(language === 'en' ? 'Please upload a valid image file.' : 'சரியான படக் கோப்பை பதிவேற்றவும்.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setLogoUrl(dataUrl);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(language === 'en' ? "Company Name is required!" : "நிறுவனத்தின் பெயர் கட்டாயம்!");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        gstin: gstin.trim(),
        address: address.trim(),
        phone: phone.trim(),
        logoUrl: logoUrl
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-2xl mx-auto">
      {/* Title block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              {language === 'en' ? 'Admin settings' : 'நிர்வாகி அமைப்புகள்'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-950 tracking-tight">
            {language === 'en' ? 'Company Details' : 'நிறுவனத்தின் விவரங்கள்'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {language === 'en' 
              ? 'Configure shop headers, GSTIN registration, and billing receipt addresses.' 
              : 'உங்கள் கடை பெயர், ஜிஎஸ்டி பதிவு எண் மற்றும் ரசீது முகவரிகளை இங்கே மாற்றியமைக்கவும்.'}
          </p>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Building2 className="h-3.5 w-3.5" />
            {language === 'en' ? 'Active Profile' : 'செயலில் உள்ள சுயவிவரம்'}
          </span>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Logo Upload Section */}
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center border-b border-slate-100 pb-6">
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Company Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-slate-300" />
              )}
            </div>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl('')}
                className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-sm"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-2 flex-1">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'en' ? 'Company Logo' : 'நிறுவனத்தின் லோகோ'}
            </label>
            <p className="text-xs text-slate-500">
              {language === 'en' 
                ? 'Upload a square logo. It will be compressed automatically.' 
                : 'ஒரு சதுர லோகோவை பதிவேற்றவும். அது தானாகவே சுருக்கப்படும்.'}
            </p>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-slate-300 shadow-sm text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all cursor-pointer"
            >
              <ImagePlus className="h-4 w-4 text-slate-400" />
              {language === 'en' ? 'Select Image' : 'படத்தைத் தேர்ந்தெடுக்கவும்'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Shop/Company Name */}
          <div className="space-y-2 col-span-1 md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'en' ? 'Shop / Company Name *' : 'கடை / நிறுவனத்தின் பெயர் *'}
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={language === 'en' ? 'e.g. Kala Apparels' : 'உதாரணம்: காலா அப்பாரல்ஸ்'}
                className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* GSTIN registration */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'en' ? 'GSTIN Number' : 'ஜிஎஸ்டி பதிவு எண்'}
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="e.g. 33AAAAA1111A1Z1"
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'en' ? 'Contact Phone Number' : 'தொடர்பு தொலைபேசி எண்'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div className="space-y-2 col-span-1 md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {language === 'en' ? 'Shop Address' : 'கடை முகவரி'}
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder={language === 'en' ? 'e.g. 45 Main Bazaar Road, Opp. Post Office, Chennai - 600001' : 'உதாரணம்: 45 தலைமை கடை வீதி, அஞ்சலகம் எதிரில், சென்னை - 600001'}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-md ${
              isSaving ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <Save className="h-4 w-4" />
            <span>
              {isSaving 
                ? (language === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...') 
                : (language === 'en' ? 'Save Company Info' : 'விவரங்களைச் சேமி')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
