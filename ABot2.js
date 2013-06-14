var DAO = require('./DAO.js');
var util = require('./util.js');
var moment = require('moment');
var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './botlog.log' })
    ]
});
var Twit = require('twit');
var twit = new Twit({
	consumer_key: process.env.TWIT_CONSUMER_KEY,
	consumer_secret: process.env.TWIT_CONSUMER_SECRET,
	access_token: process.env.TWIT_ACCESS_TOKEN,
	access_token_secret: process.env.TWIT_ACCESS_TOKEN_SECRET
});
var uptime = moment();
var config = {
	botname: process.env.BOTNAME || 'abot2',
	server: process.env.IRCSERVER || 'irc.quakenet.org',
	channels: ((process.env.DEBUG || false) == true) ? '#babodebug' : (process.env.CHANNELS || '#babodebug').split(';')
};
var irc = require('irc');
var responses = [];
DAO.getAll(DAO.RESPONSES, function(data){
	for(var i=0; i<data.length; i++){
		if(i%2 === 1){
			responses.push(data[i].text);
		}
	}
});
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

var stream = twit.stream('user', { 'with' : 'user' });

bot.on('join', function(channel, nick, message){
	//Start listening to tweets only if the bot is connected.
	if(nick === config.botname){
		stream.on('tweet', function (tweet) {
			if(tweet.entities.urls.length > 0){
				var url = tweet.entities.urls[0].expanded_url;
				if(url.indexOf('vine.co') !== -1){
					if(cachedVine !== url){
						bot.say(channel, 'Arya uploaded a new video: '+url);
						cachedVine = url;
					}
				}
			}
		});
	}
});

bot.addListener('message', function(nick, to, text, message){
	logger.info('['+to+'] '+nick+': '+text);
	checkNotes(to, nick);
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
				sendNote(to, nick, msg);
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

function checkNotes(to, nick){
	//4) Deliver the notes
	//5) Mark them as read and restore.
	var alias = util.trim(nick.toLowerCase());
	DAO.getAll(DAO.USERS, function(data){
		//Find out the user to this alias
		var user = '';
		for(var i=0; i<data.length; i++){
			if(i%2 === 1){
				if(data[i].aliases.indexOf(alias) !== -1){
					//Found the alias in this user's aliases -> save the user
						user = data[i-1].key;
					break;
				}
			}
		}
		//Check all undeleted notes, then delete them
		if(user.length > 0){
			DAO.get(DAO.NOTES, user, function(err, data){
				if(!err){
					var retrievedNotes = data.notes;
					if(retrievedNotes.length > 0){
						//Sort the messages from oldest to newest
						//@see: http://stackoverflow.com/questions/10123953/sort-javascript-object-array-by-date
						retrievedNotes.sort(function(a,b){
							a = a.sentAt;
							b = b.sentAt;
							return a<b?-1:a>b?1:0;
						});
						for(var i=0; i<retrievedNotes.length; i++){
							var msg = retrievedNotes[i];
							if(!msg.deleted){
								bot.say(to, nick+': '+msg.sender+' left you a note '+moment(msg.sentAt).fromNow()+' ago: '+msg.text);
								//Mark as deleted
								retrievedNotes[i].deleted = true;
							}
						}
						//Restore
						DAO.store(DAO.NOTES, user, { notes: retrievedNotes }, function(err){
							if(err){
								logger.error('Could not restore notes.');
							}
						});
					}
				}
			});
		}
	});
}

function sendNote(to, from, msg){
	var splitted = msg.split(' ');
	if(splitted.length >= 2){
		var now = Date.now();
		var receiver = splitted.splice(0, 1)[0];
		var message = splitted.join(' ');
		//To make notes checking easier, we want to save the note to the base user, not the alias
		DAO.getAll(DAO.USERS, function(data){
			var user = '';
			//Find out the user to this alias
			for(var i=0; i<data.length; i++){
				if(i%2 === 1){
					if(data[i].aliases.indexOf(receiver) !== -1){
						//Found the alias in this user's aliases -> save the user
						user = data[i-1].key;
						break;
					}
				}
			}
			//get all notes from this user so we don't overwrite previously undelivered notes
			if(user.length > 0){
				DAO.get(DAO.NOTES, user, function(err, data){
					var storedNotes = [];
					if(!err){
						//If notes exists, we have to store them
						storedNotes = data.notes;
					}
					//Save the new note
					storedNotes.push({ sender: from, sentAt: now, text: message, deleted: false });
					DAO.store(DAO.NOTES, user, { notes: storedNotes }, function(err){
						if(err){
							bot.say(to, 'Could not store the note. Please try again.');
							return;
						}
						bot.say(to, responses[util.rnd(0, responses.length)]);
					});
				});
			}
		});
	} else {
		bot.say(to, 'Command usage: !note <alias> <message>.');
		bot.say(to, 'Stores <message> for <alias>. When <alias> logs in, the note will be delivered.');
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
			DAO.store(DAO.USERS, user, { aliases: a }, function(err){
				if(err){
					bot.say(to, 'Could not add alias to user.');
					return;
				}
				bot.say(to, 'Added alias '+alias+' to '+user+'.');
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
	bot.say(to, 'I\'ve been slaving away for you shitty humans for '+moment(uptime).fromNow(true)+'.');
}