// Display Snackbar.
function showSnackbar(snackbarId, duration = 3000) {
    const snackbar = document.getElementById(snackbarId);
    if (!snackbar) {
        console.error(`Snackbar with ID "${snackbarId}" not found.`);
        return;
    }

    // Avoid showing again if already visible.
    if (snackbar.classList.contains('show')) {
        console.warn(`Snackbar with ID "${snackbarId}" is already visible.`);
        return;
    }

    // Add "show" class to make it visible.
    snackbar.classList.add('show');

    // Automatically hide after duration.
    setTimeout(() => {
        closeSnackbar(snackbarId);
    }, duration);
}

// Close Snackbar.
function closeSnackbar(snackbarId) {
    const snackbar = document.getElementById(snackbarId);
    if (!snackbar) {
        console.error(`Snackbar with ID "${snackbarId}" not found.`);
        return;
    }

    // Remove "show" class to hide it.
    snackbar.classList.remove('show');
}
