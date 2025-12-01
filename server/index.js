const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 서버 로그를 찍어서 실제 요청이 들어오는지 확인 
app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

// ★ DB 설정 (본인 환경에 맞게 수정)
const db = mysql.createConnection({
  host: '192.168.16.7',    
  user: 'appmaster',       
  password: 'pass123',     
  database: 'hospital_app' 
});

db.connect((err) => {
  if (err) console.error('MySQL 연결 실패:', err);
  else console.log('MySQL 연결 성공!');
});

// --- API 시작 ---
// test
app.get('/api', (req, res) => {
  res.json({ message: "API connected" });
});


// 1. 회원가입
app.post('/api/register', (req, res) => {
  const { username, password, role, name, department } = req.body;
  const dept = role === 'doctor' ? department : null;
  const sql = 'INSERT INTO users (username, password, role, name, department) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [username, password, role, name, dept], (err, result) => {
    if (err) res.status(500).send({ message: 'Error' });
    else res.status(200).send({ message: 'Success' });
  });
});

// 2. 로그인
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(sql, [username, password], (err, results) => {
    if (err || results.length === 0) res.status(401).send({ message: 'Fail' });
    else {
      const u = results[0];
      res.send({ message: 'Login OK', role: u.role, username: u.username, name: u.name, id: u.id });
    }
  });
});

// 3. 의사 목록
app.get('/api/doctors', (req, res) => {
  db.query("SELECT id, username, name, department FROM users WHERE role = 'doctor'", (err, r) => res.send(r));
});

// 4. 예약하기
app.post('/api/appointments', (req, res) => {
  const { patient_id, doctor_id, date, time, symptoms } = req.body;
  const sql = "INSERT INTO appointments (patient_id, doctor_id, date, time, status, symptoms) VALUES (?, ?, ?, ?, 'waiting', ?)";
  db.query(sql, [patient_id, doctor_id, date, time, symptoms], (err) => {
    if (err) res.status(500).send(err); else res.send({ message: 'OK' });
  });
});

// 5. [의사] 진료 저장
app.put('/api/appointments/:id', (req, res) => {
  const { status, memo, diagnosis, prescription, doctor_opinion } = req.body;
  const sql = "UPDATE appointments SET status=?, memo=?, diagnosis=?, prescription=?, doctor_opinion=? WHERE id=?";
  db.query(sql, [status, memo, diagnosis, prescription, doctor_opinion, req.params.id], (err) => {
    if (err) res.status(500).send(err); else res.send({ message: 'OK' });
  });
});

// 6. [의사] 일별 조회
app.get('/api/doctor/appointments', (req, res) => {
  const { doctorId, date } = req.query;
  const sql = `SELECT a.*, u.name as patient_name FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = ? AND a.date = ? ORDER BY a.time ASC`;
  db.query(sql, [doctorId, date], (err, results) => {
    if (err) res.status(500).send(err);
    else {
      const stats = {
        total: results.length,
        completed: results.filter(r => r.status === 'completed').length,
        waiting: results.filter(r => r.status === 'waiting').length
      };
      res.send({ stats, appointments: results });
    }
  });
});

// 7. [의사] 환자 검색 (수정됨)
app.get('/api/doctor/patients/search', (req, res) => {
  const { keyword } = req.query;
  let sql = "SELECT id, username, name, birth, gender, created_at FROM users WHERE role = 'patient'";
  let params = [];
  if (keyword) {
    sql += " AND (name LIKE ? OR username LIKE ?)";
    params = [`%${keyword}%`, `%${keyword}%`];
  }
  sql += " ORDER BY name ASC";
  db.query(sql, params, (err, r) => res.send(r));
});

// 8. [의사] 환자 상세
app.get('/api/doctor/patient/:id', (req, res) => {
  const pid = req.params.id;
  db.query("SELECT id, username, name, birth, gender, created_at FROM users WHERE id=?", [pid], (err, u) => {
    if(err) return res.status(500).send(err);
    db.query("SELECT a.*, u.name as doctor_name FROM appointments a JOIN users u ON a.doctor_id = u.id WHERE a.patient_id=? ORDER BY a.date DESC", [pid], (err, h) => {
      res.send({ info: u[0], history: h });
    });
  });
});

// ★★★ [중요] 게시판 관련 API (9~12번) ★★★

// 9. [게시판] 목록 조회 (이 부분이 없어서 에러가 났던 겁니다!)
app.get('/api/posts', (req, res) => {
  db.query("SELECT * FROM posts ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.log("게시판 조회 에러:", err);
      res.status(500).send(err);
    } else {
      res.send(results);
    }
  });
});

// 10. [게시판] 글 작성
app.post('/api/posts', (req, res) => {
  console.log("글 작성 요청:", req.body);
  const { user_id, author_name, category, title, content, file_path } = req.body;
  const sql = "INSERT INTO posts (user_id, author_name, category, title, content, file_path) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [user_id, author_name, category, title, content, file_path], (err) => {
    if (err) { console.error(err); res.status(500).send(err); }
    else { console.log("DB 저장 성공"); res.send({ message: 'OK' }); }
  });
});

// 11. [게시판] 글 수정
app.put('/api/posts/:id', (req, res) => {
  const { title, content, category, file_path } = req.body;
  const sql = "UPDATE posts SET title=?, content=?, category=?, file_path=? WHERE id=?";
  db.query(sql, [title, content, category, file_path, req.params.id], (err) => {
    if (err) res.status(500).send(err); else res.send({ message: 'OK' });
  });
});

// 12. [게시판] 글 삭제
app.delete('/api/posts/:id', (req, res) => {
  const sql = "DELETE FROM posts WHERE id=?";
  db.query(sql, [req.params.id], (err) => {
    if (err) res.status(500).send(err); else res.send({ message: 'OK' });
  });
});

// --- 게시판 API 끝 ---

// 13. [환자] 내 예약
app.get('/api/appointments/patient/:id', (req, res) => {
  const sql = `SELECT a.*, u.name as doctor_name, u.department FROM appointments a JOIN users u ON a.doctor_id = u.id WHERE a.patient_id = ? ORDER BY a.date DESC, a.time ASC`;
  db.query(sql, [req.params.id], (err, r) => res.send(r));
});

// 14. [환자] 예약 취소
app.put('/api/appointments/cancel/:id', (req, res) => {
  db.query("UPDATE appointments SET status='cancelled' WHERE id=?", [req.params.id], (err) => res.send({msg:'ok'}));
});

// 15. [환자] 예약 변경
app.put('/api/appointments/change/:id', (req, res) => {
  db.query("UPDATE appointments SET date=?, time=? WHERE id=?", [req.body.date, req.body.time, req.params.id], (err) => res.send({msg:'ok'}));
});

// 16. [관리자] 유저 관리
app.get('/api/users', (req, res) => {
  db.query("SELECT id, username,password, role, name, department, created_at FROM users ORDER BY created_at DESC", (err, r) => res.send(r));
});

app.delete('/api/users/:id', (req, res) => {
  db.query("DELETE FROM users WHERE id=?", [req.params.id], (err) => res.send({msg:'ok'}));
});

// 17. [관리자] 사용자 정보 수정 (비번, 아이디 등)
app.put('/api/users/:id', (req, res) => {
  const { username, password, name, department } = req.body;
  
  const sql = "UPDATE users SET username=?, password=?, name=?, department=? WHERE id=?";
  
  db.query(sql, [username, password, name, department, req.params.id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send({ message: '수정 실패' });
    } else {
      res.send({ message: '수정 성공' });
    }
  });
});
app.get('/api', (req, res) => {
  res.json({ message: "API connected" });
});
//app.listen(3000, () => console.log('Server running on port 3000'));
app.listen(3000, "0.0.0.0", () => {
  console.log('Server running on port 3000');
});