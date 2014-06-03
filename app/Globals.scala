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

import java.util.Calendar
import java.util.Date
import java.io.File

import scala.util.Random
import scala.concurrent.ExecutionContext
import scala.concurrent.duration.FiniteDuration

import play.api._
import play.api.mvc._
import play.api.mvc.Results._
import play.api.Play.current
import play.api.libs.concurrent.Akka
import akka.util._
import com.typesafe.config.ConfigFactory

import utils._
import models._
import controllers._

package object gs {

  var DEV = false

  def HOST() = {
    if (DEV) "http://192.168.5.14:9000"
    else "http://u2f.plug-up.net"
  }

}

object Global extends GlobalSettings {

  implicit val ec: ExecutionContext = ExecutionContext.Implicits.global

  override def onLoadConfig(config: Configuration, path: File, classloader: ClassLoader, mode: Mode.Mode): Configuration = {
    gs.DEV = mode.toString.toLowerCase == "dev"
    if (gs.DEV) Logger.logger.debug("DEV mode ON")
    super.onLoadConfig(config, path, classloader, mode)
  }

  override def onStart(app: Application) {
    Logger.logger.debug("Starting application")
    AuthCache.initLoop()
    U2F.loadCertificates()
    // testTotp()
  }

  def hmacSha1(secret:Array[Byte], data:Array[Byte]) = {
    import javax.crypto.{Mac, Cipher, SecretKey}
    import javax.crypto.spec.{IvParameterSpec,SecretKeySpec}
    val mac = Mac.getInstance("HmacSHA1")
    mac.init(new SecretKeySpec(secret, "HmacSHA1"))
    Utils.bytesToHex(mac.doFinal(data))
  }

  def truncate(digits:Int, data:String) = {
    import java.lang.{Integer,Long}
    val l = data.length
    val offset = Integer.parseInt(data.substring(l-1, l), 16)
    val sub = Long.parseLong(data.substring(offset*2, offset*2+8), 16)
    val sub2 = sub & 0x7FFFFFFF
    "%010d".format(sub2).takeRight(digits)
  }

  def testTotp() {

    val b32 = "74cq 4pzw 4ox5 o2ec zg2u f6qd 4hx4 aqxh"
    val key = Utils.hexToBytes(BaseTool.base32toHex(b32))

    val date = (new Date().getTime()) / 30000
    val hexDate = Utils.hexToBytes("%X".format(date))
    val padding = Utils.hexToBytes("0000000000000000")
    val paddedDate = padding.slice(0, hexDate.length) ++ hexDate

    val macData = hmacSha1(key, paddedDate)
    val res = truncate(6, macData)
    println("RES: %s".format(res))

  }

}
