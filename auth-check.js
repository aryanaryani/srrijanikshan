// ============================================================
// Yeh poori file ek guard ke andar hai taaki agar kisi wajah se
// (caching, duplicate include, webview quirk waghera) yeh script
// do baar chal jaaye, to bhi crash na ho aur dobara auth-check
// na ho (jo unnecessary extra network calls kar deta).
// `var` jaan-boojh kar use kiya hai (const/let nahi) kyunki var
// dobara declare hone par kabhi SyntaxError nahi deta — safety net.
// ============================================================
if (!window.__authCheckLoaded) {
    window.__authCheckLoaded = true;

    var SUPABASE_URL = "https://tphrdecdljxaqogocuxw.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_ot4NbsQjhhSPdj8VB76kRQ_TNQL3IUy";

    // Window object par supabase set karein taaki duplicate na bane
    if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    // ROOT-CAUSE FIX: yahan jaan-boojh kar top-level "var supabase" NAHI banaya.
    // Top-level "var" script-scope me window ki property ban jaata hai — isse
    // window.supabase (jo CDN library khud set karti hai, aur jiska .createClient()
    // index.html apna client banane ke liye use karta hai) OVERWRITE ho jaata tha.
    // Isi ki wajah se "auth-check.js change karne ke baad pura blank ho gaya" wala
    // bug aaya tha. Ab client sirf window.supabaseClient naam se hi milega —
    // window.supabase (library object) ko yeh file kabhi chhedti nahi.

    var currentUserProfile = null;

    // Referral reward se mila temporary (7-din) free-premium abhi active hai ya nahi, yeh check karta hai
    function hasActiveFreeTrial(profile) {
        return !!(profile && profile.premium_free_until && new Date(profile.premium_free_until) > new Date());
    }

    var checkAuthAndAccess = function () {
        return (async function () {
            var supabase = window.supabaseClient; // sirf isi function ke andar local hai, window ko touch nahi karta
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                const currentPage = window.location.pathname.split("/").pop();

                if (session && session.user) {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("subscription_status, subject_access, premium_free_until")
                        .eq("id", session.user.id)
                        .maybeSingle();

                    currentUserProfile = profile || { subscription_status: "FREE" };
                    window.userProfile = currentUserProfile;
                } else {
                    window.userProfile = { subscription_status: "FREE" };

                    // Protected pages (Bina login inpar nahi ja sakte)
                    const protectedPages = ["library.html", "scan.html", "questions.html", "contact.html"];
                    if (protectedPages.includes(currentPage)) {
                        alert("इस पेज को देखने के लिए पहले लॉगिन करें!");
                        window.location.href = "index.html";
                    }
                }
            } catch (e) {
                console.error("Auth check error:", e);
                // Error hone par bhi kam se kam default value set kar do, taaki dusre pages
                // window.userProfile ke undefined hone se crash na hon
                window.userProfile = window.userProfile || { subscription_status: "FREE" };
            }
        })();
    };

    // Helpers
    window.hasAccess = function (featureName, subjectName) {
        if (subjectName === void 0) subjectName = null;
        if (!window.userProfile) return false;
        var subscription_status = window.userProfile.subscription_status;
        var subject_access = window.userProfile.subject_access;

        // Referral se mila 7-din ka free trial bhi PAID_ALL jaisa full access deta hai
        if (subscription_status === 'PAID_ALL' || hasActiveFreeTrial(window.userProfile)) return true;
        if (subscription_status === 'PAID_SINGLE') {
            if (subjectName && subject_access === subjectName) return true;
            if (!subjectName) return true;
        }
        if (featureName === 'pdf_study' || featureName === 'photo_study' || featureName === 'library' || featureName === 'question_bank') {
            return false;
        }
        return true;
    };

    window.showUpgradeAlert = function (featureName) {
        alert("🔒 Premium Feature: Yeh feature (" + featureName + ") sirf paid members ke liye hai. Kripya apna plan upgrade karein!");
    };

    // IMPORTANT: is Promise ko dusre pages await kar sakte hain taaki
    // window.userProfile use karne se pehle uska load hona guaranteed ho
    window.authCheckReady = checkAuthAndAccess();
}