// Client interface that is passed to each client constructor
"use strict";
var fs = require('fs');

var globals = {} ;	// VERSION, PubSub, Plugins, CALL_TIMEOUT

exports.ClientInterface = class {
	constructor ( _globals,prefix ) {
	    this.prefix = prefix;
	    globals = _globals ;

	    this.log = (msg) => { console.log(`${this.prefix} client> ${msg}`); };
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
	callproc (method,procedure,args){
		if( procedure.indexOf(`/${globals.VERSION}/`) != 0 )
			return Promise.reject('Version mismatch: ' + procedure) ;
		procedure = procedure.slice(`/${globals.VERSION}/`.length) ;
		if(args==undefined) args={} ;

		return new Promise( (ac,rj)=>{
			try {
				if( procedure.length == 0 ){ // access for '/v1/' => plugin list
					var ps = {} ;
					for( var prfx in globals.Plugins ){
						ps[prfx] = {
							path : globals.Plugins[prfx].getpath()
							, callable: (typeof globals.Plugins[prfx].procCallback == 'function')
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
				var proccallback = globals.Plugins[pprefix].procCallback ;
				if( typeof proccallback == 'function'){
					var bReplied = false ;
					Promise.all([proccallback(method.toUpperCase(),pdevid,ppropname,args)])
						.then(re=>{
						 if( !bReplied ){ bReplied = true ; ac(re[0]); }
						})
						.catch(re=>{ if( !bReplied ){ bReplied = true ; rj(re[0]); } }) ;
					setTimeout(()=>{if( !bReplied ){ bReplied = true ; rj({error:`GET request timeout:${pdevid}/${ppropname}`})}},globals.CALL_TIMEOUT) ;
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
		globals.PubSub.sub(topicname,callback) ;
		this.subscriptions[topicname].push(callback) ;
	}
	unsubscribe (topicname,callback){
		globals.PubSub.unsub(topicname,callback) ;
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
					globals.PubSub.unsub(tn,cb) ;
			this.subscriptions = {} ;
		} else {
			for( var cb in this.subscriptions[topicname] )
				globals.PubSub.unsub(topicname,cb) ;
			delete this.subscriptions[topicname] ;
		}
	}
	// Get client home dir
	getpath (){return `${globals.VERSION}/clients/${this.prefix}/`;}
} ;
