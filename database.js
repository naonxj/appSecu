import SQLite from 'react-native-sqlite-storage';

// DB 연결
const db = SQLite.openDatabase(
  {
    name: 'hospital_app.db',
    location: 'default',
  },
  () => console.log('DB Connection Success'),
  error => console.error('DB Connection Error', error)
);

// 테이블 초기화 (App.tsx에서 호출)
export const initDB = () => {
  db.transaction(tx => {
    // 1. Users 테이블
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        department TEXT,
        birth TEXT,
        gender TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`
    );

    // 2. Appointments 테이블
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        doctor_id INTEGER,
        date TEXT,
        time TEXT,
        status TEXT DEFAULT 'waiting',
        symptoms TEXT,
        diagnosis TEXT,
        prescription TEXT,
        doctor_opinion TEXT,
        memo TEXT,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      );`
    );

    // 3. Posts 테이블
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        author_name TEXT,
        category TEXT,
        title TEXT,
        content TEXT,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );`
    );
  });
};

// --- Helper: 쿼리 실행을 Promise로 감싸기 ---
const executeQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (tx, results) => {
          resolve(results);
        },
        (tx, error) => {
          console.error("Query Error: ", error);
          reject(error);
        }
      );
    });
  });
};

// --- 1. Auth ---
export const registerUser = async (username, password, role, name, department) => {
  const dept = role === 'doctor' ? department : null;
  return executeQuery(
    'INSERT INTO users (username, password, role, name, department) VALUES (?, ?, ?, ?, ?)',
    [username, password, role, name, dept]
  );
};

export const loginUser = async (username, password) => {
  const results = await executeQuery(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password]
  );
  if (results.rows.length > 0) return results.rows.item(0);
  throw new Error('Login Failed');
};

// --- 2. Common & Patient ---
export const getDoctors = async () => {
  const results = await executeQuery("SELECT id, username, name, department FROM users WHERE role = 'doctor'");
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  return items;
};

export const createAppointment = async (patientId, doctorId, date, time, symptoms) => {
  return executeQuery(
    "INSERT INTO appointments (patient_id, doctor_id, date, time, status, symptoms) VALUES (?, ?, ?, ?, 'waiting', ?)",
    [patientId, doctorId, date, time, symptoms]
  );
};

export const getPatientAppointments = async (patientId) => {
  // SQLite는 JOIN시 alias 처리가 중요합니다.
  const sql = `
    SELECT a.*, u.name as doctor_name, u.department 
    FROM appointments a 
    JOIN users u ON a.doctor_id = u.id 
    WHERE a.patient_id = ? 
    ORDER BY a.date DESC, a.time ASC
  `;
  const results = await executeQuery(sql, [patientId]);
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  return items;
};

export const cancelAppointment = async (id) => {
  return executeQuery("UPDATE appointments SET status='cancelled' WHERE id=?", [id]);
};

export const changeAppointment = async (id, date, time) => {
  return executeQuery("UPDATE appointments SET date=?, time=? WHERE id=?", [date, time, id]);
};

// --- 3. Doctor ---
export const getDoctorAppointments = async (doctorId, date) => {
  const sql = `
    SELECT a.*, u.name as patient_name 
    FROM appointments a 
    JOIN users u ON a.patient_id = u.id 
    WHERE a.doctor_id = ? AND a.date = ? 
    ORDER BY a.time ASC
  `;
  const results = await executeQuery(sql, [doctorId, date]);
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  
  const stats = {
    total: items.length,
    completed: items.filter(r => r.status === 'completed').length,
    waiting: items.filter(r => r.status === 'waiting').length
  };
  return { stats, appointments: items };
};

export const updateTreatment = async (id, status, memo, diagnosis, prescription, opinion) => {
  return executeQuery(
    "UPDATE appointments SET status=?, memo=?, diagnosis=?, prescription=?, doctor_opinion=? WHERE id=?",
    [status, memo, diagnosis, prescription, opinion, id]
  );
};

export const searchPatients = async (keyword) => {
  let sql = "SELECT id, username, name, birth, gender, created_at FROM users WHERE role = 'patient'";
  let params = [];
  if (keyword) {
    sql += " AND (name LIKE ? OR username LIKE ?)";
    params = [`%${keyword}%`, `%${keyword}%`];
  }
  sql += " ORDER BY name ASC";
  
  const results = await executeQuery(sql, params);
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  return items;
};

export const getPatientDetail = async (patientId) => {
  const uRes = await executeQuery("SELECT id, username, name, birth, gender, created_at FROM users WHERE id=?", [patientId]);
  const user = uRes.rows.length > 0 ? uRes.rows.item(0) : null;
  
  const hRes = await executeQuery(
    `SELECT a.*, u.name as doctor_name 
     FROM appointments a 
     JOIN users u ON a.doctor_id = u.id 
     WHERE a.patient_id=? 
     ORDER BY a.date DESC`, 
    [patientId]
  );
  let history = [];
  for (let i = 0; i < hRes.rows.length; i++) history.push(hRes.rows.item(i));
  
  return { info: user, history };
};

// --- 4. Posts (Board) ---
export const getPosts = async () => {
  const results = await executeQuery("SELECT * FROM posts ORDER BY created_at DESC");
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  return items;
};

export const createPost = async (userId, authorName, category, title, content, filePath) => {
  return executeQuery(
    "INSERT INTO posts (user_id, author_name, category, title, content, file_path) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, authorName, category, title, content, filePath]
  );
};

export const updatePost = async (id, title, content, category, filePath) => {
  return executeQuery(
    "UPDATE posts SET title=?, content=?, category=?, file_path=? WHERE id=?",
    [title, content, category, filePath, id]
  );
};

export const deletePost = async (id) => {
  return executeQuery("DELETE FROM posts WHERE id=?", [id]);
};

// --- 5. Admin ---
export const getAllUsers = async () => {
  const results = await executeQuery("SELECT id, username, password, role, name, department, created_at FROM users ORDER BY created_at DESC");
  let items = [];
  for (let i = 0; i < results.rows.length; i++) items.push(results.rows.item(i));
  return items;
};

export const deleteUser = async (id) => {
  return executeQuery("DELETE FROM users WHERE id=?", [id]);
};

export const updateUser = async (id, username, password, name, department) => {
  return executeQuery(
    "UPDATE users SET username=?, password=?, name=?, department=? WHERE id=?",
    [username, password, name, department, id]
  );
};