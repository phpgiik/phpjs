var cli       = require('cli').enable('status', 'help', 'version', 'glob', 'timeout');
var fs        = require('fs');
var glob      = require('glob');
var path      = require('path');
var phpjsutil = new require('../lib/phpjsutil');
var equal     = require('deep-equal');
var __root    = __dirname + '/..';


var PhpjsUtil = phpjsutil({
  injectDependencies: ['ini_set', 'ini_get'],
  equal             : equal,
  debug             : cli.debug
});

// Environment-specific file opener. function name needs to
// be translated to code. The difficulty is in finding the
// category.
PhpjsUtil.opener = function(name, cb) {
  glob(__root + '/functions/*/' + name + '.js', {}, function(err, files) {
    if (err) {
      return cb(err);
    }
    var filepath = files[0];

    if (!filepath) {
      return cb('could not find ' + __root + '/functions/*/' + name + '.js');
    }

    fs.readFile(filepath, 'utf-8', function(err, code) {
      if (err) {
        return cb(err);
      }
      return cb(null, code);
    });
  });
};

// --debug works out of the box. See -h
cli.parse({
  action  : ['a', 'Test / Build', 'string', 'test'],
  name    : ['n', 'Function name to test', 'path', '*'],
  category: ['c', 'Category to test', 'path', '*'],
  abort   : ['a', 'Abort on first failure']
});

cli.buildnpm = function(args, options) {
  var self     = this;
  var globpath = __root + '/functions/' + options.category + '/' + options.name + '.js';
  fs.writeFileSync(__root + '/build/npm.js', '// This file is generated by `make build`. \n');
  fs.appendFileSync(__root + '/build/npm.js', '// Do NOT edit by hand. \n');
  fs.appendFileSync(__root + '/build/npm.js', '// \n');
  fs.appendFileSync(__root + '/build/npm.js', '// Make function changes in ./functions and \n');
  fs.appendFileSync(__root + '/build/npm.js', '// generator changes in ./lib/phpjsutil.js \n');
  self.glob(globpath, function (err, params) {
    var buf = '\n';
    buf += 'exports.' + params.func_name + ' = function (' + params.func_arguments.join(', ') + ') {\n';
    buf += '  ' + params.body.split('\n').join('\n  ').replace(/^  $/g, '') + '\n';
    buf += '};\n';
    console.log(buf);
    fs.appendFileSync(__root + '/build/npm.js', buf);
  });
};

cli.glob = function(globpath, cb) {
  glob(globpath, {}, function(err, files) {
    var names = [];
    for (var i in files) {
      var file = files[i];
      if (file.indexOf('/_') === -1) {
        names.push(path.basename(file, '.js'));
      }
    }
    names.forEach(function(name) {
      PhpjsUtil.load(name, function(err, params) {
        if (err) {
          return cb(err);
        }

        return cb(null, params);
      });
    });
  });
};

cli.test = function(args, options) {
  var self     = this;
  var globpath = __root + '/functions/' + options.category + '/' + options.name + '.js';

  process.on('exit', function() {
    var msg = self.pass_cnt + ' passed / ' + self.fail_cnt + ' failed / ' + self.skip_cnt + ' skipped';
    if (self.fail_cnt) {
      cli.fatal(msg);
    } else {
      cli.ok(msg);
    }
  });

  self.pass_cnt = 0;
  self.fail_cnt = 0;
  self.skip_cnt = 0;
  self.glob(globpath, function(err, params) {
    if (err) {
      return cli.fatal(err);
    }

    if (params.headKeys.test && params.headKeys.test[0] === 'skip') {
      self.skip_cnt++;
      return cli.info('--> ' + params.name + ' skipped as instructed. ');
    }

    PhpjsUtil.test(params, function(err, test, params) {
      if (!err) {
        self.pass_cnt++;
        cli.debug('--> ' + params.name + '#' + (+test.number + 1) + ' passed. ');
      } else {
        self.fail_cnt++;
        cli.error('--> ' + params.name + '#' + (+test.number + 1) + ' failed. ');
        cli.error(err);
        if (options.abort) {
          cli.fatal('Aborting on first failure as instructed. ');
        }
      }
    });

  });
};

cli.main(function(args, options) {
  cli[options.action](args, options);
});

