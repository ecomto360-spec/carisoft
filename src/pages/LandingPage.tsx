import { Link } from 'react-router-dom';
import { HeroSection } from './landing/HeroSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { PricingFAQSection } from './landing/PricingFAQSection';
import { useEffect } from 'react';

export function LandingPage() {
  useEffect(() => {
    // Basic SEO Meta tags injection for the landing page
    document.title = "CARISOFT.next - Logiciel ERP pour Carrières en Algérie";
    
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'gestion carrière, logiciel carrière, pont bascule, gestion livraison, bon de livraison, logiciel carrière Algérie, gestion agrégats, gestion sablière, logiciel pesée, facturation carrière');

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', "La solution complète de gestion de carrière, pesée, expédition, facturation et suivi des livraisons en Algérie.");
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white selection:bg-blue-600 selection:text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-[#0F172A]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center font-bold text-lg shadow-[0_0_15px_-3px_rgba(29,78,216,0.6)]">
            C
          </div>
          <span className="font-bold text-2xl tracking-tight">CARISOFT<span className="text-blue-500">.next</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            to="/login" 
            className="text-sm font-medium text-slate-300 hover:text-white px-5 py-2.5 rounded-full hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
          >
            Se connecter
          </Link>
          <a 
            href="https://github.com/ecomto360-spec/Carisoft/releases/download/v0.1.0/Carisoft_0.1.0_x64-setup.exe"
            className="hidden sm:inline-flex text-sm font-bold bg-white text-slate-900 hover:bg-slate-200 px-5 py-2.5 rounded-full transition-colors"
          >
            Télécharger
          </a>
        </div>
      </header>

      {/* Sections */}
      <main className="flex-1 flex flex-col">
        <HeroSection />
        <FeaturesSection />
        <PricingFAQSection />
      </main>
    </div>
  );
}
