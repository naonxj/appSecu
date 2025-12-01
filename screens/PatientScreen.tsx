import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, RefreshControl
} from 'react-native';

// ★ 경로 확인: screens 폴더 안에 있다면 '../database' 가 맞습니다.
import { 
  getPatientAppointments, getDoctors, getPosts, 
  createAppointment, changeAppointment, cancelAppointment, 
  createPost, updatePost, deletePost 
} from '../database';

// 날짜 포맷 (YYYY-MM-DD)
const formatDate = (date: Date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 시간 슬롯 (30분 단위)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
];

export default function PatientScreen({ route, navigation }: any) {
  const params = route?.params || {};
  const { userId, username, name } = params;

  // 탭 상태
  const [activeTab, setActiveTab] = useState('reservation');
  const [refreshing, setRefreshing] = useState(false);
  
  // 데이터 상태
  const [myList, setMyList] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  // === 예약 관련 State ===
  const [resModalVisible, setResModalVisible] = useState(false);
  const [newDate, setNewDate] = useState(formatDate(new Date()));
  const [newTime, setNewTime] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [selectedDept, setSelectedDept] = useState('내과');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // === 예약 변경 State ===
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [targetAppt, setTargetAppt] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // === 달력/시간 선택기 State ===
  const [pickerMode, setPickerMode] = useState<'new' | 'edit'>('new');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // === 게시판 State ===
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [targetPostId, setTargetPostId] = useState<number | null>(null);
  const [postCategory, setPostCategory] = useState('Q&A');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  // --- 데이터 불러오기 ---
  const fetchAllData = useCallback(async () => {
    if (!userId) return;
    try {
      const [apptsData, docsData, postsData] = await Promise.all([
        getPatientAppointments(userId).catch(() => []),
        getDoctors().catch(() => []),
        getPosts().catch(() => [])
      ]);
      setMyList(apptsData || []);
      setDoctors(docsData || []);
      setPosts(postsData || []);
    } catch (e) { console.error(e); }
  }, [userId]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // --- [기능] 날짜/시간 선택기 ---
  const openCalendarModal = (mode: 'new' | 'edit') => {
    setPickerMode(mode);
    const dateStr = mode === 'new' ? newDate : editDate;
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        setCalYear(parseInt(parts[0], 10));
        setCalMonth(parseInt(parts[1], 10) - 1);
      }
    }
    setShowCalendar(true);
  };

  const openTimeModal = (mode: 'new' | 'edit') => {
    setPickerMode(mode);
    setShowTimePicker(true);
  };

  const handleDateSelect = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (pickerMode === 'new') setNewDate(dateStr);
    else setEditDate(dateStr);
    setShowCalendar(false);
  };

  const handleTimeSelect = (timeStr: string) => {
    if (pickerMode === 'new') setNewTime(timeStr);
    else setEditTime(timeStr);
    setShowTimePicker(false);
  };

  const changeMonth = (offset: number) => {
    let newM = calMonth + offset;
    let newY = calYear;
    if (newM > 11) { newM = 0; newY++; }
    else if (newM < 0) { newM = 11; newY--; }
    setCalMonth(newM); setCalYear(newY);
  };

  const renderCalendarGrid = () => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const grid = [];
    for(let i=0; i<firstDay; i++) grid.push(<View key={`empty-${i}`} style={styles.calDayCell} />);
    for(let d=1; d<=daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const targetDate = pickerMode === 'new' ? newDate : editDate;
      const isSelected = targetDate === dateStr;
      grid.push(
        <TouchableOpacity key={`day-${d}`} style={[styles.calDayCell, isSelected && styles.calDaySelected]} onPress={() => handleDateSelect(d)}>
          <Text style={{color: isSelected?'white':'black', fontWeight: isSelected?'bold':'normal'}}>{d}</Text>
        </TouchableOpacity>
      );
    }
    return grid;
  };

  // --- 예약 액션 ---
  const handleReservation = async () => {
    if (!selectedDoctorId) { Alert.alert("알림", "의사를 선택해주세요."); return; }
    if (!newTime) { Alert.alert("알림", "시간을 선택해주세요."); return; }
    try {
      await createAppointment(userId, selectedDoctorId, newDate, newTime, symptoms);
      Alert.alert("성공", "예약되었습니다.");
      setResModalVisible(false);
      setSymptoms(''); setNewTime(''); 
      fetchAllData();
    } catch (e) { Alert.alert("오류", "예약 실패"); }
  };

  const handleEditAppt = async () => {
    if (!targetAppt) return;
    try {
      await changeAppointment(targetAppt.id, editDate, editTime);
      Alert.alert("성공", "예약이 변경되었습니다.");
      setEditModalVisible(false);
      fetchAllData();
    } catch (e) { Alert.alert("오류", "변경 실패"); }
  };

  const handleCancelAppt = (id: number) => {
    Alert.alert("예약 취소", "정말 취소하시겠습니까?", [
      { text: "아니오" },
      { text: "네", onPress: async () => {
         try { await cancelAppointment(id); fetchAllData(); } 
         catch(e) { Alert.alert("오류", "취소 실패"); }
      }}
    ]);
  };

  // --- 게시판 액션 ---
  const handlePostSubmit = async () => {
    if(!postTitle || !postContent) { Alert.alert("알림", "제목과 내용을 입력하세요."); return; }
    try {
      if (isEditMode && targetPostId) {
        await updatePost(targetPostId, postTitle, postContent, postCategory, '');
      } else {
        await createPost(userId, name || '익명', postCategory, postTitle, postContent, '');
      }
      setWriteModalVisible(false);
      fetchAllData();
    } catch(e) { Alert.alert("오류", "저장 실패"); }
  };

  const handleDeletePost = (id: number) => {
    Alert.alert("삭제", "삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", onPress: async () => {
          try { await deletePost(id); fetchAllData(); } catch(e) {}
      }}
    ]);
  };

  const safeDate = (d: string) => d ? d.split('T')[0] : '';
  const safeTime = (t: string) => t ? String(t).slice(0, 5) : '';
  const reservationList = Array.isArray(myList) ? myList.filter(i => i.status !== 'completed' && i.status !== 'cancelled') : [];
  const historyList = Array.isArray(myList) ? myList.filter(i => i.status === 'completed') : [];

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏥 Patient 홈</Text>
        <View style={{alignItems:'flex-end'}}>
          <Text style={{fontSize:14, fontWeight:'bold', color:'#333'}}>{name}님</Text>
          <TouchableOpacity onPress={() => navigation.replace('Auth')}>
            <Text style={{color:'#e74c3c', fontSize:12, marginTop:2}}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭 */}
      <View style={styles.tabContainer}>
        {['reservation', 'history', 'board'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab===tab && styles.activeTab]} onPress={()=>setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab===tab && styles.activeTabText]}>
               {tab==='reservation'?'예약':tab==='history'?'기록':'게시판'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {/* [탭 1] 예약 */}
        {activeTab === 'reservation' && (
          <View style={{flex:1}}>
             <TouchableOpacity style={styles.addBtn} onPress={() => {
                setNewTime(''); setSymptoms(''); setSelectedDoctorId(null); setResModalVisible(true);
             }}>
               <Text style={styles.addBtnText}>+ 새 진료 예약</Text>
             </TouchableOpacity>

             <FlatList
               data={reservationList}
               keyExtractor={(item) => item.id.toString()}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
               contentContainerStyle={{paddingBottom:20}}
               renderItem={({item}) => (
                 <View style={styles.card}>
                   <View style={styles.cardHeader}>
                     <Text style={styles.cardTitle}>{item.department} - {item.doctor_name}</Text>
                     <Text style={{color: item.status==='waiting'?'#e67e22':'#27ae60', fontWeight:'bold'}}>
                       {item.status==='waiting'?'대기중':'진료중'}
                     </Text>
                   </View>
                   <Text style={{marginBottom:5}}>📅 {safeDate(item.date)}  🕒 {safeTime(item.time)}</Text>
                   <Text style={{color:'#777'}}>증상: {item.symptoms || '-'}</Text>
                   
                   {item.status === 'waiting' && (
                     <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop:10, gap:10}}>
                       <TouchableOpacity style={styles.outlineBtn} onPress={()=>{
                          setTargetAppt(item); setEditDate(safeDate(item.date)); setEditTime(safeTime(item.time)); setEditModalVisible(true);
                       }}>
                         <Text style={{color:'#3498db'}}>변경</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={[styles.outlineBtn, {borderColor:'#ff6b6b'}]} onPress={()=>handleCancelAppt(item.id)}>
                         <Text style={{color:'#ff6b6b'}}>취소</Text>
                       </TouchableOpacity>
                     </View>
                   )}
                 </View>
               )}
               ListEmptyComponent={<Text style={styles.emptyText}>예약 내역이 없습니다.</Text>}
             />
          </View>
        )}

        {/* [탭 2] 진료 기록 */}
        {activeTab === 'history' && (
          <View style={{flex:1}}>
            <FlatList
              data={historyList}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
              renderItem={({item}) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.doctor_name} ({item.department})</Text>
                  <Text style={{color:'#555', marginBottom:10}}>{safeDate(item.date)} 진료완료</Text>
                  <View style={styles.resultBox}>
                    <Text>병명: {item.diagnosis}</Text>
                    <Text>처방: {item.prescription}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>진료 기록이 없습니다.</Text>}
            />
          </View>
        )}

        {/* [탭 3] 게시판 */}
        {activeTab === 'board' && (
           <View style={{flex:1}}>
             <TouchableOpacity style={styles.addBtn} onPress={()=>{
                setIsEditMode(false); setPostTitle(''); setPostContent(''); setWriteModalVisible(true);
             }}>
               <Text style={styles.addBtnText}>✏️ 글쓰기</Text>
             </TouchableOpacity>
             <FlatList
               data={posts}
               keyExtractor={(item) => item.id.toString()}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
               renderItem={({item}) => (
                 <View style={styles.card}>
                   <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                     <Text style={[styles.cardTitle, {fontSize:16}]}>{item.title}</Text>
                     <Text style={{fontSize:12, color:'#999'}}>{item.author_name}</Text>
                   </View>
                   <Text style={{color:'#555', marginVertical:5}} numberOfLines={2}>{item.content}</Text>
                   {item.user_id == userId && (
                      <View style={{flexDirection:'row', justifyContent:'flex-end', gap:10}}>
                        <TouchableOpacity onPress={()=>{
                           setIsEditMode(true); setTargetPostId(item.id); setPostTitle(item.title); setPostContent(item.content); setWriteModalVisible(true);
                        }}><Text style={{color:'#3498db'}}>수정</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>handleDeletePost(item.id)}><Text style={{color:'#e74c3c'}}>삭제</Text></TouchableOpacity>
                      </View>
                   )}
                 </View>
               )}
               ListEmptyComponent={<Text style={styles.emptyText}>게시글이 없습니다.</Text>}
             />
           </View>
        )}
      </View>

      {/* === 모달: 새 예약 === */}
      <Modal visible={resModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
           <Text style={styles.modalTitle}>새 예약</Text>
           
           <Text style={styles.label}>1. 진료과 & 의사</Text>
           <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:10}}>
             {['내과','정형외과','치과','안과','피부과'].map(d => (
               <TouchableOpacity key={d} style={[styles.chip, selectedDept===d && styles.activeChip]} onPress={()=>{setSelectedDept(d); setSelectedDoctorId(null);}}>
                 <Text style={{color:selectedDept===d?'white':'#555'}}>{d}</Text>
               </TouchableOpacity>
             ))}
           </View>
           <ScrollView style={styles.doctorBox}>
             {doctors.filter(doc => doc.department === selectedDept).map(doc => (
               <TouchableOpacity key={doc.id} style={[styles.docItem, selectedDoctorId===doc.id && {backgroundColor:'#e3f2fd'}]} onPress={()=>setSelectedDoctorId(doc.id)}>
                 <Text style={{fontWeight:selectedDoctorId===doc.id?'bold':'normal'}}>{doc.name} 선생님</Text>
               </TouchableOpacity>
             ))}
             {doctors.filter(d => d.department === selectedDept).length === 0 && <Text style={{color:'#999', padding:10}}>해당 과의 의사가 없습니다.</Text>}
           </ScrollView>

           <Text style={styles.label}>2. 날짜 & 시간</Text>
           <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
              <TouchableOpacity style={styles.dateBtn} onPress={()=>openCalendarModal('new')}>
                <Text style={{fontSize:16}}>📅 {newDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateBtn} onPress={()=>openTimeModal('new')}>
                <Text style={{fontSize:16}}>{newTime ? `🕒 ${newTime}` : '🕒 시간 선택'}</Text>
              </TouchableOpacity>
           </View>

           <Text style={styles.label}>3. 증상</Text>
           <TextInput style={styles.input} value={symptoms} onChangeText={setSymptoms} placeholder="증상 입력"/>

           <TouchableOpacity style={[styles.fullBtn, {marginTop:20}]} onPress={handleReservation}><Text style={styles.btnText}>예약하기</Text></TouchableOpacity>
           <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={()=>setResModalVisible(false)}><Text style={styles.btnText}>취소</Text></TouchableOpacity>
        </View>
      </Modal>

      {/* === 모달: 예약 변경 (새 예약과 동일한 전체화면 스타일 적용) === */}
      <Modal visible={editModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
           <Text style={styles.modalTitle}>예약 변경</Text>

           {/* 변경 대상 정보 표시 */}
           <View style={{backgroundColor:'#f0f0f0', padding:15, borderRadius:8, marginBottom:20}}>
              <Text style={{fontSize:16, fontWeight:'bold', color:'#333'}}>
                {targetAppt?.department} - {targetAppt?.doctor_name} 선생님
              </Text>
              <Text style={{color:'#666', marginTop:5}}>
                현재: {safeDate(targetAppt?.date)} {safeTime(targetAppt?.time)}
              </Text>
           </View>
           
           <Text style={styles.label}>변경할 날짜 & 시간 선택</Text>
           <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
              <TouchableOpacity style={styles.dateBtn} onPress={()=>openCalendarModal('edit')}>
                <Text style={{fontSize:16}}>📅 {editDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateBtn} onPress={()=>openTimeModal('edit')}>
                <Text style={{fontSize:16}}>{editTime ? `🕒 ${editTime}` : '🕒 시간 선택'}</Text>
              </TouchableOpacity>
           </View>
           
           <View style={{marginTop:30}}>
              <TouchableOpacity style={styles.fullBtn} onPress={handleEditAppt}>
                <Text style={styles.btnText}>수정 완료</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={()=>setEditModalVisible(false)}>
                <Text style={styles.btnText}>취소</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>

      {/* === 모달: 달력 === */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
                <TouchableOpacity onPress={()=>changeMonth(-1)}><Text style={{fontSize:18, padding:5}}>◀</Text></TouchableOpacity>
                <Text style={{fontSize:18, fontWeight:'bold'}}>{calYear}년 {calMonth+1}월</Text>
                <TouchableOpacity onPress={()=>changeMonth(1)}><Text style={{fontSize:18, padding:5}}>▶</Text></TouchableOpacity>
             </View>
             <View style={{flexDirection:'row', flexWrap:'wrap', width:'100%'}}>
               {renderCalendarGrid()}
             </View>
             <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#3498db', marginTop:10}]} onPress={()=>setShowCalendar(false)}>
               <Text style={styles.btnText}>닫기</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === 모달: 시간 선택 === */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>시간 선택</Text>
             <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center'}}>
                {TIME_SLOTS.map(t => (
                  <TouchableOpacity key={t} 
                    style={[styles.timeSlot, (pickerMode==='new'?newTime:editTime)===t && {backgroundColor:'#3498db'}]}
                    onPress={()=>handleTimeSelect(t)}>
                    <Text style={{color: (pickerMode==='new'?newTime:editTime)===t ? 'white':'#333'}}>{t}</Text>
                  </TouchableOpacity>
                ))}
             </View>
             <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:15}]} onPress={()=>setShowTimePicker(false)}>
               <Text style={styles.btnText}>취소</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === 모달: 글쓰기 === */}
      <Modal visible={writeModalVisible} animationType="slide">
         <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditMode?'글 수정':'새 글 작성'}</Text>
            <Text style={styles.label}>카테고리</Text>
            <View style={{flexDirection:'row', gap:10, marginBottom:10}}>
               <TouchableOpacity onPress={()=>setPostCategory('Q&A')} style={[styles.chip, postCategory==='Q&A'&&styles.activeChip]}><Text>Q&A</Text></TouchableOpacity>
               <TouchableOpacity onPress={()=>setPostCategory('system_error')} style={[styles.chip, postCategory==='system_error'&&styles.activeChip]}><Text>오류신고</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>제목</Text>
            <TextInput style={styles.input} value={postTitle} onChangeText={setPostTitle} placeholder="제목"/>
            <Text style={styles.label}>내용</Text>
            <TextInput style={[styles.input, {height:100, textAlignVertical:'top'}]} multiline value={postContent} onChangeText={setPostContent} placeholder="내용"/>
            
            <TouchableOpacity style={[styles.fullBtn, {marginTop:20}]} onPress={handlePostSubmit}><Text style={styles.btnText}>완료</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={()=>setWriteModalVisible(false)}><Text style={styles.btnText}>취소</Text></TouchableOpacity>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { padding: 20, paddingTop:50, flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'white', elevation:2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor:'white' },
  tabBtn: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth:2, borderColor:'transparent' },
  activeTab: { borderColor:'#3498db' },
  tabText: { color:'#999' },
  activeTabText: { color:'#3498db', fontWeight:'bold' },
  content: { flex: 1, padding: 15 },
  card: { backgroundColor:'white', padding:15, borderRadius:10, marginBottom:10, elevation:1 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom:5 },
  cardTitle: { fontSize:16, fontWeight:'bold' },
  resultBox: { backgroundColor:'#f9f9f9', padding:10, borderRadius:5, marginTop:5 },
  addBtn: { backgroundColor:'#3498db', padding:15, borderRadius:10, alignItems:'center', marginBottom:15 },
  addBtnText: { color:'white', fontWeight:'bold' },
  emptyText: { textAlign:'center', marginTop:50, color:'#aaa' },
  
  // 모달 공통
  modalOverlay: { flex:1, justifyContent:'center', backgroundColor:'rgba(0,0,0,0.5)', padding:20 },
  modalContent: { backgroundColor:'white', padding:20, borderRadius:10, width:'100%' },
  modalContainer: { flex:1, padding:25, paddingTop:50, backgroundColor:'white' },
  modalTitle: { fontSize:20, fontWeight:'bold', textAlign:'center', marginBottom:20 },
  label: { fontSize:14, fontWeight:'bold', marginTop:15, marginBottom:5, color:'#555' },
  input: { borderWidth:1, borderColor:'#ddd', borderRadius:8, padding:10, fontSize:16 },
  fullBtn: { padding:15, borderRadius:8, backgroundColor:'#3498db', alignItems:'center' },
  btnText: { color:'white', fontWeight:'bold', fontSize:16 },
  outlineBtn: { borderWidth:1, borderColor:'#3498db', paddingVertical:5, paddingHorizontal:10, borderRadius:5 },
  
  // 날짜/시간 선택 버튼
  dateBtn: { flex:1, padding:15, borderWidth:1, borderColor:'#ddd', borderRadius:8, alignItems:'center', backgroundColor:'#fafafa', marginHorizontal:5 },
  
  // 칩 & 리스트
  chip: { paddingVertical:8, paddingHorizontal:15, borderWidth:1, borderColor:'#ddd', borderRadius:20, marginRight:5, marginBottom:5 },
  activeChip: { backgroundColor:'#3498db', borderColor:'#3498db' },
  doctorBox: { maxHeight:120, borderWidth:1, borderColor:'#eee', marginBottom:10 },
  docItem: { padding:10, borderBottomWidth:1, borderColor:'#eee' },

  // 달력 & 시간 슬롯
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent:'center', alignItems:'center', marginVertical: 2 },
  calDaySelected: { backgroundColor:'#3498db', borderRadius:20 },
  timeSlot: { paddingVertical:10, paddingHorizontal:15, borderRadius:8, borderWidth:1, borderColor:'#ddd', margin:5, backgroundColor:'#fff' },
});