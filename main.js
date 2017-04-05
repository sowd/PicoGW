// PicoGW = Minimalist's Home Gateway
const VERSION = 'v1' ;

// Support for termux
if( process.platform == 'android' )
	Object.defineProperty(process, "platform", { get: function () { return 'linux'; } });

var ctrl = require('./'+VERSION+'/controller.js') ;

ctrl.init(VERSION).then(re=>{
	console.log('PicoGW started.') ;
}).catch(console.error) ;
