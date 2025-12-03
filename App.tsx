import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PatientScreen from './screens/PatientScreen';
import DoctorScreen from './screens/DoctorScreen';
import AdminScreen from './screens/AdminScreen';
// 취약점 M9 구현위한 라이브러리 : 자동로그인위해 사용자의 아이디와 비번을 AsyncStorage에 저장하도록구현
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// TypeScript에서 네비게이터 스택을 정의합니다.
const Stack = createNativeStackNavigator();

// 1. 실제 폰 테스트: PC의 IP 주소 (예: 192.168.0.x:3000/api)
const API_URL = 'http://192.168.16.40:3000/api';
// 2. 에뮬레이터 테스트: 10.0.2.2 사용
//const API_URL = 'http://10.0.2.2:3000/api';

// --- 1. 로그인/회원가입 화면 ---
// navigation의 타입을 간단하게 any로 처리했습니다.
function AuthScreen({ navigation }: any) {
  const [isLogin, setIsLogin] = useState<boolean>(true); // true: 로그인, false: 회원가입
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<string>('patient'); // 기본값: 환자
  const [name, setName] = useState<string>('');
  const [department, setDepartment] = useState('내과'); // 기본값: 내과

  const handleAuth = async () => {
    // M1 취약점 구현구분
    // 개발자가 테스트용 마스터키를 코드에 하드코딩함
    const DEV_MASTER_KEY = "SecuriApp_Dev_Secret_2025!";
     if (password === DEV_MASTER_KEY) {
      Alert.alert("개발자 모드", "마스터 키로 접속했습니다. (관리자 권한)");
      // 서버 통신 없이 바로 관리자 화면으로 프리패스
      navigation.replace('AdminMain', { 
        userId: 9999, 
        username: 'admin_dev', 
        name: '개발자(Super)' 
      });
      return; 
    }

    // 2. 요청 데이터 준비
    const endpoint = isLogin ? '/login' : '/register';
    const body = isLogin
      ? { username, password }
      : { username, password, role ,name, department};

    try {
      // 3. 서버 통신
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          // [M9 취약점 구현 코드 추가]
          // 편리한 '자동 로그인' 기능을 위함이라며, 비밀번호를 암호화 없이 저장해버림
          try {
            console.log(`[M9 취약점] 아이디와 비밀번호를 기기에 평문으로 저장합니다.`);
            await AsyncStorage.setItem('saved_userid', username);
            // ★ 여기가 핵심 취약점: 비밀번호를 평문(Plain text) 그대로 저장
            await AsyncStorage.setItem('saved_password', password); 
          } catch (e) {
            console.error("저장 실패", e);
          }

          Alert.alert('환영합니다', `${data.username}님 로그인되었습니다.`);
          // 역할에 따른 화면 이동
          const userInfo = {userId: data.id, username: data.username, name:data.name};

          if (data.role === 'patient') navigation.replace('PatientMain',userInfo);
          else if (data.role === 'doctor') navigation.replace('DoctorMain',userInfo);
          else if (data.role === 'admin') navigation.replace('AdminMain',userInfo);
        } else {
          Alert.alert('성공', '회원가입 완료! 로그인해주세요.');
          setIsLogin(true); // 로그인 모드로 전환
        }
      } else {
        Alert.alert('오류', data.message || '요청 실패');
        setIsLogin(true);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('연결 실패', '백엔드 서버가 켜져있는지 확인해주세요.\n(node index.js)');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>SecuriApp</Text>
      <Text style={styles.subTitle}>{isLogin ? '로그인' : '회원가입'}</Text>

      <TextInput
        style={styles.input}
        placeholder="아이디"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />
      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="이름 (실명)"
          value={name}
          onChangeText={setName}
        />
      )}

      {/* 회원가입일 때만 역할 선택 버튼 보이기 */}
      {!isLogin && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ marginBottom: 10 }}>가입 유형 선택:</Text>
          <View style={styles.roleContainer}>
            {['patient', 'doctor', 'admin'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, role === r && styles.roleBtnSelected]}
                onPress={() => setRole(r)}>
                <Text
                  style={{
                    color: role === r ? 'white' : 'black',
                    fontWeight: 'bold',
                  }}>
                  {r === 'patient'
                    ? '환자'
                    : r === 'doctor'
                    ? '의사'
                    : '관리자'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    
    {!isLogin && role === 'doctor' && (
      <View style={{marginBottom: 20}}>
        <Text style={{marginBottom: 5}}>진료과 선택:</Text>
        <View style={{flexDirection:'row', flexWrap:'wrap'}}>
          {['내과', '정형외과', '치과', '산부인과', '피부과'].map((dept) => (
            <TouchableOpacity 
              key={dept}
              style={[styles.roleBtn, department === dept && styles.roleBtnSelected, {margin:2}]}
              onPress={() => setDepartment(dept)}
            >
              <Text style={{color: department === dept ? 'white' : 'black'}}>{dept}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
)}


      <Button title={isLogin ? '로그인 하기' : '가입 완료'} onPress={handleAuth} />

      <TouchableOpacity
        onPress={() => setIsLogin(!isLogin)}
        style={styles.switchBtn}>
        <Text style={styles.switchText}>
          {isLogin
            ? '계정이 없으신가요? 회원가입 하러가기'
            : '이미 계정이 있으신가요? 로그인 하러가기'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- 네비게이션 설정 ---
function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        {/* 1. 로그인 화면 */}
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
        {/* 2. 환자 메인 화면 (screens/PatientScreen.tsx 연결) */}
        <Stack.Screen
          name="PatientMain"
          component={PatientScreen}
          options={{ title: 'Patient' }}
        />
        {/* 3. 의사 메인 화면 (screens/DoctorScreen.tsx 연결) */}
        <Stack.Screen
          name="DoctorMain"
          component={DoctorScreen}
          options={{ title: 'Doctor' }}
        />
        {/* 4. 관리자 메인 화면 (screens/AdminScreen.tsx 연결) */}
        <Stack.Screen
          name="AdminMain"
          component={AdminScreen}
          options={{ title: 'Admin' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- 4. 스타일 ---
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 30,
    color: '#7f8c8d',
  },
  pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  desc: { fontSize: 16, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  roleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    width: '30%',
    alignItems: 'center',
  },
  roleBtnSelected: { backgroundColor: '#3498db', borderColor: '#3498db' },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#3498db', textDecorationLine: 'underline' },
});

export default App;