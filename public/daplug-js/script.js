;(function(window, document, undef){

    var dongle = undefined;

    /**
     * If already loaded, don't load it again
     */
    if (typeof window.DP !== typeof undef) return;

    /* Convert an interger to its hexadecimal
       representation with proper 0 padding
       If no size given, use size 2 */
    var toHex = function(num, len) {
        if (typeof len == typeof undef) len = 2
        var padding = Array(len).join("0")
        return (padding + num.toString(16)).substr(-len)
    }

    var DP = function() {

        var kbPrefix = "lll"
        var kbSuffix = "vvv"

        function commonAuth(then, err){
            var ks = new Daplug.KeySet(0x01, "404142434445464748494A4B4C4D4E4F")
            var secu = Daplug.C_MAC //+ Daplug.C_DEC + Daplug.R_MAC + Daplug.R_ENC
            console.debug("Authenticating")
            Daplug.getFirstDongle(function(firstDongle){
                dongle = firstDongle
                console.debug("First dongle selected")
                dongle.authenticate(ks, secu)(then, err)
            })  
        }

        var configure = function(keyStr){
            $("#configuring").removeClass("hide")
            var hotpVer = 0x02
            console.log(keyStr)
            var hotpKey = new ByteString(keyStr, HEX)
            var counterFile = 0x1001
            var kbFile = 0x0800
            var kbLen = 64
            function err() {
                $("#configuring").addClass("hide")
                $("#err").removeClass("hide")
            }
            function activate(){
                console.debug("Activating dongle")
                dongle.useAsKeyboard(function(){
                    dongle.setKeyboardAtBoot(true)(function(){
                        console.debug("Dongle configured !")
                        $("#configuring").addClass("hide")
                        $("#validate").removeClass("hide");
                        PU.initKbListener("oathConfirm")
                        dongle.reset(function(){})
                    }, err)
                }, err)
            }
            function fillPerso(){
                console.debug("Filling personnalization file")
                var kb = new Daplug.KeyBoard()
                kb.addSleep()
                kb.addSleep()
                kb.addSleep()
                kb.addSleep()
                kb.addSleep()
                kb.addSleep()
                // 04 is to use HID mapping - 02 is for numeric (not very good)
                kb.addTextMac(kbPrefix)
                kb.addSleep()
                kb.addHotpCode(0x04, 0x06, hotpVer, counterFile)
                kb.addSleep()
                kb.addTextMac(kbSuffix)
                kb.zeroPad(kbLen)
                console.log(kb.getContent().toString(HEX))
                dongle.write(0, kb.getContent())(activate, err)
            }
            function crPerso(){
                console.debug("Create personnalization file")
                dongle.selectFile(Daplug.MASTER_FILE)(function(){
                    dongle.createFile(kbFile, kbLen)(fillPerso, err)
                }, err)
            }
            function crMapping(){
                console.debug("Create HID mapping file")
                // HID mapping :                   b c d e f g h i j k
                var mappingCont = new ByteString("05060708090a0b0c0d0e", HEX)
                dongle.selectFile(Daplug.MASTER_FILE)(function(){
                    dongle.createFile(0x0001, 10)(function(){
                        dongle.write(0, mappingCont)(crPerso, err)
                    }, err)
                }, err)
            }
            function crHOTP(){
                console.debug("Create HOTP key")
                dongle.setHotpKey(hotpVer, hotpKey)(crMapping, err)
                
            }
            function crCounter(){
                console.debug("Create counter file")
                dongle.createCounterFile(counterFile)(crHOTP, err)
            }
            function tryClean(){
                console.debug("Trying to clean dongle")
                function rmCounterFile(){
                    dongle.selectPath([Daplug.MASTER_FILE, 0xC010])(function(){
                        dongle.deleteFileOrDir(counterFile)(crCounter, crCounter)
                    })
                }
                function rmMappingFile(){
                    dongle.deleteFileOrDir(0x0001)(rmCounterFile, rmCounterFile)
                }
                function rmKbFile(){
                    dongle.selectFile(Daplug.MASTER_FILE)(function(){
                        dongle.deleteFileOrDir(kbFile)(rmMappingFile, rmMappingFile)
                    })
                }
                function rmHotpKey(){
                    dongle.deleteKeys([hotpVer])(rmKbFile, rmKbFile)
                }
                dongle.setKeyboardAtBoot(false)(rmHotpKey, rmHotpKey)
            }
            commonAuth(function(){
                console.debug("Select MF")
                dongle.selectFile(Daplug.MASTER_FILE)(tryClean, err)
            }, err)
        }

        return {
            configure      : configure
        }

    }();

    window.DP = DP;
})(window, document);



$(document).ready(function(){
    Daplug.initDaplug()
});
