(function () {
    'use strict';

    var STORAGE_KEY = 'street-stitch-cart';
    var THEME_KEY = 'street-stitch-theme';
    var MAX_QTY = 99;

    var peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

    // ---------- Catalog (read from the HTML) ----------
    var catalog = {};
    document.querySelectorAll('article[data-id]').forEach(function (el) {
        catalog[el.dataset.id] = {
            name: el.dataset.name,
            price: Number(el.dataset.price)
        };
    });

    var cart = loadCart();

    // ---------- DOM elements ----------
    var cartList = document.getElementById('cart-items');
    var cartEmpty = document.getElementById('cart-empty');
    var cartCount = document.getElementById('cart-count');
    var subtotalEl = document.getElementById('subtotal');
    var totalEl = document.getElementById('total');
    var placeOrder = document.getElementById('place-order');
    var checkoutForm = document.getElementById('checkout-form');
    var layout = document.getElementById('checkout-layout');
    var confirmation = document.getElementById('order-confirmation');
    var orderMessage = document.getElementById('order-message');

    // ---------- Helpers ----------
    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function clampQty(value) {
        var n = parseInt(value, 10);
        if (isNaN(n) || n < 1) return 1;
        return Math.min(n, MAX_QTY);
    }

    // ---------- Cart storage ----------
    function loadCart() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            return saved.filter(function (item) {
                return item && catalog[item.id] && item.size;
            }).map(function (item) {
                return { id: item.id, size: item.size, qty: clampQty(item.qty) };
            });
        } catch (e) {
            return [];
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch (e) {}
    }

    // ---------- Cart rendering ----------
    function cartButton(className, label, action, index, ariaLabel) {
        var b = el('button', className, label);
        b.type = 'button';
        b.dataset.action = action;
        b.dataset.index = index;
        b.setAttribute('aria-label', ariaLabel);
        return b;
    }

    function render() {
        var subtotal = cart.reduce(function (sum, item) {
            return sum + catalog[item.id].price * item.qty;
        }, 0);

        var totalQty = cart.reduce(function (sum, item) {
            return sum + item.qty;
        }, 0);

        cartCount.textContent = totalQty;
        cartEmpty.hidden = cart.length > 0;
        cartList.innerHTML = '';

        cart.forEach(function (item, index) {
            var product = catalog[item.id];
            var li = el('li', 'cart-item');

            li.appendChild(el('div', 'cart-item-name', product.name));
            li.appendChild(el('div', 'cart-item-total', peso.format(product.price * item.qty)));
            li.appendChild(el('div', 'cart-item-meta',
                'Size: ' + item.size + ' \u00B7 ' + peso.format(product.price) + ' each'));

            var controls = el('div', 'cart-item-controls');
            var dec = cartButton('qty-btn', '\u2212', 'dec', index, 'Decrease quantity of ' + product.name);
            dec.disabled = item.qty <= 1;
            var inc = cartButton('qty-btn', '+', 'inc', index, 'Increase quantity of ' + product.name);
            inc.disabled = item.qty >= MAX_QTY;
            var qty = el('span', 'qty-value', String(item.qty));
            qty.setAttribute('aria-live', 'polite');
            var remove = cartButton('link-btn', 'Remove', 'remove', index, 'Remove ' + product.name + ' from cart');

            controls.appendChild(dec);
            controls.appendChild(qty);
            controls.appendChild(inc);
            controls.appendChild(remove);
            li.appendChild(controls);

            cartList.appendChild(li);
        });

        subtotalEl.textContent = peso.format(subtotal);
        totalEl.textContent = peso.format(subtotal);
        placeOrder.disabled = cart.length === 0;
    }

    function addItem(id, size, qty) {
        var existing = cart.find(function (item) {
            return item.id === id && item.size === size;
        });

        if (existing) {
            existing.qty = Math.min(MAX_QTY, existing.qty + qty);
        } else {
            cart.push({ id: id, size: size, qty: Math.min(MAX_QTY, qty) });
        }

        saveCart();
        render();
    }

    cartList.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;

        var index = Number(btn.dataset.index);
        var item = cart[index];
        if (!item) return;

        if (btn.dataset.action === 'inc') {
            item.qty = Math.min(MAX_QTY, item.qty + 1);
        } else if (btn.dataset.action === 'dec') {
            item.qty = Math.max(1, item.qty - 1);
        } else if (btn.dataset.action === 'remove') {
            cart.splice(index, 1);
        }

        saveCart();
        render();
    });

    // ---------- Quantity steppers ----------
    function makeStepper() {
        var wrap = el('div', 'qty-stepper');

        var minus = el('button', 'qty-btn', '\u2212');
        minus.type = 'button';
        minus.dataset.step = '-1';
        minus.setAttribute('aria-label', 'Decrease quantity');

        var input = el('input', 'qty-input');
        input.type = 'number';
        input.min = '1';
        input.max = String(MAX_QTY);
        input.value = '1';
        input.inputMode = 'numeric';
        input.setAttribute('aria-label', 'Quantity');

        var plus = el('button', 'qty-btn', '+');
        plus.type = 'button';
        plus.dataset.step = '1';
        plus.setAttribute('aria-label', 'Increase quantity');

        wrap.appendChild(minus);
        wrap.appendChild(input);
        wrap.appendChild(plus);
        return wrap;
    }

    function readQty(stepper) {
        var input = stepper.querySelector('.qty-input');
        var qty = clampQty(input.value);
        input.value = qty;
        return qty;
    }

    function resetQty(stepper) {
        stepper.querySelector('.qty-input').value = 1;
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.qty-stepper .qty-btn');
        if (!btn) return;
        var input = btn.parentNode.querySelector('.qty-input');
        input.value = clampQty(clampQty(input.value) + Number(btn.dataset.step));
    });

    document.addEventListener('change', function (e) {
        if (e.target.classList && e.target.classList.contains('qty-input')) {
            e.target.value = clampQty(e.target.value);
        }
    });

    // ---------- Shop cards ----------
    function flash(msg, text) {
        if (!msg) return;
        msg.textContent = text;
        clearTimeout(msg._timer);
        if (text) {
            msg._timer = setTimeout(function () { msg.textContent = ''; }, 3000);
        }
    }

    function addToCart(article) {
        var id = article.dataset.id;
        var select = article.querySelector('.product-buy select');
        var msg = article.querySelector('.product-msg');
        var stepper = article.querySelector('.qty-stepper');
        var size = select.value;

        if (!size) {
            flash(msg, 'Please choose a size.');
            select.focus();
            return;
        }

        var qty = readQty(stepper);
        addItem(id, size, qty);
        resetQty(stepper);
        flash(msg, qty > 1 ? 'Added ' + qty + ' to cart!' : 'Added to cart!');
    }

    document.querySelectorAll('article[data-id]').forEach(function (article) {
        var buy = article.querySelector('.product-buy');
        var btn = article.querySelector('.add-to-cart');

        if (buy && btn) {
            buy.insertBefore(makeStepper(), btn);
            btn.addEventListener('click', function () {
                addToCart(article);
            });
        }

        // Read More, the photo and the title all open the full description
        var openers = [
            article.querySelector('.read-more'),
            article.querySelector('img'),
            article.querySelector('h3')
        ];
        openers.forEach(function (node) {
            if (!node) return;
            node.addEventListener('click', function (e) {
                e.preventDefault();
                openModal(article);
            });
        });
    });

    // ---------- Product modal ----------
    var modal = document.getElementById('product-modal');
    var modalImage = document.getElementById('modal-image');
    var modalTitle = document.getElementById('modal-title');
    var modalPrice = document.getElementById('modal-price');
    var modalBody = document.getElementById('modal-body');
    var modalSize = document.getElementById('modal-size');
    var modalAdd = document.getElementById('modal-add');
    var modalMsg = document.getElementById('modal-msg');
    var modalClose = document.getElementById('modal-close');
    var modalStepper = makeStepper();
    var modalArticle = null;

    modalAdd.parentNode.insertBefore(modalStepper, modalAdd);

    function openModal(article) {
        modalArticle = article;

        var img = article.querySelector('img');
        var src = img ? img.getAttribute('src') : '';
        if (src) {
            modalImage.src = src;
        } else {
            modalImage.removeAttribute('src');
        }
        modalImage.alt = img ? img.alt : '';

        modalTitle.textContent = article.dataset.name;
        modalPrice.textContent = peso.format(Number(article.dataset.price));

        var details = article.querySelector('.product-details');
        modalBody.innerHTML = details ? details.innerHTML : article.querySelector('p').outerHTML;

        var cardSelect = article.querySelector('.product-buy select');
        modalSize.innerHTML = '';
        Array.prototype.forEach.call(cardSelect.options, function (opt) {
            modalSize.appendChild(opt.cloneNode(true));
        });
        modalSize.value = cardSelect.value;

        resetQty(modalStepper);
        modalMsg.textContent = '';

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.setAttribute('open', '');
        }
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        if (typeof modal.close === 'function') {
            modal.close();
        } else {
            modal.removeAttribute('open');
        }
        document.body.classList.remove('modal-open');
    }

    modalClose.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
    });

    modal.addEventListener('close', function () {
        document.body.classList.remove('modal-open');
    });

    modalAdd.addEventListener('click', function () {
        if (!modalArticle) return;

        var size = modalSize.value;
        if (!size) {
            flash(modalMsg, 'Please choose a size.');
            modalSize.focus();
            return;
        }

        var qty = readQty(modalStepper);
        addItem(modalArticle.dataset.id, size, qty);
        resetQty(modalStepper);
        flash(modalMsg, qty > 1 ? 'Added ' + qty + ' to cart!' : 'Added to cart!');
    });

    // ---------- City / Municipality dropdown ----------
    var CITY_DATA = [
        // Metro Manila
        'Caloocan|Metro Manila', 'Las Pi\u00F1as|Metro Manila', 'Makati|Metro Manila', 'Malabon|Metro Manila',
        'Mandaluyong|Metro Manila', 'Manila|Metro Manila', 'Marikina|Metro Manila', 'Muntinlupa|Metro Manila',
        'Navotas|Metro Manila', 'Para\u00F1aque|Metro Manila', 'Pasay|Metro Manila', 'Pasig|Metro Manila',
        'Pateros|Metro Manila', 'Quezon City|Metro Manila', 'San Juan|Metro Manila', 'Taguig|Metro Manila',
        'Valenzuela|Metro Manila',
        // Cordillera & Ilocos
        'Baguio|Benguet', 'La Trinidad|Benguet', 'Tabuk|Kalinga', 'Bangued|Abra',
        'Laoag|Ilocos Norte', 'Batac|Ilocos Norte', 'Vigan|Ilocos Sur', 'Candon|Ilocos Sur',
        'San Fernando|La Union',
        // Pangasinan & Cagayan Valley
        'Dagupan|Pangasinan', 'Alaminos|Pangasinan', 'San Carlos|Pangasinan', 'Urdaneta|Pangasinan',
        'Tuguegarao|Cagayan', 'Ilagan|Isabela', 'Cauayan|Isabela', 'Santiago|Isabela', 'Bayombong|Nueva Vizcaya',
        // Central Luzon
        'Angeles|Pampanga', 'Mabalacat|Pampanga', 'San Fernando|Pampanga', 'Olongapo|Zambales',
        'Balanga|Bataan', 'Malolos|Bulacan', 'Meycauayan|Bulacan', 'San Jose del Monte|Bulacan',
        'Cabanatuan|Nueva Ecija', 'Gapan|Nueva Ecija', 'Palayan|Nueva Ecija', 'San Jose|Nueva Ecija',
        'Science City of Mu\u00F1oz|Nueva Ecija', 'Tarlac City|Tarlac',
        // CALABARZON & MIMAROPA
        'Batangas City|Batangas', 'Lipa|Batangas', 'Tanauan|Batangas',
        'Calamba|Laguna', 'Santa Rosa|Laguna', 'Bi\u00F1an|Laguna', 'San Pablo|Laguna', 'Cabuyao|Laguna', 'San Pedro|Laguna',
        'Bacoor|Cavite', 'Cavite City|Cavite', 'Dasmari\u00F1as|Cavite', 'Imus|Cavite', 'General Trias|Cavite',
        'Tagaytay|Cavite', 'Trece Martires|Cavite', 'Antipolo|Rizal', 'Lucena|Quezon', 'Tayabas|Quezon',
        'Calapan|Oriental Mindoro', 'Puerto Princesa|Palawan',
        // Bicol
        'Legazpi|Albay', 'Ligao|Albay', 'Tabaco|Albay', 'Naga|Camarines Sur', 'Iriga|Camarines Sur',
        'Sorsogon City|Sorsogon', 'Masbate City|Masbate',
        // Western & Central Visayas
        'Iloilo City|Iloilo', 'Roxas|Capiz', 'Kalibo|Aklan',
        'Bacolod|Negros Occidental', 'Bago|Negros Occidental', 'Cadiz|Negros Occidental', 'Kabankalan|Negros Occidental',
        'La Carlota|Negros Occidental', 'Sagay|Negros Occidental', 'San Carlos|Negros Occidental',
        'Silay|Negros Occidental', 'Sipalay|Negros Occidental', 'Talisay|Negros Occidental', 'Victorias|Negros Occidental',
        'Dumaguete|Negros Oriental', 'Bais|Negros Oriental', 'Bayawan|Negros Oriental', 'Canlaon|Negros Oriental',
        'Guihulngan|Negros Oriental', 'Tanjay|Negros Oriental',
        'Cebu City|Cebu', 'Lapu-Lapu|Cebu', 'Mandaue|Cebu', 'Talisay|Cebu', 'Toledo|Cebu', 'Danao|Cebu',
        'Carcar|Cebu', 'Naga|Cebu', 'Bogo|Cebu', 'Tagbilaran|Bohol',
        // Eastern Visayas
        'Tacloban|Leyte', 'Ormoc|Leyte', 'Calbayog|Samar', 'Catbalogan|Samar', 'Borongan|Eastern Samar', 'Maasin|Southern Leyte',
        // Mindanao
        'Zamboanga City|Zamboanga del Sur', 'Pagadian|Zamboanga del Sur', 'Dipolog|Zamboanga del Norte', 'Dapitan|Zamboanga del Norte',
        'Cagayan de Oro|Misamis Oriental', 'Gingoog|Misamis Oriental', 'El Salvador|Misamis Oriental',
        'Ozamiz|Misamis Occidental', 'Oroquieta|Misamis Occidental', 'Tangub|Misamis Occidental',
        'Iligan|Lanao del Norte', 'Marawi|Lanao del Sur', 'Malaybalay|Bukidnon', 'Valencia|Bukidnon',
        'Butuan|Agusan del Norte', 'Cabadbaran|Agusan del Norte', 'Bayugan|Agusan del Sur',
        'Surigao City|Surigao del Norte', 'Tandag|Surigao del Sur', 'Bislig|Surigao del Sur',
        'Davao City|Davao del Sur', 'Digos|Davao del Sur', 'Tagum|Davao del Norte', 'Panabo|Davao del Norte',
        'Samal|Davao del Norte', 'Mati|Davao Oriental',
        'General Santos|South Cotabato', 'Koronadal|South Cotabato', 'Kidapawan|Cotabato', 'Cotabato City|Maguindanao del Norte'
    ].map(function (entry) {
        var parts = entry.split('|');
        return { name: parts[0], province: parts[1] };
    }).sort(function (a, b) {
        return a.name.localeCompare(b.name) || a.province.localeCompare(b.province);
    });

    var citySelect = document.getElementById('city');
    var cityOtherField = document.getElementById('city-other-field');
    var cityOther = document.getElementById('city-other');
    var provinceInput = document.getElementById('province');

    if (citySelect) {
        CITY_DATA.forEach(function (city) {
            var opt = document.createElement('option');
            opt.value = city.name;
            opt.textContent = city.name + ' \u2014 ' + city.province;
            opt.dataset.province = city.province;
            citySelect.appendChild(opt);
        });

        var otherOpt = document.createElement('option');
        otherOpt.value = '__other';
        otherOpt.textContent = 'Other (my municipality isn\u2019t listed)';
        citySelect.appendChild(otherOpt);
    }

    function syncCity(userChanged) {
        if (!citySelect) return;
        var isOther = citySelect.value === '__other';

        cityOtherField.hidden = !isOther;
        cityOther.required = isOther;
        if (!isOther) cityOther.value = '';

        if (userChanged) {
            var opt = citySelect.selectedOptions[0];
            if (isOther) {
                provinceInput.value = '';
                cityOther.focus();
            } else if (opt && opt.dataset.province) {
                provinceInput.value = opt.dataset.province;
            }
        }
    }

    if (citySelect) {
        citySelect.addEventListener('change', function () { syncCity(true); });
    }

    // ---------- Payment method ----------
    var cardFields = document.getElementById('card-fields');

    function syncPayment() {
        if (!checkoutForm || !cardFields) return;
        var chosen = checkoutForm.querySelector('input[name="payment"]:checked');
        var isCard = !!chosen && chosen.value === 'card';
        cardFields.hidden = !isCard;
        cardFields.querySelectorAll('[data-card]').forEach(function (input) {
            input.required = isCard;
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('change', function (e) {
            if (e.target.name === 'payment') syncPayment();
        });
    }

    // ---------- Checkout ----------
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (cart.length === 0) return;

            var name = document.getElementById('full-name').value.trim();
            var email = document.getElementById('checkout-email').value.trim();
            var ref = 'SS-' + Date.now().toString(36).toUpperCase();

            orderMessage.textContent =
                'Thank you, ' + name + '! Order ' + ref + ' has been placed. A confirmation email was sent to ' + email + '.';

            cart = [];
            saveCart();
            checkoutForm.reset();
            syncCity(false);
            syncPayment();
            render();

            layout.hidden = true;
            confirmation.hidden = false;
        });
    }

    // ---------- Size chart illustration ----------
    var sizeRows = Array.prototype.slice.call(document.querySelectorAll('.size-table tbody tr'));
    var pillsBox = document.getElementById('size-pills');
    var sizeCaption = document.getElementById('size-caption');
    var svgChest = document.getElementById('sz-chest');
    var svgLength = document.getElementById('sz-length');
    var svgShoulder = document.getElementById('sz-shoulder');

    if (pillsBox && sizeRows.length) {
        var sizes = sizeRows.map(function (row) {
            var c = row.cells;
            return {
                size: c[0].textContent.trim(),
                chest: c[1].textContent.trim(),
                length: c[2].textContent.trim(),
                shoulder: c[3].textContent.trim()
            };
        });

        var pills = sizes.map(function (s, i) {
            var pill = el('button', 'size-pill', s.size);
            pill.type = 'button';
            pill.setAttribute('aria-pressed', 'false');
            pill.addEventListener('click', function () { selectSize(i); });
            pillsBox.appendChild(pill);
            return pill;
        });

        sizeRows.forEach(function (row, i) {
            row.addEventListener('click', function () { selectSize(i); });
        });

        var selectSize = function (index) {
            var s = sizes[index];
            pills.forEach(function (pill, i) {
                pill.setAttribute('aria-pressed', i === index ? 'true' : 'false');
            });
            sizeRows.forEach(function (row, i) {
                row.classList.toggle('selected', i === index);
            });
            svgChest.textContent = s.chest;
            svgLength.textContent = s.length;
            svgShoulder.textContent = s.shoulder;
            sizeCaption.textContent = 'Size ' + s.size + ' \u2014 tap another size to compare.';
        };

        var defaultIndex = sizes.findIndex(function (s) { return s.size === 'M'; });
        selectSize(defaultIndex >= 0 ? defaultIndex : 0);
    }

    // ---------- Light / dark theme ----------
    var root = document.documentElement;
    var themeBtn = document.getElementById('theme-toggle');
    var brandLogo = document.querySelector('header .logo');
    var LIGHT_LOGO = brandLogo ? brandLogo.getAttribute('src') : 'logo-light.png';
    var DARK_LOGO = 'logo-dark.png';

    function currentTheme() {
        return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function syncThemeButton() {
        var dark = currentTheme() === 'dark';

        if (brandLogo) {
            brandLogo.src = dark ? DARK_LOGO : LIGHT_LOGO;
        }

        if (!themeBtn) return;
        themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
            syncThemeButton();
        });
    }

    // ---------- Initial render ----------
    syncThemeButton();
    syncPayment();
    render();
})();
