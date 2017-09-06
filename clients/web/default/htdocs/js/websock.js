// Websocket connection
/*
Initialize:
	connectws( function(picogw){	// Initialized callback can called multiple times if disconnected
	}) ;

CallProc:
	picogw.callproc({
		method: "PUT"
		,path: "/v1/echonet/GenericIllumination_2/OperatingState/"
		,args: {value:'off'}
	}).then(re=>{
		console.log('Return:') ;
		console.log(re) ;
	})

Subscribe:
	picogw.sub(
		'/v1/echonet/GenericIllumination_1/OperatingState/'
		,re=>{console.log('Published!');console.log(re);}
	) ;

Unsubscribe:
	// Unsub all handlers related to the path
	picogw.unsub('/v1/echonet/GenericIllumination_1/OperatingState/');

	// Unsub only one handler
	picogw.unsub('/v1/echonet/GenericIllumination_1/OperatingState/',func);
*/


function connectws(onconnect_func /* can be called multiple times */ , hostname ){
	if( hostname == null ) hostname = location.host ;
    console.log('Trying to connect to '+hostname+'...') ;
	start_spinner();

    let connection = new WebSocket('ws://'+hostname ,['picogw']);

    let tid = 0 ;
    let waitlist = {} ;
    let sublist = {} ;

	connection.onopen = function () {
		let picogw = {
			callproc : args=>{
				return new Promise((ac,rj)=>{
					args.tid = tid ;
					waitlist[tid] = [ac,rj] ;
					tid++ ;
					connection.send(JSON.stringify(args)) ;
				});
			}
			, sub : (path,callback) => {
				if( path.slice(-1) == '/') path = path.slice(0,-1) ;
				if( sublist[path] == undefined ){
					sublist[path]={
						single_callback : function(re){
							this.callbacks.forEach(cb=>{cb(re);}) ;
						}
						, callbacks : []
					} ;
					connection.send(JSON.stringify({ method:'SUB',path:path,tid:4649 })) ;
				}
				if( sublist[path].callbacks.indexOf(callback)<0)
					sublist[path].callbacks.push(callback) ;
			}
			, unsub : (_path,callback) => {
				function unsubmain(path){
					if( path.slice(-1) == '/') path = path.slice(0,-1) ;
					if( sublist[path]==undefined ) return ;
					if( callback != undefined ){
						let pos = sublist[path].callbacks.indexOf(callback) ;
						if( pos >= 0)
							sublist[path].callbacks.splice( pos,1 ) ;
					}
					if( callback == undefined || sublist[path].callbacks.length == 0){
						connection.send(JSON.stringify({method:'UNSUB',path:path})) ;
						delete sublist[path] ;
					}
				}
				if(_path != null) unsubmain(_path) ;
				else for( _path in sublist )
					unsubmain(_path) ;
			}
		}
		stop_spinner();
	    console.log('Connected to '+location.host+'.') ;
		onconnect_func(picogw) ;
	};
	connection.onmessage = function (e) {
		//console.log('Server: ' + JSON.stringify(JSON.parse(e.data),null,"\t")) ;
		try {
			let ret = JSON.parse(e.data) ;
			if( ret.method == 'PUB'){
				for( let path in ret )
					if( sublist[path] != undefined )
						sublist[path].single_callback(ret) ;
			} else if( waitlist[ret.tid] != undefined ){
				let tid = ret.tid ;
				delete ret.tid ;
				waitlist[tid][0](ret) ;
				delete waitlist[ret.tid] ;
			}
		} catch(e){
			console.error(e) ;
		}
	};

	/*connection.onerror = function(){
		start_spinner();
	} ;*/
	connection.onclose = function(){
		start_spinner();
		for( let tid in waitlist )
			waitlist[tid][1]({error:'Connection closed.'}) ;
    	waitlist = {} ;
    	sublist = {} ;
    	//picogw = undefined ;
		console.log('Websocket disconnected. Retrying in 3 secs.') ;
		setTimeout(()=>{ connectws(onconnect_func) ; },3000) ;
	}
} ;

let spinner ;
function start_spinner(){
	if( spinner != undefined ) return ;
	spinner = new Spinner().spin() ;
	document.getElementsByTagName('body')[0].appendChild(spinner.el);
}
function stop_spinner(){
	if( spinner == undefined ) return ;
	document.getElementsByTagName('body')[0].removeChild(spinner.el);
	spinner = undefined ;
}

