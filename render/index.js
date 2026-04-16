const express = require('express');
const line    = require('@line/bot-sdk');
const { google } = require('googleapis');

const app = express();

// ===== ตั้งค่าตรงนี้ =====
const config = {
  channelSecret:     process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
};
const MASTER_FOLDER_NAME = process.env.FOLDER_NAME || 'Platootuang';
// =========================

const client = new line.Client(config);

// Google Auth จาก Environment Variable
function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

// ---- Registry: เก็บ groupId → sheetId ใน memory (ใช้ชั่วคราว) ----
// สำหรับ production ควรเก็บใน DB แต่สำหรับตอนนี้ใช้ file-based registry
const fs = require('fs');
const REGISTRY_FILE = '/tmp/registry.json';

function getRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch { return {}; }
}
function saveRegistry(data) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data));
}

// ---- Webhook endpoint ----
app.post('/webhook', line.middleware(config), async (req, res) => {
  res.status(200).send('OK'); // ตอบ LINE ทันที
  try {
    await Promise.all(req.body.events.map(handleEvent));
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

app.get('/', (req, res) => res.send('ClassBot is running!'));

// ---- Router ----
async function handleEvent(event) {
  const { type, source, replyToken } = event;
  const groupId = source.groupId || null;
  const userId  = source.userId;

  if (type === 'join' && groupId) {
    await setupNewGroup(groupId);
    return;
  }

  if (type === 'message' && event.message.type === 'text') {
    await handleText(event.message.text.trim(), userId, groupId, replyToken);
  }
}

// ---- สร้าง Sheet ใหม่เมื่อ Bot เข้ากลุ่ม ----
async function setupNewGroup(groupId) {
  const registry = getRegistry();
  if (registry[groupId]) return;

  const auth    = getGoogleAuth();
  const drive   = google.drive({ version: 'v3', auth });
  const sheets  = google.sheets({ version: 'v4', auth });

  // สร้าง Spreadsheet
  const ss = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'ห้องเรียน – ClassBot' },
      sheets: [
        { properties: { title: 'นักเรียน' } },
        { properties: { title: 'งาน' } },
        { properties: { title: 'การส่งงาน' } },
        { properties: { title: 'ประวัติคะแนน' } },
      ],
    },
  });
  const sheetId = ss.data.spreadsheetId;

  // ใส่ header แต่ละแท็บ
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: 'นักเรียน!A1:D1', values: [['lineId','ชื่อ-นามสกุล','คะแนนรวม','วันที่ลงทะเบียน']] },
        { range: 'งาน!A1:F1',      values: [['id','ชื่องาน','วิชา','รายละเอียด','วันส่ง','วันที่มอบหมาย']] },
        { range: 'การส่งงาน!A1:F1', values: [['lineId','ชื่อนักเรียน','ชื่องาน','วันที่ส่ง','คะแนน','หมายเหตุครู']] },
        { range: 'ประวัติคะแนน!A1:F1', values: [['lineId','ชื่อนักเรียน','คะแนน','เหตุผล','วันที่','ให้โดย']] },
      ],
    },
  });

  // ย้ายเข้าโฟลเดอร์
  const folderRes = await drive.files.list({
    q: `name='${MASTER_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  let folderId;
  if (folderRes.data.files.length > 0) {
    folderId = folderRes.data.files[0].id;
  } else {
    const f = await drive.files.create({
      requestBody: { name: MASTER_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = f.data.id;
  }
  await drive.files.update({ fileId: sheetId, addParents: folderId, removeParents: 'root', fields: 'id' });

  // บันทึก registry
  registry[groupId] = { sheetId, name: 'ห้องเรียน – ClassBot' };
  saveRegistry(registry);

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  await client.pushMessage(groupId, {
    type: 'text',
    text: '🎉 ระบบ ClassBot พร้อมใช้งานแล้ว!\n\n📊 Google Sheet ของห้องนี้:\n' + url +
          '\n\nตั้งชื่อห้อง: /setup ชื่อห้อง\nดูคำสั่งทั้งหมด: /help',
  });
}

// ---- จัดการคำสั่ง ----
async function handleText(text, userId, groupId, replyToken) {
  const cmd  = text.split(' ')[0].toLowerCase();
  const args = text.slice(cmd.length).trim();

  if (cmd === '/help') return replyHelp(replyToken);

  const registry = getRegistry();
  if (!groupId || !registry[groupId]) {
    return client.replyMessage(replyToken, { type: 'text', text: '⚠️ ใช้คำสั่งนี้ในกลุ่มไลน์เท่านั้น' });
  }
  const sheetId = registry[groupId].sheetId;

  switch (cmd) {
    case '/setup':    return setupRoom(sheetId, args, replyToken);
    case '/register': return registerStudent(sheetId, userId, args, replyToken);
    case '/homework':
    case '/hw':       return addHomework(sheetId, groupId, args, replyToken);
    case '/done':     return submitWork(sheetId, userId, args, replyToken);
    case '/status':   return showStatus(sheetId, userId, replyToken);
    case '/score':    return showScore(sheetId, userId, replyToken);
    case '/rank':     return showRank(sheetId, replyToken);
    case '/give':     return giveScore(sheetId, args, replyToken);
    case '/report':   return showReport(sheetId, replyToken);
  }
}

async function replyHelp(replyToken) {
  return client.replyMessage(replyToken, {
    type: 'text',
    text: '📚 ClassBot คำสั่งทั้งหมด\n─────────────────\n' +
          '👩‍🎓 นักเรียน\n/register ชื่อ-นามสกุล\n/done ชื่องาน\n' +
          '/status — งานที่ค้างอยู่\n/score — คะแนนของฉัน\n/rank — อันดับทั้งห้อง\n\n' +
          '👩‍🏫 ครู\n/setup ชื่อห้อง\n/hw ชื่องาน | วิชา | วันส่ง\n' +
          '/give ชื่อ คะแนน เหตุผล\n/report — สรุปการส่งงาน',
  });
}

async function setupRoom(sheetId, name, replyToken) {
  if (!name) return replyMsg(replyToken, '⚠️ ระบุชื่อห้องด้วย เช่น /setup ม.1/1');
  const auth   = getGoogleAuth();
  const drive  = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });
  const title  = 'ห้อง ' + name + ' – ClassBot';
  await drive.files.update({ fileId: sheetId, requestBody: { name: title } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: [{ updateSpreadsheetProperties: { properties: { title }, fields: 'title' } }] } });
  return replyMsg(replyToken, '✅ ตั้งชื่อห้องเป็น "' + name + '" เรียบร้อย!');
}

async function registerStudent(sheetId, userId, name, replyToken) {
  if (!name) return replyMsg(replyToken, '⚠️ ระบุชื่อด้วย เช่น /register สมชาย ใจดี');
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:D' });
  const rows   = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) return replyMsg(replyToken, '⚠️ ลงทะเบียนไปแล้วในชื่อ "' + rows[i][1] + '"');
  }
  await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'นักเรียน!A:D', valueInputOption: 'RAW', requestBody: { values: [[userId, name, 0, new Date().toLocaleDateString('th-TH')]] } });
  return replyMsg(replyToken, '✅ ลงทะเบียนสำเร็จ! ยินดีต้อนรับ ' + name + ' 🎉');
}

async function addHomework(sheetId, groupId, args, replyToken) {
  const parts = args.split('|').map(s => s.trim());
  if (parts.length < 3) return replyMsg(replyToken, '⚠️ รูปแบบ: /hw ชื่องาน | วิชา | วันส่ง');
  const [taskName, subject, dueDate] = parts;
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'งาน!A:F', valueInputOption: 'RAW', requestBody: { values: [['HW-' + Date.now(), taskName, subject, '', dueDate, new Date().toLocaleDateString('th-TH')]] } });
  await client.pushMessage(groupId, { type: 'text', text: '📢 งานใหม่!\n📝 ' + taskName + '\n📚 ' + subject + '\n📅 ส่งภายใน: ' + dueDate + '\n\nพิมพ์ /done ' + taskName + ' เมื่อส่งงานแล้ว' });
}

async function submitWork(sheetId, userId, taskName, replyToken) {
  if (!taskName) return replyMsg(replyToken, '⚠️ ระบุชื่องานด้วย เช่น /done รายงาน');
  const auth    = getGoogleAuth();
  const sheets  = google.sheets({ version: 'v4', auth });
  const name    = await getStudentName(sheets, sheetId, userId);
  if (!name) return replyMsg(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'การส่งงาน!A:F', valueInputOption: 'RAW', requestBody: { values: [[userId, name, taskName, new Date().toLocaleDateString('th-TH'), '', '']] } });
  await addScoreRecord(sheets, sheetId, userId, name, 5, 'ส่งงาน: ' + taskName, 'ระบบ');
  return replyMsg(replyToken, '✅ บันทึกการส่ง "' + taskName + '" แล้ว!\n🌟 ได้รับ +5 คะแนน');
}

async function showStatus(sheetId, userId, replyToken) {
  const auth    = getGoogleAuth();
  const sheets  = google.sheets({ version: 'v4', auth });
  const name    = await getStudentName(sheets, sheetId, userId);
  if (!name) return replyMsg(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  const [tasksRes, subRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'งาน!A:F' }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'การส่งงาน!A:F' }),
  ]);
  const allTasks  = (tasksRes.data.values || []).slice(1);
  const submitted = (subRes.data.values || []).slice(1).filter(r => r[0] === userId).map(r => r[2]);
  const pending   = allTasks.filter(t => !submitted.includes(t[1]));
  if (!pending.length) return replyMsg(replyToken, '🎉 ส่งงานครบทุกชิ้นแล้ว!');
  let msg = '📋 งานที่ยังค้าง (' + pending.length + ' ชิ้น)\n─────────────────\n';
  pending.forEach(t => { msg += '• ' + t[1] + ' วิชา: ' + t[2] + '\n  📅 ส่ง: ' + t[4] + '\n'; });
  return replyMsg(replyToken, msg);
}

async function showScore(sheetId, userId, replyToken) {
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:C' });
  const rows   = (res.data.values || []).slice(1);
  const row    = rows.find(r => r[0] === userId);
  if (!row) return replyMsg(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  return replyMsg(replyToken, '⭐ คะแนนของ ' + row[1] + '\n🏆 ' + (row[2] || 0) + ' คะแนน');
}

async function showRank(sheetId, replyToken) {
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:C' });
  const rows   = (res.data.values || []).slice(1);
  if (!rows.length) return replyMsg(replyToken, '⚠️ ยังไม่มีนักเรียนลงทะเบียน');
  const sorted = rows.sort((a, b) => (parseInt(b[2]) || 0) - (parseInt(a[2]) || 0));
  const medals = ['🥇','🥈','🥉'];
  let msg = '🏆 อันดับคะแนน\n─────────────────\n';
  sorted.slice(0, 10).forEach((s, i) => { msg += (medals[i] || (i+1)+'.') + ' ' + s[1] + ' — ' + (s[2] || 0) + ' คะแนน\n'; });
  return replyMsg(replyToken, msg);
}

async function giveScore(sheetId, args, replyToken) {
  const parts = args.split(' ');
  if (parts.length < 2) return replyMsg(replyToken, '⚠️ รูปแบบ: /give ชื่อ คะแนน เหตุผล');
  const targetName = parts[0];
  const score      = parseInt(parts[1]) || 0;
  const reason     = parts.slice(2).join(' ') || 'ครูให้คะแนน';
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:B' });
  const rows   = (res.data.values || []).slice(1);
  const row    = rows.find(r => r[1] && r[1].includes(targetName));
  if (!row) return replyMsg(replyToken, '⚠️ ไม่พบนักเรียนชื่อ "' + targetName + '"');
  await addScoreRecord(sheets, sheetId, row[0], row[1], score, reason, 'ครู');
  return replyMsg(replyToken, '✅ ให้ ' + row[1] + ' +' + score + ' คะแนน\nเหตุผล: ' + reason);
}

async function showReport(sheetId, replyToken) {
  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const [tasksRes, subRes, studRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'งาน!A:F' }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'การส่งงาน!A:F' }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:B' }),
  ]);
  const tasks    = (tasksRes.data.values || []).slice(1);
  const submitted = (subRes.data.values || []).slice(1);
  const students  = (studRes.data.values || []).slice(1);
  if (!tasks.length) return replyMsg(replyToken, '⚠️ ยังไม่มีงานที่มอบหมาย');
  let msg = '📊 รายงานสรุปการส่งงาน\n─────────────────\n';
  tasks.forEach(task => {
    const subs   = submitted.filter(s => s[2] === task[1]).map(s => s[0]);
    const notYet = students.filter(s => !subs.includes(s[0])).map(s => s[1]);
    msg += '📝 ' + task[1] + '\n✅ ส่งแล้ว: ' + subs.length + '/' + students.length + ' คน\n';
    if (notYet.length) msg += '⏳ ยังไม่ส่ง: ' + notYet.join(', ') + '\n';
    msg += '\n';
  });
  return replyMsg(replyToken, msg);
}

// ---- Helpers ----
async function getStudentName(sheets, sheetId, userId) {
  const res  = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:B' });
  const rows = (res.data.values || []).slice(1);
  const row  = rows.find(r => r[0] === userId);
  return row ? row[1] : null;
}

async function addScoreRecord(sheets, sheetId, userId, name, score, reason, giver) {
  await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'ประวัติคะแนน!A:F', valueInputOption: 'RAW', requestBody: { values: [[userId, name, score, reason, new Date().toLocaleDateString('th-TH'), giver]] } });
  const res  = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'นักเรียน!A:C' });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === userId) {
      const newScore = (parseInt(rows[i][2]) || 0) + score;
      await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `นักเรียน!C${i+1}`, valueInputOption: 'RAW', requestBody: { values: [[newScore]] } });
      break;
    }
  }
}

function replyMsg(replyToken, text) {
  return client.replyMessage(replyToken, { type: 'text', text });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ClassBot running on port ' + PORT));
