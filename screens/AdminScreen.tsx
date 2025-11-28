import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';

const API_URL = 'http://10.0.2.2:3000/api';

export default function AdminScreen({ navigation }: any) {
  const [users, setUsers] = useState([]);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      setUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const deleteUser = (id: number) => {
    Alert.alert("삭제 경고", "정말 이 사용자를 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", onPress: async () => {
          await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
          fetchUsers();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛠 관리자 페이지</Text>
      <FlatList
        data={users}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <View>
              <Text style={styles.username}>{item.username} ({item.name})</Text>
              <Text style={{color: item.role==='doctor'?'green': item.role==='admin'?'red':'blue'}}>
                {item.role.toUpperCase()} {item.department && `- ${item.department}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteUser(item.id)} style={styles.delBtn}>
              <Text style={{color:'white'}}>삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <Button title="로그아웃" color="red" onPress={() => navigation.replace('Auth')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', padding: 15, borderBottomWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  username: { fontSize: 16, fontWeight:'bold' },
  delBtn: { backgroundColor: 'red', padding: 8, borderRadius: 5 }
});