import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PatientScreen from './screens/PatientScreen';
import DoctorScreen from './screens/DoctorScreen';
import AdminScreen from './screens/AdminScreen';

const Stack = createNativeStackNavigator(); 
const API_URL = 'http://192.168.16.50/api';

// 날짜 포맷 (YYYY-MM-DD)
const formatDate = (y: number, m: number, d: number) => {
  const mm = m < 10 ? `0${m}` : m;
  const dd = d < 10 ? `0${d}` : d;
  return `${y}-${mm}-${dd}`;
};

// [피커 데이터]
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function AuthScreen({ navigation }: any) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<string>('patient');
  const [department, setDepartment] = useState('내과');
  const [birth, setBirth] = useState(`${currentYear}-01-01`); 
  const [gender, setGender] = useState('남성');

  // [피커 상태]
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(1);
  const [selDay, setSelDay] = useState(1);

  const handleAuth = async () => {
    // [M1 취약점: 백도어]
    const DEV_MASTER_KEY="SecuriApp_Dev_Secret_2025!";
    if (password == DEV_MASTER_KEY){
      Alert.alert("개발자 모드", "마스터 키로 접속했습니다. (관리자 권한)");
      navigation.replace('AdminMain',{ userId: 9999, username: 'admin_dev', name: '개발자(super)' });
      return;
    }

    if (!username || !password) {
      Alert.alert('알림', '아이디와 비밀번호를 입력해주세요.');
      return;
    }

    const endpoint = isLogin ? '/login' : '/register';
    const body = isLogin
      ? { username, password }
      : { username, password, role, name, department, birth, gender };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          // [M9 취약점: 로그 평문 노출]
          console.log("==========================================");
          console.log("[M9 VULNERABILITY] Sensitive Data Leaked to System Log");
          console.log("UserID: " + username);
          console.log("Password: " + password);
          console.log("==========================================");

          Alert.alert('환영합니다', `${data.username}님 로그인되었습니다.`);
          console.log("로그인 성공, 서버가 준 ID: ", data.id);
          const userInfo = {userId: data.id, username: data.username, name:data.name};
          if (data.role === 'patient') navigation.replace('PatientMain',userInfo);
          else if (data.role === 'doctor') navigation.replace('DoctorMain',userInfo);
          else if (data.role === 'admin') navigation.replace('AdminMain',userInfo);
        } else {
          Alert.alert('성공', '회원가입 완료! 로그인해주세요.');
          setIsLogin(true); 
        }
      } else {
        Alert.alert('오류', data.message || '요청 실패');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('연결 실패', '다시 로그인을 시도해보세요.\n');
    }
  };

  // [피커 렌더링]
  const renderPicker = () => {
    return (
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>생년월일 선택</Text>
        </View>
        <View style={styles.pickerBody}>
          {/* 년 */}
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>년</Text>
            <FlatList data={YEARS} keyExtractor={(i)=>i.toString()} showsVerticalScrollIndicator={false}
              renderItem={({item})=>(
                <TouchableOpacity style={[styles.pickerItem, selYear===item && styles.pickerItemSelected]} onPress={()=>setSelYear(item)}>
                  <Text style={[styles.pickerItemText, selYear===item && styles.pickerItemTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
          {/* 월 */}
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>월</Text>
            <FlatList data={MONTHS} keyExtractor={(i)=>i.toString()} showsVerticalScrollIndicator={false}
              renderItem={({item})=>(
                <TouchableOpacity style={[styles.pickerItem, selMonth===item && styles.pickerItemSelected]} onPress={()=>setSelMonth(item)}>
                  <Text style={[styles.pickerItemText, selMonth===item && styles.pickerItemTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
          {/* 일 */}
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>일</Text>
            <FlatList data={DAYS} keyExtractor={(i)=>i.toString()} showsVerticalScrollIndicator={false}
              renderItem={({item})=>(
                <TouchableOpacity style={[styles.pickerItem, selDay===item && styles.pickerItemSelected]} onPress={()=>setSelDay(item)}>
                  <Text style={[styles.pickerItemText, selDay===item && styles.pickerItemTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.pickerConfirmBtn} onPress={()=>{ setBirth(formatDate(selYear, selMonth, selDay)); setPickerVisible(false); }}>
          <Text style={styles.pickerConfirmText}>선택 완료</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{marginTop:15}} onPress={()=>setPickerVisible(false)}>
          <Text style={{color:'#999'}}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerSection}>
            <Text style={styles.appLogo}>🏥 SecuriApp</Text>
            {isLogin && <Text style={styles.subTitle}>의료 서비스의 시작</Text>}
          </View>

          <View style={styles.card}>
            {/* 아이디 */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>아이디</Text>
              <TextInput style={styles.input} placeholder="ID 입력" placeholderTextColor="#999" value={username} onChangeText={setUsername} autoCapitalize="none"/>
            </View>
            
            {/* 비밀번호 */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput style={styles.input} placeholder="비밀번호 입력" placeholderTextColor="#999" value={password} secureTextEntry onChangeText={setPassword}/>
            </View>

            {!isLogin && (
              <>
                {/* 이름 */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>이름 (실명)</Text>
                  <TextInput style={styles.input} placeholder="홍길동" placeholderTextColor="#999" value={name} onChangeText={setName}/>
                </View>

                {/* [레이아웃 복구] 생년월일 + 성별 가로 배치 */}
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 15}}>
                    {/* 왼쪽: 생년월일 (피커 트리거) */}
                    <View style={{flex: 1.2, marginRight: 10}}>
                      <Text style={styles.label}>생년월일</Text>
                      <TouchableOpacity style={styles.input} onPress={() => setPickerVisible(true)}>
                        <Text style={{color: '#2c3e50', fontSize:16}}>📅 {birth}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 오른쪽: 성별 (토글 버튼) */}
                    <View style={{flex: 1}}>
                      <Text style={styles.label}>성별</Text>
                      <View style={styles.compactRow}>
                        {['남성', '여성'].map((g) => (
                          <TouchableOpacity key={g} style={[styles.compactBtn, gender === g && styles.activeBtn]} onPress={() => setGender(g)}>
                            <Text style={[styles.compactBtnText, gender === g && styles.activeBtnText]}>{g}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                </View>

                {/* 가입 유형 */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>가입 유형</Text>
                  <View style={styles.toggleRow}>
                    {['patient', 'doctor'].map((r) => (
                      <TouchableOpacity key={r} style={[styles.toggleBtn, role === r && styles.activeToggleBtn]} onPress={() => setRole(r)}>
                        <Text style={[styles.toggleText, role === r && styles.activeToggleText]}>
                          {r === 'patient' ? '환자' : '의사'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {role === 'doctor' && (
                  <View style={{marginTop: 5}}>
                    <Text style={styles.label}>진료과 선택</Text>
                    <View style={styles.deptContainer}>
                      {['내과', '정형외과', '치과', '안과', '피부과'].map((dept) => (
                        <TouchableOpacity key={dept} style={[styles.deptChip, department === dept && styles.deptChipSelected]} onPress={() => setDepartment(dept)}>
                          <Text style={[styles.deptText, department === dept && styles.deptTextSelected]}>{dept}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={styles.mainButton} onPress={handleAuth}>
              <Text style={styles.mainButtonText}>{isLogin ? '로그인하기' : '가입 완료'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{isLogin ? '계정이 없나요? ' : '계정이 있나요? '}</Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchText}>{isLogin ? '회원가입' : '로그인'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 3단 휠 피커 모달 */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {renderPicker()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PatientMain" component={PatientScreen} options={{ title: 'Patient Mode' }} />
        <Stack.Screen name="DoctorMain" component={DoctorScreen} options={{ title: 'Doctor Mode' }} />
        <Stack.Screen name="AdminMain" component={AdminScreen} options={{ title: 'Admin Mode' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardView: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  headerSection: { alignItems: 'center', marginBottom: 20 },
  appLogo: { fontSize: 32, fontWeight: '800', color: '#3498db', marginBottom: 5 },
  subTitle: { fontSize: 16, color: '#7f8c8d' },
  
  card: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  
  inputWrapper: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#34495e', marginBottom: 6, marginLeft: 2 },
  input: { backgroundColor: '#f1f3f5', borderRadius: 12, padding: 15, fontSize: 16, color: '#2c3e50', borderWidth: 1, borderColor: 'transparent' },
  
  // [가로 배치용 컴팩트 스타일]
  compactRow: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderRadius: 12, padding: 4, height: 52, alignItems: 'center' }, // input 높이(약 50)와 비슷하게 맞춤
  compactBtn: { flex: 1, paddingVertical: 0, height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  activeBtn: { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1 },
  compactBtnText: { color: '#adb5bd', fontWeight: '600', fontSize: 14 },
  activeBtnText: { color: '#3498db', fontWeight: 'bold' },

  toggleRow: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeToggleBtn: { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1 },
  toggleText: { color: '#adb5bd', fontWeight: '600' },
  activeToggleText: { color: '#3498db', fontWeight: 'bold' },

  deptContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  deptChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#dee2e6', backgroundColor: 'white' },
  deptChipSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  deptText: { color: '#495057', fontSize: 13 },
  deptTextSelected: { color: 'white', fontWeight: 'bold' },

  mainButton: { backgroundColor: '#3498db', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, elevation: 3, shadowColor: '#3498db', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 } },
  mainButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#868e96' },
  switchText: { color: '#3498db', fontWeight: 'bold' },

  // 피커 모달 스타일
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '45%', alignItems: 'center' },
  pickerHeader: { width: '100%', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  pickerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  pickerBody: { flexDirection: 'row', justifyContent: 'space-between', flex: 1, width: '100%' },
  pickerColumn: { flex: 1, alignItems: 'center' },
  columnLabel: { fontSize: 14, color: '#999', marginBottom: 10 },
  pickerItem: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  pickerItemSelected: { backgroundColor: '#e3f2fd', borderRadius: 8 },
  pickerItemText: { fontSize: 18, color: '#aaa' },
  pickerItemTextSelected: { fontSize: 20, fontWeight: 'bold', color: '#3498db' },
  pickerConfirmBtn: { backgroundColor: '#3498db', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  pickerConfirmText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});

export default App;