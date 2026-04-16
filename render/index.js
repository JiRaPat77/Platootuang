// ============================================================
//  index.js — ปลาทูทวง ClassBot v3
//  LINE Bot + Google Sheets
// ============================================================

const express = require('express');
const line    = require('@line/bot-sdk');
const sheets  = require('./sheets');
const flex    = require('./flex');
const { startCron, runManualCheck } = require('./cron');
const fs      = require('fs');

const app = express();

const config = {
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
};

const client      = new line.Client(config);
const BASE_URL    = process.env.BASE_URL || 'https://platootuang.onrender.com';
const TEACHER_WEB = `${BASE_URL}/teacher`;
const REGISTRY_PATH = '/tmp/registry.json';

function getRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
  catch { return {}; }
}
function saveRegistry(data) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
}

// ============================================================
//  Webhook
// ============================================================

app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).send('OK');
  try {
    await Promise.all(req.body.events.map(handleEvent));
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

app.get('/', (req, res) => res.send('🐟 ปลาทูทวง กำลังทำงานอยู่!'));

// ============================================================
//  Event Router
// ============================================================

async function handleEvent(event) {
  const { type, source, replyToken } = event;
  const groupId = source.groupId || null;
  const userId  = source.userId;

  if (type === 'join' && groupId) {
    await onBotJoin(groupId, replyToken);
    return;
  }

  if (type === 'message' && event.message.type === 'text') {
    await handleText(event.message.text.trim(), userId, groupId, replyToken);
  }
}

// ============================================================
//  Bot เข้ากลุ่มครั้งแรก
// ============================================================

async function onBotJoin(groupId, replyToken) {
  const registry = getRegistry();
  if (registry[groupId]) {
    await client.replyMessage(replyToken, {
      type: 'text',
      text: '🐟 ปลาทูทวงกลับมาแล้วครับ! พิมพ์ @ปลาทูทวง วิธีใช้ เพื่อดูคำสั่งทั้งหมดครับ',
    });
    return;
  }
  const setupUrl = `${TEACHER_WEB}/setup?groupId=${groupId}`;
  await client.replyMessage(replyToken, flex.welcomeCard(setupUrl));
}

// ============================================================
//  Command Router
// ============================================================

async function handleText(text, userId, groupId, replyToken) {
  const isAt  = text.startsWith('@ปลาทูทวง') || text.startsWith('@platootuang');
  const isCmd = text.startsWith('/');
  if (!isAt && !isCmd) return;

  let cmd = '', args = '';
  if (isAt) {
    const body = text.replace(/^@ปลาทูทวง\s*/i, '').replace(/^@platootuang\s*/i, '');
    const idx  = body.search(/\s/);
    cmd  = idx === -1 ? body.toLowerCase() : body.slice(0, idx).toLowerCase();
    args = idx === -1 ? '' : body.slice(idx + 1).trim();
  } else {
    const body = text.slice(1);
    const idx  = body.search(/\s/);
    cmd  = idx === -1 ? body.toLowerCase() : body.slice(0, idx).toLowerCase();
    args = idx === -1 ? '' : body.slice(idx + 1).trim();
  }

  const registry = getRegistry();
  const roomInfo = groupId ? registry[groupId] : null;

  if (cmd === 'วิธีใช้' || cmd === 'help') return replyHelp(replyToken, !!roomInfo);

  if (!groupId || !roomInfo) {
    return client.replyMessage(replyToken, {
      type: 'text',
      text: '⚠️ กรุณาใช้คำสั่งนี้ในกลุ่มไลน์ห้องเรียนนะครับ',
    });
  }

  const sheetId = roomInfo.sheetId;

  switch (cmd) {
    case 'ลงทะเบียน':
    case 'register':
      return cmdRegister(sheetId, userId, args, replyToken);
    case 'งานของฉัน':
    case 'งานฉัน':
      return cmdMyTasks(sheetId, userId, replyToken);
    case 'คะแนนของฉัน':
    case 'คะแนนฉัน':
      return cmdMyScore(sheetId, userId, replyToken);
    case 'งานด่วน':
      return cmdUrgentTasks(sheetId, userId, replyToken);
    case 'งานวันนี้':
      return cmdTodayTasks(sheetId, replyToken);
    case 'ส่งงาน':
      return cmdSubmit(sheetId, userId, args, replyToken);
    case 'รายงาน':
    case 'report':
      return cmdReport(sheetId, roomInfo.roomName, args, replyToken);
    case 'อันดับ':
    case 'rank':
      return cmdRank(sheetId, roomInfo.roomName, replyToken);
    default:
      return client.replyMessage(replyToken, {
        type: 'text',
        text: '🤔 ไม่รู้จักคำสั่งนั้นครับ พิมพ์ @ปลาทูทวง วิธีใช้ เพื่อดูคำสั่งทั้งหมดครับ',
      });
  }
}

// ============================================================
//  Handlers
// ============================================================

async function replyHelp(replyToken, inGroup) {
  const msg = inGroup
    ? `📚 คำสั่งปลาทูทวงทั้งหมด\n─────────────────\n👩‍🎓 นักเรียน\n@ปลาทูทวง ลงทะเบียน ชื่อ-นามสกุล\n@ปลาทูทวง ส่งงาน [รหัสงาน]\n@ปลาทูทวง งานของฉัน\n@ปลาทูทวง คะแนนของฉัน\n@ปลาทูทวง งานด่วน\n@ปลาทูทวง งานวันนี้\n\n👩‍🏫 ครู\n@ปลาทูทวง รายงาน\n@ปลาทูทวง รายงาน [ชื่องาน]\n@ปลาทูทวง อันดับ`
    : '⚠️ กรุณาใช้คำสั่งนี้ในกลุ่มไลน์ห้องเรียนนะครับ';
  return client.replyMessage(replyToken, { type: 'text', text: msg });
}

async function cmdRegister(sheetId, userId, name, replyToken) {
  if (!name) return client.replyMessage(replyToken, { type: 'text', text: '⚠️ ระบุชื่อด้วยนะครับ เช่น @ปลาทูทวง ลงทะเบียน สมชาย ใจดี' });
  const result = await sheets.registerStudent(sheetId, userId, name);
  if (result.exists) return client.replyMessage(replyToken, { type: 'text', text: `⚠️ ลงทะเบียนไปแล้วในชื่อ "${result.name}" ครับ` });
  return client.replyMessage(replyToken, { type: 'text', text: `✅ ลงทะเบียนสำเร็จ! ยินดีต้อนรับ ${name} 🎉` });
}

async function cmdMyTasks(sheetId, userId, replyToken) {
  const studentName = await sheets.getStudentName(sheetId, userId);
  if (!studentName) return client.replyMessage(replyToken, { type: 'text', text: '⚠️ กรุณาลงทะเบียนก่อนนะครับ' });

  const allTasks     = (await sheets.getAllTasks(sheetId)).filter(t => t.status !== 'deleted');
  const submitted    = await sheets.getSubmissionsByStudent(sheetId, userId);
  const submittedIds = submitted.map(s => s[2]);
  const doneTasks    = allTasks.filter(t => submittedIds.includes(t.taskId));
  const pendingTasks = allTasks.filter(t => !submittedIds.includes(t.taskId) && t.status === 'open');

  return client.replyMessage(replyToken, flex.myTasksCard(studentName, doneTasks, pendingTasks));
}

async function cmdMyScore(sheetId, userId, replyToken) {
  const studentName = await sheets.getStudentName(sheetId, userId);
  if (!studentName) return client.replyMessage(replyToken, { type: 'text', text: '⚠️ กรุณาลงทะเบียนก่อนนะครับ' });
  const totalScore = await sheets.getStudentScore(sheetId, userId);
  const rankings   = await sheets.getRanking(sheetId);
  const rank       = rankings.findIndex(r => r.lineId === userId) + 1;
  return client.replyMessage(replyToken, flex.scoreCard(studentName, totalScore, rank, rankings.length));
}

async function cmdUrgentTasks(sheetId, userId, replyToken) {
  const studentName = await sheets.getStudentName(sheetId, userId);
  if (!studentName) return client.replyMessage(replyToken, { type: 'text', text: '⚠️ กรุณาลงทะเบียนก่อนนะครับ' });

  const allTasks     = (await sheets.getAllTasks(sheetId)).filter(t => t.status === 'open');
  const submitted    = await sheets.getSubmissionsByStudent(sheetId, userId);
  const submittedIds = submitted.map(s => s[2]);
  const today        = new Date();
  const in3Days      = new Date(); in3Days.setDate(today.getDate() + 3);

  const urgent = allTasks.filter(t => {
    if (submittedIds.includes(t.taskId)) return false;
    const due = parseThaiDate(t.dueDate);
    return due && due <= in3Days;
  });

  if (!urgent.length) return client.replyMessage(replyToken, { type: 'text', text: '✅ ไม่มีงานด่วนใน 3 วันนี้ครับ สบายใจได้เลย!' });
  return client.replyMessage(replyToken, flex.todayTasksCard(urgent));
}

async function cmdTodayTasks(sheetId, replyToken) {
  const allTasks   = (await sheets.getAllTasks(sheetId)).filter(t => t.status === 'open');
  const today      = new Date().toLocaleDateString('th-TH');
  const todayTasks = allTasks.filter(t => t.dueDate === today);
  return client.replyMessage(replyToken, flex.todayTasksCard(todayTasks));
}

async function cmdSubmit(sheetId, userId, taskId, replyToken) {
  if (!taskId) {
    const openTasks = (await sheets.getAllTasks(sheetId)).filter(t => t.status === 'open');
    if (!openTasks.length) return client.replyMessage(replyToken, { type: 'text', text: '📭 ขณะนี้ไม่มีงานที่เปิดรับส่งครับ' });
    const list = openTasks.map(t => `• ${t.name} (${t.taskId})`).join('\n');
    return client.replyMessage(replyToken, { type: 'text', text: `📋 งานที่เปิดรับส่ง:\n${list}\n\nพิมพ์ @ปลาทูทวง ส่งงาน [รหัสงาน]` });
  }

  const result = await sheets.submitWork(sheetId, userId, taskId, '');
  if (!result.success) {
    const msgs = {
      not_registered: '⚠️ กรุณาลงทะเบียนก่อนนะครับ',
      task_not_found: '⚠️ ไม่พบรหัสงานนั้นครับ',
      task_closed:    '🔒 งานนี้ปิดรับส่งแล้วครับ',
    };
    return client.replyMessage(replyToken, { type: 'text', text: msgs[result.reason] || '⚠️ เกิดข้อผิดพลาดครับ' });
  }

  const extra = result.isResubmit ? '\n📝 (บันทึกทับงานเดิมแล้ว ครูจะเห็นไฟล์ล่าสุดครับ)' : '';
  return client.replyMessage(replyToken, { type: 'text', text: `✅ ส่งงาน "${result.taskName}" สำเร็จ!\n🌟 ${result.studentName}${extra}` });
}

async function cmdReport(sheetId, roomName, taskName, replyToken) {
  const allTasks = (await sheets.getAllTasks(sheetId)).filter(t => t.status !== 'deleted');
  const students = await sheets.getAllStudents(sheetId);
  const total    = students.length;
  const today    = new Date();

  if (taskName) {
    const task = allTasks.find(t => t.name.includes(taskName) || t.taskId === taskName);
    if (!task) return client.replyMessage(replyToken, { type: 'text', text: `⚠️ ไม่พบงานชื่อ "${taskName}" ครับ` });
    const subs         = await sheets.getSubmissionsByTask(sheetId, task.taskId);
    const submittedIds = subs.map(s => s[0]);
    const notSub       = students.filter(s => !submittedIds.includes(s[0]));
    return client.replyMessage(replyToken, {
      type: 'text',
      text: `📊 ${task.name}\n✅ ส่งแล้ว: ${subs.length}/${total} คน\n⏳ ยังไม่ส่ง: ${notSub.length} คน\n\n${notSub.map(s => s[1]).join(', ') || 'ทุกคนส่งแล้ว! 🎉'}`,
    });
  }

  const summaries = await Promise.all(
    allTasks.map(async t => {
      const subs = await sheets.getSubmissionsByTask(sheetId, t.taskId);
      const due  = parseThaiDate(t.dueDate);
      return {
        ...t, submitted: subs.length, total,
        isOverdue: due && due < today,
        isNear:    due && due >= today && (due - today) / 86400000 <= 3,
      };
    })
  );

  return client.replyMessage(replyToken, flex.reportCard(
    roomName,
    summaries.filter(t => t.status === 'open' && !t.isOverdue && !t.isNear),
    summaries.filter(t => t.isOverdue),
    summaries.filter(t => t.isNear && !t.isOverdue),
  ));
}

async function cmdRank(sheetId, roomName, replyToken) {
  const rankings = await sheets.getRanking(sheetId);
  if (!rankings.length) return client.replyMessage(replyToken, { type: 'text', text: '⚠️ ยังไม่มีนักเรียนลงทะเบียนครับ' });
  return client.replyMessage(replyToken, flex.rankingCard(roomName, rankings));
}

// ============================================================
//  REST API สำหรับหน้าเว็บครู
// ============================================================

app.use(express.json());

app.post('/api/setup', async (req, res) => {
  const { groupId, roomName, year, semester } = req.body;
  if (!groupId || !roomName || !year || !semester) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

  const registry = getRegistry();
  if (registry[groupId]) return res.status(400).json({ error: 'ห้องนี้ตั้งค่าไปแล้ว' });

  const result = await sheets.createRoomSheet(roomName, year, semester);
  registry[groupId] = { sheetId: result.sheetId, roomName, year, semester, folderId: result.folderId };
  saveRegistry(registry);

  await client.pushMessage(groupId, {
    type: 'text',
    text: `✅ ตั้งค่าห้อง "${roomName}" สำเร็จแล้วครับ!\n📊 Sheet: https://docs.google.com/spreadsheets/d/${result.sheetId}\n\nพิมพ์ @ปลาทูทวง วิธีใช้ เพื่อดูคำสั่งทั้งหมดครับ`,
  });

  res.json({ success: true, sheetId: result.sheetId });
});

app.get('/api/rooms', (req, res) => {
  const registry = getRegistry();
  res.json(Object.entries(registry).map(([groupId, info]) => ({ groupId, ...info })));
});

app.get('/api/rooms/:groupId/tasks', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const allTasks = await sheets.getAllTasks(roomInfo.sheetId);
  const students = await sheets.getAllStudents(roomInfo.sheetId);
  const tasks    = await Promise.all(
    allTasks.filter(t => t.status !== 'deleted').map(async t => {
      const subs = await sheets.getSubmissionsByTask(roomInfo.sheetId, t.taskId);
      return { ...t, submitted: subs.length, total: students.length };
    })
  );
  res.json(tasks);
});

app.post('/api/rooms/:groupId/tasks', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const { taskData, notifyGroup } = req.body;
  const taskId = await sheets.createTask(roomInfo.sheetId, taskData, `${roomInfo.year} เทอม ${roomInfo.semester}`);
  if (notifyGroup) {
    const task = await sheets.getTaskById(roomInfo.sheetId, taskId);
    await client.pushMessage(req.params.groupId, flex.newTaskCard(task));
  }
  res.json({ success: true, taskId });
});

app.patch('/api/rooms/:groupId/tasks/:taskId/status', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  await sheets.updateTaskStatus(roomInfo.sheetId, req.params.taskId, req.body.status);
  res.json({ success: true });
});

app.patch('/api/rooms/:groupId/tasks/:taskId/rename', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const { newName, notify, oldName } = req.body;
  await sheets.updateTaskName(roomInfo.sheetId, req.params.taskId, newName);
  if (notify) await client.pushMessage(req.params.groupId, flex.taskChangedCard('rename', oldName, newName));
  res.json({ success: true });
});

app.delete('/api/rooms/:groupId/tasks/:taskId', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const { notify, taskName } = req.body;
  await sheets.deleteTask(roomInfo.sheetId, req.params.taskId);
  if (notify) await client.pushMessage(req.params.groupId, flex.taskChangedCard('delete', taskName));
  res.json({ success: true });
});

app.get('/api/rooms/:groupId/tasks/:taskId/submissions', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  const subs     = await sheets.getSubmissionsByTask(roomInfo.sheetId, req.params.taskId);
  const students = await sheets.getAllStudents(roomInfo.sheetId);
  const submittedIds = subs.map(s => s[0]);
  res.json({
    submitted:    subs.map(s => ({ lineId: s[0], name: s[1], submittedAt: s[4], fileUrl: s[5], count: s[6] })),
    notSubmitted: students.filter(s => !submittedIds.includes(s[0])).map(s => ({ lineId: s[0], name: s[1] })),
  });
});

app.post('/api/rooms/:groupId/tasks/:taskId/score', async (req, res) => {
  const roomInfo = getRegistry()[req.params.groupId];
  if (!roomInfo) return res.status(404).json({ error: 'ไม่พบห้อง' });
  await sheets.updateScore(roomInfo.sheetId, req.body.lineId, req.params.taskId, req.body.score);
  res.json({ success: true });
});

// ============================================================
//  Utility
// ============================================================

function parseThaiDate(str) {
  if (!str) return null;
  try {
    const [d, m, y] = str.split('/').map(Number);
    return new Date(y - 543, m - 1, d);
  } catch { return null; }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🐟 ปลาทูทวง กำลังทำงานที่ port ${PORT}`));

// ============================================================
//  API ทดสอบ Cron Manual
// ============================================================

app.post('/api/cron/run', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ message: 'Cron กำลังทำงาน...' });
  runManualCheck();
});

// ============================================================
//  Start Server + Cron
// ============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐟 ปลาทูทวง กำลังทำงานที่ port ${PORT}`);
  startCron();
});
