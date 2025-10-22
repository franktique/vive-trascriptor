/**
 * GPU Acceleration Detection & Optimization
 * Detects available GPU resources and provides optimization recommendations
 */

const os = require('os');
const { execSync } = require('child_process');

class GPUDetector {
    constructor(options = {}) {
        this.settings = {
            enableDetection: options.enableDetection !== false,
            enableOptimization: options.enableOptimization !== false
        };

        this.gpuInfo = null;
        this.hasNvidia = false;
        this.hasAmd = false;
        this.hasMetal = false; // macOS Metal
        this.hasVulkan = false;

        this.stats = {
            detectionTime: 0,
            gpuMemoryEstimate: 0,
            recommendedBatchSize: 1
        };

        if (this.settings.enableDetection) {
            this.detectGPU();
        }
    }

    /**
     * Detect available GPU resources
     */
    detectGPU() {
        const startTime = Date.now();

        try {
            const platform = os.platform();

            // Check for NVIDIA GPU
            this.detectNvidiaGPU();

            // Check for AMD GPU
            this.detectAmdGPU();

            // Check for macOS Metal support
            if (platform === 'darwin') {
                this.hasMetal = true;
                console.log('GPUDetector: Metal (macOS) support available');
            }

            // Check for Vulkan support
            this.detectVulkan();

            this.stats.detectionTime = Date.now() - startTime;

            if (this.hasNvidia || this.hasAmd || this.hasMetal || this.hasVulkan) {
                console.log('GPUDetector: GPU acceleration available');
                this.estimateOptimizations();
            } else {
                console.log('GPUDetector: No GPU acceleration detected, using CPU');
            }
        } catch (error) {
            console.error('GPUDetector: Error detecting GPU:', error.message);
        }
    }

    /**
     * Detect NVIDIA GPU using nvidia-smi
     */
    detectNvidiaGPU() {
        try {
            const output = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader', {
                timeout: 2000,
                encoding: 'utf-8'
            }).trim();

            if (output) {
                const [name, memory] = output.split(', ');
                const memoryMB = parseInt(memory);

                this.hasNvidia = true;
                this.gpuInfo = {
                    type: 'NVIDIA',
                    name: name.trim(),
                    memoryMB: memoryMB,
                    memory: `${(memoryMB / 1024).toFixed(1)}GB`
                };

                console.log(`GPUDetector: NVIDIA GPU detected: ${name.trim()} (${this.gpuInfo.memory} VRAM)`);
            }
        } catch (error) {
            // nvidia-smi not available or GPU not detected
        }
    }

    /**
     * Detect AMD GPU using rocm or amd-smi
     */
    detectAmdGPU() {
        try {
            const output = execSync('amd-smi list', {
                timeout: 2000,
                encoding: 'utf-8'
            });

            if (output && output.includes('GPU')) {
                this.hasAmd = true;
                this.gpuInfo = {
                    type: 'AMD',
                    name: 'AMD Radeon GPU',
                    memory: 'Unknown'
                };

                console.log('GPUDetector: AMD GPU (ROCM) detected');
            }
        } catch (error) {
            // AMD GPU not detected
        }
    }

    /**
     * Detect Vulkan support (cross-platform)
     */
    detectVulkan() {
        try {
            const output = execSync('vulkaninfo --summary', {
                timeout: 2000,
                encoding: 'utf-8'
            });

            if (output && output.includes('GPU')) {
                this.hasVulkan = true;
                console.log('GPUDetector: Vulkan support detected');
            }
        } catch (error) {
            // Vulkan not detected
        }
    }

    /**
     * Estimate performance optimizations based on GPU
     */
    estimateOptimizations() {
        let recommendations = {
            canUseGPU: true,
            parallelChunks: 2,
            batchSize: 1,
            speedup: 1.0,
            recommendations: []
        };

        if (this.hasNvidia) {
            if (this.gpuInfo.memoryMB >= 8000) {
                // 8GB or more
                recommendations.parallelChunks = 4;
                recommendations.batchSize = 2;
                recommendations.speedup = 3.5;
                recommendations.recommendations.push('NVIDIA GPU with ≥8GB VRAM: Can process 4 chunks in parallel');
            } else if (this.gpuInfo.memoryMB >= 4000) {
                // 4-8GB
                recommendations.parallelChunks = 2;
                recommendations.batchSize = 1;
                recommendations.speedup = 2.5;
                recommendations.recommendations.push('NVIDIA GPU with 4-8GB VRAM: Can process 2 chunks in parallel');
            } else {
                // Less than 4GB
                recommendations.parallelChunks = 1;
                recommendations.batchSize = 1;
                recommendations.speedup = 2.0;
                recommendations.recommendations.push('NVIDIA GPU with <4GB VRAM: Single chunk processing recommended');
            }
        } else if (this.hasAmd) {
            recommendations.parallelChunks = 2;
            recommendations.speedup = 2.2;
            recommendations.recommendations.push('AMD GPU (ROCM) detected: Experimental GPU support');
        } else if (this.hasMetal) {
            recommendations.parallelChunks = 2;
            recommendations.speedup = 2.0;
            recommendations.recommendations.push('macOS Metal: GPU acceleration available for Apple Silicon');
        }

        this.stats.recommendedBatchSize = recommendations.batchSize;
        return recommendations;
    }

    /**
     * Get GPU status
     */
    getStatus() {
        return {
            available: this.hasNvidia || this.hasAmd || this.hasMetal || this.hasVulkan,
            types: {
                nvidia: this.hasNvidia,
                amd: this.hasAmd,
                metal: this.hasMetal,
                vulkan: this.hasVulkan
            },
            gpuInfo: this.gpuInfo,
            detectionTime: this.stats.detectionTime,
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Get optimization recommendations
     */
    getRecommendations() {
        return this.estimateOptimizations();
    }

    /**
     * Check if GPU is available
     */
    isAvailable() {
        return this.hasNvidia || this.hasAmd || this.hasMetal || this.hasVulkan;
    }

    /**
     * Get GPU memory estimate for optimal performance
     */
    getOptimalBatchSize() {
        if (this.hasNvidia && this.gpuInfo) {
            const memoryGB = this.gpuInfo.memoryMB / 1024;
            if (memoryGB >= 8) return 2;
            if (memoryGB >= 4) return 1;
        }
        return 1;
    }

    /**
     * Get estimated speedup compared to CPU
     */
    getEstimatedSpeedup() {
        if (this.hasNvidia) {
            if (this.gpuInfo.memoryMB >= 8000) return 3.5;
            if (this.gpuInfo.memoryMB >= 4000) return 2.5;
            return 2.0;
        } else if (this.hasAmd) {
            return 2.2;
        } else if (this.hasMetal) {
            return 2.0;
        }
        return 1.0; // No GPU acceleration
    }

    /**
     * Get configuration string for Whisper with GPU support
     */
    getWhisperConfig() {
        const config = {
            useGPU: this.isAvailable(),
            gpuType: null,
            optimizationHints: []
        };

        if (this.hasNvidia) {
            config.gpuType = 'NVIDIA_CUDA';
            config.optimizationHints.push('CUDA acceleration enabled');
            config.optimizationHints.push(`Parallel chunks: ${this.estimateOptimizations().parallelChunks}`);
        } else if (this.hasAmd) {
            config.gpuType = 'AMD_ROCM';
            config.optimizationHints.push('ROCM acceleration enabled');
        } else if (this.hasMetal) {
            config.gpuType = 'APPLE_METAL';
            config.optimizationHints.push('Metal acceleration enabled');
        }

        return config;
    }
}

module.exports = GPUDetector;
