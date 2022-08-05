function SpectrumDisplay(rootElement, divElement) {
    this.rootElement = rootElement;

    this.canvasRef = document.createElement("canvas");
    this.canvasRef.id = "editor-spectrum";
    divElement.appendChild(this.canvasRef);
    this.canvasRef.width = divElement.clientWidth;
    this.canvasRef.height = divElement.clientHeight;
    this.buffer = new Float32Array(this.canvasRef.width);
    this.min = -150; // decibel
    this.max = 0; // decibel
    this.range = this.max - this.min;
    this.minRange = this.canvasRef.height;

    this.updateBuffer = function updateBuffer(frequencyData) {
        this.min = -150;
        this.max = 0;

        for (var i = 0; i < this.buffer.length; ++i) {
            var data = frequencyData[Math.round(frequencyData.length / this.buffer.length * i)];
            // clamp into range
            data = Math.min(this.max, Math.max(this.min, data));
            this.buffer[i] = data;
        }
    };

    this.paintSpectrum = function paintSpectrum() {
        var canvasContext = this.canvasRef.getContext('2d');
        canvasContext.clearRect(0, 0, this.canvasRef.width, this.canvasRef.height);

        canvasContext.strokeStyle = "#369bd7";
        canvasContext.beginPath();

        // fit the y to display all values
        var yFactor = this.canvasRef.height / this.range;

        for (var i = 0; i < this.buffer.length - 1; ++i) {
            canvasContext.moveTo(i + 0.5, this.buffer[i] * -1.0 * yFactor);
            canvasContext.lineTo(i + 1.5, this.buffer[i + 1] * -1.0 * yFactor);
        }
        canvasContext.stroke();

        canvasContext.fillStyle = canvasContext.strokeStyle;
        canvasContext.fillText(Math.round(this.max) + " db", 0, 20);
        canvasContext.fillText(Math.round(this.min) + " db", 0, this.canvasRef.height);
    };
}

function SpectrumWorker() {
    this.toFrequencyDomain = function toFrequencyDomain(timeDomainRealIn, timeDomainImagIn, start, len, realOut, imagOut) {
        if (start === undefined) start = 0;
        if (len === undefined) len = timeDomainRealIn.length;

        if (IsPowerOfTwo(len) !== true) throw "The length of the timeDomain has to be power of two!";

        var tempR = timeDomainRealIn.slice(start, start + len);
        var tempI = (timeDomainImagIn === undefined) ? undefined : timeDomainImagIn.slice(start, start + len);
        ACFFT(tempR.length, false, tempR, tempI, realOut, imagOut);
    };

    this.fromFrequencyDomain = function fromFrequencyDomain(freqDomainRealIn, freqDomainImagIn, realOut, imagOut) {
        if (freqDomainRealIn.length !== freqDomainImagIn) throw "The real and imaginary arrays have a different size";

        ACFFT(freqDomainRealIn.length, true, freqDomainRealIn, freqDomainImagIn, realOut, imagOut);
    };

    this.toAmplitudeSpectrum = function toAmplitudeSpectrum(timeDomainData, sampleRate, start, len, windowSize, windowFuncId) {
        if (start === undefined) start = 0;
        if (len === undefined) len = timeDomainData.length;
        if (windowSize === undefined) windowSize = 1024;
        if (windowFuncId === undefined) windowFuncId = 4;
        if (sampleRate === undefined) sampleRate = 44100;

        if (timeDomainData.length < windowSize || len < windowSize) throw "Length of the timeDomainData is to small (minimum is the windowSize: " + windowSize + ")";
        if (start < 0 || start >= timeDomainData.length) throw "Start is out of range";
        if (start + len > timeDomainData.length) throw "Length is out of range";

        var temp = timeDomainData.slice(start, start + len);
        var result = [];
        ComputeSpectrum(temp, temp.length, windowSize, sampleRate, result, false, windowFuncId);

        return result;
    };

    this.toAmplitudeSpectrumFromAudioSequence = function toAmplitudeSpectrumFromAudioSequence(audioSequence, start, len, windowSize, windowFuncId) {
        return this.toAmplitudeSpectrum(audioSequence.data, audioSequence.sampleRate, start, len, windowSize, windowFuncId);
    };


}

