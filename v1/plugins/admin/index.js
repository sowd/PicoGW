// Admin is a plugin, as well as a client.

var VERSION ;

var adminInterface ;
var log = console.log ;

var ipv4 = require('./ipv4.js');
var logger = require('./logger.js');

exports.init = function(ai,cmd_opts){
	adminInterface = ai ;
	log = adminInterface.log ;
	VERSION = cmd_opts.VERSION ;
	
	ipv4.setNetCallbackFunctions(
		function(newid,newip){
			for( var plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onNewIDFoundCallback != undefined )
					netIDCallbacks[plugin_name].onNewIDFoundCallback(newid,newip) ;
		}
		,function(id,lostip){
			for( var plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressLostCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressLostCallback(id,lostip) ;
		}
		,function(id,recoveredip){
			for( var plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressRecoveredCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressRecoveredCallback(id,recoveredip) ;
		}
		,function(id,oldip,newip){
			for( var plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressChangedCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressChangedCallback(id,oldip,newip) ;
		}
	) ;

	logger.start(adminInterface) ;
	// log(JSON.stringify(logger.schedule)) ;
	
	// Plugin must return (possibly in promise) procedure call callback function.
	// The signature is ( method , devid , propertyname , argument )
	return onProcCall ;
//	return ( method , devid , propertyname , argument) => 'Admin proc call: '+procname+'('+JSON.stringify(argument)+')' ;
} ;

// Returns promise
exports.getNetIDFromIPv4Address_Forward = function(ipv4addr) {
	return ipv4.getNetIDFromIPv4Address(ipv4addr) ;
}

// callbacks_obj can contain the following four members
// onNewIDFoundCallback			: function(newid,newip) ;
// onIPAddressLostCallback		: function(id,lostip) ;
// onIPAddressRecoveredCallback	: function(id,recoveredip) ;
// onIPAddressChangedCallback	: function(id,oldip,newip) ;
var netIDCallbacks = {} ;
exports.setNetIDCallbacks_Forward = function(plugin_name , callbacks_obj) {
	netIDCallbacks[plugin_name] = callbacks_obj ;
} ;

function onProcCall( method , devid , propname , args ){
	switch(method){
	case 'GET' :
		return onProcCall_Get( method , devid , propname , args ) ;
	case 'POST' :
		if(devid!='settings' || args == undefined)
			return {error:'The format is wrong for settings.'} ;
		if( args.schedule instanceof Array && logger.updateschedule(args.schedule) )
			return {success:true,message:'New schedule settings are successfully saved'} ;
		else
			return {error:'Error in saving scheduled logging'} ;
	}
	return {error:`The specified method ${method} is not implemented in admin plugin.`} ;
}

function onProcCall_Get( method , serviceid , propname , args ){
	if( serviceid == undefined ){	// access 'admin/' => service list
		var re = { log:{schedule:JSON.parse(JSON.stringify(logger.schedule))} , net:{} } ;
		var macs = ipv4.getmacs() ;
		for( var mac in macs )
			re.net[mac] = macs[mac].active ;

		if( args.option === 'true' ){
			re.log.option={leaf:false,doc:{short:'Scheduled logging function'}} ;
			re.net.option={leaf:false,doc:{short:'Mac address of recognized network peers'}} ;
		}
		return re ;
	}

	if( propname == undefined ){	// access 'admin/serviceid/' => property list
		var ret ;
		switch(serviceid){
			case 'log' :
				ret = {} ;
				logger.schedule.forEach(sentry=>{
					ret[sentry.name] = JSON.parse(JSON.stringify(sentry)) ;
					if( args.option === 'true' ){
						ret[sentry.name].option = {
							leaf:true
							,doc:{short:sentry.description}
						} ;
					}
				}) ;
				return ret ;
			case 'net' :
				var macs = ipv4.getmacs() ;
				//log(JSON.stringify(macs)) ;
				ret = {} ;
				for( var mac in macs ){
					var ipaddr = (macs[mac].log.length==0?null:macs[mac].log[0].ip) ;
					ret[mac] = {
						active:macs[mac].active
						,ip:ipaddr
						,localhost:macs[mac].localhost
					} ;
					if( args.option === 'true' ){
						ret[mac].option = {
							leaf:true
							,doc:{short:(ipaddr==null?'IP:null':ipaddr)}
						}
					}
				}
				return ret ;
		}
		return {error:'No such service:'+serviceid} ;
	}

	switch(serviceid){
		case 'log' :
			var sentry = logger.schedule.filter(sentry=>sentry.name==propname) ;
			if( sentry.length==0 )
				return {error:'No such schedule name:'+propname} ;
			return logger.getlog( sentry[0].path ) ;
		case 'net' :
			var m = ipv4.getmacs()[propname] ;
			if( m == undefined )
				return {error:'No such mac address:'+propname} ;
			return m ;
	}
	return {error:'No such service:'+serviceid} ;
}
