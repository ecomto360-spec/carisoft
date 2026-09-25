import { collection, query, where, addDoc, setDoc, doc, DocumentData, WithFieldValue, Query, CollectionReference, DocumentReference, getDocs, onSnapshot, getDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useAuthStore } from '../store/authStore';

export const getScopedTenantId = (): string => {
  const user = useAuthStore.getState().user;
  return user?.companyId || '';
};

// 1. Scoped Query Wrapper
export const scopedQuery = (collectionName: string, ...queryConstraints: any[]): Query<DocumentData> => {
  const tenantId = getScopedTenantId();
  const collRef = collection(firestore, collectionName);
  
  if (useAuthStore.getState().isSuperAdmin) {
     return query(collRef, ...queryConstraints);
  }

  // Force tenantId filter
  return query(collRef, where('companyId', '==', tenantId), ...queryConstraints);
};

// 2. Scoped addDoc Wrapper
export const scopedAddDoc = async (collectionName: string, data: WithFieldValue<DocumentData>) => {
  const tenantId = getScopedTenantId();
  const payload = {
    ...data,
    companyId: tenantId
  };
  return addDoc(collection(firestore, collectionName), payload);
};

// 3. Scoped setDoc Wrapper
export const scopedSetDoc = async (docRef: DocumentReference<DocumentData>, data: WithFieldValue<DocumentData>, options?: { merge?: boolean }) => {
  const tenantId = getScopedTenantId();
  const payload = {
    ...data,
    companyId: tenantId
  };
  return options ? setDoc(docRef, payload, options) : setDoc(docRef, payload);
};
