// ============================================================
//  cron.js — ระบบแจ้งเตือนอัตโนมัติ ปลาทูทวง
//  ทำงานทุกวัน เวลา 08:00 น.
//  - ก่อนกำหนด 3 วัน → แจ้งเตือน 1 ครั้ง
//  - วันครบกำหนด     → แจ้งเตือน 1 ครั้ง
//  - เกินกำหนด       → ทวง 1 ครั้งเท่านั้น
// ============================================================

const cron   = require('node-cron');
const line   = require('@line/bot-sdk');
const sheets = require('./sheets');
const flex   = require('./flex');
const fs     = require('fs');

const client = new line.Client({
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
});

const REGISTRY_PATH = './registry.json';

function getRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
  catch { return {}; }
}

// ============================================================
//  เริ่ม Cron Job — รันทุกวัน เวลา 08:00 น.
// ============================================================

function startCron() {
  // ทุกวัน 08:00 น. (timezone Asia/Bangkok)
  cron.schedule('0 8 * * *', async () => {
    console.log('🕗 Cron: เริ่มตรวจสอบงานทั้งหมด', new Date().toLocaleString('th-TH'));
    await checkAllRooms();
  }, {
    timezone: 'Asia/Bangkok',
  });

  console.log('✅ Cron Job เริ่มทำงานแล้ว — จะแจ้งเตือนทุกวัน 08:00 น.');
}

// ============================================================
//  ตรวจสอบทุกห้องเรียน
// ============================================================

async function checkAllRooms() {
  const registry = getRegistry();
  const rooms    = Object.entries(registry);

  if (rooms.length === 0) {
    console.log('ℹ️ ยังไม่มีห้องเรียนในระบบ');
    return;
  }

  for (const [groupId, roomInfo] of rooms) {
    try {
      console.log(`🔍 ตรวจสอบห้อง: ${roomInfo.roomName}`);
      await checkRoom(groupId, roomInfo);
    } catch (err) {
      console.error(`❌ Error ห้อง ${roomInfo.roomName}:`, err.message);
    }
  }
}

// ============================================================
//  ตรวจสอบงานในแต่ละห้อง
// ============================================================

async function checkRoom(groupId, roomInfo) {
  const { sheetId, roomName } = roomInfo;

  // ดึงข้อมูลทั้งหมด
  const allTasks = (await sheets.getAllTasks(sheetId))
    .filter(t => t.status === 'open'); // เฉพาะงานที่เปิดรับอยู่

  const allStudents = await sheets.getAllStudents(sheetId);

  if (allTasks.length === 0) {
    console.log(`  ℹ️ ${roomName}: ไม่มีงานที่เปิดรับ`);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of allTasks) {
    const dueDate = parseThaiDate(task.dueDate);
    if (!dueDate) continue;

    const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    // หานักเรียนที่ยังไม่ส่ง
    const submissions  = await sheets.getSubmissionsByTask(sheetId, task.taskId);
    const submittedIds = submissions.map(s => s[0]);
    const pending      = allStudents.filter(s => !submittedIds.includes(s[0]));

    if (pending.length === 0) {
      console.log(`  ✅ ${task.name}: ทุกคนส่งแล้ว`);
      continue;
    }

    // แปลงรายชื่อนักเรียนที่ยังไม่ส่ง
    const pendingStudents = pending.map(s => ({ lineId: s[0], name: s[1] }));

    if (diffDays === 3) {
      // ก่อนกำหนด 3 วัน
      await sendIfNotNotified(sheetId, groupId, task, pendingStudents, '3days', diffDays);

    } else if (diffDays === 0) {
      // วันครบกำหนด
      await sendIfNotNotified(sheetId, groupId, task, pendingStudents, 'dueday', 0);

    } else if (diffDays < 0) {
      // เกินกำหนด — ทวงครั้งเดียวเท่านั้น
      await sendIfNotNotified(sheetId, groupId, task, pendingStudents, 'overdue', diffDays);
    }
  }
}

// ============================================================
//  ส่งแจ้งเตือนถ้ายังไม่เคยส่ง (กันทวงซ้ำ)
// ============================================================

async function sendIfNotNotified(sheetId, groupId, task, pendingStudents, type, daysLeft) {
  // ตรวจว่าเคยส่งแจ้งเตือนประเภทนี้ไปแล้วหรือยัง
  const alreadySent = await sheets.hasNotified(sheetId, task.taskId, type);
  if (alreadySent) {
    console.log(`  ⏭️ ${task.name} (${type}): ส่งแจ้งเตือนไปแล้ว ข้ามไป`);
    return;
  }

  console.log(`  📣 ${task.name} (${type}): ส่งแจ้งเตือน ${pendingStudents.length} คน`);

  let message;
  if (type === 'overdue') {
    message = flex.overdueCard(task, pendingStudents);
  } else {
    message = flex.reminderCard(task, pendingStudents, Math.max(0, daysLeft));
  }

  try {
    // ส่ง Flex Card เข้ากลุ่ม
    await client.pushMessage(groupId, message);

    // ส่ง mention text แยกต่างหาก เพื่อ @tag รายชื่อจริงใน LINE
    const mentionText = buildMentionText(pendingStudents, type, task.name);
    if (mentionText) {
      await client.pushMessage(groupId, { type: 'text', text: mentionText });
    }

    // บันทึกว่าส่งแล้ว
    await sheets.markNotified(sheetId, task.taskId, type);

  } catch (err) {
    console.error(`  ❌ ส่งแจ้งเตือนไม่สำเร็จ:`, err.message);
  }
}

// ============================================================
//  สร้างข้อความ @mention รายชื่อ
// ============================================================

function buildMentionText(students, type, taskName) {
  if (students.length === 0) return null;

  const names = students.map(s => s.name).join(' ');
  const typeText = {
    '3days':  `⚠️ เหลือเวลาอีก 3 วัน! งาน "${taskName}" ยังไม่ส่งนะครับ`,
    'dueday': `🚨 วันนี้คือวันส่งงาน "${taskName}"! รีบส่งได้เลยครับ`,
    'overdue': `😤 เลยกำหนดส่งงาน "${taskName}" แล้วนะครับ รีบส่งด่วนเลย!`,
  };

  return `${typeText[type] || ''}\n\nรายชื่อที่ยังไม่ส่ง: ${names}`;
}

// ============================================================
//  ฟังก์ชันทดสอบ — เรียกได้จาก API
// ============================================================

async function runManualCheck() {
  console.log('🔄 Manual check เริ่มแล้ว...');
  await checkAllRooms();
  console.log('✅ Manual check เสร็จแล้ว');
}

// ============================================================
//  Utility
// ============================================================

function parseThaiDate(str) {
  if (!str) return null;
  try {
    const [d, m, y] = str.split('/').map(Number);
    const date = new Date(y - 543, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  } catch { return null; }
}

module.exports = { startCron, runManualCheck };
