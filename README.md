u2f_demo_server
===============

A U2F demo server in Scala using Play Framework

System configuration
--------------------

This server requires:

- Play Framework: tested on [2.2.2](http://downloads.typesafe.com/play/2.2.2/play-2.2.2.zip) and [2.3.7 with activator](http://downloads.typesafe.com/typesafe-activator/1.2.12/typesafe-activator-1.2.12-minimal.zip)
- mongodb: tested with version 2.0.2

Server configuration
--------------------

The only thing you need to configure is the host in file app/Global.scala

If you are running in local, default host is http://localhost.com:9000 you will have to add this to your host file and access the interface using this address to test. If you want to use another local address, just remember that is MUST have a correct tld or the authentication may fail.
