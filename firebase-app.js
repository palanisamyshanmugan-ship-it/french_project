// ========================================
// ProKick Network — Firebase Integration (UPGRADED)
// ========================================
// Features:
//   1. Email existence check before OTP (Abstract API — optional)
//   2. OTP email verification on signup  (EmailJS)
//   3. Booking confirmation email        (EmailJS)
//   4. Forgot password / reset link      (Firebase)
//
// ── SETUP ─────────────────────────────────────────────────────────────────
// Fill in the 4 EmailJS values below (required for OTP + booking emails).
// Optionally fill ABSTRACT_API_KEY to validate email existence before OTP.
// Free plan: 100 checks/month → https://www.abstractapi.com
//
// ── EMAILJS TEMPLATE VARIABLES ────────────────────────────────────────────
// OTP template:
//   {{to_email}}, {{to_name}}, {{otp_code}}
//
// Booking template:
//   {{to_email}}, {{to_name}}, {{player_name}},
//   {{event_date}}, {{event_type}}, {{reference}},
//   {{player_value}}, {{player_wage}}
// ==========================================================================

// ── Fill these in ──────────────────────────────────────────────────────────
var EMAILJS_PUBLIC_KEY = '1hxZfKRHt7tZwFtkh';
var EMAILJS_SERVICE_ID = 'service_3p9oeko';
var EMAILJS_TEMPLATE_OTP = 'template_tr4s459';
var EMAILJS_TEMPLATE_BOOKING = 'template_w89xai9';
var ABSTRACT_API_KEY = '64c2b1ce141b4b9b8c049b566cbfea78'; // optional — leave '' to skip email check
// ──────────────────────────────────────────────────────────────────────────

// ── Firebase ───────────────────────────────────────────────────────────────
var firebaseConfig = {
    apiKey: "AIzaSyCYzmlSkF_uHnImRbWVv1VNOZgMDawiMyo",
    authDomain: "prokick-network.firebaseapp.com",
    projectId: "prokick-network",
    storageBucket: "prokick-network.firebasestorage.app",
    messagingSenderId: "264063703138",
    appId: "1:264063703138:web:93c6e15519817119f0993b"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// ── EmailJS init — promise-gated so sends never fire before SDK is ready ──
var _emailjsReady = new Promise(function(resolve) {
    function tryInit() {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            resolve();
        } else {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
            s.onload = function() { emailjs.init(EMAILJS_PUBLIC_KEY); resolve(); };
            s.onerror = function() { resolve(); };
            document.head.appendChild(s);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
});

// ── OTP store ─────────────────────────────────────────────────────────────
var _otpStore = {};

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function saveOTP(email, code) {
    _otpStore[email] = { code: code, expires: Date.now() + 10 * 60 * 1000 };
}
function validateOTP(email, code) {
    var entry = _otpStore[email];
    if (!entry) return false;
    if (Date.now() > entry.expires) { delete _otpStore[email]; return false; }
    if (entry.code !== code.trim()) return false;
    delete _otpStore[email];
    return true;
}

// ── EmailJS senders — always wait for SDK to be ready first ───────────────
function sendOTPEmail(toEmail, toName, otpCode) {
    return _emailjsReady.then(function() {
        return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_OTP, {
            to_email: toEmail,
            to_name:  toName,
            otp_code: otpCode
        });
    });
}
function sendBookingEmail(toEmail, toName, params) {
    return _emailjsReady.then(function() {
        return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_BOOKING,
            Object.assign({ to_email: toEmail, to_name: toName }, params));
    });
}

// ── Email existence check (Abstract API) ──────────────────────────────────
function checkEmailExists(email) {
    if (!ABSTRACT_API_KEY) return Promise.resolve({ valid: true, reason: '' });
    var url = 'https://emailvalidation.abstractapi.com/v1/?api_key=' +
        ABSTRACT_API_KEY + '&email=' + encodeURIComponent(email);
    return fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var isDisposable = data.is_disposable_email && data.is_disposable_email.value;
            if (isDisposable) return { valid: false, reason: 'Les adresses email jetables ne sont pas autorisées.' };
            if (data.deliverability !== 'DELIVERABLE') return { valid: false, reason: 'Cette adresse email semble invalide ou inexistante.' };
            return { valid: true, reason: '' };
        })
        .catch(function () { return { valid: true, reason: '' }; }); // fail open
}

// ── OTP overlay (injected once into DOM) ──────────────────────────────────
(function injectOTPOverlay() {
    if (document.getElementById('otp-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'otp-overlay';
    overlay.style.cssText =
        'display:none;position:fixed;inset:0;z-index:9999;' +
        'background:rgba(4,8,15,.96);backdrop-filter:blur(14px);' +
        'align-items:center;justify-content:center;';

    var digits = [0, 1, 2, 3, 4, 5].map(function (i) {
        return '<input id="oi' + i + '" type="text" maxlength="1" inputmode="numeric" pattern="[0-9]"' +
            ' style="width:44px;height:52px;text-align:center;font-size:1.4rem;font-weight:700;' +
            'background:rgba(255,255,255,.06);border:1px solid rgba(100,140,220,.25);' +
            'border-radius:6px;color:#f5f0e8;outline:none;transition:border-color .2s;" />';
    }).join('');

    overlay.innerHTML =
        '<div style="background:rgba(7,13,28,.98);border:1px solid rgba(100,140,220,.25);' +
        'border-radius:14px;padding:2rem;width:100%;max-width:340px;text-align:center;animation:pf .35s ease;">' +
        '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:1.6rem;' +
        'letter-spacing:3px;color:#f0c040;margin-bottom:.4rem;">VÉRIFICATION EMAIL</div>' +
        '<p id="otp-desc" style="font-size:.82rem;color:#7a8faa;margin-bottom:1.4rem;line-height:1.6;">' +
        'Entrez le code à 6 chiffres envoyé à votre adresse email.</p>' +
        '<div style="display:flex;gap:.5rem;justify-content:center;margin-bottom:1rem;">' + digits + '</div>' +
        '<div id="otp-err" style="color:#e63946;font-size:.78rem;margin-bottom:.8rem;display:none;"></div>' +
        '<button id="otp-submit-btn" onclick="verifyOTPAndSignup()" style="width:100%;padding:13px;' +
        'background:linear-gradient(135deg,#f0c040,#c8960a);color:#04080f;border:none;' +
        'border-radius:6px;cursor:pointer;font-family:\'Oswald\',sans-serif;font-weight:700;' +
        'font-size:.92rem;letter-spacing:3px;text-transform:uppercase;margin-bottom:.6rem;">' +
        'VALIDER LE CODE &#8594;</button>' +
        '<button id="otp-resend-btn" onclick="resendOTP()" style="width:100%;padding:10px;' +
        'background:transparent;border:1px solid rgba(100,140,220,.25);border-radius:5px;' +
        'color:#7a8faa;cursor:pointer;font-family:\'Oswald\',sans-serif;font-size:.75rem;' +
        'letter-spacing:2px;text-transform:uppercase;margin-bottom:.5rem;">Renvoyer le code</button>' +
        '<button onclick="closeOTPOverlay()" style="background:none;border:none;color:#7a8faa;' +
        'font-size:.75rem;cursor:pointer;text-decoration:underline;">Annuler</button>' +
        '</div>';

    document.body.appendChild(overlay);

    setTimeout(function () {
        for (var i = 0; i < 6; i++) {
            (function (idx) {
                var el = document.getElementById('oi' + idx);
                if (!el) return;
                el.addEventListener('input', function () {
                    this.value = this.value.replace(/[^0-9]/g, '');
                    if (this.value && idx < 5) document.getElementById('oi' + (idx + 1)).focus();
                });
                el.addEventListener('keydown', function (e) {
                    if (e.key === 'Backspace' && !this.value && idx > 0)
                        document.getElementById('oi' + (idx - 1)).focus();
                });
            })(i);
        }
    }, 300);
})();

// ── Pending signup state ───────────────────────────────────────────────────
var _pendingSignup = null;

function openOTPOverlay(email) {
    var overlay = document.getElementById('otp-overlay');
    if (!overlay) return;
    document.getElementById('otp-desc').textContent = 'Code envoyé à ' + email + '. Valide 10 minutes.';
    document.getElementById('otp-err').style.display = 'none';
    for (var i = 0; i < 6; i++) { var inp = document.getElementById('oi' + i); if (inp) inp.value = ''; }
    overlay.style.display = 'flex';
    setTimeout(function () { var f = document.getElementById('oi0'); if (f) f.focus(); }, 100);
}

function closeOTPOverlay() {
    var overlay = document.getElementById('otp-overlay');
    if (overlay) overlay.style.display = 'none';
    _pendingSignup = null;
    var btn = document.querySelector('#sf .abtn');
    if (btn) { btn.textContent = 'Créer un Compte →'; btn.disabled = false; }
}

function resendOTP() {
    if (!_pendingSignup) return;
    var btn = document.getElementById('otp-resend-btn');
    btn.disabled = true; btn.textContent = 'Envoi...';
    var code = generateOTP();
    saveOTP(_pendingSignup.email, code);
    sendOTPEmail(_pendingSignup.email, _pendingSignup.name.split(' ')[0], code)
        .then(function () {
            btn.textContent = 'Code renvoyé ✓';
            setTimeout(function () { btn.textContent = 'Renvoyer le code'; btn.disabled = false; }, 3000);
        })
        .catch(function () { btn.textContent = 'Erreur – réessayez'; btn.disabled = false; });
}

function verifyOTPAndSignup() {
    var code = '';
    for (var i = 0; i < 6; i++) { var el = document.getElementById('oi' + i); code += el ? el.value : ''; }
    var errEl = document.getElementById('otp-err');
    if (code.length < 6) { errEl.textContent = 'Entrez les 6 chiffres.'; errEl.style.display = 'block'; return; }
    if (!validateOTP(_pendingSignup.email, code)) {
        errEl.textContent = 'Code incorrect ou expiré. Renvoyez un nouveau code.';
        errEl.style.display = 'block'; return;
    }
    errEl.style.display = 'none';
    var submitBtn = document.getElementById('otp-submit-btn');
    submitBtn.textContent = 'Création...'; submitBtn.disabled = true;

    var n = _pendingSignup.name, e = _pendingSignup.email, p = _pendingSignup.password;

    auth.createUserWithEmailAndPassword(e, p)
        .then(function (userCredential) {
            return db.collection('users').doc(userCredential.user.uid).set({
                name: n, email: e, emailVerified: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(function () { closeOTPOverlay(); enterApp(n.split(' ')[0], e); })
        .catch(function (error) {
            submitBtn.textContent = 'VALIDER LE CODE →'; submitBtn.disabled = false;
            var msg = error.code === 'auth/email-already-in-use' ? 'Email déjà utilisé.' : error.message;
            errEl.textContent = msg; errEl.style.display = 'block';
        });
}

// ========================================
// doLogin
// ========================================
function doLogin() {
    var e = document.getElementById('le').value.trim();
    var p = document.getElementById('lp').value;
    var err = document.getElementById('lerr');
    if (!e || !p) { err.style.display = 'block'; err.textContent = 'Veuillez remplir tous les champs.'; return; }
    err.style.display = 'none';
    var btn = document.querySelector('#lf .abtn');
    btn.textContent = 'Connexion...'; btn.disabled = true;

    auth.signInWithEmailAndPassword(e, p)
        .then(function (userCredential) {
            var user = userCredential.user;
            db.collection('users').doc(user.uid).get()
                .then(function (doc) {
                    var name = 'Utilisateur';
                    if (doc.exists && doc.data().name) name = doc.data().name.split(' ')[0];
                    enterApp(name, user.email || '');
                })
                .catch(function () { enterApp(e.split('@')[0], e); });
        })
        .catch(function (error) {
            err.style.display = 'block';
            switch (error.code) {
                case 'auth/user-not-found': err.textContent = 'Aucun compte trouvé avec cet email.'; break;
                case 'auth/wrong-password': err.textContent = 'Mot de passe incorrect.'; break;
                case 'auth/invalid-email': err.textContent = 'Adresse email invalide.'; break;
                case 'auth/too-many-requests': err.textContent = 'Trop de tentatives. Réessayez plus tard.'; break;
                default: err.textContent = 'Erreur : ' + error.message;
            }
            btn.textContent = 'Se Connecter →'; btn.disabled = false;
        });
}

// ========================================
// doSignup — validate email → OTP → create account
// ========================================
function doSignup() {
    var n = document.getElementById('sn').value.trim();
    var e = document.getElementById('se').value.trim();
    var p = document.getElementById('sp').value;
    var err = document.getElementById('serr');

    if (!n || !e || !p) { err.style.display = 'block'; err.textContent = 'Veuillez remplir tous les champs.'; return; }
    if (p.length < 6) { err.style.display = 'block'; err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; return; }
    err.style.display = 'none';

    var btn = document.querySelector('#sf .abtn');
    btn.textContent = 'Vérification...'; btn.disabled = true;

    // Step 1: check email exists (if ABSTRACT_API_KEY is set)
    checkEmailExists(e).then(function (result) {
        if (!result.valid) {
            err.textContent = result.reason; err.style.display = 'block';
            btn.textContent = 'Créer un Compte →'; btn.disabled = false;
            return;
        }

        // Step 2: send OTP
        btn.textContent = 'Envoi du code...';
        var code = generateOTP();
        saveOTP(e, code);
        _pendingSignup = { name: n, email: e, password: p };

        sendOTPEmail(e, n.split(' ')[0], code)
            .then(function () {
                openOTPOverlay(e);
                btn.textContent = 'Créer un Compte →'; btn.disabled = false;
            })
            .catch(function (emailErr) {
                _pendingSignup = null;
                console.error('EmailJS error:', emailErr);
                // Show the actual EmailJS error code if available to help debugging
                var detail = (emailErr && emailErr.text) ? ' (' + emailErr.text + ')' : '';
                err.textContent = 'Impossible d\'envoyer le code email. Vérifiez votre configuration EmailJS.' + detail;
                err.style.display = 'block';
                btn.textContent = 'Créer un Compte →'; btn.disabled = false;
            });
    });
}

// ========================================
// Forgot password
// ========================================
function showForgotPassword() {
    var prefill = (document.getElementById('le') || {}).value || '';
    var input = prompt('Entrez votre adresse email :', prefill);
    if (!input || !input.trim()) return;
    auth.sendPasswordResetEmail(input.trim())
        .then(function () { alert('✅ Email de réinitialisation envoyé à ' + input.trim() + '.\nVérifiez votre boîte de réception.'); })
        .catch(function (err) {
            var msg = err.code === 'auth/user-not-found' ? 'Aucun compte trouvé pour cet email.'
                : err.code === 'auth/invalid-email' ? 'Adresse email invalide.'
                    : err.message;
            alert('❌ ' + msg);
        });
}

// ========================================
// Guest mode
// ========================================
function guestIn() {
    enterApp('Invité');
}

// ========================================
// Logout
// ========================================
function doLogout() {
    auth.signOut().then(function () {
        document.querySelectorAll('.page').forEach(function (pg) { pg.classList.remove('active'); });
        document.getElementById('auth-page').style.display = '';
        document.getElementById('auth-page').classList.add('active');
        document.getElementById('mnav').style.display = 'none';
        document.getElementById('nua').classList.remove('show');
        ['le', 'lp', 'sn', 'se', 'sp'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.value = '';
        });
    });
}

// ========================================
// Auto-login on page load
// ========================================
auth.onAuthStateChanged(function (user) {
    if (user) {
        db.collection('users').doc(user.uid).get()
            .then(function (doc) {
                var name = 'Utilisateur';
                if (doc.exists && doc.data().name) name = doc.data().name.split(' ')[0];
                enterApp(name, user.email || '');
            })
            .catch(function () {
                enterApp(user.email ? user.email.split('@')[0] : 'Utilisateur', user.email || '');
            });
    }
});

// ========================================
// Save booking + send confirmation email
// ========================================
var originalSubmitForm = typeof submitForm === 'function' ? submitForm : null;

function submitFormWithFirebase() {
    var n = document.getElementById('fn').value.trim();
    var e = document.getElementById('fe').value.trim();
    var d = document.getElementById('fd').value;
    var t = document.getElementById('ft').value;

    if (!n || !e || !sn || !d || !t) {
        var btn = document.getElementById('sbtn');
        btn.style.background = 'linear-gradient(135deg,#e63946,#c0392b)';
        btn.textContent = 'Remplissez tous les champs !';
        setTimeout(function () { btn.style.background = ''; btn.textContent = '⚽ Envoyer la Demande →'; }, 2000);
        return;
    }

    var ref = 'PKN-' + Math.floor(100000 + Math.random() * 900000);
    var user = auth.currentUser;

    if (user) {
        db.collection('bookings').add({
            userId: user.uid, userEmail: user.email || '',
            playerName: sn, playerValue: sv, playerWage: sw, playerClub: sc,
            bookerName: n, bookerEmail: e, eventDate: d, eventType: t,
            reference: ref, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
            sendBookingEmail(e, n, {
                player_name: sn, event_date: d, event_type: t, reference: ref,
                player_value: '€' + sv, player_wage: '€' + sw
            }).catch(function () { });
        }).catch(function (err) { console.error('Erreur Firestore:', err); });
    }

    document.getElementById('m-pl').textContent = sn;
    document.getElementById('m-nm').textContent = n;
    document.getElementById('m-dt').textContent = d;
    document.getElementById('m-ty').textContent = t;
    document.getElementById('m-vl').textContent = '€' + sv;
    document.getElementById('m-wg').textContent = '€' + sw;
    document.getElementById('m-rf').textContent = ref;
    document.getElementById('modal').classList.add('on');
    confetti();
}

// Replace the original submitForm
submitForm = submitFormWithFirebase;
