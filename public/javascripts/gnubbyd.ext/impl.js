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

window.GnubbyU2FImpl = function(){

    var extId = "beknehfpfkghjoafdifaflglpjkojoco"

    var timeout = 10

    /* Message types */

    var ENROLL = 'enroll_web_request'
    var SIGN   = 'sign_web_request'

    var checkExtension = function(cb){
        try {
            chrome.runtime.sendMessage(
                extId, "hello",
                function(response){
                    // console.log("Received a response")
                    // console.dir(response)
                    if (response.code && response.code == U2F.BAD_REQUEST) {
                        // Extension replied bad request so it is here
                        cb(true)
                    } else {
                        // Not expected response ...
                        cb(true)
                    }
                })
        } catch(e) {
            cb(false)
        }   
    }

    var sendEnroll = function(challenge, cb){
        var request = {
            type      : ENROLL,
            timeout   : timeout,
            signData  : [],
            requestId : 1,
            enrollChallenges: [{
                version   : "U2F_V2",
                appId     : U2F.appId,
                challenge : challenge,
                sessionId : "enroll"
            }]
        }
        // console.log("Sending request")
        // console.dir(request)
        chrome.runtime.sendMessage(extId, request, cb)
    }

    var sendSign = function(challenges, cb){
        console.log("sign_key")
        var signData = []
        $(challenges).each(
            function(i,e){
                signData.push({
                    version   : "U2F_V2",
                    appId     : U2F.appId,
                    challenge : e.challenge,
                    keyHandle : e.keyHandle,
                    sessionId : "sign"
                })
            }
        );
        var request = {
            type      : SIGN,
            timeout   : timeout,
            requestId : 2,
            signData  : signData
        }
        chrome.runtime.sendMessage(extId, request, cb)
    }

    return {
        name           : "gnubbyd",
        checkExtension : checkExtension,
        sendEnroll     : sendEnroll,
        sendSign       : sendSign
    }

}()