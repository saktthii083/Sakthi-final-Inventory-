import React from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Language } from '../types';
import { translations } from '../translations';
import { Package, LogIn, ShieldAlert, AlertCircle, Globe } from 'lucide-react';

interface AuthProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export default function Auth({ language, setLanguage }: AuthProps) {
  const t = translations[language];
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Email login states
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password login is not enabled in Firebase Console. Please use Demo Mode!');
      } else {
        setErrorMsg(err.message || 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      {/* Top Language Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setLanguage('en')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              language === 'en'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="h-3 w-3" />
            {t.english}
          </button>
          <button
            onClick={() => setLanguage('ta')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              language === 'ta'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="h-3 w-3" />
            {t.tamil}
          </button>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
          <Package className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.inventoryApp}
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
          {language === 'en' 
            ? 'Inventory & Sales' 
            : 'சரக்கு இருப்பு மற்றும் விற்பனை'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          
          {errorMsg && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 shrink-0" />
                <p className="text-xs text-red-700 font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {language === 'en' ? 'Email Address' : 'மின்னஞ்சல் முகவரி'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {language === 'en' ? 'Password' : 'கடவுச்சொல்'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                {language === 'en' ? 'Login' : 'உள்நுழைக'}
              </button>

              <div className="flex gap-2 items-start bg-amber-50 rounded-lg p-2.5 text-[11px] text-amber-800 leading-tight">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  {language === 'en'
                    ? 'Note: Email/Password must be activated first in your Firebase authentication panel.'
                    : 'குறிப்பு: மின்னஞ்சல் வழியை உங்கள் ஃபயர்பேஸ் கன்சோலில் முதலில் செயல்படுத்தியிருக்க வேண்டும்.'}
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
