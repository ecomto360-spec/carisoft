import { Link } from 'react-router-dom';
import { Check, MessageCircle, Phone } from 'lucide-react';

export function PricingFAQSection() {
  return (
    <>
      {/* SECTION 7 : TARIFS SAAS */}
      <section className="py-24 bg-[#0a0f1c] border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Des tarifs adaptés à votre taille
            </h2>
            <p className="text-slate-400 text-lg">Investissez dans un outil qui se rentabilise dès le premier mois.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
              <h3 className="text-xl font-bold text-white mb-2">Pack Starter</h3>
              <p className="text-slate-400 text-sm mb-6">Pour les petites carrières indépendantes.</p>
              <div className="text-3xl font-bold text-white mb-8">Sur devis</div>
              <ul className="space-y-4 mb-8">
                {["1 utilisateur", "Gestion des bons de livraison", "Support standard"].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-blue-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
                Demander un devis
              </button>
            </div>

            {/* Business */}
            <div className="bg-blue-900/20 border border-blue-600 rounded-3xl p-8 relative transform md:-translate-y-4 shadow-2xl shadow-blue-900/20">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Le plus populaire
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Pack Business</h3>
              <p className="text-blue-200/70 text-sm mb-6">Pour les entreprises en croissance.</p>
              <div className="text-3xl font-bold text-white mb-8">Sur devis</div>
              <ul className="space-y-4 mb-8">
                {["Multi-utilisateurs", "Module de facturation complet", "Rapports avancés & statistiques", "Support prioritaire"].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-white">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg">
                Demander un devis
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
              <h3 className="text-xl font-bold text-white mb-2">Pack Enterprise</h3>
              <p className="text-slate-400 text-sm mb-6">Pour les groupes et multi-sites.</p>
              <div className="text-3xl font-bold text-white mb-8">Sur mesure</div>
              <ul className="space-y-4 mb-8">
                {["Utilisateurs illimités", "Multi-sites et consolidation", "Personnalisation du logiciel", "Gestionnaire de compte dédié"].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-blue-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
                Nous contacter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8 : FAQ */}
      <section className="py-24 bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            Questions fréquentes
          </h2>
          <div className="space-y-6">
            {[
              { q: "Le logiciel fonctionne-t-il en Algérie ?", a: "Oui, CARISOFT.next a été spécifiquement conçu pour répondre aux normes et pratiques comptables et logistiques du marché algérien." },
              { q: "Est-ce compatible avec mon pont bascule ?", a: "Absolument. Notre module de pesée connectée s'interface avec la majorité des indicateurs de ponts bascules standards via port série ou réseau." },
              { q: "Une formation est-elle incluse ?", a: "Oui, nous accompagnons vos équipes (pontiers, facturiers, direction) lors du déploiement pour assurer une prise en main rapide." },
              { q: "Une installation serveur est-elle nécessaire ?", a: "Non, notre solution est hébergée dans le Cloud. Toutefois, notre architecture offline-first garantit un fonctionnement continu même sans internet." },
              { q: "Mes données sont-elles sauvegardées ?", a: "Vos données sont chiffrées et sauvegardées automatiquement en temps réel sur des serveurs hautement sécurisés." },
              { q: "Peut-on gérer plusieurs carrières ?", a: "Oui, les offres supérieures permettent de gérer plusieurs sites avec des accès cloisonnés et une consolidation globale pour la direction." }
            ].map((faq, idx) => (
              <div key={idx} className="bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl">
                <h4 className="text-lg font-bold text-white mb-2">{faq.q}</h4>
                <p className="text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9 : CTA */}
      <section className="py-24 bg-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888086925-0c13d4cc74c3?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Prêt à digitaliser votre carrière ?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Rejoignez les entreprises qui modernisent leur gestion avec CARISOFT.next.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/register"
              className="bg-white text-blue-700 hover:bg-slate-100 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl"
            >
              Réserver une démonstration
            </Link>
            <button className="bg-blue-800/50 hover:bg-blue-800 border border-blue-400/30 text-white px-8 py-4 rounded-xl font-medium text-lg transition-all backdrop-blur-sm">
              Être rappelé
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a0f1c] py-12 border-t border-slate-800/80 text-center md:text-left">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-6 justify-center md:justify-start">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg text-white">
                C
              </div>
              <span className="font-bold text-xl tracking-tight text-white">CARISOFT<span className="text-blue-500">.next</span></span>
            </div>
            <p className="text-slate-400 max-w-sm mx-auto md:mx-0">
              La solution complète de gestion pour carrières, sablières et producteurs d'agrégats.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contact</h4>
            <ul className="space-y-2 text-slate-400">
              <li>contact@carisoft.dz</li>
              <li>+213 550 00 00 00</li>
              <li>Alger, Algérie</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Réseaux</h4>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition-colors">LinkedIn</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Facebook</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800/80 pt-8 text-center text-slate-500 text-sm">
          © 2026 CARISOFT.next - Tous droits réservés.
        </div>
      </footer>

      {/* FLOATING CONTACT */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button className="w-14 h-14 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110">
          <MessageCircle className="w-6 h-6" />
        </button>
        <button className="w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 transition-transform hover:scale-110">
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}
