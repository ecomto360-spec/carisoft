import { 
  FileText, Scale, FileWarning, MapPinOff, EyeOff, Copy,
  Users, Package, Truck, Receipt, CreditCard, BarChart3, Shield,
  CheckCircle2, XCircle, PlayCircle
} from 'lucide-react';

export function FeaturesSection() {
  return (
    <>
      {/* SECTION 2 : PROBLÈMES */}
      <section className="py-24 bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Les défis quotidiens des carrières
            </h2>
            <p className="text-slate-400 text-lg">Ces obstacles freinent votre croissance et réduisent votre marge.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              { icon: FileWarning, title: "Bons papier perdus", desc: "Des documents égarés entraînant des factures impayées." },
              { icon: Scale, title: "Erreurs de pesée", desc: "Saisies manuelles inexactes au niveau du pont bascule." },
              { icon: Receipt, title: "Factures en retard", desc: "Processus manuel long et sujet aux oublis de facturation." },
              { icon: MapPinOff, title: "Difficulté de suivi", desc: "Manque de visibilité sur l'affectation des camions et chauffeurs." },
              { icon: EyeOff, title: "Manque de visibilité", desc: "Aucun tableau de bord pour suivre la rentabilité en temps réel." },
              { icon: Copy, title: "Double saisie des données", desc: "Perte de temps entre le pont bascule et la comptabilité." }
            ].map((issue, idx) => (
              <div key={idx} className="bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                  <issue.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">{issue.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{issue.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="inline-block bg-blue-700/10 border border-blue-700/30 px-8 py-4 rounded-full">
              <h3 className="text-2xl font-bold text-blue-400">CARISOFT.next élimine ces problèmes.</h3>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 : FONCTIONNALITÉS */}
      <section className="py-24 bg-[#0a0f1c] border-t border-slate-800/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Une suite complète pour votre activité
            </h2>
            <p className="text-slate-400 text-lg">Chaque module est conçu pour accélérer vos opérations et sécuriser vos revenus.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Gestion Clients", desc: "Historique complet des achats et encours." },
              { icon: FileText, title: "Bons de Livraison", desc: "Création rapide et impression instantanée." },
              { icon: Package, title: "Gestion Produits", desc: "Agrégats, sable, gravier, béton." },
              { icon: Truck, title: "Camions & Chauffeurs", desc: "Suivi et affectation par transporteur." },
              { icon: Scale, title: "Pesée Connectée", desc: "Intégration directe avec votre pont bascule." },
              { icon: Receipt, title: "Facturation", desc: "Génération automatique des factures." },
              { icon: CreditCard, title: "Paiements", desc: "Suivi précis des règlements et créances." },
              { icon: BarChart3, title: "Rapports", desc: "Statistiques et chiffre d'affaires en temps réel." },
              { icon: Shield, title: "Utilisateurs", desc: "Gestion granulaire des accès et des rôles." }
            ].map((feat, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/50 transition-colors p-8 rounded-2xl group">
                <div className="w-12 h-12 rounded-xl bg-blue-700/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-slate-400">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 : DÉMONSTRATION */}
      <section id="demo" className="py-24 bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">
            Découvrez CARISOFT.next en action
          </h2>
          <div className="aspect-video bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden relative group cursor-pointer shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-blue-600/90 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform shadow-lg">
                <PlayCircle className="w-10 h-10 text-white ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 : AVANTAGES (COMPARAISON) */}
      <section className="py-24 bg-[#0a0f1c] border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            L'impact de la digitalisation
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Sans */}
            <div className="bg-slate-900 border border-red-900/30 rounded-3xl p-8 lg:p-12">
              <h3 className="text-2xl font-bold text-slate-300 mb-8 pb-4 border-b border-slate-800">Sans CARISOFT.next</h3>
              <ul className="space-y-6">
                {["Papier et classeurs physiques", "Erreurs de saisie fréquentes", "Retards de facturation", "Perte d'informations critiques", "Temps perdu en vérifications"].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-400 text-lg">
                    <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Avec */}
            <div className="bg-blue-900/10 border border-blue-800/50 rounded-3xl p-8 lg:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-blue-600/10 blur-[100px] pointer-events-none" />
              <h3 className="text-2xl font-bold text-white mb-8 pb-4 border-b border-blue-900/50">Avec CARISOFT.next</h3>
              <ul className="space-y-6 relative z-10">
                {["Automatisation des flux", "Traçabilité totale", "Rapidité d'exécution", "Rentabilité optimisée", "Contrôle total sur l'activité"].map((item, i) => (
                  <li key={i} className="flex items-center gap-4 text-slate-200 text-lg font-medium">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 : CHIFFRES */}
      <section className="py-24 bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-x divide-slate-800">
            <div className="text-center px-4">
              <div className="text-4xl lg:text-5xl font-bold text-white mb-2">+50 000</div>
              <div className="text-slate-400 font-medium">Bons de livraison générés</div>
            </div>
            <div className="text-center px-4">
              <div className="text-4xl lg:text-5xl font-bold text-white mb-2">+100 000</div>
              <div className="text-slate-400 font-medium">Tonnes suivies</div>
            </div>
            <div className="text-center px-4">
              <div className="text-4xl lg:text-5xl font-bold text-blue-500 mb-2">99.9%</div>
              <div className="text-slate-400 font-medium">Disponibilité</div>
            </div>
            <div className="text-center px-4">
              <div className="text-4xl lg:text-5xl font-bold text-emerald-500 mb-2">70%</div>
              <div className="text-slate-400 font-medium">Gain de temps</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
