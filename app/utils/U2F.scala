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

package utils

import java.util.Date
import java.text.SimpleDateFormat
import play.api.Logger
import play.api.mvc.{Request,AnyContent}

import models.U2FDevice

case class RegisterResponse(
  version     : String,
  appId       : String,
  appHash     : Array[Byte],
  sessionId   : String,
  challenge   : String,
  browserData : String,
  chHash      : Array[Byte],
  enrollData  : Array[Byte]
)

abstract class RegisterOutcome
case class RegisterSuccess(
  keyHandle   : String,  // Base64
  publicPoint : String, // Base64
  kind        : String,
  cert        : Option[String] // Matched certificate (option because check can be disabled)
) extends RegisterOutcome
case class RegisterFailure(
  msg         : String
) extends RegisterOutcome

case class SignResponse(
  version     : String,
  appId       : String,
  appHash     : Array[Byte],
  sessionId   : String,
  keyHandle   : String, // In Base64
  challenge   : String,  
  browserData : String,
  chHash      : Array[Byte],
  signature   : Array[Byte]
)

abstract class SignOutcome
case class SignSuccess(
  keyHandle   : String
) extends SignOutcome
case class SignFailure(
  msg         : String
) extends SignOutcome

object U2F {

    // Set to false to ignore challenge errors
  def CHECK_CHALLENGE = true

  // Set to false to allow untrusted certificates
  def CHECK_CERTIFICATE = false

  // Set to false to disable counter check
  def CHECK_COUNTER = true

  import java.io.ByteArrayInputStream
  import java.io.FileInputStream

  import java.security.KeyFactory
  import java.security.MessageDigest
  import java.security.PublicKey
  import java.security.Security
  import java.security.Signature
  import java.security.cert.CertificateFactory
  import java.security.cert.X509Certificate
  import java.security.interfaces.ECPublicKey

  import org.bouncycastle.asn1.sec.SECNamedCurves
  import org.bouncycastle.jce.provider.BouncyCastleProvider
  import org.bouncycastle.jce.spec.ECParameterSpec
  import org.bouncycastle.jce.spec.ECPublicKeySpec

  def log(text:String) = Logger.debug(text)

  def genChallenge() = Utils.genID(64)

  var trustedCertificates: Array[(String, PublicKey)] = Array()

  def verifySignature(publicPoint:Array[Byte], signedBytes:Array[Byte], signature:Array[Byte]) = {

    Security.addProvider(new BouncyCastleProvider());

    val curve = SECNamedCurves.getByName("secp256r1");
    val curveSpec = new ECParameterSpec(curve.getCurve(), curve.getG(),
                                        curve.getN(), curve.getH());
    val point = curve.getCurve().decodePoint(publicPoint);
    val pub = KeyFactory.getInstance("ECDSA").generatePublic(
      new ECPublicKeySpec(point, curveSpec));

    val ecdsaSignature = Signature.getInstance("SHA256withECDSA");
    ecdsaSignature.initVerify(pub);
    ecdsaSignature.update(signedBytes);
    ecdsaSignature.verify(signature);
  }

  def hashStringData(data:String) = {
    try {
      // println("Hashing: " + Utils.bytesToString(data.getBytes))
      MessageDigest.getInstance("SHA-256").digest(data.getBytes);
    } catch {
      case _ : Throwable => {
        // println("Cannot compute SHA-256")
        Array[Byte]()
      }
    }
  }

  def hashToHex(data:String) = Utils.bytesToHex(hashStringData(data))
  def hashToB64(data:String) = Base64.encode(hashStringData(data))

  def getPublicKey(src:Array[Byte]) = {
    val str = new ByteArrayInputStream(src)
    CertificateFactory.getInstance("X.509").generateCertificates(str)
    .toArray.foldLeft(None:Option[Array[Byte]]){
      (res, cert) => {
        if (res.isDefined) res
        else cert match {
          case crt: X509Certificate => {
            val res = crt.getPublicKey().getEncoded()
            val ll = res.length
            // Why 65 ?
            Some(res.slice(ll-65, ll))
          }
          case _ => res
        }
      }
    }
  }

  def checkAttestCrt(src:Array[Byte]):Option[String] = {
    def testCertificate(pub:(String, PublicKey), crt:X509Certificate) = {
      try {
        crt.verify(pub._2)
        log("Certificate match: "+pub._1)
        Some(pub._1)
      } catch {
        case e : Throwable => {
          // log("Fail")
          // log(e.toString)
          None:Option[String]
        }
      }
    }

    try {
      val str = new ByteArrayInputStream(src)
      CertificateFactory.getInstance("X.509").generateCertificates(str)
      .toArray.foldLeft(None:Option[String]){
        (res, cert) => {
          log("Checking certificate:")
          log(cert.toString)
          if (res.isDefined) res
          else cert match {
            case crt: X509Certificate => {
              trustedCertificates.foldLeft(res){
                (res, pub) => {
                  if (res.isDefined) res
                  else testCertificate(pub, crt)
                }
              }
            }
            case _ => {
              log("Unrecognized certificate")
              res
            }     
          }
        }
      }
    } catch {
      case _ : Throwable => None
    }
  }

  def loadCertificates() = {
    import java.io.File
    Security.addProvider(new BouncyCastleProvider());
    def sub(name:String) {
      val fis = new FileInputStream("trusted/"+name)
      CertificateFactory.getInstance("X.509").generateCertificates(fis)
      .toArray.foreach{
        case crt: X509Certificate => {
          log("X509 certificate added: " + name)
          // println(crt)
          trustedCertificates = trustedCertificates :+ (name, crt.getPublicKey)
        }
        case _ => println("Error adding x509 certificate: " + name)
      }
    }
    val folder = new File("trusted")
    folder.listFiles.filter(!_.isDirectory)
    .map(_.getName).toList.foreach(sub(_))
    log("%d provider certificates imported".format(trustedCertificates.length))
  }

  def getData(r:Request[AnyContent]) = {
    val data = r.body.asFormUrlEncoded.getOrElse(Map()).mapValues(_.head)
    def get(s:String) = data.get(s).getOrElse("")
    get(_)
  }

  def splitRegisterData(data:Array[Byte]) = {
    log("EnrollData: " + Utils.bytesToHex(data))
    val publicPoint = data.slice(1, 66)
    log("User public point: " + Utils.bytesToHex(publicPoint))
    val khLength = java.lang.Byte.valueOf(data(66))
    val keyHandle = data.slice(67, 67+khLength)
    log("User key handle: " + Utils.bytesToHex(keyHandle))
    val certOffset = 67+khLength
    val mode = Utils.byte2Int(data(certOffset+1))
    val (certSize, sizeLen):(Int, Int) =
      if (mode == 0x81) {
        (Utils.byte2Int(data(2+certOffset)), 2)
      } else if (mode == 0x82) {
        (0x0100 * Utils.byte2Int(data(2+certOffset)) + Utils.byte2Int(data(3+certOffset)), 3)
      } else (mode, 1);
    val attestCert = data.slice(certOffset, certOffset + certSize + sizeLen + 1)
    log("Attestation certificate: " + Utils.bytesToHex(attestCert))
    val sigOffset = certOffset + certSize + sizeLen + 1
    val sigLen = Utils.byte2Int(data(sigOffset + 1))
    val signature = data.slice(sigOffset, sigOffset + sigLen + 2)
    (publicPoint, keyHandle, attestCert, signature)
  }

  def getRegisterResponse(r: Request[AnyContent]) = {
    val data = getData(r)
    val browserData = data("clientData")
    val decodedBrowserData = Utils.bytesToString(Base64.decode(browserData))
    val enrollData = data("registrationData")
    val decodedEnrollData = Base64.decode(enrollData)
    val appId = gs.HOST()
    val appHash = hashStringData(appId)
    val challenge = data("challenge")
    val chHash = hashStringData(decodedBrowserData)

    RegisterResponse(
      data("version"), appId, appHash,
      data("sessionId"), challenge,
      decodedBrowserData, chHash,
      decodedEnrollData
    )
  }

  def checkRegister(uid:String, request:Request[AnyContent], challenge:Option[String]) = {
    log("Checking registration data for "+uid)

    val r = getRegisterResponse(request)
    log("BrowserData: " + r.browserData)

    if (Utils.byte2Int(r.enrollData(0)) != 5) {
      RegisterFailure("Error registering device: invalid first byte (RFU)")
    } else if (Utils.byte2Int(r.enrollData(1)) != 4) {
      RegisterFailure("Error registering device: invalid second byte (version)")
    } else {
      val (pubPt, keyHandle, attestCert, signature) = splitRegisterData(r.enrollData)
      val certCheck = checkAttestCrt(attestCert)
      if (certCheck.isEmpty && CHECK_CERTIFICATE) {
        RegisterFailure("Certitifcate is not trusted")
      } else {
        if (certCheck.isEmpty) log("Certitifcate is not trusted but error ignored")
        else log("Trusted certificate")
        val attestCertHex = Utils.bytesToHex(attestCert)
        // Quick hack, look for ECPublicKey / Prime256v1 OIDs and start of sequence
        val OIDLookup = "06072A8648CE3D020106082A8648CE3D030107034200"
        val OIDIndex = attestCertHex.indexOf(OIDLookup)
        if (OIDIndex < 0) {
          RegisterFailure("Error registering device: Certificate error (OIDs not found)")
        } else {
          val finalIdx = (OIDIndex + OIDLookup.length) / 2
          val attestPublic = getPublicKey(attestCert).get
          log("Attestation public: " + Utils.bytesToHex(attestPublic))
          log("Challenge " + r.challenge)
          if (CHECK_CHALLENGE && (challenge.isEmpty || r.browserData.indexOf(challenge.get) < 0)) {
            RegisterFailure("Challenge tampered!")
          } else {
            val dataToSign = Array(
              Array(0.toByte), r.appHash, r.chHash, keyHandle, pubPt
            ).flatten
            log("AttestPub: "+Utils.bytesToHex(attestPublic))
            log("Data to sign: "+Utils.bytesToHex(dataToSign))
            log("Signature: "+Utils.bytesToHex(signature))
            if (verifySignature(attestPublic, dataToSign, signature)) {
              log("Everything is OK !")
              RegisterSuccess(
                Base64.encode(keyHandle), Utils.bytesToHex(pubPt),
                "SHA256withECDSA", certCheck
              )
            } else RegisterFailure("Error registering device (invalid signature)")
          }
        }
      }
    }
  }

  def splitSignData(data:Array[Byte]) = {
    log("SignData: " + Utils.bytesToHex(data))
    val flag = data(0)
    val counter = data.slice(1, 5)
    val counterVal = java.lang.Long.parseLong(Utils.bytesToHex(counter), 16)
    
    log("Counter: 0x" + Utils.bytesToHex(counter) + " ( "+ counterVal.toString +")")
    val signatureSize = Utils.byte2Int(data(6))
    val signature = data.slice(5, 7 + signatureSize)
    log("Signature: " + Utils.bytesToHex(signature))
    (flag, counter, counterVal, signature)
  }

  def getSignResponse(r: Request[AnyContent]) = {
    println(r.body.asJson.toString)
    val data = getData(r)
    val browserData = data("clientData")
    val decodedBrowserData = Utils.bytesToString(Base64.decode(browserData))
    val signData = data("signatureData")
    val decodedSignData = Base64.decode(signData)
    val appId = gs.HOST()
    val appHash = hashStringData(appId)
    val challenge = data("challenge")
    val chHash = hashStringData(decodedBrowserData)
    val keyHandle = data("keyHandle")
    val b64kh = keyHandle
    SignResponse(
      data("version"), appId, appHash,
      data("sessionId"), b64kh,
      challenge, decodedBrowserData,
      chHash, decodedSignData
    )
  }

  def checkSign(uid:String, request: Request[AnyContent], ds:List[U2FDevice], challenges:List[(String, String)]) = {
    val r = getSignResponse(request)
    ds.find(_.keyHandle == r.keyHandle) match {
      case None => SignFailure("Unknonw KeyHandle")
      case Some(d) => {
        log("Checking signature data for "+uid)

        log("BrowserData: " + r.browserData)

        val (flag, counter, counterVal, signature) = splitSignData(r.signature)

        log("Key handle: " + Utils.bytesToHex(Base64.decode(r.keyHandle)))

        def checkPublicPoint() = {
          if (d.counter.isDefined && d.counter.get >= counterVal && CHECK_COUNTER)
            SignFailure("Invalid counter !")
          else {
            val pt = Utils.hexToBytes(d.public)

            val dataToSign = Array[Array[Byte]](
              r.appHash, Array(flag), counter, r.chHash
            ).flatten
            log("Public pt: "+Utils.bytesToHex(pt))
            log("Data to sign: "+Utils.bytesToHex(dataToSign))
            log("Signature: "+Utils.bytesToHex(signature))
            val res = verifySignature(pt, dataToSign, signature)
            if (res) {
              log("Sign success !")
              U2FDevice.setCounter(d._id, counterVal)
              SignSuccess(r.keyHandle)
            } else SignFailure("Invalid signature")
          }
        }

        challenges.find(_._1 == r.keyHandle) match {
          case None => {
            if (CHECK_CHALLENGE)
              SignFailure("No challenge generated for this device !")
            else checkPublicPoint()
          }
          case Some((kh, challenge)) => {
            log(challenge)
            val challHash = hashToHex(challenge)
            if (r.browserData.indexOf(challenge) >= 0) checkPublicPoint()
            else if (CHECK_CHALLENGE) SignFailure("Challenge tampered !")
            else checkPublicPoint()
          }
        }
      }
    }
  }

}
