let urlVars = {} ;
if( location.search.length>0 ){
	let eqs = location.search.substring(1).split('&') ;
	eqs.forEach(function(eq){
		let terms = eq.split('=') ;
		urlVars[terms[0]]=(terms.length<2?null:terms[1]) ;
	}) ;
}


let picogw ;
let bInitialized = false ;
let devices ;

const DescriptionProperties = ['OperatingState','InstallationLocation','ManufacturerCode'] ;

onload = function(){
	if( urlVars.ip == null ){
		$('#mainpage-body').html('<div align="center"><h2>PicoGW IP address should be specified.</h2></div>') ;
		$('#mainpage').page() ;
		return ;
	}
	connectws(_picogw=>{
		picogw = _picogw ;

		if( bInitialized ) return ;
		bInitialized = true ;

		// Search echonet lite aircons
		const pathprefix = '/v1/echonet' ;
		start_spinner();
		picogw.callproc({
			method:'GET'
			,path: pathprefix
		}).then(devhash=>{
			stop_spinner();
			let devlist = [] ;
			for( let dev in devhash ){
				if( dev.indexOf(DevNamePrefix) == 0 )
					devlist.push(dev) ;
			}
			if( devlist.length == 0 )	return ;

			devices = {} ;
			start_spinner();
			Promise.all(devlist.map(dev=>new Promise((ac,rj)=>{
				picogw.callproc({
					method:'GET'
					,path: pathprefix+'/'+dev
				}).then(cache=>{
					devices[pathprefix+'/'+dev] = cache ;
					ac() ;
				}).catch(e=>{
					ac() ;
				});
			}))).then(()=>{
				stop_spinner();
				let ht = '' ;
				for( let path in devices ){
					let desc = '' ;
					DescriptionProperties.forEach(elem=>{
						try {
							desc += ` ${elem} = ${devices[path][elem].cache_value} :`
						} catch(e){}
					}) ;

					ht += `<li><a href="#controlpage" onclick="on_dev_selected('${path}')">`
						+`<img src="${IconURL}"></img><h2>${path.split('/').slice(-1)[0]}</h2>`
						+`<p>${desc.slice(0,-1)}</p>`	 // Remove last ','
						+`</a></li>` ;
				} ;

				$('#devlist').html(ht).listview('refresh');
			}).catch(e=>{stop_spinner();}) ;
		}).catch(e=>{
			stop_spinner();
			$('#mainpage-body').html('Error in searching /v1/echonet/'+DevNamePrefix) ;
			$('#mainpage').page();
		}) ;
	},urlVars.ip) ;
} ;

function simple_enum_setup(dev_path,propname,cache){
	if( cache == null ){
		// Property does not exist
		return ;
	}

	let prev_cval = cache.cache_value ;
	if( prev_cval == null )
		return ;	// Cache value is not obtained yet
	$(`#${propname}-${prev_cval}`).attr('checked','checked') ;
	$(`label[for='${propname}-${prev_cval}']`).addClass('ui-btn-active') ;
	//$(`#${propname}-${prev_cval}`).removeAttr('checked') ;

	picogw.sub(dev_path+'/'+propname,re=>{
		let cval = re[dev_path+'/'+propname].value ;
		$(`label[for='${propname}-${prev_cval}']`).removeClass('ui-btn-active') ;
		$(`label[for='${propname}-${cval}']`).addClass('ui-btn-active') ;
		prev_cval = cval ;
		//$('#controlpage').page();
	});

	// Set handler
	return newval=>{
		start_spinner();
		picogw.callproc({
			method:'PUT'
			,path:dev_path+'/'+propname
			,args:{value:newval}
		}).then(re=>{stop_spinner();console.log(re);}).catch(e=>{stop_spinner();});
		prev_cval = newval ;
		//console.log(`${propname} : ${newval}`) ;
	} ;
}

//<input type="range" name="TemperatureSetValue" id="TemperatureSetValue" min="0" max="50" value="25">

function slider_setup(dev_path,sliderSettings,cache){
	const propName = sliderSettings[0] ;
	const propMin = sliderSettings[1] , propMax = sliderSettings[2] ;
	if( cache == null ) cache = propMin ;
	$(`#${propName}`).attr('min',propMin) ;
	$(`#${propName}`).attr('max',propMax) ;
	$(`#${propName}`).attr('value',cache) ;
	$(`#${propName}`).slider('refresh') ;

	picogw.sub(dev_path+'/'+propName,re=>{
		$(`#${propName}`).val(re[dev_path+'/'+propName].value).slider('refresh');
	});

	// Set handler
	return newval=>{
		start_spinner();
		picogw.callproc({
			method:'PUT'
			,path:dev_path+'/'+propName
			,args:{value:newval}
		}).then(re=>{stop_spinner();console.log(re);}).catch(e=>{stop_spinner();});
		prev_cval = newval ;
		console.log(`${propName} : ${newval}`) ;
	} ;
}

const set_handlers = {} ;

on_dev_selected = dev_path =>{
	localStorage.setItem('dev_path',dev_path) ;
}

$("#controlpage").on("pagehide",function(event) {
	picogw.unsub() ;
}) ;
$("#controlpage").on("pagebeforeshow",function(event) {
	let dev_path = localStorage.getItem('dev_path') ;
	function setupControls(){
		let devCache = devices[dev_path] ;

		// Simple enum properties
		SimpleEnumProperties.forEach(pname=>{
			set_handlers[pname] = simple_enum_setup(dev_path,pname,devCache[pname]) ;
		}) ;

		// Slider properties
		SliderProperties.forEach(sliderSettings=>{
			set_handlers[sliderSettings[0]] = slider_setup(dev_path,sliderSettings,devCache[sliderSettings[0]].cache_value) ;
		}) ;
	}

	if( devices != null ) setupControls() ;
	else {
		let iid = setInterval(()=>{
			if( devices == null ) return ;
			clearInterval(iid) ;
			setupControls() ;
		},1000) ;
	}
});

$(document).on('change', '[type="radio"]', function(){ 
	try {
		set_handlers[this.name](this.value) ;
	} catch(e){}
});

SliderProperties.forEach(sliderSettings=>{
	$('#frm').on('slidestop','#'+sliderSettings[0], function(){ 
		try {
			set_handlers[this.name](parseInt(this.value)) ;
		} catch(e){}
	});
});
