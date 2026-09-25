const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/SuperAdminPanel.tsx', 'utf8');

if (!content.includes('import { EditCompanyModal }')) {
    content = content.replace("import { SaasCustomer } from '../../types/saas';", "import { SaasCustomer } from '../../types/saas';\nimport { EditCompanyModal } from './EditCompanyModal';");
}

if (!content.includes('const [editingCompany, setEditingCompany]')) {
    content = content.replace("const [activeTab, setActiveTab] = useState<'customers' | 'requests'>('customers');", "const [activeTab, setActiveTab] = useState<'customers' | 'requests'>('customers');\n  const [editingCompany, setEditingCompany] = useState<any>(null);");
}

const oldActionBtn = `                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleGenerateAndAssignKey(customer.uid, customer.ownerEmail || customer.email || 'admin@carisoft.com', 12)}
                          disabled={generatingKey === customer.uid}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {generatingKey === customer.uid ? 'Génération...' : '+ 1 An (PRO)'}
                        </button>
                      </div>`;

const newActionBtn = `                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => setEditingCompany(customer)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Modifier infos
                        </button>
                        <button
                          onClick={() => handleGenerateAndAssignKey(customer.uid, customer.ownerEmail || customer.email || 'admin@carisoft.com', 12)}
                          disabled={generatingKey === customer.uid}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {generatingKey === customer.uid ? 'Génération...' : '+ 1 An (PRO)'}
                        </button>
                      </div>`;

if (content.includes("onClick={() => handleGenerateAndAssignKey(customer.uid,")) {
    content = content.replace(oldActionBtn, newActionBtn);
}

if (!content.includes('<EditCompanyModal')) {
    content = content.replace("    </div>\n  );\n}", "      {editingCompany && <EditCompanyModal customer={editingCompany} onClose={() => setEditingCompany(null)} onRefresh={fetchCustomers} />}\n    </div>\n  );\n}");
}

fs.writeFileSync('src/pages/admin/SuperAdminPanel.tsx', content);
