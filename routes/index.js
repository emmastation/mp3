// routes/index.js
module.exports = function (app, router) {
  app.use('/api', require('./users')(router));
  app.use('/api', require('./tasks')(router));
};
