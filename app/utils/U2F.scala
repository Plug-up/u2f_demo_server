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
case class SignSuccess() extends SignOutcome
case class SignFailure(
  msg         : String
) extends SignOutcome

object U2F {

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
        println("Cannot compute SHA-256")
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
        println("Testing against cert: " + pub._1)
        crt.verify(pub._2)
        println("Success")
        Some(pub._1)
      } catch {
        case e : Throwable => {
          println("Fail")
          println(e)
          None:Option[String]
        }
      }
    }

    try {
      val str = new ByteArrayInputStream(src)
      CertificateFactory.getInstance("X.509").generateCertificates(str)
      .toArray.foldLeft(None:Option[String]){
        (res, cert) => {
          println("Chercking certificate:")
          println(cert)
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
              println("Unrecognized certificate")
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
    Security.addProvider(new BouncyCastleProvider());
    def sub(name:String) {
      val fis = new FileInputStream("trusted/"+name)
      CertificateFactory.getInstance("X.509").generateCertificates(fis)
      .toArray.foreach{
        case crt: X509Certificate => {
          println("X509 certificate added: " + name)
          println(crt)
          trustedCertificates = trustedCertificates :+ (name, crt.getPublicKey)
        }
        case _ => println("Error adding x509 certificate: " + name)
      }
    }
    List(
      "plugup-fidoarca.pem"
    ).foreach(sub(_))
    println("%d trusted certificates imported".format(trustedCertificates.length))

  }

}
