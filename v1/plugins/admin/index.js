let pluginInterface ;
let log = console.log ;
let localStorage ;
let ipv4 = require('./ipv4.js');
let cryptico = require('cryptico');
let sudo = require('sudo');

var fs = require('fs');
const exec = require('child_process').exec;

const NMCLI_CONNECTION_NAME = 'picogw_conn' ;

const RSA_BITS = 1024 ;
let rsaKey , pubKey ;

exports.init = function(pi){
	pluginInterface = pi ;
	log = pluginInterface.log ;
	localStorage = pluginInterface.localStorage ;
	
	ipv4.setNetCallbackFunctions(
		function(newid,newip){
			for( let plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onNewIDFoundCallback != undefined )
					netIDCallbacks[plugin_name].onNewIDFoundCallback(newid,newip) ;
		}
		,function(id,lostip){
			for( let plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressLostCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressLostCallback(id,lostip) ;
		}
		,function(id,recoveredip){
			for( let plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressRecoveredCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressRecoveredCallback(id,recoveredip) ;
		}
		,function(id,oldip,newip){
			for( let plugin_name in netIDCallbacks )
				if( netIDCallbacks[plugin_name].onIPAddressChangedCallback != undefined )
					netIDCallbacks[plugin_name].onIPAddressChangedCallback(id,oldip,newip) ;
		}
	) ;

	pluginInterface.setOnGetSettingsSchemaCallback( function(){
   		return new Promise((ac,rj)=>{
			exec('nmcli d', (err, stdout, stderr) => {
			  let lines = stdout.split("\n") ;
			  if( err || lines.length<2 ){
			  	ac({error:'nmcli should be installed first. Execute\n\n'
			  		+'$ sudo apt-get install network-manager\n\nor\n\n$ sudo yum install NetworkManager'}) ;
			  	return ;
			  }
			  lines.shift() ;
			  if( lines.length==0 ){ ac({error:'No network available.'}) ; return ; }

			  try {
			  	var schema_json = JSON.parse(fs.readFileSync(pluginInterface.getpath()+'settings_schema.json').toString()) ;
				lines.forEach( line=>{
				  	let sp = line.trim().split(/\s+/) ;
				  	if( sp.length !=4 || sp[0]=='lo') return ;	// Illegally formatted line
				  	schema_json.properties.interface.enum.push(sp[0]) ;
				}) ;

				if( schema_json.properties.interface.enum.length==0 ){ ac({error:'No network available.'}) ; return ; }
		   			ac( schema_json ) ;
		   	  } catch(e){ac({error:'Illigally formatted admin/settings_schema.json'});} 
			});

		}) ;
	}) ;

	pluginInterface.setOnSettingsUpdatedCallback( function(newSettings){
		return new Promise((ac,rj)=>{
			let root_pwd = newSettings.root_passwd ;
			newSettings.root_passwd = '' ;

			let commands = [] ;
			// Delete connection (may fail for first time)
			commands.push(['nmcli','connection','delete',NMCLI_CONNECTION_NAME]) ;

			if( newSettings.type == 'DHCP' ){
				commands.push(['nmcli','connection','add','con-name',NMCLI_CONNECTION_NAME
				 ,'type','ethernet','ifname', newSettings.interface]) ;
				commands.push(['nmcli','connection','modify',NMCLI_CONNECTION_NAME
				 ,'ipv4.method','auto']) ;
			} else {	// static ip
				commands.push(['nmcli','connection','add','con-name',NMCLI_CONNECTION_NAME
				,'type','ethernet','ifname', newSettings.interface]) ;

				if( newSettings.default_gateway == undefined )	newSettings.default_gateway = '' ;
				let ipSetting = (newSettings.ip+' '+newSettings.default_gateway).trim() ;
				commands.push(['nmcli','connection','modify',NMCLI_CONNECTION_NAME
					,'ipv4.method','manual','ipv4.addresses',ipSetting]) ;
			}

			commands.push(['nmcli','connection','down', NMCLI_CONNECTION_NAME]) ;
			commands.push(['nmcli','connection','up'  , NMCLI_CONNECTION_NAME]) ;

			function ex(){
				if( commands.length==0 ) return ;
				let cmd = commands.shift() ;
				log('Exec:'+cmd.join(" ")) ;
				let child = sudo(cmd,{password:root_pwd}) ;
				child.stderr.on('data',dat=>{
					if( cmd[2] == 'delete' || cmd[2] == 'down' /*|| cmd[2] == 'up'*/ ) return ;
					console.error('Error in executing\n$ '+cmd.join(' ')+'\n'+dat.toString()) ;
					rj('Error in executing\n\n$ '+cmd.join(' ')+'\n\n'+dat.toString()) ;	// Interrupt execution
					commands = [] ;
				}) ;
				child.stdout.on('close',()=>{
					if( commands.length == 0 ) ac() ;
					else ex() ;
				}) ;
			}
			ex() ;
		}) ;
	}) ;

	// Plugin must return (possibly in promise) procedure call callback function.
	// The signature is ( method , devid , propertyname , argument )
	return onProcCall;
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
	/*case 'POST' :
		if(devid!='settings' || args == undefined)
			return {error:'The format is wrong for settings.'} ;
		if( args.schedule instanceof Array && logger.updateschedule(args.schedule) )
			return {success:true,message:'New schedule settings are successfully saved'} ;
		else
			return {error:'Error in saving scheduled logging'} ;*/
	}
	return {error:`The specified method ${method} is not implemented in admin plugin.`} ;
}

function onProcCall_Get( method , serviceid , propname , args ){
	if( serviceid == undefined ){	// access 'admin/' => service list
		var re = { net:{} } ;
		var macs = ipv4.getmacs() ;
		for( var mac in macs )
			re.net[mac] = macs[mac].active ;

		if( args.option === 'true' )
			re.net.option={leaf:false,doc:{short:'Mac address of recognized network peers'}} ;

		return re ;
	}

	if( propname == undefined ){	// access 'admin/serviceid/' => property list
		var ret ;
		switch(serviceid){
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
		case 'net' :
			var m = ipv4.getmacs()[propname] ;
			if( m == undefined )
				return {error:'No such mac address:'+propname} ;
			return m ;
	}
	return {error:'No such service:'+serviceid} ;
}
