const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/SuperAdminPanel.tsx', 'utf8');

const renderRegex = /customers\.map\(\(customer\) => \(\s*<tr key={customer\.uid}.*?<\/tr>\s*\)\)/s;
const newRender = `customers.map((customer: any) => {
                  const createdAt = customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString('fr-FR') : (customer.createdAt || 'N/A');
                  const daysRemaining = customer.licenseExpiry 
                    ? Math.max(0, Math.ceil((new Date(customer.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 0;
                  return (
                  <tr key={customer.uid} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{customer.name || customer.nom || 'Sans nom'}</div>
                      <div className="text-xs text-slate-500">ID: {customer.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300">{customer.ownerEmail || customer.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-400 text-sm">{createdAt}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border \${
                        customer.licenseStatus === 'active' || customer.status === 'actif' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }\`}>
                        {customer.licenseStatus === 'active' || customer.status === 'actif' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {customer.licensePlan || customer.status || 'N/A'}
                      </span>
                      {customer.licenseKey && (
                        <div className="mt-2 flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800 w-fit">
                          <Key className="w-3 h-3 text-slate-500" />
                          <code className="text-[10px] text-slate-400 truncate max-w-[120px]">{customer.licenseKey.substring(0, 20)}...</code>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(customer.licenseKey); alert('Copié'); }}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={\`font-bold \${daysRemaining <= 14 ? 'text-amber-500' : 'text-emerald-500'}\`}>
                        {daysRemaining} jour(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingCompany(customer)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(customer.uid)}
                            className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs font-medium rounded-lg transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                        <button
                          onClick={() => handleGenerateAndAssignKey(customer.uid, customer.ownerEmail || customer.email || 'admin@carisoft.com', 12)}
                          disabled={generatingKey === customer.uid}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors mt-1"
                        >
                          {generatingKey === customer.uid ? 'Génération...' : '+ 1 An (PRO)'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                })`;

if (renderRegex.test(content)) {
    content = content.replace(renderRegex, newRender);
    fs.writeFileSync('src/pages/admin/SuperAdminPanel.tsx', content);
    console.log("Patched render successfully");
} else {
    console.log("Could not find render block to replace");
}
