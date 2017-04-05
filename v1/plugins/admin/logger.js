// Timing of the first access
const ACCESS_START_WAIT = 3*1000 ;

// the sampling should not be too early. Should be at least later than the exact time.
// (Otherwise slight timing causes multiple accesses in short period of time)
// actual sampling time is SINGLE_ACCESS_DELAY + SINGLE_ACCESS_RANDOM_RANGE * Math.random()
//  milliseconds after the exact time.
const SINGLE_ACCESS_DELAY = 1*1000 ;
const SINGLE_ACCESS_RANDOM_RANGE = 5*1000 ;

var fs = require('fs');
var adminInterface ;
var log = console.log ;
var localStorage ;

exports.schedule = {};

exports.start = function(ai){
	adminInterface = ai ;
	log = adminInterface.log ;
	localStorage = adminInterface.localStorage ;

	//var EVERYMIN = [] ; for( var ai=0;ai<60;++ai ) EVERYMIN.push(':'+ai) ;
	exports.schedule = localStorage.getItem('schedule',{
		echo_allpower : {
			path : 'echonet/.+/OperatingState'
			, schedule : [':0',':10',':20',':30',':40',':50']
			, description : 'Power of all ECHONET Lite devices'
		}
		,echo_instpower : {
			path : 'echonet/PanelboardMetering_.+/InstantaneousPowerMeasurementValue'
			, schedule : [':0',':30']
			, description : 'Instantaneous power of distribution board'
		}
		, mac_trace : {
			path : 'admin/net'
			, schedule : [':0',':10',':20',':30',':40',':50']
			, description : 'Network status'
		}
	}) ;
	//localStorage.setItem('schedule',schedule) ;

	for( var sid in exports.schedule ){
		exports.schedule[sid].schedule_func
			= genScheduleFunc(exports.schedule[sid].schedule) ;
	}

	setTimeout( ()=>{
		for( var _sid in exports.schedule ){
			(()=>{
				var sid = _sid ;
				var spath = exports.schedule[sid].path ;
				var schedule_func = exports.schedule[sid].schedule_func ;

				function access_device(){
					setTimeout( ()=>{
						log('Accessing '+spath);
						adminInterface.callproc('GET',spath).then(rep=>{
							add_log(spath,rep) ;
						}).catch(rep=>{
							add_log(spath,rep) ;
						}) ;
					} , parseInt(Math.random()*SINGLE_ACCESS_RANDOM_RANGE) ) ;

					setTimeout( access_device
						, schedule_func() + SINGLE_ACCESS_DELAY ) ;
				}
				setTimeout( access_device
					, schedule_func() + SINGLE_ACCESS_DELAY ) ;
			})() ;
		}
	},ACCESS_START_WAIT ) ;
} ;

exports.getlog = function(paths){
	return new Promise((ac,rj)=>{
		fs.readdir( adminInterface.getpath()+'log' ,(err,files) => {
			if( err ){ rj({error:'cannot read log folder'}); return ;}
			files = files.filter( fn => fn.slice(-5)=='.json' ) ;
			if( files.length==0 ){ rj({error:'no log available'}); return ;}
			files.sort() ;
			fs.readFile(adminInterface.getpath()+'log/'+files[files.length-1],'utf8'
				,(err,data)=>{
					if( err ){
						rj({error:'Error in reading '+files[files.length-1]+' / '+JSON.stringify(err)});
						return ;
					}
					try {
						var logarray = JSON.parse(data) ;
						var logarray_selected
							= logarray.filter( entry => paths.indexOf(entry.path)>=0 ) ;
						ac( logarray_selected ) ;
					} catch(e){
						rj( {error:'Log file is not in JSON format',content:data} ) ;
					}
				}
			) ;
		} ) ;
	}) ;
}


// Log scheduler
function genScheduleFunc(timing_array){
	var times=[] ;
	timing_array.forEach(ta=>{
		if( ta.charAt(0) == ':'){
			for( var h=0;h<24;++h )
				times.push((h*60+parseInt(ta.slice(1))) *60*1000) ;
		} else {
			ta = ta.split(':') ;
			times.push( (parseInt(ta[0])*60+parseInt(ta[1])) *60*1000) ;
		}
	}) ;
	times.sort((a,b)=>a-b) ;
	//log(times) ;
	return ()=>{
		var nowmillis = Date.now() ;
		var now = new Date(nowmillis) ;
		var daystartmillis = (new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0)).getTime() ;
		var millis_in_day = nowmillis - daystartmillis ;

		var ti ;
		for( ti=0;ti<times.length;++ti ){
			if( millis_in_day <= times[ti] )
				break ;
		}

		if( ti == times.length )
			timediff = 24*60*60*1000 - millis_in_day + times[0] ;
		else
			timediff = times[ti] - millis_in_day ;

		return timediff ;
	} ;
}



function add_log(path,value){
	var dmillis = Date.now() ;
	var d = new Date(dmillis) ;
	var fname = `${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}.json` ;
	var logfile = [] ;
	try {
		logfile = JSON.parse(fs.readFileSync(adminInterface.getpath()+'log/'+fname)) ;
	} catch(e){log('File read error:'+adminInterface.getpath()+'log/'+fname) ;}
	logfile.push({ timestamp : Date.now() , date : d.toJSON() , path : path , value : value }) ;
	try {
		fs.writeFile(adminInterface.getpath()+'log/'+fname, JSON.stringify(logfile,null,"\t")) ;
	} catch(e){log('File write error:'+adminInterface.getpath()+'log/'+fname) ;}
}
