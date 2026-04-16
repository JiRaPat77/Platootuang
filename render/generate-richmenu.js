// ============================================================
//  generate-richmenu.js
//  สร้างรูป Rich Menu 2500x843 px
//  รัน: node generate-richmenu.js
//  ต้องการ: npm install canvas
// ============================================================

const { createCanvas } = require('canvas');
const fs = require('fs');

const WIDTH  = 2500;
const HEIGHT = 843;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx    = canvas.getContext('2d');

// พื้นหลัง
ctx.fillStyle = '#2C2C4E';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// กำหนด 6 ปุ่ม (3x2 grid)
const buttons = [
  { x: 0,    y: 0,   w: 833,  h: 421, emoji: '📋', label: 'งานของฉัน',    color: '#534AB7' },
  { x: 833,  y: 0,   w: 834,  h: 421, emoji: '⭐', label: 'คะแนนของฉัน',  color: '#BA7517' },
  { x: 1667, y: 0,   w: 833,  h: 421, emoji: '⚡', label: 'งานด่วน',      color: '#E24B4A' },
  { x: 0,    y: 421, w: 833,  h: 422, emoji: '📤', label: 'ส่งงาน',       color: '#1D9E75' },
  { x: 833,  y: 421, w: 834,  h: 422, emoji: '🏆', label: 'อันดับ',       color: '#185FA5' },
  { x: 1667, y: 421, w: 833,  h: 422, emoji: '❓', label: 'วิธีใช้',      color: '#5F5E5A' },
];

buttons.forEach((btn, i) => {
  // พื้นหลังปุ่ม
  ctx.fillStyle = btn.color;
  ctx.fillRect(btn.x + 4, btn.y + 4, btn.w - 8, btn.h - 8);

  // rounded corners (วาดซ้ำบน)
  ctx.fillStyle = btn.color + 'DD';
  ctx.beginPath();
  roundRect(ctx, btn.x + 4, btn.y + 4, btn.w - 8, btn.h - 8, 20);
  ctx.fill();

  // Emoji ขนาดใหญ่
  ctx.font = '120px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.emoji, btn.x + btn.w / 2, btn.y + btn.h / 2 - 40);

  // ชื่อปุ่ม
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 70px sans-serif';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 70);
});

// เส้นคั่นแนวตั้ง
ctx.strokeStyle = 'rgba(255,255,255,0.15)';
ctx.lineWidth   = 3;
[833, 1667].forEach(x => {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
});
// เส้นคั่นแนวนอน
ctx.beginPath(); ctx.moveTo(0, 421); ctx.lineTo(WIDTH, 421); ctx.stroke();

// บันทึกไฟล์
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('richmenu.png', buffer);
console.log('✅ สร้างไฟล์ richmenu.png สำเร็จ (2500x843 px)');

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
