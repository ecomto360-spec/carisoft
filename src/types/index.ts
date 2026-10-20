export interface CompanySettings {
  id: number;
  name: string;
  activity: string;
  address: string;
  city?: string;
  wilaya?: string;
  rc: string;
  nif: string;
  nis: string;
  article: string;
  bank: string;
  capital: number;
  phone: string;
  email: string;
  logoUrl?: string;
  logo?: string;
  tvaRate: number;
  timbre: number;
  timbreLimit: number;
  licenseKey?: string;
  licenseExpiry?: string;
  licensePlan?: string;
  licenseStatus?: 'active' | 'expired';
}

export interface CustomerFamily {
  id: string; // e.g. CONV1, DIVERS
  name: string;
  companyId?: string;
}

export interface CustomerActivity {
  id: string;
  name: string;
  code?: string;
  description?: string;
  companyId?: string;
}

export interface Convention {
  id: string;
  name: string;
  description: string;
  familyId: string;
  companyId?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  activityId?: string;
  activityName?: string;
  wilaya?: string;
  wilayaCode?: string;
  city?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  article?: string;
  bank?: string;
  familyId: string;
  tvaExempt: boolean;
  hidePricesOnDeliveryNote?: boolean;
  initialDebt?: number;
  initialBalance?: number;
  creditLimit?: number;
  balance: number;
  favoriteTruckIds?: string[];
  lastTruckId?: string;
  customPrices?: Record<string, number>;
  active: boolean;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductFamily {
  id: string;
  name: string;
  companyId?: string;
}

export interface ProductUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  companyId?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  familyId: string;
  unit: string;
  tva: number;
  stock: number;
  minStock: number;
  active: boolean;
  defaultPrice?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductPrice {
  id: string;
  productId: string;
  conventionId: string;
  priceHT: number;
  companyId?: string;
}

export interface Truck {
  id: string;
  matricule: string;
  tare: number;
  mnTonne?: number;
  volumeM3?: number;
  driverName?: string;
  driverPhone?: string;
  driverId?: string;
  driverLicense?: string;
  driverNotes?: string;
  allowDiscount?: boolean;
  isFavorite?: boolean;
  imageUrl?: string;
  brand?: string;
  active: boolean;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  number: string;
  date: string;
  customerId: string;
  truckId?: string;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  status: 'draft' | 'confirmed' | 'delivered' | 'cancelled';
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
  companyId?: string;
}

export interface DeliveryNote {
  id: string;
  number: string;
  date: string;
  customerId: string;
  truckId: string;
  driverId?: string;
  destination?: string;
  remarks?: string;
  paymentMode?: string;
  discount?: number;
  taxType?: 'HT' | 'TTC';
  time?: string;
  grossWeight: number; // Poids Brut
  tare: number;        // Tare
  netWeight: number;   // Poids Net
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  status: 'draft' | 'validated' | 'invoiced' | 'cancelled';
  invoiceId?: string;
  orderId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryNoteItem {
  id: string;
  deliveryNoteId: string;
  productId: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
  companyId?: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  customerId: string;
  orderId?: string; // Optionnel : Lié à un bon de commande
  orderNumber?: string;
  totalHT: number;
  totalTVA: number;
  timbre: number;
  totalTTC: number;
  status: 'draft' | 'validated' | 'paid' | 'cancelled';
  type?: 'standard' | 'avoir'; // Facture normale ou Facture d'avoir
  paymentMode: string;
  companyId?: string;
  cancelReason?: string; // Motif d'annulation obligatoire
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  customerRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  customDesignation?: string;
  unit?: string;
  quantity: number;
  priceHT: number;
  discountPercent?: number;
  tvaRate?: number;
  totalHT: number;
  totalTTC?: number;
  companyId?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'manager' | 'billing' | 'viewer';
  companyId?: string;
  active: boolean;
  createdAt?: string;
}

export interface Payment {
  id: string;
  date: string;
  customerId: string;
  invoiceId?: string;
  deliveryNoteId?: string;
  amount: number;
  mode: 'especes' | 'cheque' | 'virement' | 'cheque_ccp' | 'carte' | 'autre' | string;
  reference?: string;
  notes?: string;
  companyId?: string;
}

export interface LicenseRecord {
  key: string;
  tenantId: string;
  durationDays: number;
  maxMachines: number;
  status: 'unused' | 'active' | 'expired' | 'revoked';
  machineId: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface LicenseTokenPayload {
  key: string;
  tenantId: string;
  machineId: string;
  activatedAt: string;
  expiresAt: string;
}

export interface LicenseStateRecord {
  tenantId: string;
  key: string;
  token: string;
  payload: LicenseTokenPayload;
  signature: string;
  lastSeenAt: number;
  status: 'active' | 'expired' | 'revoked' | 'invalid' | 'tampered';
  updatedAt?: string;
}

export * from './saas';
