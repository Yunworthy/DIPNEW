require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const { initDatabase } = require('./database/db');

async function startServer() {
  const app = express();

  // Initialize database
  const db = await initDatabase(config.dbPath);

  // Ensure exam_attempts has question_order column (migration)
  try {
    db.exec("ALTER TABLE exam_attempts ADD COLUMN question_order TEXT");
  } catch (e) {
    // Column already exists — safe to ignore
  }

  // Create evaluations table (migration)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES users(id),
        dimension_key TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.error('Failed to create evaluations table:', e);
  }

  // Create platform usage stats table and seed initial values
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS platform_usage_stats (
        event_type TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Seed initial values only if table is empty (first run)
    const existing = db.prepare('SELECT COUNT(*) AS c FROM platform_usage_stats').get();
    if (existing.c === 0) {
      const seeds = [
        ['platform_visits', 28540],
        ['ai_tutor_interactions', 12680],
        ['video_plays', 5350],
        ['code_executions', 21560],
        ['knowledge_graph_queries', 8790],
        ['ai_code_assists', 10430]
      ];
      seeds.forEach(([type, count]) => {
        db.prepare('INSERT INTO platform_usage_stats (event_type, count) VALUES (?, ?)').run(type, count);
      });
      console.log('  [Usage Stats] 初始化统计表，已写入基线数据');
    }
  } catch (e) {
    console.error('Failed to create platform_usage_stats table:', e);
  }

  // Create detailed event log table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_event_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT DEFAULT '',
        user_role TEXT DEFAULT '',
        event_type TEXT NOT NULL,
        detail TEXT DEFAULT '',
        ip TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    // Create index for faster queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_logs_type ON usage_event_logs(event_type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_logs_time ON usage_event_logs(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_event_logs(user_id)`);
  } catch (e) {
    console.error('Failed to create usage_event_logs table:', e);
  }

  // Create daily aggregation table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_daily_stats (
        date TEXT NOT NULL,
        event_type TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (date, event_type)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON usage_daily_stats(date)`);
  } catch (e) {
    console.error('Failed to create usage_daily_stats table:', e);
  }

  // Create discussion forum tables (migration)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS discussion_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        chapter_id INTEGER REFERENCES chapters(id),
        tag TEXT DEFAULT 'discussion' CHECK(tag IN ('question','discussion','share')),
        is_pinned INTEGER DEFAULT 0,
        is_answered INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS discussion_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS discussion_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(post_id, user_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_discussion_posts_chapter ON discussion_posts(chapter_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_discussion_replies_post ON discussion_replies(post_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_discussion_likes_post ON discussion_likes(post_id)`);
  } catch (e) {
    console.error('Failed to create discussion tables:', e);
  }

  // Create process-evaluation tracking tables (migration)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        resource_id INTEGER NOT NULL REFERENCES resources(id),
        watch_seconds REAL DEFAULT 0,
        progress REAL DEFAULT 0,
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(user_id, resource_id)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS kp_dwell_time (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        knowledge_point_id INTEGER NOT NULL REFERENCES knowledge_points(id),
        total_seconds REAL DEFAULT 0,
        visit_count INTEGER DEFAULT 0,
        last_visited DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(user_id, knowledge_point_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_video_progress_user ON video_progress(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_kp_dwell_user ON kp_dwell_time(user_id)`);
  } catch (e) {
    console.error('Failed to create process-eval tables:', e);
  }

  // Create group collaboration tables (migration)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        class_name TEXT,
        topic TEXT,
        description TEXT,
        max_members INTEGER DEFAULT 6,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id),
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        role TEXT DEFAULT 'member' CHECK(role IN ('leader','member')),
        joined_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        related_chapter TEXT,
        deadline DATE,
        max_score INTEGER DEFAULT 100,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES group_tasks(id),
        group_id INTEGER NOT NULL REFERENCES groups(id),
        content TEXT NOT NULL,
        submitted_by INTEGER REFERENCES users(id),
        submitted_at DATETIME DEFAULT (datetime('now','localtime')),
        score INTEGER,
        feedback TEXT,
        graded_by INTEGER REFERENCES users(id),
        graded_at DATETIME,
        UNIQUE(task_id, group_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gm_group ON group_members(group_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gs_task ON group_submissions(task_id)`);

    // 组间互评表
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_peer_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES group_tasks(id) ON DELETE CASCADE,
        reviewer_group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        reviewee_group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(task_id, reviewer_group_id, reviewee_group_id)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS group_peer_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES group_tasks(id) ON DELETE CASCADE,
        reviewer_group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        reviewee_group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        comments TEXT,
        submitted_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        UNIQUE(task_id, reviewer_group_id, reviewee_group_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gpa_task ON group_peer_assignments(task_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_gpr_task ON group_peer_reviews(task_id)`);
    // group_tasks 增加互评开关字段(已存在时忽略错误)
    try { db.exec(`ALTER TABLE group_tasks ADD COLUMN peer_reviews_enabled INTEGER DEFAULT 0`); } catch (e) { /* column exists */ }
    try { db.exec(`ALTER TABLE group_tasks ADD COLUMN reviews_per_group INTEGER DEFAULT 2`); } catch (e) { /* column exists */ }

    // 初始数据: 仅当小组表为空时执行(基于真实班级与课程章节)
    const gc = db.prepare('SELECT COUNT(*) as c FROM groups').get().c;
    if (gc === 0) {
      // 4个课程对齐的小组任务(对应真实章节)
      const seedTasks = [
        ['空间域图像增强算法对比研究', '对比直方图均衡化、均值滤波、中值滤波对含噪图像的处理效果，整理对比截图与分析报告，说明各方法的适用场景。', '第4章 空间域图像增强', '2026-07-25', 100],
        ['频域滤波器设计与对比分析', '设计理想、巴特沃斯、高斯低通/高通滤波器，观察不同截止频率下的处理效果，分析振铃现象产生的原因。', '第5章 频率域图像处理', '2026-07-28', 100],
        ['图像分割算法综合实验', '对比Otsu最大类间方差法、迭代阈值法与区域生长法的分割效果，讨论不同图像下的算法选择依据。', '第8章 图像分割', '2026-07-31', 100],
        ['形态学运算应用探究', '利用腐蚀、膨胀、开运算、闭运算完成孔洞填充、边界提取、骨架抽取等应用，总结结构元素形状对结果的影响。', '第11章 形态学图像处理', '2026-08-03', 100]
      ];
      const taskStmt = db.prepare('INSERT INTO group_tasks (title, description, related_chapter, deadline, max_score, created_by) VALUES (?,?,?,?,?,2)');
      seedTasks.forEach(t => taskStmt.run(...t));

      // 每班7个主题小组, 真实学生轮流分配(每组首人为组长)
      const topicGroups = [
        ['图像增强探究组', '空间域/频率域图像增强算法的实验与对比'],
        ['频域滤波分析组', '傅里叶变换与频域滤波器设计分析'],
        ['图像复原技术组', '噪声建模与图像复原方法实验'],
        ['图像压缩编码组', '霍夫曼编码与DCT压缩实验'],
        ['图像分割算法组', '阈值分割与区域分割算法对比'],
        ['特征提取应用组', '边缘、纹理与形状特征提取实验'],
        ['形态学处理组', '形态学运算及其工程应用']
      ];
      const groupStmt = db.prepare('INSERT INTO groups (name, class_name, topic, description, max_members, created_by) VALUES (?,?,?,?,8,2)');
      const memberStmt = db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,?)');
      const countStmt = db.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id = ?');
      const classList = db.prepare("SELECT DISTINCT class_name FROM users WHERE role='student' AND class_name IS NOT NULL AND class_name != ''").all().map(r => r.class_name);
      classList.forEach(cls => {
        topicGroups.forEach(tg => groupStmt.run(tg[0], cls, tg[1], '课程小组协作学习'));
        const students = db.prepare("SELECT id FROM users WHERE role='student' AND class_name=? AND is_active=1 ORDER BY id").all(cls).map(r => r.id);
        const groupIds = db.prepare('SELECT id FROM groups WHERE class_name=? ORDER BY id').all(cls).map(r => r.id);
        students.forEach((sid, idx) => {
          const gid = groupIds[idx % groupIds.length];
          const cnt = countStmt.get(gid).c;
          memberStmt.run(gid, sid, cnt === 0 ? 'leader' : 'member');
        });
      });
      db.save();
      console.log('Group collaboration seed data created (tasks + class groups).');
    }
  } catch (e) {
    console.error('Failed to create group tables:', e);
  }

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve index.html with no-cache to prevent stale page issues
  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  app.use(express.static(config.publicDir));
  app.use('/uploads', express.static(config.uploadsDir));
  // Serve teaching materials from local resource directory
  if (config.resourceBaseDir) {
    app.use('/course-resources', express.static(config.resourceBaseDir, {
      setHeaders: (res, filePath) => {
        const filename = path.basename(filePath);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
      }
    }));
  }

  // Make db available to routes
  app.use((req, res, next) => { req.db = db; next(); });

  // Request logging middleware
  app.use(require('./middleware/logger')());

  // Usage tracking middleware — auto-increment counters based on API routes
  const { incrementUsage } = require('./routes/usage');
  app.use((req, res, next) => {
    // Track code executions
    if (req.method === 'POST' && req.path === '/api/code/run') {
      incrementUsage(db, 'code_executions', 1, req);
    }
    // Track AI tutor interactions
    if (req.method === 'POST' && req.path === '/api/ai-chat/send') {
      incrementUsage(db, 'ai_tutor_interactions', 1, req);
    }
    // Track knowledge graph queries (only main graph fetches, not sub-requests)
    if (req.method === 'GET' && req.path.startsWith('/api/knowledge-graph')
        && !req.path.includes('/progress') && !req.path.includes('/recommendations')) {
      incrementUsage(db, 'knowledge_graph_queries', 1, req);
    }
    next();
  });

  // API Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/chapters', require('./routes/course'));
  app.use('/api/simulations', require('./routes/simulation'));
  const assignmentRouter = require('./routes/assignment');
  app.use('/api', assignmentRouter);
  app.use('/api/cases', require('./routes/case-study'));
  app.use('/api/knowledge-graph', require('./routes/knowledge-graph'));
  app.use('/api/code', require('./routes/code'));
  app.use('/api/upload', require('./routes/upload'));
  app.use('/api/student-import', require('./routes/student-import'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/exam', require('./routes/exam'));
  app.use('/api/export', require('./routes/export'));
  app.use('/api/resources', require('./routes/resource'));
  app.use('/api/notifications', require('./routes/notification'));
  app.use('/api/classes', require('./routes/class-manage'));
  app.use('/api/announcements', require('./routes/announcement'));
  app.use('/api/ai-chat', require('./routes/ai-chat'));
  app.use('/api/code-review', require('./routes/code-review'));
  app.use('/api/evaluations', require('./routes/evaluation'));
  app.use('/api/usage', require('./routes/usage'));
  app.use('/api/obe', require('./routes/obe'));
  app.use('/api/discussion', require('./routes/discussion'));
  app.use('/api/warning', require('./routes/warning'));
  app.use('/api/process-eval', require('./routes/process-eval'));
  app.use('/api/groups', require('./routes/group'));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
  });

  // Graceful shutdown
  process.on('SIGINT', () => { db.close(); process.exit(0); });
  process.on('SIGTERM', () => { db.close(); process.exit(0); });

  app.listen(config.port, '127.0.0.1', () => {
    const nets = require('os').networkInterfaces();
    let lanIp = '未绑定';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { lanIp = net.address; break; }
      }
    }
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║  数字图像处理智慧教学与虚拟仿真平台 v2.0    ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  本地访问: http://localhost:${config.port}              ║`);
    console.log(`  ║  本机IP:   http://${lanIp}:${config.port}     ║`);
    console.log('  ║  (仅监听localhost,局域网访问请修改绑定地址)  ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    if (config.authBypass) {
      console.log('');
      console.log('  ⚠ 警告: 当前处于免登录模式 (AUTH_BYPASS=true), 所有访问以管理员身份直通!');
      console.log('    生产环境部署务必设置环境变量 AUTH_BYPASS=false 启用真实登录鉴权。');
    }
    console.log('');
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
