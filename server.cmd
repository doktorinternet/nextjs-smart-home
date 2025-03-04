@echo off
setlocal enabledelayedexpansion
echo start nextjs-smart-home server > lastrun.log

echo close any running server >> lastrun.log
tasklist /FI "WINDOWTITLE eq next-server *" >> lastrun.log
taskkill /FI "WINDOWTITLE eq next-server *" >> lastrun.log
echo error level: %ERRORLEVEL% >> lastrun.log
set TIME_OUT=2
echo wait for !TIME_OUT! sec to catch breath >> lastrun.log
timeout !TIME_OUT!
echo pull from git, install from npm, build and run server >> lastrun.log

start cmd /k "TITLE nextjs-smart-home & git pull >> lastrun.log & npm install >> lastrun.log & npm run build >> lastrun.log & npm run start" 