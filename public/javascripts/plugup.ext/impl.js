/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

window.PlugupU2FImpl = function(){
    var currentDevice = undefined
    var transport = undefined
    var extensionHere = false
    var checking = false
    
    var DEFAULT_P1_ENROLL = "00"
    var DEFAULT_P1_SIGN = "00"
    var DEFAULT_LE = "0400"

    var checkExtension = function(cb){
        if (extensionHere) cb(true)
        else {
            try {
                checking = true
                enumerateDongles(0x2581, 0xf1d0).then(
                    function(res){
                        checking = false
                        extensionHere = true
                        cb(true)
                    }
                )
                setTimeout(function(){
                    if (checking){
                        // timeout check
                        checking = false
                        cb(false)
                    }
                }, 2000)
            } catch(e) {
                cb(false)
            }
        }
    }
    
    var scanDevices = function(cb){
        if (typeof currentDevice != "undefined") {
            currentDevice.close()
            currentDevice = undefined
            transport = undefined
        }
        var enumerateAction = [
            //enumerateDongles(0x1050, 0x211), 
            //enumerateDongles(0x2581, 0x1807),
            enumerateDongles(0x2581, 0xf1d0)
        ]
        Q.all(enumerateAction).then(function(result) {
            var enumerated = []
            result.forEach(function(element) {
                enumerated = enumerated.concat(element.deviceList)
            })
            cb(enumerated)
        })
    }
    
    var selectTerminal = function(terminal, cb){
        currentDevice = new winusbDevice(terminal)
        transport = new fidoLayer(currentDevice)
        currentDevice.open().then(function(){
            console.log("Device opened!")
            cb()
        }, function(){console.log("Cannot open device!")})
    }
    
    var exchangeApdu = function(apdu, cb){
        if (typeof currentDevice == "undefined") {
            console.log("No device selected !")
            cb("")
        }
        console.log("APDU: "+apdu)
        transport.exchangeApdu(1, apdu).then(function(result) {
            console.log("Exchange APDU succeed")
            var resultBin = dump(hexToBin(result))
            console.log("RES : " + resultBin)
            cb(resultBin)
        }, function(){
            console.log("Exchange APDU failed")
            cb("")
        })
    }
    
    var getVersion = function(cb){
        var apdu = "0003000000"
        exchangeApdu(apdu, function(res){
            if (res == "5532465F56329000") cb("U2F_V2")
            else cb("UNKNOWN")
        })
    }
    
    // challenge and appId already hashed
    var doSendEnroll = function(challenge, cb){
        var apduData = challenge + U2F.hashedAppId
        var apdu = "0001" + DEFAULT_P1_ENROLL + "00" + dump([ 0x00, 0x00, (apduData.length / 2) ]) + apduData + DEFAULT_LE
        
        exchangeApdu(apdu, function(res){
            var response = {}
            if (res == "6985"){
                response.code = U2F.WAIT_TOUCH
            } else if (res.length == 4) {
                response.code = U2F.UNKNOW_ERROR
            } else {
                response.code = U2F.OK
                response.responseData = {
                    version     : "U2F_V2",
                    appId       : U2F.appId,
                    browserData : challenge,
                    challenge   : challenge,
                    enrollData  : res
                }
            }
            cb(response)
        })
    }

    var sendEnroll = function(challenge, cb){
        scanDevices(function(lst){
            if (lst.length == 0) cb({code: U2F.NO_DEVICE})
            else selectTerminal(lst[0], function(){
                doSendEnroll(challenge, cb)
            })
        })
    }
    
    var doSendSign = function(challenge, keyHandle, cb){
        var apduData = challenge + U2F.hashedAppId + keyHandle
        var apdu = "0002" + DEFAULT_P1_SIGN + "00" + dump([ 0x00, 0x00, (apduData.length / 2) ]) + apduData + DEFAULT_LE
        console.log("challenge: " + challenge)
        console.log("appid: " + U2F.appId)
        console.log("hashed appid: " + U2F.hashedAppId)
        console.log("keyHandle: " + keyHandle)
        exchangeApdu(apdu, function(res){
            var response = {}
            if (res == "6985"){
                response.code = U2F.WAIT_TOUCH
            } else if (res == "" || res.length == 4) {
                response.code = U2F.UNKNOW_ERROR
            } else {
                response.code = U2F.OK
                response.responseData = {
                    version       : "U2F_V2",
                    appId         : U2F.appId,
                    browserData   : challenge,
                    challenge     : challenge,
                    keyHandle     : keyHandle,      
                    signatureData : res
                }
            }
            cb(response)
        })
    }

    var sendSign = function(challenges, cb){
        scanDevices(function(lst){
            if (lst.length == 0) cb({code: U2F.NO_DEVICE})
            else selectTerminal(lst[0], function(){
                var nb = challenges.length
                var rnd = Math.floor(Math.random() * nb)
                var d = challenges[rnd]
                console.log("Signing with KH " + rnd)
                doSendSign(d.challenge, d.keyHandle, cb)
            })
        })      
    }
    
    return {
        name           : "plugup",
        checkExtension : checkExtension,
        //      getVersion     : getVersion,
        //      scanDevices    : scanDevices,
        //      selectTerminal : selectTerminal,
        sendEnroll     : sendEnroll,
        sendSign       : sendSign
    }
}()