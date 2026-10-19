/**
 * seed-real-data.js
 * 从真实Excel名单和成绩单生成平台数据
 * 用法: node seed-real-data.js
 * 数据源:
 *   - 学生名单: Desktop/3.《数字图像处理A》名单.xls
 *   - 平时作业成绩: 3.《数字图像处理A》课程平时作业成绩记录表.xls
 *   - 实验成绩: 3 26年春季数字图像处理实验成绩登记表.xlsx
 */
const path = require('path');
const XLSX = require(path.join(__dirname, 'node_modules', 'xlsx'));
const { initDatabase } = require('./database/db');

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function randDate(startStr, endStr) {
  var s = new Date(startStr).getTime();
  var e = new Date(endStr).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}

// ============ 读取Excel数据 ============

function readRoster() {
  var wb = XLSX.readFile('C:\\Users\\wzb7\\Desktop\\3.《数字图像处理A》名单.xls');
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  var students = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] || row[0] === '') continue;
    var sid = String(row[0]).replace('*', '');
    students.push({ sid: sid, name: row[1], className: row[2] });
  }
  return students;
}

function readHomeworkGrades() {
  var wb = XLSX.readFile('E:\\学校\\课程考核资料\\26年春季学期\\数字图像处理\\3.《数字图像处理A》课程平时作业成绩记录表.xls');
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  var grades = {};
  // 两个班级块: rows 4-45 (class01) and 51-91 (class02)
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (typeof row[0] !== 'number') continue;
    var sid = String(row[1]).replace('*', '');
    if (!sid || sid === '') continue;
    grades[sid] = {
      hw: [row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11]],
      total: row[12]
    };
  }
  return grades;
}

function readLabGrades() {
  var wb = XLSX.readFile('E:\\学校\\课程考核资料\\26年春季学期\\数字图像处理\\3 26年春季数字图像处理实验成绩登记表.xlsx');
  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  var grades = {};
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (typeof row[0] !== 'number') continue;
    var sid = String(row[1]).replace('*', '');
    if (!sid || sid === '') continue;
    // 实验一到五的综合成绩在倒数第6到倒数第2列
    // 列结构: 序号,学号,姓名, 5*3详细分, 实验一成绩..实验五成绩, 总评成绩
    // row[18]=实验一成绩, row[19]=实验二, row[20]=实验三, row[21]=实验四, row[22]=实验五, row[23]=总评
    grades[sid] = {
      lab: [row[18], row[19], row[20], row[21], row[22]],
      total: row[23]
    };
  }
  return grades;
}

// ============ 作业定义 ============

var homeworkDefs = [
  { title: '平时作业一：图像灰度化与通道分离', type: 'homework', chapterId: 1, deadline: '2026-03-15 23:59:00' },
  { title: '平时作业二：直方图均衡化与对比度增强', type: 'homework', chapterId: 2, deadline: '2026-03-22 23:59:00' },
  { title: '平时作业三：空间域滤波（均值/中值/高斯）', type: 'homework', chapterId: 4, deadline: '2026-04-05 23:59:00' },
  { title: '平时作业四：傅里叶变换与频谱分析', type: 'homework', chapterId: 5, deadline: '2026-04-19 23:59:00' },
  { title: '平时作业五：频域滤波', type: 'homework', chapterId: 5, deadline: '2026-04-26 23:59:00' },
  { title: '平时作业六：图像复原与退化模型', type: 'homework', chapterId: 6, deadline: '2026-05-10 23:59:00' },
  { title: '平时作业七：彩色图像处理', type: 'homework', chapterId: 10, deadline: '2026-05-24 23:59:00' },
  { title: '平时作业八：图像分割（阈值/边缘）', type: 'homework', chapterId: 8, deadline: '2026-06-07 23:59:00' },
  { title: '平时作业九：形态学处理与特征提取', type: 'homework', chapterId: 11, deadline: '2026-06-14 23:59:00' },
];

var labDefs = [
  { title: '实验报告一：设计性实验（图像处理基础）', type: 'lab_report', chapterId: 3, deadline: '2026-04-12 23:59:00' },
  { title: '实验报告二：设计性实验（图像增强）', type: 'lab_report', chapterId: 4, deadline: '2026-04-26 23:59:00' },
  { title: '实验报告三：设计性实验（频域处理）', type: 'lab_report', chapterId: 5, deadline: '2026-05-10 23:59:00' },
  { title: '实验报告四：设计性实验（图像复原）', type: 'lab_report', chapterId: 6, deadline: '2026-05-24 23:59:00' },
  { title: '实验报告五：综合性实验（图像分析）', type: 'lab_report', chapterId: 9, deadline: '2026-06-21 23:59:00' },
];

var feedbackTemplates = [
  '代码逻辑清晰，运行结果正确。',
  '实现完整，注释充分。',
  '基本功能正确，但部分边界情况处理不够。',
  '代码可读性好，实验结论分析到位。',
  '函数设计合理，图像处理效果符合预期。',
  '存在一些小问题，总体完成度较高。',
  '实验步骤完整，参数设置合理。',
  '对算法原理理解透彻，代码实现简洁。',
  '结果基本正确，建议加强异常处理。',
  '完成度好，但实验分析部分可以更深入。',
  '代码运行成功，输出图像质量良好。',
  '理解正确，实现规范，结论分析充分。',
];

// ============ 主流程 ============

async function main() {
  console.log('正在读取Excel数据...');
  var students = readRoster();
  var hwGrades = readHomeworkGrades();
  var labGrades = readLabGrades();
  console.log('学生名单:', students.length, '人');
  console.log('平时作业成绩:', Object.keys(hwGrades).length, '人');
  console.log('实验成绩:', Object.keys(labGrades).length, '人');

  console.log('正在初始化数据库...');
  var dbPath = path.join(__dirname, 'database', 'platform.db');
  var db = await initDatabase(dbPath);

  // ---- 1. 获取教师 ----
  var existingUsers = db.prepare('SELECT * FROM users').all();
  var teachers = existingUsers.filter(function(u) { return u.role === 'teacher'; });
  console.log('教师用户:', teachers.map(function(t) { return t.username + '(' + t.real_name + ')'; }).join(', '));

  var teacherId;
  if (teachers.length > 0) {
    teacherId = teachers[0].id;
  } else {
    var bcrypt = require('bcryptjs');
    var hash = bcrypt.hashSync('123456', 10);
    db.prepare('INSERT INTO users (username, password, real_name, role, is_active) VALUES (?,?,?,?,1)').run('teacher', hash, '王政博', 'teacher');
    teacherId = db.prepare('SELECT id FROM users WHERE username=?').get('teacher').id;
    console.log('已创建教师用户: teacher/123456, id=' + teacherId);
  }

  // ---- 2. 删除所有旧学生及其关联数据 ----
  var oldStudents = db.prepare("SELECT id FROM users WHERE role='student'").all();
  if (oldStudents.length > 0) {
    console.log('清除旧学生数据:', oldStudents.length, '人');
    for (var i = 0; i < oldStudents.length; i++) {
      var id = oldStudents[i].id;
      db.prepare('DELETE FROM submissions WHERE student_id=?').run(id);
      db.prepare('DELETE FROM learning_progress WHERE student_id=?').run(id);
      db.prepare('DELETE FROM code_submissions WHERE student_id=?').run(id);
      db.prepare('DELETE FROM exam_attempts WHERE student_id=?').run(id);
      db.prepare('DELETE FROM notifications WHERE user_id=?').run(id);
      db.prepare('DELETE FROM audit_logs WHERE user_id=?').run(id);
      db.prepare('DELETE FROM request_logs WHERE user_id=?').run(id);
    }
    var oldIds = oldStudents.map(function(s) { return s.id; }).join(',');
    db.prepare('DELETE FROM users WHERE id IN (' + oldIds + ')').run();
    console.log('已清除旧学生及关联数据');
  }

  // ---- 3. 创建83名学生 ----
  var studentIds = [];
  var studentSidMap = {}; // sid -> db_id
  var bcrypt = require('bcryptjs');

  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var pwd = s.sid.slice(-6);
    var hash = bcrypt.hashSync(pwd, 10);
    db.prepare(
      "INSERT INTO users (username, password, real_name, role, student_id, class_name, email, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(s.sid, hash, s.name, 'student', s.sid, s.className, s.sid + '@hbwxy.edu.cn', 1, randDate('2026-02-20', '2026-03-01'));
    var newUser = db.prepare('SELECT id FROM users WHERE username=?').get(s.sid);
    studentIds.push(newUser.id);
    studentSidMap[s.sid] = newUser.id;
  }
  console.log('已创建学生:', studentIds.length, '人');

  // ---- 4. 清空旧作业和提交 ----
  db.prepare('DELETE FROM submissions').run();
  db.prepare('DELETE FROM assignments').run();
  console.log('已清空旧作业和提交数据');

  // ---- 5. 创建9次平时作业 + 提交真实成绩 ----
  var hwAssignmentIds = [];
  for (var ai = 0; ai < homeworkDefs.length; ai++) {
    var a = homeworkDefs[ai];
    db.prepare(
      "INSERT INTO assignments (teacher_id, title, description, type, chapter_id, deadline, max_score, is_published, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(
      teacherId, a.title,
      '请按照课程要求完成本次平时作业，提交代码和实验结果截图。',
      a.type, a.chapterId, a.deadline, 100, 1,
      randDate('2026-02-25', '2026-03-10')
    );
    var row = db.prepare('SELECT last_insert_rowid() as id').get();
    hwAssignmentIds.push(row.id);
  }
  console.log('已创建 ' + hwAssignmentIds.length + ' 次平时作业');

  var hwCount = 0;
  for (var si = 0; si < students.length; si++) {
    var s = students[si];
    var dbId = studentSidMap[s.sid];
    var g = hwGrades[s.sid];
    if (!g) { console.log('  警告: 未找到 ' + s.name + '(' + s.sid + ') 的平时作业成绩'); continue; }

    for (var ai = 0; ai < hwAssignmentIds.length; ai++) {
      var score = g.hw[ai];
      if (score === '' || score === undefined || score === null) continue;
      score = Number(score);
      if (isNaN(score)) continue;

      var deadline = new Date(homeworkDefs[ai].deadline).getTime();
      var weekMs = 7 * 24 * 3600 * 1000;
      var submittedAt = new Date(deadline - Math.random() * weekMs).toISOString();
      var feedback = feedbackTemplates[Math.floor(Math.random() * feedbackTemplates.length)];

      db.prepare(
        "INSERT INTO submissions (assignment_id, student_id, content, submitted_at, status, score, feedback, reviewed_by, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)"
      ).run(
        hwAssignmentIds[ai], dbId,
        '已完成本次作业，代码和实验结果见附件。',
        submittedAt, 'graded', score, feedback, teacherId,
        new Date(new Date(submittedAt).getTime() + 86400000 * (1 + Math.floor(Math.random() * 3))).toISOString()
      );
      hwCount++;
    }
  }
  console.log('已生成 ' + hwCount + ' 条平时作业提交（真实成绩）');

  // ---- 6. 创建5次实验报告 + 提交真实成绩 ----
  var labAssignmentIds = [];
  for (var ai = 0; ai < labDefs.length; ai++) {
    var a = labDefs[ai];
    db.prepare(
      "INSERT INTO assignments (teacher_id, title, description, type, chapter_id, deadline, max_score, is_published, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(
      teacherId, a.title,
      '请按照实验指导书完成本次实验，提交实验报告（含代码、运行截图和实验分析）。',
      a.type, a.chapterId, a.deadline, 100, 1,
      randDate('2026-03-01', '2026-03-15')
    );
    var row = db.prepare('SELECT last_insert_rowid() as id').get();
    labAssignmentIds.push(row.id);
  }
  console.log('已创建 ' + labAssignmentIds.length + ' 次实验报告');

  var labCount = 0;
  for (var si = 0; si < students.length; si++) {
    var s = students[si];
    var dbId = studentSidMap[s.sid];
    var g = labGrades[s.sid];
    if (!g) { console.log('  警告: 未找到 ' + s.name + '(' + s.sid + ') 的实验成绩'); continue; }

    for (var ai = 0; ai < labAssignmentIds.length; ai++) {
      var score = g.lab[ai];
      if (score === '' || score === undefined || score === null) continue;
      score = Number(score);
      if (isNaN(score)) continue;

      var deadline = new Date(labDefs[ai].deadline).getTime();
      var weekMs = 7 * 24 * 3600 * 1000;
      var submittedAt = new Date(deadline - Math.random() * weekMs).toISOString();
      var feedback = feedbackTemplates[Math.floor(Math.random() * feedbackTemplates.length)];

      db.prepare(
        "INSERT INTO submissions (assignment_id, student_id, content, submitted_at, status, score, feedback, reviewed_by, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)"
      ).run(
        labAssignmentIds[ai], dbId,
        '已完成本次实验，实验报告见附件。',
        submittedAt, 'graded', score, feedback, teacherId,
        new Date(new Date(submittedAt).getTime() + 86400000 * (1 + Math.floor(Math.random() * 3))).toISOString()
      );
      labCount++;
    }
  }
  console.log('已生成 ' + labCount + ' 条实验报告提交（真实成绩）');

  // ---- 7. 生成学习进度数据 ----
  db.prepare('DELETE FROM learning_progress').run();
  var kps = db.prepare('SELECT id, chapter_id FROM knowledge_points').all();
  console.log('知识点总数:', kps.length);

  var progressCount = 0;
  for (var si = 0; si < studentIds.length; si++) {
    var studentDbId = studentIds[si];
    var ability = 0.5 + Math.random() * 0.5;
    var kpSubset = kps.filter(function() { return Math.random() < (0.6 + ability * 0.3); });
    for (var ki = 0; ki < kpSubset.length; ki++) {
      var kp = kpSubset[ki];
      var mastery = clamp(Math.round(ability * 80 + (Math.random() - 0.5) * 30), 10, 100);
      var simCompleted = Math.random() < ability ? 1 : 0;
      var lastAccessed = randDate('2026-03-01', '2026-06-25');
      db.prepare(
        "INSERT OR REPLACE INTO learning_progress (student_id, knowledge_point_id, mastery_level, last_accessed, simulation_completed) VALUES (?,?,?,?,?)"
      ).run(studentDbId, kp.id, mastery, lastAccessed, simCompleted);
      progressCount++;
    }
  }
  console.log('已生成 ' + progressCount + ' 条学习进度记录');

  // ---- 8. 生成代码提交记录 ----
  db.prepare('DELETE FROM code_submissions').run();
  var simulations = db.prepare('SELECT sim_key FROM simulations').all();
  console.log('仿真实验总数:', simulations.length);

  var codeCount = 0;
  var languages = ['python', 'octave'];
  for (var si = 0; si < studentIds.length; si++) {
    var studentDbId = studentIds[si];
    var numExps = 8 + Math.floor(Math.random() * 13);
    var simSubset = simulations.sort(function() { return Math.random() - 0.5; }).slice(0, numExps);
    for (var ei = 0; ei < simSubset.length; ei++) {
      var sim = simSubset[ei];
      var lang = languages[Math.floor(Math.random() * 2)];
      var status = Math.random() < 0.85 ? 'success' : 'error';
      var execTime = 0.5 + Math.random() * 4;
      var submittedAt = randDate('2026-03-01', '2026-06-25');
      db.prepare(
        "INSERT INTO code_submissions (student_id, simulation_key, language, code, stdout, stderr, status, execution_time, submitted_at) VALUES (?,?,?,?,?,?,?,?,?)"
      ).run(
        studentDbId, sim.sim_key, lang,
        '# ' + sim.sim_key + ' 实验代码\nimport numpy as np\n# ...',
        status === 'success' ? '实验执行成功，输出结果图像。' : '',
        status === 'error' ? 'RuntimeError: 参数类型错误' : '',
        status, Math.round(execTime * 100) / 100, submittedAt
      );
      codeCount++;
    }
  }
  console.log('已生成 ' + codeCount + ' 条代码提交记录');

  // ---- 9. 生成通知 ----
  db.prepare('DELETE FROM notifications').run();
  var notifCount = 0;
  var notifTypes = ['assignment_graded', 'assignment_published', 'system'];
  for (var si = 0; si < studentIds.length; si++) {
    var studentDbId = studentIds[si];
    var numNotifs = 3 + Math.floor(Math.random() * 3);
    for (var n = 0; n < numNotifs; n++) {
      var type = notifTypes[Math.floor(Math.random() * notifTypes.length)];
      var title = '', content = '';
      if (type === 'assignment_graded') {
        var aIdx = Math.floor(Math.random() * homeworkDefs.length);
        title = '作业已批改';
        content = homeworkDefs[aIdx].title + ' 已完成批改，请查看成绩和反馈。';
      } else if (type === 'assignment_published') {
        var aIdx = Math.floor(Math.random() * homeworkDefs.length);
        title = '新作业发布';
        content = homeworkDefs[aIdx].title + ' 已发布，请注意截止时间。';
      } else {
        title = '系统通知';
        content = '欢迎使用数字图像处理智慧教学平台。';
      }
      db.prepare(
        "INSERT INTO notifications (user_id, type, title, content, is_read, created_at) VALUES (?,?,?,?,?,?)"
      ).run(studentDbId, type, title, content, Math.random() < 0.7 ? 1 : 0, randDate('2026-03-01', '2026-06-25'));
      notifCount++;
    }
  }
  console.log('已生成 ' + notifCount + ' 条通知');

  // ---- 10. 验证 ----
  console.log('\n========== 数据验证 ==========');
  var userCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c;
  var c1 = db.prepare("SELECT COUNT(*) as c FROM users WHERE class_name='电信202301' AND role='student'").get().c;
  var c2 = db.prepare("SELECT COUNT(*) as c FROM users WHERE class_name='电信202302' AND role='student'").get().c;
  console.log('学生总数:', userCount, '(电信202301:', c1, ', 电信202302:', c2, ')');

  var hwAssignCount = db.prepare("SELECT COUNT(*) as c FROM assignments WHERE type='homework'").get().c;
  var labAssignCount = db.prepare("SELECT COUNT(*) as c FROM assignments WHERE type='lab_report'").get().c;
  console.log('作业: 平时作业 ' + hwAssignCount + ' 次, 实验报告 ' + labAssignCount + ' 次');

  var subCount = db.prepare('SELECT COUNT(*) as c FROM submissions').get().c;
  var avgScore = db.prepare('SELECT AVG(score) as avg FROM submissions WHERE score IS NOT NULL').get().avg;
  console.log('提交总数:', subCount, ' 平均分:', Math.round(avgScore * 10) / 10);

  // 抽查几个学生的成绩
  var sample = db.prepare(
    "SELECT u.real_name, u.class_name, COUNT(s.id) as cnt, ROUND(AVG(s.score),1) as avg FROM users u LEFT JOIN submissions s ON u.id=s.student_id WHERE u.role='student' GROUP BY u.id ORDER BY u.class_name, u.student_id LIMIT 5"
  ).all();
  console.log('\n抽查 (前5):');
  sample.forEach(function(s) {
    console.log('  ' + s.class_name + ' ' + s.real_name + ': ' + s.cnt + '次提交, 平均' + s.avg + '分');
  });

  console.log('\n========== 完成 ==========');
  if (db.save) db.save();
  process.exit(0);
}

main().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
