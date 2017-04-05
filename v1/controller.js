
"use strict";

var VERSION ;
const CALL_TIMEOUT = 60*1000 ;

var fs = require('fs');
var PubSub = require('./pubsub.js').PubSub;

var log = console.log ;
var admin ;



////////////////////////////////////////////////
////////////////////////////////////////////////
//  Plugin and Client interfaces

// Plugin context that is passed to each plugin constructor
class PluginContext {
	constructor ( prefix ) {
	    this.prefix = prefix;
	    this.log = (msg) => { log(`${this.prefix} plugin> ${msg}`); };

	    const LOCAL_STORAGE_PATH = this.getpath()+'localstorage.json' ;
	    this.localStorage = {
	    	clear : function(){ fs.writeFileSync(LOCAL_STORAGE_PATH,'{}') ;}
	    	, setItem : function(keyName,keyValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		st[keyName] = keyValue ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    	, getItem : function(keyName , defaultValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		return st[keyName] == undefined ? defaultValue : st[keyName] ;
	    	}
	    	, removeItem : function(keyName){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		delete st[keyName] ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    } ;
	}

	publish (devid, topicname, args) {
		PubSub.pub(`${this.prefix}/${devid}/${topicname}`,args) ;
	}

	// Returns promise
	getNetIDFromIPv4Address (ipv4addr) {
		if( this.prefix == 'admin')
			return Promise.reject('Cannot call getNetIDFromIPv4Address from admin plugin') ;
		return admin.getNetIDFromIPv4Address_Forward(ipv4addr) ;
	}

	// callbacks_obj can contain the following four members
	// onNewIDFoundCallback			: function(newid,newip) ;
	// onIPAddressLostCallback		: function(id,lostip) ;
	// onIPAddressRecoveredCallback	: function(id,recoveredip) ;
	// onIPAddressChangedCallback	: function(id,oldip,newip) ;
	setNetIDCallbacks (callbacks_obj) {
		admin.setNetIDCallbacks_Forward(this.prefix , callbacks_obj) ;
	}
	// Get plugin home dir
	getpath (){return `${VERSION}/plugins/${this.prefix}/`;}
} ;

// Client context that is passed to each client constructor
class ClientContext {
	constructor ( prefix ) {
	    this.prefix = prefix;
	    this.log = (msg) => { log(`${this.prefix} client> ${msg}`); };
	    this.subscriptions = {} ;

	    	    const LOCAL_STORAGE_PATH = this.getpath()+'localstorage.json' ;
	    this.localStorage = {
	    	clear : function(){ fs.writeFileSync(LOCAL_STORAGE_PATH,'{}') ;}
	    	, setItem : function(keyName,keyValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		st[keyName] = keyValue ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    	, getItem : function(keyName , defaultValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		return st[keyName] == undefined ? defaultValue : st[keyName] ;
	    	}
	    	, removeItem : function(keyName){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		delete st[keyName] ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    } ;
	}
	// method:	GET/PUT that go directly to the plugin
	callproc (method,procedure,argument){
		if(argument==undefined) argument='' ;
		var _args = argument.split('&') , args = {} ;
		_args.forEach(eq=>{
			var terms = eq.split('=');
			if( terms[0].trim().length==0) return ;
			args[terms[0]]=(terms.length==1?null:terms[1]);
		}) ;
		return new Promise( (ac,rj)=>{
			try {
				if( procedure.length == 0 ){ // access for '/smart/v1/' => plugin list
					var ps = {} ;
					for( var prfx in Plugins ){
						ps[prfx] = {
							path : Plugins[prfx].getpath()
							, callable: (typeof Plugins[prfx].procCallback == 'function')
						} ;
						if( args.option === 'true')
							ps[prfx].option = {leaf:false,doc:{short:'Plugin'}}
					}
					ac(ps) ;
					return ;
				}
				var terms = procedure.split('/') ;
				var pprefix = terms[0] , pdevid = terms[1] , ppropname = terms[2] ;
				if( pdevid != undefined && pdevid.length==0 )		pdevid = undefined ;
				if( ppropname != undefined && ppropname.length==0 )	ppropname = undefined ;
				if( terms.length > 3 && terms[3].length>0)	method = terms[3] ;

				var proccallback = Plugins[pprefix].procCallback ;
				if( typeof proccallback == 'function'){
					var bReplied = false ;
					Promise.all([proccallback(method.toUpperCase(),pdevid,ppropname,argument)])
						.then(re=>{ if( !bReplied ){ bReplied = true ; ac(re[0]); } })
						.catch(re=>{ if( !bReplied ){ bReplied = true ; rj(re[0]); } }) ;
					setTimeout(()=>{if( !bReplied ){ bReplied = true ; rj({error:`GET request timeout:${pdevid}/${ppropname}`})}},CALL_TIMEOUT) ;
				} else rj('Procedure callback is not defined for the plugin '+pprefix) ;
			} catch(e){
				rj('Invalidly formatted procedure: ' + procedure);
			} ;
		}) ;
	}
	subscribe (topicname,callback){
		if( this.subscriptions[topicname] == undefined )
			this.subscriptions[topicname] = [] ;
		if( this.subscriptions[topicname].indexOf(callback)>=0 )
			return ;	// Cannot subscribe multiple times
		PubSub.sub(topicname,callback) ;
		this.subscriptions[topicname].push(callback) ;
	}
	unsubscribe (topicname,callback){
		PubSub.unsub(topicname,callback) ;
		if( this.subscriptions[topicname] == undefined
			|| this.subscriptions[topicname].indexOf(callback) < 0 )
			return ;	// Should never happen
		this.subscriptions[topicname]
			= this.subscriptions[topicname].filter(f=>f!=callback) ;
		if( this.subscriptions[topicname].length == 0)
			delete this.subscriptions[topicname] ;
	}
	// Topicname can be undefined to remove all subscriptions of this client.
	unsubscribeall (topicname){
		if( topicname == undefined ){
			for( var tn in this.subscriptions )
				for( var cb in this.subscriptions[tn] )
					PubSub.unsub(tn,cb) ;
			this.subscriptions = {} ;
		} else {
			for( var cb in this.subscriptions[topicname] )
				PubSub.unsub(topicname,cb) ;
			delete this.subscriptions[topicname] ;
		}
	}
	// Get client home dir
	getpath (){return `${VERSION}/clients/${this.prefix}/`;}
	get_expanded_paths_from_regexp_path(regexp_path){
		var _this = this ;
		return new Promise((accept,reject)=>{
				var pcand = [''] ;
				var ps = regexp_path.split('/') ;

				function calcpcand(){
					if(ps.length==0 || pcand.length == 0){
						accept(pcand) ;
						return ;
					}
					var pterm = ps.shift() ;
					var _pcand = [] ;
					Promise.all(
						pcand.map(pcand_e=> new Promise((ac,rj)=>{
							_this.callproc('GET',pcand_e).then(dir_contents=>{
								for( var f in dir_contents){
									if( f.match(new RegExp(`^${pterm}$`))){
										_pcand.push(pcand_e==''?f:pcand_e+'/'+f) ;
									}
								}
								ac() ;
							}).catch(ac) ;
						}))
					).then(()=>{
						pcand = _pcand ;
						calcpcand() ;
					})
				}
				calcpcand() ;
		}) ;
	}
} ;




// Main logic
var Plugins = {} , Clients = {} ;
exports.init = function(_VERSION){
	VERSION = _VERSION ;

	return Promise.all([
		new Promise( (ac,rj)=>{
			// Scan plugins
			const PLUGINS_FOLDER = './'+VERSION+'/plugins/' ;
			try {
				// Setup admin plugin first
				fs.statSync( PLUGINS_FOLDER ) ;
				fs.readdir(PLUGINS_FOLDER, (err, files) => {
					if (err){ rj('No plugin folder found.'); return; }

					var plugin_names = ['admin'] ;
					files.filter(dirname => {
						return fs.lstatSync(PLUGINS_FOLDER + dirname).isDirectory();
					}).forEach(dirname => {
						if( dirname == 'admin') return ;
						plugin_names.push(dirname) ;
			   	 	}) ;
			   	 	log('Plugins registeration started.') ;
			   	 	function registerplugin(){
			   	 		var plugin_name = plugin_names.shift() ;
						var pc = new PluginContext(plugin_name) ;
						var exportmethods = {} ;
						[ 'publish','log','getNetIDFromIPv4Address','setNetIDCallbacks','getpath']
							.forEach(methodname => {
							exportmethods[methodname] = function(){
								return pc[methodname].apply(pc,arguments);
							} ;
						}) ;
						exportmethods.localStorage = pc.localStorage ;

						if( plugin_name === 'admin' ){	// Admin plugin can work also as a client.
							var ci = new ClientContext(plugin_name) ;
							['callproc','subscribe','unsubscribe','unsubscribeall','log'
							,'get_expanded_paths_from_regexp_path'].forEach(methodname => {
								exportmethods[methodname] = function(){
									return ci[methodname].apply(ci,arguments);
								} ;
							}) ;
						}
						try {
							var pobj = require('./plugins/' + plugin_name + '/index.js') ;
							// Plugin init must return procedure call callback function.
							Promise.all([pobj.init(exportmethods,VERSION)]).then( p => {
								pc.procCallback = p[0] ;

								Plugins[plugin_name] = pc ;
								if( plugin_name === 'admin' )	admin = pobj ;
								log(plugin_name+' plugin initiaized') ;
					   	 		if( plugin_names.length == 0 ){ac('All plugins initialization process is ended.'); return;}
					   	 		registerplugin() ;
							}).catch(e=>{
								log(plugin_name+' plugin could not be initiaized') ;
					   	 		if( plugin_names.length == 0 ){ac('All plugins initialization process is ended.'); return;}
					   	 		registerplugin() ;
							}) ;

						} catch (e){log('Error in initializing '+plugin_name+' plugin: '+JSON.stringify(e)) ;}
					}
		   	 		registerplugin() ;
				}) ;
			} catch(e){
				rj('No plugins exists.') ;
			}
		}) , new Promise( (ac,rj)=>{
			// Scan Clients
			const CLIENTS_FOLDER = './'+VERSION+'/clients/' ;
			try {
				fs.statSync( CLIENTS_FOLDER ) ;
				fs.readdir( CLIENTS_FOLDER, (err, files) => {
					if (err){ rj('No clients folder found.'); return; }

					var client_names = [] ;
					files.filter(dirname => {
						return fs.lstatSync(CLIENTS_FOLDER + dirname).isDirectory();
					}).forEach(dirname => {
						client_names.push(dirname) ;
					}) ;
			   	 	log('Clients registration started.') ;
			   	 	function registerclient(){
			   	 		var client_name = client_names.shift() ;
						var ci = new ClientContext(client_name) ;
						var exportmethods = {} ;
						['callproc','subscribe','unsubscribe','unsubscribeall','log','getpath'
						,'get_expanded_paths_from_regexp_path'].forEach(methodname => {
							exportmethods[methodname] = function(){
								return ci[methodname].apply(ci,arguments);
							} ;
						}) ;
						exportmethods.localStorage = ci.localStorage ;
						try {
							Promise.all([require('./clients/' + client_name + '/index.js').init(exportmethods,VERSION)]).then(()=>{
								Clients[client_name] = ci ;
								log(client_name+' client initiaized') ;
								if( client_names.length == 0 ){ac('All client initialization process is ended.'); return;}
					   	 		registerclient() ;
							}).catch(e=>{
								log(client_name+' client could not initiaize') ;
								if( client_names.length == 0 ){ac('All client initialization process is ended.'); return;}
					   	 		registerclient() ;
							}) ;
						} catch (e){log('Error in initializing '+client_name+' client: '+JSON.stringify(e)) ;}
					}
					registerclient() ;
				}) ;
			} catch(e){
				rj('No Clients exists.') ;
			}
		})
	]) ;
} ;
