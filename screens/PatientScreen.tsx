import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, FlatList, Alert, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, RefreshControl
} from 'react-native';

// 파일 선택용 라이브러리가 없다면 임시 함수 사용, 있다면 import하세요.
// import DocumentPicker from 'react-native-document-picker';

const API_URL = 'http://10.0.2.2:3000/api';

export default function PatientScreen({ route, navigation }: any) {
  const { userId, username, name } = route.params || {};

  const [activeTab, setActiveTab] = useState('reservation');
  const [refreshing, setRefreshing] = useState(false);
  
  // 데이터 목록
  const [myList, setMyList] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  // --- [모달 1] 새 예약 관련 State ---
  const [resModalVisible, setResModalVisible] = useState(false);
  const [newDate, setNewDate] = useState('2025-01-01');
  const [newTime, setNewTime] = useState('09:00');
  const [symptoms, setSymptoms] = useState('');
  const [selectedDept, setSelectedDept] = useState('내과');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);

  // --- [모달 2] 예약 변경 관련 State ---
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [targetAppt, setTargetAppt] = useState<any>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');

  // --- [모달 3] 게시글 작성/수정 관련 State ---
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // 수정 모드 여부
  const [targetPostId, setTargetPostId] = useState<number | null>(null); // 수정할 글 ID

  const [postCategory, setPostCategory] = useState('Q&A');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postFile, setPostFile] = useState(''); 

  // --- 데이터 불러오기 ---
 const fetchAllData = async () => {
    // 내부 헬퍼 함수: 안전하게 데이터를 가져오는 함수
    const safeFetch = async (url: string, setter: (data: any) => void, apiName: string) => {
      try {
        const response = await fetch(url);
        const text = await response.text(); // 1. 일단 텍스트로 받습니다 (에러 방지)

        if (!response.ok) {
          console.log(`❌ [${apiName}] 서버 에러 발생 (${response.status}):`, text);
          return;
        }

        try {
          const json = JSON.parse(text); // 2. 그 다음 JSON 변환을 시도합니다
          setter(json);
        } catch (e) {
          console.log(`⚠️ [${apiName}] JSON 파싱 에러! (서버가 HTML을 보냄):`, text.substring(0, 50));
        }
      } catch (e) {
        console.error(`🚫 [${apiName}] 네트워크 연결 실패:`, e);
      }
    };

    if (userId) {
      // 3개의 데이터를 각각 안전하게 호출
      await safeFetch(`${API_URL}/appointments/patient/${userId}`, setMyList, '예약목록');
      await safeFetch(`${API_URL}/doctors`, setDoctors, '의사목록');
      await safeFetch(`${API_URL}/posts`, setPosts, '게시판');
    }
  };

  useEffect(() => { fetchAllData(); }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);

  // --- 기능 함수: 예약 (기존 유지) ---
  const handleReservation = async () => {
    if (!selectedDoctorId) { Alert.alert("알림", "의사를 선택해주세요."); return; }
    try {
      await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          patient_id: userId, doctor_id: selectedDoctorId, 
          date: newDate, time: newTime, symptoms: symptoms
        })
      });
      Alert.alert("성공", "예약이 신청되었습니다.");
      setResModalVisible(false); setSymptoms(''); fetchAllData(); 
    } catch (e) { Alert.alert("오류", "예약 실패"); }
  };

  const handleEditAppt = async () => {
    if (!targetAppt) return;
    try {
      await fetch(`${API_URL}/appointments/change/${targetAppt.id}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ date: editDate, time: editTime })
      });
      setEditModalVisible(false); fetchAllData();
      Alert.alert("성공", "예약 정보가 변경되었습니다.");
    } catch (e) { Alert.alert("오류", "변경 실패"); }
  };

  const handleCancelAppt = async (id: number) => {
    Alert.alert("예약 취소", "정말 취소하시겠습니까?", [
      { text: "아니오" },
      { text: "네", onPress: async () => {
          await fetch(`${API_URL}/appointments/cancel/${id}`, { method: 'PUT' });
          fetchAllData();
      }}
    ]);
  };

  // --- ★ 기능 함수: 게시판 글쓰기 & 수정 로직 ---
  
  // 1. 글 작성 모달 열기 (새 글)
  const openWriteModal = () => {
    setIsEditMode(false);
    setTargetPostId(null);
    setPostCategory('Q&A'); setPostTitle(''); setPostContent(''); setPostFile('');
    setWriteModalVisible(true);
  };

  // 2. 글 수정 모달 열기 (기존 글)
  const openEditPostModal = (item: any) => {
    setIsEditMode(true);
    setTargetPostId(item.id);
    setPostCategory(item.category);
    setPostTitle(item.title);
    setPostContent(item.content);
    setPostFile(item.file_path || '');
    setWriteModalVisible(true);
  };

  // 3. 작성 완료 (등록 or 수정)
  const handlePostSubmit = async () => {
    if(!postTitle || !postContent) {
      Alert.alert("알림", "제목과 내용을 입력해주세요.");
      return;
    }

    try {
      if (isEditMode && targetPostId) {
        // [수정 모드] PUT 요청
        await fetch(`${API_URL}/posts/${targetPostId}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            category: postCategory,
            title: postTitle,
            content: postContent,
            file_path: postFile || null
          })
        });
        Alert.alert("수정 완료", "게시글이 수정되었습니다.");
      } else {
        // [작성 모드] POST 요청
        await fetch(`${API_URL}/posts`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            user_id: userId,
            author_name: name,
            category: postCategory,
            title: postTitle,
            content: postContent,
            file_path: postFile || null
          })
        });
        Alert.alert("등록 완료", "게시글이 등록되었습니다.");
      }
      
      setWriteModalVisible(false);
      fetchAllData(); // 목록 갱신
    } catch(e) {
      Alert.alert("오류", "작업에 실패했습니다.");
    }
  };

  // 4. 글 삭제
  const handleDeletePost = (id: number) => {
    Alert.alert("삭제", "정말 이 글을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", style:'destructive', onPress: async () => {
          try {
             await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE' });
             Alert.alert("완료", "삭제되었습니다.");
             fetchAllData();
          } catch(e) { Alert.alert("오류", "삭제 실패"); }
      }}
    ]);
  };

  // 파일 첨부 시뮬레이션
  const pickFile = () => {
    setPostFile('image_2025.jpg'); 
    Alert.alert("파일 선택", "이미지 파일이 선택되었습니다 (시뮬레이션)");
  };

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
          <Text style={{fontSize:14, fontWeight:'600', color:'#333'}}>{name}님</Text>
          <TouchableOpacity onPress={() => navigation.replace('Auth')}>
            <Text style={{color:'#e74c3c', fontSize:12, marginTop:2}}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭 메뉴 */}
      <View style={styles.tabContainer}>
        {['reservation', 'history', 'board'].map(tab => (
           <TouchableOpacity key={tab} 
             style={[styles.tabBtn, activeTab === tab && styles.activeTab]}
             onPress={() => setActiveTab(tab)}>
             <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
               {tab === 'reservation' ? '내 예약' : tab === 'history' ? '진료기록' : '게시판'}
             </Text>
           </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        
        {/* === [탭 1] 예약 시스템 === */}
        {activeTab === 'reservation' && (
          <View style={{flex:1}}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setResModalVisible(true)}>
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
                      <Text style={[styles.statusText, item.status === 'waiting' ? {color: '#e67e22'} : {color: '#27ae60'}]}>
                        {item.status === 'waiting' ? '대기중' : '진료중'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dateTimeRow}>
                    <Text style={styles.dateText}>📅 {renderDate(item.date)}</Text>
                    <Text style={styles.timeText}>🕒 {renderTime(item.time)}</Text>
                  </View>
                  <Text style={styles.symptomsText} numberOfLines={2}>증상: {item.symptoms || '입력된 증상이 없습니다.'}</Text>
                  <View style={styles.divider}/>
                  {item.status === 'waiting' ? (
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity style={styles.actionBtnOutline} onPress={() => { setTargetAppt(item); setEditDate(renderDate(item.date)); setEditTime(renderTime(item.time)); setEditModalVisible(true); }}>
                        <Text style={{color:'#3498db', fontWeight:'600'}}>예약 변경</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtnOutline, {borderColor:'#ff6b6b'}]} onPress={() => handleCancelAppt(item.id)}>
                        <Text style={{color:'#ff6b6b', fontWeight:'600'}}>예약 취소</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{textAlign:'center', color:'#27ae60', fontWeight:'bold', padding:5}}>👨‍⚕️ 현재 진료가 진행 중입니다.</Text>
                  )}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>대기중인 예약이 없습니다.</Text>}
            />
          </View>
        )}

        {/* === [탭 2] 진료 내역 === */}
        {activeTab === 'history' && (
          <View style={{flex:1}}>
            <FlatList
              data={historyList}
              keyExtractor={(item:any) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
              renderItem={({item}) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.doctor_name} 선생님 ({item.department})</Text>
                    <Text style={{color:'#999', fontSize:12}}>진료완료</Text>
                  </View>
                  <Text style={{color:'#555', marginBottom:10}}>{renderDate(item.date)} 진료</Text>
                  <View style={styles.resultBox}>
                    <Text style={styles.resultRow}><Text style={{fontWeight:'bold'}}>병명:</Text> {item.diagnosis || '-'}</Text>
                    <Text style={styles.resultRow}><Text style={{fontWeight:'bold'}}>처방:</Text> {item.prescription || '-'}</Text>
                    <Text style={styles.resultRow}><Text style={{fontWeight:'bold'}}>소견:</Text> {item.doctor_opinion || '-'}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>진료 완료된 내역이 없습니다.</Text>}
            />
          </View>
        )}

        {/* === [탭 3] 게시판 === */}
        {activeTab === 'board' && (
          <View style={{flex:1}}>
             <TouchableOpacity style={styles.addBtn} onPress={openWriteModal}>
                <Text style={styles.addBtnText}>✏️ 새 글 작성하기</Text>
             </TouchableOpacity>

             <FlatList
               data={posts}
               keyExtractor={(item:any) => item.id.toString()}
               refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
               contentContainerStyle={{paddingBottom:20}}
               renderItem={({item}) => {
                 let badgeColor = '#3498db'; let badgeText = 'Q&A';
                 if (item.category === 'notice') { badgeColor = '#e74c3c'; badgeText = '공지'; } 
                 else if (item.category === 'system_error') { badgeColor = '#f39c12'; badgeText = '오류신고'; }

                 // ★ 내가 쓴 글인지 확인 (수정/삭제 버튼 노출용)
                 // 주의: DB에서 가져온 user_id가 숫자/문자열인지 확실치 않으므로 == 사용하거나 형변환
                 const isMyPost = item.user_id == userId;

                 return (
                   <View style={styles.card}>
                     <View style={{flexDirection:'row', marginBottom:5, alignItems:'center', justifyContent:'space-between'}}>
                       <View style={{flexDirection:'row', alignItems:'center'}}>
                         <View style={{backgroundColor: badgeColor, paddingHorizontal:8, paddingVertical:3, borderRadius:4, marginRight:8}}>
                           <Text style={{color:'white', fontSize:11, fontWeight:'bold'}}>{badgeText}</Text>
                         </View>
                         <Text style={{fontSize:12, color:'#aaa'}}>{renderDate(item.created_at)}</Text>
                       </View>
                       {/* 작성자 표시 */}
                       <Text style={{fontSize:12, color:'#888'}}>{item.author_name}</Text>
                     </View>
                     
                     <Text style={[styles.cardTitle, {marginTop:5, marginBottom:5}]}>{item.title}</Text>
                     <Text numberOfLines={3} style={{color:'#555', lineHeight:20}}>{item.content}</Text>
                     
                     {item.file_path && (
                        <View style={{marginTop:10, flexDirection:'row', alignItems:'center', backgroundColor:'#f0f0f0', padding:8, borderRadius:5}}>
                          <Text style={{fontSize:13, color:'#555'}}>📎 {item.file_path}</Text>
                        </View>
                     )}
                     
                     {/* ★ 내가 쓴 글일 때만 수정/삭제 버튼 표시 */}
                     {isMyPost && (
                       <View style={{flexDirection:'row', justifyContent:'flex-end', marginTop:15, gap:10}}>
                         <TouchableOpacity onPress={() => openEditPostModal(item)} style={styles.miniBtn}>
                           <Text style={{color:'#3498db', fontSize:12, fontWeight:'bold'}}>수정</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => handleDeletePost(item.id)} style={[styles.miniBtn, {borderColor:'#ff6b6b'}]}>
                           <Text style={{color:'#ff6b6b', fontSize:12, fontWeight:'bold'}}>삭제</Text>
                         </TouchableOpacity>
                       </View>
                     )}
                   </View>
                 );
               }}
               ListEmptyComponent={<Text style={styles.emptyText}>등록된 게시글이 없습니다.</Text>}
             />
          </View>
        )}
      </View>


      {/* --- [모달 1] 새 예약 --- */}
      <Modal visible={resModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>새 진료 예약</Text>
          {/* 예약 UI */}
          <Text style={styles.label}>1. 진료과 선택</Text>
          <View style={{flexDirection:'row', flexWrap:'wrap', marginBottom:15}}>
             {['내과', '정형외과', '치과', '안과', '피부과'].map(dept => (
               <TouchableOpacity key={dept} style={[styles.chip, selectedDept===dept && styles.activeChip]} onPress={()=>{ setSelectedDept(dept); setSelectedDoctorId(null); }}>
                 <Text style={{color:selectedDept===dept?'white':'#555', fontWeight:selectedDept===dept?'bold':'normal'}}>{dept}</Text>
               </TouchableOpacity>
             ))}
          </View>
          <Text style={styles.label}>2. 의사 선택</Text>
          <ScrollView style={styles.doctorSelectBox}>
             {doctors.filter((d:any) => d.department === selectedDept).map((d:any) => (
                 <TouchableOpacity key={d.id} style={[styles.doctorItem, selectedDoctorId===d.id && {backgroundColor:'#e3f2fd'}]} onPress={()=>setSelectedDoctorId(d.id)}>
                   <Text style={{fontWeight:selectedDoctorId===d.id?'bold':'normal'}}>👨‍⚕️ {d.name} 선생님</Text>
                 </TouchableOpacity>
             ))}
          </ScrollView>
          <Text style={styles.label}>3. 날짜/시간</Text>
          <View style={{flexDirection:'row', marginBottom:15}}>
            <TextInput style={[styles.input, {flex:1, marginRight:10}]} value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" />
            <TextInput style={[styles.input, {width:80}]} value={newTime} onChangeText={setNewTime} placeholder="HH:MM" />
          </View>
          <Text style={styles.label}>4. 증상 (선택)</Text>
          <TextInput style={styles.input} value={symptoms} onChangeText={setSymptoms} placeholder="증상을 간단히 입력해주세요."/>
          <View style={{marginTop:20}}>
            <TouchableOpacity style={styles.fullBtn} onPress={handleReservation}><Text style={styles.fullBtnText}>예약 완료</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={() => setResModalVisible(false)}><Text style={styles.fullBtnText}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- [모달 2] 예약 변경 --- */}
      <Modal visible={editModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>예약 변경</Text>
            <Text style={styles.label}>날짜</Text>
            <TextInput style={styles.input} value={editDate} onChangeText={setEditDate}/>
            <Text style={styles.label}>시간</Text>
            <TextInput style={styles.input} value={editTime} onChangeText={setEditTime}/>
            <TouchableOpacity style={[styles.fullBtn, {marginTop:15}]} onPress={handleEditAppt}><Text style={styles.fullBtnText}>수정 완료</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={() => setEditModalVisible(false)}><Text style={styles.fullBtnText}>취소</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- [모달 3] 게시글 작성 & 수정 --- */}
      <Modal visible={writeModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{isEditMode ? '게시글 수정' : '새 게시글 작성'}</Text>
          
          <Text style={styles.label}>1. 카테고리 선택</Text>
          <View style={{flexDirection:'row', gap:10, marginBottom:15}}>
             <TouchableOpacity style={[styles.categoryBtn, postCategory==='Q&A' && {backgroundColor:'#3498db', borderColor:'#3498db'}]} onPress={() => setPostCategory('Q&A')}>
               <Text style={{color: postCategory==='Q&A'?'white':'#555'}}>❓ Q&A 질문</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.categoryBtn, postCategory==='system_error' && {backgroundColor:'#f39c12', borderColor:'#f39c12'}]} onPress={() => setPostCategory('system_error')}>
               <Text style={{color: postCategory==='system_error'?'white':'#555'}}>⚠️ 시스템 오류</Text>
             </TouchableOpacity>
          </View>

          <Text style={styles.label}>2. 제목</Text>
          <TextInput style={styles.input} value={postTitle} onChangeText={setPostTitle} placeholder="제목을 입력하세요"/>

          <Text style={styles.label}>3. 내용</Text>
          <TextInput style={[styles.input, {height:120, textAlignVertical:'top'}]} multiline value={postContent} onChangeText={setPostContent} placeholder="내용을 입력하세요."/>

          <Text style={styles.label}>4. 파일 첨부 (선택)</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
             <TouchableOpacity style={styles.fileBtn} onPress={pickFile}>
                <Text style={{color:'#555'}}>📁 파일 선택하기</Text>
             </TouchableOpacity>
             <Text style={{marginLeft:10, color:'#888', flex:1}} numberOfLines={1}>
                {postFile ? postFile : '선택된 파일 없음'}
             </Text>
          </View>

          <View style={{marginTop:30}}>
            <TouchableOpacity style={styles.fullBtn} onPress={handlePostSubmit}>
               <Text style={styles.fullBtnText}>{isEditMode ? '수정 완료' : '작성 완료'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.fullBtn, {backgroundColor:'#95a5a6', marginTop:10}]} onPress={() => setWriteModalVisible(false)}>
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
  header: { padding: 20, paddingTop:50, flexDirection: 'row', justifyContent: 'space-between', alignItems:'center', borderBottomWidth: 1, borderColor: '#eee', backgroundColor:'#fff' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color:'#2c3e50' },
  
  tabContainer: { flexDirection: 'row', backgroundColor:'#fff', elevation:2 },
  tabBtn: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  activeTab: { borderColor: '#3498db' },
  tabText: { fontSize: 16, color:'#95a5a6' },
  activeTabText: { color: '#3498db', fontWeight: 'bold' },

  content: { flex: 1, padding: 15 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#bdc3c7', fontSize:16 },
  
  card: { backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2, borderWidth:1, borderColor:'#f1f2f6' },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color:'#2c3e50' },
  
  statusBadge: { paddingVertical:4, paddingHorizontal:8, borderRadius:12 },
  statusText: { fontSize:12, fontWeight:'bold' },
  dateTimeRow: { flexDirection:'row', marginBottom:10, alignItems:'center' },
  dateText: { marginRight:15, fontSize:15, color:'#555', fontWeight:'500' },
  timeText: { fontSize:15, color:'#555', fontWeight:'500' },
  symptomsText: { color:'#7f8c8d', fontSize:14 },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },
  cardActionRow: { flexDirection:'row', justifyContent:'flex-end', gap:10 },
  actionBtnOutline: { paddingVertical:6, paddingHorizontal:15, borderRadius:6, borderWidth:1, borderColor:'#3498db' },
  resultBox: { backgroundColor:'#f8f9fa', padding:10, borderRadius:8 },
  resultRow: { marginBottom:4, color:'#444' },

  addBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15, elevation:2 },
  addBtnText: { color: 'white', fontWeight: 'bold', fontSize:16 },

  // 모달
  modalContainer: { flex: 1, padding: 25, paddingTop: 60, backgroundColor:'#fff' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding:25 },
  modalContent: { backgroundColor: 'white', padding: 25, borderRadius: 15, elevation:5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center', color:'#2c3e50' },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 8, marginTop: 15, color:'#34495e' },
  input: { borderWidth: 1, borderColor: '#dcdde1', padding: 12, borderRadius: 8, fontSize:16, backgroundColor:'#fdfdfd' },
  
  chip: { paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderColor:'#dcdde1', borderRadius:20, marginRight:8, marginBottom:8, backgroundColor:'#fff' },
  activeChip: { backgroundColor: '#3498db', borderColor: '#3498db' },
  doctorSelectBox: { maxHeight: 150, borderWidth:1, borderColor:'#dcdde1', borderRadius:8, marginBottom:10 },
  doctorItem: { padding: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  fullBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', width:'100%' },
  fullBtnText: { color:'white', fontWeight:'bold', fontSize:16 },

  categoryBtn: { flex:1, paddingVertical:12, borderWidth:1, borderColor:'#dcdde1', borderRadius:8, alignItems:'center' },
  fileBtn: { paddingVertical:10, paddingHorizontal:15, backgroundColor:'#eee', borderRadius:8, borderWidth:1, borderColor:'#ddd' },

  // 게시판 수정/삭제 미니 버튼
  miniBtn: { paddingVertical:5, paddingHorizontal:10, borderWidth:1, borderColor:'#3498db', borderRadius:4 }
});