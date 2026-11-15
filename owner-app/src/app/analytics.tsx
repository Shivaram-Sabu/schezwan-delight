import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

interface Order {
  id: string;
  table_id: string;
  wave_total: number;
  status: string;
}

export default function Analytics() {
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', '==', 'COMPLETED'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let revenue = 0;
      
      const orders = snapshot.docs.map(doc => {
        const data = doc.data();
        revenue += (data.wave_total || 0);
        
        return {
          id: doc.id,
          ...data
        } as Order;
      });
      
      setCompletedOrders(orders);
      setTotalRevenue(revenue);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderCardLeft}>
        <Text style={styles.receiptIcon}>🧾</Text>
        <Text style={styles.tableText}>{item.table_id}</Text>
      </View>
      <Text style={styles.revenueText}>+ ₹{item.wave_total}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, styles.revenueBox]}>
            <Text style={styles.statLabelLight}>Total Revenue</Text>
            <Text style={styles.statValueLight}>₹{totalRevenue}</Text>
          </View>
          <View style={[styles.statBox, styles.ordersBox]}>
            <Text style={styles.statLabelDark}>Orders Served</Text>
            <Text style={styles.statValueDark}>{completedOrders.length}</Text>
          </View>
        </View>

        <Text style={styles.subHeader}>Order History</Text>
        
        <FlatList
          data={completedOrders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.empty}>No completed orders yet.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FEFBEF',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 // Fixes the overlapping issue on Android
  },
  
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f1e9',
    backgroundColor: '#FEFBEF'
  },
  backBtn: { paddingRight: 15 },
  backBtnText: { color: '#B82A2B', fontSize: 16, fontWeight: '800' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A0E00' },
  
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#fdfbf7' },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, gap: 12 },
  statBox: { 
    flex: 1, 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  revenueBox: {
    backgroundColor: '#B82A2B',
    borderColor: '#991b1b',
  },
  ordersBox: {
    backgroundColor: '#fff',
    borderColor: '#f1eee6',
  },
  statLabelLight: { color: '#fecaca', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValueLight: { color: '#fff', fontSize: 26, fontWeight: '900' },
  statLabelDark: { color: '#64748b', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValueDark: { color: '#1e293b', fontSize: 26, fontWeight: '900' },
  
  subHeader: { fontSize: 18, fontWeight: '800', color: '#1A0E00', marginBottom: 15 },
  
  orderCard: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 5,
    borderLeftColor: '#B82A2B',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1eee6'
  },
  orderCardLeft: { flexDirection: 'row', alignItems: 'center' },
  receiptIcon: { fontSize: 18, marginRight: 10 },
  tableText: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  revenueText: { fontSize: 16, fontWeight: '900', color: '#22c55e' },
  
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  empty: { color: '#94a3b8', fontSize: 15, fontWeight: '600' }
});