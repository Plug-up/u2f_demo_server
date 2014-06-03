name := "u2ftest"

version := "1.0-SNAPSHOT"

libraryDependencies ++= Seq(
  jdbc,
  anorm,
  "org.reactivemongo" %% "play2-reactivemongo" % "0.10.2",
  // To use "org.mindrot.jbcrypt" ...
  "com.github.t3hnar" % "scala-bcrypt_2.10" % "2.1",
  "com.typesafe" %% "play-plugins-mailer" % "2.1.0",
  "org.seleniumhq.selenium" % "selenium-java" % "2.32.0" % "test",
  "net.sandrogrzicic" %% "scalabuff-runtime" % "1.3.6",
  // For ECC cryptography
  "org.bouncycastle" % "bcprov-jdk16" % "1.46"
)

play.Project.playScalaSettings
