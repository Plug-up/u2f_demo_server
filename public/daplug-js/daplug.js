/* Daplug generic functions */
;(function(window, document, undef){

    /**
     * If already loaded, don't load it again
     */
    if (typeof window.Daplug !== typeof undef) return;

    var debug = true;
    var log = function(t){ if (debug) console.log(t) }

    /* Convert an interger to its hexadecimal
       representation with proper 0 padding
       If no size given, use size 2 */
    var toHex = function(num, len) {
        if (typeof len == typeof undef) len = 2
        var padding = Array(len).join("0")
        return (padding + num.toString(16)).substr(-len)
    }

    var DaplugUtils = function(){

        /* Compute a KCV for the PUT KEY command */
        var computeKCV = function(key) {
            var des = new DES(key)
            var zero = new ByteString("0000000000000000", HEX)
            var res = des.process(zero, DES.ENCRYPT, DES.MODE_CBC)
                .bytes(0, 3).toString(HEX)
            // log("KCV: " + key.toString(HEX) + " > " + res)
            return res
        }

        /* Add binary zeroes to a string to have a size multiple of 64 */
        var derive = function(key, deriveData, sequenceCounter) {
            var data = "01" + toHex(deriveData) + sequenceCounter
            data += "000000000000000000000000"
            var des = new DES(key)
            var res = des.process(new ByteString(data, HEX), DES.ENCRYPT, DES.MODE_CBC)
            // log("Derive: " + key.toString(HEX) + " " + toHex(deriveData) + " " + sequenceCounter)
            // log("> " + res.toString(HEX))
            return res
        }

        /* Sign data using the ENC session key */
        var signSEnc = function(sencKey, data) {
            var dataToSign = data.concat(new ByteString("8000000000000000", HEX))
            var des = new DES(sencKey)
            var res =  des.process(dataToSign, DES.ENCRYPT, DES.MODE_CBC)
            return res.bytes(res.length-8)
        }

        var desPad = function(src) {
            var data = new ByteString(src.toString(HEX), HEX)
            // log("DES PAD: " + data.toString(HEX))
            var len = data.length
            var paddingSize = 8 - (len % 8)
            var padding = new ByteString("8000000000000000", HEX)
            if (len == 0) return padding
            else if (paddingSize == 0) return data
            else return data.concat(padding.bytes(0, paddingSize))
        }

        var desUnpad = function(data) {
            var src = data.toString(HEX)
            function aux(i) {
                var sub = src.substr(i, 2)
                if (sub == "00") return aux(i-2)
                else if (sub == "80") return data.bytes(0, i/2)
                else return src
            }
            return aux(src.length - 2)
        }

        var retailMac = function(key, data, iv) {
            if (typeof iv == typeof undef)
                iv = new ByteString("0000000000000000", HEX)
            // log("RetailMac " + key.toString(HEX) + " + " + data.toString(HEX) + " + " + iv)
            var work = desPad(data)
            // Compute the retail mac
		    var macKey1 = key.bytes(0, 8)
		    var macKey2 = key.bytes(8)
		    var des1 = new DES(macKey1)
		    work = des1.process(work, DES.ENCRYPT, DES.MODE_CBC, iv)
		    work = new DES(macKey2).process(work.bytes(work.length - 8), DES.DECRYPT, DES.MODE_ECB)
		    work = des1.process(work, DES.ENCRYPT, DES.MODE_ECB)
            // log("-> " + work.toString(HEX))
		    return new ByteString(work.toString(HEX), HEX)
        }

        var encryptEnc = function(encKey, data) {
            // log("EncryptEnc " + encKey.toString(HEX) + " " + data.toString(HEX))
            var des = new DES(encKey)
            return des.process(desPad(data), DES.ENCRYPT, DES.MODE_CBC)
        }

        var randHex = function(length) {
            var chars = '0123456789abcdef'
            var result = '';
            for (var i = length; i > 0; --i)
                result += chars[Math.floor(Math.random() * chars.length)];
            return result;
        }

        return {
            computeKCV   : computeKCV,
            derive       : derive,
            desPad       : desPad,
            desUnpad     : desUnpad,
            encryptEnc   : encryptEnc,
            randHex      : randHex,
            retailMac    : retailMac,
            signSEnc     : signSEnc,

            empty : "" // Just so I don't have to bother about the final comma
        }
    }();

    /**
     * Daplug keyset type
     * No getter, directly access to things
     */
    function KeySet(version, key1, key2, key3) {
        var self = this
        self.usage = Daplug.KS.GP
        self.access = 0x0001
        self.version = version
        self.key1 = new ByteString(key1, HEX)
        if (typeof key2 != typeof undef) self.key2 = new ByteString(key2, HEX)
        else self.key2 = self.key1
        if (typeof key3 != typeof undef) self.key3 = new ByteString(key3, HEX)
        else self.key3 = self.key1

        self.setVersion = function(version) { self.version = version }

        self.setKey = function(id, key) {
            if (id == 1) self.key1 = key
            else if (id == 2) self.key2 == key
            else if (id == 3) self.key3 == key
            else log("setKey: Invalid key ID")
        }

        self.setKeyUsage = function(usage) { self.usage = usage }
        self.setKeyAccess = function(access) { self.access = access }
    }

    /**
     * Daplug keyboard type
     */
    function KeyBoard() {
        var self = this
        self.content = new ByteString("", HEX)

        function ct(bs){ self.content = self.content.concat(bs) }
        function cth(hex){ ct(new ByteString(hex, HEX)) }

        self.getContent = function(){
            return self.content
        }

        self.addOSProbe = function(nb, delay, code){
            if (typeof nb == typeof undef) nb = 0x10
            if (typeof delay == typeof undef) delay = 0xFFFF
            if (typeof code == typeof undef) code = 0x00
            cth("1004" + toHex(nb) + toHex(delay, 4) + toHex(code))
        }

        self.addOSProbeWinR = function(nb, delay, code){
            if (typeof nb == typeof undef) nb = 0x10
            if (typeof delay == typeof undef) delay = 0xFFFF
            if (typeof code == typeof undef) code = 0x00
            cth("0204" + toHex(nb) + toHex(delay, 4) + toHex(code))
        }

        self.addIfPc = function(){ cth("0E00") }

        self.addIfMac = function(){ cth("0F00") }

        self.addTextWindows = function(text) {
            var txtLen = text.length
            if (txtLen > 255) throw "Text too long"
            cth("04" + toHex(txtLen))
            ct(new ByteString(text, ASCII))
        }

        self.addTextMac = function(text, azerty, delay){
            if (typeof azerty == typeof undef) azerty = false
            if (typeof delay == typeof undef) delay = 0x1000
            var txtLen = text.length
            if (txtLen > 252) throw "Text too long"
            var az = 0
            if (azerty) az = 1
            cth("11" + toHex(txtLen + 3) + toHex(az) + toHex(delay, 4))
            ct(new ByteString(text, ASCII))
        }

        self.addKeycodeRaw = function(code){
            cth("09" + toHex(code.length/2) + code)
        }

        self.addKeycodeRelease = function(code){
            cth("03" + toHex(code.length/2) + code)
        }

        self.addHotpCode = function(flag, digits, keyset, counterFile, div){
            var data = toHex(flag) + toHex(digits) + toHex(keyset)
            if (typeof div !== typeof undef) data += div
            data += toHex(counterFile, 4)
            cth("50" + toHex(data.length/2) + data)
        }

        self.addReturn = function(){ cth("0D00") }

        self.addSleep = function(duration){
            if (typeof duration == typeof undef) duration = 0xffff
            if (duration > 0xffff) cth("0104" + toHex(duration, 8))
            else cth("0102" + toHex(duration, 4))
        }

        self.zeroPad = function(size){
            if (self.content.length > size) throw "Keyboard file too long"
            else cth(Array(size - self.content.length + 1).join("00"))
        }

    }

    /* Daplug main object */
    function DaplugDongle(card) {
        var self = this
        self.name = ""
        self.card = card

        /* HW SC values */
        self.sam = undef
        self.samCtxKeyVer = 0
        self.samCtxKeyID = 0

        /* Init Secure Channel values */
        self.sessionOpen = false
        self.securityLevel = 0
        self.sencKey = ""
        self.cmacKey = ""
        self.rmacKey = ""
        self.sdekKey = ""
        self.rencKey = ""
        self.cmac = new ByteString("0000000000000000", HEX)
        self.rmac = new ByteString("0000000000000000", HEX)

        /* Exchange a raw apdu (bytestring format) */
        var exchangeRawApdu = function(apdu, cb, errCb) {
            log(self.name + " > "+apdu.toString(HEX))
            card.sendApdu(apdu).then(function(response) {
                log(self.name + " < (" + card.SW.toString(16) + ") " + response.toString(HEX))
                setTimeout(function(){cb(response, card.SW)}, 0)
            }, function(e) {
                console.log("Error exchanging APDU: "+e)
                errCb()
            });
        }

        var wrap = function(apdu) {
            return function(cb, errCb){
                var securityLevel = self.securityLevel
                if (!self.sessionOpen) securityLevel = Daplug.C_MAC
                // log("Wrapping apdu: " + apdu.toString(HEX) + " " + toHex(securityLevel) + " " + toHex(self.securityLevel))
                function returnApdu(workApdu){
                    if (!self.sessionOpen) {
                        self.rmac = self.cmac
                        self.sessionOpen = true
                    }
                    cb(new ByteString(workApdu.toString(HEX), HEX))
                }
                function addCMAC(workApdu){
                    if (securityLevel & Daplug.C_MAC) {
                        returnApdu(workApdu.concat(self.cmac))
                    } else returnApdu(workApdu)
                }
                function addCDEC(workApdu, apduData){
                    var newLen = apduData.length
                    if (securityLevel & Daplug.C_MAC) newLen += 8
                    var lenBS = new ByteString(toHex(newLen), HEX)
                    addCMAC(workApdu.bytes(0, 4).concat(lenBS).concat(apduData))
                }
                function computeCDEC(workApdu){
                    if (securityLevel & Daplug.C_DEC) {
                        if (typeof self.sam == typeof undef) {
                            var apduData = DaplugUtils.encryptEnc(self.sencKey, apdu.bytes(5))
                            addCDEC(workApdu, apduData)
                        } else {
                            self.sam.encryptEnc(
                                self.samCtxKeyVer, self.samCtxKeyID,
                                self.sencKey, apdu.bytes(5)
                            )(function(apduData){
                                addCDEC(workApdu, apduData)
                            }, errCb)
                        }
                    } else addCMAC(workApdu)
                }
                function computeCMAC(workApdu){
                    if (securityLevel & Daplug.C_MAC) {
                        var workApduForMac = workApdu
                        if (self.sessionOpen) workApduForMac = self.cmac.concat(workApdu)
                        // log("Work APDU for MAC: " + workApduForMac.toString(HEX))
                        if (typeof self.sam == typeof undef) {
                            self.cmac = DaplugUtils.retailMac(self.cmacKey, workApduForMac)
                            computeCDEC(workApdu)
                        } else {
                            self.sam.computeRetailMac(
                                Daplug.SAM.SIGN_CMAC, self.samCtxKeyVer,
                                self.samCtxKeyID, self.cmacKey, workApduForMac
                            )(function(cmac){
                                self.cmac = cmac
                                computeCDEC(workApdu)
                            }, errCb)
                        }
                    } else computeCDEC(workApdu)
                }
                var workApdu = new ByteString(apdu.bytes(0, 1).toString(HEX)[0]+"4", HEX)
                workApdu = workApdu.concat(apdu.bytes(1, 3))
                var len = parseInt(apdu.bytes(4, 1).toString(HEX), 16)
                workApdu = workApdu.concat(new ByteString(toHex(len+8), HEX))
                workApdu = workApdu.concat(apdu.bytes(5))
                // log("Work APDU: " + workApdu.toString(HEX))
                computeCMAC(workApdu)
            }
        }

        var unwrap = function(apdu, answer, sw) {
            return function(cb, errCb){
                // log("Unwrapping answer: " + answer.toString(HEX))
                if (typeof sw == typeof undef) sw = 0x9000
                var securityLevel = self.securityLevel
                function calcRMAC(data){
                    if (securityLevel & Daplug.R_MAC) {
                        var len = new ByteString(toHex(data.length), HEX)
                        var swbs = new ByteString(toHex(sw, 4), HEX)
                        var workAnswerForMac = apdu.concat(len).concat(data).concat(swbs)
                        function checkRMAC(calcRmac){
                            var cardRmac = answer.bytes(answer.length-8)
                            if (!cardRmac.equals(calcRmac)) {
                                var msg = "Invalid card RMAC " + cardRmac.toString(HEX) + " vs " + calcRmac.toString(HEX)
                                log(msg)
                                errCb()
                            } else {
                                self.rmac = cardRmac
                                cb(data)
                            }
                        }
                        if (typeof self.sam == typeof undef) {
                            checkRMAC(DaplugUtils.retailMac(self.rmacKey, workAnswerForMac, self.rmac))
                        } else {
                            self.sam.computeRetailMac(
                                Daplug.SAM.SIGN_RMAC,
                                self.samCtxKeyVer, self.samCtxKeyID,
                                self.rmacKey, workAnswerForMac, self.rmac
                            )(checkRMAC, errCb)
                        }
                    } else cb(data)
                }
                function decryptRENC(data){
                    if (securityLevel & Daplug.R_ENC) {
                        if (typeof self.sam == typeof undef) {
                            var des = new DES(self.rencKey)
                            var decyph = DaplugUtils.desUnpad(des.process(data, DES.DECRYPT, DES.MODE_CBC))
                            // log("Decyphered: " + decyph.toString(HEX) + " " + decyph.toString(HEX).length)
                            checkRMAC(decyph)
                        } else {
                            self.sam.decryptREnc(
                                self.samCtxKeyVer, self.samCtxKeyID,
                                self.rencKey, data
                            )(calcRMAC, errCb)
                        }
                    } else calcRMAC(data)
                }
                function getAnsData(){
                    if (securityLevel & Daplug.R_MAC)
                        decryptRENC(answer.bytes(0, answer.length - 8))
                    else decryptRENC(answer)
                }
                getAnsData()
            }
        }

        /* Exchange an APDU with proper wrapping */
        var exchangeApdu = function(apdu) {
            return function(cb, errCb) {
                // log(">> " + apdu)
                var bsApdu = new ByteString(apdu, HEX);
                function doSend(finalApdu) {
                    exchangeRawApdu(finalApdu, function(res, sw){
                        function checkSw(ans) {
                            // console.log("Checking status word")
                            if (sw != 0x9000) {
                                console.error("Invalid status word: " + toHex(sw, 4))
                                if (errCb) errCb(sw)
                            } else cb(ans)
                        }
                        if (self.sessionOpen)
                            unwrap(bsApdu, res, sw)(checkSw, errCb)
                        else checkSw(res)
                    }, errCb)
                }
                if (self.sessionOpen) wrap(bsApdu)(doSend)
                else doSend(bsApdu)
            }
        }

        /* Convenience alternativ to previous function */
        var exchangeApdu2 = function(header, msg) {
            var l = msg.length / 2
            var full = header + toHex(l) + msg
            return exchangeApdu(full)
        }
        // For SAM interface
        self.__exchangeApdu2 = exchangeApdu2

        self.getSerial = exchangeApdu("80e6000000")

        self.getStatus = exchangeApdu("80f2400000")
        self.setStatus = function(status){
            return exchangeApdu("80f040" + toHex(status) + "00")
        }

        var processInitUpdate = function(keys, mode, hostChallenge, ans) {
            return function(cb, errCb){
                // log("Dongle response: " + ans.toString(HEX))
                var sequenceCounter = ans.bytes(12, 2).toString(HEX)
                log("sequenceCounter: " + sequenceCounter)
                var cardChallenge = ans.bytes(12, 8)
                // log("cardChallenge: " + cardChallenge.toString(HEX))
                var cardCryptogram = ans.bytes(20, 8)
                // log("cardCryptogram: " + cardCryptogram.toString(HEX))
                self.sencKey = DaplugUtils.derive(keys.key1, "82", sequenceCounter)
                var calcCryptogram = DaplugUtils.signSEnc(self.sencKey, hostChallenge.concat(cardChallenge))
                if (!calcCryptogram.equals(cardCryptogram)) {
                    log("Invalid card cryptogram " + calcCryptogram.toString(HEX) + " vs " + cardCryptogram.toString(HEX))
                    throw "Invalid card cryptogram"
                } // else log("Card cryptogram OK")
                var hostCryptogram = DaplugUtils.signSEnc(self.sencKey, cardChallenge.concat(hostChallenge))
                // log("Host cryptogram: " + hostChallenge.toString(HEX))
                self.cmacKey = DaplugUtils.derive(keys.key2, "01", sequenceCounter)
                self.rmacKey = DaplugUtils.derive(keys.key1, "02", sequenceCounter)
                self.sdekKey = DaplugUtils.derive(keys.key3, "81", sequenceCounter)
                self.rencKey = DaplugUtils.derive(keys.key1, "83", sequenceCounter)
                // log("Key derivations done")
                self.securityLevel = mode
                self.cmac = new ByteString("0000000000000000", HEX)
                self.rmac = new ByteString("0000000000000000", HEX)
                var extAuthApdu = new ByteString("8082" + toHex(mode) + "0008", HEX).concat(hostCryptogram)
                wrap(extAuthApdu)(function(wrapped){
                    // log("Resulting APDU: " + externalAuthenticate.toString(HEX))
                    exchangeRawApdu(wrapped, function(){
                        cb()
                    }, function(){
                        log("External authenticate failed")
                        errCb()
                    })
                })
            }
        }

        self.deAuthenticate = function(){
            self.sessionOpen = false
            self.name = ""

            self.sam = undef
            self.samCtxKeyVer = 0
            self.samCtxKeyID = 0

            self.securityLevel = 0
            self.sencKey = ""
            self.cmacKey = ""
            self.rmacKey = ""
            self.sdekKey = ""
            self.rencKey = ""
            self.cmac = new ByteString("0000000000000000", HEX)
            self.rmac = new ByteString("0000000000000000", HEX)
        }

        /* Authenticate dongle */
        self.authenticate = function(keys, mode) {
            return function(cb, errCb){
                self.deAuthenticate()
                log("Starting authentication")
                var u = typeof undef
                if (typeof keys.key1 == u || typeof keys.key2 == u || typeof keys.key2 == u) {
                    log("Missing key")
                    console.error("No key provided")
                    errCb()
                }
                var hostChallenge = new ByteString(DaplugUtils.randHex(16), HEX)
                log("host challenge: " + hostChallenge.toString(HEX))
                var initUpdate = new ByteString("8050" + toHex(keys.version) + "0008", HEX).concat(hostChallenge)
                // log("initUpdate APDU: " + initUpdate.toString(HEX))

                exchangeRawApdu(initUpdate, function(ans){
                    processInitUpdate(keys, mode, hostChallenge, ans)(cb, errCb)
                }, function(){
                    log("Initialize update failed")
                    errCb()
                })
            }
        }

        var processInitUpdateSam = function(samGPKeyVer, cardKeyVer, mode, hostChallenge, ans, div1, div2) {
            return function(cb, errCb){
                log("Dongle response: " + ans.toString(HEX))
                var sequenceCounter = ans.bytes(12, 2).toString(HEX)
                log("sequenceCounter: " + sequenceCounter)
                var cardChallenge = ans.bytes(12, 8)
                // log("cardChallenge: " + cardChallenge.toString(HEX))
                var cardCryptogram = ans.bytes(20, 8)

                // Generate session keys
                var flags = Daplug.SAM.GENERATE_DEK + Daplug.SAM.GENERATE_RMAC + Daplug.SAM.GENERATE_RENC
                if (typeof div1 != typeof undef) flags += 1
                if (typeof div2 != typeof undef) flags += 1
                function doSendApdu(wrapped){
                    // log("Resulting APDU: " + externalAuthenticate.toString(HEX))
                    exchangeRawApdu(wrapped, function(){
                        cb()
                    }, function(){
                        log("External authenticate failed")
                        errCb()
                    })
                }
                function buildApdu(hostCryptogram){
                    self.securityLevel = mode
                    self.cmac = new ByteString("0000000000000000", HEX)
                    self.rmac = new ByteString("0000000000000000", HEX)
                    var extAuthApdu = new ByteString("8082" + toHex(mode) + "0008", HEX).concat(hostCryptogram)
                    wrap(extAuthApdu)(doSendApdu)
                }
                function processCryptograms(){
                    var zero8 = new ByteString(new Array(9).join("00"), HEX)
                    var zero9 = new ByteString(new Array(10).join("00"), HEX)
                    self.sam.sign(
                        Daplug.SAM.SIGN_ENC, self.samCtxKeyVer, self.samCtxKeyID,
                        self.sencKey, zero8, zero9,
                        hostChallenge.concat(cardChallenge), true
                    )(function(calcCryptogram){
                        if (!calcCryptogram.equals(cardCryptogram)) {
                            log("Invalid card cryptogram " + calcCryptogram.toString(HEX) + " vs " + cardCryptogram.toString(HEX))
                            throw "Invalid card cryptogram"
                        } else {
                            self.sam.sign(
                                Daplug.SAM.SIGN_ENC, self.samCtxKeyVer, self.samCtxKeyID,
                                self.sencKey, zero8, zero9,
                                cardChallenge.concat(hostChallenge), true
                            )(buildApdu)
                        }
                    })
                }
                self.sam.diversifyGP(
                    self.samCtxKeyVer, self.samCtxKeyID, samGPKeyVer,
                    flags, sequenceCounter, div1, div2
                )(function(keys){
                    self.sencKey = keys[0]
                    self.cmacKey = keys[1]
                    self.sdekKey = keys[2]
                    self.rmacKey = keys[3]
                    self.rencKey = keys[4]
                    processCryptograms()
                })
            }
        }

        /* Authenticate dongle */
        self.authenticateSam = function(sam, samCtxKeyVer, samCtxKeyID, samGPKeyVer, cardKeyVer, mode, div1, div2) {
            return function(cb, errCb){
                self.deAuthenticate()
                self.name = "CARD"
                log("Starting authentication")
                self.sam = sam
                self.samCtxKeyVer = samCtxKeyVer
                self.samCtxKeyID = samCtxKeyID
                var hostChallenge = new ByteString(DaplugUtils.randHex(16), HEX)
                // new ByteString("12498c71528f4a42", HEX)
                log("host challenge: " + hostChallenge.toString(HEX))
                var initUpdate = new ByteString("8050" + toHex(cardKeyVer) + "0008", HEX).concat(hostChallenge)
                // log("initUpdate APDU: " + initUpdate.toString(HEX))
                // var ans = new ByteString("8094a08a897b76b4126942020001ea3a2f5b4b83a82a43d075c749c7", HEX)
                // processInitUpdateSam(samGPKeyVer, cardKeyVer, mode, hostChallenge, ans, div1, div2)(cb, errCb)
                exchangeRawApdu(initUpdate, function(ans){
                    if (ans.length > 0) {
                        processInitUpdateSam(samGPKeyVer, cardKeyVer, mode, hostChallenge, ans, div1, div2)(cb, errCb)
                    } else errCb()
                }, function(){
                    log("Initialize update failed")
                    errCb()
                })
            }
        }

        self.putKey = function(key) {
            return function(cb, errCb){
                var u = typeof undef
                if (typeof key.key1 == u || typeof key.key2 == u || typeof key.key3 == u) {
                    console.error("Missing key")
                    errCb(0x8001)
                } else {
                    var header = "80D8" + toHex(key.version) + "81"
                    var msg = toHex(key.version)
                    function aux(k){
                        var res = "FF8010"
                        var des = new DES(self.sdekKey)
                        var crypt = des.process(k, DES.ENCRYPT, DES.MODE_ECB)
                        res += crypt.toString(HEX)
                        res += "03" + DaplugUtils.computeKCV(k)
                        res += "01" + toHex(key.usage)
                        res += "02" + toHex(key.access, 4)
                        return res
                    }
                    msg += aux(key.key1)
                    msg += aux(key.key2)
                    msg += aux(key.key3)
                    exchangeApdu2(header, msg)(cb, errCb)
                }
            }
        }

        self.createFile = function(fileID, size, access, tag) {
            if (typeof access == typeof undef) access = Daplug.ACCESS_ALWAYS
            var header = "80E00000"
            var msghead = "62"
            var msgCont = "820201218302" + toHex(fileID, 4) + "8102" + toHex(size, 4) + "8C0600"
            msgCont += toHex(access) + "0000" + toHex(access) + toHex(access)
            if (typeof tag !== typeof undef) msgCont += tag
            var contLength = msgCont.length / 2
            var msg = msghead + toHex(contLength) + msgCont
            log(header + " " + msg)
            return exchangeApdu2(header, msg)
        }

        self.createCounterFile = function(fileID){
            return function(cb, errCb) {
                self.selectPath([Daplug.MASTER_FILE, 0xC010])(function(){
                    self.createFile(fileID, 8, Daplug.ACCESS_ALWAYS, "870101")(function(){
                        // Start the counter at 1
                        var cont = new ByteString("0000000000000001", HEX)
                        self.write(0, cont)(cb, errCb)
                    }, errCb)
                })
            }
        }

        self.createDir = function(fileID, access){
            var header = "80E00000"
            var msg = "620E820232218302" + toHex(fileID, 4) + "8C0400"
            msg += toHex(access) + toHex(access) + toHex(access)
            return exchangeApdu2(header, msg)
        }

        self.deleteFileOrDir = function(fileID) {
            var apdu = "80E4000002" + toHex(fileID, 4)
            return exchangeApdu(apdu)
        }

        self.selectFile = function(fileID) {
            var apdu = "80A4000002" + toHex(fileID, 4)
            return exchangeApdu(apdu)
        }

        self.selectPath = function(fileIDs) {
            return function(cb, errCb) {
                log("Selecting path: " + fileIDs)
                var nb = fileIDs.length
                function aux(i) {
                    if (i == nb) cb()
                    else self.selectFile(fileIDs[i])(function(){aux(i+1)}, errCb)
                }
                aux(0)
            }
        }

        self.deleteKeys = function(keyVersions) {
            return function(cb, errCb) {
                self.selectPath([Daplug.MASTER_FILE, 0xc00f, 0xc0de, 0x0001])(
                    function(){
                        var nb = keyVersions.length
                        function aux(i){
                            log("Del key " + i)
                            if (i == nb) self.selectFile(Daplug.MASTER_FILE)(cb, errCb)
                            else self.deleteFileOrDir(0x1000 + keyVersions[i])(
                                function(){aux(i+1)}, errCb)
                        }
                        aux(0)
                    }, errCb
                )
            }
        }

        self.deleteKey = function(keyVersion) {
            return function(cb, errCb) {
                self.deleteKeys([keyVersion])(cb, errCb)
            }
        }

        self.read = function(offset, length) {
            return function(cb, errCb) {
                var partLen = 0xEF // Maximum of data fetched in one APDU
                function aux(data, subOffset, remaining) {
                    if (remaining <= 0) cb(data.bytes(0, length))
                    else {
                        var ll = Math.min(partLen, remaining)
                        var apdu = "80B0" + toHex(subOffset, 4)
                        if (self.sessionOpen) apdu += "00"
                        else apdu += toHex(ll)
                        exchangeApdu(apdu)(function(subData){
                            aux(data.concat(subData.bytes(0, ll)), subOffset + ll, remaining - ll)
                        }, errCb)
                    }
                }
                aux(new ByteString("", HEX), offset, length)
            }
        }

        self.write = function(offset, data) {
            return function(cb, errCb) {
                var partLen = 0xEF // Maximum of data written in one APDU
                function aux(subOffset, idx, remaining) {
                    if (remaining <= 0) cb()
                    else {
                        var ll = Math.min(partLen, remaining)
                        var apdu = "80D6" + toHex(subOffset, 4)
                        var subdata = data.bytes(idx, ll).toString(HEX)
                        exchangeApdu2(apdu, subdata)(function(){
                            aux(subOffset + ll, idx + ll, remaining - ll)
                        }, errCb)
                    }
                }
                aux(offset, 0, data.length)
            }
        }

        var cryptDecrypt = function(keyVersion, keyID, act, mode, data, iv, div1, div2) {
            return function(cb, errCb) {
                log("data: (" + data.length + ") " + data.toString(HEX))
                if (data.length % 8 != 0) {
                    console.error("Data length must be a multiple of 8 bytes")
                    errCb()
                }
                var header = "D020" + toHex(act) + toHex(mode)
                var cont = toHex(keyVersion) + toHex(keyID)

                if (typeof iv == typeof undef || iv == "") cont += "0000000000000000"
                else cont += iv.toString(HEX)
                if (typeof div1 != typeof undef) cont += div1.toString(HEX)
                if (typeof div2 != typeof undef) cont += div2.toString(HEX)
                cont += data.toString(HEX)
                exchangeApdu2(header, cont)(cb, errCb)
            }
        }

        self.encrypt = function(keyVersion, keyID, mode, data, iv, div1, div2) {
            return cryptDecrypt(keyVersion, keyID, 1, mode, data, iv, div1, div2)
        }

        self.decrypt = function(keyVersion, keyID, mode, data, iv, div1, div2) {
            return cryptDecrypt(keyVersion, keyID, 2, mode, data, iv, div1, div2)
        }

        self.hmac = function(keyVersion, options, data, div1, div2){
            var header = "D022" + toHex(keyVersion) + toHex(options)
            var cont = ""
            if (typeof div1 != typeof undef) cont += div1.toString(HEX)
            if (typeof div2 != typeof undef) cont += div2.toString(HEX)
            cont += data.toString(HEX)
            return exchangeApdu2(header, cont)
        }

        var splitKey = function(keyVersion, key){
            var padding = new ByteString(Array(49).join("00"), HEX)
            var paddedKey = key.concat(padding)
            var res = new KeySet(
                keyVersion,
                paddedKey.bytes(0, 16).toString(HEX),
                paddedKey.bytes(16, 16).toString(HEX),
                paddedKey.bytes(32, 16).toString(HEX)
            )      
            console.dir(res)
            console.log(res.key1.toString(HEX))
            console.log(res.key2.toString(HEX))
            console.log(res.key3.toString(HEX))
            return res
        }

        self.setHotpKey = function(keyVersion, key){
            var hotpKey = splitKey(keyVersion, key)
            var keyLen = key.length
            hotpKey.setKeyAccess(keyLen)
            hotpKey.setKeyUsage(Daplug.KS.HOTP)
            return self.putKey(hotpKey)
        }

        self.setTotpKey = function(keyVersion, timeKeyVersion, key){
            var totpKey = splitKey(keyVersion, key)
            var keyLen = key.length
            totpKey.setKeyAccess((timeKeyVersion << 8) + keyLen)
            totpKey.setKeyUsage(Daplug.KS.TOTP)
            return self.putKey(totpKey)
        }

        self.setTotpTimeKey = function(keyVersion, hexKey){
            var timeKey = new KeySet(keyVersion, hexKey.toString(HEX))
            timeKey.setKeyAccess(0x0001)
            timeKey.setKeyUsage(Daplug.KS.TOTP_TIME_SRC)
            return self.putKey(timeKey)
        }

        self.setTimeOTP = function(keyVersion, keyID, key, curTime, step){
            if (typeof step == typeof undef) step = 30
            if (typeof curTime == typeof undef)
                curTime = Math.floor(Date.now()/1000)
            var header = "D0B2" + toHex(keyVersion) + toHex(keyID)
            var timeRef = DaplugUtils.randHex(22) + "1E" + toHex(curTime, 8)
            var des = new DES(key)
            var sig = des.process(new ByteString(timeRef, HEX), DES.ENCRYPT, DES.MODE_CBC)
            timeRef += sig.bytes(8).toString(HEX)
            return exchangeApdu2(header, timeRef)
        }

        self.totp = function(keyVersion, options, div1, div2){
            return function(cb, errCb) {
                self.hmac(keyVersion, options, "", div1, div2)(
                    function(ans){cb(ans.toString(ASCII))}, errCb
                )
            }
        }

        self.useAsKeyboard = exchangeApdu("D032000000")
        self.reset = exchangeApdu("D052010000")

        self.setKeyboardAtBoot = function(activated) {
            var apdu = "D032"
            if (activated) apdu += "020000"
            else apdu += "010000"
            return exchangeApdu(apdu)
        }

        self.triggerKeyboard = exchangeApdu("D030010000")

        self.getChipDiversifier = function(cb, errCb){
            self.getSerial(function(sn){
                var res = sn.bytes(0, 10)
                var ext = ""
                for (var i=0; i<6; i++) {
                    ext += toHex(sn.byteAt(i) ^ 0x42)
                }
                cb(res.concat(new ByteString(ext, HEX)))
            }, errCb)
        }

    }

    function DaplugSAM(dongle) {
        var self = this
        var BLOCK = 0xD8
        dongle.name = "SAM"
        self.d = dongle

        var exchangeApdu2 = self.d.__exchangeApdu2

        self.diversifyGP = function(keyVer, keyID, gpKeyVer, flags, seq, div1, div2){
            return function(cb, errCb) {
                var header = "D0700010"
                var msg = toHex(keyVer) + toHex(keyID) + toHex(gpKeyVer)
                msg += toHex(flags) + seq
                if (typeof div1 != typeof undef) msg += div1.toString(HEX)
                if (typeof div2 != typeof undef) msg += div2.toString(HEX)
                exchangeApdu2(header, msg)(function(res){
                    var i = 0, splitted = []
                    while (i < res.length) {
                        splitted.push(res.bytes(i, 24)); i += 24
                    }
                    cb(splitted)
                }, errCb)
            }
        }

        self.diversifyPutKey = function(keyVer, keyID, samProvKeyVer, dekSess, div1, div2) {
            return function(cb, errCb) {
                var header = "D0700020"
                var flags = 0
                if (typeof div1 != typeof undef) flags += 1
                if (typeof div2 != typeof undef) flags += 1
                var msg = toHex(keyVer) + toHex(keyID) + toHex(samProvKeyVer)
                msg += toHex(flags) + dekSess.toString(HEX)
                if (typeof div1 != typeof undef) msg += div1.toString(HEX)
                if (typeof div2 != typeof undef) msg += div2.toString(HEX)
                exchangeApdu2(header, msg)(function(res){
                    cb({
                        key1: res.bytes(0, 16),
                        kcv1: res.bytes(16, 3),
                        key2: res.bytes(19, 16),
                        kcv2: res.bytes(35, 3),
                        key3: res.bytes(38, 16),
                        kcv3: res.bytes(54, 3)
                    })
                }, errCb)
            }
        }

        self.diversifyCleartext = function(keyVer, div1, div2) {
            return function(cb, errCb){
                var header = "D0700030"
                var flags = 0
                if (typeof div1 != typeof undef) flags += 1
                if (typeof div2 != typeof undef) flags += 1
                var msg = toHex(keyVer) + toHex(flags)
                if (typeof div1 != typeof undef) msg += div1.toString(HEX)
                if (typeof div2 != typeof undef) msg += div2.toString(HEX)
                exchangeApdu2(header, msg)(function(res){
                    cb({
                        key1: res.bytes(0, 16),
                        key2: res.bytes(16, 16),
                        key3: res.bytes(32, 16)
                    })
                }, errCb)
            }
        }

        var cryptDecrypt = function(act, keyVer, keyID, sess, iv, cipherCtx, content, lastBlock) {
            header = "D072"
            if (lastBlock) header += "80"
            else header += "00"
            header += toHex(act)
            var msg = toHex(keyVer) + toHex(keyID)
            msg += sess.toString(HEX) + iv.toString(HEX)
            msg += cipherCtx.toString(HEX) + content.toString(HEX)
            return exchangeApdu2(header, msg)
        }

        var encryptEncInt = function(keyVer, keyID, cEncSess, iv, cipherCtx, content, lastBlock) {
            if (content.length % 8) throw "Content length must be a multiple of 8 bytes"
            return cryptDecrypt(0x10, keyVer, keyID, cEncSess, iv, cipherCtx, content, lastBlock)
        }

        var encryptDekInt = function(keyVer, keyID, dekSess, content, lastBlock) {
            var iv = new ByteString(new Array(9).join("00"), HEX)
            var cipherCtx = new ByteString(new Array(10).join("00"), HEX)
            return cryptDecrypt(0x20, keyVer, keyID, dekSess, iv, cipherCtx, content, lastBlock)
        }

        var decryptREncInt = function(keyVer, keyID, rEncSess, iv, cipherCtx, content, lastBlock) {
            return cryptDecrypt(0x30, keyVer, keyID, rEncSess, iv, cipherCtx, content, lastBlock)
        }

        self.sign = function(act, keyVer, keyID, sess, iv, signCtx, content, lastBlock) {
            var header = "D074"
            if (lastBlock) header += "80"
            else header += "00"
            header += toHex(act)
            var msg = toHex(keyVer) + toHex(keyID)
            msg += sess.toString(HEX) + iv.toString(HEX)
            msg += signCtx.toString(HEX) + content.toString(HEX)
            return exchangeApdu2(header, msg)
        }

        var multiprocess = function(act, data, iv) {
            return function(cb, errCb){
                if (typeof iv == typeof undef)
                    iv = new ByteString(new Array(9).join("00"), HEX)
                var context = new ByteString(new Array(10).join("00"), HEX)
                var nbParts = 1 + Math.floor(data.length/BLOCK)
                function aux(i, acc, iv, context){
                    var last = i == (nbParts - 1)
                    var cont = data.bytes(i*BLOCK, BLOCK)
                    act(iv, context, cont, last)(
                        function(res){
                            if (last) cb(acc.concat(res))
                            else aux(
                                i+1, acc.concat(res.bytes(17)),
                                res.bytes(0, 8), res.bytyes(8, 9)
                            )
                        }, errCb
                    )
                }
                aux(0, new ByteString("", HEX), iv, context)
            }
        }

        self.computeRetailMac = function(act, keyVer, keyID, sess, data, iv) {
            function aux(iv, context, cont, last) {
                return self.sign(act, keyVer, keyID, sess, iv, context, cont, last)
            }
            return multiprocess(aux, data, iv)
        }

        self.encryptEnc = function(keyVer, keyID, sess, data) {
            function aux(iv, context, cont, last) {
                return encryptEncInt(keyVer, keyID, sess, iv, context, cont, last)
            }
            return multiprocess(aux, data)
        }

        self.decryptREnc = function(keyVer, keyID, sess, data) {
            function aux(iv, context, cont, last) {
                return decryptREncInt(keyVer, keyID, sess, iv, context, cont, last)
            }
            return multiprocess(aux, data)
        }

    }

    var DaplugVars = {};

    var Daplug = function() {

        var initDaplug = function() {
            log("Initializing Daplug")
            DaplugVars.terminalFactory = new ChromeapiPlugupCardTerminalFactory()
        }

        var checkInit = function() {
            return (typeof DaplugVars.terminalFactory != typeof undef)
        }

        var getDongleList = function(cb) {
            log("Scanning devices")
            DaplugVars.terminalFactory.list().then(function(lst){
                log(lst.length + " device(s) scanned")
                cb(lst)
            })
        }

        var getDongle = function(device){
            return function(cb) {
                log("Selecting dongle")
                DaplugVars.terminalFactory.getCardTerminal(device).getCard().then(function(card) {
                    setTimeout(function(){
                        log("Dongle selected")
                        var dongle = new DaplugDongle(card)
                        cb(dongle)
                    }, 0)
                })
            }
        }

        var getFirstDongle = function(cb) {
            getDongleList(function(devices){
                getDongle(devices[0])(cb)
            })
        }

        function decodeBase32(value) {
            value = value.toUpperCase().replace(/\s+/g, ' ');
            var result = "";
            var buffer = 0;
            var bitsLeft = 0;
            for (var i=0; i<value.length; i++) {
                var ch = value.charAt(i);
                if ([' ', '\t', '\r', '\n','-'].indexOf(ch) >= 0) {
                    continue;
                }
                buffer <<= 5;
                buffer &= 0xffffffff;
                if (ch == '0') ch = 'O'
                else if (ch == '1') ch = 'L'
                else if (ch == '8') ch = 'B'

                if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
                    ch = value.charCodeAt(i);
                    ch = (ch & 0x1f) - 1;
                } else if (ch >= '2' && ch <= '7') {
                    ch = value.charCodeAt(i);
                    ch -= 24;
                } else return
                buffer |= ch;
                bitsLeft += 5;
                if (bitsLeft >= 8) {
                    var x = (buffer >> (bitsLeft - 8)) % 0x100;
                    if (x < 0) x = (0x100 + x);
                    result += Convert.toHexByte(x);
                    bitsLeft -= 8;
                }
            }
            return new ByteString(result, HEX);
        }

        return {
            // Sub modules
            KeyBoard : KeyBoard,
            KeySet   : KeySet,
            // Utils    : DaplugUtils,

            // Generic functions
            checkInit      : checkInit,
            decodeBase32   : decodeBase32,
            getDongle      : getDongle,
            getDongleList  : getDongleList,
            getFirstDongle : getFirstDongle,
            initDaplug     : initDaplug,

            // GP Constants
            C_MAC : 0x01,
            C_DEC : 0x02,
            R_MAC : 0x10,
            R_ENC : 0x20,

            // File contants
            MASTER_FILE   : 0x3f00,
            ACCESS_ALWAYS : 0x00,
            ACCESS_NEVER  : 0xFF,

            // KeySet constants
            KS: {
                GP                      : 0x01,
                GP_AUTH                 : 0x02,
                HOTP                    : 0x03,
                HOTP_VALIDATION         : 0x04,
                OTP                     : 0x05,
                ENC                     : 0x06,
                DEC                     : 0x07,
                ENC_DEC                 : 0x08,
                SAM_CTX                 : 0x09,
                SAM_GP                  : 0x01,
                SAM_DIV1                : 0x0B,
                SAM_DIV2                : 0x0C,
                SAM_CLEAR_EXPORT_DIV1   : 0x0D,
                SAM_CLEAR_EXPORT_DIV2   : 0x0E,
                IMPORT_EXPORT_TRANSIENT : 0x0F,
                TOTP_TIME_SRC           : 0x10,
                TOTP                    : 0x11,
                HMAC_SHA1               : 0x12
            },

            // Encrypt/Decrypt Constants
            CRYPT: {
                ECB  : 0x01,
                CBC  : 0x02,
                DIV1 : 0x04,
                DIV2 : 0x08
            },

            // xOTP Constants
            OTP: {
                DIV_0      : 0x00,
                DIV_1      : 0x01,
                DIV_2      : 0x02,
                DIGIT_6    : 0x10,
                DIGIT_7    : 0x20,
                DIGIT_8    : 0x40,
                DATA_FILE  : 0x80
            },

            // SAM constants
            SAM: {
                DIV1          : 0x01,
                DIV2          : 0x02,
                GENERATE_DEK  : 0x04,
                GENERATE_RMAC : 0x08,
                GENERATE_RENC : 0x10,

                // act for sign
                SIGN_ENC  : 0x10,
                SIGN_CMAC : 0x20,
                SIGN_RMAC : 0x30
            },

            empty : "" // Just so I don't have to bother about the final comma
        }

    }();

    window.Daplug    = Daplug
    window.DaplugSAM = DaplugSAM

})(window, document);

