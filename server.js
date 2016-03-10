var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./webpack.config');
var childProcess = require('child_process')

childProcess.spawn(
  __dirname + '/node_modules/json-server/bin/index.js',
  ['--port', '3001', '--delay', '5000', '--watch', __dirname + '/db.json'],
  { stdio: 'inherit' }
)

new WebpackDevServer(webpack(config), {
  publicPath: config.output.publicPath,
  hot: true,
  historyApiFallback: true,
  proxy: {
    '/api/*': {
      target: 'http://localhost:3001',
      secure: false,
      rewrite: function(req) {
        req.url = req.url.replace(/^\/api/, '/')
      }
    }
  }
}).listen(3000, 'localhost', function (err, result) {
  if (err) {
    console.log(err);
  }

  console.log('Listening at localhost:3000');
});
