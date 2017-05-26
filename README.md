![PicoGW logo](res/PicoGW.png)

A minimalist's [Housing Web API](http://www.daiwahouse.co.jp/lab/HousingAPI/) gateway that supports ECHONET Lite. The license is MIT.
The primary distribution site is [here](https://github.com/KAIT-HEMS/PicoGW).

## Installation & Running

**Check your node.js version**

```bash
$ node -v
```

We develop this software on node.js v7.6. If you are using an older version, we recommend to update to the latest one.

**Setup**

Clone this repository and install necessary node.js libraries.

```bash
$ git clone --depth 1 https://github.com/KAIT-HEMS/PicoGW.git
$ cd PicoGW
$ npm i
```

**Running**

```bash
$ node main.js
```

**Web access**

Access **8080 port** of the running machine from your favorite Web browser.
Follow the instruction shown in the opened page.

## Additional settings

**Background execution**

The first line is necessary only for first time. The second line should be executed in PicoGW directory.
```bash
$ sudo npm install forever -g
$ forever start main.js
```

**Stop background execution**

```bash
$ forever stop main.js
```


**Changing the server port**

```bash
$ node main.js -p 12345
```

**Changing the maker code**

```bash
$ echo '{"makercode":1234}' > v1/plugins/echonet/localstorage.json
```

## Web API

The Web API hosted by PicoGW is a developing version of [Housing API by Daiwa House Industry.](http://www.daiwahouse.co.jp/lab/HousingAPI/) The API design is mainly done by [Shigeru Owada@Kanagawa Instuitute of Technology](https://github.com/sowd). If you have any criticisms, requests, or questions, please feel free to post your opinion to the [Issues page](https://github.com/KAIT-HEMS/PicoGW/issues).

### Design concept

The concept of this API is as follows:

1. **Simple and easy**. The API basecally follows the concept of REST. At the same time, we tried not to be too strict to the concept. The API can violate the conceptual correctness to achive easiness. We also put effort to keep source code small, because large source code hampers wide commitments.
2. **Extensible**. The API should support the forthcoming IoT devices without drastically changing the basic calling styles. We adopt plugin architecture to achieve this.
3. **Maximize the merit for residents**. Most home gateway system are developed by home appliances companies. PicoGW should be independent from the pressure from such industry and conservatively implement really necessary, minimal functionalities.

### Calling convention

The API call is a simple HTTP access to the PicoGW server's 8080 port by default. The result is always given as a JSON object. All APIs exist under **/v1/** (The root **/** access shows the control panel.)
You can always write the API code in the URL field of your browser (HTTP GET access). Although some API favors HTTP PUT access, you can still mimic it by GET access with **/PUT** added to the end of the original URL. For example, PUT access to the following URL:

> http://192.168.1.10:8080/v1/echonet/AirConditioner_1/OperatingState/?on

equals to GET access to the following URL:

> http://192.168.1.10:8080/v1/echonet/AirConditioner_1/OperatingState/PUT?on

Although REST does not recommend to put verb into the URL (URI), we dare to adopt this option, because GET access is extraordinaly easy compared to other methods. In addition, PUT methods is not necessarily supported by all browsers.

As shown in the above example, additional parameters are supplied as GET parameter (after **?** character.) This way of parameter specification is applied to all HTTP methods, even for non-GET methods ([Criticisms?](https://github.com/KAIT-HEMS/PicoGW/issues))

### API directory

The API has a directory structure as follows. The directories right under root (admin / echonet) are the name of plugins. This can increase if new plugin is added to the system.

![](res/DirStructure.png)

The structures under a plugin name is a responsibility of the plugin. However, each subdirectory API follows the rule that the resulting JSON object contains further subdirectory name or leaf node name (which is associated with a function).

### /v1/admin

Admin plugin root.
The admin plugin is responsible to logging to network management.

#### /v1/admin/log

The log object in the admin plugin.

Currently, logging schedule is written directly into the source code (**v1/plugins/admin/logger.js**), it should be changed through control panel GUI.Properties under this directory is read only.

#### /v1/admin/net

The network object in the admin plugin.

This object monitors ARP table and associates IP address with the MAC address to detact change of IP address. PicoGW currently only support IPv4 network. Internally, the detected MAC address is exposed to other plugin to trace devices.

### /v1/echonet
This path is the ECHONET Lite plugin root.
The API call returns ECHONET Lite devices ID (internally generated unique ID) with their MAC address and current IP address.

#### /v1/echonet/[DeviceID]
ECHONET Lite device object.
[DeviceID] is the unique name of ECHONET Lite device. This call returns ECHONET Lite device's Property IDs (EPC) and its cached value (if exists), and whether the property only exists in the super class (see ECHONET Lite specification). Example call result is :

![](res/CacheValue.png)

#### **/v1/echonet/[DeviceID]/[PropertyID]**

GET access to the ECHONET Lite property.
This API will send GET request to a ECHONET Lite device and wait until the result is obtained. The API will return error if preset timeout time has past (30s by default.)
If a vaild value is obtained, the value is stored in the device's cache.

#### **/v1/echonet/[DeviceID]/[PropertyID]?[NEWVAL]** (by HTTP PUT access)
Equals to HTTP GET access to **/v1/echonet/[DeviceID]/[PropertyID]/PUT?[NEWVAL]**.
This sends SET access to the ECHONET Lite property. The sent value is specified as [NEWVAL] as hex value (without 0x or any other prefix.) Example:

> PUT http://192.168.1.10:8080/v1/echonet/AirConditioner_1/OperatingState/?30

will set 0x30 to OperatingState property. Exceptionally and optionally the [NEWVAL] can be more intuitive. For example, OperatingState also accept **on** or **off** word as [NEWVAL].

#### **/v1/echonet/[REGEXP]/[PropertyID]**

ECHONET Lite plugin supports regular expression for device names. For example:

> PUT http://192.168.1.10:8080/v1/echonet/.+/OperatingState/?30

will set 0x30 to all existing devices's OperatingState.

> GET http://192.168.1.10:8080/v1/echonet/(GenericIllumination_1|AirConditioner_1)/OperatingState/

will obtain OperatingState of a light and an airconditioner at once. Note that the response time is dominated by the slowest device.

PropertyID cannot accept regular expression (because it can easily be many!)

## Named pipe API

Named pipe can be used as a transport of PicoGW API. It is convenient to access PicoGW's functionality within a single machine. To use this API, please first make two named piped files (by the **mkfifo** command), which must have the unique prefix with two kinds of postfices (_r and _w). For example :

```bash
$ mkfifo np_r np_w
```
will create a pair of named pipes. *np* in the example above can be an arbitrary vaild string.
Then, PicoGW must be launched with **--pipe** option supplied with unique prefix:
```bash
$ node main.js --pipe np
```
In this mode, PicoGW will halt until the client that accesses the named pipe is connected. The client must open *_r* file with read only mode, while *_w* with write mode.

The API call should be written to *_w* file as a string followed by a newline "\n". The string is a stringified JSON object such as:

```
{"method":"PUT","path":"/v1/echonet/AirConditioner_1/OperatingState/","arg":"30"}
```
For GET case, **arg** key is not necessary.
Make sure that this request itself must not contain a newline "\n".

The API result can be obtained from reading the *_r* file.

## Licenses

#### MIT

[jQuery](https://jquery.com/)  
[jsTree](https://www.jstree.com/)  
[arped](https://www.npmjs.com/package/arped)  
[echonet-lite](https://www.npmjs.com/package/echonet-lite)  
[express](https://www.npmjs.com/package/express)  
[ipmask](https://www.npmjs.com/package/ipmask)  
[mime](https://www.npmjs.com/package/mime)  
[ping](https://www.npmjs.com/package/ping)  

#### Apache 2

[websocket](https://www.npmjs.com/package/websocket)  
