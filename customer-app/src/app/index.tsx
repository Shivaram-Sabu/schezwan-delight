import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, SectionList, TouchableOpacity, SafeAreaView, Platform, StatusBar as RNStatusBar, TextInput, Modal, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useLocalSearchParams } from 'expo-router';

interface MenuItem {
  id: string;
  name: string;
  type: 'veg' | 'non-veg';
  fullPrice: number;
  halfPrice?: number;
  category: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  portion?: 'Half' | 'Full';
  orderType: 'dine-in';
}

export default function CustomerMenu() {
  const { table } = useLocalSearchParams();
  const [tableId, setTableId] = useState('Unknown Table');

  // Aggressive web fallback for QR detection
  useEffect(() => {
    let tableNum = Array.isArray(table) ? table[0] : table;
    if (Platform.OS === 'web' && !tableNum) {
      tableNum = new URLSearchParams(window.location.search).get('table');
    }
    if (tableNum) setTableId(`Table ${tableNum}`);
  }, [table]);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

  // Logo Animation States
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Trigger Logo Animation on Load
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 15,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // 2-Hour Idle Timeout
  const lastActive = useRef(Date.now());
  const updateActivity = () => { lastActive.current = Date.now(); };

  useEffect(() => {
    const idleCheck = setInterval(() => {
      if (Date.now() - lastActive.current > 2 * 60 * 60 * 1000) {
        setCart([]); 
        if (Platform.OS === 'web') window.location.reload(); 
      }
    }, 60000); 
    return () => clearInterval(idleCheck);
  }, []);

  // Fetch Menu
  useEffect(() => {
    const fetchMenu = async () => {
      const q = query(collection(db, 'menu'), where('available', '==', true));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          type: data.type === 'veg' || data.food_type?.toLowerCase() === 'veg' ? 'veg' : 'non-veg',
          fullPrice: data.fullPrice ?? data.price_full ?? data.price ?? 0,
          halfPrice: data.halfPrice ?? data.price_half,
          category: data.category || 'Other'
        };
      }) as MenuItem[];
      
      setMenuItems(fetched);
    };
    fetchMenu();
  }, []);

  const addToCart = (item: MenuItem, portion: 'Half' | 'Full', price: number) => {
    updateActivity();
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.portion === portion);
      if (existing) {
        return prev.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { id: item.id, name: item.name, price, qty: 1, portion, orderType: 'dine-in' }];
    });
  };

  const updateQty = (index: number, delta: number) => {
    updateActivity();
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].qty += delta;
      if (newCart[index].qty <= 0) newCart.splice(index, 1);
      if (newCart.length === 0) setIsCartOpen(false);
      return newCart;
    });
  };

  const placeOrder = async () => {
    if (cart.length === 0 || tableId === 'Unknown Table') return;
    setIsOrdering(true);
    updateActivity();
    
    try {
      await addDoc(collection(db, 'orders'), {
        status: 'PENDING', 
        table_id: tableId,
        wave_total: cartTotal,
        notes: notes.trim(),
        items_json: JSON.stringify(cart),
        createdAt: new Date().toISOString()
      });
      
      setCart([]);
      setNotes('');
      setIsCartOpen(false);
      if (Platform.OS === 'web') window.alert('🎉 Order sent! Waiting for kitchen approval.');
    } catch (error) {
      if (Platform.OS === 'web') window.alert('Error placing order. Please try again.');
    }
    setIsOrdering(false);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const groupedSections = useMemo(() => {
    const filtered = menuItems.filter(item => filter === 'all' || item.type === filter);
    const getCategory = (catName: string) => filtered.filter(i => i.category.toLowerCase() === catName.toLowerCase());

    return [
      { title: '🥣 SOUPS', data: getCategory('Soups') },
      { title: '🥟 STARTERS', data: getCategory('Starters') },
      { title: '🍚 RICE', data: getCategory('Rice') },
      { title: '🍜 NOODLES', data: getCategory('Noodles') },
      { title: '🍽️ OTHER', data: filtered.filter(i => !['soups', 'starters', 'rice', 'noodles'].includes(i.category.toLowerCase())) }
    ].filter(section => section.data.length > 0);
  }, [menuItems, filter]);

  const renderDish = ({ item }: { item: MenuItem }) => (
    <View style={styles.dishCard}>
      <View style={styles.dishInfo}>
        <Text style={styles.dishName}>
          <Text style={{fontSize: 12}}>{item.type === 'veg' ? '🟢 ' : '🔴 '}</Text>
          {item.name}
        </Text>
        <Text style={styles.dishPrices}>
          {item.halfPrice ? `Half: ₹${item.halfPrice} | Full: ₹${item.fullPrice}` : `₹${item.fullPrice}`}
        </Text>
      </View>
      
      <View style={styles.actionColumn}>
        {item.halfPrice ? (
          <>
            <TouchableOpacity style={styles.addBtnSmall} onPress={() => addToCart(item, 'Half', item.halfPrice!)}>
              <Text style={styles.addBtnText}>+ Half</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtnSmall, {marginTop: 6}]} onPress={() => addToCart(item, 'Full', item.fullPrice)}>
              <Text style={styles.addBtnText}>+ Full</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item, 'Full', item.fullPrice)}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} onTouchStart={updateActivity}>
      <StatusBar style="light" />
      
      {/* Animated Header with Match to POS App */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Animated.Image 
            source={require('../../assets/logo.png')} 
            style={[
              styles.logo, 
              { 
                opacity: logoOpacity, 
                transform: [{ scale: logoScale }] 
              }
            ]} 
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>Schezwan</Text>
            <Text style={styles.brandSubtitle}>DELIGHT</Text>
          </View>
        </View>
        <View style={styles.tableBadge}>
          <Text style={styles.tableBadgeText}>📍 {tableId}</Text>
        </View>
      </View>

      <View style={styles.filterStrip}>
        <TouchableOpacity style={[styles.filterBtn, filter === 'all' && styles.activeFilter]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All Menu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter === 'veg' && styles.activeVeg]} onPress={() => setFilter('veg')}>
          <Text style={[styles.filterText, filter === 'veg' && styles.activeFilterText]}>Veg</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter === 'non-veg' && styles.activeNonVeg]} onPress={() => setFilter('non-veg')}>
          <Text style={[styles.filterText, filter === 'non-veg' && styles.activeFilterText]}>Non-Veg</Text>
        </TouchableOpacity>
      </View>

      <SectionList 
        sections={groupedSections}
        keyExtractor={item => item.id} 
        renderItem={renderDish}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
      />

      {cart.length > 0 && !isCartOpen && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCart} onPress={() => { updateActivity(); setIsCartOpen(true); }}>
            <Text style={styles.floatingCartText}>🛒 {cartItemCount} Items | ₹{cartTotal}</Text>
            <Text style={styles.floatingCartText}>View Order ➔</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={isCartOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Order</Text>
              <TouchableOpacity onPress={() => setIsCartOpen(false)}>
                <Text style={styles.closeModalText}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            <SectionList 
              sections={[{ title: 'Items', data: cart }]}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={({ item, index }) => (
                <View style={styles.cartRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemDetail}>{item.portion} · ₹{item.price}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(index, -1)}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(index, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                  </View>
                  <Text style={styles.cartItemTotal}>₹{item.price * item.qty}</Text>
                </View>
              )}
            />

            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Special Instructions:</Text>
              <TextInput 
                style={styles.notesInput}
                placeholder="e.g. Make it spicy, no onion..."
                value={notes}
                onChangeText={setNotes}
                onFocus={updateActivity}
              />
            </View>

            <TouchableOpacity 
              style={[styles.placeOrderBtn, tableId === 'Unknown Table' && styles.disabledBtn]} 
              onPress={placeOrder} 
              disabled={isOrdering || tableId === 'Unknown Table'}
            >
              <Text style={styles.placeOrderText}>
                {tableId === 'Unknown Table' ? 'Scan Table QR to Order' : `Send to Kitchen - ₹${cartTotal}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF6EC', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  
  // Header and Animated Logo Styles
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#141414' },
  brandContainer: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, marginRight: 12, borderRadius: 22, backgroundColor: '#FAF6EC' }, // Background color ensures visibility while bouncing in
  brandTitle: { fontSize: 20, fontWeight: '900', color: '#FAF6EC', lineHeight: 22 },
  brandSubtitle: { fontSize: 10, fontWeight: '800', color: '#C11E1E', letterSpacing: 3 },
  tableBadge: { backgroundColor: '#F0E8D5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  tableBadgeText: { color: '#141414', fontWeight: '800', fontSize: 13 },
  
  filterStrip: { flexDirection: 'row', padding: 12, backgroundColor: '#F0E8D5', borderBottomWidth: 1, borderBottomColor: '#DED3BF' },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#FAF6EC', marginHorizontal: 4, borderWidth: 1, borderColor: '#DED3BF' },
  activeFilter: { backgroundColor: '#141414', borderColor: '#141414' },
  activeVeg: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  activeNonVeg: { backgroundColor: '#C11E1E', borderColor: '#C11E1E' },
  filterText: { fontWeight: '800', color: '#70695E' },
  activeFilterText: { color: '#FAF6EC' },

  sectionHeader: { backgroundColor: '#FAF6EC', paddingVertical: 8, marginTop: 10, marginBottom: 5 },
  sectionHeaderText: { fontSize: 18, fontWeight: '900', color: '#141414', letterSpacing: 1 },

  dishCard: { flexDirection: 'row', backgroundColor: '#FAF6EC', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#DED3BF' },
  dishInfo: { flex: 1, paddingRight: 10, justifyContent: 'center' },
  dishName: { fontSize: 16, fontWeight: '900', color: '#141414', marginBottom: 4 },
  dishPrices: { fontSize: 14, color: '#C11E1E', fontWeight: '800' },
  
  actionColumn: { justifyContent: 'center' },
  addBtn: { backgroundColor: '#F0E8D5', borderWidth: 1, borderColor: '#C11E1E', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  addBtnSmall: { backgroundColor: '#F0E8D5', borderWidth: 1, borderColor: '#C11E1E', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  addBtnText: { color: '#C11E1E', fontWeight: '900', fontSize: 13, textAlign: 'center' },

  floatingCartContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  floatingCart: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#C11E1E', padding: 16, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  floatingCartText: { color: '#FAF6EC', fontSize: 16, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(20, 20, 20, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FAF6EC', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#141414' },
  closeModalText: { color: '#C11E1E', fontWeight: '800', fontSize: 16 },
  
  cartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#DED3BF' },
  cartItemName: { fontSize: 15, fontWeight: '800', color: '#141414' },
  cartItemDetail: { fontSize: 13, color: '#70695E', fontWeight: '600' },
  cartItemTotal: { fontSize: 16, fontWeight: '900', color: '#C11E1E', width: 60, textAlign: 'right' },
  
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0E8D5', borderRadius: 8, borderWidth: 1, borderColor: '#DED3BF', marginRight: 15 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  qtyBtnText: { fontSize: 16, fontWeight: '900', color: '#141414' },
  qtyText: { fontSize: 15, fontWeight: '800', marginHorizontal: 8 },

  notesContainer: { marginBottom: 20, marginTop: 10 },
  notesLabel: { fontSize: 14, fontWeight: '800', color: '#141414', marginBottom: 8 },
  notesInput: { backgroundColor: '#F0E8D5', borderWidth: 1, borderColor: '#DED3BF', borderRadius: 8, padding: 12, fontSize: 14, color: '#141414', fontWeight: '600' },

  placeOrderBtn: { backgroundColor: '#C11E1E', padding: 18, borderRadius: 12, alignItems: 'center' },
  disabledBtn: { backgroundColor: '#70695E' },
  placeOrderText: { color: '#FAF6EC', fontSize: 16, fontWeight: '900' }
});