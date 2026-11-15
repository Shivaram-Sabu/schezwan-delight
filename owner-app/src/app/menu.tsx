import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, SafeAreaView, Alert, Switch, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

interface MenuItem {
  id: string;
  name: string;
  type: 'veg' | 'non-veg';
  fullPrice: number;
  halfPrice?: number;
  available: boolean;
}

export default function MenuManager() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'veg' | 'non-veg'>('all');
  const router = useRouter();

  // Add Dish States
  const [name, setName] = useState('');
  const [type, setType] = useState<'veg' | 'non-veg'>('veg');
  const [hasHalfPortion, setHasHalfPortion] = useState(false);
  const [fullPrice, setFullPrice] = useState('');
  const [halfPrice, setHalfPrice] = useState('');

  // Inline Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullPrice, setEditFullPrice] = useState('');
  const [editHalfPrice, setEditHalfPrice] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'menu'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Python Script Fallback Logic
        let resolvedFullPrice = 0;
        if (data.price_full !== undefined && data.price_full !== null) {
          resolvedFullPrice = Number(data.price_full);
        } else if (data.price !== undefined && data.price !== null) {
          resolvedFullPrice = Number(data.price);
        } else if (data.fullPrice !== undefined && data.fullPrice !== null) {
          resolvedFullPrice = Number(data.fullPrice);
        }

        let resolvedHalfPrice = undefined;
        if (data.price_half !== undefined && data.price_half !== null && data.price_half !== "") {
          resolvedHalfPrice = Number(data.price_half);
        } else if (data.halfPrice !== undefined && data.halfPrice !== null && data.halfPrice !== "") {
          resolvedHalfPrice = Number(data.halfPrice);
        }

        return {
          id: doc.id,
          name: data.name || 'Unknown',
          type: data.type === 'veg' || data.food_type?.toLowerCase() === 'veg' ? 'veg' : 'non-veg',
          fullPrice: resolvedFullPrice,
          ...(resolvedHalfPrice && { halfPrice: resolvedHalfPrice }),
          available: data.available !== false 
        };
      }) as MenuItem[];
      
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setMenuItems(fetched);
    });
    return () => unsubscribe();
  }, []);

  const handleAddDish = async () => {
    if (!name.trim() || !fullPrice.trim()) return Alert.alert("Missing Fields", "Please enter a dish name and full price.");
    if (hasHalfPortion && !halfPrice.trim()) return Alert.alert("Missing Fields", "Please enter a half price.");

    const newDish = {
      name: name.trim(),
      food_type: type === 'veg' ? 'Veg' : 'Non-Veg',
      price: Number(fullPrice),
      price_full: Number(fullPrice),
      price_half: hasHalfPortion ? Number(halfPrice) : null,
      available: true,
      category: "Added via App",
      description: ""
    };

    try {
      await addDoc(collection(db, 'menu'), newDish);
      Alert.alert("Success", `${name} added to the live menu!`);
      setName(''); setFullPrice(''); setHalfPrice(''); setHasHalfPortion(false);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not add dish.");
    }
  };

  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'menu', id), { available: !currentStatus });
    } catch (error) {
      Alert.alert("Error", "Could not update availability status.");
    }
  };

  const handleDeleteDish = async (id: string, dishName: string) => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm(`Are you sure you want to completely delete ${dishName}?`);
      if (confirmDelete) {
        await deleteDoc(doc(db, 'menu', id));
      }
    } else {
      Alert.alert("Remove Dish?", `Are you sure you want to completely delete ${dishName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, 'menu', id)) }
      ]);
    }
  };

  const startEditing = (item: MenuItem) => {
    setEditingId(item.id);
    setEditFullPrice(String(item.fullPrice));
    setEditHalfPrice(item.halfPrice ? String(item.halfPrice) : '');
  };

  const saveEdit = async (item: MenuItem) => {
    if (!editFullPrice.trim()) {
      return Alert.alert("Error", "Full price cannot be empty.");
    }
    
    try {
      const updates: any = {
        price: Number(editFullPrice),
        price_full: Number(editFullPrice),
        price_half: editHalfPrice.trim() ? Number(editHalfPrice) : null,
        fullPrice: Number(editFullPrice),
        halfPrice: editHalfPrice.trim() ? Number(editHalfPrice) : null
      };

      await updateDoc(doc(db, 'menu', item.id), updates);
      setEditingId(null);
    } catch (error) {
      Alert.alert("Error", "Could not update prices.");
    }
  };

  const renderDish = ({ item }: { item: MenuItem }) => {
    if (editingId === item.id) {
      return (
        <View style={styles.dishCard}>
          <View style={styles.dishInfo}>
            <Text style={styles.dishName}>{item.name}</Text>
            <View style={styles.editPriceRow}>
              <TextInput
                style={[styles.input, styles.editInput]}
                value={editFullPrice}
                onChangeText={setEditFullPrice}
                keyboardType="numeric"
                placeholder="Full ₹"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={[styles.input, styles.editInput]}
                value={editHalfPrice}
                onChangeText={setEditHalfPrice}
                keyboardType="numeric"
                placeholder="Half ₹ (Opt)"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
          <View style={styles.dishActionRow}>
            <TouchableOpacity onPress={() => saveEdit(item)} style={styles.iconBtnGreen}>
              <Text style={styles.iconBtnText}>✅</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingId(null)} style={styles.iconBtnRed}>
              <Text style={styles.iconBtnText}>❌</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.dishCard, !item.available && styles.dishCardDisabled]}>
        <View style={styles.dishInfo}>
          <Text style={[styles.dishName, !item.available && styles.dishNameDisabled]}>
            <Text style={{fontSize: 14}}>{item.type === 'veg' ? '🟢 ' : '🔴 '}</Text>
            {item.name} {!item.available && <Text style={styles.outOfStockText}>(Out of Stock)</Text>}
          </Text>
          <Text style={styles.dishPrices}>Full: ₹{item.fullPrice} {item.halfPrice ? ` | Half: ₹${item.halfPrice}` : ''}</Text>
        </View>
        
        <View style={styles.dishActionRow}>
          <Switch 
            value={item.available} 
            onValueChange={() => handleToggleAvailability(item.id, item.available)} 
            trackColor={{ false: '#f8c2c2', true: '#fecaca' }}
            thumbColor={item.available ? '#B82A2B' : '#fef2f2'}
          />
          <TouchableOpacity onPress={() => startEditing(item)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteDish(item.id, item.name)} style={styles.iconBtnRed}>
            <Text style={styles.iconBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filteredMenu = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Manager</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.formContainer}>
          <Text style={styles.subHeader}>Add New Dish</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Dish Name" 
            placeholderTextColor="#9ca3af"
            value={name} 
            onChangeText={setName} 
          />
          
          <View style={styles.row}>
            <TouchableOpacity style={[styles.typeBtn, type === 'veg' && styles.activeVeg]} onPress={() => setType('veg')}>
              <Text style={[styles.typeText, type === 'veg' && styles.activeText]}>🟢 Veg</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, type === 'non-veg' && styles.activeNonVeg]} onPress={() => setType('non-veg')}>
              <Text style={[styles.typeText, type === 'non-veg' && styles.activeText]}>🔴 Non-Veg</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Offer Half Portion?</Text>
            <Switch 
              value={hasHalfPortion} 
              onValueChange={setHasHalfPortion} 
              trackColor={{ false: '#e2e8f0', true: '#fecaca' }}
              thumbColor={hasHalfPortion ? '#B82A2B' : '#f8fafc'}
            />
          </View>

          <View style={styles.row}>
            {hasHalfPortion && (
              <TextInput 
                style={[styles.input, { flex: 1, marginRight: 10 }]} 
                placeholder="Half Price (₹)" 
                placeholderTextColor="#9ca3af"
                keyboardType="numeric" 
                value={halfPrice} 
                onChangeText={setHalfPrice} 
              />
            )}
            <TextInput 
              style={[styles.input, { flex: 1 }]} 
              placeholder="Full Price (₹)" 
              placeholderTextColor="#9ca3af"
              keyboardType="numeric" 
              value={fullPrice} 
              onChangeText={setFullPrice} 
            />
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAddDish}>
            <Text style={styles.addBtnText}>➕ Add to Menu</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Current Menu ({filteredMenu.length})</Text>
          
          <View style={styles.filterGroup}>
            <TouchableOpacity style={[styles.filterBtn, filterType === 'all' && styles.activeFilterBtn]} onPress={() => setFilterType('all')}>
              <Text style={[styles.filterText, filterType === 'all' && styles.activeFilterText]}>All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.filterBtn, filterType === 'veg' && styles.activeFilterVeg]} onPress={() => setFilterType('veg')}>
              <Text style={[styles.filterText, filterType === 'veg' && styles.activeFilterTextWhite]}>Veg</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.filterBtn, filterType === 'non-veg' && styles.activeFilterNonVeg]} onPress={() => setFilterType('non-veg')}>
              <Text style={[styles.filterText, filterType === 'non-veg' && styles.activeFilterTextWhite]}>Non-Veg</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput 
            style={styles.searchInput}
            placeholder="Search dishes to edit..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <FlatList 
          data={filteredMenu} 
          keyExtractor={item => item.id} 
          renderItem={renderDish} 
          showsVerticalScrollIndicator={false} 
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyText}>{searchQuery ? 'No dishes match your search.' : 'No dishes found.'}</Text>
            </View>
          } 
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
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
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#fdfbf7' },
  formContainer: { backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#f1eee6', elevation: 2, shadowOpacity: 0.05, shadowRadius: 2 },
  subHeader: { fontSize: 17, fontWeight: '800', color: '#1A0E00', marginBottom: 14 },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12, paddingHorizontal: 4 },
  listHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1A0E00' },
  filterGroup: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 3 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  activeFilterBtn: { backgroundColor: '#fff', elevation: 1 },
  activeFilterVeg: { backgroundColor: '#22c55e', elevation: 1 },
  activeFilterNonVeg: { backgroundColor: '#B82A2B', elevation: 1 },
  filterText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  activeFilterText: { color: '#1e293b' },
  activeFilterTextWhite: { color: '#fff' },
  input: { backgroundColor: '#fcfaf5', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12, fontSize: 15, color: '#1e293b' },
  row: { flexDirection: 'row', marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#f1f5f9', marginHorizontal: 4 },
  activeVeg: { backgroundColor: '#22c55e' },
  activeNonVeg: { backgroundColor: '#B82A2B' },
  typeText: { fontWeight: '700', color: '#64748b' },
  activeText: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
  addBtn: { backgroundColor: '#1A0E00', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16, paddingHorizontal: 12 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
  dishCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#f1eee6', borderLeftWidth: 4, borderLeftColor: '#B82A2B', elevation: 1 },
  dishCardDisabled: { backgroundColor: '#fcfaf5', borderLeftColor: '#cbd5e1', opacity: 0.8 },
  dishInfo: { flex: 1, paddingRight: 10 },
  dishName: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  dishNameDisabled: { textDecorationLine: 'line-through', color: '#94a3b8' },
  outOfStockText: { fontSize: 12, color: '#ef4444', fontStyle: 'italic', fontWeight: '600' },
  dishPrices: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  dishActionRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8, marginLeft: 10 },
  iconBtnRed: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8, marginLeft: 10 },
  iconBtnGreen: { padding: 8, backgroundColor: '#dcfce3', borderRadius: 8, marginLeft: 10 },
  iconBtnText: { fontSize: 14 },
  editPriceRow: { flexDirection: 'row', marginTop: 8 },
  editInput: { flex: 1, marginBottom: 0, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' }
});