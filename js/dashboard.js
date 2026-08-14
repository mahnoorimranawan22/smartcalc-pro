// ==========================================
// SMART CALC PRO - DASHBOARD
// ==========================================
// Updates the dashboard metric cards from data
// recorded by the calculator (localStorage) and
// persists the settings panel controls.

(function () {
    "use strict";

    var HISTORY_KEY = "smartcalc_history";
    var STATS_KEY = "smartcalc_stats";
    var PREFS_KEY = "smartcalc_prefs";

    // ==========================================
    // STORAGE HELPERS
    // ==========================================

    function readJSON(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            /* ignore */
        }
    }

    // ==========================================
    // SETTINGS CONTROLS
    // ==========================================

    function initSettings() {
        var prefs = readJSON(PREFS_KEY, {});

        var decimalSelect = document.getElementById("decimalPrecision");
        var limitSelect = document.getElementById("historyLimit");
        var darkSwitch = document.getElementById("darkModeSwitch");
        var hapticSwitch = document.getElementById("hapticSwitch");

        // Restore saved values into the controls
        if (decimalSelect && prefs.decimals) {
            var decimalMap = {
                "2": "2 Decimals",
                "4": "4 Decimals",
                "6": "6 Decimals",
                "auto": "Float (Auto)"
            };

            var decimalLabel = decimalMap[prefs.decimals];
            if (decimalLabel) {
                var option = Array.prototype.find.call(
                    decimalSelect.options,
                    function (opt) { return opt.textContent.trim() === decimalLabel; }
                );
                if (option) decimalSelect.value = option.value;
            }
        }

        if (limitSelect && prefs.historyLimit) {
            var limitMap = {
                "10": "10 Entries",
                "20": "20 Entries",
                "50": "50 Entries",
                "0": "Unlimited"
            };

            var limitLabel = limitMap[String(prefs.historyLimit)];
            if (limitLabel) {
                var limitOption = Array.prototype.find.call(
                    limitSelect.options,
                    function (opt) { return opt.textContent.trim() === limitLabel; }
                );
                if (limitOption) limitSelect.value = limitOption.value;
            }
        }

        if (darkSwitch && prefs.darkMode !== undefined) {
            darkSwitch.checked = !!prefs.darkMode;
        }

        if (hapticSwitch && prefs.haptics !== undefined) {
            hapticSwitch.checked = !!prefs.haptics;
        }

        // Persist changes
        if (decimalSelect) {
            decimalSelect.addEventListener("change", function () {
                var label = decimalSelect.options[decimalSelect.selectedIndex].textContent.trim();
                var map = {
                    "2 Decimals": "2",
                    "4 Decimals": "4",
                    "6 Decimals": "6",
                    "Float (Auto)": "auto"
                };
                var prefs = readJSON(PREFS_KEY, {});
                prefs.decimals = map[label] || "2";
                writeJSON(PREFS_KEY, prefs);
            });
        }

        if (limitSelect) {
            limitSelect.addEventListener("change", function () {
                var label = limitSelect.options[limitSelect.selectedIndex].textContent.trim();
                var map = {
                    "10 Entries": 10,
                    "20 Entries": 20,
                    "50 Entries": 50,
                    "Unlimited": 0
                };
                var prefs = readJSON(PREFS_KEY, {});
                prefs.historyLimit = map[label] !== undefined ? map[label] : 20;
                writeJSON(PREFS_KEY, prefs);
            });
        }

        if (darkSwitch) {
            darkSwitch.addEventListener("change", function () {
                var prefs = readJSON(PREFS_KEY, {});
                prefs.darkMode = darkSwitch.checked;
                writeJSON(PREFS_KEY, prefs);
            });
        }

        if (hapticSwitch) {
            hapticSwitch.addEventListener("change", function () {
                var prefs = readJSON(PREFS_KEY, {});
                prefs.haptics = hapticSwitch.checked;
                writeJSON(PREFS_KEY, prefs);
            });
        }
    }

    // ==========================================
    // METRIC CARDS
    // ==========================================

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function formatSessionTime(elapsedMs) {
        var totalMinutes = Math.floor(elapsedMs / 60000);

        if (totalMinutes < 1) {
            return "Less than 1 Min";
        }

        if (totalMinutes < 60) {
            return totalMinutes + " Mins";
        }

        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;

        return minutes > 0
            ? hours + " Hrs " + minutes + " Mins"
            : hours + " Hrs";
    }

    function updateSessionTime(sessionStarted) {
        var elapsed = Date.now() - sessionStarted;
        setText("active-session-time", formatSessionTime(elapsed));

        var bar = document.querySelector(".progress-bar.bg-info");
        if (bar) {
            // Session progress (scales towards a 2 hour cap)
            var pct = Math.min(100, Math.round((elapsed / (2 * 60 * 60 * 1000)) * 100));
            bar.style.width = pct + "%";
            bar.setAttribute("aria-valuenow", pct);
        }
    }

    function updateMetrics() {
        var stats = readJSON(STATS_KEY, {});
        var history = readJSON(HISTORY_KEY, []);

        // Total Calculations
        if (typeof stats.totalCalculations === "number") {
            setText("total-calculations", stats.totalCalculations.toLocaleString());
        }

        // Saved Equations
        if (typeof stats.savedEquations === "number") {
            setText("saved-equations", stats.savedEquations.toLocaleString());
        }

        // Memory Slots Used (history blocks, capped at 8)
        if (history.length > 0) {
            var used = Math.min(history.length, 8);
            setText("memory-slots", used + " / 8");
        }

        // Active Session Time
        if (stats.sessionStarted) {
            updateSessionTime(stats.sessionStarted);
            setInterval(function () {
                updateSessionTime(stats.sessionStarted);
            }, 60000);
        }
    }

    // ==========================================
    // START APPLICATION
    // ==========================================

    initSettings();
    updateMetrics();
})();
