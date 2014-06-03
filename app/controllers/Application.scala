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

import play.api._
import play.api.mvc._

import models._

object Application extends Controller {

  def animals() = {
    val src = List(
      ("Black dog", "black_dog"),
      ("Bunny", "bunny"),
      ("Duckling", "duckling"),
      ("Grey cat", "grey_cat"),
      ("Lamb", "lamb"),
      ("Orange cat", "orange_cat"),
      ("Red cat", "red_cat"),
      ("White cat", "white_cat"),
      ("White dog", "white_dog")
    )
    scala.util.Random.shuffle(src)
  }

  def index = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Ok(views.html.unlogged())
      case Logged(uid, u2f) => Ok(views.html.logged(u2f))
    }
  }

  def loginPage = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Ok(views.html.login(""))
      case Logged(uid, u2f) => Redirect("/")
    }
  }

  def loginFailed = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Ok(views.html.login("Invalid login or password"))
      case Logged(_, _) => Redirect("/")
    }
  }

  def devices = AuthController.checkSecondFactor{
    implicit r => implicit st => {
      val devices = U2FDevice.findByOwner(st.uid)
      val oath = OATHKeyDb.find(st.uid).map(_.active).getOrElse(false)
      Ok(views.html.devices(oath, devices))
    }
  }

  def deleteAccount = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Redirect("/")
      case Logged(uid, u2f) =>
        u2f match {
          case Pending(_, _, _) => Redirect("/")
          case _ => {
            Ok("TODO")
          }
        }
    }
  }

  def skip2f = Action {
    implicit r => {
      AuthController.UpdateAuthState{
        case Logged(uid, Pending(_, _, _)) => Logged(uid, Skipped())
        case st => st // If not pending do not change anything
      }{
        case Unlogged() => Ajax.JSONerr("offline")
        case Logged(_, Skipped()) => Ajax.JSONok("success")
        case Logged(_, _) => Ajax.JSONerr("You cannot do that !")
      }(r)
    }
  }

}
