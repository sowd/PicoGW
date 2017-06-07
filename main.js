// PicoGW = Minimalist's Home Gateway
var fs = require('fs');

const VERSIONS = ['v1','v2'] ;
var VERSION_CTRLS = {} ;	// Stores controller objects
var log = console.log ;

// Support for termux
if( process.platform == 'android' )
	Object.defineProperty(process, "platform", { get: function () { return 'linux'; } });

// Parse command line
var cmd_opts = require('opts');
cmd_opts.parse([
    {
        'short': 'p',
        'long': 'port',
        'description': 'Web API port number',
        'value': true,
        'required': false
    },
    {
        'long': 'pipe',
        'description': 'path of named pipes without postfix (_r or _w). The server is blocked until the pipe client is connected.',
        'value': true,
        'required': false
    },
],true);

// Initialize each versions and store controller objects into VERSION_CTRLS
VERSIONS.forEach(VERSION=>{
	var ctrl = require('./'+VERSION+'/controller.js') ;
	ctrl.init(cmd_opts).then(re=>{
		log('API version '+VERSION+' initialized.') ;
	}).catch(console.error) ;
	VERSION_CTRLS[VERSION] = ctrl ;
}) ;

// Start client
var CLIENT_PATH = './client/custom';
try {
	fs.statSync(CLIENT_PATH) ;
} catch(e){CLIENT_PATH = './client/default';}

const client = require(CLIENT_PATH+'/index.js') ;
client.init(
	{
		VERSIONS:VERSIONS
		,VERSION_CTRLS:VERSION_CTRLS
		,CLIENT_PATH:CLIENT_PATH
	},cmd_opts) ;

console.log('PicoGW started.') ;

