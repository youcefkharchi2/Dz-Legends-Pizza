@echo off
chcp 65001 >nul
title DZ Legends Pizza - Gestion et Caisse
cd /d "%~dp0"
echo.
echo   DZ LEGENDS PIZZA
echo   Votre pizzeria, parfaitement orchestree.
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 ou plus recent est requis. Installez Node.js puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist ".env" (
  echo ERREUR : le fichier .env est absent.
  echo Cette application utilise PostgreSQL, pas SQLite.
  echo Configurez DATABASE_URL dans .env. Consultez README.md.
  echo Consultez README.md avant de relancer le logiciel.
  pause
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Installation des dependances. Internet est requis pour cette premiere etape.
  call npm.cmd install
  if errorlevel 1 goto :failure
)
echo Verification de PostgreSQL et demarrage du serveur...
node.exe server\launcher.mjs
if errorlevel 1 goto :failure
exit /b 0
:failure
echo.
echo Le logiciel n'a pas pu demarrer. Verifiez PostgreSQL et le fichier .env.
echo Les details de l'erreur sont affiches ci-dessus.
pause
exit /b 1
