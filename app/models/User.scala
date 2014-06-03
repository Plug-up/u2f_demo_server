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

/**
 * Type of an user
 * - _id : ID of the user in the online shop
 * - login : Login of the user for a minimal customization of pages
 * - pass : Password
 */

case class User (
  _id        : String,
  login      : String,
  pass       : String
)

object User {

  implicit val ec: ExecutionContext = ExecutionContext.Implicits.global
  implicit val userFormat = Json.format[User]

  private def col: JSONCollection = play.modules.reactivemongo.ReactiveMongoPlugin.db.collection[JSONCollection]("users")

  def insert(u:User) = Await.result(col.insert(u), Duration(10, SECONDS))

  private def findWithQuery(query:JsObject):Option[User] = {
    val res:Future[Option[User]] = col.find(query).one[User]
    Await.result(res, Duration(10, SECONDS))
  }

  def find(uid:String) = findWithQuery(Json.obj("_id" -> uid))
  def findLogin(login:String) = findWithQuery(Json.obj("login" -> login))

}
