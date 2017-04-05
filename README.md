# PicoGW

A minimalist's housing Web API gateway that supports ECHONET Lite. The license is MIT.
The primary distribution site is [here](https://github.com/KAIT-HEMS/PicoGW).

## HowTo

**Setup**
Clone this repository and type
```bash
$ npm i
```

**Running**
```bash
$ node main.js
```

**Accessing**

Access **8080 port** of the running machine from your favorite Web browser.

**Changing the server port**
```bash
$ echo '{"serverport":9000}' > v1/clients/web/localstorage.json
```

**Changing the maker code**
```bash
$ echo '{"makercode":12345}' > v1/plugins/echonet/localstorage.json
```

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
