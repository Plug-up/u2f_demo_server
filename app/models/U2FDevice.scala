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

package models

import java.util.Date

import scala.concurrent.ExecutionContext
import scala.concurrent.Future
import scala.concurrent.duration._
import scala.concurrent.Await

import play.api._
import play.api.mvc._
import play.api.data._
import play.api.libs.json._
import play.api.Play.current

// Reactive Mongo plugin, including the JSON-specialized collection
import reactivemongo.api._
import play.modules.reactivemongo.MongoController
import play.modules.reactivemongo.json.collection.JSONCollection

case class U2FDevice (
  _id       : String, // Random ID
  date      : Date,
  owner     : String, // _id of owner
  keyHandle : String, // base64
  public    : String, // base64
  kind      : String,  // Kind of public key
  cert      : Option[String], // Matched certificate (option because check can be disabled)
  counter   : Option[Long] = None // strictly growing
)

object U2FDevice {

  implicit val ec: ExecutionContext = ExecutionContext.Implicits.global
  implicit val userFormat = Json.format[U2FDevice]

  private def col: JSONCollection = play.modules.reactivemongo.ReactiveMongoPlugin.db.collection[JSONCollection]("devices")

  def insert(d:U2FDevice) = Await.result(col.insert(d), Duration(10, SECONDS))

  private def findAllWithQuery(query:JsObject):List[U2FDevice] = {
    val res:Future[List[U2FDevice]] = col.find(query).cursor[U2FDevice].collect[List]()
    Await.result(res, Duration(10, SECONDS))
  }

  def findByOwner(uid:String) = findAllWithQuery(Json.obj("owner" -> uid))
  def findByOwnerAndKH(uid:String, kh:String) =
    findAllWithQuery(Json.obj("owner" -> uid, "keyHandle" -> kh)).headOption

  def remove(id:String, uid:String) =
    col.remove(Json.obj("_id" -> id, "owner" -> uid))

  def setCounter(id:String, counter:Long) =
    col.update(
      Json.obj("_id" -> id),
      Json.obj("$set" -> Json.obj("counter" -> counter))
    )

}
