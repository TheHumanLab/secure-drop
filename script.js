document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileQueue = document.getElementById('file-queue');
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('system-feedback');

    let selectedFiles = [];

    // Drag-and-drop Events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // Clicking drop zone triggers hidden native input
    dropZone.addEventListener('click', (e) => {
        if (e.target !== browseBtn) {
            fileInput.click();
        }
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    // File Processing Loop
    function handleFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Prevent exact duplicates in UI queue
            if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
            }
        }
        updateQueueUI();
    }

    // Format utility
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // UI Updates
    function updateQueueUI() {
        fileQueue.innerHTML = '';
        
        if (selectedFiles.length === 0) {
            queueContainer.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }

        queueContainer.classList.remove('hidden');
        submitBtn.disabled = false;
        queueCount.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`;

        selectedFiles.forEach((file, index) => {
            const row = document.createElement('div');
            row.className = 'file-row';

            const nameEl = document.createElement('div');
            nameEl.className = 'file-name';
            nameEl.textContent = file.name;

            const sizeEl = document.createElement('div');
            sizeEl.className = 'file-size';
            sizeEl.textContent = formatBytes(file.size);

            const statusEl = document.createElement('div');
            statusEl.className = 'file-status';
            statusEl.textContent = 'Ready';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-action';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => removeFile(index));

            row.appendChild(nameEl);
            row.appendChild(sizeEl);
            row.appendChild(statusEl);
            row.appendChild(removeBtn);

            fileQueue.appendChild(row);
        });
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateQueueUI();
        feedback.classList.add('hidden');
    }

    // Submission handler
    submitBtn.addEventListener('click', () => {
        feedback.textContent = 'Submission mechanism is not yet active. Visual layer only.';
        feedback.classList.remove('hidden');
    });
});
