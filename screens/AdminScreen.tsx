import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, Button, StyleSheet, Alert, TouchableOpacity, Modal, TextInput 
} from 'react-native';

import DoctorScreen from './DoctorScreen';
import PatientScreen from './PatientScreen';

// ★ DB 함수 import
import { getAllUsers, deleteUser, updateUser } from '../database';

export default function AdminScreen({ route, navigation }: any) {
  const { userId, username, name } = route.params || {};

  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab !== 'doctor' && activeTab !== 'patient') {
      setSelectedTarget(null);
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) { console.error(err); }
  };

  const handleDeleteUser = (id: number) => {
    Alert.alert("삭제 경고", "정말 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", onPress: async () => {
          try {
            await deleteUser(id);
            fetchUsers();
            Alert.alert("성공", "삭제되었습니다.");
          } catch(e) { Alert.alert("오류", "삭제 실패"); }
      }}
    ]);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword(user.password);
    setEditName(user.name);
    setEditDept(user.department || '');
    setEditModalVisible(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, editUsername, editPassword, editName, editingUser.role === 'doctor' ? editDept : null);
      Alert.alert("성공", "수정되었습니다.");
      setEditModalVisible(false);
      fetchUsers();
    } catch (e) { Alert.alert("오류", "수정 실패"); }
  };

  const renderSelectableList = (targetRole: string) => {
    const filteredList = users.filter(u => u.role === targetRole);
    return (
      <View style={{flex:1}}>
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            {targetRole === 'doctor' ? '👨‍⚕️ 모니터링할 의사를 선택하세요' : '🏥 모니터링할 환자를 선택하세요'}
          </Text>
        </View>
        <FlatList
          data={filteredList}
          keyExtractor={(item:any) => item.id.toString()}
          contentContainerStyle={{paddingBottom:20}}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.selectCard} onPress={() => setSelectedTarget(item)}>
              <View>
                <Text style={styles.selectName}>{item.name}</Text>
                <Text style={styles.selectId}>ID: {item.username}</Text>
              </View>
              <View style={{alignItems:'flex-end'}}>
                {item.department && <Text style={styles.selectDept}>{item.department}</Text>}
                <Text style={styles.arrowText}>접속하기 &gt;</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>등록된 사용자가 없습니다.</Text>}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'users' && styles.activeTab]} onPress={() => setActiveTab('users')}>
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>계정관리</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'doctor' && styles.activeTab]} onPress={() => setActiveTab('doctor')}>
          <Text style={[styles.tabText, activeTab === 'doctor' && styles.activeTabText]}>의사모드</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'patient' && styles.activeTab]} onPress={() => setActiveTab('patient')}>
          <Text style={[styles.tabText, activeTab === 'patient' && styles.activeTabText]}>환자모드</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'users' && (
          <View style={{flex: 1}}>
            <Text style={styles.title}>🛠 전체 사용자 관리</Text>
            <FlatList
              data={users}
              keyExtractor={(item: any) => item.id.toString()}
              contentContainerStyle={{paddingBottom: 20}}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
                      <Text style={styles.username}>{item.name}</Text>
                      <Text style={[styles.roleBadge, item.role==='doctor' ? {color:'green'} : item.role==='admin' ? {color:'red'} : {color:'#3498db'}]}>
                         {item.role.toUpperCase()}
                         {item.department && ` (${item.department})`}
                      </Text>
                    </View>
                    <Text style={styles.infoRow}>Id: {item.username}</Text>
                    <Text style={styles.infoRow}>pw: {item.password}</Text>
                  </View>
                  <View style={{justifyContent:'center', gap:8}}>
                    <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editBtn}>
                      <Text style={styles.btnText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteUser(item.id)} style={styles.delBtn}>
                      <Text style={styles.btnText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
            <View style={{marginTop: 10, paddingHorizontal: 20}}>
              <Button title="로그아웃" color="#e74c3c" onPress={() => navigation.replace('Auth')} />
            </View>
          </View>
        )}

        {activeTab === 'doctor' && (
          <View style={{flex:1}}>
            {selectedTarget ? (
              <View style={{flex:1}}>
                <TouchableOpacity style={styles.backBar} onPress={() => setSelectedTarget(null)}>
                  <Text style={styles.backBarText}>◀ 의사 목록으로 돌아가기</Text>
                </TouchableOpacity>
                <DoctorScreen navigation={navigation} route={{ params: { userId: selectedTarget.id, username: selectedTarget.username, name: `${selectedTarget.name}(관리자)` } }} />
              </View>
            ) : renderSelectableList('doctor')}
          </View>
        )}

        {activeTab === 'patient' && (
          <View style={{flex:1}}>
             {selectedTarget ? (
              <View style={{flex:1}}>
                <TouchableOpacity style={styles.backBar} onPress={() => setSelectedTarget(null)}>
                  <Text style={styles.backBarText}>◀ 환자 목록으로 돌아가기</Text>
                </TouchableOpacity>
                <PatientScreen navigation={navigation} route={{ params: { userId: selectedTarget.id, username: selectedTarget.username, name: selectedTarget.name } }} />
              </View>
            ) : renderSelectableList('patient')}
          </View>
        )}

      </View>

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>계정 정보 수정</Text>
            <Text style={styles.label}>아이디</Text>
            <TextInput style={styles.input} value={editUsername} onChangeText={setEditUsername} />
            <Text style={styles.label}>비밀번호</Text>
            <TextInput style={styles.input} value={editPassword} onChangeText={setEditPassword} />
            <Text style={styles.label}>이름</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            {editingUser?.role === 'doctor' && (
              <>
                <Text style={styles.label}>진료과</Text>
                <TextInput style={styles.input} value={editDept} onChangeText={setEditDept} />
              </>
            )}
            <View style={{marginTop:20}}>
              <TouchableOpacity style={styles.fullBtn} onPress={handleUpdateUser}>
                <Text style={styles.fullBtnText}>저장하기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.fullBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  tabContainer: { flexDirection: 'row', backgroundColor:'#fff', elevation:2 },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: '#8e44ad' }, 
  tabText: { fontSize: 16, color:'#95a5a6' },
  activeTabText: { color: '#8e44ad', fontWeight: 'bold' },
  content: { flex: 1, padding: 0 }, 
  title: { fontSize: 24, fontWeight: 'bold', marginVertical: 20, textAlign: 'center', color:'#2c3e50' },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, marginHorizontal: 15, marginBottom: 10, backgroundColor: '#fff', borderRadius: 10, elevation: 1 },
  username: { fontSize: 18, fontWeight:'bold', color: '#2c3e50', marginRight: 8 },
  roleBadge: { fontSize: 14, fontWeight:'bold' },
  infoRow: { fontSize: 14, color: '#555', marginTop: 2 },
  editBtn: { backgroundColor: '#3498db', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6 },
  delBtn: { backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6 },
  btnText: { color:'white', fontWeight:'bold', fontSize:12 },
  infoBanner: { padding: 15, backgroundColor:'#e8eaf6', alignItems:'center' },
  infoText: { fontSize: 16, fontWeight:'bold', color:'#3f51b5' },
  selectCard: { backgroundColor: 'white', padding: 20, marginHorizontal: 15, marginTop: 10, borderRadius: 12, elevation: 2, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:'#eee' },
  selectName: { fontSize: 18, fontWeight: 'bold', color:'#2c3e50' },
  selectId: { fontSize: 14, color: '#7f8c8d', marginTop:2 },
  selectDept: { fontSize: 14, color: '#2980b9', fontWeight:'bold', marginBottom:5 },
  arrowText: { color: '#3498db', fontWeight:'bold' },
  emptyText: { textAlign:'center', marginTop: 50, color:'#bdc3c7', fontSize:16 },
  backBar: { backgroundColor: '#34495e', padding: 12, alignItems: 'center', elevation:5 },
  backBarText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding:30 },
  modalContent: { backgroundColor: 'white', padding: 25, borderRadius: 15, elevation:5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color:'#2c3e50' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, marginTop: 10, color:'#34495e' },
  input: { borderWidth: 1, borderColor: '#dcdde1', padding: 10, borderRadius: 8, fontSize:16, backgroundColor:'#fdfdfd' },
  fullBtn: { backgroundColor: '#8e44ad', padding: 15, borderRadius: 10, alignItems: 'center', width:'100%' },
  fullBtnText: { color:'white', fontWeight:'bold', fontSize:16 }
});