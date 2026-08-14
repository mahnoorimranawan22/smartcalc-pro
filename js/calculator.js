// ==========================================
// SMART CALC PRO - CALCULATOR
// ==========================================
// Drives the calculator UI in smartcalc.html:
// button grid, keyboard shortcuts, history panel,
// memory blocks (localStorage) and shared settings.

(function () {
    "use strict";

    // ==========================================
    // STORAGE KEYS
    // ==========================================

    var HISTORY_KEY = "smartcalc_history";
    var STATS_KEY = "smartcalc_stats";
    var PREFS_KEY = "smartcalc_prefs";

    // ==========================================
    // STATE
    // ==========================================

    var expr = "";              // expression shown in the equation line
    var entry = "";             // number currently being typed
    var justEvaluated = false;  // true right after "="
    var history = [];           // [{ expr, result, ts }]

    // ==========================================
    // DOM ELEMENTS
    // ==========================================

    var displayEl = document.getElementById("calc-display");
    var equationEl = document.getElementById("calc-equation");
    var historyList = document.getElementById("history-list");
    var clearHistoryBtn = document.getElementById("clear-history");
    var calcBody = null;

    var buttons = document.querySelectorAll(".card.custom-card .card-body .btn");
    if (buttons.length > 0) {
        calcBody = buttons[0].closest(".card-body");
    }

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
            /* storage unavailable - app still works in memory */
        }
    }

    function loadHistory() {
        history = readJSON(HISTORY_KEY, []);
    }

    function saveHistory() {
        writeJSON(HISTORY_KEY, history);
    }

    function loadStats() {
        return readJSON(STATS_KEY, {});
    }

    function saveStats(stats) {
        writeJSON(STATS_KEY, stats);
    }

    function loadPrefs() {
        return readJSON(PREFS_KEY, {});
    }

    function savePrefs(prefs) {
        writeJSON(PREFS_KEY, prefs);
    }

    // ==========================================
    // SETTINGS
    // ==========================================

    function getDecimals() {
        var prefs = loadPrefs();
        return prefs.decimals || "2";
    }

    function getHistoryLimit() {
        var prefs = loadPrefs();
        var limit = parseInt(prefs.historyLimit, 10);
        return isNaN(limit) || limit <= 0 ? 0 : limit; // 0 = unlimited
    }

    // ==========================================
    // FORMATTING
    // ==========================================

    function formatNumber(value) {
        if (typeof value !== "number" || !isFinite(value)) {
            return "Error";
        }

        var decimals = getDecimals();

        if (decimals === "auto") {
            // Trim float artifacts but keep precision
            return String(parseFloat(value.toPrecision(12)));
        }

        var fixed = Number(decimals) || 2;

        // Very large / very small numbers fall back to exponential
        if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < Math.pow(10, -fixed))) {
            return String(value);
        }

        return value.toFixed(fixed);
    }

    // ==========================================
    // EXPRESSION EVALUATOR (safe, no eval)
    // ==========================================

    // Tokenizer + recursive-descent parser supporting
    // + - * / % and parentheses. Throws on invalid input.

    function evaluate(source) {
        var tokens = tokenize(source);
        var pos = 0;

        function peek() {
            return tokens[pos];
        }

        function next() {
            return tokens[pos++];
        }

        function expectNumber() {
            var t = next();
            if (!t || t.type !== "num") throw new Error("Invalid expression");
            return t.value;
        }

        function parseFactor() {
            var t = peek();

            if (t && t.type === "op" && t.value === "-") {
                next();
                return -parseFactor();
            }

            if (t && t.type === "op" && t.value === "(") {
                next();
                var inner = parseExpression();
                if (!peek() || peek().value !== ")") throw new Error("Unbalanced parentheses");
                next();
                return inner;
            }

            var value = expectNumber();

            // Postfix percent: 50% -> 0.5
            t = peek();
            if (t && t.type === "op" && t.value === "%") {
                next();
                value = value / 100;
            }

            return value;
        }

        function parseTerm() {
            var value = parseFactor();

            while (peek() && peek().type === "op" &&
                (peek().value === "*" || peek().value === "/")) {
                var op = next().value;
                var rhs = parseFactor();

                if (op === "*") {
                    value = value * rhs;
                } else {
                    if (rhs === 0) throw new Error("Division by zero");
                    value = value / rhs;
                }
            }

            return value;
        }

        function parseExpression() {
            var value = parseTerm();

            while (peek() && peek().type === "op" &&
                (peek().value === "+" || peek().value === "-")) {
                var op = next().value;
                var rhs = parseTerm();

                value = op === "+" ? value + rhs : value - rhs;
            }

            return value;
        }

        var result = parseExpression();

        if (pos !== tokens.length) {
            throw new Error("Invalid expression");
        }

        return result;
    }

    function tokenize(source) {
        var tokens = [];
        var i = 0;
        var n = source.length;

        while (i < n) {
            var ch = source[i];

            if (ch === " " || ch === "\t") {
                i++;
                continue;
            }

            if ("+-*/%()".indexOf(ch) !== -1) {
                tokens.push({ type: "op", value: ch });
                i++;
                continue;
            }

            if (ch >= "0" && ch <= "9" || ch === ".") {
                var start = i;
                var dots = 0;

                while (i < n) {
                    var c = source[i];
                    if (c >= "0" && c <= "9") {
                        i++;
                    } else if (c === ".") {
                        dots++;
                        i++;
                    } else {
                        break;
                    }
                }

                var raw = source.slice(start, i);

                // Reject malformed numbers like "2..3" or "."
                if (dots > 1 || raw === ".") {
                    throw new Error("Invalid number");
                }

                tokens.push({ type: "num", value: parseFloat(raw) });
                continue;
            }

            throw new Error("Invalid character");
        }

        return tokens;
    }

    // ==========================================
    // HISTORY
    // ==========================================

    function renderHistory() {
        if (!historyList) return;

        if (history.length === 0) {
            historyList.innerHTML =
                '<div class="list-group-item text-center text-muted small py-4">' +
                "No calculations yet." +
                "</div>";
            return;
        }

        var limit = getHistoryLimit();
        var items = limit > 0 ? history.slice(0, limit) : history;

        historyList.innerHTML = items.map(function (item) {
            var time = new Date(item.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

            return (
                '<button type="button" class="list-group-item list-group-item-action d-flex ' +
                'justify-content-between align-items-center" data-expr="' +
                escapeAttr(item.expr) + '" data-result="' + escapeAttr(item.result) + '">' +
                '<span class="text-monospace">' + escapeHtml(item.expr) + " = " +
                escapeHtml(item.result) + "</span>" +
                '<small class="text-muted">' + time + "</small>" +
                "</button>"
            );
        }).join("");
    }

    function addHistory(expression, result) {
        history.unshift({
            expr: expression,
            result: result,
            ts: Date.now()
        });

        var limit = getHistoryLimit();
        if (limit > 0 && history.length > limit) {
            history.length = limit;
        }

        saveHistory();
        renderHistory();
        saveStatsWithMemory();
    }

    function clearHistory() {
        history = [];
        saveHistory();
        renderHistory();
        saveStatsWithMemory();
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    // ==========================================
    // DASHBOARD STATS
    // ==========================================

    function saveStatsWithMemory() {
        var stats = loadStats();

        if (!stats.sessionStarted) {
            stats.sessionStarted = Date.now();
        }

        stats.savedEquations = history.length;
        writeJSON(STATS_KEY, stats);
    }

    function recordCalculation() {
        var stats = loadStats();

        if (!stats.sessionStarted) {
            stats.sessionStarted = Date.now();
        }

        stats.totalCalculations = (stats.totalCalculations || 0) + 1;
        writeJSON(STATS_KEY, stats);
    }

    // ==========================================
    // UI UPDATES
    // ==========================================

    function render() {
        displayEl.textContent = entry || "0";
        equationEl.textContent = expr || "\u00a0";
    }

    function prettyExpression(raw) {
        return raw
            .replace(/\*/g, "×")
            .replace(/\//g, "÷")
            .replace(/-/g, "−");
    }

    // ==========================================
    // ACTIONS
    // ==========================================

    function pressDigit(digit) {
        if (justEvaluated) {
            expr = "";
            entry = "";
            justEvaluated = false;
        }

        if (digit === "." && entry.indexOf(".") !== -1) {
            return;
        }

        // Prevent silly long entries
        if (entry.replace(/[^0-9]/g, "").length >= 15 && digit !== ".") {
            return;
        }

        entry += digit;
        render();
    }

    function pressOperator(op) {
        // Map displayed operators to evaluator symbols
        var symbol = op;
        if (op === "÷") symbol = "/";
        if (op === "×") symbol = "*";
        if (op === "−") symbol = "-";

        if (justEvaluated) {
            // Chain from the previous result
            expr = entry || expr;
            justEvaluated = false;
        }

        // If an operator was just entered, replace it
        if (expr.length > 0 && "+-*/".indexOf(expr.slice(-1)) !== -1) {
            expr = expr.slice(0, -1);
        }

        expr = (expr || entry || "0") + symbol;
        entry = "";
        render();
    }

    function pressPercent() {
        if (entry === "" && expr === "") return;

        var target = entry || expr;

        var match = target.match(/(\d+(?:\.\d+)?)$/);
        if (!match) return;

        var value = parseFloat(match[1]) / 100;

        if (entry !== "") {
            entry = String(value);
        } else {
            expr = target.slice(0, match.index) + String(value);
        }

        render();
    }

    function pressEquals() {
        var full = (expr || "") + entry;

        if (full === "") return;

        try {
            var value = evaluate(full);
            var formatted = formatNumber(value);

            if (formatted === "Error") {
                throw new Error("Invalid result");
            }

            equationEl.textContent = prettyExpression(full) + " =";
            displayEl.textContent = formatted;

            addHistory(prettyExpression(full), formatted);
            recordCalculation();

            expr = String(value);
            entry = "";
            justEvaluated = true;
        } catch (e) {
            displayEl.textContent = "Error";
            equationEl.textContent = prettyExpression(full);
            expr = "";
            entry = "";
            justEvaluated = true;
        }
    }

    function pressClear() {
        expr = "";
        entry = "";
        justEvaluated = false;
        render();
    }

    function pressDelete() {
        if (justEvaluated) {
            pressClear();
            return;
        }

        if (entry.length > 0) {
            entry = entry.slice(0, -1);
        } else if (expr.length > 0) {
            expr = expr.slice(0, -1);
        }

        render();
    }

    function restoreHistoryItem(item) {
        expr = item.expr;
        entry = item.result;
        justEvaluated = false;
        render();
    }

    // ==========================================
    // BUTTON EVENTS
    // ==========================================

    if (calcBody) {
        calcBody.addEventListener("click", function (event) {
            var button = event.target.closest("button");
            if (!button || !calcBody.contains(button)) return;

            var label = button.textContent.trim();

            if (/^\d+$/.test(label) || label === ".") {
                pressDigit(label);
            } else if (label === "AC") {
                pressClear();
            } else if (label === "DEL") {
                pressDelete();
            } else if (label === "=") {
                pressEquals();
            } else if (label === "%") {
                pressPercent();
            } else if (label === "÷" || label === "×" || label === "−" || label === "+") {
                pressOperator(label);
            }
        });
    }

    // History click-to-restore
    if (historyList) {
        historyList.addEventListener("click", function (event) {
            var item = event.target.closest("button[data-result]");
            if (!item) return;

            restoreHistoryItem({
                expr: item.getAttribute("data-expr"),
                result: item.getAttribute("data-result")
            });
        });
    }

    // Clear history button
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", function () {
            clearHistory();
        });
    }

    // ==========================================
    // KEYBOARD SHORTCUTS
    // ==========================================

    document.addEventListener("keydown", function (event) {
        var key = event.key;

        // Numbers (including keypad)
        if (/^[0-9]$/.test(key) || (key >= "0" && key <= "9")) {
            pressDigit(key);
            return;
        }

        if (key === "NumpadDecimal" || key === ".") {
            pressDigit(".");
            return;
        }

        if (key === "+" || key === "NumpadAdd") {
            pressOperator("+");
            return;
        }

        if (key === "-" || key === "NumpadSubtract") {
            pressOperator("-");
            return;
        }

        if (key === "*" || key === "NumpadMultiply") {
            pressOperator("*");
            return;
        }

        if (key === "/" || key === "NumpadDivide") {
            pressOperator("/");
            return;
        }

        if (key === "%") {
            pressPercent();
            return;
        }

        if (key === "Enter" || key === "=" || key === "NumpadEnter") {
            event.preventDefault();
            pressEquals();
            return;
        }

        if (key === "Escape") {
            pressClear();
            return;
        }

        if (key === "Backspace") {
            event.preventDefault();
            pressDelete();
        }
    });

    // ==========================================
    // START APPLICATION
    // ==========================================

    loadHistory();
    renderHistory();
    render();
})();
