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

var fidoLayer = function(device) {
	this.device = device;
}

fidoLayer.prototype.exchangeApdu = function(transactionId, data) {
	return this.exchangeData(transactionId, 0x83, data);
}

/* Endpoint size independant frame exchange */
fidoLayer.prototype.exchangeData = function(transactionId, command, data) {
	var currentLayer = this;

	var dataLength = data.length / 2;
	var fidoFrame = dump([((transactionId >> 24) & 0xff), ((transactionId >> 16) & 0xff), 
			((transactionId >> 8) & 0xff), (transactionId & 0xff),
			command ,
			((dataLength >> 8) & 0xff), (dataLength & 0xff) ]);
	fidoFrame += data;

	console.log("=> " + fidoFrame);

	return currentLayer.device.send(fidoFrame).then(
		function(result) {			
			return currentLayer.device.recv(1024);
		}
	)
	.then(function(result) {
		var inEndpointSize = currentLayer.device.inEndpointSize;
		var resultBin = hexToBin(result.data);		
		var transactionIdResponse = (resultBin[0] << 24) + (resultBin[1] << 16) + (resultBin[2] << 8) + (resultBin[3]);
		if (transactionIdResponse != transactionId) {
			log.error("Invalid transaction Id response");
			throw "Invalid transaction Id response " + transactionIdResponse + " != " + transactionId;
		}
		if (resultBin[4] != command) {
			log.error("Invalid status " + parseInt(resultBin[4]).toString(16));
			throw "Invalid status " + parseInt(resultBin[4]).toString(16);
		}
		var dataLength = (resultBin[5] << 8) + (resultBin[6]);
		if (dataLength < (inEndpointSize - 7)) {
			console.log("<= " + dump(resultBin.subarray(0, dataLength + 7)));
			return dump(resultBin.subarray(7, dataLength + 7));			
		}
		var sizeToRead = dataLength - (inEndpointSize - 7);		
		var readActions = [];
		var originalResult = result.data;
		while (sizeToRead > 0) {
			readActions.push(currentLayer.device.recv(inEndpointSize));
			sizeToRead -= inEndpointSize;
		}
		return Q.all(readActions).then(function(result) {
			for(var i=0; i<result.length; i++) {
				originalResult += result[i].data;
			}
			resultBin = hexToBin(originalResult);
			console.log("<= " + dump(resultBin.subarray(0, dataLength + 7)));
			return dump(resultBin.subarray(7, dataLength + 7));
		})	
	});
}

