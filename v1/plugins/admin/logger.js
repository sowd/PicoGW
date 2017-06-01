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
var localStorage , localSettings ;

exports.schedule = [];

exports.start = function(ai){
	adminInterface = ai ;
	log = adminInterface.log ;
	localStorage = adminInterface.localStorage ;
	localSettings = adminInterface.localSettings ;

	//var EVERYMIN = [] ; for( var ai=0;ai<60;++ai ) EVERYMIN.push(':'+ai) ;
	exports.schedule = localSettings.getItem('schedule',[]) ;
	exports.schedule.forEach(sentry=>{
		sentry.schedule_func = genScheduleFunc(sentry.schedule.split(',')) ;
	});

	var running_schedule_ids = [] ;
	function startSchedule(){
		// Start schedule
		var st_id = setTimeout( ()=>{
			running_schedule_ids = running_schedule_ids.filter(id => id!=st_id ) ;

			exports.schedule.forEach(sentry=>{
				var spath = sentry.path ;
				var schedule_func = sentry.schedule_func ;

				var at_id ;
				function access_device(){
					running_schedule_ids = running_schedule_ids.filter(id => id!=at_id ) ;
					at_id = setTimeout( access_device
						, schedule_func() + SINGLE_ACCESS_DELAY ) ;
					running_schedule_ids[at_id] = at_id ;

					var t_id = setTimeout( ()=>{
						running_schedule_ids = running_schedule_ids.filter(id => id!=t_id ) ;

						log('Accessing '+spath);
						adminInterface.callproc('GET',spath).then(rep=>{
							add_log(spath,rep) ;
						}).catch(rep=>{
							add_log(spath,rep) ;
						}) ;
					} , parseInt(Math.random()*SINGLE_ACCESS_RANDOM_RANGE) ) ;
					running_schedule_ids.push(t_id) ;
				}
				at_id = setTimeout( access_device
					, schedule_func() + SINGLE_ACCESS_DELAY ) ;
				running_schedule_ids.push(at_id) ;
			});
		},ACCESS_START_WAIT ) ;
		running_schedule_ids.push(st_id) ;
	}

	exports.updateschedule = function(newschedule){
		var nscopy = JSON.stringify(newschedule) ;
		// Validate given schedule
		var bSuccess = true ;
		newschedule.forEach(sentry=>{
			sentry.schedule_func = genScheduleFunc(sentry.schedule.split(',')) ;
			if( sentry.schedule_func == undefined ) bSuccess = false ;
		});
		if( !bSuccess ) return false ;

		// Stop schedule
		running_schedule_ids.forEach(clearTimeout) ;
		running_schedule_ids = [] ;

		// Save new schedule
		localSettings.setItem('schedule',JSON.parse(nscopy)) ;
		exports.schedule = newschedule ;

		// Restart schedule
		startSchedule() ;
		return true ;
	} ;

	startSchedule() ;

	// Save all publications
	adminInterface.subscribe('.',re=>{
		delete re.method ;
		for( var path in re ){
			if( path.indexOf('/v1/') !=0 ) continue ;
			var entry = {} ;
			entry[path] = re[path] ;
			//log('Add_log:'+path+' / '+JSON.stringify(entry)) ;
			add_log(path , entry) ;
		}
	});
} ;

exports.getlog = function(path){
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
							= logarray.filter( entry => path==entry.path ) ;
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
	var bSuccess = true ;
	timing_array.forEach(ta=>{
		if( ta.indexOf(':')<0 ){bSuccess = false ; return ; }

		if( ta.charAt(0) == ':'){
			for( var h=0;h<24;++h )
				times.push((h*60+parseInt(ta.slice(1))) *60*1000) ;
		} else {
			ta = ta.split(':') ;
			if( ta.length != 2){ bSuccess = false ; return ; }	// fail
			times.push( (parseInt(ta[0])*60+parseInt(ta[1])) *60*1000) ;
		}
	}) ;
	if( !bSuccess ) return ;

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
	} catch(e){ /*log('File read error:'+adminInterface.getpath()+'log/'+fname);*/ }
	logfile.push({ timestamp : Date.now() , date : d.toJSON() , path : path , value : value }) ;
	try {
		fs.writeFile(adminInterface.getpath()+'log/'+fname, JSON.stringify(logfile,null,"\t") ,()=>{}) ;
	} catch(e){log('File write error:'+adminInterface.getpath()+'log/'+fname) ;}
}
