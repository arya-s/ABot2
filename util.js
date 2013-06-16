exports.trim = function(str){
	//By http://blog.stevenlevithan.com/archives/faster-trim-javascript
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
};

exports.rnd = function(from, to){
	return Math.floor((Math.random()*to)+from);
};

exports.obscure = function(in, op){
	var obscurePosition = this.rnd(1, in.length-1);
	return [in.slice(0, obscurePosition), op, in.slice(obscurePosition)].join('');
};