const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const extractKeyframes = (videoPath, outputDir) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = `ffmpeg -i ${videoPath} -vf "fps=1" ${path.join(outputDir, 'frame-%03d.jpg')}`;

    exec(command, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(outputDir);
      }
    });
  });
};

module.exports = { extractKeyframes };