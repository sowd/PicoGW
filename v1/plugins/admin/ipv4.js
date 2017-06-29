// There are two ways to find hosts.
// One is looking into arp table and the other is using protocol-specific discovery (usually by UDP-multicasting)
// Since we use mac address as id of hosts, we eventually need to look into arp table.
// Therefore, we allow each plugin to report newly-found ip address using the protocol,
// which are then pinged to determine the mac address, and sent back to the plugin.

// Todo: what happens if myself is disconnected?

const CHECK_ARP_TABLE_INTERVAL = 2000 ;
/*Ping for alive check*/
const PING_INTERVAL = 10*1000 , PING_RANDOM_RANGE = 2*1000 , PING_TIMEOUT_IN_SEC = 7 ;
const COMPLETE_IP_SCAN = false ;



const GET_MAC_FROM_IPv4_ADDRESS_TIMEOUT = CHECK_ARP_TABLE_INTERVAL + PING_TIMEOUT_IN_SEC*1000 ;

var arped = require('arped');
var ping = require('ping');

var ipmask = require('ipmask') ;
var mynetinfo = ipmask() ;	// updated on all ping timing
console.log('Network info:'+JSON.stringify(mynetinfo)) ;

// ID == mac address
var onIPMacFoundCallback = {} ;
exports.getNetIDFromIPv4Address = function(ip){
	return new Promise((ac,rj)=>{
		for( var mac in macs){
			if( macs[mac].log[0].ip === ip ){
				ac(mac) ;
				return ;
			}
		}
		if( ip == mynetinfo.address ){
			ac(mynetinfo.mac) ;
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

exports.getmacs = ()=>macs ;


//////////////////////////////////////////////
//////////////////////////////////////////////
//  Check arp table and update macs
var macs = {} ;
macs[mynetinfo.mac] = {active:true, localhost:true, log: [ {ip:mynetinfo.address,timestamp:Date.now()} ]} ;

var arptxt = '' ;
function chkArpTable(){
 	var newtxt = arped.table().trim() ;

	if( arptxt == newtxt){
		// Register all known ips again for ping.
		for( mac in macs )
			ping_ips[macs[mac].log[0].ip] = mac ;
		return ;
	}

	// arp table is changed (only flags can change, which is not reflected to parsed object)
	//console.log('Old table:'+arptxt) ;
	//console.log('New table:'+newtxt) ;

	arptxt = newtxt ;
	var newobj = arped.parse(arptxt) ;
	//console.log('New table object:'+JSON.stringify(newobj)) ;

	// Register new mac address and corresponding IP
	var net,mac,peer ;
	for( net in newobj.Devices ) for( mac in newobj.Devices[net].MACs ){
		if( mac === '00:00:00:00:00:00' ) continue ;
		// console.log('Mac:'+mac) ;
		var newip = newobj.Devices[net].MACs[mac].trim() ;
		if( macs[mac] == undefined ){
			// New mac address found (active=true because newly-found host is probably active)
			macs[mac] = { active:true , log: [ {ip:newip,timestamp:Date.now()} ] };
			console.log( mac+'/'+newip+' newly found.' ) ;
			onNewIDFoundCallback( mac , newip ) ;
		} else {
			// Existing mac address re-found
			peer = macs[mac] ;
			var curip = peer.log[0].ip ;
			if( curip != newip ){
				// IP address changed
				peer.log.unshift({ip:newip,timestamp:Date.now()}) ;
				console.log( mac+' changed IP address from '+curip+' to '+newip ) ;
				onIPAddressChangedCallback( mac , curip , newip ) ;
			}
		}

		if( onIPMacFoundCallback[newip] != undefined ){
			onIPMacFoundCallback[newip].forEach(cb=>cb(mac)) ;
			delete onIPMacFoundCallback[newip] ;
		}
	}

	// Register all known ips for ping.
	for( mac in macs )
		ping_ips[macs[mac].log[0].ip] = mac ;
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
		mynetinfo = ipmask();
		if( macs[mynetinfo.mac].log[0].ip == mynetinfo.address )
			macs[mynetinfo.mac].log[0].timestamp = Date.now() ;
		else
			macs[mynetinfo.mac].log.unshift( {ip:mynetinfo.address,timestamp:Date.now()} ) ;

		var mask = 0 , subnet = 0 ;
		mynetinfo.netmask.split('.').forEach( b => {
			mask = mask*256 + parseInt(b) ;
		} ) ;
		mynetinfo.address.split('.').forEach( b => {
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

			if( ping_ips_copy[ip] == undefined && ip != mynetinfo.address )
				ping_ips_copy[ip] = null ;
		}
	}

	for( var _ip in ping_ips_copy ){
		(function(){
			var ip = _ip ;
			var mac = ping_ips_copy[ip] ;
			setTimeout(()=>{
				//console.log('Pinging to '+ip+'...') ;
				ping.sys.probe(ip, function(isActive){
					//console.log('Ping reply from '+ip+' : '+(isActive?'active':'inactive')) ;
					if( mac == null					// ping only
					 || ip != macs[mac].log[0].ip	// ip address updated by arp table. the old ip can address different mac
					) return ;
					if( macs[mac].active != isActive ){
						if( isActive ){
							console.log(mac+'/'+ip+' appeared') ;
							onIPAddressRecoveredCallback( mac , ip ) ;
						} else {
							console.log(mac+'/'+ip+' disappeared') ;
							onIPAddressLostCallback( mac , ip ) ;
						}
						macs[mac].active = isActive ;
					}
				}, {timeout:PING_TIMEOUT_IN_SEC} ) ;
			}, parseInt(PING_RANDOM_RANGE * Math.random())) ;
		})();
	}

	setTimeout(ping_all,PING_INTERVAL) ;
}

setInterval(chkArpTable,CHECK_ARP_TABLE_INTERVAL) ;
ping_all() ;