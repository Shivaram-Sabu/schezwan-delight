import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, Alert, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  orderType?: 'dine-in' | 'parcel';
  portion?: 'Half' | 'Full';
}

interface Order {
  id: string;
  table_id: string;
  wave_total: number;
  status: string;
  items_json: string;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Listen for ACTIVE orders in real-time
    const q = query(collection(db, 'orders'), where('status', '==', 'ACTIVE'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(fetchedOrders);
    });
    
    return () => unsubscribe();
  }, []);

  const closeBill = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'COMPLETED' });
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert("Error: Could not close bill.");
      } else {
        Alert.alert("Error", "Could not close bill.");
      }
    }
  };

  const removeIndividualItem = async (orderId: string, itemsJson: string, indexToRemove: number) => {
    try {
      const items: CartItem[] = JSON.parse(itemsJson);
      items.splice(indexToRemove, 1);
      
      const newTotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      
      if (items.length === 0) {
        await deleteDoc(doc(db, 'orders', orderId)); // Delete order if empty
      } else {
        await updateDoc(doc(db, 'orders', orderId), {
          items_json: JSON.stringify(items),
          wave_total: newTotal
        });
      }
    } catch (error) {
      console.error("Error removing item", error);
    }
  };

  const renderOrder = ({ item }: { item: Order }) => {
    let parsedItems: CartItem[] = [];
    try {
      parsedItems = JSON.parse(item.items_json || '[]');
    } catch (e) {
      console.error("Error parsing items", e);
    }

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderCardHeader}>
          <Text style={styles.tableIdText}>📍 {item.table_id}</Text>
          <Text style={styles.totalText}>₹{item.wave_total}</Text>
        </View>

        <View style={styles.itemsContainer}>
          {parsedItems.length > 0 ? (
            parsedItems.map((food, index) => (
              <View key={index} style={styles.dishRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dishName}>
                    <Text style={styles.dishQty}>{food.qty}x </Text>
                    {food.name} {food.portion ? `(${food.portion})` : ''}
                  </Text>
                  
                  {food.orderType && (
                    <Text style={[styles.typeBadgeText, { color: food.orderType === 'parcel' ? '#d97706' : '#0284c7' }]}>
                      {food.orderType === 'parcel' ? '🎒 PARCEL' : '🍽️ DINE-IN'}
                    </Text>
                  )}
                </View>
                
                <TouchableOpacity onPress={() => removeIndividualItem(item.id, item.items_json, index)} style={styles.removeBtn}>
                  <Text style={styles.removeIcon}>❌</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyItems}>No items found</Text>
          )}
        </View>

        <View style={styles.orderCardFooter}>
          <TouchableOpacity style={styles.serveBtn} onPress={() => closeBill(item.id)}>
            <Text style={styles.serveBtnText}>🍽️ Serve / Close Bill</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>Schzewan</Text>
          <Text style={styles.brandSubtitle}>DELIGHT</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>🟢 Active</Text>
        </View>
      </View>
      
      <View style={styles.navStrip}>
        <TouchableOpacity 
          style={[styles.navBtn, { borderLeftColor: '#3b82f6' }]}
          onPress={() => router.push('/pos')}
        >
          <Text style={styles.navBtnText}>🛒 Take Order</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navBtn, { borderLeftColor: '#22c55e' }]}
          onPress={() => router.push('/menu')}
        >
          <Text style={styles.navBtnText}>📋 Menu</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navBtn, { borderLeftColor: '#f59e0b' }]}
          onPress={() => router.push('/analytics')}
        >
          <Text style={styles.navBtnText}>📊 Analytics</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.feedContainer}>
        <Text style={styles.feedTitle}>⚡ Live Kitchen Orders</Text>
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderOrder}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>🥢</Text>
              <Text style={styles.emptyDesc}>Kitchen is peaceful! No active orders.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FEFBEF', 
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 
  },
  
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 16, paddingVertical: 15, backgroundColor: '#FEFBEF', 
    borderBottomWidth: 1, borderBottomColor: '#f3f1e9',
  },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#1A0E00' },
  brandSubtitle: { fontSize: 11, fontWeight: '800', color: '#B82A2B', letterSpacing: 3 },
  liveBadge: { backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  liveBadgeText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },

  navStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fcfaf5' },
  navBtn: { flex: 1, alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, borderRadius: 8, elevation: 1, borderLeftWidth: 4 },
  navBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },

  feedContainer: { flex: 1, paddingHorizontal: 14, paddingTop: 8, backgroundColor: '#fdfbf7' },
  feedTitle: { fontSize: 17, fontWeight: '800', color: '#1A0E00', marginBottom: 12 },

  orderCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#f1eee6', elevation: 2 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#FCF9F2', borderBottomWidth: 1, borderBottomColor: '#f6f4ed' },
  tableIdText: { fontSize: 16, fontWeight: '900', color: '#1A0E00' },
  totalText: { fontSize: 16, fontWeight: '900', color: '#22c55e' },
  
  itemsContainer: { padding: 12 },
  dishRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  dishName: { fontSize: 15, color: '#334155', fontWeight: '600' },
  dishQty: { fontWeight: '900', color: '#B82A2B' },
  typeBadgeText: { fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  removeBtn: { padding: 5 },
  removeIcon: { fontSize: 14 },
  emptyItems: { color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 },
  
  orderCardFooter: { padding: 10, borderTopWidth: 1, borderTopColor: '#f6f4ed', alignItems: 'flex-end' },
  serveBtn: { backgroundColor: '#B82A2B', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  serveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  centered: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyDesc: { color: '#94a3b8', fontWeight: '600' }
});