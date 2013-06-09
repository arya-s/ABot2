exports.trim = function(str){
	//By http://blog.stevenlevithan.com/archives/faster-trim-javascript
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
};

exports.rnd = function(from, to){
	return Math.floor((Math.random()*to)+from);
};