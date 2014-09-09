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
import play.api.libs.json._
import play.api.libs.json.Json._

import utils._
import models._

object OATHCtr extends Controller {

  def doCheckOath(uid:String, r:Request[AnyContent], active:Boolean) = {
    val data = Ajax.getData(r)
    val otp = data("otp")
    if (otp == "") Some("No One Time Password") 
    else OATHKeyDb.find(uid) match {
      case None => Some("No OATH key for this account")
      case Some(k) => {
        if (active && !k.active) Some("OATH key not activated")
        else if (k.kind == "totp" && OATH.totp(otp, k)) {
          if (!k.active) OATHKeyDb.activate(uid)
          None
        } else if (k.kind == "hotp") {
          OATH.hotp(otp, k) match {
            case None => Some("Invalid One Time Password")
            case Some(cpt) => {
              if (!k.active) OATHKeyDb.activate(uid)
              OATHKeyDb.setCounter(uid, cpt)
              None
            }
          }
        }
        else Some("Invalid One Time Password")
      }
    }
  }

  def confirm() = AuthController.checkSecondFactor(
    Ajax.JSONerr("offline"), Ajax.JSONerr("Second factor pending")
  ){ implicit r => st => {
    doCheckOath(st.uid, r, false) match {
      case None => Ajax.JSONok("success")
      case Some(msg) => {
        println(msg)
        Ajax.JSONerr(msg)
      }
    }
  }}

  def check() = Action {
    implicit r => {
      var err = ""
      AuthController.UpdateAuthState{
        case Unlogged() => Unlogged()
        case Logged(uid, Pending(Some(mode), u2f, challenges)) => {
          doCheckOath(uid, r, true) match {
            case None => Logged(uid, OATHSuccess())
            case Some(msg) => {
              println(msg)
              err = msg
              Logged(uid, Pending(Some(mode), u2f, challenges))
            }
          }
        }
        case Logged(uid, st) => {
          err = "No U2F authentication required"
          Logged(uid, st)
        }
      }{
        case Unlogged() => Ajax.JSONerr("offline")
        case Logged(_, OATHSuccess()) => Ajax.JSONok("success")
        case Logged(_, _) => Ajax.JSONerr("Authentication failed (%s)".format(err))
      }(r)
    }
  }

  def register() = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => Redirect("/")
      case Logged(uid, u2f) =>
        User.find(uid) match {
          case None => Redirect("/") // Should not happen
          case Some(u) =>
            u2f match {
              case Pending(_, _, _) => Redirect("/")
              case _ => {
                if(OATHKeyDb.find(uid).isDefined) {
                  OATHKeyDb.remove(uid)
                }
                val priv = OATH.genPrivateKey()
                val privHex = BaseTool.base32toHex(priv)
                OATHKeyDb.insert(OATHKey(uid, privHex, 6, "totp", 30))
                Ok(views.html.oathRegister(u.login, priv))
              }
            }
        }
    }
  }

  def daplugOath() = AuthController.GetAuthState {
    implicit r => implicit st => st match {
      case Unlogged() => {
        if (false) {
          val priv = OATH.genPrivateKey()
          val privHex = BaseTool.base32toHex(priv)
          implicit val st = Unlogged()
          Ok(views.html.daplugOath(privHex))
        } else {
          Redirect("/")
        }
      }
      case Logged(uid, u2f) =>
        u2f match {
          case Pending(_, _, _) => Redirect("/")
          case _ => {
            if(OATHKeyDb.find(uid).isDefined) {
              OATHKeyDb.remove(uid)
            }
            val priv = OATH.genPrivateKey()
            val privHex = BaseTool.base32toHex(priv)
            OATHKeyDb.insert(OATHKey(uid, privHex, 6, "hotp", -1))
            Ok(views.html.daplugOath(privHex))
          }
        }
    }
  }

}
