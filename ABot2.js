var DAO = require('./DAO.js');
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
	channels: ((process.env.DEBUG || false) == true) ? '#babodebug' : (process.env.CHANNELS || '#babodebug').split(';')
};
var irc = require('irc');
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
	checkNotes(to, nick);
	parseMessage(nick, to, text, message);
});

function parseMessage(nick, to, text, message){
	var operator = text.charAt(0);
	if(op === '!' || op === '?'){
		var splitted = text.split(' ');
		var cmd = splitted.splice(0, 1)[0].substring(1);
		var msg = splitted.join(' ');
		if(op === '!'){
			if(cmd === 'note'){
				sendNote(nick, to, msg);
			} else if(cmd === 'alias'){
				addAlias(to, msg);
			}
		} else if(op === '?'){
			if(cmd === 'owner'){
				tellOwner(nick, to);
			} else if(cmd === 'user'){
				tellBaseUsers(to);
			} else if(cmd === 'alias'){
				tellAliases(to, msg);
			} else if(cmd === 'help'){
				tellHelp(to);
			} else if(cmd === 'uptime'){
				tellUptime(to);
			}
		}
	}
};