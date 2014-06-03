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

import scala.util.Random

case class OATHKey(
  _id     : String, // Owner ID
  secret  : String, // Stringified HEX
  digits  : Int,
  kind    : String, // "hotp" or "totp"
  counter : Int, // for totp, the time step (default 30)
  active  : Boolean = false
)

object OATH {

  private def hmacSha1(secret:Array[Byte], data:Array[Byte]) = {
    import javax.crypto.{Mac, Cipher, SecretKey}
    import javax.crypto.spec.{IvParameterSpec,SecretKeySpec}
    val mac = Mac.getInstance("HmacSHA1")
    mac.init(new SecretKeySpec(secret, "HmacSHA1"))
    Utils.bytesToHex(mac.doFinal(data))
  }

  private def truncate(digits:Int, data:String) = {
    import java.lang.{Integer,Long}
    val l = data.length
    val offset = Integer.parseInt(data.substring(l-1, l), 16)
    val sub = Long.parseLong(data.substring(offset*2, offset*2+8), 16)
    val sub2 = sub & 0x7FFFFFFF
    "%010d".format(sub2).takeRight(digits)
  }

  private def compute(secret:Array[Byte], counter:Long, digits:Int) = {
    val hexCount = Utils.hexToBytes("%X".format(counter))
    val padding = Utils.hexToBytes("0000000000000000")
    val paddedCount = padding.slice(0, hexCount.length) ++ hexCount

    truncate(digits, hmacSha1(secret, paddedCount))
  }

  /**
   * Test provided value against an HOTP key
   * Returns Some(new counter) if correct or None
   */
  def hotp(test:String, key:OATHKey, window:Int=10) = {
    val secretHex = Utils.hexToBytes(key.secret)
    def aux(cpt:Long):Option[Int]= {
      if (cpt > key.counter + window) None
      else if (compute(secretHex, cpt, key.digits) == test) Some(cpt.toInt)
      else aux(cpt+1)
    }
    aux((key.counter+1).toLong)
  }

  /**
   * Test provided value against a TOTP key
   * Returns a boolean
   */
  def totp(test:String, key:OATHKey) = {
    val secretHex = Utils.hexToBytes(key.secret)
    val date = (new Date().getTime()) / (key.counter * 1000)
    List(date, date-1, date+1).foldLeft(false){
      (res, d) => res || compute(secretHex, d, key.digits) == test
    }
  }

  def genPrivateKey() = {
    val charset = BaseTool.BASE32
    var len = charset.length
    (1 to 8).map{
      _ => (1 to 4).map(_ => charset(Random.nextInt(len))).mkString("")
    }.mkString(" ")
  }

}
