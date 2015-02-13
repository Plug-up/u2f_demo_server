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

var terminalFactory, currentCard

;(function(window, document, undef){

    /**
     * If already loaded, don't load it again
     */
    if (typeof window.PU !== typeof undef) return;

    /**
     * Perso Srv main module
     */
    var PU = function() {

        var ajax = function(url, data, callback) {
            $.ajax({
                type: "POST",
                url: "/ajax/"+url,
                data: data,
                success: function(res) {
                    if (typeof callback !== typeof undef) callback(res)
                }
            });
        };

        var check_compat = function(show, cb){
            if (typeof u2f !== "undefined") {
                if (show) {
                    $("#ext1").addClass("hide")
                    $("#ext2").removeClass("hide")
                    $("#regCol").removeClass("hide")
                    $("#reg1").removeClass("hide")
                }
                cb(true)
            } else {
                if (show) {
                    $("#ext1").addClass("hide")
                    $("#ext3").removeClass("hide")
                } else alert("Browser not compatible")
            }
        }

        var check_dongle = function(){
            var SPINNER = '<img src="/assets/images/spinner.gif" alt="Checking"/>'
            var SUCCESS = '<img src="/assets/images/tick.png" alt="Success"/>'
            var ERROR = '<img src="/assets/images/error.png" alt="Error"/>'
            function progress(pc, cl, txt){
                $("#check_progress").css({width:pc+"%"})
                $("#check_state").html("<p>"+txt+"</p>")
                    .attr("class", "center alert alert-"+cl)
            }
            function checkSign(enrollData, res){
                progress(70, "info", "Checking device signature")
                var data = enrollData
                data.clientData = res.clientData
                data.signatureData = res.signatureData
                ajax("checkSign2", data, function(res){
                    if (res.ok) {
                        $("#sig_check").html(SUCCESS)
                        progress(100, "success", res.ok)
                    } else {
                        $("#sig_check").html(ERROR)
                        progress(100, "danger", res.error)
                    }
                })
            }
            function sign(enrollData, tries){
                return function(res){
                    if (tries > 0) {
                        console.log("Sig response:")
                        console.dir(res)
                    } else {
                        console.log("enrollData:")
                        console.dir(enrollData)
                    }
                    var errorCode = U2F.OK
                    if (res.errorCode) errorCode = res.errorCode
                    if (errorCode == U2F.OK) {
                        console.log('Received answer')
                        console.dir(res)
                        checkSign(enrollData, res)
                    } else if (tries > 5) {
                        $("#sig_check").html(ERROR)
                        progress(70, "danger", "No device answer after 5 tries")
                    } else {
                        console.log("Sign try "+tries)
                        var challenge = [
                            { challenge: enrollData.challenge,
                              keyHandle: enrollData.keyHandle }
                        ]
                        sign_internal(challenge, sign(enrollData, tries+1))
                    }
                }
            }
            function checkEnroll(challenge, res) {
                if (res.challenge != challenge) {
                    console.log(res.challenge)
                    console.log(challenge)
                    $("#reg_check").html(ERROR)
                    progress(20, "danger", "Server challenge tampered")
                } else {
                    progress(30, "info", "Device answer received - Checking answer")
                    ajax("checkRegister2", res, function(res){
                        if (res.ok) {
                            $("#reg_check").html(SUCCESS)
                            progress(60, "info", "Please plug or activate your device" )
                            $("#sig_check").html(SPINNER)
                            sign(res.ok, 0)({errorCode:-1})
                        } else {
                            $("#reg_check").html(ERROR)
                            progress(60, "danger", "Cannot authenticate device")
                        }
                    })
                }
            }
            function enroll(challenge, tries){
                return function(res){
                    var errorCode = U2F.OK
                    if (res.errorCode) errorCode = res.errorCode
                    if (errorCode == U2F.OK) {
                        console.log("Received answer")
                        console.dir(res)
                        checkEnroll(challenge, res)
                    } else if (tries > 5) {
                        $("#reg_check").html(ERROR)
                        progress(15, "danger", "No device answer after 5 tries")
                    } else {
                        console.log("Enroll try "+tries)
                        register_internal(challenge, enroll(challenge, tries+1))
                    }
                }
            }
            function get_challenge(){
                ajax("getCheckChallenge", {}, function(res){
                    progress(15, "info", "Please plug or activate your device")
                    $("#reg_check").html(SPINNER)
                    enroll(res.challenge, 0)({errorCode:-1})
                })
            }
            function check_comp(){
                progress(0, "info", "Checking compatibility")
                $("#ext_check").html(SPINNER)
                if (typeof u2f != "undefined") {
                    $("#ext_check").html(SUCCESS)
                    progress(10, "info", "Browser compatible")
                    get_challenge()
                } else {
                    $("#ext_check").html(ERROR)
                    progress(10, "error", "Browser not compatible")
                }
            }
            check_comp()
        }

        var genChallenge = function() {
            var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'
            var length = 64
            var result = '';
            for (var i = length; i > 0; --i)
                result += chars[Math.floor(Math.random() * chars.length)];
            return result;
        }

        var check_register = function(challenge){
            return function(response) {
                console.log("Received response")
                console.dir(response)
                var errorCode = U2F.OK
                if (response.errorCode) errorCode = response.errorCode;
                if (errorCode == U2F.OK) {
                    // U2F device registered
                    $("#regStatus .alert").addClass("hide")
                    $("#reg3").removeClass("hide")
                    var data = response
                    if (data.responseData) data = data.responseData
                    ajax("checkRegister", data, function(res){
                        if (res.ok) {
                            $("#regStatus .alert").addClass("hide")
                            $("#reg4").removeClass("hide")
                            $("#u2fSkip").addClass("hide")
                            $("#u2fSuccess").removeClass("hide")
                        } else alert(res.error)
                    })
                } else {
                    // No device found
                    $("#regStatus .alert").addClass("hide")
                    $("#reg1").removeClass("hide")
                    setTimeout(function(){
                        register_internal(challenge, check_register(challenge))
                    }, 500)
                }
            }
        }

        var register_internal = function(challenge, cb) {
            console.log("Sending registration request")
            var enrollChallenges = [{
                version   : "U2F_V2",
                appId     : U2F.appId,
                challenge : challenge
            }]
            console.dir(enrollChallenges)
            u2f.register(enrollChallenges, [], cb, 2)
        }

        var sign_internal = function(challenges, cb) {
            console.log("Sending sign request")
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
            u2f.sign(signData, cb, 2)
        }

        var register_key = function() {
            console.log("register_key")
            ajax("genChallenge", {}, function(res){
                if (res.ok) {
                    var ch = res.ok.challenge
                    register_internal(ch, check_register(ch))
                } else alert(res.error)
            })
        }

        var changeU2FState = function(cl, msg) {
            $("#u2fState").removeClass("warning").removeClass("success")
            $("#u2fState").addClass(cl)
            $("#u2fState h1").html(msg)
        }

        var check_sign = function(response) {
            console.log("Received response")
            console.dir(response)
            var errorCode = U2F.OK
            if (response.errorCode) errorCode = response.errorCode;
            if (errorCode == U2F.OK) {
                ajax("checkSign", response, function(res){
                    if (res.ok) window.location = "/"
                    else alert(res.error)
                })
            } else {
                console.log("Response status: " + errorCode)
                if (errorCode == U2F.DEVICE_INELIGIBLE) {
                    $("#u2fState h1").html("Incorrect dongle")
                } else {
                    $("#u2fState h1").html("Please plug your U2F device to access your account.")
                }
                setTimeout(function(){sign_key(false)}, 500)
            }
        }

        var sign_key = function(first) {
            console.log("sign_key")
            var challenges = []
            var f1 = "ch", f2 = "kh"
            $("#loginU2F > *").each(
                function(i,e){
                    challenges.push({
                        challenge: $(e).attr(f1),
                        keyHandle: $(e).attr(f2)
                    })
                }
            );
            sign_internal(challenges, check_sign)
        }

        var skip_2f = function() {
            ajax("skip2f", {}, function(res){
                if (res.ok) window.location = "/"
                else alert(res.error)
            })
        }

        var delete_device = function(id) {
            ajax("deleteDevice", {id: id}, function(res){
                if (res.ok) $("#"+id).remove()
                else alert(res.error)
            })
        }

        var check_oath = function() {
            $("#oathState").addClass("hide")
            ajax("oathCheck", {otp:$("#oath").val()}, function(res){
                if (res.ok) window.location = "/"
                else {
                    $("#oathState").removeClass("hide")
                    $("#oathState").html(res.error)
                }
            })
        }

        var load_qrcode = function() {
            var qrcode = new QRCode("qrcode");
            qrcode.makeCode($("#qrcode").attr("rel"))
        }

        var confirm_oath = function() {
            $("#oath_state").removeClass("has-error")
            ajax("oathConfirm", {otp:$("#oath_confirm").val()}, function(res){
                if (res.ok) window.location = "/devices"
                else $("#oath_state").addClass("has-error")
            })
        }

        var echo = function(data) {
            ajax("echo", {data:data}, function(){})
        }

        var kbPrefix = "lll"
        var kbSuffix = "vvv"
        var cBuffer = ""
        var decode = function(raw){
            var res = "", i = 1
            while (i < raw.length){
                res += "bcdefghijk".indexOf(raw[i])
                i += 2
            }
            return res
        }

        var initKbListener = function(endpoint){
            $(document).keydown(function(e){
                var chr = "abcdefghijklmnopqrstuvwxyz"
                if (e.keyCode > 64 && e.keyCode < 90) {
                    cBuffer += chr[e.keyCode-65]
                    if (cBuffer.indexOf(kbPrefix)>=0 && cBuffer.indexOf(kbSuffix) > 0) {
                        var rawCode = cBuffer.split(kbPrefix)[1].split(kbSuffix)[0]
                        cBuffer = ""
                        console.log("RAW code: "+rawCode)
                        var code = decode(rawCode)
                        console.log("code: "+code)
                        ajax(endpoint, {otp:code}, function(res){
                            if (res.ok) window.location = "/"
                            else if (res.error) {
                                $("#validate").addClass("hide")
                                $("#oathState").html(res.error).removeClass("hide")
                            }
                        })
                    }
                }
            })
        }

        function computeSha256(cb, errcb) {
            var self = this
            var files = document.getElementById("sig_file").files
            if (files.length == 0) errcb()
            else {
                var file = files[0]

                var reader = new FileReader()

                reader.onload = function(e) {
                    var cont = e.target.result
                    var uint8 = new Uint8Array(cont)
                    var msg = Crypto.util.bytesToWords(uint8)
                    var bits = file.size * 8;
                    var bitsH = Math.floor(bits / 0x100000000);
                    var bitsL = bits & 0xFFFFFFFF;
                    // Padding
                    msg[bits >>> 5] |= 0x80 << (24 - bits % 32);
                    msg[((bits + 64 >>> 9) << 4) + 14] = bitsH;
                    msg[((bits + 64 >>> 9) << 4) + 15] = bitsL;
                    var sha = Crypto.util.bytesToHex(sha256(msg))
                    cb(sha)
                }
                reader.readAsArrayBuffer(file)
            }
        }

        var sign_file = function(kh){
            var check_file_sign = function(ch){return function(res){
                var errorCode = U2F.OK
                if (res.errorCode) errorCode = res.errorCode;
                if (errorCode == U2F.OK) {
                    console.dir(res)
                    $("#sig1").val(res.clientData)
                    $("#sig2").val(res.signatureData)
                    $("#sigblock").val(ch[0].challenge+"\n"+res.clientData+"\n"+res.signatureData+"\n"+$("#appid").val()+"\n"+$("#pubpt").val())
                    $("#sigblocknopp").val(ch[0].challenge+"\n"+res.clientData+"\n"+res.signatureData)
                } else {
                    console.log("Response status: " + errorCode)
                    if (errorCode == U2F.DEVICE_INELIGIBLE) {
                        $("#sig_help").html("Incorrect dongle")
                    } else {
                        $("#sig_help").html("Please plug your U2F device to access your account.")
                    }
                    setTimeout(function(){
                        sign_internal(ch, check_file_sign(ch))
                    }, 500)
                }
            }}
            computeSha256(function(sha){
                $("#sha256").val(sha)
                var challenges = [{
                    challenge: sha,
                    keyHandle: kh
                }]
                sign_internal(challenges, check_file_sign(challenges))
            }, function(){
                $("#sig_help").html("Please select a file")
            })
        }

        var split_block = function(pp){
            var id = "#sigblocknopp"
            if (pp) id = "#sigblock"
            var data = $(id).val().split("\n")
            $("#sha256").val(data[0])
            $("#sig1").val(data[1])
            $("#sig2").val(data[2])
            if(pp) {
                $("#appid").val(data[3])
                $("#pubpt").val(data[4])
            }
        }

        var check_file_sign = function(kh){
            var SPINNER = '<img src="/assets/images/spinner.gif" alt="Checking"/>'
            var SUCCESS = '<img src="/assets/images/tick.png" alt="Success"/>'
            var ERROR = '<img src="/assets/images/error.png" alt="Error"/>'
            $("#sig_check_res").html(SPINNER)
            var check_server = function(okmsg, errmsg){
                var data = {
                    appId: $("#appid").val(),
                    clientData: $("#sig1").val(),
                    signatureData: $("#sig2").val(),
                    pubPoint: $("#pubpt").val(),
                    challenge: $("#sha256").val()
                }
                ajax("checkSign2", data, function(res){
                    console.dir(res)
                    if (res.ok) {
                        $("#sig_check_res").html('<div class="alert alert-success">'+SUCCESS+okmsg+"</div>")
                    } else {
                        $("#sig_check_res").html(ERROR+errmsg)
                    }
                })
            }
            computeSha256(
                function(sha){
                    if (sha != $("#sha256").val()) {
                        $("#sig_check_res").html(ERROR+" This file has not the right sha256")
                    } else check_server("Signature is correct", "Incorrect signature")
                }, function(){
                    check_server(" No file selected", " Incorrect signature")
                }
            )
        }

        return {
            check_dongle    : check_dongle,
            check_compat    : check_compat,
            check_file_sign : check_file_sign,
            check_oath      : check_oath,
            confirm_oath    : confirm_oath,
            delete_device   : delete_device,
            echo            : echo,
            initKbListener  : initKbListener,
            load_qrcode     : load_qrcode,
            register_key    : register_key,
            sign_file       : sign_file,
            sign_key        : sign_key,
            skip_2f         : skip_2f,
            split_block     : split_block
        }

    }();

    window.PU = PU;

})(window, document);

$(document).ready(function() {

    $('input[name="animal"]:checked').closest(".thumbnail").addClass("cutest")
    $('input[name="animal"]').each(function(i, e){
        $(e).change(function(evt){
            var parentForm = $(evt.target).closest("form")
            parentForm.find(".cutest").removeClass("cutest")
            $(evt.target).closest(".thumbnail").addClass("cutest")
            $("form").submit()
        })
    });
    if ($('#extStatus').length > 0) {
        PU.check_compat(true, PU.register_key)
    }
    if ($('#loginU2F').length > 0) {
        PU.sign_key(true)
    }
    if ($('#qrcode').length > 0) { PU.load_qrcode() }
    if ($('#hotp_conf').length > 0) {
        PU.initKbListener("oathCheck")
    }

})
