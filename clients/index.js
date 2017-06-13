// clients/index.js
var fs = require('fs');

var ClientInterface = require('./ClientInterface.js').ClientInterface ;
var globals ;

var log = msg=>{console.log('client manager> '+msg);} ;

exports.clientFactory = function(client_name){
	var ci = new ClientInterface(globals) ;
	var exportmethods = {} ;
		['callproc','subscribe','unsubscribe','unsubscribeall','log'].forEach(methodname => {
		exportmethods[methodname] = function(){
			return ci[methodname].apply(ci,arguments);
		} ;
	}) ;
	if(client_name==undefined){ return ci ; }
	return new Promise( (ac,rj)=>{
		try {
			var cobj = require('./' + client_name + '/index.js') ;
			// Plugin init must return procedure call callback function.
			Promise.all([cobj.init(exportmethods,globals)]).then( p => {
				log(client_name+' client initiaized') ;
				ac(ci) ;
			}).catch(e=>{
				log(client_name+' client could not be initiaized') ;
				ac({error:'Client '+client_name+' could not be initiaized'}) ;	// Anyway accept
			}) ;

		} catch (e){
			log('Error in initializing '+client_name+' client: '+JSON.stringify(e)) ;
			ac({error:'Client '+client_name+' could not be initiaized'}) ;	// Anyway accept
		}
	} ) ;
} ;

// globals: Plugins,VERSIONS,VERSION_CTRLS,CALL_TIMEOUT,cmd_opts
exports.init = function(_globals){
	if( globals != undefined )
		return Promise.reject('clients.init cannot be called multiple times.') ;
	globals = _globals ;
	return new Promise( (ac,rj)=>{
		// Scan clients
		try {
			fs.readdir( './clients/', (err, files) => {
				if (err){ rj('No clients found.'); return; }

				Promise.all(
					files.filter(dirname => {
						return fs.lstatSync('./clients/' + dirname).isDirectory();
					}).map(dirname=>{return exports.clientFactory(dirname);})
				).then(ac).catch(rj) ;
			}) ;
		} catch(e){
			rj('Error in initializing client(s).') ;
		}
	} ) ;
} ;
