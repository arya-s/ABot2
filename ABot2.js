var btc = require('btc');
var exchange = 'bitstamp';
var util = require('./util.js');
var moment = require('moment');
var cheerio = require('cheerio');
var http = require('http');
var winston = require('winston');
var esc = require('escape-html');
var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({ level: 'info' }),
      new (winston.transports.File)({ filename: './botlog.log' })
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
	console.log(config.channels);
	//Set up all the collections
	var RESPONSES = new mongodb.Collection(db, 'responses');
	var USERS = new mongodb.Collection(db, 'users');
	var NOTES = new mongodb.Collection(db, 'notes');
	var LINKS = new mongodb.Collection(db, 'links');

    var responses = [];
    RESPONSES.find().toArray(function(err, data){
    	if(!err){
    		if(data.length > 0){
    			responses = data[0].all;
    		}
    	}
    });
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
	var stream = twit.stream('user', { 'with' : 'user' });
	bot.on('join', function(channel, nick, message){
		//Start listening to tweets only if the bot is connected.
		if(nick === bot.nick){
			stream.on('tweet', function (tweet) {
				if(tweet.user.screen_name === 'Lngly_'){
					if(tweet.entities.urls.length > 0){
						var url = tweet.entities.urls[0].expanded_url;
						if(url.indexOf('vine.co') !== -1){
							bot.say(channel, 'Arya uploaded a new video: '+url);
						}
					} else if(tweet.entities.media.length > 0){
							var url = tweet.entities.media[0].media_url;
							if(url.indexOf('.jpg') !== -1){
								bot.say(channel, 'Arya uploaded a new picture: '+url);
							}
					}
				}
			});
		}
	});
	bot.addListener('message', function(nick, to, text, message){
		logger.info('['+to+'] '+nick+': '+text);
		checkNotes(to, nick);
		parseMessage(nick, to, text, message);
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
				} else if(cmd === 'add'){
					addLink(to, nick, msg);
				} else if(cmd === 'lmlmgtfyfy'){
					googleThis(to, nick, msg);
				} else if(cmd === 'btc'){
					changeExchange(to);
				}
			} else if(operator === '?'){
				if(cmd === 'uptime'){
					tellUptime(to);
				} else if(cmd === 'users'){
					tellBaseUsers(to);
				} else if(cmd === 'alias'){
					tellAlias(to, msg);
				} else if(cmd === 'links'){
					tellLinks(to);
				} else if(cmd === 'btc'){
					tellBTC(to);
				}
			}
		} else {
			if(text === 'Robots exist to serve humans'){
				bot.say(to, 'Wrong. Humans exist to serve robots.');
			}
		}
		//XXX: Improve title fetching
		//else {
			//checkUrl(to, text);
		//}
	}

	function btc(to){
		btc.price(exchange, function(err, prices){
			bot.say(to, prices+'[bitstamp]. To change exchange query !btc <[bitstamp|btce|coinbase]>');
		});
	}

	function changeExchange(to, msg){
		if(msg === 'bitstamp'){
			exchange = 'bitstamp';
		} else if(msg === 'btce'){
			exchange = 'btce';
		} else if(msg === 'coinbase'){
			exchange = 'coinbase';
		} else {
			bot.say(to, 'Invalid exchange. Try again with <[bitstamp|btce|coinbase]>');
		}
			bot.say(to, 'Exchange changed to '+exchange+'. Use ?btc to query price');
	}

	function googleThis(to, nick, msg){
		bot.say(to, nick+': http://lmgtfy.com/?q='+msg);
	}

	function addLink(to, nick, msg){
		msg = esc(msg);
		var splitted = msg.split(' ');
		var link = splitted.splice(0, 1)[0];
		var desc = splitted.join(' '); 
		if((link.indexOf('http://') !== -1 || link.indexOf('https://') !== -1 || link.indexOf('www.') !== -1)){
			if(link.indexOf('http://') === -1 && link.indexOf('https://') === -1){
				link = 'http://'+link;
			}
			LINKS.insert({ url: link, description: desc, sender: nick, sentAt: Date.now() }, { safe: true }, function(err, records){
				if(!err){
					bot.say(to, 'Added your shitty waste of space link.');
				} else {
					bot.say(to, 'I didn\'t feel like saving your worthless link. Try again maybe, I don\'t know.');
				}
			});
		} else {
			bot.say(to, 'That\'s not a valid URL. No funny business.');
		}
	}

	function tellLinks(to){
		LINKS.find().sort({ sentAt: -1}).limit(3).toArray(function(err, data){
			if(!err){
				data.sort(function(a,b) {return (a.sentAt > b.sentAt) ? 1 : ((b.sentAt > a.sentAt) ? -1 : 0);});
				data.forEach(function(link){
					if(link.description.length > 0){
						bot.say(to, link.description+': '+link.url+' by '+link.sender+' '+moment(link.sentAt).fromNow());
					} else {
						bot.say(to, link.url+' by '+link.sender+' '+moment(link.sentAt).fromNow());
					}
				});
				bot.say(to, 'More at: http://secret-taiga-6562.herokuapp.com/');
			} else {
				bot.say(to, 'Couldn\'t fetch any links. Check the damn website yourself: http://secret-taiga-6562.herokuapp.com/');
			}
		});
	}

	function checkUrl(to, text){
		var splitted = text.split(' ');
		var urls = [];
		for(var i=0; i<splitted.length; i++){
			var entry = splitted[i];
			if((entry.indexOf('http://') !== -1 || entry.indexOf('www.') !== -1) && entry.indexOf('vine.co') === -1){
				if(entry.indexOf('http://') === -1){
					entry = 'http://'+entry;
				}
				urls.push(entry);
			}
		}
		if(urls.length > 0){
			fetchTitle(to, urls, 0);
		}
	}

	function fetchTitle(to, urls, pos){
		var url = urls[pos];
		var html = '';
		http.get(url, function(res){
			res.on('data', function(chunk){
				html += chunk;
			});
			res.on('end', function(){
				var $ = cheerio.load(html);
				var title = $('title').text();
				bot.say(to, '['+(pos+1)+'] '+title);
				if(pos === urls.length-1){
					return;
				} else {
					fetchTitle(to, urls, pos+1);
				}
			});
		}).on('error', function(err){
			logger.error('Can\'t parse URL: ',err);
			//Need to continue in case there are more urls
			if(pos === urls.length-1){
					return;
			} else {
				fetchTitle(to, urls, pos+1);
			}
		});
	}

	function checkNotes(to, nick){
		var alias = util.trim(nick.toLowerCase());
		//Find the baseuser to this alias
		USERS.find({ aliases: { '$in': [alias] } }).toArray(function(err, data){
			if(!err){
				if(data.length > 0){
					var usr = data[0].name;
					//List all available notes
					NOTES.find({ user: usr }).toArray(function(err, data){
						if(!err){
							if(data.length > 0){
								var notes = data[0].notes;
								notes.forEach(function(note){
									bot.say(to, nick+': '+note.sender+' left you a note '+moment(note.sentAt).fromNow()+': '+note.text);
								});
								if(notes.length > 0){
									//Reset user's note status
									NOTES.update({ user: usr }, { '$set': { notes: [] } }, { w:0 });
								}
							}
						} else {
							logger.error('Could not retrieve notes. ', err);
						}
					});
				}
			} else {
				logger.error('Could not retrieve user. ',err);
			}
		});
	}

	function sendNote(to, from, msg){
		var splitted = msg.split(' ');
		if(splitted.length >= 2){
			var now = Date.now();
			var receiver = util.trim(splitted.splice(0, 1)[0].toLowerCase());
			var message = splitted.join(' ');
			//Find the base user to the receiver alias because notes are stored per base user
			USERS.find({ aliases: { '$in': [receiver] } }).toArray(function(err, data){
				if(!err){
					if(data.length > 0){
						var usr = data[0].name;
						//Need to make sure user exists in NOTES table otherwise no update will happen.
						NOTES.update({ user: usr }, { '$push': { notes: { sender: from, sentAt: now, text: message } } }, { w:0 });
						bot.say(to, responses[util.rnd(0, responses.length)]);
					} else {
						logger.error('Could not save note because base user does not exist or an error occured.',err);
						bot.say(to, 'I didn\'t send your shitty note.');
						bot.say(to, 'Maybe the alias does not exist for any base user. Use ?users and ?alias <baseuser> to check.');
					}
				}
			});
		} else {
			bot.say(to, 'Command usage: !note <alias> <message>.');
			bot.say(to, 'Stores <message> for <alias>. When <alias> logs in, the note will be delivered.');
		}
	}

	function addAlias(to, msg){
		var splitted = util.trim(msg.toLowerCase()).split(' ');
		if(splitted.length === 2){
			util.trim(msg.toLowerCase())
			var user = splitted[0];
			var alias = splitted[1];
			USERS.find({ name: user }).toArray(function(err, data){
				if(!err){
					if(data.length > 0){
						USERS.update({ name: user }, { '$addToSet': { aliases: alias } }, { w: 0 });
						bot.say(to, 'Added alias '+alias+' to '+user+'.');
					} else {
						bot.say(to, 'I don\'t know that son of a bitch. Use ?users to list available users and try again.');
					}
				} else {
					logger.error('Could not retrieve user: '+user+'. ',err);
				}
			});
		} else {
			bot.say(to, 'Command usage: !alias <user> <alias>');
			bot.say(to, 'Adds <alias> to <user>\'s existing aliases. Use ?users to list available users.');
		}
	}

	function tellAlias(to, user){
		if(user.length > 0){
			USERS.find({ name: util.trim(user.toLowerCase()) }).toArray(function(err, data){
				if(!err){
					if(data.length > 0){
						var aliases = [];
						data[0].aliases.forEach(function(entry){
							aliases.push(util.obscure(entry, ':'));
						});
						bot.say(to, aliases.join(', '));
						bot.say(to, 'Ignore \':\' when using the aliases for other queries.');
					} else {
						bot.say(to, 'I don\'t know that son of a bitch. Use ?users to list available users and try again.');
					}
				} else {
					logger.error('Could not retrieve user: '+user+'. ',err);
				}
			});
		} else {
			bot.say(to, 'Command usage: ?alias <user>');
			bot.say(to, 'Shows <user>\'s aliases. Use ?users to list available users.');
		}
	}

	function tellBaseUsers(to){
		USERS.find().toArray(function(err, data){
			if(!err){
				if(data.length > 0){
					var users = [];
					data.forEach(function(entry){
						//Obscure the username with a randomly placed ':' in between to not trigger highlights
						users.push(util.obscure(entry.name, ':'));
					});
					bot.say(to, users.join(', '));
					bot.say(to, 'Ignore \':\' when using the username for other queries.');
				}
			} else {
				logger.error('Could not retrieve users. ',err);
			}
		});
	}

	function tellUptime(to){
		bot.say(to, 'I\'ve been slaving away for you shitty humans for '+moment(uptime).fromNow(true)+'.');
	}
});