package models

import java.util.Calendar
import scala.concurrent.ExecutionContext
import scala.concurrent.duration.FiniteDuration

import play.api.Logger
import play.api.Play.current
import play.api.libs.concurrent.Akka
import ExecutionContext.Implicits.global 

abstract class SecondFactor

case class No2F() extends SecondFactor // No second factor for this account
case class Skipped() extends SecondFactor // Second factor skipped

/* Multiple auth possible */
case class Pending(
  oath       : Option[String],
  u2f        : Boolean,
  challenges : List[(String, String)] // List (keyHandle, challenge) for u2F
) extends SecondFactor

/* Success auth states */
case class U2FSuccess(
  keyHandle  : String
) extends SecondFactor // U2F success
case class OATHSuccess() extends SecondFactor // OATH success

abstract class AuthState

case class Unlogged() extends AuthState
case class Logged(
  uid : String,
  u2f : SecondFactor
) extends AuthState

object AuthCache {

  /**
   * Check expired sessions every (in seconds)
   */
  val SESS_CHECK = 60 // Check expired sessions every (in seconds)
  val SESS_D = 3600   // Sessions duration (in seconds)

  private val sess = new scala.collection.mutable.LinkedHashMap[String, (AuthState, Long)]()
    with scala.collection.mutable.SynchronizedMap[String, (AuthState, Long)]

  def set(cookie:String, st:AuthState) {
    val now = Calendar.getInstance().getTimeInMillis() / 1000
    sess += (cookie -> (st, now + SESS_D))
  }

  def remove(cookie:String) {
    sess -= cookie
  }

  def get(cookie:String) = {
    sess.get(cookie).map(_._1)
  }

  def checkSess() {
    // Logger.logger.debug("Checking expired sessions")
    val now = Calendar.getInstance().getTimeInMillis() / 1000
    sess.foreach{ elt => if (elt._2._2 < now) remove(elt._1) }
  }

  def initLoop() {
    def loop() {
      checkSess()
      Akka.system.scheduler.scheduleOnce(
        FiniteDuration.apply(SESS_CHECK, "seconds")){
          loop()
        }
    }
    loop()
  }

}
