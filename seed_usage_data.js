/**
 * seed_usage_data.js — 填充一学期的平台使用数据
 * 运行: node D:\platform\seed_usage_data.js
 * 必须在 D:\platform 目录下运行（依赖 sql.js）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'platform.db');

async function seed() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // ==================== 获取真实用户列表 ====================
  var userRows = db.exec('SELECT id, username, real_name, role FROM users WHERE is_active = 1');
  var users = [];
  if (userRows.length > 0) {
    var cols = userRows[0].columns;
    userRows[0].values.forEach(function(row) {
      var u = {};
      cols.forEach(function(c, i) { u[c] = row[i]; });
      users.push(u);
    });
  }
  console.log('[Seed] 找到', users.length, '个活跃用户');

  var students = users.filter(function(u) { return u.role === 'student'; });
  var teachers = users.filter(function(u) { return u.role === 'teacher' || u.role === 'admin'; });

  // ==================== 学期日期范围 ====================
  // 2026年春季学期: 2月24日 ~ 7月19日（约21周）
  var semesterStart = new Date(2026, 1, 24); // 月是0-indexed
  var semesterEnd = new Date(2026, 6, 19);

  // 考试周: 6月23日-7月4日 (activity spike)
  var examStart = new Date(2026, 5, 23);
  var examEnd = new Date(2026, 6, 4);

  // 五一假期: 5月1日-5月5日 (low activity)
  var holiday1Start = new Date(2026, 4, 1);
  var holiday1End = new Date(2026, 4, 5);

  // 清明: 4月4日-4月6日
  var holiday2Start = new Date(2026, 3, 4);
  var holiday2End = new Date(2026, 3, 6);

  var EVENT_TYPES = [
    'platform_visits', 'ai_tutor_interactions', 'video_plays',
    'code_executions', 'knowledge_graph_queries', 'ai_code_assists'
  ];

  var DETAIL_MAP = {
    'platform_visits': [
      'GET /student/dashboard', 'GET /student/courses', 'GET /student/courses/3',
      'GET /student/experiments', 'GET /student/experiments/histogram-equalization',
      'GET /student/knowledge-graph', 'GET /student/homework', 'GET /student/assignments',
      'GET /student/lab-reports', 'GET /student/profile', 'GET /student/cases',
      'GET /student/cases/2', 'GET /teacher/dashboard', 'GET /teacher/assignments',
      'GET /teacher/students', 'GET /student/evaluation', 'GET /student/announcements',
      'GET /student/exams', 'GET /teacher/resources', 'GET /student/experiments/frequency-filtering',
      'GET /student/experiments/morphology-processing', 'GET /student/experiments/edge-detection',
      'GET /student/courses/1', 'GET /student/courses/2', 'GET /student/courses/5'
    ],
    'ai_tutor_interactions': [
      'POST /api/ai-chat/send', 'POST /api/ai-chat/send', 'POST /api/ai-chat/send'
    ],
    'video_plays': [
      'GET /api/resources/1/download', 'GET /api/resources/2/download',
      'GET /api/resources/5/download', 'GET /api/resources/8/download'
    ],
    'code_executions': [
      'POST /api/code/run', 'POST /api/code/run', 'POST /api/code/run'
    ],
    'knowledge_graph_queries': [
      'GET /api/knowledge-graph/1', 'GET /api/knowledge-graph/2',
      'GET /api/knowledge-graph/3', 'GET /api/knowledge-graph/5',
      'GET /api/knowledge-graph/7', 'GET /api/knowledge-graph/progress',
      'GET /api/knowledge-graph/recommendations'
    ],
    'ai_code_assists': [
      'POST /api/usage/event', 'POST /api/usage/event'
    ]
  };

  // ==================== 伪随机数生成器 ====================
  var _seed = 42;
  function seededRandom() {
    _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
    return _seed / 0x7fffffff;
  }
  function randInt(min, max) {
    return Math.floor(seededRandom() * (max - min + 1)) + min;
  }
  function randFloat(min, max) {
    return seededRandom() * (max - min) + min;
  }
  function pick(arr) {
    return arr[Math.floor(seededRandom() * arr.length)];
  }
  function gaussRand(mean, std) {
    // Box-Muller
    var u1 = seededRandom() || 0.001;
    var u2 = seededRandom();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.round(mean + std * z);
  }

  // ==================== 生成每日数据 ====================
  var dailyData = {}; // { 'YYYY-MM-DD': { event_type: count } }
  var allDates = [];
  var totalByType = {};
  EVENT_TYPES.forEach(function(t) { totalByType[t] = 0; });

  var current = new Date(semesterStart);
  var weekNum = 0;
  var lastWeek = -1;

  while (current <= semesterEnd) {
    var ds = current.getFullYear() + '-' +
      String(current.getMonth() + 1).padStart(2, '0') + '-' +
      String(current.getDate()).padStart(2, '0');
    allDates.push(ds);

    var dayOfWeek = current.getDay(); // 0=Sun, 6=Sat
    var isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // 计算当前是第几周
    var weekDiff = Math.floor((current - semesterStart) / (7 * 24 * 3600 * 1000));
    if (weekDiff !== lastWeek) {
      weekNum = weekDiff;
      lastWeek = weekDiff;
    }

    // 判断特殊时段
    var isExam = (current >= examStart && current <= examEnd);
    var isHoliday1 = (current >= holiday1Start && current <= holiday1End);
    var isHoliday2 = (current >= holiday2Start && current <= holiday2End);

    // 基础活跃度系数 (学期初低→中期稳定→期末高)
    var semesterProgress = weekNum / 21;
    var baseMultiplier = 0.6 + 0.4 * Math.sin(semesterProgress * Math.PI);

    // 周末降低
    if (isWeekend) baseMultiplier *= 0.35;

    // 假期大幅降低
    if (isHoliday1) baseMultiplier *= 0.1;
    if (isHoliday2) baseMultiplier *= 0.15;

    // 考试周提升
    if (isExam) baseMultiplier *= 1.6;

    // 开学第一周较低
    if (weekNum <= 1) baseMultiplier *= 0.5;

    // 每种事件类型的日基础量
    var bases = {
      platform_visits: 195,
      ai_tutor_interactions: 88,
      video_plays: 38,
      code_executions: 155,
      knowledge_graph_queries: 62,
      ai_code_assists: 72
    };

    dailyData[ds] = {};
    EVENT_TYPES.forEach(function(type) {
      var base = bases[type] * baseMultiplier;
      // 添加随机波动 ±30%
      var count = Math.max(0, gaussRand(base, base * 0.25));
      dailyData[ds][type] = count;
      totalByType[type] += count;
    });

    // 推进到下一天
    current.setDate(current.getDate() + 1);
  }

  console.log('[Seed] 生成', allDates.length, '天的每日数据');
  console.log('[Seed] 累计统计:', JSON.stringify(totalByType));

  // ==================== 清空旧数据并写入 daily_stats ====================
  db.run('DELETE FROM usage_daily_stats');
  db.run('DELETE FROM usage_event_logs');

  var insertDaily = db.prepare(
    'INSERT INTO usage_daily_stats (date, event_type, count) VALUES (?, ?, ?)'
  );

  allDates.forEach(function(ds) {
    EVENT_TYPES.forEach(function(type) {
      var count = dailyData[ds][type];
      if (count > 0) {
        insertDaily.bind([ds, type, count]);
        insertDaily.step();
        insertDaily.reset();
      }
    });
  });
  insertDaily.free();

  console.log('[Seed] 已写入 usage_daily_stats');

  // ==================== 生成事件明细日志 ====================
  // 每天每种事件生成 count 条明细记录
  var insertLog = db.prepare(
    'INSERT INTO usage_event_logs (user_id, username, user_role, event_type, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  var logCount = 0;
  var ips = [];
  students.forEach(function(s, i) {
    // 生成校园网IP: 10.24.xx.xx
    ips.push('10.24.' + (100 + Math.floor(i / 25)) + '.' + (10 + (i % 240)));
  });

  allDates.forEach(function(ds) {
    EVENT_TYPES.forEach(function(type) {
      var count = dailyData[ds][type];
      var details = DETAIL_MAP[type] || ['GET /'];

      for (var i = 0; i < count; i++) {
        // 随机分配时间（8:00-23:00之间）
        var hour = randInt(7, 23);
        var minute = randInt(0, 59);
        var second = randInt(0, 59);
        var timeStr = ds + ' ' +
          String(hour).padStart(2, '0') + ':' +
          String(minute).padStart(2, '0') + ':' +
          String(second).padStart(2, '0');

        // 选择用户
        var user, userId, username, userRole, ip;
        if (type === 'platform_visits' && seededRandom() < 0.05) {
          // 5%的概率是教师/管理员访问
          user = pick(teachers.length > 0 ? teachers : users);
          userId = user.id;
          username = user.real_name || user.username;
          userRole = user.role;
          ip = '10.24.1.' + randInt(1, 50);
        } else {
          user = pick(students.length > 0 ? students : users);
          userId = user.id;
          username = user.real_name || user.username;
          userRole = user.role || 'student';
          ip = pick(ips.length > 0 ? ips : ['10.24.0.1']);
        }

        var detail = pick(details);

        insertLog.bind([userId, username, userRole, type, detail, ip, timeStr]);
        insertLog.step();
        insertLog.reset();
        logCount++;
      }
    });
  });
  insertLog.free();

  console.log('[Seed] 已写入 usage_event_logs:', logCount, '条记录');

  // ==================== 更新累计总数 ====================
  EVENT_TYPES.forEach(function(type) {
    db.run(
      "UPDATE platform_usage_stats SET count = ?, updated_at = datetime('now') WHERE event_type = ?",
      [totalByType[type], type]
    );
  });
  console.log('[Seed] 已更新 platform_usage_stats 累计总数');

  // ==================== 保存数据库 ====================
  var data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('[Seed] 数据库已保存');

  db.close();
  console.log('[Seed] 完成! 共生成:');
  console.log('  - 每日统计:', allDates.length * EVENT_TYPES.length, '条');
  console.log('  - 事件明细:', logCount, '条');
  EVENT_TYPES.forEach(function(t) {
    console.log('  - ' + t + ': ' + totalByType[t]);
  });
}

seed().catch(function(e) {
  console.error('Seed failed:', e);
  process.exit(1);
});
