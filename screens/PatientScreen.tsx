import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, RefreshControl
} from 'react-native';

const API_URL = 'http://10.0.2.2:3000/api'; // 혹은 본인의 IP

// 시간 슬롯 생성 (09:00 ~ 18:00, 30분 단위)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
];

// 날짜 포맷 헬퍼
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = (`0${date.getMonth() + 1}`).slice(-2);
  const d = (`0${date.getDate()}`).slice(-2);
  return `${y}-${m}-${d}`;
};

export default function PatientScreen({ route, navigation }: any) {
  const { userId, name } = route.params || {};

  const [activeTab, setActiveTab] = useState('reservation');
  const [refreshing, setRefreshing] = useState(false);
  
  // 데이터 목록
  const [myList, setMyList] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  // === 통합 예약 모달 State (추가/수정 공용) ===
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // true면 수정, false면 추가
  const [targetApptId, setTargetApptId] = useState<number | null>(null); // 수정할 예약 ID

  // 입력 필드들
  const [selectedDept, setSelectedDept] = useState('내과');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [symptoms, setSymptoms] = useState('');

  // === 달력 모달 State ===
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // === 시간 선택 모달 State ===
  const [timeModalVisible, setTimeModalVisible] = useState(false);

  // === 게시판 관련 State ===
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [isPostEditMode, setIsPostEditMode] = useState(false);
  const [targetPostId, setTargetPostId] = useState<number | null>(null);
  const [postCategory, setPostCategory] = useState('Q&A');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState('');

  // --- 데이터 불러오기 ---
  const fetchAllData = async () => {
    const safeFetch = async (url: string, setter: (data: any) => void) => {
      try {
        const res = await fetch(url);
        if (res.ok) {
           const json = await res.json();
           setter(json);
        }
      } catch (e) { console.error(url, e); }
    };

    if (userId) {
      await safeFetch(`${API_URL}/appointments/patient/${userId}`, setMyList);
      await safeFetch(`${API_URL}/doctors`, setDoctors);
      await safeFetch(`${API_URL}/posts`, setPosts);
    }
  };

  useEffect(() => { fetchAllData(); }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);


  // ==========================================================
  //  [통합] 예약 모달 열기 함수 (추가 / 수정 분기)
  // ==========================================================
  
  // 1. 새 예약 열기
  const openAddModal = () => {
    setIsEditMode(false);
    setTargetApptId(null);
    
    // 초기값 설정
    setSelectedDept('내과');
    setSelectedDoctorId(null);
    setSelectedDate(formatDate(new Date()));
    setSelectedTime('09:00');
    setSymptoms('');

    setModalVisible(true);
  };

  // 2. 예약 수정 열기
  const openEditModal = (appt: any) => {
    setIsEditMode(true);
    setTargetApptId(appt.id);

    // 기존 데이터 채워넣기
    setSelectedDept(appt.department || '내과'); // 의사 정보에서 부서 가져와야 함 (여기선 간단히)
    setSelectedDoctorId(appt.doctor_id);
    setSelectedDate(appt.date ? appt.date.split('T')[0] : formatDate(new Date()));
    setSelectedTime(appt.time ? appt.time.substring(0,5) : '09:00');
    setSymptoms(appt.symptoms || '');

    setModalVisible(true);
  };

  // 3. 완료 버튼 (저장/수정)
  const handleSubmitReservation = async () => {
    if (!selectedDoctorId) { Alert.alert("알림", "의사를 선택해주세요."); return; }
    
    try {
      if (isEditMode && targetApptId) {
        // [수정] API 호출 (서버 API가 날짜/시간만 변경하는지, 의사도 변경 가능한지 확인 필요)
        // 여기서는 기존 서버 API 구조 상 'change'가 날짜/시간만 바꾼다고 가정했으나,
        // UI가 통합되었으므로, 실제로는 의사/증상 변경 API도 필요할 수 있음.
        // *현재 제공된 index.js 기준으로는 /change/:id는 date, time만 받음*
        // *증상이나 의사 변경이 필요하면 서버 코드 수정 필요하지만, 여기선 date/time 위주로 처리*
        
        await fetch(`${API_URL}/appointments/change/${targetApptId}`, {
           method: 'PUT',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ date: selectedDate, time: selectedTime })
        });
        Alert.alert("성공", "예약이 변경되었습니다.");

      } else {
        // [추가] API 호출
        await fetch(`${API_URL}/appointments`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ 
            patient_id: userId, doctor_id: selectedDoctorId, 
            date: selectedDate, time: selectedTime, symptoms: symptoms
          })
        });
        Alert.alert("성공", "예약이 신청되었습니다.");
      }
      
      setModalVisible(false);
      fetchAllData();
    } catch (e) { Alert.alert("오류", "작업 실패"); }
  };

  // 4. 예약 취소
  const handleCancelAppt = async (id: number) => {
    Alert.alert("예약 취소", "정말 취소하시겠습니까?", [
      { text: "아니오" },
      { text: "네", onPress: async () => {
          await fetch(`${API_URL}/appointments/cancel/${id}`, { method: 'PUT' });
          fetchAllData();
      }}
    ]);
  };


  // ==========================================================
  //  [달력] 로직 (Pure JS)
  // ==========================================================
  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calDayCell} />);
    }
    // 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${(`0${calMonth+1}`).slice(-2)}-${(`0${d}`).slice(-2)}`;
      const isSelected = selectedDate === dateStr;
      days.push(
        <TouchableOpacity key={d} style={[styles.calDayCell, isSelected && styles.calDaySelected]} 
          onPress={() => { setSelectedDate(dateStr); setCalendarVisible(false); }}>
          <Text style={{color: isSelected?'white':'black', fontWeight: isSelected?'bold':'normal'}}>{d}</Text>
        </TouchableOpacity>
      );
    }

    const changeMonth = (offset: number) => {
      let nm = calMonth + offset;
      let ny = calYear;
      if (nm > 11) { nm = 0; ny++; }
      else if (nm < 0) { nm = 11; ny--; }
      setCalMonth(nm);
      setCalYear(ny);
    };

    return (
      <View style={styles.calContent}>
        <View style={styles.calHeader}>
           <TouchableOpacity onPress={()=>changeMonth(-1)}><Text style={styles.calNav}>◀</Text></TouchableOpacity>
           <Text style={styles.calTitle}>{calYear}년 {calMonth+1}월</Text>
           <TouchableOpacity onPress={()=>changeMonth(1)}><Text style={styles.calNav}>▶</Text></TouchableOpacity>
        </View>
        <View style={styles.calWeekRow}>
           {['일','월','화','수','목','금','토'].map((w,i)=><Text key={w} style={[styles.calWeekText, i===0&&{color:'red'}]}>{w}</Text>)}
        </View>
        <View style={styles.calDaysContainer}>{days}</View>
        <TouchableOpacity style={styles.calCloseBtn} onPress={()=>setCalendarVisible(false)}>
           <Text style={{color:'white'}}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ==========================================================
  //  [게시판] 로직 (기존 유지)
  // ==========================================================
  const openWriteModal = () => { setIsPostEditMode(false); setTargetPostId(null); setPostTitle(''); setPostContent(''); setWriteModalVisible(true); };
  const openPostEditModal = (item: any) => { setIsPostEditMode(true); setTargetPostId(item.id); setPostTitle(item.title); setPostContent(item.content); setWriteModalVisible(true); };
  const handlePostSubmit = async () => { /* ... 생략 (기존과 동일하다고 가정) ... */ setWriteModalVisible(false); fetchAllData(); }; 
  // (게시판 로직은 너무 길어져서 위 기존 코드 로직 그대로 사용하시면 됩니다.)


  // --- 렌더링 헬퍼 ---
  const renderDate = (date: string) => date ? date.split('T')[0] : '';
  const renderTime = (time: string) => time ? time.toString().slice(0, 5) : '';
  const reservationList = myList.filter((item:any) => item.status !== 'completed' && item.status !== 'cancelled');
  const historyList = myList.filter((item:any) => item.status === 'completed');

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏥 Patient 홈</Text>
        <View style={{alignItems:'flex-end'}}>
          <Text style={{fontSize:14, fontWeight:'600'}}>{name}님</Text>
          <TouchableOpacity onPress={() => navigation.replace('Auth')}>
            <Text style={{color:'#e74c3c', fontSize:12}}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭 */}
      <View style={styles.tabContainer}>
        {['reservation', 'history', 'board'].map(tab => (
           <TouchableOpacity key={tab} 
             style={[styles.tabBtn, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
             <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
               {tab === 'reservation' ? '내 예약' : tab === 'history' ? '진료기록' : '게시판'}
             </Text>
           </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {/* 탭 1: 예약 관리 */}
        {activeTab === 'reservation' && (
          <View style={{flex:1}}>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
              <Text style={styles.addBtnText}>+ 새 진료 예약하기</Text>
            </TouchableOpacity>

            <FlatList
              data={reservationList}
              keyExtractor={(item:any) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
              contentContainerStyle={{paddingBottom:20}}
              renderItem={({item}) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.department} - {item.doctor_name} 선생님</Text>
                    <View style={[styles.statusBadge, item.status === 'waiting' ? {backgroundColor: '#fdf2e9'} : {backgroundColor: '#eafaf1'}]}>
                      <Text style={{color: item.status==='waiting'?'#e67e22':'#27ae60', fontWeight:'bold'}}>{item.status==='waiting'?'대기':'진료중'}</Text>
                    </View>
                  </View>
                  <View style={styles.dateTimeRow}>
                    <Text style={styles.dateText}>📅 {renderDate(item.date)}</Text>
                    <Text style={styles.timeText}>🕒 {renderTime(item.time)}</Text>
                  </View>
                  <Text style={styles.symptomsText}>증상: {item.symptoms || '-'}</Text>
                  <View style={styles.divider}/>
                  
                  {item.status === 'waiting' && (
                    <View style={styles.cardActionRow}>
                      {/* 수정 버튼: openEditModal 호출 */}
                      <TouchableOpacity style={styles.actionBtnOutline} onPress={() => openEditModal(item)}>
                        <Text style={{color:'#3498db', fontWeight:'600'}}>예약 변경</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtnOutline, {borderColor:'#ff6b6b'}]} onPress={() => handleCancelAppt(item.id)}>
                        <Text style={{color:'#ff6b6b', fontWeight:'600'}}>예약 취소</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>예약 내역이 없습니다.</Text>}
            />
          </View>
        )}

        {/* 탭 2, 3 생략 (기존 코드와 동일) ... */}
        {activeTab === 'history' && (
           <FlatList
             data={historyList}
             keyExtractor={(item:any)=>item.id.toString()}
             refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
             renderItem={({item})=>(
               <View style={styles.card}>
                 <Text style={styles.cardTitle}>{item.doctor_name} ({item.department})</Text>
                 <Text style={{color:'#888', marginBottom:10}}>{renderDate(item.date)}</Text>
                 <View style={styles.resultBox}>
                   <Text>진단: {item.diagnosis}</Text>
                   <Text>처방: {item.prescription}</Text>
                 </View>
               </View>
             )}
             ListEmptyComponent={<Text style={styles.emptyText}>기록 없음</Text>}
           />
        )}
        {activeTab === 'board' && (
           <View style={{flex:1}}>
             <TouchableOpacity style={styles.addBtn} onPress={openWriteModal}><Text style={styles.addBtnText}>✏️ 글쓰기</Text></TouchableOpacity>
             <FlatList data={posts} keyExtractor={(i:any)=>i.id.toString()} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
               renderItem={({item})=><View style={styles.card}><Text style={styles.cardTitle}>{item.title}</Text><Text>{item.content}</Text></View>}
             />
           </View>
        )}
      </View>


      {/* ================================================== */}
      {/*   [통합 예약 모달] (추가/수정 겸용)                */}
      {/* ================================================== */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{isEditMode ? '예약 변경' : '새 진료 예약'}</Text>
          
          <ScrollView>
            {/* 1. 진료과 선택 */}
            <Text style={styles.label}>1. 진료과 선택</Text>
            <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:10}}>
              {['내과', '정형외과', '치과', '안과', '피부과'].map(dept => (
                <TouchableOpacity key={dept} 
                  style={[styles.chip, selectedDept===dept && styles.activeChip]} 
                  onPress={()=>{ setSelectedDept(dept); setSelectedDoctorId(null); }}>
                  <Text style={{color:selectedDept===dept?'white':'#555', fontWeight:'bold'}}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2. 의사 선택 */}
            <Text style={styles.label}>2. 의사 선택</Text>
            <View style={styles.doctorSelectBox}>
              {doctors.filter((d:any) => d.department === selectedDept).map((d:any) => (
                  <TouchableOpacity key={d.id} style={[styles.doctorItem, selectedDoctorId===d.id && {backgroundColor:'#e3f2fd'}]} onPress={()=>setSelectedDoctorId(d.id)}>
                    <Text style={{fontWeight:selectedDoctorId===d.id?'bold':'normal'}}>👨‍⚕️ {d.name} 선생님</Text>
                  </TouchableOpacity>
              ))}
              {doctors.filter((d:any) => d.department === selectedDept).length === 0 && <Text style={{padding:10, color:'#999'}}>해당 진료과 의사가 없습니다.</Text>}
            </View>

            {/* 3. 날짜 및 시간 선택 (달력/타임피커 토글) */}
            <Text style={styles.label}>3. 날짜 / 시간 선택</Text>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
              
              {/* 날짜 버튼 */}
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setCalendarVisible(true)}>
                <Text style={{color:'#333', fontSize:16}}>📅 {selectedDate}</Text>
              </TouchableOpacity>

              {/* 시간 버튼 */}
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setTimeModalVisible(true)}>
                <Text style={{color:'#333', fontSize:16}}>🕒 {selectedTime}</Text>
              </TouchableOpacity>
            </View>

            {/* 4. 증상 입력 */}
            <Text style={styles.label}>4. 증상 (선택)</Text>
            <TextInput style={styles.input} value={symptoms} onChangeText={setSymptoms} placeholder="증상을 입력하세요."/>

            {/* 버튼 영역 */}
            <View style={{marginTop:30, marginBottom:50}}>
              <TouchableOpacity style={styles.fullBtn} onPress={handleSubmitReservation}>
                <Text style={styles.fullBtnText}>{isEditMode ? '변경 완료' : '예약 완료'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={() => setModalVisible(false)}>
                <Text style={styles.fullBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>


      {/* ================================================== */}
      {/*   [달력 모달] (날짜 선택용)                        */}
      {/* ================================================== */}
      <Modal visible={calendarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {renderCalendar()}
        </View>
      </Modal>


      {/* ================================================== */}
      {/*   [시간 선택 모달] (스크롤 목록)                   */}
      {/* ================================================== */}
      <Modal visible={timeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContent}>
            <Text style={{fontSize:18, fontWeight:'bold', marginBottom:15}}>시간 선택</Text>
            <ScrollView style={{maxHeight: 300, width:'100%'}}>
              {TIME_SLOTS.map(time => (
                <TouchableOpacity key={time} style={styles.timeSlot} onPress={() => { setSelectedTime(time); setTimeModalVisible(false); }}>
                  <Text style={{fontSize:16, color: selectedTime === time ? '#3498db' : '#333', fontWeight: selectedTime === time ? 'bold' : 'normal'}}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.fullBtn, {marginTop:15, backgroundColor:'#95a5a6'}]} onPress={() => setTimeModalVisible(false)}>
               <Text style={styles.fullBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 게시판 모달 (기존 구조 유지) */}
      <Modal visible={writeModalVisible} animationType="slide">
         {/* ... (생략, 기존과 동일한 UI) ... */}
         <View style={styles.modalContainer}>
             <Text>게시글 작성 (생략)</Text>
             <TouchableOpacity onPress={()=>setWriteModalVisible(false)}><Text>닫기</Text></TouchableOpacity>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { padding: 20, paddingTop:50, flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', backgroundColor:'#fff', borderBottomWidth:1, borderColor:'#eee' },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  
  tabContainer: { flexDirection: 'row', backgroundColor:'#fff' },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: '#3498db' },
  tabText: { fontSize: 16, color:'#999' },
  activeTabText: { color: '#3498db', fontWeight: 'bold' },

  content: { flex: 1, padding: 15 },
  addBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  addBtnText: { color: 'white', fontWeight: 'bold', fontSize:16 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#bdc3c7' },

  card: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color:'#2c3e50' },
  statusBadge: { paddingHorizontal:8, paddingVertical:4, borderRadius:12 },
  dateTimeRow: { flexDirection:'row', marginBottom:10 },
  dateText: { marginRight:15, color:'#555', fontWeight:'bold' },
  timeText: { color:'#555', fontWeight:'bold' },
  symptomsText: { color:'#7f8c8d' },
  divider: { height:1, backgroundColor:'#eee', marginVertical:15 },
  cardActionRow: { flexDirection:'row', justifyContent:'flex-end', gap:10 },
  actionBtnOutline: { paddingVertical:6, paddingHorizontal:15, borderRadius:6, borderWidth:1, borderColor:'#ddd' },
  resultBox: { backgroundColor:'#f9f9f9', padding:10, borderRadius:8 },

  // 모달 공통
  modalContainer: { flex: 1, padding: 25, paddingTop: 60, backgroundColor:'#fff' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 8, marginTop: 15, color:'#34495e' },
  input: { borderWidth: 1, borderColor: '#dcdde1', padding: 12, borderRadius: 8, fontSize:16, backgroundColor:'#fdfdfd' },
  fullBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', width:'100%' },
  fullBtnText: { color:'white', fontWeight:'bold', fontSize:16 },

  // 진료과 칩
  chip: { paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderColor:'#dcdde1', borderRadius:20, marginRight:8, marginBottom:8 },
  activeChip: { backgroundColor: '#3498db', borderColor: '#3498db' },
  
  // 의사 선택 박스
  doctorSelectBox: { maxHeight: 150, borderWidth:1, borderColor:'#dcdde1', borderRadius:8, marginBottom:10 },
  doctorItem: { padding: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },

  // 날짜/시간 선택 버튼 (Input 대신 사용)
  datePickerBtn: { flex:0.48, padding:15, borderWidth:1, borderColor:'#bdc3c7', borderRadius:8, alignItems:'center', backgroundColor:'#fff' },

  // 달력 모달 스타일
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding:20, alignItems:'center' },
  calContent: { width: '90%', backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 5 },
  calHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15 },
  calNav: { fontSize:20, padding:10, color:'#3498db' },
  calTitle: { fontSize:18, fontWeight:'bold' },
  calWeekRow: { flexDirection:'row', justifyContent:'space-around', marginBottom:10 },
  calWeekText: { width:'14%', textAlign:'center', fontWeight:'bold' },
  calDaysContainer: { flexDirection:'row', flexWrap:'wrap' },
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent:'center', alignItems:'center', marginVertical: 2 },
  calDaySelected: { backgroundColor:'#3498db', borderRadius:20 },
  calCloseBtn: { marginTop:20, padding:12, backgroundColor:'#34495e', borderRadius:8, alignItems:'center' },

  // 시간 선택 모달 스타일
  timeModalContent: { width: '80%', backgroundColor: 'white', padding: 25, borderRadius: 15, alignItems:'center', elevation: 5 },
  timeSlot: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee', width: '100%', alignItems: 'center' },

});