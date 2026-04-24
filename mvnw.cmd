@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    https://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM ----------------------------------------------------------------------------
@REM Maven Start Up Batch script
@REM
@REM Required ENV vars:
@REM JAVA_HOME - location of a JDK home dir
@REM
@REM Optional ENV vars
@REM MAVEN_BATCH_ECHO - set to 'on' to enable the echoing of the batch commands
@REM MAVEN_BATCH_PAUSE - set to 'on' to wait for a key stroke before ending
@REM MAVEN_OPTS - parameters passed to the Java VM when running Maven
@REM     e.g. to debug Maven itself, use
@REM set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
@REM ----------------------------------------------------------------------------

@echo off
@setlocal

set "ERROR_CODE=0"

@REM set %HOME% to equivalent of $HOME
if not "%HOME%" == "" goto homeSet
set "HOME=%USERPROFILE%"
:homeSet

@REM Execute a user defined script before this one
if not "%MAVEN_SKIP_RC%" == "" goto skipRcPre
@REM check for pre script, once with legacy .mvn dir and once with .mvn dir in current directory
if exist "%HOME%\mavenrc_pre.bat" call "%HOME%\mavenrc_pre.bat"
if exist "%PROJECT_ROOT%\.mvn\mavenrc_pre.bat" call "%PROJECT_ROOT%\.mvn\mavenrc_pre.bat"
:skipRcPre

@REM set project root
set "PROJECT_ROOT=%~dp0"

@REM set maven wrapper jar
set "MAVEN_WRAPPER_JAR=%PROJECT_ROOT%\.mvn\wrapper\maven-wrapper.jar"

@REM find java
if not "%JAVA_HOME%" == "" goto findJavaFromJavaHome
set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if "%ERRORLEVEL%" == "0" goto init
echo.
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
echo.
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
goto error

:findJavaFromJavaHome
set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
if exist "%JAVA_EXE%" goto init
echo.
echo ERROR: JAVA_HOME is set to an invalid directory.
echo JAVA_HOME = "%JAVA_HOME%"
echo Please set the JAVA_HOME variable in your environment to match the
echo location of your Java installation.
goto error

:init
@REM check for wrapper jar
if exist "%MAVEN_WRAPPER_JAR%" goto run
@REM download wrapper jar
echo.
echo Downloading Maven Wrapper...
echo.
set "WRAPPER_URL=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
powershell -Command "&{ [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%WRAPPER_URL%', '%MAVEN_WRAPPER_JAR%') }"
if not "%ERRORLEVEL%" == "0" goto error

:run
@REM run maven
"%JAVA_EXE%" %MAVEN_OPTS% -classpath "%MAVEN_WRAPPER_JAR%" "-Dmaven.multiModuleProjectDirectory=%PROJECT_ROOT%" org.apache.maven.wrapper.MavenWrapperMain %*
if not "%ERRORLEVEL%" == "0" goto error
goto end

:error
set ERROR_CODE=1

:end
@setlocal & set ERROR_CODE=%ERROR_CODE%
if not "%MAVEN_SKIP_RC%" == "" goto skipRcPost
if exist "%HOME%\mavenrc_post.bat" call "%HOME%\mavenrc_post.bat"
if exist "%PROJECT_ROOT%\.mvn\mavenrc_post.bat" call "%PROJECT_ROOT%\.mvn\mavenrc_post.bat"
:skipRcPost
exit /b %ERROR_CODE%
