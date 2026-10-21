@echo off
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 set "PATH=%PATH%;C:\Program Files\Git\cmd"

echo ============================
echo  GitHub'a yukleniyor...
echo ============================

git add .
git commit -m "Otomatik guncelleme: %date% %time%" || echo  Degisiklik yok
git push -u origin main

if errorlevel 1 (
    echo.
    echo HATA: Yukleme basarisiz oldu. Yukaridaki mesaji kontrol et.
) else (
    echo.
    echo Tamamlandi! Site 1-2 dakika icinde guncellenir.
)

echo ============================
pause
