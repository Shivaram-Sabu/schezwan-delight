import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, Alert, TextInput, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, addDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

interface MenuItem {
  id: string;
  name: string;
  halfPrice?: number;
  fullPrice: number;
  type: 'veg' | 'non-veg';
  available: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  orderType: 'dine-in' | 'parcel';
  portion?: 'Half' | 'Full';
}

const MenuItemCard = ({ item, onAdd }: { item: MenuItem, onAdd: (item: MenuItem, portion: 'Half' | 'Full', price: number) => void }) => {
  const hasHalf = !!item.halfPrice && item.halfPrice > 0;
  const [portion, setPortion] = useState<'Half' | 'Full'>(hasHalf ? 'Half' : 'Full');

  useEffect(() => {
    if (!hasHalf) setPortion('Full');
  }, [hasHalf]);

  const price = portion === 'Half' && hasHalf ? item.halfPrice! : item.fullPrice;

  return (
    <View style={styles.menuItem}>
      <Text style={styles.menuItemText}>
        <Text style={{fontSize: 12}}>{item.type === 'veg' ? '🟢 ' : '🔴 '}</Text>
        {item.name}
      </Text>
      <View style={styles.menuActionRow}>
        
        {hasHalf ? (
          <View style={styles.toggleGroup}>
             <TouchableOpacity style={[styles.toggleBtn, portion === 'Half' && styles.activeToggle]} onPress={() => setPortion('Half')}>
               <Text style={[styles.toggleText, portion === 'Half' && styles.activeToggleText]}>Half</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.toggleBtn, portion === 'Full' && styles.activeToggle]} onPress={() => setPortion('Full')}>
               <Text style={[styles.toggleText, portion === 'Full' && styles.activeToggleText]}>Full</Text>
             </TouchableOpacity>
          </View>
        ) : <View style={{ flex: 1 }} />}
        
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item, portion, price)}>
           <Text style={styles.addBtnText}>Add ₹{price}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function POS() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableId, setTableId] = useState('Reception');
  const [activeTab, setActiveTab] = useState<'veg' | 'non-veg'>('veg');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const extractNumber = (val: any) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.]/g, ''); 
    return Number(cleaned) || 0;
  };

  useEffect(() => {
    const q = query(collection(db, 'menu'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        
        const name = data.name || data.title || '';
        if (!name.trim()) return null;

        const rawFull = data.price_full ?? data.price ?? data.full_price ?? data.rate ?? data.amount ?? 0;
        const fullPrice = extractNumber(rawFull);

        const rawHalf = data.price_half ?? data.half_price ?? data.halfPrice;
        let halfPrice = undefined;
        if (rawHalf !== null && rawHalf !== undefined && rawHalf !== '') {
           const parsed = extractNumber(rawHalf);
           if (parsed > 0) halfPrice = parsed;
        }

        const typeStr = String(data.food_type || data.type || data.category || '').toLowerCase();
        let isVeg = true;
        if (typeStr.includes('non') || typeStr.includes('chicken') || typeStr.includes('mutton') || typeStr.includes('fish') || typeStr.includes('egg') || typeStr.includes('meat') || typeStr === 'non-veg') {
          isVeg = false;
        } else if (data.is_veg === false || data.veg === false) {
          isVeg = false;
        }

        return {
          id: doc.id,
          name: name,
          type: isVeg ? 'veg' : 'non-veg',
          fullPrice: fullPrice,
          ...(halfPrice !== undefined && { halfPrice }),
          available: data.available !== false && data.is_available !== false
        };
      }).filter(Boolean) as MenuItem[]; 
      
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setMenuItems(fetched);
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (item: MenuItem, portion: 'Half' | 'Full', price: number) => {
    setCart(prev => {
      const actualPortion = item.halfPrice ? portion : undefined;
      const existing = prev.find(c => c.id === item.id && c.orderType === 'dine-in' && c.portion === actualPortion);
      
      if (existing) {
        return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price, qty: 1, orderType: 'dine-in', portion: actualPortion }];
    });
  };

  const setOrderType = (index: number, type: 'dine-in' | 'parcel') => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].orderType = type;
      return newCart;
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return Alert.alert("Empty Cart", "Add items before placing order.");
    if (!tableId.trim()) return Alert.alert("Missing Info", "Enter a Table ID or Customer Name.");
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
      await addDoc(collection(db, 'orders'), {
        table_id: tableId,
        wave_number: 1,
        wave_total: total,
        kot_printed: 0,
        status: 'ACTIVE',
        items_json: JSON.stringify(cart),
        wok_notes: 'Placed via Reception',
        createdAt: new Date().toISOString()
      });
      Alert.alert("Success", "Order sent to kitchen!");
      setCart([]);
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not place order.");
    }
  };

  // Filter based on tab, availability, AND search query
  const filteredMenu = menuItems.filter(item => 
    item.type === activeTab && 
    item.available &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Take Order</Text>
      </View>

      <View style={styles.content}>
        <TextInput 
          style={styles.input} 
          value={tableId} 
          onChangeText={setTableId} 
          placeholder="Table Number or Customer Name" 
          placeholderTextColor="#9ca3af"
        />

        <View style={styles.layout}>
          <View style={styles.menuSection}>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput 
                style={styles.searchInput}
                placeholder="Search menu..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'veg' && styles.activeTabVeg]} onPress={() => setActiveTab('veg')}>
                <Text style={[styles.tabText, activeTab === 'veg' && styles.activeTabText]}>🟢 Veg</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeTab === 'non-veg' && styles.activeTabNonVeg]} onPress={() => setActiveTab('non-veg')}>
                <Text style={[styles.tabText, activeTab === 'non-veg' && styles.activeTabText]}>🔴 Non-Veg</Text>
              </TouchableOpacity>
            </View>
            <FlatList 
              data={filteredMenu}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => <MenuItemCard item={item} onAdd={addToCart} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>🍽️</Text>
                  <Text style={styles.emptyText}>{searchQuery ? 'No dishes match your search.' : 'No dishes found in this category.'}</Text>
                </View>
              }
            />
          </View>

          <View style={styles.cartSection}>
            <Text style={styles.subHeader}>Current Bill</Text>
            <FlatList 
              data={cart}
              keyExtractor={(_, index) => index.toString()}
              showsVerticalScrollIndicator={true}
              renderItem={({item, index}) => (
                <View style={styles.cartItem}>
                  <View style={styles.cartItemDetails}>
                    <Text style={styles.cartItemName}>
                      <Text style={{fontWeight: '900', color: '#B82A2B'}}>{item.qty}x </Text>
                      {item.name} {item.portion ? `(${item.portion})` : ''}
                    </Text>
                    <Text style={styles.cartItemPrice}>₹{item.price * item.qty}</Text>
                  </View>
                  
                  <View style={styles.cartActionRow}>
                    <View style={styles.cartToggleGroup}>
                      <TouchableOpacity 
                        style={[styles.cartToggleBtn, item.orderType === 'dine-in' && styles.activeDineInBtn]} 
                        onPress={() => setOrderType(index, 'dine-in')}
                      >
                        <Text style={[styles.cartToggleText, item.orderType === 'dine-in' && styles.activeCartToggleText]}>🍽️ Dine-in</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.cartToggleBtn, item.orderType === 'parcel' && styles.activeParcelBtn]} 
                        onPress={() => setOrderType(index, 'parcel')}
                      >
                        <Text style={[styles.cartToggleText, item.orderType === 'parcel' && styles.activeCartToggleText]}>🎒 Parcel</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                      <Text style={styles.removeIcon}>❌</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyTextCart}>Cart is empty</Text>}
            />
            <TouchableOpacity style={styles.checkoutBtn} onPress={placeOrder}>
              <Text style={styles.checkoutBtnText}>Send to Kitchen • ₹{cart.reduce((sum, item) => sum + (item.price * item.qty), 0)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEFBEF', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f3f1e9', backgroundColor: '#FEFBEF' },
  backBtn: { paddingRight: 15 },
  backBtnText: { color: '#B82A2B', fontSize: 16, fontWeight: '800' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A0E00' },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#fdfbf7' },
  input: { backgroundColor: '#fff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12, fontSize: 15, color: '#1e293b', elevation: 1, shadowOpacity: 0.05 },
  
  layout: { flex: 1, flexDirection: 'column', gap: 12 },
  menuSection: { flex: 1.4 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12, paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
  
  tabContainer: { flexDirection: 'row', marginBottom: 12, backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabVeg: { backgroundColor: '#22c55e', elevation: 1 },
  activeTabNonVeg: { backgroundColor: '#B82A2B', elevation: 1 },
  tabText: { fontWeight: '700', color: '#64748b' },
  activeTabText: { color: '#fff' },
  
  menuItem: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1eee6', elevation: 1 },
  menuItemText: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  menuActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 3, marginRight: 10 },
  toggleBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  activeToggle: { backgroundColor: '#fff', elevation: 1 },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  activeToggleText: { color: '#1e293b' },
  addBtn: { backgroundColor: '#1A0E00', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  
  cartSection: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#f1eee6', elevation: 2, marginBottom: 10 },
  subHeader: { fontSize: 17, fontWeight: '800', color: '#1A0E00', marginBottom: 12 },
  cartItem: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 },
  cartItemDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1, paddingRight: 5 },
  cartItemPrice: { fontSize: 15, fontWeight: '900', color: '#1A0E00' },
  cartActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartToggleGroup: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 3 },
  cartToggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  activeDineInBtn: { backgroundColor: '#0284c7', elevation: 1 },
  activeParcelBtn: { backgroundColor: '#d97706', elevation: 1 },
  cartToggleText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  activeCartToggleText: { color: '#fff' },
  removeBtn: { padding: 5 },
  removeIcon: { fontSize: 14 },
  
  emptyContainer: { alignItems: 'center', marginTop: 30 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: '600', paddingHorizontal: 20 },
  emptyTextCart: { textAlign: 'center', marginTop: 20, color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },
  checkoutBtn: { backgroundColor: '#B82A2B', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  checkoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});