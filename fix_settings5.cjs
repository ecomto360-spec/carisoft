const fs = require('fs');

const path = 'src/pages/settings/SettingsModule.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    `      {/* SaaS 1-Year License Status Card - VISIBLE ONLY TO SUPER ADMIN */}
      {isSuperAdmin && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-white">Licence SaaS 1 An</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-300">Formule : {licensePlan || 'SaaS Entreprise (1 An)'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
              <Clock className="h-4 w-4 text-amber-400" />
              Valable jusqu'au : <strong className="text-white">{licenseExpiry ? new Date(licenseExpiry).toLocaleDateString() : '---'}</strong>
            </div>
          </div>`,
    `      {/* SaaS 1-Year License Status Card */}
      {!isSuperAdmin && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-white">Licence SaaS 1 An</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-300">Formule : {licensePlan || 'SaaS Entreprise (1 An)'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
              <Clock className="h-4 w-4 text-amber-400" />
              Valable jusqu'au : <strong className="text-white">{licenseExpiry ? new Date(licenseExpiry).toLocaleDateString() : '---'}</strong>
            </div>
          </div>`
);

fs.writeFileSync(path, content);
console.log("Updated SettingsModule.tsx");
