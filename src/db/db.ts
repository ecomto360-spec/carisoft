import Dexie, { type Table } from 'dexie';
import type { 
  CompanySettings, Customer, CustomerFamily, CustomerActivity, Convention, 
  Product, ProductFamily, ProductUnit, ProductPrice, Truck, Driver, 
  Order, OrderItem,
  DeliveryNote, DeliveryNoteItem, Invoice, InvoiceItem, Payment, User,
  LicenseStateRecord
} from '../types';

export class CarisoftDB extends Dexie {
  settings!: Table<CompanySettings, number>;
  customerFamilies!: Table<CustomerFamily, string>;
  customerActivities!: Table<CustomerActivity, string>;
  conventions!: Table<Convention, string>;
  customers!: Table<Customer, string>;
  productFamilies!: Table<ProductFamily, string>;
  productUnits!: Table<ProductUnit, string>;
  products!: Table<Product, string>;
  productPrices!: Table<ProductPrice, string>;
  trucks!: Table<Truck, string>;
  drivers!: Table<Driver, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  deliveryNotes!: Table<DeliveryNote, string>;
  deliveryNoteItems!: Table<DeliveryNoteItem, string>;
  invoices!: Table<Invoice, string>;
  invoiceItems!: Table<InvoiceItem, string>;
  payments!: Table<Payment, string>;
  users!: Table<User, string>;
  licenseState!: Table<LicenseStateRecord, string>;

  constructor() {
    super('CarisoftDB');
    this.version(7).stores({
      settings: 'id, companyId',
      customerFamilies: 'id, name, companyId',
      customerActivities: 'id, name, code, companyId',
      conventions: 'id, familyId, companyId',
      customers: 'id, code, name, familyId, activityId, wilaya, active, companyId',
      productFamilies: 'id, name, companyId',
      productUnits: 'id, code, name, companyId',
      products: 'id, code, name, familyId, active, companyId',
      productPrices: 'id, productId, conventionId, [productId+conventionId], companyId',
      trucks: 'id, matricule, active, companyId',
      drivers: 'id, name, active, companyId',
      orders: 'id, number, date, customerId, status, companyId',
      orderItems: 'id, orderId, productId, companyId',
      deliveryNotes: 'id, number, date, customerId, truckId, status, invoiceId, companyId',
      deliveryNoteItems: 'id, deliveryNoteId, productId, companyId',
      invoices: 'id, number, date, customerId, status, companyId',
      invoiceItems: 'id, invoiceId, productId, companyId',
      payments: 'id, date, customerId, invoiceId, companyId',
      users: 'id, username, email, companyId'
    }).upgrade(tx => {
       // On upgrade, we might want to do something but version bump is enough to create indexes
    });

    // Version 8: High-performance compound indexes for multi-tenant isolation, rapid sorting & sync
    this.version(8).stores({
      customers: 'id, code, name, familyId, activityId, wilaya, active, companyId, [companyId+active], [companyId+name], [companyId+code], [companyId+updatedAt], updatedAt',
      trucks: 'id, matricule, active, companyId, [companyId+active], [companyId+matricule], [companyId+updatedAt], updatedAt',
      drivers: 'id, name, active, companyId, [companyId+active], [companyId+name], [companyId+updatedAt], updatedAt',
      deliveryNotes: 'id, number, date, customerId, truckId, status, invoiceId, companyId, [companyId+date], [companyId+number], [companyId+customerId], [companyId+truckId], [companyId+updatedAt], updatedAt',
      products: 'id, code, name, familyId, active, companyId, [companyId+active], [companyId+name], [companyId+code], [companyId+updatedAt], updatedAt'
    }).upgrade(async tx => {
      const now = new Date().toISOString();
      await tx.table('customers').toCollection().modify((c: any) => {
        if (!c.updatedAt) c.updatedAt = c.createdAt || now;
      });
      await tx.table('trucks').toCollection().modify((t: any) => {
        if (!t.updatedAt) t.updatedAt = t.createdAt || now;
      });
      await tx.table('drivers').toCollection().modify((d: any) => {
        if (!d.updatedAt) d.updatedAt = d.createdAt || now;
      });
      await tx.table('deliveryNotes').toCollection().modify((dn: any) => {
        if (!dn.updatedAt) dn.updatedAt = dn.createdAt || dn.date || now;
      });
    });

    // Version 9: Table licenseState scopée par tenantId pour vérification hors-ligne et anti-triche horloge
    this.version(9).stores({
      licenseState: 'tenantId, key, status, lastSeenAt, [tenantId+status]'
    });
  }
}

export const db = new CarisoftDB();

let currentCompanyId: string | undefined = undefined;

export function setDbTenantId(tenantId: string | undefined) {
  currentCompanyId = tenantId;
}

// Inject companyId and timestamps on all creations & updates
db.on('ready', () => {
  db.tables.forEach(table => {
    // Only apply to tenant-specific tables
    if (table.name !== 'users' && table.name !== 'settings' && table.name !== 'licenseState') {
      table.hook('creating', function (primKey, obj, transaction) {
        if (currentCompanyId && !obj.companyId) {
          obj.companyId = currentCompanyId;
        }
        const now = new Date().toISOString();
        if (!obj.createdAt) {
          obj.createdAt = now;
        }
        if (!obj.updatedAt) {
          obj.updatedAt = now;
        }
      });
      table.hook('updating', function (modifications: any, primKey, obj, transaction) {
        return {
          ...modifications,
          updatedAt: new Date().toISOString()
        };
      });
    }
  });
});

// Ensure default users, settings, product families and units always exist
export async function ensureDefaultUsersAndSettings() {
  try {
    // Ensure product families exist
    const famCount = await db.productFamilies.count();
    if (famCount === 0) {
      await db.productFamilies.bulkPut([
        { id: 'AGREGATS', name: 'AGRÉGATS' },
        { id: 'SABLES', name: 'SABLES & GRAVIERS' },
        { id: 'STERILET', name: 'STÉRILES & REMBLAIS' },
        { id: 'TOUTVENANT', name: 'TOUT-VENANT & BALLAST' },
        { id: 'CONCASSE', name: 'CONCASSÉ SPÉCIAL' }
      ]);
    }

    // Ensure customer activities exist
    const actCount = await db.customerActivities.count();
    if (actCount === 0) {
      await db.customerActivities.bulkPut([
        { id: 'ACT-ETB', code: 'ETB', name: 'ETB (Entreprise Travaux Bâtiment)', description: 'Entreprise générale de bâtiment et génie civil' },
        { id: 'ACT-BETON', code: 'BETON', name: 'Centrale à Béton', description: 'Production et livraison de béton prêt à l\'emploi (BPE)' },
        { id: 'ACT-BATIMENT', code: 'BAT', name: 'Construction Bâtiment', description: 'Entreprise de construction et maçonnerie' },
        { id: 'ACT-TRANSP', code: 'TRANSP', name: 'Transporteur', description: 'Transport et logistique de matériaux' },
        { id: 'ACT-ENROBAGE', code: 'ENROB', name: 'Poste d\'Enrobage', description: 'Centrale d\'enrobé et travaux routiers' },
        { id: 'ACT-TP', code: 'TP', name: 'Travaux Publics (TP & Terrassement)', description: 'Terrassement, voirie et réseaux divers (VRD)' },
        { id: 'ACT-GROSSISTE', code: 'GROSS', name: 'Grossiste & Revendeur Matériaux', description: 'Négoce et distribution d\'agrégats' },
        { id: 'ACT-PART', code: 'PART', name: 'Particulier / Auto-constructeur', description: 'Client privé et chantiers individuels' },
        { id: 'ACT-AUTRE', code: 'AUTRE', name: 'Autre Activité', description: 'Secteur divers' },
      ]);
    }

    // Ensure only Tarif Standard exists and clean up old conventions
    const oldConventions = await db.conventions.toArray();
    const toDeleteIds = oldConventions
      .filter(c => c.id !== 'C_CONV1' || c.name !== 'Tarif Standard')
      .map(c => c.id);
    
    if (toDeleteIds.length > 0) {
      await db.conventions.bulkDelete(toDeleteIds);
    }

    await db.conventions.put({
      id: 'C_CONV1',
      name: 'Tarif Standard',
      description: 'Tarif standard général de vente',
      familyId: 'CONV1'
    });

    // Customer Families
    const oldFamilies = await db.customerFamilies.toArray();
    const toDeleteFamIds = oldFamilies.filter(f => f.id !== 'CONV1').map(f => f.id);
    if (toDeleteFamIds.length > 0) {
      await db.customerFamilies.bulkDelete(toDeleteFamIds);
    }
    await db.customerFamilies.put({ id: 'CONV1', name: 'Tarif Standard' });

    // Reassign any customers to Tarif Standard
    const customersToMigrate = await db.customers.toArray();
    const updates: Promise<any>[] = [];
    customersToMigrate.forEach(c => {
      if (c.familyId !== 'CONV1' || !c.type || c.type.includes('CONV')) {
        updates.push(db.customers.update(c.id, { familyId: 'CONV1', type: 'Tarif Standard' }));
      }
    });
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Ensure measurement units exist
    const unitCount = await db.productUnits.count();
    if (unitCount === 0) {
      await db.productUnits.bulkPut([
        { id: 'U-TONNE', code: 'T', name: 'Tonne', symbol: 'T' },
        { id: 'U-M3', code: 'M3', name: 'Mètre cube (m³)', symbol: 'm³' },
        { id: 'U-VOYAGE', code: 'VOY', name: 'Voyage', symbol: 'Voy' },
        { id: 'U-PIECE', code: 'U', name: 'Pièce / Unité', symbol: 'U' },
        { id: 'U-KG', code: 'KG', name: 'Kilogramme', symbol: 'kg' },
        { id: 'U-LITRE', code: 'L', name: 'Litre', symbol: 'L' }
      ]);
    }

    // Super Admin Account (Owner & SaaS License Issuer)
    const superAdmin = await db.users.get('U0');
    if (!superAdmin || !superAdmin.email || !superAdmin.password) {
      await db.users.put({
        id: 'U0',
        name: 'Super Administrateur SaaS',
        username: 'nabsterzero',
        email: 'nabsterzero@gmail.com',
        password: 'blidsi@0808@',
        role: 'superadmin',
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    const admin = await db.users.get('U1');
    if (!admin || !admin.email || !admin.password) {
      await db.users.put({
        id: 'U1',
        name: 'Administrateur Principal',
        username: 'admin',
        email: 'admin@carisoft.com',
        password: 'admin',
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    const billing = await db.users.get('U2');
    if (!billing || !billing.email || !billing.password) {
      await db.users.put({
        id: 'U2',
        name: 'Responsable Facturation',
        username: 'facturation',
        email: 'facturation@carisoft.com',
        password: 'admin',
        role: 'billing',
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    const settings = await db.settings.get(1);
    if (!settings || !settings.licenseKey) {
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await db.settings.put({
        id: 1,
        name: settings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS',
        activity: settings?.activity || 'Production D\'Agrégats',
        address: settings?.address || 'CITE 150 BT E CAGE 01 N8 EL HACHIMIA .W BOURA',
        rc: settings?.rc || '1000-0284172816',
        nif: settings?.nif || '001610159000652',
        nis: settings?.nis || '001610028417284',
        article: settings?.article || '10150539206',
        bank: settings?.bank || 'BEA 0011005810300000',
        capital: settings?.capital || 1000000,
        phone: settings?.phone || '026 00 00 00',
        email: settings?.email || 'contact@sidar.com',
        tvaRate: settings?.tvaRate || 19,
        timbre: settings?.timbre || 1,
        timbreLimit: settings?.timbreLimit || 2500,
        licenseKey: '',
        licensePlan: 'Non activée',
        licenseExpiry: '',
        licenseStatus: 'none'
      });
    }
  } catch (err) {
    console.error('Error ensuring default users:', err);
  }
}

// Mock data initialization
export async function initDemoData() {
  await ensureDefaultUsersAndSettings();

  const count = await db.customers.count();
  if (count >= 10) return; // Already initialized with full dataset

  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  await db.settings.put({
    id: 1,
    name: 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS',
    activity: 'Production D\'Agrégats',
    address: 'CITE 150 BT E CAGE 01 N8 EL HACHIMIA .W BOURA',
    rc: '1000-0284172816',
    nif: '001610159000652',
    nis: '001610028417284',
    article: '10150539206',
    bank: 'BEA 0011005810300000',
    capital: 1000000,
    phone: '026 00 00 00',
    email: 'contact@sidar.com',
    tvaRate: 19,
    timbre: 1,
    timbreLimit: 2500,
    licenseKey: '',
    licensePlan: 'Non activée',
    licenseExpiry: '',
    licenseStatus: 'none'
  });

  await db.customerFamilies.bulkPut([
    { id: 'CONV1', name: 'Tarif Standard' },
  ]);

  await db.conventions.bulkPut([
    { id: 'C_CONV1', name: 'Tarif Standard', description: 'Tarif standard de vente', familyId: 'CONV1' },
  ]);

  await db.customers.bulkPut([
    { id: 'C1', code: '7', name: 'DEVERS', type: 'CONV1', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV1', tvaExempt: false, balance: 0, active: true },
    { id: 'C2', code: '17', name: 'HAMRI ALI', type: 'CONV6', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '1412999 A 98', nif: '', nis: '', article: '', bank: '', familyId: 'CONV6', tvaExempt: false, balance: 0, active: true },
    { id: 'C3', code: '42', name: 'SARL SOTRACOPHE', type: 'CONV6', address: 'ALGER', phone: '', mobile: '', email: '', rc: '10/00028318B08', nif: '', nis: '', article: '', bank: '', familyId: 'CONV6', tvaExempt: false, balance: -26360.83, active: true },
    { id: 'C4', code: '49', name: 'ETPHB BANOUH AHMED', type: 'CONV4', address: 'TIZI OUZOU', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV4', tvaExempt: false, balance: -295980.45, active: true },
    { id: 'C5', code: '54', name: 'ART ARCHITECTURE ET CONS', type: 'CONV3', address: 'ALGER', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV3', tvaExempt: false, balance: 1381.67, active: true },
    { id: 'C6', code: '56', name: 'ETB DERDAR MOHAMMED AMI', type: 'CONV1', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV1', tvaExempt: false, balance: 0, active: true },
    { id: 'C7', code: '67', name: 'RABAHALLAH RABAH', type: 'CONV6', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV6', tvaExempt: false, balance: -1565417.46, active: true },
    { id: 'C8', code: '68', name: 'SARL RABAHALLAH AREZKI', type: 'CONV8', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV8', tvaExempt: false, balance: -23905.94, active: true },
    { id: 'C9', code: '79', name: 'BELOUZ BELKACEM', type: 'CONV6', address: 'M\'CHEDALLAH', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV6', tvaExempt: false, balance: 10808.35, active: true },
    { id: 'C10', code: '88', name: 'SNC MOHAMED SEGHIR MEZIA', type: 'CONV1', address: 'BEJAIA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV1', tvaExempt: false, balance: -37797.43, active: true },
    { id: 'C11', code: '91', name: 'SNC FRERES NADI AGRIGATS', type: 'CONV2', address: 'SETIF', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV2', tvaExempt: false, balance: 69708.30, active: true },
    { id: 'C12', code: '95', name: 'MR TOUATI AHMED', type: 'CONV4', address: 'SOUR EL GHOZLANE', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV4', tvaExempt: false, balance: 11901.19, active: true },
    { id: 'C13', code: '97', name: 'EGTPHB ZEMOUCHE', type: 'CONV4', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV4', tvaExempt: false, balance: 0, active: true },
    { id: 'C14', code: '104', name: 'SAOUDI DJILLALI', type: 'CONV4', address: 'BOUIRA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV4', tvaExempt: false, balance: -5236.20, active: true },
    { id: 'C15', code: '126', name: 'KHEDDOUCI DALILA', type: 'CONV6', address: 'ALGER', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV6', tvaExempt: false, balance: -1813925.47, active: true },
    { id: 'C16', code: '130', name: 'GUELFAT TAMIME', type: 'CONV4', address: 'BORDJ BOU ARRERIDJ', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV4', tvaExempt: false, balance: -156062.20, active: true },
    { id: 'C17', code: '135', name: 'SNC CHAFAI & CIF', type: 'CONV2', address: 'EL HACHIMIA', phone: '', mobile: '', email: '', rc: '', nif: '', nis: '', article: '', bank: '', familyId: 'CONV2', tvaExempt: false, balance: -298.11, active: true },
  ]);

  await db.productFamilies.bulkPut([
    { id: 'AGREGATS', name: 'AGREGATS' },
    { id: 'STERILET', name: 'STERILET' },
  ]);

  await db.products.bulkPut([
    { id: 'P1', code: 'SABLE0/3', name: 'SABLE 0/3', familyId: 'AGREGATS', unit: 'Tonne', tva: 19, stock: 1000, minStock: 100, active: true },
    { id: 'P2', code: 'GRAV3/8', name: 'GRAVIER 3/8', familyId: 'AGREGATS', unit: 'Tonne', tva: 19, stock: 500, minStock: 100, active: true },
    { id: 'P3', code: 'GRAV8/15', name: 'GRAVIER 8/15', familyId: 'AGREGATS', unit: 'Tonne', tva: 19, stock: 800, minStock: 100, active: true },
    { id: 'P4', code: 'GRAV15/25', name: 'GRAVIER 15/25', familyId: 'AGREGATS', unit: 'Tonne', tva: 19, stock: 650, minStock: 100, active: true },
    { id: 'P5', code: 'STERILE0/25', name: 'STERILE 0/25', familyId: 'STERILET', unit: 'Tonne', tva: 19, stock: 2000, minStock: 500, active: true },
    { id: 'P6', code: 'TOUTVENANT0/40', name: 'TOUT-VENANT 0/40', familyId: 'STERILET', unit: 'Tonne', tva: 19, stock: 1500, minStock: 300, active: true },
  ]);

  await db.productPrices.bulkPut([
    { id: 'PP1', productId: 'P1', conventionId: 'C_CONV1', priceHT: 650 },
    { id: 'PP2', productId: 'P1', conventionId: 'C_CONV2', priceHT: 620 },
    { id: 'PP3', productId: 'P1', conventionId: 'C_CONV3', priceHT: 600 },
    { id: 'PP4', productId: 'P1', conventionId: 'C_CONV4', priceHT: 590 },
    { id: 'PP5', productId: 'P1', conventionId: 'C_CONV6', priceHT: 580 },
    { id: 'PP6', productId: 'P1', conventionId: 'C_CONV8', priceHT: 570 },
    { id: 'PP7', productId: 'P1', conventionId: 'C_DIVERS', priceHT: 700 },
    { id: 'PP8', productId: 'P2', conventionId: 'C_CONV1', priceHT: 380 },
    { id: 'PP9', productId: 'P2', conventionId: 'C_CONV2', priceHT: 350 },
    { id: 'PP10', productId: 'P2', conventionId: 'C_DIVERS', priceHT: 410 },
    { id: 'PP11', productId: 'P3', conventionId: 'C_CONV1', priceHT: 420 },
    { id: 'PP12', productId: 'P4', conventionId: 'C_CONV1', priceHT: 400 },
    { id: 'PP13', productId: 'P5', conventionId: 'C_CONV1', priceHT: 270 },
  ]);

  await db.drivers.bulkPut([
    { id: 'D1', name: 'MAHDI HICHEME', phone: '0550000001', active: true },
    { id: 'D2', name: 'GESSABI HAMID', phone: '0550000002', active: true },
    { id: 'D3', name: 'BOUKERMA SAMIR', phone: '0550000003', active: true },
    { id: 'D4', name: 'SALHI SAID', phone: '0550000004', active: true },
    { id: 'D5', name: 'BOUKAROU ALI', phone: '0550000005', active: true },
    { id: 'D6', name: 'OUADI KAMEL', phone: '0550000006', active: true },
    { id: 'D7', name: 'HADJI MOHAMED', phone: '0550000007', active: true },
    { id: 'D8', name: 'KADER BITON', phone: '0550000008', active: true },
    { id: 'D9', name: 'CHELLALI A E K', phone: '0550000009', active: true },
    { id: 'D10', name: 'MERABT FETEH', phone: '0550000010', active: true },
    { id: 'D11', name: 'SARL OMNIA', phone: '0550000011', active: true },
    { id: 'D12', name: 'CAMION SIDAR CHACMAN', phone: '0550000012', active: true },
    { id: 'D13', name: 'BENDAOUI NACER', phone: '0550000013', active: true },
    { id: 'D14', name: 'AMRANE BRAHIM', phone: '0550000014', active: true },
    { id: 'D15', name: 'AMIRAR OUAHAB', phone: '0550000015', active: true },
    { id: 'D16', name: 'HAWATI BRAHIM', phone: '0550000016', active: true },
    { id: 'D17', name: 'ABDONI KHALED', phone: '0550000017', active: true },
    { id: 'D18', name: 'BEN HAMADECH AMAINE', phone: '0550000018', active: true },
    { id: 'D19', name: 'SID ALI RAHMOUNE', phone: '0550000019', active: true },
    { id: 'D20', name: 'NOURINE ABDERRAHMANE', phone: '0550000020', active: true },
    { id: 'D21', name: 'BOUDABZA KAMEL', phone: '0550000021', active: true },
    { id: 'D22', name: 'KRIM FATEH', phone: '0550000022', active: true },
    { id: 'D23', name: 'DAIF AMAR', phone: '0550000023', active: true },
    { id: 'D24', name: 'MAHDI', phone: '0550000024', active: true },
    { id: 'D25', name: 'NOURINE BOUALEM', phone: '0550000025', active: true },
    { id: 'D26', name: 'SARL AMINO', phone: '0550000026', active: true },
    { id: 'D27', name: 'BEN ISMAIL', phone: '0550000027', active: true },
    { id: 'D28', name: 'HASSAN', phone: '0550000028', active: true },
    { id: 'D29', name: 'AIACHE ADEL', phone: '0550000029', active: true },
  ]);

  await db.trucks.bulkPut([
    { id: 'T1', matricule: '0000822526', tare: 14.64, mnTonne: 0, volumeM3: 18, driverName: 'MAHDI HICHEME', driverPhone: '0550000001', driverId: 'D1', allowDiscount: false, active: true },
    { id: 'T2', matricule: '0007252535', tare: 17.38, mnTonne: 0, volumeM3: 20, driverName: 'GESSABI HAMID', driverPhone: '0550000002', driverId: 'D2', allowDiscount: false, active: true },
    { id: 'T3', matricule: '0011022315', tare: 16.58, mnTonne: 0, volumeM3: 18, driverName: 'BOUKERMA SAMIR', driverPhone: '0550000003', driverId: 'D3', allowDiscount: false, active: true },
    { id: 'T4', matricule: '0011121635', tare: 13.76, mnTonne: 0, volumeM3: 16, driverName: 'SALHI SAID', driverPhone: '0550000004', driverId: 'D4', allowDiscount: false, active: true },
    { id: 'T5', matricule: '0012351716', tare: 14.82, mnTonne: 0, volumeM3: 18, driverName: 'BOUKAROU ALI', driverPhone: '0550000005', driverId: 'D5', allowDiscount: false, active: true },
    { id: 'T6', matricule: '0016022416', tare: 16.44, mnTonne: 0, volumeM3: 18, driverName: 'OUADI KAMEL', driverPhone: '0550000006', driverId: 'D6', allowDiscount: false, active: true },
    { id: 'T7', matricule: '0018722526', tare: 15.80, mnTonne: 0, volumeM3: 18, driverName: 'HADJI MOHAMED', driverPhone: '0550000007', driverId: 'D7', allowDiscount: false, active: true },
    { id: 'T8', matricule: '0018851635', tare: 18.36, mnTonne: 0, volumeM3: 22, driverName: 'KADER BITON', driverPhone: '0550000008', driverId: 'D8', allowDiscount: false, active: true },
    { id: 'T9', matricule: '0018950910', tare: 16.32, mnTonne: 0, volumeM3: 18, driverName: 'CHELLALI A E K', driverPhone: '0550000009', driverId: 'D9', allowDiscount: false, active: true },
    { id: 'T10', matricule: '0019721310', tare: 11.60, mnTonne: 0, volumeM3: 14, driverName: 'MERABT FETEH', driverPhone: '0550000010', driverId: 'D10', allowDiscount: false, active: true },
    { id: 'T11', matricule: '0020121635', tare: 11.60, mnTonne: 0, volumeM3: 14, driverName: 'SARL OMNIA', driverPhone: '0550000011', driverId: 'D11', allowDiscount: false, active: true },
    { id: 'T12', matricule: '0000000000', tare: 15.94, mnTonne: 0, volumeM3: 18, driverName: 'CAMION SIDAR CHACMAN', driverPhone: '0550000012', driverId: 'D12', allowDiscount: false, active: true },
    { id: 'T13', matricule: '0000121735', tare: 13.58, mnTonne: 0, volumeM3: 16, driverName: 'BENDAOUI NACER', driverPhone: '0550000013', driverId: 'D13', allowDiscount: false, active: true },
    { id: 'T14', matricule: '0000151416', tare: 14.56, mnTonne: 0, volumeM3: 16, driverName: 'AMRANE BRAHIM', driverPhone: '0550000014', driverId: 'D14', allowDiscount: false, active: true },
    { id: 'T15', matricule: '0000251835', tare: 15.98, mnTonne: 0, volumeM3: 18, driverName: 'AMIRAR OUAHAB', driverPhone: '0550000015', driverId: 'D15', allowDiscount: false, active: true },
    { id: 'T16', matricule: '0000451216', tare: 14.54, mnTonne: 0, volumeM3: 16, driverName: 'HAWATI BRAHIM', driverPhone: '0550000016', driverId: 'D16', allowDiscount: false, active: true },
    { id: 'T17', matricule: '0000521035', tare: 11.62, mnTonne: 0, volumeM3: 12, driverName: 'ABDONI KHALED', driverPhone: '0550000017', driverId: 'D17', allowDiscount: false, active: true },
    { id: 'T18', matricule: '0000551635', tare: 15.54, mnTonne: 0, volumeM3: 18, driverName: 'BEN HAMADECH AMAINE', driverPhone: '0550000018', driverId: 'D18', allowDiscount: false, active: true },
    { id: 'T19', matricule: '0000621216', tare: 13.22, mnTonne: 0, volumeM3: 16, driverName: 'SID ALI RAHMOUNE', driverPhone: '0550000019', driverId: 'D19', allowDiscount: false, active: true },
    { id: 'T20', matricule: '0000621416', tare: 11.84, mnTonne: 0, volumeM3: 14, driverName: 'NOURINE ABDERRAHMANE', driverPhone: '0550000020', driverId: 'D20', allowDiscount: false, active: true },
    { id: 'T21', matricule: '0000621516', tare: 13.74, mnTonne: 0, volumeM3: 16, driverName: 'BOUDABZA KAMEL', driverPhone: '0550000021', driverId: 'D21', allowDiscount: false, active: true },
    { id: 'T22', matricule: '0000651535', tare: 16.16, mnTonne: 0, volumeM3: 18, driverName: 'KRIM FATEH', driverPhone: '0550000022', driverId: 'D22', allowDiscount: false, active: true },
    { id: 'T23', matricule: '0000651635', tare: 19.16, mnTonne: 0, volumeM3: 24, driverName: 'DAIF AMAR', driverPhone: '0550000023', driverId: 'D23', allowDiscount: false, active: true },
    { id: 'T24', matricule: '0000721216', tare: 11.74, mnTonne: 0, volumeM3: 14, driverName: 'MAHDI', driverPhone: '0550000024', driverId: 'D24', allowDiscount: false, active: true },
    { id: 'T25', matricule: '0000721416', tare: 11.76, mnTonne: 0, volumeM3: 14, driverName: 'NOURINE BOUALEM', driverPhone: '0550000025', driverId: 'D25', allowDiscount: false, active: true },
    { id: 'T26', matricule: '0000750735', tare: 13.92, mnTonne: 0, volumeM3: 16, driverName: 'SARL AMINO', driverPhone: '0550000026', driverId: 'D26', allowDiscount: false, active: true },
    { id: 'T27', matricule: '0000751635', tare: 19.18, mnTonne: 0, volumeM3: 24, driverName: 'BEN ISMAIL', driverPhone: '0550000027', driverId: 'D27', allowDiscount: false, active: true },
    { id: 'T28', matricule: '0000752036', tare: 16.54, mnTonne: 0, volumeM3: 18, driverName: 'HASSAN', driverPhone: '0550000028', driverId: 'D28', allowDiscount: false, active: true },
    { id: 'T29', matricule: '0000820716', tare: 11.54, mnTonne: 0, volumeM3: 14, driverName: 'AIACHE ADEL', driverPhone: '0550000029', driverId: 'D29', allowDiscount: false, active: true },
  ]);

  await db.users.bulkPut([
    { 
      id: 'U0', 
      name: 'Super Administrateur SaaS', 
      username: 'nabsterzero', 
      email: 'nabsterzero@gmail.com', 
      password: 'blidsi@0808@', 
      role: 'superadmin', 
      active: true,
      createdAt: new Date().toISOString()
    },
    { 
      id: 'U1', 
      name: 'Administrateur Principal', 
      username: 'admin', 
      email: 'admin@carisoft.com', 
      password: 'admin', 
      role: 'admin', 
      active: true,
      createdAt: new Date().toISOString()
    },
    { 
      id: 'U2', 
      name: 'Responsable Facturation', 
      username: 'facturation', 
      email: 'facturation@carisoft.com', 
      password: 'admin', 
      role: 'billing', 
      active: true,
      createdAt: new Date().toISOString()
    },
  ]);

  // Initial Sample Deliveries, Invoices & Payments for realistic quarry dashboard
  const delCount = await db.deliveryNotes.count();
  if (delCount === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

    await db.deliveryNotes.bulkPut([
      {
        id: 'BL-001',
        number: 'BL-2026-0001',
        date: today,
        customerId: 'C2', // HAMRI ALI
        truckId: 'T1',
        driverId: 'D1',
        destination: 'Chantier Bouira Centre',
        grossWeight: 42.50,
        tare: 15.94,
        netWeight: 26.56,
        totalHT: 17264,
        totalTVA: 3280.16,
        totalTTC: 20544.16,
        status: 'validated'
      },
      {
        id: 'BL-002',
        number: 'BL-2026-0002',
        date: today,
        customerId: 'C3', // SARL SOTRACOPHE
        truckId: 'T2',
        driverId: 'D2',
        destination: 'Projet Autoroute Est-Ouest',
        grossWeight: 38.80,
        tare: 13.58,
        netWeight: 25.22,
        totalHT: 15636.40,
        totalTVA: 2970.92,
        totalTTC: 18607.32,
        status: 'validated'
      },
      {
        id: 'BL-003',
        number: 'BL-2026-0003',
        date: yesterday,
        customerId: 'C2',
        truckId: 'T1',
        driverId: 'D1',
        destination: 'Dépôt Sidi Aich',
        grossWeight: 44.10,
        tare: 15.94,
        netWeight: 28.16,
        totalHT: 18304,
        totalTVA: 3477.76,
        totalTTC: 21781.76,
        status: 'invoiced',
        invoiceId: 'FAC-001'
      },
      {
        id: 'BL-004',
        number: 'BL-2026-0004',
        date: twoDaysAgo,
        customerId: 'C1', // DIVERS
        truckId: 'T2',
        driverId: 'D2',
        destination: 'El Hachimia',
        grossWeight: 35.20,
        tare: 13.58,
        netWeight: 21.62,
        totalHT: 15134,
        totalTVA: 2875.46,
        totalTTC: 18009.46,
        status: 'validated'
      }
    ]);

    await db.deliveryNoteItems.bulkPut([
      { id: 'BLI-1', deliveryNoteId: 'BL-001', productId: 'P1', quantity: 26.56, priceHT: 650, totalHT: 17264 },
      { id: 'BLI-2', deliveryNoteId: 'BL-002', productId: 'P1', quantity: 25.22, priceHT: 620, totalHT: 15636.40 },
      { id: 'BLI-3', deliveryNoteId: 'BL-003', productId: 'P1', quantity: 28.16, priceHT: 650, totalHT: 18304 },
      { id: 'BLI-4', deliveryNoteId: 'BL-004', productId: 'P1', quantity: 21.62, priceHT: 700, totalHT: 15134 },
    ]);

    await db.invoices.bulkPut([
      {
        id: 'FAC-001',
        number: 'FAC-2026-0001',
        date: yesterday,
        customerId: 'C2',
        totalHT: 18304,
        totalTVA: 3477.76,
        timbre: 183.04,
        totalTTC: 21964.80,
        status: 'validated',
        paymentMode: 'Virement bancaire'
      }
    ]);

    await db.payments.bulkPut([
      {
        id: 'PAY-001',
        date: today,
        customerId: 'C2',
        invoiceId: 'FAC-001',
        amount: 20000,
        mode: 'virement',
        reference: 'VIR-BEA-78942'
      }
    ]);
  }
}

export async function resetToDemoData() {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
  await ensureDefaultUsersAndSettings();
  await initDemoData();
}
