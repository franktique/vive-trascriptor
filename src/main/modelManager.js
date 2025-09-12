const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class ModelManager extends EventEmitter {
    constructor() {
        super();
        this.modelsDir = path.join(__dirname, '../../models/whisper');
        this.downloadQueue = new Map();
        this.modelUrls = {
            'tiny.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
            'base.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
            'small.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
            'medium.en': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
            'large': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large.bin'
        };
        
        this.modelSizes = {
            'tiny.en': 39 * 1024 * 1024,    // 39 MB
            'base.en': 74 * 1024 * 1024,    // 74 MB
            'small.en': 244 * 1024 * 1024,  // 244 MB
            'medium.en': 769 * 1024 * 1024, // 769 MB
            'large': 1550 * 1024 * 1024     // 1550 MB
        };

        this.ensureModelsDirectory();
    }

    ensureModelsDirectory() {
        try {
            if (!fs.existsSync(this.modelsDir)) {
                fs.mkdirSync(this.modelsDir, { recursive: true });
                console.log('Created models directory:', this.modelsDir);
            }
        } catch (error) {
            console.error('Error creating models directory:', error);
        }
    }

    getModelPath(modelName) {
        return path.join(this.modelsDir, `ggml-${modelName}.bin`);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async getModelStatus(modelName) {
        const modelPath = this.getModelPath(modelName);
        const isDownloading = this.downloadQueue.has(modelName);
        
        try {
            const exists = fs.existsSync(modelPath);
            let size = null;
            
            if (exists) {
                const stats = fs.statSync(modelPath);
                size = this.formatFileSize(stats.size);
            }
            
            return {
                exists,
                size,
                downloading: isDownloading,
                path: modelPath
            };
        } catch (error) {
            console.error('Error checking model status:', error);
            return {
                exists: false,
                size: null,
                downloading: isDownloading,
                path: modelPath
            };
        }
    }

    async downloadModel(modelName) {
        console.log(`ModelManager: Starting download for ${modelName}`);
        
        if (this.downloadQueue.has(modelName)) {
            console.log(`ModelManager: ${modelName} is already being downloaded`);
            throw new Error(`Model ${modelName} is already being downloaded`);
        }

        const modelUrl = this.modelUrls[modelName];
        if (!modelUrl) {
            console.error(`ModelManager: Unknown model: ${modelName}`);
            throw new Error(`Unknown model: ${modelName}`);
        }

        const modelPath = this.getModelPath(modelName);
        const tempPath = modelPath + '.tmp';
        
        console.log(`ModelManager: Model path: ${modelPath}`);
        console.log(`ModelManager: Temp path: ${tempPath}`);
        console.log(`ModelManager: Download URL: ${modelUrl}`);
        
        return new Promise((resolve, reject) => {
            const downloadInfo = {
                modelName,
                startTime: Date.now(),
                downloadedBytes: 0,
                totalBytes: this.modelSizes[modelName] || 0
            };
            
            this.downloadQueue.set(modelName, downloadInfo);
            
            // Create write stream
            console.log(`ModelManager: Creating write stream for ${tempPath}`);
            const fileStream = fs.createWriteStream(tempPath);
            
            fileStream.on('error', (error) => {
                console.error(`ModelManager: File stream error:`, error);
                this.cleanupDownload(modelName, tempPath);
                reject(error);
            });
            
            console.log(`ModelManager: Making HTTPS request to ${modelUrl}`);
            const request = https.get(modelUrl, (response) => {
                console.log(`ModelManager: Received response with status: ${response.statusCode}`);
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    const redirectUrl = response.headers.location;
                    console.log(`Redirecting to: ${redirectUrl}`);
                    
                    const redirectRequest = https.get(redirectUrl, (redirectResponse) => {
                        if (redirectResponse.statusCode !== 200) {
                            this.cleanupDownload(modelName, tempPath);
                            return reject(new Error(`Failed to download model: ${redirectResponse.statusCode}`));
                        }
                        
                        this.handleDownloadResponse(redirectResponse, fileStream, downloadInfo, modelPath, tempPath, resolve, reject);
                    });
                    
                    redirectRequest.on('error', (error) => {
                        this.cleanupDownload(modelName, tempPath);
                        reject(error);
                    });
                    
                    // Set timeout for redirect request too
                    redirectRequest.setTimeout(30 * 60 * 1000, () => {
                        redirectRequest.destroy();
                        this.cleanupDownload(modelName, tempPath);
                        reject(new Error('Download timeout'));
                    });
                    
                } else if (response.statusCode === 200) {
                    this.handleDownloadResponse(response, fileStream, downloadInfo, modelPath, tempPath, resolve, reject);
                } else {
                    this.cleanupDownload(modelName, tempPath);
                    reject(new Error(`Failed to download model: ${response.statusCode}`));
                }
            });

            request.on('error', (error) => {
                this.cleanupDownload(modelName, tempPath);
                reject(error);
            });

            // Set a much longer timeout for large model downloads (30 minutes)
            request.setTimeout(30 * 60 * 1000, () => {
                request.destroy();
                this.cleanupDownload(modelName, tempPath);
                reject(new Error('Download timeout'));
            });
        });
    }

    handleDownloadResponse(response, fileStream, downloadInfo, modelPath, tempPath, resolve, reject) {
        const { modelName } = downloadInfo;
        
        // Update total bytes from actual response if available
        if (response.headers['content-length']) {
            downloadInfo.totalBytes = parseInt(response.headers['content-length']);
        }

        let lastProgressTime = Date.now();
        let lastDownloadedBytes = 0;

        // Emit initial progress event
        console.log(`ModelManager: Starting download, total bytes: ${downloadInfo.totalBytes}`);
        this.emit('download-progress', {
            modelName,
            percent: 0,
            downloadedBytes: 0,
            totalBytes: downloadInfo.totalBytes,
            speed: 0,
            eta: 0,
            status: `Starting download of ${modelName}...`
        });

        response.on('data', (chunk) => {
            downloadInfo.downloadedBytes += chunk.length;
            
            // Emit progress every 100ms for more responsive UI
            const now = Date.now();
            if (now - lastProgressTime >= 100) {
                const timeDiff = (now - lastProgressTime) / 1000; // seconds
                const bytesDiff = downloadInfo.downloadedBytes - lastDownloadedBytes;
                const speed = bytesDiff / timeDiff; // bytes per second
                
                const percent = downloadInfo.totalBytes ? 
                    (downloadInfo.downloadedBytes / downloadInfo.totalBytes) * 100 : 0;
                
                const totalTime = (now - downloadInfo.startTime) / 1000;
                const eta = speed > 0 ? 
                    (downloadInfo.totalBytes - downloadInfo.downloadedBytes) / speed : 0;

                const progressData = {
                    modelName,
                    percent: Math.min(percent, 100),
                    downloadedBytes: downloadInfo.downloadedBytes,
                    totalBytes: downloadInfo.totalBytes,
                    speed,
                    eta,
                    status: `Downloading ${modelName}...`
                };
                
                console.log(`ModelManager: Download progress ${percent.toFixed(1)}% (${downloadInfo.downloadedBytes}/${downloadInfo.totalBytes} bytes)`);
                this.emit('download-progress', progressData);

                lastProgressTime = now;
                lastDownloadedBytes = downloadInfo.downloadedBytes;
            }
        });

        response.on('end', () => {
            fileStream.end();
            
            // Move temp file to final location
            try {
                fs.renameSync(tempPath, modelPath);
                this.downloadQueue.delete(modelName);
                
                this.emit('download-complete', {
                    modelName,
                    success: true,
                    path: modelPath
                });
                
                resolve({ 
                    success: true, 
                    path: modelPath,
                    size: this.formatFileSize(downloadInfo.downloadedBytes)
                });
            } catch (error) {
                this.cleanupDownload(modelName, tempPath);
                reject(error);
            }
        });

        response.on('error', (error) => {
            this.cleanupDownload(modelName, tempPath);
            reject(error);
        });

        response.pipe(fileStream);

        fileStream.on('error', (error) => {
            this.cleanupDownload(modelName, tempPath);
            reject(error);
        });
    }

    cleanupDownload(modelName, tempPath) {
        this.downloadQueue.delete(modelName);
        
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        } catch (error) {
            console.error('Error cleaning up temp file:', error);
        }

        this.emit('download-error', {
            modelName,
            error: 'Download failed'
        });
    }

    async deleteModel(modelName) {
        const modelPath = this.getModelPath(modelName);
        
        try {
            if (fs.existsSync(modelPath)) {
                fs.unlinkSync(modelPath);
                return { success: true, message: `Model ${modelName} deleted successfully` };
            } else {
                return { success: false, message: `Model ${modelName} not found` };
            }
        } catch (error) {
            console.error('Error deleting model:', error);
            return { success: false, message: error.message };
        }
    }

    async listAvailableModels() {
        const models = [];
        
        for (const [modelName, url] of Object.entries(this.modelUrls)) {
            const status = await this.getModelStatus(modelName);
            models.push({
                name: modelName,
                url,
                expectedSize: this.formatFileSize(this.modelSizes[modelName] || 0),
                ...status
            });
        }
        
        return models;
    }

    getDownloadProgress(modelName) {
        return this.downloadQueue.get(modelName) || null;
    }
}

module.exports = ModelManager;