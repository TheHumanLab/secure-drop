document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const fileQueue = document.getElementById('file-queue');
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('system-feedback');

    let fileList = []; // Holds objects: { fileObject, relativePath }

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

    // Handle Drop Event
    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (items) {
            feedback.classList.add('hidden');
            // Traverse folders recursively
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) {
                    await traverseFileTree(item, "");
                }
            }
            updateQueueUI();
        }
    });

    // Recursive directory traversal
    async function traverseFileTree(item, path) {
        path = path || "";
        if (item.isFile) {
            await new Promise((resolve) => {
                item.file((file) => {
                    // Store relative path to preserve dropped folder hierarchy inside the zip
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

    // Workaround for browser reader chunk limits
    function readAllEntries(dirReader) {
        let entries = [];
        return new Promise((resolve) => {
            const read = () => {
                dirReader.readEntries((results) => {
                    if (!results.length) {
                        resolve(entries);
                    } else {
                        entries = entries.concat(results);
                        read();
                    }
                });
            };
            read();
        });
    }

    // File input fallback (manual selection)
    dropZone.addEventListener('click', (e) => {
        if (e.target !== browseBtn) fileInput.click();
    });
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!fileList.some(f => f.relativePath === file.name)) {
                fileList.push({ fileObject: file, relativePath: file.name });
            }
        }
        updateQueueUI();
    });

    // Format utility
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Update the visual files list
    function updateQueueUI() {
        fileQueue.innerHTML = '';
        
        if (fileList.length === 0) {
            queueContainer.classList.add('hidden');
            submitBtn.disabled = true;
            return;
        }

        queueContainer.classList.remove('hidden');
        submitBtn.disabled = false;
        queueCount.textContent = `${fileList.length} item(s) ready`;

        fileList.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'file-row';

            const nameEl = document.createElement('div');
            nameEl.className = 'file-name';
            // Show relative folder path if present
            nameEl.textContent = item.relativePath;

            const sizeEl = document.createElement('div');
            sizeEl.className = 'file-size';
            sizeEl.textContent = formatBytes(item.fileObject.size);

            const statusEl = document.createElement('div');
            statusEl.className = 'file-status';
            statusEl.textContent = 'Queued';

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-action';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                fileList.splice(index, 1);
                updateQueueUI();
            });

            row.appendChild(nameEl);
            row.appendChild(sizeEl);
            row.appendChild(statusEl);
            row.appendChild(removeBtn);

            fileQueue.appendChild(row);
        });
    }

    // Cloudflare Production Upload Execution
    submitBtn.addEventListener('click', async () => {
        if (fileList.length === 0) return;

        submitBtn.disabled = true;
        submitBtn.textContent = "Compressing files...";
        feedback.textContent = "Generating ZIP archive...";
        feedback.classList.remove('hidden');

        try {
            const zip = new JSZip();
            
            fileList.forEach(item => {
                zip.file(item.relativePath, item.fileObject);
            });

            const zipContent = await zip.generateAsync({ type: "blob" });
            
            feedback.textContent = "Transmitting secure package to KINGLIS server...";
            submitBtn.textContent = "Uploading...";

            // Secure domain endpoint
            const workerUrl = "https://secure.thisiskinglis.com";

            const uploadResponse = await fetch(workerUrl, {
                method: "POST",
                body: zipContent,
                headers: {
                    "Content-Type": "application/zip"
                }
            });

            if (uploadResponse.ok) {
                feedback.textContent = "Upload complete. Secure package received.";
                fileList = [];
                updateQueueUI();
            } else {
                throw new Error("Server transmission error.");
            }

            submitBtn.textContent = "Submit files";
            submitBtn.disabled = false;
        } catch (err) {
            feedback.textContent = `Transmission Failure: ${err.message}`;
            submitBtn.textContent = "Submit files";
            submitBtn.disabled = false;
        }
    });
});
