// ========================================
// ProKick Network — Firebase Integration
// ========================================
// IMPORTANT: Replace the config below with YOUR Firebase project config.
// 1. Go to https://console.firebase.google.com
// 2. Create a project → Add Web App → Copy config
// 3. Enable Email/Password in Authentication → Sign-in method
// 4. Create Firestore Database in test mode

var firebaseConfig = {
    apiKey: "AIzaSyCYzmlSkF_uHnImRbWVv1VNOZgMDawiMyo",
    authDomain: "prokick-network.firebaseapp.com",
    projectId: "prokick-network",
    storageBucket: "prokick-network.firebasestorage.app",
    messagingSenderId: "264063703138",
    appId: "1:264063703138:web:93c6e15519817119f0993b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// ========================================
// Override doLogin — Firebase Email/Password
// ========================================
function doLogin() {
    var e = document.getElementById('le').value.trim();
    var p = document.getElementById('lp').value;
    var err = document.getElementById('lerr');

    if (!e || !p) {
        err.style.display = 'block';
        err.textContent = 'Veuillez remplir tous les champs.';
        return;
    }
    err.style.display = 'none';

    // Disable button while processing
    var btn = document.querySelector('#lf .abtn');
    btn.textContent = 'Connexion...';
    btn.disabled = true;

    auth.signInWithEmailAndPassword(e, p)
        .then(function (userCredential) {
            var user = userCredential.user;
            // Fetch display name from Firestore
            db.collection('users').doc(user.uid).get().then(function (doc) {
                var name = 'Utilisateur';
                if (doc.exists && doc.data().name) {
                    name = doc.data().name.split(' ')[0];
                }
                enterApp(name);
            }).catch(function () {
                enterApp(e.split('@')[0]);
            });
        })
        .catch(function (error) {
            err.style.display = 'block';
            switch (error.code) {
                case 'auth/user-not-found':
                    err.textContent = 'Aucun compte trouvé avec cet email.';
                    break;
                case 'auth/wrong-password':
                    err.textContent = 'Mot de passe incorrect.';
                    break;
                case 'auth/invalid-email':
                    err.textContent = 'Adresse email invalide.';
                    break;
                case 'auth/too-many-requests':
                    err.textContent = 'Trop de tentatives. Réessayez plus tard.';
                    break;
                default:
                    err.textContent = 'Erreur de connexion: ' + error.message;
            }
            btn.textContent = 'Se Connecter →';
            btn.disabled = false;
        });
}

// ========================================
// Override doSignup — Firebase Create Account
// ========================================
function doSignup() {
    var n = document.getElementById('sn').value.trim();
    var e = document.getElementById('se').value.trim();
    var p = document.getElementById('sp').value;
    var err = document.getElementById('serr');

    if (!n || !e || !p) {
        err.style.display = 'block';
        err.textContent = 'Veuillez remplir tous les champs.';
        return;
    }
    if (p.length < 6) {
        err.style.display = 'block';
        err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
        return;
    }
    err.style.display = 'none';

    var btn = document.querySelector('#sf .abtn');
    btn.textContent = 'Création...';
    btn.disabled = true;

    auth.createUserWithEmailAndPassword(e, p)
        .then(function (userCredential) {
            var user = userCredential.user;
            // Save user profile to Firestore
            return db.collection('users').doc(user.uid).set({
                name: n,
                email: e,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(function () {
                enterApp(n.split(' ')[0]);
            });
        })
        .catch(function (error) {
            err.style.display = 'block';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    err.textContent = 'Cet email est déjà utilisé.';
                    break;
                case 'auth/invalid-email':
                    err.textContent = 'Adresse email invalide.';
                    break;
                case 'auth/weak-password':
                    err.textContent = 'Mot de passe trop faible (6+ caractères).';
                    break;
                default:
                    err.textContent = 'Erreur: ' + error.message;
            }
            btn.textContent = 'Créer un Compte →';
            btn.disabled = false;
        });
}

// ========================================
// Guest mode (no Firebase required)
// ========================================
function guestIn() {
    enterApp('Invité');
}

// ========================================
// Logout
// ========================================
function doLogout() {
    auth.signOut().then(function () {
        // Return to auth page
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        document.getElementById('auth-page').style.display = '';
        document.getElementById('auth-page').classList.add('active');
        document.getElementById('mnav').style.display = 'none';
        document.getElementById('nua').classList.remove('show');
        // Clear form fields
        ['le', 'lp', 'sn', 'se', 'sp'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
    });
}

// ========================================
// Auto-login on page load (auth state persistence)
// ========================================
auth.onAuthStateChanged(function (user) {
    if (user) {
        // User is signed in — skip auth page
        db.collection('users').doc(user.uid).get().then(function (doc) {
            var name = 'Utilisateur';
            if (doc.exists && doc.data().name) {
                name = doc.data().name.split(' ')[0];
            }
            enterApp(name);
        }).catch(function () {
            enterApp(user.email ? user.email.split('@')[0] : 'Utilisateur');
        });
    }
});

// ========================================
// Save booking to Firestore (enhanced submitForm)
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

    // Save to Firestore if user is logged in
    var user = auth.currentUser;
    if (user) {
        db.collection('bookings').add({
            userId: user.uid,
            playerName: sn,
            playerValue: sv,
            playerWage: sw,
            playerClub: sc,
            bookerName: n,
            bookerEmail: e,
            eventDate: d,
            eventType: t,
            reference: ref,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
            console.log('Réservation enregistrée dans Firestore');
        }).catch(function (err) {
            console.error('Erreur Firestore:', err);
        });
    }

    // Show confirmation modal
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
