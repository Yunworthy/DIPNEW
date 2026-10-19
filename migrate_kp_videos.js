/**
 * 迁移脚本：为 resources 表添加 knowledge_point_id 字段，
 * 并把 ch01 章节级视频(id=7)关联到知识点 1「数字图像概念」。
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'platform.db');

initSqlJs().then(SQL => {
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // 1. 检查列是否已存在
  const cols = db.exec('PRAGMA table_info(resources)')[0].values.map(r => r[1]);
  if (!cols.includes('knowledge_point_id')) {
    db.run('ALTER TABLE resources ADD COLUMN knowledge_point_id INTEGER');
    console.log('[OK] 已添加 resources.knowledge_point_id 列');
  } else {
    console.log('[SKIP] knowledge_point_id 列已存在');
  }

  // 2. 把 id=7 的视频关联到知识点 1（数字图像概念，第1章）
  db.run('UPDATE resources SET knowledge_point_id = 1 WHERE id = 7');
  console.log('[OK] 视频 id=7 已关联到知识点 id=1（数字图像概念）');

  // 3. 验证
  const check = db.exec("SELECT id, title, chapter_id, knowledge_point_id FROM resources WHERE category='video'");
  console.log('--- 当前视频资源 ---');
  check[0].values.forEach(v => console.log(JSON.stringify(v)));

  // 4. 保存
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('[OK] 数据库已保存');
}).catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
