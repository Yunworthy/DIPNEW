/**
 * add_video_resource.js — 添加ch01视频到资源库
 * 运行: node D:\platform\add_video_resource.js
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'platform.db');

async function run() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // 查询所有章节，找到第一章
  var chapters = db.exec('SELECT id, title, sort_order FROM chapters ORDER BY sort_order');
  if (chapters.length > 0) {
    var cols = chapters[0].columns;
    chapters[0].values.forEach(function(row) {
      var obj = {};
      cols.forEach(function(c, i) { obj[c] = row[i]; });
      console.log('Chapter:', obj.id, '-', obj.title, '(sort:', obj.sort_order + ')');
    });
  }

  // 第一章的chapter_id
  var ch1Id = null;
  if (chapters.length > 0 && chapters[0].values.length > 0) {
    ch1Id = chapters[0].values[0][0]; // first chapter's id
  }
  console.log('\nUsing chapter_id:', ch1Id);

  // 查找管理员用户作为上传者
  var admin = db.exec("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  var adminId = 1;
  if (admin.length > 0 && admin[0].values.length > 0) {
    adminId = admin[0].values[0][0];
  }

  // 插入视频资源
  var stmt = db.prepare(
    "INSERT INTO resources (title, category, description, file_path, file_type, file_size, uploader_id, chapter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  stmt.bind([
    '第1章 概述 — 数字图像处理概述与图像基础',
    'video',
    '数字图像处理第一章概述的讲课视频，涵盖数字图像处理的基本概念、应用领域、图像形成与采样量化等基础知识。',
    '/uploads/resources/ch01_lecture_video.mp4',
    'mp4',
    13073597,
    adminId,
    ch1Id
  ]);
  stmt.step();
  stmt.free();

  console.log('\n已添加视频资源: ch01_lecture_video.mp4');

  // 验证
  var result = db.exec("SELECT id, title, category, file_path, chapter_id FROM resources WHERE category = 'video'");
  if (result.length > 0) {
    console.log('\n当前视频资源:');
    result[0].values.forEach(function(row) {
      console.log('  ID:', row[0], '| Title:', row[1], '| Path:', row[3], '| Chapter:', row[4]);
    });
  }

  // 保存
  var data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('\n数据库已保存');
  db.close();
}

run().catch(function(e) {
  console.error('Failed:', e);
  process.exit(1);
});
