var fs = require('fs');
exports.init = function(ci,cmd_opts){
	var prefix = ci.getpath() ;
	if (fs.existsSync(prefix+'custom') && fs.statSync(prefix+'custom').isDirectory())
		require('./custom/index.js').init(ci,cmd_opts) ;
	else
		require('./default/index.js').init(ci,cmd_opts) ;
} ;