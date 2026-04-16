const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843">
  <rect width="2500" height="843" fill="#1E1B4B"/>
  <rect x="8" y="8" width="817" height="405" rx="20" fill="#534AB7"/>
  <text x="416" y="190" font-family="Arial" font-size="110" text-anchor="middle" fill="white">📋</text>
  <text x="416" y="340" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">งานของฉัน</text>
  <rect x="841" y="8" width="818" height="405" rx="20" fill="#B45309"/>
  <text x="1250" y="190" font-family="Arial" font-size="110" text-anchor="middle" fill="white">⭐</text>
  <text x="1250" y="340" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">คะแนนของฉัน</text>
  <rect x="1675" y="8" width="817" height="405" rx="20" fill="#B91C1C"/>
  <text x="2083" y="190" font-family="Arial" font-size="110" text-anchor="middle" fill="white">⚡</text>
  <text x="2083" y="340" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">งานด่วน</text>
  <rect x="8" y="430" width="817" height="405" rx="20" fill="#065F46"/>
  <text x="416" y="620" font-family="Arial" font-size="110" text-anchor="middle" fill="white">📤</text>
  <text x="416" y="770" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">ส่งงาน</text>
  <rect x="841" y="430" width="818" height="405" rx="20" fill="#1E3A8A"/>
  <text x="1250" y="620" font-family="Arial" font-size="110" text-anchor="middle" fill="white">🏆</text>
  <text x="1250" y="770" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">อันดับ</text>
  <rect x="1675" y="430" width="817" height="405" rx="20" fill="#374151"/>
  <text x="2083" y="620" font-family="Arial" font-size="110" text-anchor="middle" fill="white">❓</text>
  <text x="2083" y="770" font-family="Arial" font-size="68" font-weight="bold" text-anchor="middle" fill="white">วิธีใช้</text>
</svg>`;

fs.writeFileSync('richmenu.svg', svg);
console.log('✅ สร้าง richmenu.svg แล้ว');

async function convertToPng() {
  try {
    const sharp = require('sharp');
    await sharp(Buffer.from(svg)).resize(2500, 843).png().toFile('richmenu.png');
    console.log('✅ สร้าง richmenu.png สำเร็จ! พร้อม upload ขึ้น LINE แล้วครับ');
  } catch {
    console.log('⚠️ ไม่มี sharp — รัน: npm install sharp แล้วลองใหม่ครับ');
  }
}

convertToPng();