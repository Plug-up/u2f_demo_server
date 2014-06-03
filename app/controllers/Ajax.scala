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

package controllers

import java.util.Date

import play.api._
import play.api.mvc._
import play.api.i18n._
import play.api.libs.json._
import play.api.libs.json.Json._

import play.api.Play.current

import utils.Utils
import models._

/**
 * Ajax requests
 */

object Ajax extends Controller {

  /**
   * Generic functions returning JSON
   */
  private def JSONone(tag:String, msg:String) = Ok(Json.obj(tag -> msg))
  def JSONerr(msg:String) = JSONone("error", msg)
  def JSONok(msg:String) = JSONone("ok", msg)

  def getData(r:Request[AnyContent]) = {
    val data = r.body.asFormUrlEncoded.getOrElse(Map()).mapValues(_.head)
    def get(s:String) = data.get(s).getOrElse("")
    get(_)
  }

  def echo = Action {
    implicit r => {
     val data = getData(r)
     println(data("data"))
     Ok("ok")
    }
  }

}
