module.exports = {
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/landing.html' }] };
  },
};
