// DB maintenance: delete duplicate KPs, link unlinked videos
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'database', 'platform.db');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  // 1. Delete duplicate knowledge points 105 and 106
  console.log('=== 删除重复知识点 ===');
  const kp105 = db.exec("SELECT id, title, chapter_id FROM knowledge_points WHERE id IN (105, 106)");
  if (kp105.length > 0) {
    kp105[0].values.forEach(r => console.log('  删除 KP ' + r[0] + ': ' + r[1] + ' (ch' + r[2] + ')'));
  }
  // Check if any resources reference these KPs
  const refCheck = db.exec("SELECT id, title, knowledge_point_id FROM resources WHERE knowledge_point_id IN (105, 106)");
  if (refCheck.length > 0 && refCheck[0].values.length > 0) {
    console.log('  注意: 有资源引用了这些KP, 先解除关联');
    db.run("UPDATE resources SET knowledge_point_id = NULL WHERE knowledge_point_id IN (105, 106)");
  }
  db.run("DELETE FROM knowledge_points WHERE id IN (105, 106)");
  console.log('  已删除 KP 105, 106');

  // 2. Link unlinked videos where there's a clear match
  console.log('\n=== 关联无KP视频 ===');
  const links = [
    // ch08 光栅跟踪法 → KP 70 边缘连接与边界检测
    { titleMatch: '光栅跟踪法', kpId: 70, reason: '光栅跟踪法属于边界检测范畴' },
  ];

  links.forEach(({ titleMatch, kpId, reason }) => {
    const result = db.exec("SELECT id, title FROM resources WHERE title LIKE '%" + titleMatch + "%' AND category='video' AND (knowledge_point_id IS NULL OR knowledge_point_id = 0)");
    if (result.length > 0 && result[0].values.length > 0) {
      result[0].values.forEach(r => {
        db.run("UPDATE resources SET knowledge_point_id = " + kpId + " WHERE id = " + r[0]);
        console.log('  视频 ' + r[0] + ' "' + r[1] + '" → KP ' + kpId + ' (' + reason + ')');
      });
    }
  });

  // 3. Verify remaining unlinked videos
  console.log('\n=== 仍无KP的视频(章节级) ===');
  const unlinked = db.exec("SELECT id, title, chapter_id FROM resources WHERE category='video' AND (knowledge_point_id IS NULL OR knowledge_point_id = 0) ORDER BY chapter_id, id");
  if (unlinked.length > 0) {
    unlinked[0].values.forEach(r => console.log('  id=' + r[0] + ' ch' + r[2] + ' ' + r[1]));
    console.log('  共 ' + unlinked[0].values.length + ' 个章节级视频');
  }

  // 4. Verify no more duplicate KP titles within same chapter
  console.log('\n=== 检查剩余重复KP ===');
  const dups = db.exec("SELECT chapter_id, title, COUNT(*) as cnt FROM knowledge_points GROUP BY chapter_id, title HAVING cnt > 1");
  if (dups.length > 0 && dups[0].values.length > 0) {
    dups[0].values.forEach(r => console.log('  警告: ch' + r[0] + ' "' + r[1] + '" 出现 ' + r[2] + ' 次'));
  } else {
    console.log('  无重复知识点 ✓');
  }

  // Save
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();
  console.log('\n数据库已保存');
}

main().catch(e => { console.error(e); process.exit(1); });
