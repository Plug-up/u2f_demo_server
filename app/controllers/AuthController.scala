package controllers

import scala.concurrent.ExecutionContext
import scala.concurrent.duration.FiniteDuration

import play.api.Play.current
import play.api._
import play.api.mvc._
import play.api.data._
import play.api.data.Forms._
import akka.util._

import models._
import utils.Utils

trait SecuredBasic {

  /**
   * HTTP Basic Authorization for Play 2.2.x
   */
  def Secured[A](realm:String, username: String, password: String)(action: Request[AnyContent] => Result) = Action {
    request =>
      request.headers.get("Authorization").flatMap {
        authorization =>
          authorization.split(" ").drop(1).headOption.filter {
            encoded =>
              new String(org.apache.commons.codec.binary.Base64.decodeBase64(encoded.getBytes)).split(":").toList match {
                case u :: p :: Nil if u == username && password == p => true
                case _ => false
              }
          }.map(_ => action(request))
      }.getOrElse {
        Results.Unauthorized.withHeaders(
          "WWW-Authenticate" -> "Basic realm=\"%s\"".format(realm)
        )
      }
  }

}

/**
 * Simple cookie system (not rotating)
 *
 * Less secure than rotating cookies but more reliable for low critical user
 */
trait SecuredCookie extends SecuredBasic {

  implicit val ec: ExecutionContext = ExecutionContext.Implicits.global

  /**
   * Save user ID in rotating cache
   * Expires after 3600 seconds (1 hour)
   */
  private def saveAuthState(state:AuthState) = {
    val cookie = Utils.genID(64)
    AuthCache.set(cookie, state)
    // Logger.debug("SAVE: %s -> %s".format(cookie, state.toString))
    cookie
  }

  private def getCookieAuth(cookie:String) = {
    val res = AuthCache.get(cookie)
    // Logger.debug("READ: %s -> %s".format(cookie, res.toString))
    res
  }

  private def rmCookie(implicit request: Request[AnyContent]) {
    request.session.get("rcookie") match {
      case Some(cookie) => AuthCache.remove(cookie)
      case None => ()
    }
  }

  /**
   * Get current user rotating cookie and act accordingly
   */
  private def getAuthAndDo(
    process: AuthState => Result
  )(implicit request: Request[AnyContent]) = {
    request.session.get("rcookie") match {
      case None => process(Unlogged())
      case Some(cookie) =>
        getCookieAuth(cookie) match {
          case None => process(Unlogged())
          case Some(st) => process(st)
        }
    }
  }

  /**
   * The test boolean is here for the cookie tester
   * It is only used on the homepage of ulogged users
   */
  def GetAuthState(act: Request[AnyContent] => AuthState => Result) =
    // Secured("Site de demo", "demo", "daplug") {
    Action {
      implicit request =>
        getAuthAndDo{
          case Unlogged() => act(request)(Unlogged()).withNewSession
          case st => {
            try { act(request)(st) }
            catch { case err:Throwable => {
              Logger.logger.error(err.toString)
              Results.Ok(i18n.Messages("error")) }
                 }
          }
        }
    }

  /**
  * Use this when AddAuthState is not enough versatile
  * Note that this is a complex function :
  * - the origin is a value describing the origin of the change
  * values are definesd in Global.gs
  * - the first function takes the old state and applies the change.
  * - the second function takes the new state and returns a result
  */
  def UpdateAuthState(update:AuthState => AuthState)(act: AuthState => Result)(implicit request: Request[AnyContent]): Result = {
    def process(st:AuthState) = {
      update(st) match {
        case Unlogged() => {
          rmCookie
          act(st).withNewSession
        }
        case newSt => {
          rmCookie
          val newCookie = saveAuthState(newSt)
          act(newSt).withSession("rcookie" -> newCookie)
        }
      }
    }
    // Process
    getAuthAndDo(process)
  }

}

object AuthController extends Controller with SecuredCookie {

  def checkSecondFactor(onFail:Result, onFail2F:Result)(act: Request[AnyContent] => Logged => Result):Action[AnyContent] =
    GetAuthState {
      implicit r => implicit st => st match {
        case Unlogged() => onFail
        case Logged(uid, u2f) =>
          u2f match {
            case Pending(_, _, _) => onFail2F
            case _ => act(r)(Logged(uid, u2f))
          }
      }
    }

  def checkSecondFactor(act: Request[AnyContent] => Logged => Result):Action[AnyContent] =
    checkSecondFactor(Redirect("/"), Redirect("/"))(act)

  def logout = Action {
    implicit request =>
      UpdateAuthState(_ => Unlogged()) { _ => Redirect("/") }
  }

}
