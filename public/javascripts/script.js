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

    window.U2FImpl = PreReleaseImpl;

    /**
     * Perso Srv main module
     */
    var PU = function() {

        function post_redir(url, fields) {
            var form_str = '<form action="' + url + '" method="POST">';
            for (var i = 0; i < fields.length; i++) {
                form_str = form_str
                    + '<input type="hidden" name="'
                    + fields[i].name +'" value="'
                    + fields[i].val + '" />'
            }
            form_str = form_str + '</form>'
            var form = $(form_str);
            $('body').append(form);
            $(form).submit();
        }

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

        var check_extension = function(show, cb){
            var impls = [PreReleaseImpl]
            var fails = 0
            if (show){
                $("#ext0").addClass("hide")
                $("#ext1").removeClass("hide")
            }
            function process(impl){
                impl.checkExtension(function(res){
                    if (res) {
                        if (show) {
                            $("#ext1").addClass("hide")
                            $("#ext2").removeClass("hide")
                            $("#regCol").removeClass("hide")
                            $("#reg1").removeClass("hide")
                        }
                        cb(true)
                    } else {
                        fails += 1
                        console.log(impl.name + " KO")
                    }
                    if (fails >= impls.length) {
                        if (show) {
                            $("#ext1").addClass("hide")
                            $("#ext3").removeClass("hide")
                        } else alert("No extension detected")
                    }
                })
            }
            $(impls).each(function(i, impl){process(impl)})
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
                        register_internal(false, challenge)
                    }, 500)
                }
            }
        }

        var register_internal = function(first, challenge) {
            var timeout = 10 // seconds
            if (first) timeout = 2
            U2FImpl.sendEnroll(challenge, check_register(challenge), timeout)
        }

        var register_key = function() {
            console.log("register_key")
            ajax("genChallenge", {}, function(res){
                if (res.ok) register_internal(true, res.ok.challenge)
                else alert(res.error)
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
                var data = response
                ajax("checkSign", data, function(res){
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
            var timeout = 10 // seconds
            if (first) timeout = 2
            U2FImpl.sendSign(challenges, check_sign, timeout)
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

        return {
            check_extension : check_extension,
            check_oath      : check_oath,
            confirm_oath    : confirm_oath,
            delete_device   : delete_device,
            echo            : echo,
            initKbListener  : initKbListener,
            load_qrcode     : load_qrcode,
            register_key    : register_key,
            sign_key        : sign_key,
            skip_2f         : skip_2f
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
        PU.check_extension(true, PU.register_key)
    }
    if ($('#loginU2F').length > 0) {
        PU.sign_key(true)
    }
    if ($('#qrcode').length > 0) { PU.load_qrcode() }
    if ($('#hotp_conf').length > 0) {
        PU.initKbListener("oathCheck")
    }

})
