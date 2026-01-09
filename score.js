// Function to send data to Google Sheets (Defined outside DOMContentLoaded scope)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUlYT3Q52Mq5pmOXhGD9AlAC115aztn9Pu6it3_h6nMXwPzNp7tTOI__yJhv7Nna_Rgw/exec";
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(error => console.error('SW Registration Failed:', error));
}



// Dedicated Batch Sync Function
async function syncBatch(golfer, scores) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ golfer: golfer, scores: scores })
        });
        console.log(`Synced batch of ${scores.length} holes for ${golfer}`);
    } catch (error) {
        console.error("Batch sync failed:", error);
    }
}

async function populateGolferSelect() {
    const selectElement = document.getElementById('golfer');
    // We use the same URL, but a GET request triggers the doGet function
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        const golfers = await response.json();

        if (Array.isArray(golfers)) {
            // Add a default option
            selectElement.innerHTML = '<option value="none">Select Golfer</option>';

            // Add options from the Google Sheet data
            golfers.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                selectElement.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Failed to fetch golfer list:", error);
        selectElement.innerHTML = '<option value="none">Error loading golfers</option>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(error => console.error('SW Registration Failed:', error));
    }
    // --- Selectors ---
    const confirmDialog = document.getElementById('confirmDialog');
    const startHoleDialog = document.getElementById('startHoleDialog');
    const finalScoreDialog = document.getElementById('finalScoreDialog');
    const namePlaceholder = document.getElementById('namePlaceholder');
    const golferSelect = document.getElementById('golfer');
    const startHoleInput = document.getElementById('startHoleInput');
    const frontDisplay = document.getElementById('frontTotalDisplay');
    const backDisplay = document.getElementById('backTotalDisplay');
    const grandDisplay = document.getElementById('grandTotalDisplay');
    const finalFront = document.getElementById('finalFront');
    const finalBack = document.getElementById('finalBack');
    const finalTotal = document.getElementById('finalTotal');
    const scorecardContainer = document.getElementById('score-inputs');
    const doneFixingBtn = document.getElementById('doneFixingBtn');

    // --- Configuration ---
    const TOTAL_HOLES_IN_ROUND = 18;

    populateGolferSelect();

    // --- Sort Inputs into 1-18 order ---
    const inputs = Array.from(document.querySelectorAll('[hole-data]'))
        .sort((a, b) => {
            const numA = parseInt(a.getAttribute('hole-data'), 10);
            const numB = parseInt(b.getAttribute('hole-data'), 10);
            return numA - numB;
        });

    // --- State Variables ---
    let front = 0;
    let back = 0;
    let holesCompleted = 0;
    let currentHoleIndex = 0;
    let selectedGolferName = '';
    let pendingScores = []; // Initialize the batch array

    // --- Functions ---
    function updateTotalsDisplay() {
        frontDisplay.textContent = front;
        backDisplay.textContent = back;
        grandDisplay.textContent = front + back;
        finalFront.textContent = front;
        finalBack.textContent = back;
        finalTotal.textContent = front + back;
    }

    function resetGameForFixes() {
        inputs.forEach(input => {
            input.disabled = false;
        });
        doneFixingBtn.style.display = 'block';
        inputs[0].focus();
    }

    function recalculateAndSyncAllScores() {
        front = 0;
        back = 0;
        let allScores = [];

        inputs.forEach(input => {
            const val = parseInt(input.value, 10) || 0;
            const holeNum = parseInt(input.getAttribute('hole-data'), 10);

            if (holeNum <= 9) front += val;
            else back += val;

            input.disabled = true;
            allScores.push({ hole: holeNum, score: val });
        });

        // Sync all 18 at once to save server load
        syncBatch(selectedGolferName, allScores);

        updateTotalsDisplay();
        doneFixingBtn.style.display = 'none';
        finalScoreDialog.showModal();
    }

    // --- Event Handlers ---

    golferSelect.addEventListener('change', (event) => {
        selectedGolferName = event.target.value;
        if (selectedGolferName !== 'none') {
            namePlaceholder.textContent = selectedGolferName;
            confirmDialog.showModal();
        }
    });

    confirmDialog.addEventListener('close', () => {
        if (confirmDialog.returnValue === 'yes') {
            startHoleDialog.showModal();
        } else {
            golferSelect.value = 'none';
        }
    });

    startHoleDialog.addEventListener('close', () => {
        const startHoleNum = parseInt(startHoleInput.value, 10);
        if (!isNaN(startHoleNum) && startHoleNum >= 1 && startHoleNum <= 9) {
            currentHoleIndex = startHoleNum - 1;
            if (inputs[currentHoleIndex]) {
                inputs[currentHoleIndex].disabled = false;
                inputs[currentHoleIndex].focus();
            }
        } else {
            startHoleDialog.showModal();
        }
    });

    finalScoreDialog.addEventListener('close', () => {
        if (finalScoreDialog.returnValue === 'fix') {
            resetGameForFixes();
        } else {
            console.log("Scores finalized and submitted.");
        }
    });

    doneFixingBtn.addEventListener('click', recalculateAndSyncAllScores);

    // 6. Main scorecard interaction logic
    scorecardContainer.addEventListener('change', (event) => {
        const input = event.target;

        if (doneFixingBtn.style.display === 'block') {
            let tempFront = 0; let tempBack = 0;
            inputs.forEach(inp => {
                const v = parseInt(inp.value, 10) || 0;
                const h = parseInt(inp.getAttribute('hole-data'), 10);
                if (h <= 9) tempFront += v; else tempBack += v;
            });
            front = tempFront; back = tempBack;
            updateTotalsDisplay();
            return;
        }

        if (input === inputs[currentHoleIndex]) {
            const val = parseInt(input.value, 10) || 0;
            const holeNum = parseInt(input.getAttribute('hole-data'), 10);

            pendingScores.push({ hole: holeNum, score: val });

            if (holeNum <= 9) front += val;
            else back += val;

            holesCompleted++;
            updateTotalsDisplay();

            // Sync every 4 holes OR on the 18th hole
            if (pendingScores.length === 4 || holesCompleted === TOTAL_HOLES_IN_ROUND) {
                syncBatch(selectedGolferName, [...pendingScores]);
                pendingScores = [];
            }

            if (holesCompleted >= TOTAL_HOLES_IN_ROUND) {
                input.disabled = true;
                finalScoreDialog.showModal();
            } else {
                input.disabled = true;
                currentHoleIndex = (currentHoleIndex + 1) % 18;

                const nextInput = inputs[currentHoleIndex];
                if (nextInput && nextInput.disabled) {
                    nextInput.disabled = false;
                    nextInput.focus();
                }
            }
        }
    });
}); // End of DOMContentLoaded
