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
import play.api.data._
import play.api.data.Forms._

import utils._
import models._

object UserCtr extends Controller {

  val loginForm = Form( tuple("accountLogin" -> text, "animal" -> text) )

  def checkLogin(login:String, pass:String):Option[User] = {
    User.findLogin(login).flatMap{
      u => if (u.pass == pass) Some(u) else None
    }
  }

  def login() = Action {
    implicit request => {
      val (login, pass) = loginForm.bindFromRequest.get
      checkLogin(login, pass) match {
        case Some(u) => {
          val devices = U2FDevice.findByOwner(u._id)
          val oathKey = OATHKeyDb.find(u._id).flatMap(
            k => { if (k.active) Some(k.kind) else None }
          )
          val secondFactor =
            if (devices.isEmpty && oathKey.isEmpty) No2F()
            else {
              Pending(
                oathKey, !devices.isEmpty,
                U2FCtr.genDeviceChallenges(u._id, devices)
              )
            }
          
          AuthController.UpdateAuthState(_ => Logged(u._id, secondFactor)){
            implicit st => Redirect("/")
          }
        }
        case None => Redirect("/loginFailed")
      }
    }
  }

  def register = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Ok(views.html.register("", ""))
      case Logged(_, _) => Redirect("/")
    }
  }

  def createAccount = Action {
    implicit request => {
      val (login, pass) = loginForm.bindFromRequest.get
      if (login == "") {
        Ok(views.html.register(login, "The name cannot be empty !"))
      } else {
        User.findLogin(login) match {
          case None => {
            val uid = Utils.genID(32)
            val u = User(uid, login, pass)
            User.insert(u)
            AuthController.UpdateAuthState(_ => Logged(uid, No2F())){
              _ => Redirect("/deviceRegister")
            }
          }
          case Some(u) => {
            Ok(views.html.register(login, "This name is already used !"))
          }
        }
      }
    }
  }

}
