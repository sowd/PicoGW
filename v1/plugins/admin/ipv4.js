// There are two ways to find hosts.
// One is looking into arp table and the other is using protocol-specific discovery (usually by UDP-multicasting)
// Since we use mac address as id of hosts, we eventually need to look into arp table.
// Therefore, we allow each plugin to report newly-found ip address using the protocol,
// which are then pinged to determine the mac address, and sent back to the plugin.

// Todo: what happens if myself is disconnected?

const CHECK_ARP_TABLE_INTERVAL = 60*1000 ;
/*Ping for alive check*/
const PING_INTERVAL = 10*1000 , PING_RANDOM_RANGE = 2*1000 , PING_TIMEOUT_IN_SEC = 7 ;
const COMPLETE_IP_SCAN = false ;



const GET_MAC_FROM_IPv4_ADDRESS_TIMEOUT = CHECK_ARP_TABLE_INTERVAL + PING_TIMEOUT_IN_SEC*1000 ;

var arped = require('arped');
var ping = require('ping');
var os = require('os');

// ID == mac address
var onIPMacFoundCallback = {} ;
exports.getNetIDFromIPv4Address = function(ip){
	return new Promise((ac,rj)=>{
		chkArpTable() ;
		for( const iface of mynetinfo ){
			if( iface.address == ip ){
				ac(iface.mac) ;
				return ;
			}
		}
		var candidate ;
		// Prioritize active macs.
		for( var mac in macs){
			if( macs[mac].log[0].ip === ip ){
				if( macs[mac].active ){
					ac(mac) ;
					return ;
				}
				candidate = mac ;
			}
		}
		// return inactive mac
		if( candidate != undefined ){
			ac( candidate ) ;
			return ;
		}
		// Not found.
		if( onIPMacFoundCallback[ip] == undefined )
			onIPMacFoundCallback[ip] = [] ;
		// Wait until mac address is found.
		onIPMacFoundCallback[ip].push( ac ) ;
		ping.sys.probe(ip, function(isActive){}) ;	// take mac to arp table

		// Timeout setting
		setTimeout( ()=>{
			if( onIPMacFoundCallback[ip] == undefined ) return ;	// already accepted.
			var i = onIPMacFoundCallback[ip].indexOf(ac) ;
			if( i!=-1 )	onIPMacFoundCallback[ip].splice(i,1) ;
			rj() ;
		},GET_MAC_FROM_IPv4_ADDRESS_TIMEOUT) ;
	}) ;
} ;

var onNewIDFoundCallback			= function(newid,newip){} ;
var onIPAddressLostCallback			= function(id,lostip){} ;
var onIPAddressRecoveredCallback	= function(id,recoveredip){} ;
var onIPAddressChangedCallback		= function(id,oldip,newip){} ;
exports.setNetCallbackFunctions = function(
		 _onNewIDFoundCallback
		,_onIPAddressLostCallback
		,_onIPAddressRecoveredCallback
		,_onIPAddressChangedCallback ){
		if( _onNewIDFoundCallback != undefined )
			onNewIDFoundCallback			= _onNewIDFoundCallback ;
		if( _onIPAddressLostCallback != undefined )
			onIPAddressLostCallback			= _onIPAddressLostCallback ;
		if( _onIPAddressRecoveredCallback != undefined )
			onIPAddressRecoveredCallback	= _onIPAddressRecoveredCallback ;
		if( _onIPAddressChangedCallback != undefined )
			onIPAddressChangedCallback		= _onIPAddressChangedCallback ;
} ;

//////////////////////////////////////////////
//////////////////////////////////////////////
//  Return my network interfaces
function myAddresses(){
	let ifaces = os.networkInterfaces() ;
	let ret = [] ;
	for( const i in ifaces ){
		ret = ret.concat(ifaces[i].filter(e => {
			return (e.family === 'IPv4' && e.internal === false);
		})) ;
	}
	return ret ;
}
exports.refreshMyAddress = ()=>{
	mynetinfo = myAddresses() ;	// updated on all ping timing
	for( const iface of mynetinfo ){
		if( macs[iface.mac].log[0].ip == iface.address )
			macs[iface.mac].log[0].timestamp = Date.now() ;
		else {
			let oldip = macs[iface.mac].log[0].ip ;
			macs[iface.mac].log.unshift( {ip:iface.address,timestamp:Date.now()} ) ;
			onIPAddressChangedCallback( iface.mac , oldip , iface.address ) ;

		}
	}
}

var mynetinfo = myAddresses() ;	// updated on all ping timing
console.log('Network info:'+JSON.stringify(mynetinfo)) ;


//////////////////////////////////////////////
//////////////////////////////////////////////
//  Check arp table and update macs
var macs = {} ;
exports.getmacs = ()=>macs ;

for( const iface of mynetinfo ){
	macs[iface.mac] = {active:true, localhost:true, log: [ {ip:iface.address,timestamp:Date.now()} ]} ;
}
var d = 0 ;
function deactivatemacbyip(ip){
	var prev_actives = [] ;
	for( let mac in macs ){
		if( macs[mac].log[0].ip == ip ){
			if( macs[mac].active )
				prev_actives.push(mac) ;
			macs[mac].active = false ;
		}
	}
	return prev_actives ;
}


var arptxt = '' ;
function chkArpTable(){
	// console.log('Checking arp table..') ;
	try {
	 	var newtxt = arped.table().trim() ;

		if( arptxt == newtxt){
			// Register all known ips again for ping.
			for( mac in macs )
				ping_ips[macs[mac].log[0].ip] = mac ;
			//console.log('Not updated.') ;
			return ;
		}

		// arp table is changed (only flags can change, which is not reflected to parsed object)
		//console.log('Old table:'+arptxt) ;
		//console.log('New table:'+newtxt) ;

		arptxt = newtxt ;
		var newobj = arped.parse(arptxt) ;
		//console.log('New table object:'+JSON.stringify(newobj,null,"\t")) ;

		// Register new mac address and corresponding IP
		var net,mac,peer ;
		for( net in newobj.Devices ) for( mac in newobj.Devices[net].MACs ){
			if( mac === '00:00:00:00:00:00' ) continue ;
			// console.log('Mac:'+mac) ;
			var newip = newobj.Devices[net].MACs[mac].trim() ;
			prev_actives = deactivatemacbyip(newip) ;
			if( macs[mac] == undefined ){
				// New mac address found (active=true because newly-found host is probably active)
				macs[mac] = { active:true , log: [ {ip:newip,timestamp:Date.now()} ] };
				console.log( mac+'/'+newip+' newly found.' ) ;
				onNewIDFoundCallback( mac , newip ) ;
			} else {
				// Existing mac address re-found
				peer = macs[mac] ;
				peer.active = true ;
				var curip = peer.log[0].ip ;
				if( curip != newip ){
					// IP address changed
					peer.log.unshift({ip:newip,timestamp:Date.now()}) ;
					console.log( mac+' changed IP address from '+curip+' to '+newip ) ;
					onIPAddressChangedCallback( mac , curip , newip ) ;
				} else if( prev_actives.indexOf(mac) == -1 ){ // Re-found
					console.log(mac+'/'+curip+' re-appeared') ;
					onIPAddressRecoveredCallback( mac , curip ) ;
				} else { //  already active.
					prev_actives.splice(prev_actives.indexOf(mac),1) ;
				}
			}

			prev_actives.forEach(deactivated_mac=>{
				onIPAddressLostCallback( deactivated_mac , curip ) ;
				console.log(deactivated_mac+'/'+curip+' disappeared') ;
			}) ;

			if( onIPMacFoundCallback[newip] != undefined ){
				onIPMacFoundCallback[newip].forEach(cb=>cb(mac)) ;
				delete onIPMacFoundCallback[newip] ;
			}
		}

		// Register all known ips for ping.
		for( mac in macs )
			ping_ips[macs[mac].log[0].ip] = mac ;
	} catch(e){
		console.error('Error in reading arp table:') ;
		console.error(e) ;
	}
	//console.log('Updated.') ;
} ;


//////////////////////////////////////////////
//////////////////////////////////////////////
//  Ping all known IPs
var ping_ips = {} ;
function ping_all(){
	//console.log('ping_all start:'+JSON.stringify(ping_ips)) ;
	var ping_ips_copy = ping_ips ;
	ping_ips = {} ;

	if( COMPLETE_IP_SCAN ){
		// add unknown ip address to ping list
		//mynetinfo = myAddresses() ;
		exports.refreshMyAddress() ;
		for( const iface of mynetinfo ){
			/*if( macs[iface.mac].log[0].ip == iface.address )
				macs[iface.mac].log[0].timestamp = Date.now() ;
			else
				macs[iface.mac].log.unshift( {ip:iface.address,timestamp:Date.now()} ) ;*/

			var mask = 0 , subnet = 0 ;
			iface.netmask.split('.').forEach( b => {
				mask = mask*256 + parseInt(b) ;
			} ) ;
			iface.address.split('.').forEach( b => {
				subnet = subnet*256 + parseInt(b) ;
			} ) ;
			subnet = subnet & mask ;

			while(mask!=0x100000000) {
				var ip = ((subnet >>24) & 0xFF)
					+ '.'+((subnet >> 16) & 0xFF)
					+ '.'+((subnet >> 8) & 0xFF)
					+ '.'+ (subnet & 0xFF) ;
				++subnet ;
				++mask ;

				if( ping_ips_copy[ip] == undefined && ip != iface.address )
					ping_ips_copy[ip] = null ;
			}
		}
	}

	for( let ip in ping_ips_copy ){
		setTimeout(()=>{
			//console.log('Pinging to '+ip+'...') ;
			try {
				ping.sys.probe(ip, function(isActive){}, {timeout:PING_TIMEOUT_IN_SEC} ) ;
			} catch(e){
				console.log('Failed to ping, ignoring error. ' + ip);
				console.log(e);
			}
		}, parseInt(PING_RANDOM_RANGE * Math.random())) ;
	}

	setTimeout(ping_all,PING_INTERVAL) ;
}

setInterval(
	()=>{
		exports.refreshMyAddress();
		chkArpTable();
	}
	,CHECK_ARP_TABLE_INTERVAL
) ;
ping_all() ;