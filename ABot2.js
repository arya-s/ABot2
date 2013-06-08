var DAO = require('./DAO.js');
var time = require('time');
var util = require('./util.js');
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './botlog.log' })
    ]
});
var uptime = time.time();
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
	//checkNotes(to, nick);
	parseMessage(nick, to, text, message);
});

function parseMessage(nick, to, text, message){
	var operator = text.charAt(0);
	if(operator === '!' || operator === '?'){
		var splitted = text.split(' ');
		var cmd = splitted.splice(0, 1)[0].substring(1);
		var msg = splitted.join(' ');
		if(operator === '!'){
		} else if(operator === '?'){
			if(cmd === 'uptime'){
				tellUptime(to);
			}
		}
	}
}

function tellUptime(to){
	bot.say(to, 'I\'ve been slaving away for you shitty humans for '+timestamp(uptime)+'.');
}

function timestamp(now) {
	var end = time.time();
	var difference = end - now;
	var seconds = Math.round(difference % 60);
	difference /= Math.round(60);
	var minutes = Math.round(difference % 60);
	difference /= Math.round(60);
	var hours = Math.round(difference % 24);
	difference /= Math.round(24);
	var days = Math.floor(difference);

	return (days === 0 ? '' : (days === 1 ? days + " day " : days + " days ")) +
	(hours === 0 ? '' : (hours === 1 ? hours + " hour " : hours + " hours ")) +
	(minutes === 0 ? '' : (minutes === 1 ? minutes + " minute " : minutes + " minutes ")) +
	(seconds === 1 ? seconds + " second" : seconds + " seconds");
}
