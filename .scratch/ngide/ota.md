# Update OTA (tiket 15)

Sekali saja: build APK baru (berisi expo-updates + expo-sharing):
    npx eas-cli build -p android --profile preview

Setelah itu, perubahan JS/layar cukup:
    npx eas-cli update --channel preview --message "ringkasan perubahan"

App mengecek update saat dibuka dan memakainya pada pembukaan berikutnya.
Perubahan native (paket baru dengan kode native, izin, app.json plugin) tetap butuh build APK baru.
runtimeVersion mengikuti versi app (app.json "version"); naikkan versi setiap kali build native baru.
