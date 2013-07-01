var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './weblog.log' })
    ]
});
var express = require('express');
var app = express();
app.get('/', function(request, response){
	response.send('This is the webinterface for ABot2. <a href="www.google.com" target="_blank">test</a>');
});
var port = process.env.PORT || 5000;
app.listen(port, function() {
	logger.info('Listening on ',port);
});
var abot2 = require('./ABot2.js');