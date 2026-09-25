const fs = require('fs');

const path = 'src/pages/settings/SettingsModule.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
`          <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Clé de Licence Activée
              </label>
              <input 
                type="text" 
                value={licenseKey} 
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Ex: CARI-2026-SAAS-PRO-..." 
                className="w-full bg-slate-950/50 border border-slate-700 text-emerald-400 font-mono text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleVerifyLicense}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors"
              >
                Vérifier & Activer
              </button>
            </div>
          </div>
        </div>
      )}`,
`          <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Clé de Licence Activée
              </label>
              <input 
                type="text" 
                value={licenseKey} 
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Ex: CARI-2026-SAAS-PRO-..." 
                className="w-full bg-slate-950/50 border border-slate-700 text-emerald-400 font-mono text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleVerifyLicense}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors"
              >
                Vérifier & Activer
              </button>
            </div>
          </div>
        </div>
      )}`
);

fs.writeFileSync(path, content);
console.log("Updated SettingsModule.tsx bottom div");
