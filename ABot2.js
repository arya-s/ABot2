var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './botlog.log' })
    ]
});
var config = {
	botname: process.env.BOTNAME || 'abot2',
	server: process.env.IRCSERVER || 'irc.quakenet.org',
	debug: process.env.DEBUG || false,
	channels: process.env.CHANNELS.split(';') || ['#babodebug'],
	db: process.env.DB || './db'
};
var irc = require('irc');
var levelup = require('level');
var leveldb = levelup(config.db, { valueEncoding: 'json'});
var bot = new irc.Client(
	config.server,
	config.botname,
	{
		channels: config.channels,
		debug: true,
		floodProtection: true,
		floodProtectionDelay: 1000
	}
);

leveldb.get('test', function(err, val) {
	console.log(';;;;;test=',val);
});

bot.addListener('message', function(nick, to, text, message){
});