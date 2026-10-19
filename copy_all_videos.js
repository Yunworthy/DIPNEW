// Copy all videos to uploads/resources/ and update DB paths to relative
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'platform.db');
const VIDEO_BASE = 'D:\\workbudd\\outputs\\课程视频';
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'resources');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Get all video resources
  const videos = db.exec("SELECT id, title, file_path, file_size FROM resources WHERE category='video'");
  if (!videos.length) { console.log('No videos found'); return; }

  let copied = 0;
  let skipped = 0;
  let updated = 0;

  videos[0].values.forEach(([id, title, filePath, fileSize]) => {
    // Skip if already relative path
    if (filePath && filePath.startsWith('/uploads/')) {
      skipped++;
      return;
    }

    // Skip if no file path
    if (!filePath) {
      console.log(`  [skip] id=${id} "${title}": no file_path`);
      return;
    }

    // Check if source file exists
    if (!fs.existsSync(filePath)) {
      console.log(`  [warn] id=${id} "${title}": source not found: ${filePath}`);
      return;
    }

    // Generate a clean filename based on resource id and title
    const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_');
    const destName = `video_${id}_${safeTitle}.mp4`;
    const destPath = path.join(UPLOADS_DIR, destName);

    // Copy file
    if (!fs.existsSync(destPath)) {
      console.log(`  [copy] id=${id} "${title}" -> ${destName}`);
      fs.copyFileSync(filePath, destPath);
      copied++;
    } else {
      console.log(`  [exist] id=${id} "${title}" already copied`);
      skipped++;
    }

    // Update DB: change to relative path
    const relativePath = '/uploads/resources/' + destName;
    db.run("UPDATE resources SET file_path = ? WHERE id = ?", [relativePath, id]);
    updated++;
  });

  // Save database
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log(`\n===== 完成 =====`);
  console.log(`复制: ${copied} 个视频`);
  console.log(`跳过: ${skipped} 个`);
  console.log(`DB更新: ${updated} 条路径`);

  // Verify total size
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.mp4'));
  let totalSize = 0;
  files.forEach(f => totalSize += fs.statSync(path.join(UPLOADS_DIR, f)).size);
  console.log(`uploads/resources/ 共 ${files.length} 个视频, ${(totalSize/1024/1024).toFixed(1)}MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
