import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Edit, Trash2, FolderTree, Scale, AlertCircle, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { ProductFamilyModal } from '../../components/products/ProductFamilyModal';
import { ProductUnitModal } from '../../components/products/ProductUnitModal';
import { useAuthStore } from '../../store/authStore';

export function ProductList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string; code: string } | null>(null);

  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(p => p.active && (
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code.toLowerCase().includes(search.toLowerCase())
  )).toArray(), [search]);

  const conventions = useLiveQuery(() => db.conventions.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray());
  const productPrices = useLiveQuery(() => db.productPrices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const families = useLiveQuery(() => db.productFamilies.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray());

  const getPrice = (productId: string, conventionId: string) => {

    const pp = productPrices?.find(p => p.productId === productId && p.conventionId === conventionId);
    return pp ? pp.priceHT : null;
  };

  const getFamilyName = (familyId: string) => {
    return families?.find(f => f.id === familyId)?.name || familyId;
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await db.products.update(productToDelete.id, { active: false });
      setProductToDelete(null);
    } catch (err) {
      console.error('Error deleting product', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produits & Tarifs</h1>
          <p className="text-slate-500">Grille tarifaire par produit et convention</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={() => setShowFamilyModal(true)}
            className="text-slate-700 hover:text-blue-600 border-slate-300 cursor-pointer"
          >
            <FolderTree className="h-4 w-4 mr-1.5 text-blue-600" />
            Gérer les Familles
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setShowUnitModal(true)}
            className="text-slate-700 hover:text-emerald-600 border-slate-300 cursor-pointer"
          >
            <Scale className="h-4 w-4 mr-1.5 text-emerald-600" />
            Gérer les Unités
          </Button>

          <Button onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-500 cursor-pointer">
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau Produit
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Rechercher par désignation ou code..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Famille</TableHead>
                <TableHead>Unité</TableHead>
                {conventions?.map(conv => (
                  <TableHead key={conv.id} className="text-right whitespace-nowrap">
                    {conv.name}
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono font-medium text-slate-700">{product.code}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{product.name}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold uppercase">
                      {getFamilyName(product.familyId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold">
                      {product.unit}
                    </span>
                  </TableCell>
                  {conventions?.map(conv => {
                    const price = getPrice(product.id, conv.id);
                    return (
                      <TableCell key={conv.id} className="text-right font-mono">
                        {price !== null ? formatCurrency(price) : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(product.id)} title="Modifier" className="cursor-pointer">
                        <Edit className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setProductToDelete({ id: product.id, name: product.name, code: product.code })} 
                        title="Supprimer"
                        className="cursor-pointer text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={(conventions?.length || 0) + 5} className="text-center py-8 text-slate-500">
                    Aucun produit trouvé
                  </TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Supprimer le Produit</h3>
              </div>
              <button 
                onClick={() => setProductToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Voulez-vous vraiment supprimer le produit <strong className="text-slate-900">{productToDelete.name} ({productToDelete.code})</strong> ?
            </p>
            <p className="text-xs text-slate-400">
              Le produit sera archivé en toute sécurité pour conserver l'historique des bons de livraison et factures.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setProductToDelete(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={confirmDeleteProduct} className="bg-red-600 hover:bg-red-500 text-white">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Oui, Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Family Manager Modal */}
      <ProductFamilyModal 
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
      />

      {/* Unit Manager Modal */}
      <ProductUnitModal 
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
      />
    </div>
  );
}
