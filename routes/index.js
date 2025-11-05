// routes/index.js
module.exports = function (app, router) {
  require('./users')(router);
  require('./tasks')(router);
  app.use('/api', router);
};
