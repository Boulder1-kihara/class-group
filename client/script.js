document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');
    const terminal = document.getElementById('terminal');
    const terminalContent = document.getElementById('terminal-content');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Basic Client Selection
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const admission = document.getElementById('admission').value.toUpperCase();

        if (!name || !phone || !admission) return;

        // Disable form
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";
        form.style.opacity = '0.7';
        terminal.classList.remove('hidden');

        // Animation Steps
        const steps = [
            "Validating input...",
            "Accepting input...",
            "Checking for non-full groups...",
            "Hacking NAASA for additional groups...",
            "Gathering answers with empty groups..."
        ];

        // Helper to delay
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Helper to log to terminal
        const log = (text) => {
            // Clear previous content to show one message at a time
            terminalContent.innerHTML = '';

            const div = document.createElement('div');
            div.className = 'log-entry';
            div.textContent = text;
            terminalContent.appendChild(div);
        };

        try {
            // Step 1 - 5 Loop
            for (let i = 0; i < steps.length; i++) {
                log(steps[i]);
                await wait(5000); // 5 seconds interval
            }

            // API Call (Doing it here to check validity after "visual" processing)
            // Ideally we validate first, but for the effect requested, we pretend to process.
            // Let's send data now.
            const response = await fetch('https://class-group-705369450883.us-east1.run.app/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone,
                    admission_number: admission
                })
            });

            const result = await response.json();

            if (response.ok) {
                log("Data Encrypted & Stored.");
                await wait(2000);
                log("Success! Check main group for updates.", true); // Persistent frame

                // Final Success State
                submitBtn.textContent = "Completed";
                submitBtn.style.backgroundColor = "var(--success-color)";

                // Optional: Clear log after a few seconds if desired, but user said "disappear after getting displayed" likely referring to the sequence. 
                // We'll leave the final success message up so they know it worked.
            } else {
                log(`Error: ${result.error}`);
                submitBtn.disabled = false;
                submitBtn.textContent = "Retry";
                form.style.opacity = '1';
                // Beep or visual error
            }

        } catch (err) {
            log("System Error: Connection lost.");
            console.error(err);
            submitBtn.disabled = false;
            submitBtn.textContent = "Retry";
            form.style.opacity = '1';
        }
    });
});
