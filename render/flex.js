// ============================================================
//  flex.js — Flex Message Card ทุกรูปแบบ
//  ปลาทูทวง ClassBot v3
// ============================================================

// ============================================================
//  Card ต้อนรับเมื่อ Bot เข้ากลุ่มครั้งแรก
// ============================================================

function welcomeCard(setupUrl) {
  return {
    type: 'flex',
    altText: 'ปลาทูทวงมาแล้ว! กรุณาตั้งค่าห้องเรียน',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🐟 ปลาทูทวง',
            color: '#ffffff',
            size: 'xl',
            weight: 'bold',
          },
          {
            type: 'text',
            text: 'ระบบติดตามงานนักเรียน',
            color: '#ffffff99',
            size: 'sm',
          },
        ],
        backgroundColor: '#534AB7',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'สวัสดีครับ! ปลาทูทวงมาแล้ว 🎉',
            weight: 'bold',
            size: 'md',
            margin: 'none',
          },
          {
            type: 'text',
            text: 'กรุณาให้คุณครูกดปุ่มด้านล่างเพื่อตั้งค่าห้องเรียนก่อนนะครับ',
            wrap: true,
            color: '#666666',
            size: 'sm',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '⚙️ ตั้งค่าห้องเรียน',
              uri: setupUrl,
            },
            style: 'primary',
            color: '#534AB7',
          },
        ],
        paddingAll: '12px',
      },
    },
  };
}

// ============================================================
//  Card ประกาศงานใหม่
// ============================================================

function newTaskCard(task, groupId) {
  const statusColor = task.status === 'open' ? '#1D9E75' : '#888780';
  const statusText  = task.status === 'open' ? '🟢 เปิดรับงาน' : '🔴 ปิดรับงาน';

  return {
    type: 'flex',
    altText: `📢 งานใหม่! ${task.name}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📢 ภารกิจใหม่!',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
          },
          {
            type: 'text',
            text: task.subject,
            color: '#ffffff99',
            size: 'sm',
          },
        ],
        backgroundColor: '#534AB7',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: task.name,
            weight: 'bold',
            size: 'xl',
            wrap: true,
          },
          task.description ? {
            type: 'text',
            text: task.description,
            wrap: true,
            color: '#666666',
            size: 'sm',
            margin: 'sm',
          } : null,
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            spacing: 'sm',
            contents: [
              makeInfoRow('📅 กำหนดส่ง', task.dueDate),
              makeInfoRow('📚 วิชา', task.subject),
              makeInfoRow('สถานะ', statusText),
            ],
          },
        ].filter(Boolean),
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📤 ส่งงาน',
              text: `@ปลาทูทวง ส่งงาน ${task.taskId}`,
            },
            style: 'primary',
            color: '#1D9E75',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📋 งานของฉัน',
              text: '@ปลาทูทวง งานของฉัน',
            },
            style: 'secondary',
          },
        ],
        paddingAll: '12px',
      },
    },
  };
}

// ============================================================
//  Card แจ้งเตือนก่อนกำหนด 3 วัน
// ============================================================

function reminderCard(task, pendingStudents, daysLeft) {
  const isToday   = daysLeft === 0;
  const headerBg  = isToday ? '#E24B4A' : '#BA7517';
  const headerTxt = isToday ? '⏰ วันนี้คือวันกำหนดส่ง!' : `⚠️ เหลือเวลาอีก ${daysLeft} วัน`;

  const mentionContents = pendingStudents.map(s => ({
    type: 'span',
    text: `@${s.name} `,
    color: '#534AB7',
    weight: 'bold',
  }));

  return {
    type: 'flex',
    altText: `${headerTxt} — ${task.name}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'แจ้งเตือนงานใกล้กำหนด',
            color: '#ffffff99',
            size: 'xs',
          },
          {
            type: 'text',
            text: headerTxt,
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
          },
        ],
        backgroundColor: headerBg,
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: task.name,
            weight: 'bold',
            size: 'lg',
            wrap: true,
          },
          makeInfoRow('📅 กำหนดส่ง', task.dueDate),
          makeInfoRow('📚 วิชา', task.subject),
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              makeStatBox('ยังไม่ส่ง', String(pendingStudents.length), '#E24B4A'),
            ],
          },
          pendingStudents.length > 0 ? {
            type: 'text',
            text: 'นักเรียนที่ยังไม่ส่ง:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
          } : null,
          pendingStudents.length > 0 ? {
            type: 'text',
            contents: mentionContents,
            wrap: true,
            margin: 'sm',
            size: 'sm',
          } : null,
        ].filter(Boolean),
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📤 ส่งงานเดี๋ยวนี้เลย!',
              text: `@ปลาทูทวง ส่งงาน ${task.taskId}`,
            },
            style: 'primary',
            color: headerBg,
          },
        ],
        paddingAll: '12px',
      },
    },
  };
}

// ============================================================
//  Card ทวงงานเกินกำหนด
// ============================================================

function overdueCard(task, pendingStudents) {
  const mentionContents = pendingStudents.map(s => ({
    type: 'span',
    text: `@${s.name} `,
    color: '#E24B4A',
    weight: 'bold',
  }));

  return {
    type: 'flex',
    altText: `ทวง! ยออนุญาตทวง — ${task.name} เกินกำหนดส่งแล้ว`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'ทวง ทวง ทวง!',
            color: '#ffffff99',
            size: 'xs',
          },
          {
            type: 'text',
            text: '🚨 เกินกำหนดส่งแล้ว!',
            color: '#ffffff',
            size: 'lg',
            weight: 'bold',
          },
        ],
        backgroundColor: '#E24B4A',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: task.name,
            weight: 'bold',
            size: 'lg',
            wrap: true,
          },
          makeInfoRow('📅 กำหนดส่ง', task.dueDate),
          makeInfoRow('📚 วิชา', task.subject),
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              makeStatBox('เลยกำหนดส่ง', String(pendingStudents.length) + ' คน', '#E24B4A'),
            ],
          },
          {
            type: 'text',
            text: 'รายชื่อที่ยังไม่ส่ง:',
            size: 'sm',
            color: '#666666',
            margin: 'md',
          },
          {
            type: 'text',
            contents: mentionContents,
            wrap: true,
            margin: 'sm',
            size: 'sm',
          },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📤 รีบส่งงานด่วน!',
              text: `@ปลาทูทวง ส่งงาน ${task.taskId}`,
            },
            style: 'primary',
            color: '#E24B4A',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: '📋 ดูสถานะการส่งงาน',
              text: '@ปลาทูทวง งานของฉัน',
            },
            style: 'secondary',
          },
        ],
        paddingAll: '12px',
      },
    },
  };
}

// ============================================================
//  Card งานของฉัน (นักเรียนดูเอง)
// ============================================================

function myTasksCard(studentName, doneTasks, pendingTasks) {
  const doneContents = doneTasks.length > 0
    ? doneTasks.map(t => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '✅', size: 'sm', flex: 0 },
          { type: 'text', text: t.name, size: 'sm', flex: 1, margin: 'sm', wrap: true, color: '#1D9E75' },
        ],
        margin: 'xs',
      }))
    : [{ type: 'text', text: 'ยังไม่มีงานที่ส่งแล้ว', size: 'sm', color: '#aaaaaa' }];

  const pendingContents = pendingTasks.length > 0
    ? pendingTasks.map(t => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '⏳', size: 'sm', flex: 0 },
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            margin: 'sm',
            contents: [
              { type: 'text', text: t.name, size: 'sm', wrap: true, weight: 'bold' },
              { type: 'text', text: `ส่งภายใน: ${t.dueDate}`, size: 'xs', color: '#E24B4A' },
            ],
          },
        ],
        margin: 'xs',
      }))
    : [{ type: 'text', text: '🎉 ส่งงานครบทุกชิ้นแล้ว!', size: 'sm', color: '#1D9E75', weight: 'bold' }];

  return {
    type: 'flex',
    altText: `งานของ ${studentName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📋 งานของฉัน', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: studentName, color: '#ffffff99', size: 'sm' },
        ],
        backgroundColor: '#534AB7',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              makeStatBox('ส่งแล้ว', String(doneTasks.length), '#1D9E75'),
              makeStatBox('ยังไม่ส่ง', String(pendingTasks.length), '#E24B4A'),
            ],
            spacing: 'sm',
          },
          { type: 'separator' },
          {
            type: 'text',
            text: 'งานที่ยังไม่ส่ง',
            weight: 'bold',
            size: 'sm',
            color: '#E24B4A',
            margin: 'md',
          },
          ...pendingContents,
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: 'งานที่ส่งแล้ว',
            weight: 'bold',
            size: 'sm',
            color: '#1D9E75',
            margin: 'md',
          },
          ...doneContents,
        ],
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Card รายงาน (ครูดู)
// ============================================================

function reportCard(roomName, openTasks, overdueTasks, nearTasks) {
  const taskItems = [
    ...overdueTasks.map(t => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '🔴', size: 'sm', flex: 0 },
        {
          type: 'box', layout: 'vertical', flex: 1, margin: 'sm',
          contents: [
            { type: 'text', text: t.name, size: 'sm', weight: 'bold', wrap: true },
            { type: 'text', text: `เกินกำหนด | ส่งแล้ว ${t.submitted}/${t.total} คน`, size: 'xs', color: '#E24B4A' },
          ],
        },
      ],
      margin: 'sm',
    })),
    ...nearTasks.map(t => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '🟡', size: 'sm', flex: 0 },
        {
          type: 'box', layout: 'vertical', flex: 1, margin: 'sm',
          contents: [
            { type: 'text', text: t.name, size: 'sm', weight: 'bold', wrap: true },
            { type: 'text', text: `ครบกำหนด ${t.dueDate} | ส่งแล้ว ${t.submitted}/${t.total} คน`, size: 'xs', color: '#BA7517' },
          ],
        },
      ],
      margin: 'sm',
    })),
    ...openTasks.map(t => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: '🟢', size: 'sm', flex: 0 },
        {
          type: 'box', layout: 'vertical', flex: 1, margin: 'sm',
          contents: [
            { type: 'text', text: t.name, size: 'sm', weight: 'bold', wrap: true },
            { type: 'text', text: `ส่งแล้ว ${t.submitted}/${t.total} คน | ครบ ${t.dueDate}`, size: 'xs', color: '#666666' },
          ],
        },
      ],
      margin: 'sm',
    })),
  ];

  return {
    type: 'flex',
    altText: `รายงานสรุป — ${roomName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📊 รายงานสรุป', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: roomName, color: '#ffffff99', size: 'sm' },
        ],
        backgroundColor: '#185FA5',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              makeStatBox('เปิดรับ', String(openTasks.length), '#1D9E75'),
              makeStatBox('ใกล้กำหนด', String(nearTasks.length), '#BA7517'),
              makeStatBox('เกินกำหนด', String(overdueTasks.length), '#E24B4A'),
            ],
          },
          { type: 'separator', margin: 'md' },
          ...taskItems,
        ],
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Card คะแนนส่วนตัว
// ============================================================

function scoreCard(studentName, totalScore, rank, totalStudents) {
  return {
    type: 'flex',
    altText: `คะแนนของ ${studentName}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '⭐ คะแนนของฉัน', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: studentName, color: '#ffffff99', size: 'sm' },
        ],
        backgroundColor: '#BA7517',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: String(totalScore),
            size: '4xl',
            weight: 'bold',
            align: 'center',
            color: '#BA7517',
          },
          { type: 'text', text: 'คะแนนรวม', size: 'sm', color: '#666666', align: 'center' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              makeStatBox('อันดับ', `${rank}/${totalStudents}`, '#534AB7'),
            ],
          },
        ],
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Card อันดับห้อง
// ============================================================

function rankingCard(roomName, rankings) {
  const medals  = ['🥇', '🥈', '🥉'];
  const items   = rankings.slice(0, 10).map((s, i) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: medals[i] || `${i + 1}.`, size: 'md', flex: 0, gravity: 'center' },
      { type: 'text', text: s.name, size: 'sm', flex: 1, margin: 'sm', gravity: 'center', wrap: true },
      { type: 'text', text: `${s.total} คะแนน`, size: 'sm', color: '#BA7517', weight: 'bold', gravity: 'center', flex: 0 },
    ],
    margin: 'sm',
    paddingAll: '6px',
    backgroundColor: i < 3 ? '#FAEEDA44' : 'transparent',
    borderRadius: '6px',
  }));

  return {
    type: 'flex',
    altText: `🏆 อันดับคะแนน — ${roomName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🏆 อันดับคะแนน', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: roomName, color: '#ffffff99', size: 'sm' },
        ],
        backgroundColor: '#BA7517',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items,
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Card งานวันนี้
// ============================================================

function todayTasksCard(tasks) {
  if (tasks.length === 0) {
    return {
      type: 'flex',
      altText: 'ไม่มีงานครบกำหนดวันนี้',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '📅 งานวันนี้', weight: 'bold', size: 'lg' },
            { type: 'text', text: 'ไม่มีงานครบกำหนดวันนี้ 🎉', color: '#1D9E75', margin: 'md' },
          ],
          paddingAll: '16px',
        },
      },
    };
  }

  return {
    type: 'flex',
    altText: `📅 งานวันนี้ ${tasks.length} ชิ้น`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📅 งานวันนี้', color: '#ffffff', size: 'lg', weight: 'bold' },
          { type: 'text', text: `${tasks.length} ชิ้นที่ครบกำหนดวันนี้`, color: '#ffffff99', size: 'sm' },
        ],
        backgroundColor: '#185FA5',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: tasks.map(t => ({
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: t.name, weight: 'bold', size: 'sm', wrap: true },
            { type: 'text', text: t.subject, size: 'xs', color: '#666666' },
          ],
          paddingAll: '8px',
          margin: 'sm',
          backgroundColor: '#E6F1FB',
          borderRadius: '6px',
        })),
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Card แจ้งเมื่อครูแก้ไข/ลบงาน
// ============================================================

function taskChangedCard(type, taskName, newName) {
  const isDelete  = type === 'delete';
  const headerBg  = isDelete ? '#E24B4A' : '#BA7517';
  const title     = isDelete ? '🗑️ ลบงานแล้ว' : '✏️ แก้ไขชื่องานแล้ว';
  const bodyText  = isDelete
    ? `งาน "${taskName}" ถูกลบออกแล้วโดยคุณครู`
    : `งาน "${taskName}" เปลี่ยนชื่อเป็น "${newName}" แล้ว`;

  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: title, color: '#ffffff', size: 'md', weight: 'bold' },
        ],
        backgroundColor: headerBg,
        paddingAll: '12px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: bodyText, wrap: true, size: 'sm' },
        ],
        paddingAll: '16px',
      },
    },
  };
}

// ============================================================
//  Utility Helpers
// ============================================================

function makeInfoRow(label, value) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#666666', flex: 2 },
      { type: 'text', text: value, size: 'sm', flex: 3, wrap: true, align: 'end' },
    ],
  };
}

function makeStatBox(label, value, color) {
  return {
    type: 'box',
    layout: 'vertical',
    flex: 1,
    contents: [
      { type: 'text', text: value, size: 'xxl', weight: 'bold', align: 'center', color },
      { type: 'text', text: label, size: 'xs', color: '#666666', align: 'center' },
    ],
    paddingAll: '8px',
    backgroundColor: color + '15',
    borderRadius: '8px',
  };
}

module.exports = {
  welcomeCard,
  newTaskCard,
  reminderCard,
  overdueCard,
  myTasksCard,
  reportCard,
  scoreCard,
  rankingCard,
  todayTasksCard,
  taskChangedCard,
};
