document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileQueue = document.getElementById('file-queue');
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('system-feedback');
    const clientNameInput = document.getElementById('client-name');
    const clientError = document.getElementById('client-error');
    // NEW - email
    const clientEmailInput = document.getElementById('client-email');
    const emailError = document.getElementById('email-error');

    let fileList = [];

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function isReadyToSubmit() {
        const hasFiles = fileList.length > 0;
        const hasName = clientNameInput && clientNameInput.value.trim().length > 0;
        const hasEmail = clientEmailInput && isValidEmail(clientEmailInput.value.trim());
        return hasFiles && hasName && hasEmail;
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.add('drag-over');
        }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (items) {
            feedback.classList.add('hidden');
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) await traverseFileTree(item, "");
            }
            updateQueueUI();
        }
    });

    async function traverseFileTree(item, path) {
        path = path || "";
        if (item.isFile) {
            await new Promise((resolve) => {
                item.file((file) => {
                    const relativePath = path + file.name;
                    if (!fileList.some(f => f.relativePath === relativePath)) {
                        fileList.push({ fileObject: file, relativePath: relativePath });
                    }
                    resolve();
                });
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const entries = await readAllEntries(dirReader);
            for (let i = 0; i < entries.length; i++) {
                await traverseFileTree(entries[i], path + item.name + "/");
            }
        }
    }

    function readAllEntries(dirReader) {
        let entries = [];
        return new Promise((resolve) => {
            const read = () => {
                dirReader.readEntries((results) => {
                    if (!results.length) resolve(entries);
                    else { entries = entries.concat(results); read(); }
                });
            };
            read();
        });
    }

    dropZone.addEventListener('click', (e) => { if (e.target!== browseBtn) fileInput.click(); });
    browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    fileInput.addEventListener('change', () => {
        for (let file of fileInput.files) {
            if (!fileList.some(f => f.relativePath === file.name)) {
                fileList.push({ fileObject: file, relativePath: file.name });
            }
        }
        updateQueueUI();
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes','KB','MB','GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function updateQueueUI() {
        fileQueue.innerHTML = '';
        if (fileList.length === 0) {
            queueContainer.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }
        queueContainer.classList.remove('hidden');
        submitBtn.disabled = !isReadyToSubmit();
        queueCount.textContent = `${fileList.length} item(s) ready`;
        fileList.forEach((item, index) => {
            const row = document.createElement('div'); row.className = 'file-row';
            const nameEl = document.createElement('div'); nameEl.className = 'file-name'; nameEl.textContent = item.relativePath;
            const sizeEl = document.createElement('div'); sizeEl.className = 'file-size'; sizeEl.textContent = formatBytes(item.fileObject.size);
            const statusEl = document.createElement('div'); statusEl.className = 'file-status'; statusEl.textContent = 'Queued';
            const removeBtn = document.createElement('button'); removeBtn.className = 'remove-action'; removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => { fileList.splice(index, 1); updateQueueUI(); });
            row.append(nameEl, sizeEl, statusEl, removeBtn);
            fileQueue.appendChild(row);
        });
    }

    if (clientNameInput) {
        clientNameInput.addEventListener('input', () => {
            if (clientError) clientError.style.display = 'none';
            submitBtn.disabled = !isReadyToSubmit();
        });
    }
    // NEW - email listener
    if (clientEmailInput) {
        clientEmailInput.addEventListener('input', () => {
            if (emailError) emailError.style.display = 'none';
            submitBtn.disabled = !isReadyToSubmit();
        });
    }

    submitBtn.addEventListener('click', async () => {
        const rawClient = clientNameInput ? clientNameInput.value.trim() : "";
        const rawEmail = clientEmailInput ? clientEmailInput.value.trim() : "";

        if (!rawClient) {
            if (clientError) clientError.style.display = 'block';
            if (clientNameInput) clientNameInput.focus();
            return;
        }
        if (!isValidEmail(rawEmail)) {
            if (emailError) emailError.style.display = 'block';
            if (clientEmailInput) clientEmailInput.focus();
            return;
        }
        if (fileList.length === 0) return;
        if (typeof JSZip === 'undefined') {
            feedback.textContent = "System Error: JSZip library not loaded. Refresh page.";
            feedback.classList.remove('hidden'); return;
        }

        const client = rawClient.replace(/[^a-zA-Z0-9-_ ]/g,"").trim().replace(/\s+/g,"-");

        submitBtn.disabled = true;
        submitBtn.textContent = "Compressing files...";
        feedback.textContent = "Generating ZIP archive...";
        feedback.classList.remove('hidden');

       try {
            const zip = new JSZip();
            fileList.forEach(item => { zip.file(item.relativePath, item.fileObject); });
            zip.file('_CONTACT.txt', `Company: ${rawClient}\nEmail: ${rawEmail}`);
            const zipContent = await zip.generateAsync({ type: "blob" });

            feedback.textContent = "Transmitting secure package to KINGLIS server...";
            submitBtn.textContent = "Uploading...";

            const workerBase = "https://odd-smoke-ec2b.thisistrinary.workers.dev";
            // NOW INCLUDES EMAIL
            const workerUrl = `${workerBase}?client=${encodeURIComponent(client)}&email=${encodeURIComponent(rawEmail)}`;

            const uploadResponse = await fetch(workerUrl, {
                method: "POST",
                body: zipContent,
                headers: { "Content-Type": "application/zip" }
            });

            if (uploadResponse.ok) {
                feedback.textContent = "Upload complete. Secure package received.";
                fileList = [];
                updateQueueUI();
            } else {
                const errText = await uploadResponse.text();
                throw new Error(`Server rejected upload (${uploadResponse.status}): ${errText}`);
            }
            submitBtn.textContent = "Submit files";
            submitBtn.disabled = true;
        } catch (err) {
            feedback.textContent = `Transmission Failure: ${err.message}`;
            submitBtn.textContent = "Submit files";
            submitBtn.disabled = false;
        }
    });
});
