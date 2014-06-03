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

import java.util.Calendar
import java.util.Date
import java.text.SimpleDateFormat

import scala.util.Random

import play.api._
import play.api.mvc._

/**
 * Generic helpers
 */

object Utils {

  /**
   * Int of String
   */
  def ios(s : String) : Option[Int] = try {
    Logger.logger.debug("IOS: "+s)
    Some(s.toInt)
  } catch {
    case _ : java.lang.NumberFormatException =>
      None:Option[Int]
  }

  def los(s : String) : Option[Long] = try {
    Logger.logger.debug("LOS: "+s)
    Some(s.toLong)
  } catch {
    case _ : java.lang.NumberFormatException =>
      None:Option[Long]
  }

  def getReferrer()(implicit request: Request[AnyContent]) = {
    request.headers.get("Referer").getOrElse("/")
  }

  def getReferrer(cur:String)(implicit request: Request[AnyContent]) = {
    val referrer = request.headers.get("Referer").getOrElse("/")
    if (referrer == cur) "/" else referrer
  }

  def genID(len:Int) = {
    val chars = ('a' to 'z') ++ ('A' to 'Z') ++ ('0' to '9') ++ ("-_")
    val allowed = chars.mkString("")
    var len = allowed.length
    (1 to len).map(
      _ => chars(Random.nextInt(len))
    ).mkString("")
  }

  def genStr(ll:Int) = {
    val chars = ('a' to 'z') ++ ('A' to 'Z')
    val allowed = chars.mkString("")
    var len = allowed.length
    (1 to ll).map(
      _ => chars(Random.nextInt(len))
    ).mkString("")
  }

  def format(date: Date, pattern: String = i18n.Messages("date.long")) = {
    val dateFormat = new SimpleDateFormat(pattern);
    dateFormat.format(date)
  }
  def currentDate():Int = {
      val date:Calendar = Calendar.getInstance();
      date.get(Calendar.YEAR)
  }

  def bytesToHex(bytes : Array[Byte]) =
    bytes.map{ b => "%02X".format(java.lang.Byte.valueOf(b)) }.mkString("")

  def bytesToString(bytes : Array[Byte]) =
    bytes.map{ b => b.toChar.toString }.mkString("")

  def hexToBytes(hex : String) : Array[Byte] = {
    val cleanInput = hex.replaceAll("\\s|\\n", "")
    val evenHex = if(cleanInput.length % 2 == 0) cleanInput else "0" + cleanInput
    evenHex.grouped(2).toArray.map{ b => java.lang.Integer.parseInt(b, 16).toByte }
  }

  def byte2Int(b:Byte) = {
    val res = b.toInt
    if (res < 0) 256 + res
    else res
  }

}

object BaseTool {

  val BASE2 = "01"
  val BASE10 = "0123456789"
  val BASE16 = "0123456789ABCDEF"
  val BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  val BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz"

  def normalize(number:String, base:String) = {
    if (base == BASE32) {
      number.toUpperCase().map{
        case '0' => "O"
        case '1' => "L"
        case '8' => "B"
        case c => if (base.indexOf(c) < 0) "" else c.toString
      }.mkString
    } else if (base == BASE16) number.toUpperCase()
      else number
  }

  def toBigInt(number:String, base:String) = {
    val mult = base.length.toLong
    normalize(number, base).foldLeft(BigInt(0)){ (acc, c) => {
      acc * mult + base.indexOf(c)
    }}
  }

  def toBase(number:BigInt, base:String) = {
    val mult = base.length
    def aux(sub:BigInt, res:String):String = {
      if (sub == BigInt(0)) res
      else aux(sub/mult,  base((sub % mult).toInt) + res)
    }
    aux(number, "")
  }

  def convert(number:String, from:String, to:String) = {
    toBase(toBigInt(number, from), to)
  }

  def base32toHex(num:String) = convert(num, BASE32, BASE16)
  def base64toHex(in:String) = Utils.bytesToHex(Base64.decode(in))

}

object Base64 {
  import org.apache.commons.codec.binary.{ Base64 => B64 }

  def decode(in: String): Array[Byte] = {
    val cleaned = in.replace("-", "+").replace("_", "/")
    val padLen = (4 - cleaned.length % 4) % 4
    val padded = cleaned + "====".substring(0, padLen)
    (new B64).decode(padded.getBytes("UTF-8"))
  }

  def encode(data:Array[Byte]) = {
    Utils.bytesToString((new B64).encode(data))
    .replace("+", "-").replace("/", "_").replace("=", "")
  }

}
