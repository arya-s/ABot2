var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './weblog.log' })
    ]
});
var mongodb = require('mongodb');
var url = require('url');
var connectionUri = url.parse(process.env.MONGOHQ_URL);
var dbName = connectionUri.pathname.replace(/^\//, '');
//Wait for the database to connect before we start the bot.
mongodb.Db.connect(process.env.MONGOHQ_URL, function(err, db){
	if(err){
		logger.error(err);
		return err;
	}
	var LINKS = new mongodb.Collection(db, 'links');
	var express = require('express');
	var app = express();
	app.get('/', function(request, response){
		//Quick and dirty
		LINKS.find().toArray(function(err, data){
			if(!err){
				data.forEach(function(link){
					response.send('<p><a href="'+link.url+' target="_blank">'+link.url+'</a> by '+link.sender+' at '+Date(link.sentAt)+'</p>');
				});
			} else {
				logger.error('Could not retrieve links. ',err);
			}
		});
	});
	var port = process.env.PORT || 5000;
	app.listen(port, function() {
		logger.info('Listening on ',port);
	});
	var abot2 = require('./ABot2.js');
});