const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');

const oldBlock = `            <div 
              onClick={() => user?.role === 'admin' && setShowPaidModal(true)}
              className={\`hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 \${user?.role === 'admin' ? 'hover:bg-emerald-100/80 cursor-pointer' : ''} border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium transition-colors\`}
              title="Consulter ou mettre à niveau la licence"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{settings?.licensePlan?.includes('Essai') ? 'Clé activée' : (settings?.licensePlan || 'Clé activée')} ({expiryDays} j)</span>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                PRO
              </span>
            </div>`;

const newBlock = `            <div 
              onClick={() => user?.role === 'admin' && setShowPaidModal(true)}
              className={\`hidden md:flex items-center gap-2 px-3 py-1 \${
                expiryDays <= 14 
                  ? 'bg-amber-50 border-amber-300 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              } \${user?.role === 'admin' ? 'cursor-pointer hover:opacity-80' : ''} border rounded-full text-xs font-medium transition-colors\`}
              title="Consulter ou mettre à niveau la licence"
            >
              <ShieldCheck className={\`h-4 w-4 shrink-0 \${expiryDays <= 14 ? 'text-amber-600' : 'text-emerald-600'}\`} />
              <span>
                {expiryDays <= 14 
                  ? \`Expire dans \${expiryDays} jour(s)\` 
                  : \`\${settings?.licensePlan?.includes('Essai') ? 'Clé activée' : (settings?.licensePlan || 'Clé activée')} (\${expiryDays} j)\`}
              </span>
              <span className={\`text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full \${expiryDays <= 14 ? 'bg-amber-600' : 'bg-emerald-600'}\`}>
                PRO
              </span>
            </div>`;

if (content.includes("<span>{settings?.licensePlan?.includes('Essai') ? 'Clé activée' : (settings?.licensePlan || 'Clé activée')} ({expiryDays} j)</span>")) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('src/components/layout/Header.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find block to replace");
}
