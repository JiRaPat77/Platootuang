const express = require('express');
const line    = require('@line/bot-sdk');
const { google } = require('googleapis');

const app = express();

// ===== Config จาก Environment Variables =====
const config = {
  channelSecret:     process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
};
const MASTER_FOLDER_NAME = process.env.FOLDER_NAME || 'ClassBot';

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

// ===== Google Sheets Auth =====
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

// ===== Registry: เก็บ groupId → sheetId ใน memory =====
const registry = {};

// ===== Webhook endpoint =====
app.post('/webhook',
  line.middleware(config),
  async (req, res) => {
    res.status(200).send('OK');  // ตอบ LINE ทันที
    try {
      await Promise.all(req.body.events.map(handleEvent));
    } catch (err) {
      console.error('webhook error:', err);
    }
  }
);

// Health check
app.get('/', (req, res) => res.send('ClassBot OK'));

// ===== Event Router =====
async function handleEvent(event) {
  const { type, source, replyToken } = event;
  const groupId = source?.groupId || null;
  const userId  = source?.userId;

  if (type === 'join' && groupId) {
    await setupNewGroup(groupId);
    return;
  }

  if (type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    await handleText(text, userId, groupId, replyToken);
  }
}

// ===== สร้าง Sheet ใหม่เมื่อ Bot เข้ากลุ่ม =====
async function setupNewGroup(groupId) {
  if (registry[groupId]) return;

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive  = google.drive({ version: 'v3', auth });

  // สร้าง Spreadsheet ใหม่
  const res = await sheets.spreadsheets.create({
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

  const sheetId = res.data.spreadsheetId;
  registry[groupId] = sheetId;

  // ใส่ header แต่ละแท็บ
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: 'นักเรียน!A1:D1', values: [['lineId','ชื่อ-นามสกุล','คะแนนรวม','วันที่ลงทะเบียน']] },
        { range: 'งาน!A1:F1',      values: [['id','ชื่องาน','วิชา','รายละเอียด','วันส่ง','วันที่มอบหมาย']] },
        { range: 'การส่งงาน!A1:F1', values: [['lineId','ชื่อนักเรียน','ชื่องาน','วันที่ส่ง','คะแนน','หมายเหตุ']] },
        { range: 'ประวัติคะแนน!A1:F1', values: [['lineId','ชื่อ','คะแนน','เหตุผล','วันที่','ให้โดย']] },
      ],
    },
  });

  // ย้ายเข้าโฟลเดอร์
  const folders = await drive.files.list({
    q: `name='${MASTER_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  });
  let folderId;
  if (folders.data.files.length > 0) {
    folderId = folders.data.files[0].id;
  } else {
    const f = await drive.files.create({
      requestBody: { name: MASTER_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    });
    folderId = f.data.id;
  }
  await drive.files.update({
    fileId: sheetId,
    addParents: folderId,
    removeParents: 'root',
  });

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  await pushMessage(groupId,
    '🎉 ระบบ ClassBot พร้อมใช้งานแล้ว!\n\n' +
    '📊 Google Sheet ของห้องนี้:\n' + url + '\n\n' +
    'ตั้งชื่อห้อง: /setup ชื่อห้อง\n' +
    'ดูคำสั่งทั้งหมด: /help'
  );
}

// ===== Command Handler =====
async function handleText(text, userId, groupId, replyToken) {
  const parts = text.split(' ');
  const cmd   = parts[0].toLowerCase();
  const args  = parts.slice(1).join(' ');
  const sheetId = groupId ? registry[groupId] : null;

  if (cmd === '/help') return reply(replyToken, helpText());
  if (!sheetId && cmd !== '/help')
    return reply(replyToken, '⚠️ ใช้คำสั่งนี้ในกลุ่มไลน์เท่านั้น\nหรือ Bot ยังไม่ได้ถูกเพิ่มเข้ากลุ่มนี้');

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  switch (cmd) {
    case '/setup':    await cmdSetup(sheets, sheetId, args, replyToken); break;
    case '/register': await cmdRegister(sheets, sheetId, userId, args, replyToken); break;
    case '/hw':
    case '/homework': await cmdHomework(sheets, sheetId, groupId, args, replyToken); break;
    case '/done':     await cmdDone(sheets, sheetId, userId, args, replyToken); break;
    case '/status':   await cmdStatus(sheets, sheetId, userId, replyToken); break;
    case '/score':    await cmdScore(sheets, sheetId, userId, replyToken); break;
    case '/rank':     await cmdRank(sheets, sheetId, replyToken); break;
    case '/give':     await cmdGive(sheets, sheetId, args, replyToken); break;
    case '/report':   await cmdReport(sheets, sheetId, replyToken); break;
  }
}

// ===== Commands =====
async function cmdSetup(sheets, sheetId, name, replyToken) {
  if (!name) return reply(replyToken, '⚠️ เช่น /setup ม.1/1');
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [{ updateSpreadsheetProperties: {
      properties: { title: 'ห้อง ' + name + ' – ClassBot' },
      fields: 'title',
    }}]},
  });
  reply(replyToken, '✅ ตั้งชื่อห้องเป็น "' + name + '" เรียบร้อย!');
}

async function cmdRegister(sheets, sheetId, userId, name, replyToken) {
  if (!name) return reply(replyToken, '⚠️ เช่น /register สมชาย ใจดี');
  const rows = await getRows(sheets, sheetId, 'นักเรียน');
  if (rows.find(r => r[0] === userId))
    return reply(replyToken, '⚠️ ลงทะเบียนไปแล้วในชื่อ "' + rows.find(r=>r[0]===userId)[1] + '"');
  await appendRow(sheets, sheetId, 'นักเรียน', [userId, name, 0, new Date().toLocaleDateString('th-TH')]);
  reply(replyToken, '✅ ลงทะเบียนสำเร็จ! ยินดีต้อนรับ ' + name + ' 🎉');
}

async function cmdHomework(sheets, sheetId, groupId, args, replyToken) {
  const parts = args.split('|').map(s => s.trim());
  if (parts.length < 3) return reply(replyToken, '⚠️ รูปแบบ: /hw ชื่องาน | วิชา | วันส่ง');
  const [taskName, subject, dueDate] = parts;
  await appendRow(sheets, sheetId, 'งาน', ['HW-'+Date.now(), taskName, subject, '', dueDate, new Date().toLocaleDateString('th-TH')]);
  await pushMessage(groupId,
    '📢 งานใหม่!\n📝 ' + taskName + '\n📚 ' + subject + '\n📅 ส่งภายใน: ' + dueDate +
    '\n\nพิมพ์ /done ' + taskName + ' เมื่อส่งงานแล้ว'
  );
}

async function cmdDone(sheets, sheetId, userId, taskName, replyToken) {
  if (!taskName) return reply(replyToken, '⚠️ เช่น /done รายงาน');
  const students = await getRows(sheets, sheetId, 'นักเรียน');
  const student  = students.find(r => r[0] === userId);
  if (!student) return reply(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  await appendRow(sheets, sheetId, 'การส่งงาน', [userId, student[1], taskName, new Date().toLocaleDateString('th-TH'), '', '']);
  await addScore(sheets, sheetId, userId, student[1], 5, 'ส่งงาน: '+taskName, 'ระบบ');
  reply(replyToken, '✅ บันทึกการส่ง "' + taskName + '" แล้ว!\n🌟 ได้รับ +5 คะแนน');
}

async function cmdStatus(sheets, sheetId, userId, replyToken) {
  const students = await getRows(sheets, sheetId, 'นักเรียน');
  const student  = students.find(r => r[0] === userId);
  if (!student) return reply(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  const tasks     = await getRows(sheets, sheetId, 'งาน');
  const submitted = (await getRows(sheets, sheetId, 'การส่งงาน')).filter(r => r[0]===userId).map(r=>r[2]);
  const pending   = tasks.filter(t => !submitted.includes(t[1]));
  if (!pending.length) return reply(replyToken, '🎉 ส่งงานครบทุกชิ้นแล้ว!');
  let msg = '📋 งานที่ยังค้าง (' + pending.length + ' ชิ้น)\n─────────────────\n';
  pending.forEach(t => { msg += '• ' + t[1] + ' วิชา:' + t[2] + ' ส่ง:' + t[4] + '\n'; });
  reply(replyToken, msg);
}

async function cmdScore(sheets, sheetId, userId, replyToken) {
  const rows = await getRows(sheets, sheetId, 'นักเรียน');
  const s = rows.find(r => r[0] === userId);
  if (!s) return reply(replyToken, '⚠️ กรุณา /register ชื่อก่อนนะคะ');
  reply(replyToken, '⭐ คะแนนของ ' + s[1] + '\n🏆 ' + (s[2]||0) + ' คะแนน');
}

async function cmdRank(sheets, sheetId, replyToken) {
  const rows = await getRows(sheets, sheetId, 'นักเรียน');
  if (!rows.length) return reply(replyToken, '⚠️ ยังไม่มีนักเรียนลงทะเบียน');
  const sorted = [...rows].sort((a,b) => (Number(b[2])||0) - (Number(a[2])||0));
  const medals = ['🥇','🥈','🥉'];
  let msg = '🏆 อันดับคะแนน\n─────────────────\n';
  sorted.slice(0,10).forEach((s,i) => { msg += (medals[i]||(i+1)+'.') + ' ' + s[1] + ' — ' + (s[2]||0) + ' คะแนน\n'; });
  reply(replyToken, msg);
}

async function cmdGive(sheets, sheetId, args, replyToken) {
  const parts = args.split(' ');
  if (parts.length < 2) return reply(replyToken, '⚠️ รูปแบบ: /give ชื่อ คะแนน เหตุผล');
  const [name, scoreStr, ...reasonParts] = parts;
  const score  = parseInt(scoreStr) || 0;
  const reason = reasonParts.join(' ') || 'ครูให้คะแนน';
  const rows   = await getRows(sheets, sheetId, 'นักเรียน');
  const target = rows.find(r => r[1]?.includes(name));
  if (!target) return reply(replyToken, '⚠️ ไม่พบนักเรียนชื่อ "' + name + '"');
  await addScore(sheets, sheetId, target[0], target[1], score, reason, 'ครู');
  reply(replyToken, '✅ ให้ ' + target[1] + ' +' + score + ' คะแนน\nเหตุผล: ' + reason);
}

async function cmdReport(sheets, sheetId, replyToken) {
  const tasks    = await getRows(sheets, sheetId, 'งาน');
  const subs     = await getRows(sheets, sheetId, 'การส่งงาน');
  const students = await getRows(sheets, sheetId, 'นักเรียน');
  if (!tasks.length) return reply(replyToken, '⚠️ ยังไม่มีงานที่มอบหมาย');
  let msg = '📊 รายงานสรุปการส่งงาน\n─────────────────\n';
  tasks.forEach(task => {
    const submitted = subs.filter(s => s[2]===task[1]).map(s=>s[0]);
    const notYet    = students.filter(s => !submitted.includes(s[0])).map(s=>s[1]);
    msg += '📝 ' + task[1] + '\n✅ ส่งแล้ว: ' + submitted.length + '/' + students.length + ' คน\n';
    if (notYet.length) msg += '⏳ ยังไม่ส่ง: ' + notYet.join(', ') + '\n';
    msg += '\n';
  });
  reply(replyToken, msg);
}

// ===== Helpers =====
async function getRows(sheets, sheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: sheetName + '!A2:Z',
  });
  return res.data.values || [];
}

async function appendRow(sheets, sheetId, sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: sheetName + '!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

async function addScore(sheets, sheetId, userId, name, score, reason, giver) {
  await appendRow(sheets, sheetId, 'ประวัติคะแนน', [userId, name, score, reason, new Date().toLocaleDateString('th-TH'), giver]);
  const rows = await getRows(sheets, sheetId, 'นักเรียน');
  const idx  = rows.findIndex(r => r[0] === userId);
  if (idx >= 0) {
    const newScore = (Number(rows[idx][2]) || 0) + score;
    const auth   = getAuth();
    const s      = google.sheets({ version: 'v4', auth });
    await s.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'นักเรียน!C' + (idx + 2),
      valueInputOption: 'RAW',
      requestBody: { values: [[newScore]] },
    });
  }
}

async function reply(replyToken, text) {
  await client.replyMessage({ replyToken, messages: [{ type: 'text', text }] });
}

async function pushMessage(to, text) {
  await client.pushMessage({ to, messages: [{ type: 'text', text }] });
}

function helpText() {
  return '📚 ClassBot คำสั่งทั้งหมด\n' +
    '─────────────────\n' +
    '👩‍🎓 นักเรียน\n' +
    '/register ชื่อ-นามสกุล\n' +
    '/done ชื่องาน\n' +
    '/status — งานที่ค้างอยู่\n' +
    '/score — คะแนนของฉัน\n' +
    '/rank — อันดับทั้งห้อง\n\n' +
    '👩‍🏫 ครู\n' +
    '/setup ชื่อห้อง\n' +
    '/hw ชื่องาน | วิชา | วันส่ง\n' +
    '/give ชื่อ คะแนน เหตุผล\n' +
    '/report — สรุปการส่งงาน';
}

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ClassBot running on port ' + PORT));
