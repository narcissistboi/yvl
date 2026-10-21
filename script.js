console.log('Site yüklendi!');

// Basit bir mobil menü örneği (isteğe bağlı)
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', () => {
        console.log(link.textContent + ' sayfasına gidiliyor');
    });
});
