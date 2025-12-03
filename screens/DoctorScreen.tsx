import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ScrollView, Alert, RefreshControl
} from 'react-native';

//const API_URL = 'http://10.0.2.2:3000/api';
const API_URL = 'http://192.168.16.40:3000/api';
// 날짜 포맷 헬퍼
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = (`0${date.getMonth() + 1}`).slice(-2);
  const d = (`0${date.getDate()}`).slice(-2);
  return `${y}-${m}-${d}`;
};

export default function DoctorScreen({ route, navigation }: any) {
  // 1. 파라미터 안전하게 받기
  const params = route?.params || {};
  const { userId, username, name } = params;
  
  // 관리자 모드인지 확인
  const isAdmin = name && name.includes('(관리자)');

  // 탭 및 로딩 상태
  const [activeTab, setActiveTab] = useState('management');
  const [refreshing, setRefreshing] = useState(false);

  // 날짜 및 달력 상태
  const [today] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date())); 
  const [tempSelectedDate, setTempSelectedDate] = useState(''); 
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // 데이터 상태
  const [stats, setStats] = useState({ total: 0, completed: 0, waiting: 0 });
  const [appointments, setAppointments] = useState<any[]>([]);

  // 진료 차트 모달 상태
  const [treatModalVisible, setTreatModalVisible] = useState(false);
  const [currentAppt, setCurrentAppt] = useState<any>(null); 
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [opinion, setOpinion] = useState('');
  const [memo, setMemo] = useState('');

  // 환자 검색 상태
  const [keyword, setKeyword] = useState('');
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [patientHistoryModal, setPatientHistoryModal] = useState(false);
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any[]>([]);

  // --- 데이터 불러오기 ---
  const fetchDailyData = async () => {
    if (!userId) return; 
    try {
      const res = await fetch(`${API_URL}/doctor/appointments?doctorId=${userId}&date=${selectedDate}`);
      const data = await res.json();
      // 데이터가 없거나 에러일 경우를 대비해 기본값 설정
      setStats(data.stats || { total: 0, completed: 0, waiting: 0 });
      setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
    } catch (e) { 
      console.error(e);
      setAppointments([]); 
    }
  };

  // useEffect에서 userId가 변경될 때도 재호출
  useEffect(() => {
    if (activeTab === 'management') fetchDailyData();
    else if (activeTab === 'info') searchPatients();
  }, [selectedDate, activeTab, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'management') await fetchDailyData();
    else if (activeTab === 'info') searchPatients();
    setRefreshing(false);
  }, [activeTab, selectedDate, keyword]);

  // --- 달력 로직 ---
  const openCalendar = () => {
    setTempSelectedDate(selectedDate);
    const [y, m, d] = selectedDate.split('-').map(Number);
    setCalYear(y);
    setCalMonth(m - 1);
    setCalendarVisible(true);
  };

  const confirmDate = () => {
    setSelectedDate(tempSelectedDate); 
    setCalendarVisible(false);
  };

  const changeMonth = (offset: number) => {
    let newMonth = calMonth + offset;
    let newYear = calYear;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    else if (newMonth < 0) { newMonth = 11; newYear--; }
    setCalMonth(newMonth);
    setCalYear(newYear);
  };

  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calDayCell} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${(`0${calMonth+1}`).slice(-2)}-${(`0${d}`).slice(-2)}`;
      const isSelected = tempSelectedDate === dateStr;
      days.push(
        <TouchableOpacity key={d} style={[styles.calDayCell, isSelected && styles.calDaySelected]} onPress={() => setTempSelectedDate(dateStr)}>
          <Text style={{color: isSelected?'white':'black', fontWeight: isSelected?'bold':'normal'}}>{d}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.calGrid}>
         <View style={styles.calHeader}>
           <TouchableOpacity onPress={()=>changeMonth(-1)}><Text style={styles.calNav}>◀</Text></TouchableOpacity>
           <Text style={styles.calTitle}>{calYear}년 {calMonth+1}월</Text>
           <TouchableOpacity onPress={()=>changeMonth(1)}><Text style={styles.calNav}>▶</Text></TouchableOpacity>
         </View>
         <View style={styles.calWeekRow}>
           {['일','월','화','수','목','금','토'].map((w,i)=>(
             <Text key={w} style={[styles.calWeekText, i===0&&{color:'red'}, i===6&&{color:'blue'}]}>{w}</Text>
           ))}
         </View>
         <View style={styles.calDaysContainer}>{days}</View>
      </View>
    );
  };

  // --- 진료 함수 ---
  const openTreatmentModal = (item: any) => {
    // 모달을 열 때 값을 안전하게 초기화
    setCurrentAppt(item);
    setDiagnosis(item.diagnosis || ''); 
    setPrescription(item.prescription || '');
    setOpinion(item.doctor_opinion || '');
    setMemo(item.memo || '');
    setTreatModalVisible(true);
  };

  const saveTreatment = async (status: string) => {
    if (!currentAppt) return;
    try {
      const res = await fetch(`${API_URL}/appointments/${currentAppt.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          status, memo, diagnosis, prescription, doctor_opinion: opinion
        })
      });

      if (res.ok) {
        setTreatModalVisible(false);
        fetchDailyData(); 
        Alert.alert("성공", status==='completed' ? "진료 완료 처리되었습니다." : "임시 저장되었습니다.");
      } else {
        Alert.alert("오류", "저장에 실패했습니다.");
      }
    } catch (e) { 
      Alert.alert("오류", "서버 통신 오류가 발생했습니다."); 
    }
  };

  const searchPatients = async () => {
    try {
      const query = keyword ? keyword : '';
      const res = await fetch(`${API_URL}/doctor/patients/search?keyword=${query}`);
      const data = await res.json();
      setSearchResult(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
  };

  const showPatientDetail = async (patientId: number) => {
    try {
      const res = await fetch(`${API_URL}/doctor/patient/${patientId}`);
      const data = await res.json();
      setSelectedPatientInfo(data.info);      
      setSelectedPatientHistory(Array.isArray(data.history) ? data.history : []);
      setPatientHistoryModal(true);
    } catch(e) { Alert.alert("오류","정보 조회 실패"); }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👨‍⚕️ Doctor 진료실</Text>
        <View style={{alignItems:'flex-end'}}>
          <Text style={{fontSize:14, fontWeight:'600'}}>{name} 선생님</Text>
          {/* 관리자가 아닐 때만 로그아웃 버튼 표시 (관리자는 상단 뒤로가기 사용) */}
          {!isAdmin && (
            <TouchableOpacity onPress={() => navigation.replace('Auth')}>
              <Text style={{color:'#e74c3c', fontSize:12, marginTop:2}}>로그아웃</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 탭 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab==='management'&&styles.activeTab]} onPress={()=>setActiveTab('management')}>
          <Text style={{fontWeight: activeTab==='management'?'bold':'normal', color: activeTab==='management'?'#2980b9':'#7f8c8d'}}>진료관리</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab==='info'&&styles.activeTab]} onPress={()=>setActiveTab('info')}>
          <Text style={{fontWeight: activeTab==='info'?'bold':'normal', color: activeTab==='info'?'#2980b9':'#7f8c8d'}}>환자검색</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'management' ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}><Text style={styles.statLabel}>전체</Text><Text style={styles.statValue}>{stats.total}</Text></View>
              <View style={styles.statItem}><Text style={styles.statLabel}>완료</Text><Text style={[styles.statValue, {color:'#27ae60'}]}>{stats.completed}</Text></View>
              <View style={styles.statItem}><Text style={styles.statLabel}>대기</Text><Text style={[styles.statValue, {color:'#e67e22'}]}>{stats.waiting}</Text></View>
            </View>

            <TouchableOpacity style={styles.dateSelector} onPress={openCalendar}>
              <Text style={styles.dateText}>📅  {selectedDate}</Text>
              <Text style={styles.dateHint}>▼</Text>
            </TouchableOpacity>

            <FlatList
              data={appointments}
              keyExtractor={(item:any) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
              contentContainerStyle={{paddingBottom:20}}
              renderItem={({item}) => (
                <TouchableOpacity style={[styles.card, item.status==='completed' && styles.cardCompleted]} onPress={() => openTreatmentModal(item)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.timeBadge}>{item.time ? item.time.toString().slice(0, 5) : ''}</Text>
                    <Text style={[styles.statusBadge, item.status==='waiting'?{color:'#e67e22'}:item.status==='completed'?{color:'#2980b9'}:{color:'#27ae60'}]}>
                      {item.status==='waiting'?'대기': item.status==='progress'?'진료중':'완료'}
                    </Text>
                  </View>
                  <Text style={styles.patientName}>{item.patient_name} 님</Text>
                  <Text style={styles.symptoms} numberOfLines={1}>증상: {item.symptoms || '-'}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>예약된 환자가 없습니다.</Text>}
            />
          </>
        ) : (
          /* 환자 검색 탭 */
          <View style={{flex:1}}>
            <View style={styles.searchBar}>
              <TextInput style={styles.searchInput} value={keyword} onChangeText={setKeyword} placeholder="이름/ID 검색"/>
              <TouchableOpacity style={styles.searchBtn} onPress={searchPatients}><Text style={{color:'white'}}>검색</Text></TouchableOpacity>
            </View>
            <FlatList
              data={searchResult}
              keyExtractor={(item:any) => item.id.toString()}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.resultCard} onPress={() => showPatientDetail(item.id)}>
                   <View><Text style={styles.resultName}>{item.name}</Text><Text style={styles.resultId}>ID: {item.username}</Text></View>
                   <Text style={{color:'#3498db'}}>상세 &gt;</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* 달력 모달 */}
      <Modal visible={calendarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.calModalContent}>
            {renderCalendar()}
            <View style={styles.calBtnRow}>
               <TouchableOpacity style={[styles.calActionBtn, {backgroundColor:'#bdc3c7'}]} onPress={() => setCalendarVisible(false)}><Text style={styles.calBtnText}>취소</Text></TouchableOpacity>
               <TouchableOpacity style={[styles.calActionBtn, {backgroundColor:'#3498db'}]} onPress={confirmDate}><Text style={styles.calBtnText}>적용</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ★ [수정됨] 진료 차트 모달 - KeyboardAvoidingView 제거 */}
      <Modal visible={treatModalVisible} animationType="slide">
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>진료 차트</Text>
            <TouchableOpacity onPress={() => setTreatModalVisible(false)}>
              <Text style={styles.chartCloseText}>✕ 닫기</Text>
            </TouchableOpacity>
          </View>

          {currentAppt && (
            <ScrollView contentContainerStyle={styles.chartScroll}>
              <View style={styles.patientInfoBox}>
                <Text style={styles.patientInfoTitle}>환자 정보</Text>
                <Text style={styles.patientInfoText}>이름: {currentAppt.patient_name}</Text>
                <Text style={styles.patientInfoText}>증상: {currentAppt.symptoms}</Text>
              </View>

              <Text style={styles.inputLabel}>1. 진단명</Text>
              <TextInput 
                style={styles.chartInput} 
                value={diagnosis} 
                onChangeText={setDiagnosis} 
                placeholder="입력하세요"
              />

              <Text style={styles.inputLabel}>2. 처방</Text>
              <TextInput 
                style={[styles.chartInput, {height:80, textAlignVertical:'top'}]} 
                multiline 
                value={prescription} 
                onChangeText={setPrescription} 
                placeholder="입력하세요"
              />

              <Text style={styles.inputLabel}>3. 소견</Text>
              <TextInput 
                style={styles.chartInput} 
                value={opinion} 
                onChangeText={setOpinion} 
                placeholder="특이사항"
              />

              <Text style={styles.inputLabel}>4. 메모</Text>
              <TextInput 
                style={styles.chartInput} 
                value={memo} 
                onChangeText={setMemo} 
                placeholder="내부 기록용"
              />

              <View style={styles.chartBtnRow}>
                <TouchableOpacity style={[styles.chartActionBtn, {backgroundColor:'#27ae60'}]} onPress={() => saveTreatment('progress')}>
                  <Text style={styles.chartBtnText}>임시 저장</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chartActionBtn, {backgroundColor:'#2980b9'}]} onPress={() => saveTreatment('completed')}>
                  <Text style={styles.chartBtnText}>진료 완료</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* 환자 상세 모달 */}
      <Modal visible={patientHistoryModal} animationType="slide">
        <View style={styles.modalContainer}>
           <Text style={styles.modalTitle}>환자 상세 정보</Text>
           {selectedPatientInfo && (
             <View style={styles.infoBox}>
               <Text style={styles.infoText}>이름: {selectedPatientInfo.name}</Text>
               <Text style={styles.infoText}>아이디: {selectedPatientInfo.username}</Text>
               <Text style={styles.infoText}>생년월일: {selectedPatientInfo.birth ? selectedPatientInfo.birth.split('T')[0] : '-'}</Text>
               <Text style={styles.infoText}>성별: {selectedPatientInfo.gender || '-'}</Text>
             </View>
           )}
           <View style={styles.divider}/>
           <Text style={[styles.label, {textAlign:'center'}]}>▼ 진료 이력 ▼</Text>
           <FlatList 
             data={selectedPatientHistory}
             keyExtractor={(item:any, index) => index.toString()}
             style={{marginTop:10}}
             renderItem={({item}) => (
               <View style={styles.historyCard}>
                 <Text style={{fontWeight:'bold'}}>{item.date ? item.date.split('T')[0] : ''} - {item.doctor_name}</Text>
                 <Text>진단: {item.diagnosis || '-'}</Text>
                 <Text>처방: {item.prescription || '-'}</Text>
               </View>
             )}
             ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20, color:'#999'}}>기록 없음</Text>}
           />
           <TouchableOpacity style={styles.closeBtn} onPress={() => setPatientHistoryModal(false)}>
             <Text style={styles.btnText}>닫기</Text>
           </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#fff', flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderColor:'#eee' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color:'#2c3e50' },
  tabContainer: { flexDirection: 'row', backgroundColor:'#fff', elevation:2 },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: '#3498db' },
  content: { flex: 1, padding: 15 },
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, justifyContent:'space-around' },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#7f8c8d' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#dcdde1' },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  dateHint: { fontSize: 12, color: '#3498db' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 12, elevation: 2, borderWidth:1, borderColor:'#f1f2f6' },
  cardCompleted: { backgroundColor: '#f8f9fa', borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  timeBadge: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  statusBadge: { fontSize: 12, fontWeight: 'bold' },
  patientName: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  symptoms: { color: '#7f8c8d', fontSize: 14 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#bdc3c7', fontSize: 16 },
  searchBar: { flexDirection: 'row', marginBottom: 15 },
  searchInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, fontSize: 16, elevation: 1 },
  searchBtn: { backgroundColor: '#3498db', padding: 12, borderRadius: 8, marginLeft: 10, justifyContent: 'center' },
  resultCard: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#fff', padding:15, borderRadius:10, marginBottom:10, elevation:1 },
  resultName: { fontSize:16, fontWeight:'bold' },
  resultId: { fontSize:12, color:'#999' },
  modalOverlay: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.5)' },
  calModalContent: { width: '85%', backgroundColor:'white', borderRadius:15, padding:20, alignItems:'center', elevation:5 },
  calGrid: { width: '100%' },
  calHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15 },
  calNav: { fontSize:20, padding:10, color:'#3498db' },
  calTitle: { fontSize:18, fontWeight:'bold' },
  calWeekRow: { flexDirection:'row', justifyContent:'space-around', marginBottom:10 },
  calWeekText: { width:30, textAlign:'center', fontWeight:'bold' },
  calDaysContainer: { flexDirection:'row', flexWrap:'wrap' },
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent:'center', alignItems:'center', marginVertical: 2 },
  calDaySelected: { backgroundColor:'#3498db', borderRadius:20 },
  calBtnRow: { flexDirection:'row', justifyContent:'space-between', width:'100%', marginTop:20, gap: 10 },
  calActionBtn: { flex:1, paddingVertical:12, borderRadius:8, alignItems:'center' },
  calBtnText: { color:'white', fontWeight:'bold', fontSize:16 },
  chartContainer: { flex: 1, backgroundColor: '#f5f6fa' },
  chartHeader: { padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  chartCloseText: { fontSize: 16, color: '#7f8c8d' },
  chartScroll: { padding: 20 },
  patientInfoBox: { backgroundColor: '#e8f6f3', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#d1f2eb' },
  patientInfoTitle: { fontSize: 14, fontWeight: 'bold', color: '#16a085', marginBottom: 5 },
  patientInfoText: { fontSize: 16, color: '#2c3e50', marginBottom: 3 },
  inputLabel: { fontSize: 15, fontWeight: 'bold', color: '#34495e', marginBottom: 8, marginTop: 10 },
  chartInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 5, elevation: 1 },
  chartBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 50 },
  chartActionBtn: { flex: 0.48, paddingVertical: 15, borderRadius: 10, alignItems: 'center', elevation: 2 },
  chartBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor:'#fff' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign:'center', marginBottom:20 },
  infoBox: { backgroundColor: '#eef6fc', padding: 15, borderRadius: 10, borderColor: '#d0e3f5', borderWidth: 1 },
  infoText: { fontSize: 16, marginBottom: 5, color: '#333' },
  divider: { height:1, backgroundColor:'#eee', marginVertical:20 },
  label: { fontSize:16, fontWeight:'bold', marginBottom:10 },
  historyCard: { backgroundColor:'#fafafa', padding:15, borderRadius:10, marginBottom:10, borderWidth:1, borderColor:'#eee' },
  closeBtn: { backgroundColor: '#95a5a6', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, width: '100%' },
  btnText: { color:'white', fontSize:16, fontWeight:'bold' }
});