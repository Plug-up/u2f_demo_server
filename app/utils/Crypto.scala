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

import play.api.libs._
import java.security._
import javax.crypto._
import javax.crypto.spec.SecretKeySpec

import play.api.Play
import play.api.PlayException

/**
 * Cryptographic utilities.
 */
object Crypto {

  /**
   * Signs the given String with HMAC-SHA1 using the given key.
   */
  def sign(message: String, key: Array[Byte]): String = {
    val mac = Mac.getInstance("HmacSHA1")
    mac.init(new SecretKeySpec(key, "HmacSHA1"))
    new sun.misc.BASE64Encoder().encode(mac.doFinal(message.getBytes("utf-8")))
  }

  def sign(message: String, key: String):String = {
    println("~~~ Signing string ~~~")
    println(message)
    println("~~~~~~~~~~~~~~~~~~~~~~")
    val res = sign(message, key.getBytes)
    println(res)
    println("~~~~~~~~~~~~~~~~~~~~~~")
    res
  }

  /**
   * Signs the given String with HMAC-SHA1 using the application's secret key.
   */
  def sign(message: String): String = {
    Play.maybeApplication.flatMap(
      _.configuration.getString("application.secret")).
        map(secret => sign(message, secret.getBytes)).
        getOrElse { "" }
  }

}
