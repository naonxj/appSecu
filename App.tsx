import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 화면들 import
import PatientScreen from './screens/PatientScreen';
import DoctorScreen from './screens/DoctorScreen';
import AdminScreen from './screens/AdminScreen';

// DB 함수 import
import { initDB, loginUser, registerUser } from './database';

const Stack = createNativeStackNavigator();

function AuthScreen({ navigation }: any) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('내과');

  // 앱 시작 시 DB 초기화
  useEffect(() => {
    initDB();
  }, []);

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert('알림', '아이디와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      if (isLogin) {
        // [로그인]
        const userData = await loginUser(username, password);
        // Alert.alert('환영합니다', `${userData.name}님 로그인되었습니다.`); // (옵션: 너무 자주 뜨면 귀찮으므로 주석 처리 가능)
        
        const userInfo = { userId: userData.id, username: userData.username, name: userData.name };

        if (userData.role === 'patient') navigation.replace('PatientMain', userInfo);
        else if (userData.role === 'doctor') navigation.replace('DoctorMain', userInfo);
        else if (userData.role === 'admin') navigation.replace('AdminMain', userInfo);
        
      } else {
        // [회원가입]
        if (!name) {
          Alert.alert('알림', '이름을 입력해주세요.');
          return;
        }
        await registerUser(username, password, role, name, department);
        Alert.alert('가입 성공', '회원가입이 완료되었습니다! 로그인해주세요.');
        setIsLogin(true);
      }
    } catch (error) {
      console.error(error);
      if (isLogin) Alert.alert('로그인 실패', '아이디 또는 비밀번호를 확인해주세요.');
      else Alert.alert('가입 실패', '이미 사용 중인 아이디이거나 오류가 발생했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f0f4f8" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. 로고 및 헤더 영역 */}
        <View style={styles.headerArea}>
          <Text style={styles.logoIcon}>🏥</Text>
          <Text style={styles.headerTitle}>SecuriApp</Text>
          <Text style={styles.subTitle}>
            {isLogin ? '병원 진료 예약 시스템' : '새로운 계정 만들기'}
          </Text>
        </View>

        {/* 2. 메인 카드 영역 */}
        <View style={styles.card}>
          
          {/* 탭 전환 (로그인 <-> 회원가입) */}
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)}>
              <Text style={[styles.tabText, isLogin && styles.activeTabText]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => setIsLogin(false)}>
              <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formArea}>
            <Text style={styles.label}>아이디</Text>
            <TextInput 
              style={styles.input} 
              placeholder="User ID" 
              placeholderTextColor="#aaa"
              value={username} 
              onChangeText={setUsername} 
              autoCapitalize="none"
            />
            
            <Text style={styles.label}>비밀번호</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Password" 
              placeholderTextColor="#aaa"
              value={password} 
              secureTextEntry 
              onChangeText={setPassword}
            />

            {!isLogin && (
              <>
                <Text style={styles.label}>이름 (실명)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="홍길동" 
                  placeholderTextColor="#aaa"
                  value={name} 
                  onChangeText={setName}
                />

                <Text style={styles.label}>가입 유형</Text>
                <View style={styles.roleContainer}>
                  {['patient', 'doctor', 'admin'].map((r) => (
                    <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnSelected]} onPress={() => setRole(r)}>
                      <Text style={{fontSize:20, marginBottom:5}}>
                        {r==='patient'?'🙂':r==='doctor'?'👨‍⚕️':'🛡️'}
                      </Text>
                      <Text style={[styles.roleText, role === r && styles.roleTextSelected]}>
                        {r === 'patient' ? '환자' : r === 'doctor' ? '의사' : '관리자'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {role === 'doctor' && (
                  <View style={{marginTop: 15}}>
                    <Text style={styles.label}>진료과 선택</Text>
                    <View style={styles.deptContainer}>
                      {['내과', '정형외과', '치과', '안과', '피부과'].map((dept) => (
                        <TouchableOpacity 
                          key={dept}
                          style={[styles.deptChip, department === dept && styles.deptChipSelected]}
                          onPress={() => setDepartment(dept)}
                        >
                          <Text style={[styles.deptText, department === dept && styles.deptTextSelected]}>{dept}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity style={styles.mainBtn} onPress={handleAuth}>
              <Text style={styles.mainBtnText}>{isLogin ? '로그인 하기' : '가입 완료하기'}</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* 3. 하단 전환 버튼 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.footerLink}>
              {isLogin ? ' 회원가입' : ' 로그인'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  
  // 헤더
  headerArea: { alignItems: 'center', marginBottom: 25, marginTop: 10 },
  logoIcon: { fontSize: 50, marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a365d', letterSpacing: 0.5 },
  subTitle: { fontSize: 16, color: '#627d98', marginTop: 5 },

  // 카드 (메인 컨테이너)
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 25,
    // 그림자 효과 (Android + iOS)
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },

  // 탭
  tabContainer: { flexDirection: 'row', marginBottom: 25, backgroundColor:'#f1f5f9', borderRadius:12, padding:4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: 'white', elevation: 2, shadowColor:'#000', shadowOpacity:0.05 },
  tabText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  activeTabText: { color: '#0f172a', fontWeight: 'bold' },

  // 폼
  formArea: { width: '100%' },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 5 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#0f172a',
  },

  // 버튼
  mainBtn: {
    backgroundColor: '#3b82f6', // 세련된 블루
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  mainBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // 역할 선택 (가입시)
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  roleBtn: {
    width: '31%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  roleBtnSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  roleText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  roleTextSelected: { color: '#3b82f6', fontWeight: 'bold' },

  // 진료과 선택 (칩 스타일)
  deptContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  deptChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'white',
  },
  deptChipSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  deptText: { fontSize: 13, color: '#64748b' },
  deptTextSelected: { color: 'white', fontWeight: 'bold' },

  // 푸터
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: '#64748b', fontSize: 15 },
  footerLink: { color: '#3b82f6', fontWeight: 'bold', fontSize: 15 },
});

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PatientMain" component={PatientScreen} options={{ headerShown: false }} />
        <Stack.Screen name="DoctorMain" component={DoctorScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AdminMain" component={AdminScreen} options={{ title: '관리자 모드' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}