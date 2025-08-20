document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const textInput = document.getElementById('textInput');
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const logOutput = document.getElementById('logOutput');
    const fileLabel = document.getElementById('file-label');
    const spinner = document.getElementById('spinner');
    const buttonText = document.getElementById('button-text');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const closeError = document.getElementById('close-error');
    const dropZone = document.getElementById('drop-zone');

    let markdownContent = '';
    let selectedFileName = '';
    const originalButtonText = buttonText.textContent.trim();

    updateButtonState();

    textInput.addEventListener('input', updateButtonState);
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    processButton.addEventListener('click', handleProcess);
    closeError.addEventListener('click', hideError);

    dropZone.addEventListener('dragenter', handleDragEnter, false);
    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('dragleave', handleDragLeave, false);
    dropZone.addEventListener('drop', handleDrop, false);

    function updateButtonState() {
        const hasText = textInput.value.trim() !== '';
        const hasFile = markdownContent !== '';
        processButton.disabled = !hasText && !hasFile;
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-sky-500', 'dark:border-sky-400', 'bg-sky-50', 'dark:bg-slate-700');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-sky-500', 'dark:border-sky-400', 'bg-sky-50', 'dark:bg-slate-700');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-sky-500', 'dark:border-sky-400', 'bg-sky-50', 'dark:bg-slate-700');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    function handleFile(file) {
        hideError();
        if (!file) {
            return;
        }

        if (!file.name.endsWith('.md')) {
            showError("Invalid file type. Please upload a '.md' file.");
            resetInputs();
            return;
        }

        selectedFileName = file.name;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            markdownContent = e.target.result;
            const sanitizedFileName = DOMPurify.sanitize(selectedFileName);
            updateStatus(`File loaded: <strong>${sanitizedFileName}</strong>. Ready to process.`);
            fileLabel.innerHTML = `<span class=\"font-semibold text-green-500 dark:text-green-400\">${sanitizedFileName}</span> loaded.`;
            updateButtonState();
        };

        reader.onerror = () => {
            showError(`Error reading file: ${DOMPurify.sanitize(selectedFileName)}.`);
            resetInputs();
        }
        
        reader.readAsText(file);
    }

    async function handleProcess() {
        const textContent = textInput.value.trim();
        let contentToProcess;
        let zipNameSource;

        if (textContent) {
            contentToProcess = textContent;
            zipNameSource = 'project';
        } else if (markdownContent) {
            contentToProcess = markdownContent;
            zipNameSource = selectedFileName;
        } else {
            showError('Please paste content into the textarea or upload a Markdown file.');
            return;
        }
        
        hideError();
        setLoadingState(true);

        try {
            updateStatus('Parsing content...');
            const { files, extraText } = parseMarkdown(contentToProcess);
            if (files.length === 0 && !extraText.trim()) {
                 throw new Error("Parsing did not find any files or content. Ensure file definitions (e.g., '### path/to/file' or '/path/to/file') are followed by a code block.");
            }
            logParsedStructure(files, extraText);
            await createZip(files, extraText, zipNameSource);
        } catch (error) {
            showError(error.message);
            updateStatus(`Processing failed. <span class=\"text-red-500 dark:text-red-400\">${DOMPurify.sanitize(error.message)}</span>`, true);
            console.error(error);
        } finally {
            setLoadingState(false);
        }
    }
    
    function setLoadingState(isLoading) {
        if (isLoading) {
            processButton.disabled = true;
            spinner.classList.remove('hidden');
            buttonText.textContent = 'Processing...';
        } else {
            updateButtonState();
            spinner.classList.add('hidden');
            buttonText.textContent = originalButtonText;
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.classList.remove('hidden');
    }

    function hideError() {
        errorAlert.classList.add('hidden');
    }

    function resetInputs() {
        fileInput.value = '';
        textInput.value = '';
        markdownContent = '';
        selectedFileName = '';
        fileLabel.innerHTML = `<span class=\"font-semibold text-sky-500 dark:text-sky-400\">Click to upload</span> or drag and drop`;
        updateStatus('Awaiting input...');
        updateButtonState();
    }
    
    function parseMarkdown(content) {
        const files = [];
        let extraText = '';
        let lastIndex = 0;

        const fileBlockRegex = new RegExp(
            '(?:' +
                '^### File: `([^`]+)`' +
                '|' +
                '^###\\s+([\\S]+)' +
                '|' +
                '^(\\/[\\S]+)' +
            ')' +
            '\\s*\\r?\\n' +
            '```(?:[a-zA-Z0-9\\-_]+)?\\r?\\n' +
            '([\\s\\S]*?)' +
            '\\r?\\n```',
            'gm'
        );

        let match;
        while ((match = fileBlockRegex.exec(content)) !== null) {
            extraText += content.substring(lastIndex, match.index);
            const path = (match[1] || match[2] || match[3]).trim();
            const fileContent = match[4];
            files.push({ path: path, content: fileContent });
            lastIndex = fileBlockRegex.lastIndex;
        }

        extraText += content.substring(lastIndex);

        return { files, extraText: extraText.trim() };
    }

    async function createZip(files, extraText, nameSource) {
        updateStatus('Creating ZIP archive...');
        const zip = new JSZip();
        const projectName = nameSource.replace(new RegExp('\\.md$'), '') || 'project';

        for (const file of files) {
            const sanitizedContent = file.content;
            zip.file(file.path, sanitizedContent);
        }

        if (extraText) {
            zip.file('README.md', extraText);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${projectName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        let finalMessage = `ZIP file '<strong>${DOMPurify.sanitize(projectName)}.zip</strong>' generated and download initiated.`;
        if (extraText) {
             finalMessage += ` Includes <strong>README.md</strong>.`
        }
        updateStatus(finalMessage);
    }
    
    function updateStatus(message, isError = false) {
        const sanitizedMessage = DOMPurify.sanitize(message, { USE_PROFILES: { html: true } });
        logOutput.innerHTML = sanitizedMessage;
        if (isError) {
            logOutput.classList.add('text-red-500', 'dark:text-red-400');
            logOutput.classList.remove('text-slate-500', 'dark:text-slate-400');
        } else {
            logOutput.classList.remove('text-red-500', 'dark:text-red-400');
            logOutput.classList.add('text-slate-500', 'dark:text-slate-400');
        }
    }
    
    function logParsedStructure(files, extraText) {
        let fileList = files.map(file => file.path);
        if (extraText) {
            fileList.push('README.md');
        }
        const totalCount = fileList.length;

        const fileListString = fileList.join('\n');
        const sanitizedOutput = DOMPurify.sanitize(fileListString);
        const message = `Successfully parsed <strong>${totalCount}</strong> file(s):<br><div class=\"mt-2 p-2 bg-slate-200 dark:bg-slate-800 rounded text-xs whitespace-pre-wrap break-all\">${sanitizedOutput}</div><br>Now creating ZIP...`;
        updateStatus(message);
    }
});
