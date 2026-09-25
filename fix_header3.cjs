const fs = require('fs');

const path = 'src/components/layout/Header.tsx';
let content = fs.readFileSync(path, 'utf8');

// The logic is still wrong in Header.tsx (it has the old logic).
content = content.replace(
    `        {/* License Badge - EXCLUSIVELY FOR SUPER ADMIN */}
        {isSuperAdmin && (
          isTrial ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 rounded-full text-xs text-amber-900 font-medium">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{t.header.freeTrial} : <strong>{expiryDays} {t.header.daysRemaining}</strong></span>
            </div>
          ) : (
            <div 
              onClick={() => setShowPaidModal(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium cursor-pointer transition-colors"
              title="Consulter ou mettre à niveau la licence"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{isSuperAdmin ? "Licence SaaS Mondiale" : (settings?.licensePlan || t.header.activeLicense + " (" + expiryDays + " j)")}</span>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                {isSuperAdmin ? "SUPER ADMIN" : "PRO"}
              </span>
            </div>
          )
        )}`,
    `        {/* License Badge */}
        {isSuperAdmin ? (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <span>SUPER ADMIN</span>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                ILLIMITÉE
              </span>
            </div>
        ) : (
          isTrial ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 rounded-full text-xs text-amber-900 font-medium">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{t.header.freeTrial} : <strong>{expiryDays} {t.header.daysRemaining}</strong></span>
            </div>
          ) : (
            <div 
              onClick={() => setShowPaidModal(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium cursor-pointer transition-colors"
              title="Consulter ou mettre à niveau la licence"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{settings?.licensePlan || t.header.activeLicense} ({expiryDays} j)</span>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                PRO
              </span>
            </div>
          )
        )}`
);

fs.writeFileSync(path, content);
console.log("Updated Header.tsx with proper logic");
