// Basit link tıklama'effet
document.querySelectorAll('.link-card').forEach(card => {
    card.addEventListener('click', (e) => {
        e.preventDefault();
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 150);
    });
});
