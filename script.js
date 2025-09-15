document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const ctaButton = document.querySelector('.cta-button');
    const contactForm = document.querySelector('.contact-form');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    ctaButton.addEventListener('click', function() {
        const aboutSection = document.getElementById('about');
        const headerHeight = document.querySelector('header').offsetHeight;
        const targetPosition = aboutSection.offsetTop - headerHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    });

    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const name = this.querySelector('input[type="text"]').value;
        const email = this.querySelector('input[type="email"]').value;
        const message = this.querySelector('textarea').value;

        if (name && email && message) {
            alert('Thank you for your message! We\'ll get back to you soon.');
            this.reset();
        } else {
            alert('Please fill in all fields.');
        }
    });

    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (window.scrollY > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = '#fff';
            header.style.backdropFilter = 'none';
        }
    });

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animateElements = document.querySelectorAll('.service-card, .about p, .contact-form');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});