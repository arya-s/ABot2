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
	parseMessage(nick, to, util.trim(text.toLowerCase()), message);
});

function parseMessage(nick, to, text, message){
	var operator = text.charAt(0);
	if(operator === '!' || operator === '?'){
		var splitted = text.split(' ');
		var cmd = splitted.splice(0, 1)[0].substring(1);
		var msg = splitted.join(' ');
		if(operator === '!'){
			if(cmd === 'note'){

			} else if(cmd === 'alias'){
				addAlias(to, msg);
			}
		} else if(operator === '?'){
			if(cmd === 'uptime'){
				tellUptime(to);
			} else if(cmd === 'users'){
				tellBaseUsers(to);
			} else if(cmd === 'alias'){
				tellAlias(to, msg);
			}
		}
	}
}

function addAlias(to, msg){
	var splitted = msg.split(' ');
	if(splitted.length === 2){
		var user = splitted[0];
		var alias = splitted[1];
		DAO.get(DAO.USERS, user, function(err, data){
			if(err){
				bot.say(to, 'Databases error occured. User might not exist. Use ?users to list available users.');
				return;
			}
			var a = data.aliases;
			a.push(alias);
			DAO.del(DAO.USERS, user, function(err){
				if(err){
					bot.say(to, 'Could not add alias to user.');
					return;
				}
				DAO.store(DAO.USERS, user, { aliases: a }, function(err){
					if(err){
						bot.say(to, 'Could not add alias to user.');
						return;
					}
					bot.say(to, 'Added alias '+alias+' to '+user+'.');
				});
			});
		});
	} else {
		bot.say(to, 'Command usage: !alias <user> <alias>');
		bot.say(to, 'Adds <alias> to <user>\'s existing aliases. Use ?users to list available users.');
	}
}

function tellAlias(to, user){
	if(user.length > 0){
		DAO.get(DAO.USERS, user, function(err, data){
			if(err){
				bot.say(to, 'Databases error occured. User might not exist. Use ?users to list available users.');
				return;
			}
			bot.say(to, data.aliases.join(', '));
		});
	} else {
		bot.say(to, 'Command usage: ?alias <user>');
		bot.say(to, 'Shows <user>\'s aliases. Use ?users to list available users.');
	}
}

function tellBaseUsers(to){
	DAO.getAll(DAO.USERS, function(data){
		var users = [];
		for(var i=0; i<data.length; i+=2){
			users.push(data[i].key);
		}
		bot.say(to, users.join(', '));
	});
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
