@echo off
cd /d "%~dp0"
echo ============================
echo  GitHub'a yukleniyor...
echo ============================
git add .
git commit -m "Otomatik guncelleme: %date% %time%" || echo "Degisiklik yok"
git push -u origin master
echo ============================
echo  Tamamlandi!
echo ============================
pause