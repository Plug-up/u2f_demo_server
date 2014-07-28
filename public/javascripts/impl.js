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

window.PreReleaseImpl = function(){

    /* Message types */
    var ENROLL = 'u2f_register_request'
    var SIGN   = 'u2f_sign_request'

    var checkExtension = function(cb){
        if (typeof u2f != "undefined") cb(true)
        else cb(false)
    }

    var sendEnroll = function(challenge, cb, timeout){
        console.log("Sending request")
        var enrollChallenges = [{
            version   : "U2F_V2",
            appId     : U2F.appId,
            challenge : challenge
        }]
        console.dir(enrollChallenges)
        u2f.register(enrollChallenges, [], cb, timeout)
    }

    var sendSign = function(challenges, cb, timeout){
        console.log("sign_key")
        var signData = []
        $(challenges).each(
            function(i,e){
                signData.push({
                    version   : "U2F_V2",
                    appId     : U2F.appId,
                    challenge : e.challenge,
                    keyHandle : e.keyHandle
                })
            }
        );
        console.dir(signData)
        u2f.sign(signData, cb, timeout)
    }

    return {
        checkExtension : checkExtension,
        sendEnroll     : sendEnroll,
        sendSign       : sendSign,
    }

}();
