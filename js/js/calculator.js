document.addEventListener('DOMContentLoaded', () => {
    const equationDisplay = document.getElementById('calc-equation');
    const displayElement = document.getElementById('calc-display');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');

    let currentInput = '0';
    let activeExpression = '';
    let isEvaluated = false;

    // Load calculation history from localStorage
    let history = JSON.parse(localStorage.getItem('calc_history')) || [];

    // Helper functions to update UI
    function updateDisplay(value) {
        // Strip trailing operators or clean display formatting
        displayElement.textContent = formatNumberString(value);
    }

    function updateEquation(value) {
        equationDisplay.textContent = value || ' ';
    }

    function formatNumberString(value) {
        if (!value) return '0';
        if (value === 'Error') return 'Error';

        // If it's a number, format with clean commas if it doesn't end in dot or decimals currently typed
        const parts = value.split('.');
        let integerPart = parts[0];
        const decimalPart = parts.length > 1 ? parts[1] : null;

        // Add commas to integer part
        if (!isNaN(integerPart) && integerPart !== '') {
            integerPart = parseFloat(integerPart).toLocaleString('en-US', { maximumFractionDigits: 0 });
        }

        return decimalPart !== null ? `${integerPart}.${decimalPart}` : integerPart;
    }

    // Safely evaluate expressions without utilizing global eval()
    function safeEvaluate(expression) {
        try {
            // Replace visual operators with valid JS math tokens
            let sanitized = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/−/g, '-');

            // Secure validation block to block arbitrary JS execution
            if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
                return 'Error';
            }

            // Perform computation
            const result = new Function(`return (${sanitized})`)();

            if (result === undefined || isNaN(result) || !isFinite(result)) {
                return 'Error';
            }

            // Limit floating error decimals based on settings or defaults (8 digits)
            const precision = parseInt(localStorage.getItem('calc_precision')) || 8;
            const factor = Math.pow(10, precision);
            return (Math.round(result * factor) / factor).toString();
        } catch (e) {
            return 'Error';
        }
    }

    // Appending input items
    function handleInput(token) {
        if (isEvaluated) {
            // If result was shown, starting a mathematical operation scales it forward
            if (['+', '−', '×', '÷', '*', '/'].includes(token)) {
                activeExpression = currentInput;
            } else {
                activeExpression = '';
            }
            isEvaluated = false;
        }

        // Decimal checks
        if (token === '.') {
            // Find current active running operand
            const operands = activeExpression.split(/[\+\−\×\÷\*\/]/);
            const currentOperand = operands[operands.length - 1];
            if (currentOperand.includes('.')) {
                return; // Suppress double decimal points
            }
            if (currentOperand === '' || activeExpression === '') {
                activeExpression += '0';
            }
        }

        // Direct operators
        if (['+', '−', '×', '÷'].includes(token)) {
            if (activeExpression === '') {
                activeExpression = '0';
            }
            const lastChar = activeExpression.slice(-1);
            if (['+', '−', '×', '÷'].includes(lastChar)) {
                // Swap last operator
                activeExpression = activeExpression.slice(0, -1) + token;
                updateEquation(activeExpression);
                return;
            }
        }

        // Append token
        activeExpression += token;
        currentInput = getActiveOperand();
        updateDisplay(currentInput);
        updateEquation(activeExpression);
    }

    function getActiveOperand() {
        const operands = activeExpression.split(/[\+\−\×\÷]/);
        const lastOperand = operands[operands.length - 1];
        return lastOperand || '0';
    }

    function handleAC() {
        currentInput = '0';
        activeExpression = '';
        isEvaluated = false;
        updateDisplay('0');
        updateEquation('');
    }

    function handleDEL() {
        if (isEvaluated) {
            handleAC();
            return;
        }
        if (activeExpression.length > 0) {
            activeExpression = activeExpression.slice(0, -1);
            currentInput = getActiveOperand();
            updateDisplay(currentInput);
            updateEquation(activeExpression);
        }
    }

    function handlePercentage() {
        if (isEvaluated) {
            activeExpression = currentInput;
            isEvaluated = false;
        }
        if (activeExpression) {
            const result = safeEvaluate(activeExpression);
            if (result !== 'Error') {
                const percentVal = (parseFloat(result) / 100).toString();
                activeExpression = percentVal;
                currentInput = percentVal;
                updateDisplay(currentInput);
                updateEquation(activeExpression);
            }
        }
    }

    function handleEqual() {
        if (!activeExpression || isEvaluated) return;

        // Guard trailing operator
        const lastChar = activeExpression.slice(-1);
        if (['+', '−', '×', '÷'].includes(lastChar)) {
            activeExpression = activeExpression.slice(0, -1);
        }

        const result = safeEvaluate(activeExpression);
        if (result === 'Error') {
            updateDisplay('Error');
            return;
        }

        const fullEquation = `${activeExpression} =`;

        // Save to History state
        const calcItem = {
            equation: fullEquation,
            result: formatNumberString(result),
            timestamp: Date.now()
        };

        history.push(calcItem);

        // Settings-based history limit check
        const histLimit = parseInt(localStorage.getItem('calc_history_limit')) || 10;
        if (history.length > histLimit) {
            history.shift();
        }

        localStorage.setItem('calc_history', JSON.stringify(history));

        // Update displays
        currentInput = result;
        isEvaluated = true;
        updateDisplay(currentInput);
        updateEquation(fullEquation);

        renderHistory();
    }

    // Render History Panel items
    function renderHistory() {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="list-group-item text-center py-4 text-muted text-xs bg-transparent border-0">
                    No calculations yet
                </div>`;
            return;
        }

        // Render backwards up to 10 items
        history.slice().reverse().forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'list-group-item d-flex flex-column align-items-end py-3 bg-transparent border-bottom border-light';
            historyItem.style.cursor = 'pointer';
            historyItem.style.transition = 'background-color 0.2s';

            historyItem.innerHTML = `
                <span class="text-xs text-muted mb-1 text-monospace">${item.equation}</span>
                <h5 class="h6 mb-0 font-weight-bold text-gray-800 text-monospace text-right">${item.result}</h5>
            `;

            // Recall transaction to active display when history block is clicked
            historyItem.addEventListener('click', () => {
                const eq = item.equation.replace(/ =$/, '').trim();
                activeExpression = eq;
                currentInput = item.result.replace(/,/g, '');
                isEvaluated = false;
                updateDisplay(currentInput);
                updateEquation(activeExpression);
            });

            // Hover effects
            historyItem.addEventListener('mouseenter', () => {
                historyItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            });
            historyItem.addEventListener('mouseleave', () => {
                historyItem.style.backgroundColor = 'transparent';
            });

            historyList.appendChild(historyItem);
        });
    }

    // Clear History handler
    clearHistoryBtn.addEventListener('click', () => {
        history = [];
        localStorage.removeItem('calc_history');
        renderHistory();
    });

    // Keyboard listener mappings
    window.addEventListener('keydown', (e) => {
        const key = e.key;

        // Digit inputs
        if (key >= '0' && key <= '9') {
            handleInput(key);
        }
        // Operator conversions
        else if (key === '+') handleInput('+');
        else if (key === '-') handleInput('−');
        else if (key === '*') handleInput('×');
        else if (key === '/') {
            e.preventDefault();
            handleInput('÷');
        }
        else if (key === '%') handlePercentage();
        else if (key === '.') handleInput('.');
        else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            handleEqual();
        }
        else if (key === 'Backspace') {
            handleDEL();
        }
        else if (key === 'Escape') {
            handleAC();
        }
    });

    // Button click mappings
    const buttons = document.querySelectorAll('.card-body .btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const txt = btn.textContent.trim();

            if (txt === 'AC') {
                handleAC();
            } else if (txt === 'DEL') {
                handleDEL();
            } else if (txt === '%') {
                handlePercentage();
            } else if (txt === '=') {
                handleEqual();
            } else {
                handleInput(txt);
            }
        });
    });

    // Initialize display & history render
    handleAC();
    renderHistory();
});
