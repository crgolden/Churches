const { env } = require('node:process');

function proxyTarget() {
  if (env.ASPNETCORE_HTTPS_PORT) {
    return `https://localhost:${env.ASPNETCORE_HTTPS_PORT}`;
  }
  if (env.ASPNETCORE_URLS) {
    return env.ASPNETCORE_URLS.split(';')[0];
  }
  return 'https://localhost:7135';
}

const target = proxyTarget();

const PROXY_CONFIG = [
  {
    context: ['/bff', '/directory/api'],
    target,
    secure: false
  }
];

module.exports = PROXY_CONFIG;
