// clients/index.js
var fs = require('fs');
let cryptico = require('cryptico');
const RSA_BITS = 1024 ;

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
	if(client_name==undefined){ return Promise.resolve(ci) ; }
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

	// Generate RSA key
	return new Promise( (ac,rj)=>{
		const KEY_PATH = './clients/.key' ;
		fs.readFile(KEY_PATH,'utf8',(err,data)=>{
			let passPhrase ;
			if( err ){
				const randStrSrc='abcdefghijklmnopqrstuvxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
				passPhrase = '' ;
				for( let i=0;i<100;++i ) passPhrase += randStrSrc[parseInt(Math.random()*randStrSrc.length)] ;
				fs.writeFileSync(KEY_PATH,passPhrase) ;
			} else passPhrase = data ;

			log('Generating RSA key..') ;
			let rsaKey = cryptico.generateRSAKey(passPhrase, RSA_BITS) ;
			let pubKey = cryptico.publicKeyString(rsaKey) ;

			log('RSA key generated.') ;

			globals.getPubKey = ()=>pubKey ;
			globals.encrypt = srcStr => cryptico.encrypt( srcStr, pubKey ).cipher;
			globals.decrypt = srcStr => cryptico.decrypt( srcStr, rsaKey ).plaintext;

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

		}) ;

	} ) ;
} ;
