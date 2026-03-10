type FileSystemHandleResult = {
    fileHandle: FileSystemFileHandle | null;
    usedFileSystemAccess: boolean;
};

type DownloadLocalOptions = {
    fileHandle?: FileSystemFileHandle | null;
    askForLocation?: boolean;
};

type FilePickerType = {
    description?: string;
    accept: Record<string, string[]>;
};

type FilePickerOptions = {
    suggestedName?: string;
    types?: FilePickerType[];
};

type WindowWithPicker = Window & {
    showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
};

function getMimeType(filename: string, fallback = 'application/octet-stream'): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.json')) return 'application/json';
    if (lower.endsWith('.txt')) return 'text/plain';
    return fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function writeBlobToHandle(fileHandle: FileSystemFileHandle, blob: Blob) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function saveLocalBlob(
    blob: Blob,
    filename: string,
    options: DownloadLocalOptions = {}
): Promise<FileSystemHandleResult> {
    const { fileHandle = null, askForLocation = true } = options;
    const browserWindow = window as WindowWithPicker;

    if (fileHandle) {
        await writeBlobToHandle(fileHandle, blob);
        return { fileHandle, usedFileSystemAccess: true };
    }

    if (askForLocation && browserWindow.showSaveFilePicker) {
        const pickerOptions: FilePickerOptions = {
            suggestedName: filename,
            types: [{
                description: 'Documento',
                accept: {
                    [getMimeType(filename, blob.type || 'application/octet-stream')]: [`.${filename.split('.').pop() || 'bin'}`],
                },
            }],
        };

        const selectedHandle = await browserWindow.showSaveFilePicker(pickerOptions);
        await writeBlobToHandle(selectedHandle, blob);
        return { fileHandle: selectedHandle, usedFileSystemAccess: true };
    }

    triggerBrowserDownload(blob, filename);
    return { fileHandle: null, usedFileSystemAccess: false };
}

export function downloadLocalBlob(blob: Blob, filename: string) {
    triggerBrowserDownload(blob, filename);
}

export function downloadLocalJSON(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    triggerBrowserDownload(blob, filename);
}
