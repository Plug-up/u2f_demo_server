/*
************************************************************************
Copyright (c) 2013 UBINITY SAS
FIDO Alliance Confidential

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*************************************************************************
*/

var callbacks = [];
var id = 0;

function dump(array) {
  var hexchars = '0123456789ABCDEF';
  var hexrep = new Array(array.length * 2);

  for (var i = 0; i < array.length; i++) {
    hexrep[2 * i] = hexchars.charAt((array[i] >> 4) & 0x0f);
    hexrep[2 * i + 1] = hexchars.charAt(array[i] & 0x0f);
  }
  return hexrep.join('');  
}

function hexToBin(h) {
  var result = new ArrayBuffer(h.length / 2);
  var hexchars = '0123456789ABCDEFabcdef';
  var res = new Uint8Array(result);
  for (var i = 0; i < h.length; i += 2) {
    if (hexchars.indexOf(h.substring(i, i + 1)) == -1) break;
    res[i / 2] = parseInt(h.substring(i, i + 2), 16);
  }
  return res;
}

var addCallback = function() {
	var deferred = Q.defer();
	var currentId = id++;
	callbacks[currentId] = deferred;
	return currentId;
}

var enumerateDongles = function(vid, pid) {
	var id = addCallback();
	window.postMessage({ 
        destination: "PUP_EXT",
        command: "ENUMERATE",
        id: id,
        parameters: {
            vid: vid,
            pid: pid
        }
	 }, "*");
	 return callbacks[id].promise;	
}

var winusbDevice = function(enumeratedDevice) {
	this.device = enumeratedDevice;
}

winusbDevice.prototype.open = function() {
	var id = addCallback();
	var currentDevice = this;
	window.postMessage({ 
        destination: "PUP_EXT",
        command: "OPEN",
        id: id,
        parameters: {
            device: this.device
        }
	 }, "*");		
	return callbacks[id].promise.then(function(result) {
		currentDevice.id = result.deviceId;
	});
}

winusbDevice.prototype.send = function(data) {
	var id = addCallback();
	window.postMessage({ 
        destination: "PUP_EXT",
        command: "SEND",
        id: id,
        parameters: {
            deviceId: this.id,
            data: data
        }
	 }, "*");		
	return callbacks[id].promise;
}

winusbDevice.prototype.recv = function(size) {
	var id = addCallback();
	window.postMessage({ 
        destination: "PUP_EXT",
        command: "RECV",
        id: id,
        parameters: {
            deviceId: this.id,
            size: size
        }
	 }, "*");		
	return callbacks[id].promise;
}

winusbDevice.prototype.close = function() {
	var id = addCallback();
	window.postMessage({ 
        destination: "PUP_EXT",
        command: "CLOSE",
        id: id,
        parameters: {
            deviceId: this.id
        }
	 }, "*");		
	return callbacks[id].promise;
}

window.addEventListener("message", function(event) {
  if (event.data.destination == "PUP_APP") {
    callbacks[event.data.id].resolve(event.data.response);
  }
}, false);
