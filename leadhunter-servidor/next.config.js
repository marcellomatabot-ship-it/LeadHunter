module.exports = {
  async rewrites() {
    return { beforeFiles: [
      { source: '/', destination: '/landing.html' },
      { source: '/app', destination: '/landing.html' },
      { source: '/entrar', destination: '/entrar.html' },
    ] };
  },
};
