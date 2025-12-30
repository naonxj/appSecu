import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, RefreshControl
} from 'react-native';

//const API_URL = 'http://10.0.2.2:3000/api'; // 실기기 테스트 시 본인 PC IP로 변경 필수
const API_URL = 'http://192.168.16.50/api';
// 시간 슬롯 생성
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00'
];

// [안전한] 날짜 포맷 헬퍼 (Date 객체 -> String)
const formatDate = (date: Date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = (`0${date.getMonth() + 1}`).slice(-2);
  const d = (`0${date.getDate()}`).slice(-2);
  return `${y}-${m}-${d}`;
};

// [안전한] 문자열 날짜 렌더링 (String -> String)
const safeDate = (dateStr: any) => {
  if (!dateStr) return '';
  // 2025-01-01T00:00:00.000Z 형태일 경우 앞만 자름
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
};

// [안전한] 시간 렌더링
const safeTime = (timeStr: any) => {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
};

export default function PatientScreen({ route, navigation }: any) {
  // 파라미터 안전하게 받기
  const params = route?.params || {};

  //1219수정
  console.log("환자화면 진입 시 받은 파라미터:", params); // <- 여기서 userId가 찍혀야 합니다.
  //const { userId, name } = params;
  const userId = params.userId; 
  const name = params.name;

  const [activeTab, setActiveTab] = useState('reservation');
  const [refreshing, setRefreshing] = useState(false);
  
  // 데이터 목록 (초기값은 빈 배열)
  const [myList, setMyList] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  // === 예약 모달 State ===
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [targetApptId, setTargetApptId] = useState<number | null>(null);

  const [selectedDept, setSelectedDept] = useState('내과');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [symptoms, setSymptoms] = useState('');

  // === 달력/시간 모달 State ===
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // === 게시판 State ===
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [isPostEditMode, setIsPostEditMode] = useState(false);
  const [targetPostId, setTargetPostId] = useState<number | null>(null);
  const [postCategory, setPostCategory] = useState('Q&A');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  // --- 데이터 불러오기 (에러 방지 로직 추가) ---
  const fetchAllData = useCallback(async () => {
    if (!userId) return;

    // 공통 Fetch 함수
    const fetchData = async (url: string) => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          // 배열인지 확인 후 반환, 아니면 빈 배열 반환
          return Array.isArray(json) ? json : [];
        }
      } catch (e) {
        console.error(`Fetch Error (${url}):`, e);
      }
      return [];
    };

    // 병렬로 데이터 요청
    const [appointments, doctorsData, postsData] = await Promise.all([
      fetchData(`${API_URL}/appointments/patient/${userId}`),
      fetchData(`${API_URL}/doctors`),
      fetchData(`${API_URL}/posts`)
    ]);

    setMyList(appointments);
    setDoctors(doctorsData);
    setPosts(postsData);
  }, [userId]);

  // 화면이 포커스되거나 userId가 바뀔 때 실행
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // --- 예약 관련 핸들러 ---
  const openAddModal = () => {
    setIsEditMode(false);
    setTargetApptId(null);
    setSelectedDept('내과');
    setSelectedDoctorId(null);
    setSelectedDate(formatDate(new Date()));
    setSelectedTime('09:00');
    setSymptoms('');
    setModalVisible(true);
  };

  const openEditModal = (appt: any) => {
    setIsEditMode(true);
    setTargetApptId(appt.id);
    setSelectedDept(appt.department || '내과');
    setSelectedDoctorId(appt.doctor_id);
    setSelectedDate(safeDate(appt.date) || formatDate(new Date()));
    setSelectedTime(safeTime(appt.time) || '09:00');
    setSymptoms(appt.symptoms || '');
    setModalVisible(true);
  };

  const handleSubmitReservation = async () => {
    if (!selectedDoctorId) { Alert.alert("알림", "의사를 선택해주세요."); return; }
    
    try {
      if (isEditMode && targetApptId) {
        await fetch(`${API_URL}/appointments/change/${targetApptId}`, {
           method: 'PUT',
           headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ date: selectedDate, time: selectedTime })
        });
        Alert.alert("성공", "예약이 변경되었습니다.");
      } else {
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

  const handleCancelAppt = (id: number) => {
    Alert.alert("예약 취소", "정말 취소하시겠습니까?", [
      { text: "취소" },
      { text: "확인", onPress: async () => {
          try {
            await fetch(`${API_URL}/appointments/cancel/${id}`, { method: 'PUT' });
            fetchAllData();
          } catch(e) { Alert.alert("오류", "취소 실패"); }
      }}
    ]);
  };

  // --- 게시판 핸들러 ---
  const openWriteModal = () => { 
    setIsPostEditMode(false); 
    setTargetPostId(null); 
    setPostCategory('Q&A');
    setPostTitle(''); 
    setPostContent(''); 
    setWriteModalVisible(true); 
  };

  const openPostEditModal = (item: any) => { 
    setIsPostEditMode(true); 
    setTargetPostId(item.id); 
    setPostCategory(item.category || 'Q&A');
    setPostTitle(item.title); 
    setPostContent(item.content); 
    setWriteModalVisible(true); 
  };

  const handlePostSubmit = async () => { 
    if(!postTitle || !postContent) { Alert.alert("알림", "제목과 내용을 입력하세요."); return; }
    try {
      //1219 수정
      if (!userId) {
        Alert.alert("오류", "로그인 정보가 없습니다. 다시 로그인해주세요.");
        return;
      }
      const body = {
        user_id: userId,
        author_name: name || '익명',
        category: postCategory,
        title: postTitle,
        content: postContent,
        file_path: ''
      };

      if (isPostEditMode && targetPostId) {
        await fetch(`${API_URL}/posts/${targetPostId}`, {
          method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
        });
        Alert.alert("성공", "수정되었습니다.");
      } else {
        await fetch(`${API_URL}/posts`, {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
        });
        Alert.alert("성공", "등록되었습니다.");
      }
      setWriteModalVisible(false);
      fetchAllData();
    } catch(e) { Alert.alert("오류", "저장 실패"); }
  };

  const handleDeletePost = (id: number) => {
    Alert.alert("삭제", "삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", onPress: async () => {
          try { await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE' }); fetchAllData(); } 
          catch(e) { Alert.alert("오류", "삭제 실패"); }
      }}
    ]);
  };

  // --- 달력 렌더링 ---
  const renderCalendar = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calDayCell} />);
    }
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

  // 데이터 필터링 (배열인지 한번 더 확인)
  const safeList = Array.isArray(myList) ? myList : [];
  const reservationList = safeList.filter((item:any) => item.status !== 'completed' && item.status !== 'cancelled');
  const historyList = safeList.filter((item:any) => item.status === 'completed');
  const safePosts = Array.isArray(posts) ? posts : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏥 Patient 홈</Text>
        <View style={{alignItems:'flex-end'}}>
          <Text style={{fontSize:14, fontWeight:'600'}}>{name}님</Text>
          <TouchableOpacity onPress={() => navigation.replace('Auth')}>
            <Text style={{color:'#e74c3c', fontSize:12}}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

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
        {/* 탭 1: 예약 */}
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
                    <Text style={styles.dateText}>📅 {safeDate(item.date)}</Text>
                    <Text style={styles.timeText}>🕒 {safeTime(item.time)}</Text>
                  </View>
                  <Text style={styles.symptomsText}>증상: {item.symptoms || '-'}</Text>
                  <View style={styles.divider}/>
                  
                  {item.status === 'waiting' && (
                    <View style={styles.cardActionRow}>
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

        {/* 탭 2: 기록 */}
        {activeTab === 'history' && (
           <FlatList
             data={historyList}
             keyExtractor={(item:any)=>item.id.toString()}
             refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
             renderItem={({item})=>(
               <View style={styles.card}>
                  <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:5}}>
                    <Text style={{fontSize:16, fontWeight:'bold', color:'#1f2937'}}>
                      {item.doctor_name} 선생님 ({item.department})
                    </Text>
                    <Text style={{fontSize:12, color:'#9ca3af'}}>진료완료</Text>
                  </View>
                  <Text style={{color:'#6b7280', marginBottom:15, fontSize:13}}>
                    {safeDate(item.date)} 진료
                  </Text>
                 <View style={styles.resultBox}>
                    <View style={styles.resultRow}>
                       <Text style={styles.resultLabel}>병명:</Text>
                       <Text style={styles.resultValue}>{item.diagnosis || '-'}</Text>
                    </View>
                    <View style={styles.resultRow}>
                       <Text style={styles.resultLabel}>처방:</Text>
                       <Text style={styles.resultValue}>{item.prescription || '-'}</Text>
                    </View>
                    <View style={styles.resultRow}>
                       <Text style={styles.resultLabel}>소견:</Text>
                       <Text style={styles.resultValue}>{item.doctor_opinion || '-'}</Text>
                    </View>
                 </View>
               </View>
             )}
             ListEmptyComponent={<Text style={styles.emptyText}>기록 없음</Text>}
           />
        )}

        {/* 탭 3: 게시판 */}
        {activeTab === 'board' && (
           <View style={{flex:1}}>
             <TouchableOpacity style={styles.addBtn} onPress={openWriteModal}>
               <Text style={styles.addBtnText}>✏️ 새 글 작성하기</Text>
             </TouchableOpacity>

             <FlatList 
               data={safePosts} 
               keyExtractor={(i:any)=>i.id.toString()} 
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
               contentContainerStyle={{paddingBottom:20}}
               renderItem={({item}) => {
                 const isMyPost = item.user_id == userId;
                 const badgeColor = item.category === 'system_error' ? '#f39c12' : '#3b82f6';
                 const badgeText = item.category === 'system_error' ? '오류' : 'Q&A';

                 return (
                   <View style={styles.card}>
                     <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                       <View style={{flexDirection:'row', alignItems:'center'}}>
                         <View style={[styles.badge, {backgroundColor: badgeColor}]}>
                           <Text style={styles.badgeText}>{badgeText}</Text>
                         </View>
                         <Text style={{fontSize:13, color:'#9ca3af', marginLeft:8}}>
                           {safeDate(item.created_at)}
                         </Text>
                       </View>
                       <Text style={{fontSize:13, color:'#6b7280'}}>
                         {item.author_name}
                       </Text>
                     </View>

                     <Text style={styles.boardTitle}>{item.title}</Text>
                     <Text style={styles.boardContent} numberOfLines={2}>{item.content}</Text>
                     
                     {isMyPost && (
                        <View style={{flexDirection:'row', justifyContent:'flex-end', gap:8, marginTop:15}}>
                          <TouchableOpacity style={styles.outlineBtnBlueSmall} onPress={() => openPostEditModal(item)}>
                            <Text style={{color:'#3b82f6', fontSize:12, fontWeight:'600'}}>수정</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.outlineBtnRedSmall} onPress={() => handleDeletePost(item.id)}>
                            <Text style={{color:'#ef4444', fontSize:12, fontWeight:'600'}}>삭제</Text>
                          </TouchableOpacity>
                        </View>
                     )}
                   </View>
                 );
               }}
               ListEmptyComponent={<Text style={styles.emptyText}>게시글이 없습니다.</Text>}
             />
           </View>
        )}
      </View>

      {/* === 예약 모달 === */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{isEditMode ? '예약 변경' : '새 진료 예약'}</Text>
          <ScrollView>
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

            <Text style={styles.label}>2. 의사 선택</Text>
            <View style={styles.doctorSelectBox}>
              {Array.isArray(doctors) && doctors.filter((d:any) => d.department === selectedDept).map((d:any) => (
                  <TouchableOpacity key={d.id} style={[styles.doctorItem, selectedDoctorId===d.id && {backgroundColor:'#e3f2fd'}]} onPress={()=>setSelectedDoctorId(d.id)}>
                    <Text style={{fontWeight:selectedDoctorId===d.id?'bold':'normal'}}>👨‍⚕️ {d.name} 선생님</Text>
                  </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>3. 날짜 / 시간 선택</Text>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setCalendarVisible(true)}>
                <Text style={{color:'#333', fontSize:16}}>📅 {selectedDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setTimeModalVisible(true)}>
                <Text style={{color:'#333', fontSize:16}}>🕒 {selectedTime}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>4. 증상 (선택)</Text>
            <TextInput style={styles.input} value={symptoms} onChangeText={setSymptoms} placeholder="증상을 입력하세요."/>

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

      {/* === 달력 모달 === */}
      <Modal visible={calendarVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {renderCalendar()}
        </View>
      </Modal>

      {/* === 시간 선택 모달 === */}
      <Modal visible={timeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContent}>
            <Text style={{fontSize:18, fontWeight:'bold', marginBottom:15}}>시간 선택</Text>
            <ScrollView style={{maxHeight: 300, width:'100%'}}>
              {TIME_SLOTS.map(time => (
                <TouchableOpacity key={time} style={styles.timeSlot} onPress={() => { setSelectedTime(time); setTimeModalVisible(false); }}>
                  <Text style={{color: selectedTime === time ? '#3498db' : '#333', fontWeight: selectedTime === time ? 'bold' : 'normal'}}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.fullBtn, {marginTop:15, backgroundColor:'#95a5a6'}]} onPress={() => setTimeModalVisible(false)}>
               <Text style={styles.fullBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === 글쓰기 모달 === */}
      <Modal visible={writeModalVisible} animationType="slide">
         <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isPostEditMode?'글 수정':'새 글 작성'}</Text>
            <Text style={styles.label}>1. 카테고리</Text>
            <View style={{flexDirection:'row', gap:10, marginBottom:10}}>
               <TouchableOpacity onPress={()=>setPostCategory('Q&A')} style={[styles.chip, postCategory==='Q&A' && {backgroundColor:'#3b82f6', borderColor:'#3b82f6'}]}>
                 <Text style={{color:postCategory==='Q&A'?'white':'#555'}}>Q&A</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={()=>setPostCategory('system_error')} style={[styles.chip, postCategory==='system_error' && { backgroundColor: '#f39c12', borderColor: '#f39c12' }]}>
                  <Text style={{color:postCategory==='system_error'?'white':'#555'}}>오류신고</Text>
               </TouchableOpacity>
            </View>
            <Text style={styles.label}>2. 제목</Text>
            <TextInput style={styles.input} value={postTitle} onChangeText={setPostTitle} placeholder="제목 입력"/>
            <Text style={styles.label}>3. 내용</Text>
            <TextInput style={[styles.input, {height:150, textAlignVertical:'top'}]} multiline value={postContent} onChangeText={setPostContent} placeholder="내용 입력"/>
            
            <View style={{marginTop:20}}>
              <TouchableOpacity style={styles.fullBtn} onPress={handlePostSubmit}>
                <Text style={styles.fullBtnText}>완료</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={()=>setWriteModalVisible(false)}>
                <Text style={styles.fullBtnText}>취소</Text>
              </TouchableOpacity>
            </View>
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
  resultRow: { flexDirection:'row', marginBottom:6 },
  resultLabel: { fontWeight:'bold', color:'#374151', width:40, marginRight:5 },
  resultValue: { color:'#4b5563', flex:1 },

  badge: { paddingHorizontal:8, paddingVertical:3, borderRadius:4, marginRight:5 },
  badgeText: { color:'white', fontSize:11, fontWeight:'bold' },
  boardTitle: { fontSize:16, fontWeight:'bold', color:'#1f2937', marginBottom:6 },
  boardContent: { color:'#6b7280', lineHeight:20 },
  outlineBtnBlueSmall: { borderWidth:1, borderColor:'#3b82f6', paddingVertical:5, paddingHorizontal:12, borderRadius:4 },
  outlineBtnRedSmall: { borderWidth:1, borderColor:'#ef4444', paddingVertical:5, paddingHorizontal:12, borderRadius:4 },

  modalContainer: { flex: 1, padding: 25, paddingTop: 60, backgroundColor:'#fff' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 8, marginTop: 15, color:'#34495e' },
  input: { borderWidth: 1, borderColor: '#dcdde1', padding: 12, borderRadius: 8, fontSize:16, backgroundColor:'#fdfdfd' },
  fullBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', width:'100%' },
  fullBtnText: { color:'white', fontWeight:'bold', fontSize:16 },

  chip: { paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderColor:'#dcdde1', borderRadius:20, marginRight:8, marginBottom:8 },
  activeChip: { backgroundColor: '#3498db', borderColor: '#3498db' },
  doctorSelectBox: { maxHeight: 150, borderWidth:1, borderColor:'#dcdde1', borderRadius:8, marginBottom:10 },
  doctorItem: { padding: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  datePickerBtn: { flex:0.48, padding:15, borderWidth:1, borderColor:'#bdc3c7', borderRadius:8, alignItems:'center', backgroundColor:'#fff' },

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

  timeModalContent: { width: '80%', backgroundColor: 'white', padding: 25, borderRadius: 15, alignItems:'center', elevation: 5 },
  timeSlot: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee', width: '100%', alignItems: 'center' },
});