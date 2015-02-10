/*
 * Crypto-JS v2.5.1
 * http://code.google.com/p/crypto-js/
 * (c) 2009-2011 by Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */

(typeof Crypto=="undefined"||!Crypto.util)&&function(){var e=self.Crypto={},g=e.util={rotl:function(a,b){return a<<b|a>>>32-b},rotr:function(a,b){return a<<32-b|a>>>b},endian:function(a){if(a.constructor==Number)return g.rotl(a,8)&16711935|g.rotl(a,24)&4278255360;for(var b=0;b<a.length;b++)a[b]=g.endian(a[b]);return a},randomBytes:function(a){for(var b=[];a>0;a--)b.push(Math.floor(Math.random()*256));return b},bytesToWords:function(a){for(var b=[],c=0,d=0;c<a.length;c++,d+=8)b[d>>>5]|=a[c]<<24-
d%32;return b},wordsToBytes:function(a){for(var b=[],c=0;c<a.length*32;c+=8)b.push(a[c>>>5]>>>24-c%32&255);return b},bytesToHex:function(a){for(var b=[],c=0;c<a.length;c++)b.push((a[c]>>>4).toString(16)),b.push((a[c]&15).toString(16));return b.join("")},hexToBytes:function(a){for(var b=[],c=0;c<a.length;c+=2)b.push(parseInt(a.substr(c,2),16));return b},bytesToBase64:function(a){if(typeof btoa=="function")return btoa(f.bytesToString(a));for(var b=[],c=0;c<a.length;c+=3)for(var d=a[c]<<16|a[c+1]<<8|
a[c+2],e=0;e<4;e++)c*8+e*6<=a.length*8?b.push("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(d>>>6*(3-e)&63)):b.push("=");return b.join("")},base64ToBytes:function(a){if(typeof atob=="function")return f.stringToBytes(atob(a));for(var a=a.replace(/[^A-Z0-9+\/]/ig,""),b=[],c=0,d=0;c<a.length;d=++c%4)d!=0&&b.push(("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(a.charAt(c-1))&Math.pow(2,-2*d+8)-1)<<d*2|"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(a.charAt(c))>>>
6-d*2);return b}},e=e.charenc={};e.UTF8={stringToBytes:function(a){return f.stringToBytes(unescape(encodeURIComponent(a)))},bytesToString:function(a){return decodeURIComponent(escape(f.bytesToString(a)))}};var f=e.Binary={stringToBytes:function(a){for(var b=[],c=0;c<a.length;c++)b.push(a.charCodeAt(c)&255);return b},bytesToString:function(a){for(var b=[],c=0;c<a.length;c++)b.push(String.fromCharCode(a[c]));return b.join("")}}}();

function sha256(m) {

    var K = [ 0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
              0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
              0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
              0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
              0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
              0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
              0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
              0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
              0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
              0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
              0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
              0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
              0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
              0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
              0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
              0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2 ];

    var H = [ 0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
              0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19 ];

    var w = [],
        a, b, c, d, e, f, g, h, i, j,
        t1, t2;

    for (var i = 0; i < m.length; i += 16) {

        a = H[0];
        b = H[1];
        c = H[2];
        d = H[3];
        e = H[4];
        f = H[5];
        g = H[6];
        h = H[7];

        for (var j = 0; j < 64; j++) {

            if (j < 16) w[j] = m[j + i];
            else {

                var gamma0x = w[j - 15],
                    gamma1x = w[j - 2],
                    gamma0  = ((gamma0x << 25) | (gamma0x >>>  7)) ^
                              ((gamma0x << 14) | (gamma0x >>> 18)) ^
                               (gamma0x >>> 3),
                    gamma1  = ((gamma1x <<  15) | (gamma1x >>> 17)) ^
                              ((gamma1x <<  13) | (gamma1x >>> 19)) ^
                               (gamma1x >>> 10);

                w[j] = gamma0 + (w[j - 7] >>> 0) +
                       gamma1 + (w[j - 16] >>> 0);

            }

            var ch  = e & f ^ ~e & g,
                maj = a & b ^ a & c ^ b & c,
                sigma0 = ((a << 30) | (a >>>  2)) ^
                         ((a << 19) | (a >>> 13)) ^
                         ((a << 10) | (a >>> 22)),
                sigma1 = ((e << 26) | (e >>>  6)) ^
                         ((e << 21) | (e >>> 11)) ^
                         ((e <<  7) | (e >>> 25));


            t1 = (h >>> 0) + sigma1 + ch + (K[j]) + (w[j] >>> 0);
            t2 = sigma0 + maj;

            h = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;

        }

        // Intermediate hash value
        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0;
        H[5] = (H[5] + f) | 0;
        H[6] = (H[6] + g) | 0;
        H[7] = (H[7] + h) | 0;
    }

    return H;

};
