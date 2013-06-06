var levelup = require('level');
var leveldb = levelup('./db', { valueEncoding: 'json'});

leveldb.put('test', { test: 'from makedb.js', test2: 'yep.'});
leveldb.get('test', function(err, val) {
  console.log('test=',val);
});