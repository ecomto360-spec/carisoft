const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');

const oldBlock = `                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowPaidModal(true);
                    }}
                    className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Crown className="h-4 w-4 text-amber-500" />
                    {t.header.licensesPlans}
                  </button>
                )}`;

const newBlock = `                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/superadmin');
                      }}
                      className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Tableau de bord SuperAdmin
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShowPaidModal(true);
                      }}
                      className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Crown className="h-4 w-4 text-amber-500" />
                      {t.header.licensesPlans}
                    </button>
                  </>
                )}`;

if (content.includes("setMenuOpen(false);")) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('src/components/layout/Header.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find block to replace");
}
