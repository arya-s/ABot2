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
	channels: process.env.CHANNELS || ['#babodebug'],
	db: process.env.DB || './db'
};
var irc = require('irc');
var levelup = require('level');
var leveldb = levelup(config.db, { valueEncoding: 'json'});
var uptime = Date.now();
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

bot.addListener('message', function(nick, to, text, message){
	logger.info('['+to+'] '+nick+': '+text);
	if(text === 'hello'){
		bot.say(to, 'Hello '+nick);
	}
});