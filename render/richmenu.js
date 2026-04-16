// ============================================================
//  richmenu.js — ตั้งค่า Rich Menu (เมนูปุ่มด้านล่างแชท)
//  ปลาทูทวง ClassBot v3
//
//  วิธีใช้:
//  1. รัน: node richmenu.js create   → สร้าง Rich Menu ใหม่
//  2. รัน: node richmenu.js delete   → ลบ Rich Menu เดิม
//  3. รัน: node richmenu.js list     → ดูรายการ Rich Menu
// ============================================================

require('dotenv').config();
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

const HEADERS = {
  'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

// ============================================================
//  โครงสร้าง Rich Menu 2 แบบ
//  - นักเรียน: ดูงาน คะแนน งานด่วน
//  - ครู:      เพิ่มในอนาคต (ตอนนี้ใช้ default)
// ============================================================

const RICH_MENU_STUDENT = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'ปลาทูทวง — เมนูนักเรียน',
  chatBarText: 'เมนูปลาทูทวง',
  areas: [
    // ปุ่มที่ 1: งานของฉัน (ซ้ายบน)
    {
      bounds: { x: 0, y: 0, width: 833, height: 421 },
      action: {
        type: 'message',
        label: 'งานของฉัน',
        text: '@ปลาทูทวง งานของฉัน',
      },
    },
    // ปุ่มที่ 2: คะแนนของฉัน (กลางบน)
    {
      bounds: { x: 833, y: 0, width: 834, height: 421 },
      action: {
        type: 'message',
        label: 'คะแนนของฉัน',
        text: '@ปลาทูทวง คะแนนของฉัน',
      },
    },
    // ปุ่มที่ 3: งานด่วน (ขวาบน)
    {
      bounds: { x: 1667, y: 0, width: 833, height: 421 },
      action: {
        type: 'message',
        label: 'งานด่วน',
        text: '@ปลาทูทวง งานด่วน',
      },
    },
    // ปุ่มที่ 4: ส่งงาน (ซ้ายล่าง)
    {
      bounds: { x: 0, y: 421, width: 833, height: 422 },
      action: {
        type: 'message',
        label: 'ส่งงาน',
        text: '@ปลาทูทวง ส่งงาน',
      },
    },
    // ปุ่มที่ 5: อันดับ (กลางล่าง)
    {
      bounds: { x: 833, y: 421, width: 834, height: 422 },
      action: {
        type: 'message',
        label: 'อันดับ',
        text: '@ปลาทูทวง อันดับ',
      },
    },
    // ปุ่มที่ 6: วิธีใช้ (ขวาล่าง)
    {
      bounds: { x: 1667, y: 421, width: 833, height: 422 },
      action: {
        type: 'message',
        label: 'วิธีใช้',
        text: '@ปลาทูทวง วิธีใช้',
      },
    },
  ],
};

// ============================================================
//  สร้าง Rich Menu
// ============================================================

async function createRichMenu() {
  console.log('📋 สร้าง Rich Menu...');

  try {
    // 1. สร้าง Rich Menu object
    const res = await axios.post(
      'https://api.line.me/v2/bot/richmenu',
      RICH_MENU_STUDENT,
      { headers: HEADERS }
    );

    const richMenuId = res.data.richMenuId;
    console.log(`✅ สร้าง Rich Menu สำเร็จ: ${richMenuId}`);

    // 2. อัปโหลดรูป Rich Menu
    // ถ้ามีไฟล์ richmenu.png ใน folder เดียวกัน
    const imgPath = path.join(__dirname, 'richmenu.png');
    if (fs.existsSync(imgPath)) {
      console.log('📸 อัปโหลดรูป Rich Menu...');
      const imgBuffer = fs.readFileSync(imgPath);
      await axios.post(
        `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
        imgBuffer,
        {
          headers: {
            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
            'Content-Type': 'image/png',
          },
        }
      );
      console.log('✅ อัปโหลดรูปสำเร็จ');
    } else {
      console.log('⚠️ ไม่พบไฟล์ richmenu.png — Rich Menu จะไม่มีรูปพื้นหลัง');
      console.log('   สร้างรูป 2500x843 px แล้วบันทึกเป็น richmenu.png ในโฟลเดอร์เดียวกัน');
    }

    // 3. ตั้งเป็น Default Rich Menu (ทุกคนเห็น)
    await axios.post(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {},
      { headers: HEADERS }
    );
    console.log('✅ ตั้งเป็น Default Rich Menu สำเร็จ');

    // บันทึก richMenuId
    fs.writeFileSync('/tmp/richmenu_id.txt', richMenuId);
    console.log(`\n🎉 Rich Menu พร้อมใช้งานแล้ว!`);
    console.log(`   ID: ${richMenuId}`);
    return richMenuId;

  } catch (err) {
    console.error('❌ สร้าง Rich Menu ไม่สำเร็จ:', err.response?.data || err.message);
    throw err;
  }
}

// ============================================================
//  ลบ Rich Menu
// ============================================================

async function deleteRichMenu(richMenuId) {
  if (!richMenuId) {
    // ลองอ่านจากไฟล์
    try { richMenuId = fs.readFileSync('/tmp/richmenu_id.txt', 'utf8').trim(); }
    catch { console.log('⚠️ ไม่พบ richMenuId'); return; }
  }

  try {
    await axios.delete(
      `https://api.line.me/v2/bot/richmenu/${richMenuId}`,
      { headers: HEADERS }
    );
    console.log(`✅ ลบ Rich Menu ${richMenuId} สำเร็จ`);
  } catch (err) {
    console.error('❌ ลบไม่สำเร็จ:', err.response?.data || err.message);
  }
}

// ============================================================
//  ดูรายการ Rich Menu ทั้งหมด
// ============================================================

async function listRichMenus() {
  try {
    const res = await axios.get(
      'https://api.line.me/v2/bot/richmenu/list',
      { headers: HEADERS }
    );
    const menus = res.data.richmenus || [];
    console.log(`📋 Rich Menu ทั้งหมด: ${menus.length} รายการ`);
    menus.forEach(m => {
      console.log(`  - ${m.richMenuId}: "${m.name}" (${m.areas.length} ปุ่ม)`);
    });
    return menus;
  } catch (err) {
    console.error('❌ ดูรายการไม่สำเร็จ:', err.response?.data || err.message);
  }
}

// ============================================================
//  ลบ Rich Menu เดิมแล้วสร้างใหม่
// ============================================================

async function resetRichMenu() {
  console.log('🔄 รีเซ็ต Rich Menu...');
  const menus = await listRichMenus();
  if (menus && menus.length > 0) {
    for (const m of menus) {
      await deleteRichMenu(m.richMenuId);
    }
  }
  await createRichMenu();
}

// ============================================================
//  CLI — รันจาก command line
// ============================================================

const command = process.argv[2];

if (require.main === module) {
  switch (command) {
    case 'create': createRichMenu(); break;
    case 'delete': deleteRichMenu(process.argv[3]); break;
    case 'list':   listRichMenus(); break;
    case 'reset':  resetRichMenu(); break;
    default:
      console.log(`
🐟 ปลาทูทวง Rich Menu Manager

คำสั่ง:
  node richmenu.js create   → สร้าง Rich Menu ใหม่
  node richmenu.js delete   → ลบ Rich Menu
  node richmenu.js list     → ดูรายการ Rich Menu
  node richmenu.js reset    → ลบเดิม แล้วสร้างใหม่

หมายเหตุ:
  - ต้องมีไฟล์ richmenu.png ขนาด 2500x843 px
  - ต้องตั้งค่า LINE_ACCESS_TOKEN ใน environment variable
      `);
  }
}

module.exports = { createRichMenu, deleteRichMenu, listRichMenus, resetRichMenu };
