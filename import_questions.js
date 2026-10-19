/**
 * import_questions.js
 * 批量导入扩充题库到 exam_questions 表
 * 用法: 先停止 node server.js，再运行 node import_questions.js
 */
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/db');
const config = require('./config');

const FILES = [
  'tmp_q_ch1_2.json',
  'tmp_q_ch3_4.json',
  'tmp_q_ch5_6.json',
  'tmp_q_ch7_8.json',
  'tmp_q_ch9_10.json',
  'tmp_q_ch11_12.json'
];

const CREATED_BY = 2; // 王政博(教师)

async function main() {
  const db = await initDatabase(config.dbPath);

  // 导入前统计
  const before = db.prepare('SELECT COUNT(*) as cnt FROM exam_questions').get().cnt;
  console.log('导入前题目总数:', before);

  const insert = db.prepare(`
    INSERT INTO exam_questions (chapter_id, type, content, options, answer, explanation, difficulty, score_weight, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let total = 0;
  const perChapter = {};

  for (const file of FILES) {
    const fp = path.join(__dirname, file);
    if (!fs.existsSync(fp)) {
      console.log('跳过(不存在):', file);
      continue;
    }
    const questions = JSON.parse(fs.readFileSync(fp, 'utf8'));
    for (const q of questions) {
      // options: 数组转JSON字符串，其他题型为null
      let options = null;
      if (Array.isArray(q.options)) {
        options = JSON.stringify(q.options);
      }
      // answer 统一转字符串
      const answer = String(q.answer);

      insert.run(
        q.chapter_id || null,
        q.type,
        q.content,
        options,
        answer,
        q.explanation || null,
        q.difficulty || 3,
        q.score_weight || 5,
        CREATED_BY
      );
      total++;
      perChapter[q.chapter_id] = (perChapter[q.chapter_id] || 0) + 1;
    }
    console.log('已导入', file, ':', questions.length, '题');
  }

  db.save();

  const after = db.prepare('SELECT COUNT(*) as cnt FROM exam_questions').get().cnt;
  console.log('\n本次新增:', total, '题');
  console.log('导入后题目总数:', after);
  console.log('\n各章新增:');
  for (let i = 1; i <= 12; i++) {
    const chTotal = db.prepare('SELECT COUNT(*) as cnt FROM exam_questions WHERE chapter_id = ?').get(i).cnt;
    console.log('  第' + i + '章: 新增' + (perChapter[i] || 0) + '题, 章内总计' + chTotal + '题');
  }

  db.close();
  console.log('\n完成。');
}

main().catch(e => { console.error('错误:', e); process.exit(1); });
