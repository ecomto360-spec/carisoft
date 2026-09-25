export interface CompanySettings {
  id: number;
  name: string;
  activity: string;
  address: string;
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
  creditLimit?: number;
  balance: number;
  active: boolean;
  companyId?: string;
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
  companyId?: string;
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
  allowDiscount?: boolean;
  isFavorite?: boolean;
  imageUrl?: string;
  brand?: string;
  active: boolean;
  companyId?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  companyId?: string;
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
  totalHT: number;
  totalTVA: number;
  timbre: number;
  totalTTC: number;
  status: 'draft' | 'validated' | 'paid' | 'cancelled';
  paymentMode: string;
  companyId?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
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
export * from './saas';
