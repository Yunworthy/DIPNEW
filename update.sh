#!/bin/bash\n# Load local environment variables, do not commit .env
if [ -f /opt/dip-smart-teaching/.env ]; then
  set -a
  . /opt/dip-smart-teaching/.env
  set +a
fi\nexport PUPPETEER_SKIP_DOWNLOAD=true\nexport PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true\nset -e\n\ncd /opt/dip-smart-teaching\n\ngit fetch origin\ngit reset --hard origin/main\n\nnpm install\n\nsed -i "s/app.listen(config.port, '0.0.0.0'/app.listen(config.port, '127.0.0.1'/g" server.js\nsed -i 's/app.listen(config.port, "0.0.0.0"/app.listen(config.port, "127.0.0.1"/g' server.js\n\npm2 restart dip-smart-teaching --update-env\npm2 save\n\nsleep 2\ncurl -I http://127.0.0.1:3000/\n