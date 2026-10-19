/**
 * 批量导入课程视频到resources表
 * - 91个视频按章节/知识点匹配
 * - 第一个视频(ch01_01)复制到uploads/resources/用于Gitee提交
 * - 其余视频使用绝对路径(本地专用，不提交Gitee)
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'platform.db');
const VIDEO_BASE = 'D:\\workbudd\\outputs\\课程视频';
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'resources');

// 视频文件夹 → DB chapter_id 映射
const FOLDER_CHAPTER_MAP = {
  'ch01_概述': 1,
  'ch02_图像处理基础': 2,
  'ch03_图像的基本运算': 3,
  'ch04_空间域图像增强': 4,
  'ch05_频率域图像增强': 5,
  'ch06_图像恢复': 6,
  'ch07_图像压缩编码': 7,
  'ch09_图像分割': 8,
  'ch10_图像特征提取': 9,
  'ch11_彩色图像处理': 10,
  'ch12_形态学图像处理': 11,
};

// 视频文件 → knowledge_point_id 映射 (通过标题匹配确认)
const VIDEO_KP_MAP = {
  // ch01 → chapter 1
  'ch01_01_数字图像概念.mp4': 1,
  'ch01_02_图像处理系统组成.mp4': 4,
  'ch01_03_图像质量评价(PSNRSSIM).mp4': 5,
  'ch01_04_MATLAB图像处理基础.mp4': 8,
  'ch01_05_图像采集设备.mp4': 9,
  'ch01_06_应用领域概览.mp4': 10,
  // ch02 → chapter 2
  'ch02_01_图像矩阵表示.mp4': 11,
  'ch02_02_采样与量化.mp4': 2,
  'ch02_03_像素邻域(48邻域).mp4': 12,
  'ch02_04_像素与分辨率.mp4': 3,
  'ch02_05_图像文件格式.mp4': 6,
  'ch02_06_色彩空间基础.mp4': 7,
  // ch03 → chapter 3
  'ch03_01_灰度直方图定义.mp4': 13,
  'ch03_02_线性灰度变换.mp4': 16,
  'ch03_03_非线性变换(对数幂律).mp4': 17,
  'ch03_04_分段线性变换.mp4': 18,
  'ch03_05_位平面切片.mp4': 19,
  'ch03_06_图像代数运算.mp4': 20,
  // ch04 → chapter 4
  'ch04_01_空间滤波基础(卷积).mp4': 21,
  'ch04_02_均值滤波.mp4': 22,
  'ch04_03_中值滤波.mp4': 23,
  'ch04_04_直方图均衡化(CDF).mp4': 14,
  'ch04_05_高斯滤波.mp4': 24,
  'ch04_06_直方图规定化.mp4': 15,
  'ch04_07_拉普拉斯锐化.mp4': 25,
  'ch04_08_非锐化掩蔽.mp4': 26,
  'ch04_09_SobelPrewitt算子.mp4': 27,
  'ch04_10_滤波核设计原则.mp4': 28,
  'ch04_11_基于点运算的空间增强.mp4': 107,
  // ch05 → chapter 5
  'ch05_01_傅里叶变换原理.mp4': 29,
  'ch05_02_频谱分析与可视化.mp4': 30,
  'ch05_03_理想低通滤波器.mp4': 31,
  'ch05_04_巴特沃斯滤波器.mp4': 32,
  'ch05_05_高斯滤波器(频域).mp4': 33,
  'ch05_06_高通滤波器.mp4': 34,
  'ch05_07_带通带阻滤波器.mp4': 35,
  'ch05_08_同态滤波.mp4': 36,
  // ch06 → chapter 6
  'ch06_01_图像退化模型.mp4': 37,
  'ch06_02_噪声类型(高斯椒盐泊松).mp4': 38,
  'ch06_03_空间域去噪方法.mp4': 39,
  'ch06_04_运动模糊模型.mp4': 40,
  'ch06_05_逆滤波.mp4': 41,
  'ch06_06_维纳滤波.mp4': 42,
  'ch06_07_几何失真校正.mp4': 43,
  'ch06_08_图像配准.mp4': 44,
  // ch07 → chapter 7
  'ch07_01_图像冗余类型.mp4': 53,
  'ch07_02_霍夫曼编码.mp4': 54,
  'ch07_03_行程编码(RLE).mp4': 55,
  'ch07_04_算术编码.mp4': 56,
  'ch07_05_DCT变换编码.mp4': 57,
  'ch07_06_小波变换压缩.mp4': 58,
  'ch07_07_JPEG标准流程.mp4': 59,
  'ch07_08_压缩质量评价(PSNRSSIMMSE).mp4': 60,
  // ch09_图像分割 → chapter 8 (files named ch08_*)
  'ch08_01_阈值分割基础.mp4': 61,
  'ch08_02_Otsu自动阈值.mp4': 62,
  'ch08_03_自适应阈值.mp4': 63,
  'ch08_04_Sobel边缘检测.mp4': 64,
  'ch08_05_Canny边缘检测.mp4': 65,
  'ch08_06_霍夫变换(直线圆).mp4': 66,
  'ch08_07_区域生长.mp4': 67,
  'ch08_08_区域分裂合并.mp4': 68,
  'ch08_09_光栅跟踪法.mp4': null,       // 无匹配知识点
  'ch08_10_边缘连接与边界检测.mp4': 70,
  'ch08_11_图像分割的概念.mp4': null,    // 无匹配知识点(概述类)
  // ch10_图像特征提取 → chapter 9 (files named ch09_*)
  'ch09_01_Harris角点检测.mp4': 81,
  'ch09_02_HOG特征.mp4': 82,
  'ch09_03_颜色直方图.mp4': 83,
  'ch09_04_灰度共生矩阵(GLCM).mp4': 84,
  'ch09_05_局部二值模式(LBP).mp4': 85,
  'ch09_06_Gabor滤波器.mp4': 86,
  'ch09_07_纹理分类.mp4': 87,
  'ch09_08_多尺度特征.mp4': 88,
  // ch11_彩色图像处理 → chapter 10 (files named ch10_*)
  'ch10_01_RGB颜色模型.mp4': 45,
  'ch10_02_HSVHSI颜色模型.mp4': 46,
  'ch10_03_YCbCrLab颜色空间.mp4': 47,
  'ch10_04_伪彩色处理.mp4': 48,
  'ch10_05_全彩色图像处理.mp4': 49,
  'ch10_06_彩色空间转换.mp4': 50,
  'ch10_07_彩色图像分割.mp4': 51,
  'ch10_08_白平衡与色彩校正.mp4': 52,
  // ch12_形态学图像处理 → chapter 11 (files named ch11_*)
  'ch11_01_结构元素.mp4': 71,
  'ch11_02_腐蚀运算.mp4': 72,
  'ch11_03_膨胀运算.mp4': 73,
  'ch11_04_开运算.mp4': 74,
  'ch11_05_闭运算.mp4': 75,
  'ch11_06_击中击不中变换.mp4': 76,
  'ch11_07_边界提取.mp4': 77,
  'ch11_08_孔洞填充.mp4': 78,
  'ch11_09_骨架化细化.mp4': 79,
  'ch11_10_连通分量标记.mp4': 80,
  'ch11_11_形态学梯度Top-hat变换.mp4': null,  // 无匹配知识点
};

// 第一个视频(要复制到uploads并提交Gitee的)
const FIRST_VIDEO = 'ch01_01_数字图像概念.mp4';
const FIRST_VIDEO_FOLDER = 'ch01_概述';

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  // 1. 删除旧的占位视频记录 (id=5,6,7)
  console.log('删除旧视频记录 (id=5,6,7)...');
  db.run('DELETE FROM resources WHERE id IN (5, 6, 7)');

  // 2. 确保uploads/resources目录存在
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // 3. 复制第一个视频到uploads/resources/
  const firstSrc = path.join(VIDEO_BASE, FIRST_VIDEO_FOLDER, FIRST_VIDEO);
  const firstDest = path.join(UPLOADS_DIR, 'ch01_01_数字图像概念.mp4');
  console.log('复制第一个视频到uploads: ' + firstSrc + ' → ' + firstDest);
  fs.copyFileSync(firstSrc, firstDest);
  const firstSize = fs.statSync(firstDest).size;
  console.log('  文件大小: ' + firstSize + ' bytes');

  // 4. 遍历所有文件夹，插入视频记录
  const insertStmt = db.prepare(
    'INSERT INTO resources (title, category, description, file_path, file_type, file_size, url, uploader_id, chapter_id, is_visible, knowledge_point_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  let inserted = 0;
  let skipped = 0;

  for (const [folder, chapterId] of Object.entries(FOLDER_CHAPTER_MAP)) {
    const folderPath = path.join(VIDEO_BASE, folder);
    if (!fs.existsSync(folderPath)) {
      console.log('文件夹不存在，跳过: ' + folder);
      continue;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.mp4')).sort();
    console.log('\n' + folder + ' (chapter_id=' + chapterId + '): ' + files.length + '个视频');

    for (const file of files) {
      const kpId = VIDEO_KP_MAP[file] !== undefined ? VIDEO_KP_MAP[file] : null;
      const srcPath = path.join(folderPath, file);
      const stat = fs.statSync(srcPath);

      // 从文件名提取标题: ch01_01_数字图像概念.mp4 → 数字图像概念
      const nameWithoutExt = file.replace('.mp4', '');
      const titleMatch = nameWithoutExt.match(/^ch\d+_\d+_(.+)$/);
      const title = titleMatch ? titleMatch[1] : nameWithoutExt;

      let filePath;
      if (file === FIRST_VIDEO) {
        // 第一个视频用相对路径(在uploads中，提交Gitee)
        filePath = '/uploads/resources/ch01_01_数字图像概念.mp4';
      } else {
        // 其余视频用绝对路径(本地专用)
        filePath = srcPath;
      }

      const description = '第' + chapterId + '章知识点讲解视频: ' + title;

      insertStmt.bind([
        title,           // title
        'video',         // category
        description,     // description
        filePath,        // file_path
        'mp4',           // file_type
        stat.size,       // file_size
        null,            // url
        1,               // uploader_id (admin)
        chapterId,       // chapter_id
        1,               // is_visible
        kpId,            // knowledge_point_id
      ]);
      insertStmt.step();
      insertStmt.reset();

      inserted++;
      const kpInfo = kpId ? 'KP=' + kpId : '无KP匹配';
      console.log('  + ' + file + ' → ' + title + ' (' + kpInfo + ', ' + stat.size + ' bytes)');
    }
  }

  insertStmt.free();

  // 5. 保存数据库
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log('\n===== 完成 =====');
  console.log('共插入 ' + inserted + ' 个视频记录');
  console.log('第一个视频已复制到 uploads/resources/ (将提交Gitee)');
  console.log('其余视频使用本地绝对路径 (不提交Gitee)');
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
