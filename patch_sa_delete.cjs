const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/SuperAdminPanel.tsx', 'utf8');

if (!content.includes('import { collection, query, getDocs, updateDoc, doc, deleteDoc } from')) {
    content = content.replace("import { collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';", "import { collection, query, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';");
}

if (!content.includes('const handleDeleteCompany =')) {
    const deleteFunc = `  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette entreprise ? Toutes les données associées pourraient être perdues.")) {
      return;
    }
    try {
      await deleteDoc(doc(firestore, 'companies', companyId));
      fetchCustomers();
    } catch (error) {
      console.warn("Erreur suppression entreprise:", error);
      alert("Erreur lors de la suppression.");
    }
  };
`;
    content = content.replace("const handleGenerateAndAssignKey =", deleteFunc + "\n  const handleGenerateAndAssignKey =");
    fs.writeFileSync('src/pages/admin/SuperAdminPanel.tsx', content);
    console.log("Patched delete successfully");
} else {
    console.log("Already has delete function");
}
