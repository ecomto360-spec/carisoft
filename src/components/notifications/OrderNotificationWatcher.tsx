import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useNotificationStore } from '../../store/notificationStore';

const STORAGE_KNOWN_ORDERS = 'carisoft_known_orders_set';

function getStoredKnownOrders(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KNOWN_ORDERS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {
    console.error('Failed to parse known orders', e);
  }
  return new Set();
}

function saveStoredKnownOrders(set: Set<string>) {
  try {
    // Keep up to 500 recent order IDs in storage to prevent memory explosion
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(STORAGE_KNOWN_ORDERS, JSON.stringify(arr));
  } catch (e) {
    console.warn('Failed to save known orders', e);
  }
}

export function OrderNotificationWatcher() {
  const orders = useLiveQuery(() => db.orders.toArray());
  const notifyNewOrder = useNotificationStore((s) => s.notifyNewOrder);
  const isInitializedRef = useRef<boolean>(false);
  const knownOrdersRef = useRef<Set<string>>(getStoredKnownOrders());

  useEffect(() => {
    if (!orders) return;

    // First run in this session
    if (!isInitializedRef.current) {
      const stored = knownOrdersRef.current;
      
      // If we had no stored IDs at all, initialize with all current IDs
      // to avoid notifying all existing past records on first launch.
      if (stored.size === 0) {
        orders.forEach((o) => stored.add(o.id));
        saveStoredKnownOrders(stored);
      } else {
        // We already had some known IDs, add all existing to avoid duplicate alerts
        orders.forEach((o) => stored.add(o.id));
        saveStoredKnownOrders(stored);
      }

      isInitializedRef.current = true;
      return;
    }

    // Subsequent updates: detect new orders!
    const newOrders = orders.filter((o) => !knownOrdersRef.current.has(o.id));

    if (newOrders.length > 0) {
      newOrders.forEach(async (order) => {
        knownOrdersRef.current.add(order.id);
        saveStoredKnownOrders(knownOrdersRef.current);

        let customerName = '';
        try {
          if (order.customerId) {
            const customer = await db.customers.get(order.customerId);
            if (customer) {
              customerName = customer.name;
            }
          }
        } catch (e) {
          console.warn('Failed to resolve customer for order notification', e);
        }

        notifyNewOrder({
          id: order.id,
          number: order.number,
          customerName: customerName || undefined,
          amount: order.totalTTC || 0,
        });
      });
    }
  }, [orders, notifyNewOrder]);

  return null;
}
