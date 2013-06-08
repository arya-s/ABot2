//LevelDB 'Tables'
exports.ALL = 0x0000;
exports.RESPONSES = 0x0001;
exports.NOTES = 0x0002;
exports.USERS = 0x0003;
exports.LINKS = 0x0004;
exports.LOG = 0x0005;
exports.HELP = 0x0006;
exports.TEST2 = 0xFFFE
exports.TEST = 0xFFFF;
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './daolog.log' })
    ]
});
var db = process.env.DB || './db';
var levelup = require('level');
var leveldb = levelup(db, { keyEncoding: 'json', valueEncoding: 'json'});

//Adds key = k, value = v, to table = t and executes the callback = cb if specified
exports.store = function(t, k, v, cb){
	leveldb.put({ table: t, key: k}, v, function(err) {
		if(err){
      logger.error('Could not store k=',k,', v=',v);
      cb(false);
		}
    cb(true);
	});
};

exports.get = function(t, k, cb){
  leveldb.get({table: t, key: k}, function(err, value){
    if(err){
      logger.error('Could not retrieve value for ',k);
      cb(err);
    }
    logger.info('Retrieved '+k+'=',value);
    cb(value);
  })
};

exports.getAll = function(t, cb){
	var out = [];
  function filterTable(data){
    if(t === exports.ALL){
      out.push(data.key);
      out.push(data.value);
    } else {
      if(data.key.table === t){
        out.push(data.key);
        out.push(data.value);
      }
    }
  }
	leveldb.createReadStream()
  .on('data', function(data){
    logger.info('Retrieved ',data.key,'=',data.value);
    filterTable(data);
  })
  .on('error', function (err) {
    logger.error('Could not retrieve all entries',err);
  })
  .on('close', function () {
    logger.info('Closing stream.');
  })
  .on('end', function () {
    logger.info('Stream closed.');
    cb(out);
  });
};

exports.clearAll = function(t, cb){
  this.getAll(t, function(data){
    var batch = []
    for(var i=0; i<data.length; i+=2){
      batch.push({ type: 'del', key: data[i]});
    }
    leveldb.batch(batch, function(err){
      if(err){
        logger.error('Could not batch delete all entries.');
        cb(true);
      }
      logger.info('Deleted all entries.');
      cb(false);
    });
  });
};

exports.batch = function(data, cb){
  leveldb.batch(data, function(err){
    if(err){
        logger.error('Could not batch all entries.');
        cb(true);
      }
      logger.info('Batched all entries.');
      cb(false);
    });
};