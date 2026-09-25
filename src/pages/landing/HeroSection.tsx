import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, PlayCircle } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-700/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left Column: Copy */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-blue-400 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            La solution N°1 en Algérie
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Gérez votre carrière de A à Z depuis une <span className="text-blue-500">seule plateforme</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-xl">
            Pilotez vos clients, livraisons, camions, chauffeurs, pesées, factures et paiements en temps réel.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link 
              to="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-medium text-lg transition-all shadow-[0_0_20px_-5px_rgba(29,78,216,0.5)] hover:shadow-[0_0_25px_-5px_rgba(29,78,216,0.6)]"
            >
              Essayer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a 
              href="#demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 px-8 py-4 rounded-xl font-medium text-lg transition-all"
            >
              <PlayCircle className="w-5 h-5 text-blue-400" />
              Voir la démo
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-8 border-t border-slate-800/60">
            {[
              "Hébergé dans le Cloud",
              "Sécurisé",
              "Disponible 24h/24",
              "Multi-utilisateurs"
            ].map((badge) => (
              <div key={badge} className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium">{badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Mockup */}
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/20 to-emerald-500/10 rounded-2xl blur-2xl transform rotate-3 scale-105" />
          <div className="relative bg-[#0d1424] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
            {/* Window Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/80 bg-[#0a0f1c]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-700" />
                <div className="w-3 h-3 rounded-full bg-slate-700" />
                <div className="w-3 h-3 rounded-full bg-slate-700" />
              </div>
              <div className="mx-auto bg-slate-800/50 text-slate-400 text-xs px-3 py-1 rounded-md font-mono">
                carisoft.next/dashboard
              </div>
            </div>
            {/* Fake UI */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-48 border-r border-slate-800/80 p-4 space-y-3 bg-[#0a0f1c]/50">
                <div className="h-6 w-24 bg-blue-700/20 rounded mb-6" />
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-8 bg-slate-800/50 rounded-md w-full" />
                ))}
              </div>
              {/* Content */}
              <div className="flex-1 p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="h-8 w-48 bg-slate-800 rounded-lg" />
                  <div className="h-8 w-24 bg-blue-700/40 rounded-lg" />
                </div>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between">
                      <div className="h-4 w-12 bg-slate-700 rounded" />
                      <div className="h-8 w-20 bg-slate-600 rounded" />
                    </div>
                  ))}
                </div>
                {/* Table */}
                <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <div className="h-6 w-full bg-slate-800 rounded mb-4" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 w-full bg-slate-800/40 rounded" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
