import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db/db';
import { generateBLHtml, type DeliveryPrintData } from '../../lib/printReceipt';
import { Printer, ArrowLeft, Download, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function PrintDeliveryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const format = (searchParams.get('format') as 'A4' | 'ticket') || 'A4';

  const [printData, setPrintData] = useState<DeliveryPrintData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        const bl = await db.deliveryNotes.get(id);
        if (!bl) {
          setLoading(false);
          return;
        }

        const [cust, truck, driver, item, company] = await Promise.all([
          db.customers.get(bl.customerId),
          db.trucks.get(bl.truckId),
          bl.driverId ? db.drivers.get(bl.driverId) : null,
          db.deliveryNoteItems.where('deliveryNoteId').equals(id).first(),
          db.settings.get(1)
        ]);

        const prod = item ? await db.products.get(item.productId) : null;

        const payload: DeliveryPrintData = {
          number: bl.number,
          date: bl.date,
          customerName: cust?.name || 'Client',
          customerCode: cust?.code || '',
          customerAddress: cust?.address || '',
          customerRC: cust?.rc || '',
          customerNIF: cust?.nif || '',
          productName: prod?.name || 'Agrégats',
          productCode: prod?.code || '',
          productUnit: prod?.unit || 'Tonne',
          truckMatricule: truck?.matricule || '',
          driverName: driver?.name || 'Chauffeur',
          grossWeight: bl.grossWeight || 0,
          tare: bl.tare || 0,
          netWeight: bl.netWeight || 0,
          priceHT: item?.priceHT || (bl.netWeight > 0 ? bl.totalHT / bl.netWeight : 0),
          totalHT: bl.totalHT,
          totalTVA: bl.totalTVA,
          totalTTC: bl.totalTTC,
          tvaRate: cust?.tvaExempt ? 0 : 19,
          hidePrices: cust?.hidePricesOnDeliveryNote || false,
          destination: bl.destination,
          remarks: bl.remarks,
          companyName: company?.name || 'CARISOFT.next CARRIÈRE',
          companyPhone: company?.phone || '025 00 00 00',
          companyAddress: company?.address,
          companyNif: company?.nif,
          companyRc: company?.rc,
          companyLogo: company?.logoUrl
        };

        setPrintData(payload);
        setLoading(false);

        // Auto trigger print after loading
        setTimeout(() => {
          window.print();
        }, 400);
      } catch (err) {
        console.error('Error loading print data', err);
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleDownload = () => {
    if (!printData) return;
    const html = generateBLHtml(printData, format);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${printData.number}_${format}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-slate-600 font-semibold">Chargement du bon de livraison pour impression...</p>
      </div>
    );
  }

  if (!printData) {
    return (
      <div className="p-8 text-center bg-white max-w-md mx-auto my-12 rounded-xl shadow border">
        <p className="text-red-600 font-bold mb-4">Bon de livraison introuvable.</p>
        <Button onClick={() => navigate('/deliveries')}>Retour aux livraisons</Button>
      </div>
    );
  }

  const htmlContent = generateBLHtml(printData, format);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Control bar (hidden during print) */}
      <div className="no-print bg-slate-900 text-white px-6 py-3 sticky top-0 z-50 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/deliveries')}
            className="text-white border-slate-700 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <span className="font-bold text-sm font-mono">{printData.number}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Format selector */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setSearchParams({ format: 'A4' })}
              className={`px-3 py-1 rounded-md font-semibold ${format === 'A4' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            >
              Format A4
            </button>
            <button
              onClick={() => setSearchParams({ format: 'ticket' })}
              className={`px-3 py-1 rounded-md font-semibold ${format === 'ticket' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            >
              Ticket 80mm
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={handleDownload} className="text-slate-200 border-slate-700 hover:bg-slate-800">
            <Download className="h-4 w-4 mr-1" />
            Exporter HTML
          </Button>

          <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white font-bold">
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Render the printable HTML content */}
      <div className="p-4 sm:p-8 flex justify-center">
        <div 
          className="bg-white shadow-xl rounded-xl overflow-hidden max-w-3xl w-full p-8"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}
