// ============================================================
//  sheets.js — จัดการ Google Sheets ทั้งหมด
//  ปลาทูทวง ClassBot v3
// ============================================================

const { google } = require('googleapis');

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

// ============================================================
//  สร้าง Sheet ใหม่พร้อม 6 tabs เมื่อ Bot เข้ากลุ่มครั้งแรก
// ============================================================

async function createRoomSheet(roomName, year, semester) {
  const sheets = getSheetsClient();
  const drive  = getDriveClient();

  const title = `ปลาทูทวง_${roomName}_${year}_เทอม${semester}`;

  // สร้าง Spreadsheet พร้อม 6 tabs
  const ss = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'นักเรียน',     sheetId: 0 } },
        { properties: { title: 'งาน',          sheetId: 1 } },
        { properties: { title: 'การส่งงาน',    sheetId: 2 } },
        { properties: { title: 'คะแนน',        sheetId: 3 } },
        { properties: { title: 'มิชชั่น',      sheetId: 4 } },
        { properties: { title: 'การแจ้งเตือน', sheetId: 5 } },
      ],
    },
  });

  const sheetId = ss.data.spreadsheetId;

  // ใส่ header แต่ละ tab
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'นักเรียน!A1:E1',
          values: [['lineId', 'ชื่อ-นามสกุล', 'คะแนนรวม', 'วันที่ลงทะเบียน', 'สถานะ']],
        },
        {
          range: 'งาน!A1:H1',
          values: [['taskId', 'ชื่องาน', 'วิชา', 'รายละเอียด', 'วันส่ง', 'สถานะ', 'เทอม', 'วันที่สร้าง']],
        },
        {
          range: 'การส่งงาน!A1:G1',
          values: [['lineId', 'ชื่อนักเรียน', 'taskId', 'ชื่องาน', 'วันที่ส่งล่าสุด', 'ลิงก์ไฟล์', 'จำนวนครั้งที่ส่ง']],
        },
        {
          range: 'คะแนน!A1:C1',
          values: [['lineId', 'ชื่อ-นามสกุล', 'คะแนนรวม']],
        },
        {
          range: 'มิชชั่น!A1:G1',
          values: [['missionId', 'ชื่อมิชชั่น', 'lineId', 'ชื่อนักเรียน', 'คะแนนที่ได้', 'คะแนนเต็ม', 'วันที่ทำ']],
        },
        {
          range: 'การแจ้งเตือน!A1:D1',
          values: [['taskId', 'ประเภท', 'วันที่แจ้ง', 'สถานะ']],
        },
      ],
    },
  });

  // จัดสีหัวตาราง
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        makeHeaderFormat(0, '#4A86E8'), // นักเรียน — น้ำเงิน
        makeHeaderFormat(1, '#6AA84F'), // งาน — เขียว
        makeHeaderFormat(2, '#E69138'), // การส่งงาน — ส้ม
        makeHeaderFormat(3, '#CC0000'), // คะแนน — แดง
        makeHeaderFormat(4, '#674EA7'), // มิชชั่น — ม่วง
        makeHeaderFormat(5, '#999999'), // การแจ้งเตือน — เทา
      ],
    },
  });

  // ย้ายเข้าโฟลเดอร์ที่ถูกต้อง
  const folderId = await getOrCreateFolder(drive, roomName, year, semester);
  await drive.files.update({
    fileId: sheetId,
    addParents: folderId,
    removeParents: 'root',
    fields: 'id',
  });

  return { sheetId, folderId, title };
}

// สร้าง format หัวตาราง
function makeHeaderFormat(sheetId, colorHex) {
  const r = parseInt(colorHex.slice(1, 3), 16) / 255;
  const g = parseInt(colorHex.slice(3, 5), 16) / 255;
  const b = parseInt(colorHex.slice(5, 7), 16) / 255;
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: r, green: g, blue: b },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  };
}

// ============================================================
//  จัดการโฟลเดอร์ใน Google Drive
// ============================================================

async function getOrCreateFolder(drive, roomName, year, semester) {
  const rootName = 'ปลาทูทวง';
  const semName  = `${year} เทอม ${semester}`;

  // root folder
  const rootId = await findOrCreate(drive, rootName, 'root');
  // ห้องเรียน folder
  const roomId = await findOrCreate(drive, roomName, rootId);
  // เทอม folder
  const semId  = await findOrCreate(drive, semName, roomId);

  return semId;
}

async function findOrCreate(drive, name, parentId) {
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });
  return folder.data.id;
}

// ============================================================
//  CRUD นักเรียน
// ============================================================

async function registerStudent(sheetId, lineId, name) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:E',
  });
  const rows = res.data.values || [];

  // ตรวจว่า register แล้วหรือยัง
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lineId) return { exists: true, name: rows[i][1] };
  }

  const now = new Date().toLocaleDateString('th-TH');
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:E',
    valueInputOption: 'RAW',
    requestBody: { values: [[lineId, name, 0, now, 'active']] },
  });

  // เพิ่มคอลัมน์คะแนนใน sheet คะแนน
  const scoreRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!A:C',
  });
  const scoreRows = scoreRes.data.values || [];
  const exists    = scoreRows.slice(1).some(r => r[0] === lineId);
  if (!exists) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'คะแนน!A:C',
      valueInputOption: 'RAW',
      requestBody: { values: [[lineId, name, 0]] },
    });
  }

  return { exists: false, name };
}

async function getStudentName(sheetId, lineId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:B',
  });
  const rows = (res.data.values || []).slice(1);
  const row  = rows.find(r => r[0] === lineId);
  return row ? row[1] : null;
}

async function getAllStudents(sheetId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:E',
  });
  return (res.data.values || []).slice(1);
}

// ============================================================
//  CRUD งาน
// ============================================================

async function createTask(sheetId, taskData, semester) {
  const sheets = getSheetsClient();
  const taskId = 'T-' + Date.now();
  const now    = new Date().toLocaleDateString('th-TH');

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'งาน!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        taskId,
        taskData.name,
        taskData.subject,
        taskData.description || '',
        taskData.dueDate,
        'open',
        semester,
        now,
      ]],
    },
  });

  // เพิ่มคอลัมน์ใหม่ใน Sheet คะแนน (เก็บไว้แม้ลบงาน)
  await addScoreColumn(sheetId, taskId, taskData.name);

  return taskId;
}

async function addScoreColumn(sheetId, taskId, taskName) {
  const sheets  = getSheetsClient();
  const res     = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!1:1',
  });
  const headers = (res.data.values || [[]])[0];
  const colNum  = headers.length + 1;
  const colLetter = columnToLetter(colNum);

  // เพิ่ม header คอลัมน์ใหม่
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `คะแนน!${colLetter}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[`${taskName} (${taskId})`]] },
  });
}

async function getAllTasks(sheetId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'งาน!A:H',
  });
  const rows = (res.data.values || []).slice(1);
  return rows.map(r => ({
    taskId:      r[0],
    name:        r[1],
    subject:     r[2],
    description: r[3],
    dueDate:     r[4],
    status:      r[5],
    semester:    r[6],
    createdAt:   r[7],
  }));
}

async function getTaskById(sheetId, taskId) {
  const tasks = await getAllTasks(sheetId);
  return tasks.find(t => t.taskId === taskId) || null;
}

async function updateTaskStatus(sheetId, taskId, status) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'งาน!A:H',
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === taskId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `งาน!F${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[status]] },
      });
      return true;
    }
  }
  return false;
}

async function updateTaskName(sheetId, taskId, newName) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'งาน!A:H',
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === taskId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `งาน!B${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newName]] },
      });
      return true;
    }
  }
  return false;
}

// ลบ card งาน — ลบออกจาก sheet "งาน" เท่านั้น คะแนนใน sheet "คะแนน" ยังอยู่
async function deleteTask(sheetId, taskId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'งาน!A:H',
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === taskId) {
      // ใส่ [DELETED] แทนการลบแถว เพื่อรักษาโครงสร้าง
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `งาน!F${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['deleted']] },
      });
      return true;
    }
  }
  return false;
}

// ============================================================
//  CRUD การส่งงาน — save ทับไฟล์ล่าสุดเสมอ
// ============================================================

async function submitWork(sheetId, lineId, taskId, fileUrl) {
  const sheets      = getSheetsClient();
  const studentName = await getStudentName(sheetId, lineId);
  if (!studentName) return { success: false, reason: 'not_registered' };

  const task = await getTaskById(sheetId, taskId);
  if (!task) return { success: false, reason: 'task_not_found' };
  if (task.status !== 'open') return { success: false, reason: 'task_closed' };

  const now = new Date().toLocaleDateString('th-TH');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'การส่งงาน!A:G',
  });
  const rows = res.data.values || [];

  // หาว่าเคยส่งแล้วหรือยัง
  let existingRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lineId && rows[i][2] === taskId) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // save ทับ — อัปเดตเฉพาะวันที่ส่ง, ลิงก์ไฟล์, และจำนวนครั้ง
    const count = parseInt(rows[existingRow - 1][6] || '0') + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `การส่งงาน!E${existingRow}:G${existingRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[now, fileUrl || '', count]] },
    });
  } else {
    // ส่งครั้งแรก
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'การส่งงาน!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[lineId, studentName, taskId, task.name, now, fileUrl || '', 1]],
      },
    });
  }

  return { success: true, studentName, taskName: task.name, isResubmit: existingRow > 0 };
}

async function getSubmissionsByTask(sheetId, taskId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'การส่งงาน!A:G',
  });
  return (res.data.values || []).slice(1).filter(r => r[2] === taskId);
}

async function getSubmissionsByStudent(sheetId, lineId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'การส่งงาน!A:G',
  });
  return (res.data.values || []).slice(1).filter(r => r[0] === lineId);
}

// ============================================================
//  ระบบคะแนน
// ============================================================

async function updateScore(sheetId, lineId, taskId, score) {
  const sheets = getSheetsClient();

  // หาคอลัมน์ของงานนี้ใน Sheet คะแนน
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!1:1',
  });
  const headers = (headerRes.data.values || [[]])[0];
  let taskCol   = -1;
  for (let i = 3; i < headers.length; i++) {
    if (headers[i] && headers[i].includes(taskId)) {
      taskCol = i + 1;
      break;
    }
  }
  if (taskCol === -1) return false;

  // หาแถวของนักเรียน
  const studentRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!A:C',
  });
  const rows = studentRes.data.values || [];
  let studentRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === lineId) { studentRow = i + 1; break; }
  }
  if (studentRow === -1) return false;

  const colLetter = columnToLetter(taskCol);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `คะแนน!${colLetter}${studentRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[score]] },
  });

  // คำนวณคะแนนรวมใหม่
  await recalcTotalScore(sheetId, lineId, studentRow);
  return true;
}

async function recalcTotalScore(sheetId, lineId, rowNum) {
  const sheets    = getSheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!1:1',
  });
  const totalCols = (headerRes.data.values || [[]])[0].length;
  const rowRes    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `คะแนน!D${rowNum}:${columnToLetter(totalCols)}${rowNum}`,
  });
  const vals  = (rowRes.data.values || [[]])[0] || [];
  const total = vals.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `คะแนน!C${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[total]] },
  });

  // sync คะแนนรวมกลับไปที่ sheet นักเรียน
  const stuRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:C',
  });
  const stuRows = stuRes.data.values || [];
  for (let i = 1; i < stuRows.length; i++) {
    if (stuRows[i][0] === lineId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `นักเรียน!C${i + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[total]] },
      });
      break;
    }
  }
}

async function getStudentScore(sheetId, lineId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'นักเรียน!A:C',
  });
  const rows = (res.data.values || []).slice(1);
  const row  = rows.find(r => r[0] === lineId);
  return row ? parseInt(row[2]) || 0 : null;
}

async function getRanking(sheetId) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'คะแนน!A:C',
  });
  const rows = (res.data.values || []).slice(1);
  return rows
    .map(r => ({ lineId: r[0], name: r[1], total: parseInt(r[2]) || 0 }))
    .sort((a, b) => b.total - a.total);
}

// ============================================================
//  ระบบแจ้งเตือน — บันทึกว่าส่งแล้วหรือยัง (กันทวงซ้ำ)
// ============================================================

async function hasNotified(sheetId, taskId, type) {
  const sheets = getSheetsClient();
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'การแจ้งเตือน!A:D',
  });
  const rows = (res.data.values || []).slice(1);
  return rows.some(r => r[0] === taskId && r[1] === type);
}

async function markNotified(sheetId, taskId, type) {
  const sheets = getSheetsClient();
  const now    = new Date().toLocaleDateString('th-TH');
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'การแจ้งเตือน!A:D',
    valueInputOption: 'RAW',
    requestBody: { values: [[taskId, type, now, 'sent']] },
  });
}

// ============================================================
//  Utility
// ============================================================

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col    = Math.floor((col - 1) / 26);
  }
  return letter;
}

module.exports = {
  createRoomSheet,
  registerStudent,
  getStudentName,
  getAllStudents,
  createTask,
  getAllTasks,
  getTaskById,
  updateTaskStatus,
  updateTaskName,
  deleteTask,
  submitWork,
  getSubmissionsByTask,
  getSubmissionsByStudent,
  updateScore,
  getStudentScore,
  getRanking,
  hasNotified,
  markNotified,
  getOrCreateFolder,
};
