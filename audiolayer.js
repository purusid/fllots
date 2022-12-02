function AudioSequence() {
    /// Name of the audio sequence (used for channel identification)
    this.name = "unnamed";
    this.sampleRate = 0;
    this.data = [];

    // gain level of the signal data (maximum value)
    this.gain = 0.0;

    /**
     * This function merges another sequence from with the same sampling rate
     * into this.
     * @param mergePosition optional position where the new data should be merged (default is the end of the data block)
     * */
    this.merge = function merge(otherAudioSequence, mergePosition) {
        // default parameters
        if (mergePosition === undefined) mergePosition = this.data.length;
        // requirement check
        if (otherAudioSequence.sampleRate !== this.sampleRate) throw "Samplerate does not match.";
        if (mergePosition < 0 || mergePosition > this.data.length) throw "Merge position is invalid!";

        // create a new data block
        var newData = new Float32Array(this.data.length + otherAudioSequence.data.length);

        // combine data
        newData.set(this.data.subarray(0, mergePosition));
        newData.set(otherAudioSequence.data, mergePosition);
        newData.set(this.data.subarray(mergePosition), mergePosition + otherAudioSequence.data.length);

        // set new references
        this.data = newData;

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Cuts off a part of the data sequence
     * @param start beginning of the trim
     * @param len optional len length of the trim (default is till the end of the data block)
     **/
    this.trim = function trim(start, len) {
        // default parameter
        if (len === undefined) len = this.data.length - start;

        if (start >= this.data.length || start < 0) throw "The start is invalid";
        if (start + len > this.data.length || len < 0) throw "The length is invalid.";

        // create a new data block
        var newData = new Float32Array(this.data.length - len);

        // copy relevant fragments of data
        newData.set(this.data.subarray(0, start));
        newData.set(this.data.subarray(start + len), start);

        // set new references
        this.data = newData;

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Create a clone of this sequence. Optionally the clone can be partial
     * @param start Optional beginning of the data block which will be cloned (default is 0)
     * @param len Optional len of the data block which will be cloned (default is till the end of the data block)
     */
    this.clone = function clone(start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check        
        if (start < 0 || start > this.data.length) throw "Invalid start parameter.";
        if (len < 0 || len + start > this.data.length) throw "Invalid len parameter.";

        // create new instance and copy array fragment
        var clonedSequence = CreateNewAudioSequence(this.sampleRate);
        clonedSequence.data = this.data.slice(start, start + len);

        // Update the gain for the cloned sequence
        clonedSequence.gain = clonedSequence.getGain();
        return clonedSequence;
    };

    /**
     * Creates a sequence with a specified length of data with value 0
     * @param len length of the 0 sequence
     * @param start optional insertion point for the 0 sequence (default is the end of the data block)
     */
    this.createZeroData = function createZeroData(len, start) {
        var emptyData = [];
        var i = len + 1;
        while (--i) {
            emptyData.push(0);
        }

        var tmpSequence = CreateNewAudioSequence(this.sampleRate, emptyData);
        this.merge(tmpSequence, start);

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Copies the data into a complex array
     * @param start optional beginning of the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.toComplexSequence = function toComplexSequence(start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        var result = [];

        for (var i = start; i < start + len; ++i) {
            result.push(this.data[i]);
            result.push(0);
        }

        return result;
    };

    /**
     * Overwrites the data with the given complex array data
     * @param complexArray the complex array which gets real value gets copied
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.fromComplexSequence = function fromComplexSequence(complexArray, start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (complexArray.length / 2 !== len) throw "length of complex array does not match";
        if (complexArray.length % 2 !== 0) throw "the length of the complex array is totally wrong";
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        var complexArrayIdx = 0;
        for (var i = start; i < start + len; ++i) {
            this.data[i] = complexArray[complexArrayIdx];
            complexArrayIdx += 2;
        }

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Returns the gain (maximum amplitude)
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.getGain = function getGain(start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        var result = 0.0;
        for (var i = start; i < start + len; ++i) {
            // the amplitude could be positive or negative
            var absValue = Math.abs(this.data[i]);
            result = Math.max(result, absValue);
        }
        return result;
    }

    /**
     * Returns the total length of this sequence in seconds
     **/
    this.getLengthInSeconds = function getLengthInSeconds() {
        return this.data.length / this.sampleRate;
    }

    /**
     * Apply a normalize on the data block, which changes the data value to use the optimal bandwidth
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.filterNormalize = function filterNormalize(start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        // do a amplitude correction of the sequence
        var gainLevel = this.getGain(start, len);
        var amplitudeCorrection = 1.0 / gainLevel;
        for (var i = start; i < start + len; ++i) {
            this.data[i] = this.data[i] * amplitudeCorrection;
        }

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Change the gain of the sequence. The result will give the sequence more or less amplitude
     * @param gainFactor the factor which will be applied to the sequence
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.filterGain = function filterGain(gainFactor, start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        for (var i = start; i < start + len; ++i) {
            this.data[i] = this.data[i] * gainFactor;
        }

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Sets the data block to 0 (no amplitude = silence)
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.filterSilence = function filterSilence(start, len) {
        this.filterGain(0.0, start, len);
    }

    /**
     * This function apply a fade effect on a given sequence range. The value of fadeStartGainFactor and fadeEndGainFactor
     * controls if the fade is an fadein or fadeout
     * @param fadeEndGainFactor The multiplier at the beginning of the fade
     * @param fadeEndGainFactor The multiplier at the end of the fade
     * @param start optional beginning in the data point (default is 0)
     * @param len optional length of the data sequence (default is till the end of the data block)
     */
    this.filterLinearFade = function filterLinearFade(fadeStartGainFactor, fadeEndGainFactor, start, len) {
        // default parameter
        if (start === undefined) start = 0;
        if (len === undefined) len = this.data.length - start;

        // requirement check
        if (start < 0 || start > this.data.length) throw "start parameter is invalid.";
        if (len < 0 || len + start > this.data.length) throw "end parameter is invalid.";

        var fadeGainMultiplier = 0.0;
        var fadePos = 0.0;
        for (var i = start; i < start + len; ++i) {
            fadePos = (i - start) / len;
            fadeGainMultiplier = MathEx.lerp(fadeStartGainFactor, fadeEndGainFactor, fadePos);

            this.data[i] = this.data[i] * fadeGainMultiplier;

        }

        // update gain value
        this.gain = this.getGain();
    };

    /**
     * Process an reverse of the data block
     */
    this.filterReverse = function filterReverse() {
        this.data.reverse();
    };

    this.createTestTone = function createTestTone(frequency, sampleLength) {
        var data = [];
        var f = frequency / this.sampleRate;
        for (var i = 0; i < sampleLength; ++i) {
            data.push((Math.cos(2.0 * Math.PI * i * f) +
                Math.cos(2.0 * Math.PI * i * f * 1)) / 2);
        }

        this.data = data;
    };
}

/**
 * Creates a new empty or with data filled sequence with the given sample rate
 * @param sampleRate final samplerate of the sequence
 * @param data optional initialization data of the sequence
 */
function CreateNewAudioSequence(sampleRate, data) {
    var sequence = new AudioSequence();
    sequence.sampleRate = sampleRate;
    sequence.data = [];
    if (data !== undefined) {
        sequence.data = data.slice(0, data.length);
    }
    return sequence;
}

function AudioLayerSequenceEditor(elementContext) {
    this.elementContext = elementContext;
    this.elementContext.audioLayerSequenceEditor = this;

    // references to the elements
    this.audioLayerControl = undefined;
    this.canvasReference = undefined;
    this.audioSequenceReference = undefined;

    this.canvasHeight = 100;
    this.canvasWidth = elementContext.parentNode.parentNode.clientWidth - 50;

    this.name = name;

    // properties for the selection feature (mouse, ...)    

    // is the mouse inside of the editor (for background coloring)
    this.mouseInside = false;
    // state of the mouse button
    this.mouseDown = false;
    // is the mouse clicked inside of the selection
    this.mouseInsideOfSelection = false;

    // is the start or end bar selected
    this.mouseSelectionOfStart = false;
    this.mouseSelectionOfEnd = false;

    // current and previous position of the mouse
    this.mouseX = 0;
    this.mouseY = 0;
    this.previousMouseX = 0;
    this.previousMouseY = 0;

    // position of the selection (if equal, the selection is disabled)
    this.selectionStart = 0;
    this.selectionEnd = 0;

    // color states (gradient from top to bottom)

    // colors when the mouse is outside of the editor box
    this.colorInactiveTop = "#d7e5c7";
    this.colorInactiveBottom = "#d7e5c7";
    // colors when the mouse is inside of the editor box
    this.colorActiveTop = "#EEE";
    this.colorActiveBottom = "#CCC";
    // color when the mouse is pressed during inside of the editor box
    this.colorMouseDownTop = "#EEE";
    this.colorMouseDownBottom = "#CDC";
    // color of the selection frame
    this.colorSelectionStroke = "rgba(255,0,0,0.5)";
    this.colorSelectionFill = "rgba(255,0,0,0.2)";

    // temporary optimized visualization data    
    this.visualizationData = [];

    // handle focus for copy, paste & cut
    this.hasFocus = true;

    // a list of editors which are linked to this one
    this.linkedEditors = [];

    // movement
    this.movePos = 0;
    this.movementActive = false;

    // zoom
    this.viewResolution = 10; // default 10 seconds
    this.viewPos = 0; // at 0 seconds

    // playback
    this.playbackPos = 0;

    this.link = function link(otherEditor) {
        for (var i = 0; i < this.linkedEditors.length; ++i) {
            if (this.linkedEditors[i] === otherEditor) return;
        }

        this.linkedEditors.push(otherEditor);
        otherEditor.link(this);
    }

    this.updateSelectionForLinkedEditors = function updateSelectionForLinkedEditors() {
        for (var i = 0; i < this.linkedEditors.length; ++i) {
            this.linkedEditors[i].selectionStart = this.selectionStart;
            this.linkedEditors[i].selectionEnd = this.selectionEnd;

            if (this.linkedEditors[i].viewPos != this.viewPos ||
                this.linkedEditors[i].viewResolution != this.linkedEditors[i].viewResolution) {
                this.linkedEditors[i].viewPos = this.viewPos;
                this.linkedEditors[i].viewResolution = this.viewResolution;
                this.linkedEditors[i].updateVisualizationData();
            }

            this.linkedEditors[i].repaint();
        }
    };

    /**
     * Create a new editor instance
     */
    this.createEditor = function createEditor() {
        // Create a canvas element from code and append it to the audiolayer
        this.canvasReference = document.createElement("canvas");
        this.canvasReference.setAttribute("class", "audioLayerEditor");
        this.canvasReference.width = this.canvasWidth;
        this.canvasReference.height = this.canvasHeight;
        this.canvasReference.style['border'] = '1px solid #b8d599';
        this.elementContext.appendChild(this.canvasReference);

        // add the mouse listener to the canvas
        this.addEventlistener();
        // do an intial repaint
        this.repaint();
    };

    /**
     * Create a new editor instance with the given audio sequence reference
     * @param audioSequenceReference reference to the audio sequence which will be edited
     */
    this.setAudioSequence = function setAudioSequence(audioSequenceReference) {
        this.audioSequenceReference = audioSequenceReference;
        this.updateVisualizationData();
    };

    this.updateVisualizationData = function updateVisualizationData() {
        this.getDataInResolution(this.viewResolution, this.viewPos);

        // do an intial repaint
        this.repaint();
    }


    this.getDataInResolution = function getDataInResultion(resolution, offset) {
        this.visualizationData = [];
        var data = this.audioSequenceReference.data;
        var offsetR = this.audioSequenceReference.sampleRate * offset;

        // get the offset and length in samples
        var from = Math.round(offset * this.audioSequenceReference.sampleRate);
        var len = Math.round(resolution * this.audioSequenceReference.sampleRate);

        // when the spot is to large
        if (len > this.canvasReference.width) {
            var dataPerPixel = len / this.canvasReference.width;
            for (var i = 0; i < this.canvasReference.width; ++i) {
                var dataFrom = i * dataPerPixel + offsetR;
                var dataTo = (i + 1) * dataPerPixel + offsetR + 1;

                if (dataFrom >= 0 && dataFrom < data.length &&
                    dataTo >= 0 && dataTo < data.length) {
                    var peakAtFrame = this.getPeakInFrame(dataFrom, dataTo, data);
                    this.visualizationData.push(peakAtFrame);
                } else {
                    this.visualizationData.push({
                        min: 0.0,
                        max: 0.0
                    })
                }
            }
            this.visualizationData.plotTechnique = 1;
        } else {
            var pixelPerData = this.canvasReference.width / len;
            var x = 0;
            for (var i = from; i <= from + len; ++i) {
                // if outside of the data range
                if (i < 0 || i >= data.length) {
                    this.visualizationData.push({
                        y: 0.0,
                        x: x
                    });
                } else {
                    this.visualizationData.push({
                        y: data[i],
                        x: x
                    });
                }
                x += pixelPerData;
            }
            this.visualizationData.plotTechnique = 2;
        }
    }

    /**
     * adding of several event listener for mouse and keyboard
     */
    this.addEventlistener = function addEventListener() {
        // need a reference of this in the canvas to react on events which has the local scope of the canvas
        this.canvasReference.eventHost = this;

        this.canvasReference.addEventListener("mouseover", function () {
            this.eventHost.mouseInside = true;
            this.eventHost.repaint();
        }, true);

        this.canvasReference.onmouseout = function () {
            if (this.eventHost.selectionStart > this.eventHost.selectionEnd) {
                var temp = this.eventHost.selectionStart;
                this.eventHost.selectionStart = this.eventHost.selectionEnd;
                this.eventHost.selectionEnd = temp;
            }

            // reset the selction mouse states for the selection
            this.eventHost.mouseInsideOfSelection = false;
            this.eventHost.mouseSelectionOfStart = false;
            this.eventHost.mouseSelectionOfEnd = false;
            this.eventHost.mouseDown = false;
            this.eventHost.mouseInside = false;
            this.eventHost.repaint();

            this.eventHost.updateSelectionForLinkedEditors();
        };

        this.canvasReference.onscroll = function (e) {
            debugger;
        };

        this.canvasReference.onmousemove = function (e) {
            this.eventHost.previousMouseX = this.eventHost.mouseX;
            this.eventHost.previousMouseY = this.eventHost.mouseY;
            this.eventHost.mouseX = e.clientX - this.offsetLeft;
            this.eventHost.mouseY = e.clientY - this.offsetTop;
            var mouseXDelta = this.eventHost.mouseX - this.eventHost.previousMouseX;

            if (this.eventHost.mouseDown && this.eventHost.movementActive == false) {
                // if the mouse is inside of a selection, then move the whole selection
                if (this.eventHost.mouseInsideOfSelection) {
                    var absDelta = this.eventHost.getPixelToAbsolute(this.eventHost.mouseX) -
                        this.eventHost.getPixelToAbsolute(this.eventHost.previousMouseX);

                    // move the selection with the delta
                    this.eventHost.selectionStart += absDelta;
                    this.eventHost.selectionEnd += absDelta;
                    this.eventHost.audioLayerControl.audioSequenceSelectionUpdate();

                }
                // if the left bar is selected, then move it only
                else if (this.eventHost.mouseSelectionOfStart) {
                    this.eventHost.selectionStart = this.eventHost.getPixelToAbsolute(this.eventHost.mouseX);
                    //this.eventHost.audioLayerControl.audioSequenceSelectionUpdate();
                }
                // if the right bar is selected (default during creation of a selection), then move it only
                else {
                    this.eventHost.selectionEnd = this.eventHost.getPixelToAbsolute(this.eventHost.mouseX);
                    //this.eventHost.audioLayerControl.audioSequenceSelectionUpdate();
                }
            }

            if (this.eventHost.mouseDown && this.eventHost.movementActive) {
                var movementResolution = this.eventHost.viewResolution / this.eventHost.canvasReference.width;
                this.eventHost.viewPos -= mouseXDelta * movementResolution;
                this.selectionStart -= mouseXDelta * movementResolution;
                this.selectionEnd -= mouseXDelta * movementResolution;
                this.eventHost.updateVisualizationData();
            }

            this.eventHost.repaint();
            this.eventHost.updateSelectionForLinkedEditors();
        };

        this.canvasReference.onmousedown = function (e) {
            this.eventHost.mouseDown = true;

            if (this.eventHost.movementActive == false) {
                var selectionStartPixel = this.eventHost.getAbsoluteToPixel(this.eventHost.selectionStart);
                var selectionEndPixel = this.eventHost.getAbsoluteToPixel(this.eventHost.selectionEnd);

                // is the mouse inside of the selection right now
                if (this.eventHost.mouseX - 5 > selectionStartPixel &&
                    this.eventHost.mouseX + 5 < selectionEndPixel) {
                    this.eventHost.mouseInsideOfSelection = true;
                }
                // is the mouse on the left bar of the selection
                else if (this.eventHost.mouseX - 5 < selectionStartPixel &&
                    this.eventHost.mouseX + 5 > selectionStartPixel) {
                    this.eventHost.mouseSelectionOfStart = true;
                }
                // is the mouse on the right bar of the selection
                else if (this.eventHost.mouseX - 5 < selectionEndPixel &&
                    this.eventHost.mouseX + 5 > selectionEndPixel) {
                    this.eventHost.mouseSelectionOfEnd = true;
                }
                // if the mouse is somewhere else, start a new selection
                else {
                    this.eventHost.selectionStart = this.eventHost.getPixelToAbsolute(this.eventHost.mouseX);
                    this.eventHost.selectionEnd = this.eventHost.selectionStart;
                    console.log("Set " + this.eventHost.selectionStart);
                }
            }
            // get the focus on this editor
            focusOnAudioLayerSequenceEditor = this.eventHost;
            this.eventHost.repaint();
            this.eventHost.updateSelectionForLinkedEditors();
        };



        this.canvasReference.onmouseup = function () {
            // swap the selection position if start is bigger then end
            if (this.eventHost.selectionStart > this.eventHost.selectionEnd) {
                var temp = this.eventHost.selectionStart;
                this.eventHost.selectionStart = this.eventHost.selectionEnd;
                this.eventHost.selectionEnd = temp;
            }

            // reset the selction mouse states for the selection
            this.eventHost.mouseInsideOfSelection = false;
            this.eventHost.mouseSelectionOfStart = false;
            this.eventHost.mouseSelectionOfEnd = false;
            this.eventHost.mouseDown = false;
            this.eventHost.repaint();
            this.eventHost.updateSelectionForLinkedEditors();
        };

        this.canvasReference.ondblclick = function () {
            // deselect on double click
            if (this.eventHost.selectionStart != this.eventHost.selectionEnd) {
                this.eventHost.selectionStart = 0;
                this.eventHost.selectionEnd = 0;
            } else {
                this.eventHost.selectionStart = 0;
                this.eventHost.selectionEnd = this.eventHost.getPixelToAbsolute(this.eventHost.canvasReference.width);
            }

            this.eventHost.mouseDown = false;
            this.eventHost.mouseSelectionOfStart = false;
            this.eventHost.mouseSelectionOfEnd = false;
            this.eventHost.mouseInsideOfSelection = false;
            focusOnAudioLayerSequenceEditor = undefined;
            this.eventHost.repaint();
            this.eventHost.updateSelectionForLinkedEditors();
        };


    };

    /**
     * Repaint of the editor window
     */
    this.repaint = function repaint() {
        // no canvas, no paint
        if (this.canvasReference === undefined) return;
        // get the context for the sub methos
        var canvasContext = this.canvasReference.getContext('2d');
        // clear the drawing area
        this.clearCanvas(canvasContext);

        // draw background
        this.paintBackground(canvasContext);

        // if no audio sequence is attached, nothing can be rendered
        if (this.audioSequenceReference === undefined) {
            this.paintEmpty(canvasContext);
        } else {


            // draw the normal waveform 
            this.paintWaveform(canvasContext);

            // draw the selector rectangle
            this.paintSelector(canvasContext);


            this.paintTextInfo(canvasContext);
        }

    };

    /**
     * clear the canvas for redrawing
     * @param canvasContext reference to the drawing context of the canvas
     */
    this.clearCanvas = function clearCanvas(canvasContext) {
        canvasContext.clearRect(0, 0, this.canvasReference.width, this.canvasReference.height);
    };

    /**
     * paint in case of no sequence available
     * @param canvasContext reference to the drawing context of the canvas
     */
    this.paintEmpty = function paintEmpty(canvasContext) {
        var oldFont = canvasContext.font;
        var oldTextAlign = canvasContext.textAlign;
        var oldBaseline = canvasContext.textBaseline;

        canvasContext.font = 'italic 40px Calibri';
        canvasContext.textAlign = 'center';
        canvasContext.textBaseline = "middle"
        this.paintTextWithShadow("Drag audio file here to edit", canvasContext.canvas.clientWidth / 2.0, canvasContext.canvas.clientHeight / 2.0, "rgba(0,0,0,1)", canvasContext);

        canvasContext.font = oldFont;
        canvasContext.textAlign = 'left';
        canvasContext.textBaseline = 'top';
    };

    /**
     * paint the background of the editor
     * @param canvasContext reference to the drawing context of the canvas
     */
    this.paintBackground = function paintBackground(canvasContext) {
        var gradient = canvasContext.createLinearGradient(0, 0, 0, this.canvasReference.height);
        gradient.addColorStop(0, (this.mouseInside) ? (this.mouseDown) ? this.colorMouseDownTop : this.colorActiveTop : this.colorInactiveTop);
        gradient.addColorStop(1, (this.mouseInside) ? (this.mouseDown) ? this.colorMouseDownBottom : this.colorActiveBottom : this.colorInactiveBottom);
        canvasContext.fillStyle = gradient;
        canvasContext.fillRect(0, 0, this.canvasReference.width, this.canvasReference.height);
    };

    /**
     * Draw the waveform of the referenced audio sequence
     * @param canvasContext reference to the drawing context of the canvas
     */
    this.paintWaveform = function paintWaveform(canvasContext) {
        var seq = this.audioSequenceReference;
        var center = this.canvasReference.height / 2;

        // if the signal is above the 0db border, then a vertical zoomout must be applied
        var verticalMultiplier = (seq.gain < 1.0) ? 1.0 : 1.0 / seq.gain;

        // for later use of sequencial context        
        var data = seq.data;

        //canvasContext.setLineWidth(1);
        canvasContext.strokeStyle = "rgba(0, 0,0,0.5)";
        canvasContext.beginPath();
        canvasContext.moveTo(0, center);

        // choose the drawing style of the waveform
        if (this.visualizationData.plotTechnique == 1) {
            // data per pixel
            for (var i = 0; i < this.canvasReference.width; ++i) {
                var peakAtFrame = this.visualizationData[i];
                canvasContext.moveTo(i + 0.5, center + peakAtFrame.min * verticalMultiplier * -center);
                canvasContext.lineTo(i + 0.5, (center + peakAtFrame.max * verticalMultiplier * -center) + 1.0);
            }

        } else if (this.visualizationData.plotTechnique == 2) {
            var s = 1;

            for (var i = 0; i < this.visualizationData.length; ++i) {
                var x = this.visualizationData[i].x;
                var y = center + this.visualizationData[i].y * verticalMultiplier * -center;

                canvasContext.lineTo(x, y);

                // draw edges around each data point
                canvasContext.moveTo(x + s, y - s);
                canvasContext.lineTo(x + s, y + s);
                canvasContext.moveTo(x - s, y - s);
                canvasContext.lineTo(x - s, y + s);
                canvasContext.moveTo(x - s, y + s);
                canvasContext.lineTo(x + s, y + s);
                canvasContext.moveTo(x - s, y - s);
                canvasContext.lineTo(x + s, y - s);

                canvasContext.moveTo(x, y);
            }
        }

        canvasContext.stroke();

        // draw the horizontal center line
        //canvasContext.setLineWidth(1.0);
        canvasContext.strokeStyle = "rgba(0, 0, 0,0.5)";
        canvasContext.beginPath();
        canvasContext.moveTo(0, center);
        canvasContext.lineTo(this.canvasReference.width, center);
        canvasContext.stroke();
    };

    /**
     * Draw the selector
     * @param canvasContext reference to the drawing context of the canvas
     */
    this.paintSelector = function paintSelector(canvasContext) {
        var selectionStartPixel = this.getAbsoluteToPixel(this.selectionStart);
        var selectionEndPixel = this.getAbsoluteToPixel(this.selectionEnd);


        if (this.selectionStart !== this.selectionEnd) {

            var start = (selectionStartPixel < selectionEndPixel) ? selectionStartPixel : selectionEndPixel;
            var width = (selectionStartPixel < selectionEndPixel) ? selectionEndPixel - selectionStartPixel : selectionStartPixel - selectionEndPixel;

            canvasContext.fillStyle = this.colorSelectionFill;
            canvasContext.fillRect(start, 0, width, this.canvasReference.height);

            canvasContext.strokeStyle = this.colorSelectionStroke;
            canvasContext.strokeRect(start, 0, width, this.canvasReference.height);
        } else {
            canvasContext.strokeStyle = this.colorSelectionStroke;
            //canvasContext.setLineWidth(1.0);               
            canvasContext.beginPath();
            canvasContext.moveTo(selectionStartPixel, 0);
            canvasContext.lineTo(selectionStartPixel, this.canvasReference.height);
            canvasContext.stroke();
        }

        var playbackPixelPos = this.getAbsoluteToPixel(this.playbackPos);
        if (playbackPixelPos > 0 && playbackPixelPos < this.canvasReference.width) {
            canvasContext.strokeStyle = this.colorSelectionStroke;
            //canvasContext.setLineWidth(1.0);               
            canvasContext.beginPath();
            canvasContext.moveTo(playbackPixelPos, 0);
            canvasContext.lineTo(playbackPixelPos, this.canvasReference.height);
            canvasContext.stroke();
        }
    };

    this.getPeakInFrame = function getPeakInFrame(from, to, data) {
        var fromRounded = Math.round(from);
        var toRounded = Math.round(to);
        var min = 1.0;
        var max = -1.0;

        if (fromRounded < 0 || toRounded > data.length) debugger;

        for (var i = fromRounded; i < toRounded; ++i) {
            var sample = data[i];

            max = (sample > max) ? sample : max;
            min = (sample < min) ? sample : min;
        }

        return {
            min: min,
            max: max
        };
    };

    this.paintTextInfo = function paintTextInfo(canvasContext) {
        this.paintTextWithShadow(this.title, 1, 10, "rgba(0,0,0,1)", canvasContext);
        this.paintTextWithShadow("Position: " + Math.round(this.viewPos), 1, 20, "rgb(0,0,0)", canvasContext);
        this.paintTextWithShadow("Selection: " + this.selectionStart +
            " - " + this.selectionEnd +
            " (" + (this.selectionEnd - this.selectionStart) + ")", 1, 30, "rgb(255,0,0)", canvasContext);
    }

    this.paintTextWithShadow = function paintTextWithShadow(text, x, y, style, canvasContext) {
        canvasContext.fillStyle = "rgba(0,0,0,0.25)";
        canvasContext.fillText(text, x + 1, y + 1);

        canvasContext.fillStyle = style;
        canvasContext.fillText(text, x, y);
    };

    this.getSelectionInDataRange = function getSelectionInDataRange() {
        var start = Math.round(this.audioSequenceReference.data.length / this.canvasReference.width * this.selectionStart);
        var end = Math.round(this.audioSequenceReference.data.length / this.canvasReference.width * this.selectionEnd);

        return {
            start: start,
            end: end
        };
    };

    this.selectDataInRange = function selectDataInRange(start, end) {
        this.selectionStart = Math.round(this.canvasReference.width / this.audioSequenceReference.data.length * start);
        this.selectionEnd = Math.round(this.canvasReference.width / this.audioSequenceReference.data.length * end);
    }

    this.getPixelToAbsolute = function getPixelToAbsolute(pixelValue) {
        if (this.audioSequenceReference === undefined) return 0;

        var totalSamplesInResolution = this.viewResolution * this.audioSequenceReference.sampleRate;
        var totalSamplesOffset = this.viewPos * this.audioSequenceReference.sampleRate;

        return Math.round(totalSamplesInResolution / this.canvasReference.width * pixelValue + totalSamplesOffset);
    };

    this.getAbsoluteToPixel = function getAbsoluteToPixel(absoluteValue) {
        if (this.audioSequenceReference === undefined) return 0;

        var totalSamplesInResolution = this.viewResolution * this.audioSequenceReference.sampleRate;
        var totalSamplesOffset = this.viewPos * this.audioSequenceReference.sampleRate;

        return (absoluteValue - totalSamplesOffset) / totalSamplesInResolution * this.canvasReference.width;
    };

    this.getAbsoluteToSeconds = function getAbsoluteToSeconds(absoluteValue) {
        if (this.audioSequenceReference === undefined) return 0;

        return absoluteValue / this.audioSequenceReference.sampleRate;
    };

    this.getSecondsToAbsolute = function getSecondsToAbsolute(seconds) {
        if (this.audioSequenceReference === undefined) return 0;

        return seconds * this.audioSequenceReference.sampleRate;
    };

    this.zoomIntoSelection = function zoomIntoSelection() {
        this.viewResolution = this.getAbsoluteToSeconds(this.selectionEnd - this.selectionStart);
        this.viewPos = this.getAbsoluteToSeconds(this.selectionStart);

        this.updateVisualizationData();
        this.updateSelectionForLinkedEditors();
        this.repaint();
    };

    this.zoomToFit = function zoomToFit() {
        this.viewPos = 0;
        this.viewResolution = this.getAbsoluteToSeconds(this.audioSequenceReference.data.length);

        this.updateVisualizationData();
        this.updateSelectionForLinkedEditors();
        this.repaint();
    };

    // APPLY EFFECTS
    this.filterNormalize = function filterNormalize() {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        if (start == end) {
            this.audioSequenceReference.filterNormalize();
        } else {
            this.audioSequenceReference.filterNormalize(start, end - start);
        }

        this.updateVisualizationData();
        this.repaint();
    };

    this.filterFade = function filterFade(fadeIn) {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        if (start == end) {
            this.audioSequenceReference.filterLinearFade((fadeIn === true) ? 0.0 : 1.0, (fadeIn === true) ? 1.0 : 0.0);
        } else {
            this.audioSequenceReference.filterLinearFade((fadeIn === true) ? 0.0 : 1.0, (fadeIn === true) ? 1.0 : 0.0, start, end - start);
        }

        this.updateVisualizationData();
        this.repaint();
    };

    this.filterGain = function filterGain(decibel) {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        if (start == end) {
            this.audioSequenceReference.filterGain(this.getQuantity(decibel));
        } else {
            this.audioSequenceReference.filterGain(this.getQuantity(decibel), start, end - start);
        }

        this.updateVisualizationData();
        this.repaint();
    };

    this.filterSilence = function filterSilence() {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        if (start == end) {
            this.audioSequenceReference.filterSilence();
        } else {
            this.audioSequenceReference.filterSilence(start, end - start);
        }

        this.updateVisualizationData();
        this.repaint();
    };

    this.getDecibel = function getDecibel(signalValue, signalMaxium) {
        return 20.0 * Math.log(signalValue / signalMaxium) / Math.LN10;
    };

    this.getQuantity = function getQuantity(decibel) {
        return Math.exp(decibel * Math.LN10 / 20.0);
    };

    // CLIPBOARD FUNCTIONALITY

    this.clipboardAudioSequence = undefined;

    this.selectAll = function selectAll(processLinks) {
        this.selectionStart = 0;
        this.selectionEnd = this.audioSequenceReference.data.length;
        this.repaint();
    };

    this.copy = function copy(processLinks) {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        this.clipboardAudioSequence = this.audioSequenceReference.clone(start, end - start);

        if (processLinks !== undefined && processLinks === true) {
            for (var i = 0; i < this.linkedEditors.length; ++i) {
                this.linkedEditors[i].copy(false);
            }
        }
    };

    this.paste = function paste(processLinks) {
        if (this.clipboardAudioSequence === undefined) return;

        if (this.selectionStart != this.selectionEnd) {
            this.del(false);
        }

        // paste before the data block begins 
        if (this.selectionEnd < 0) {
            // fill the space with zeros
            this.viewPos -= this.getAbsoluteToSeconds(this.selectionStart);
            this.audioSequenceReference.createZeroData(-this.selectionEnd, 0);
            this.audioSequenceReference.merge(this.clipboardAudioSequence, 0);
            this.selectionStart = 0;
            this.selectionEnd = this.clipboardAudioSequence.data.length;

        }
        // paste beyond the data block
        else if (this.selectionStart > this.audioSequenceReference.data.length) {
            this.audioSequenceReference.createZeroData(this.selectionStart - this.audioSequenceReference.data.length);
            this.audioSequenceReference.merge(this.clipboardAudioSequence);
            this.selectionEnd = this.selectionStart + this.clipboardAudioSequence.data.length;
        }
        // paste inside of the datablock
        else {
            this.audioSequenceReference.merge(this.clipboardAudioSequence, this.selectionStart);
            this.selectionStart = this.selectionStart;
            this.selectionEnd = this.selectionStart + this.clipboardAudioSequence.data.length;
        }

        this.updateVisualizationData();
        this.repaint();

        if (processLinks !== undefined && processLinks === true) {
            for (var i = 0; i < this.linkedEditors.length; ++i) {
                this.linkedEditors[i].paste(false);
            }
        }
    };


    this.cut = function cut(processLinks) {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;


        this.clipboardAudioSequence = this.audioSequenceReference.clone(start, end - start);


        this.del(false);
        this.selectionEnd = this.selectionStart;
        this.updateVisualizationData();
        if (processLinks !== undefined && processLinks === true) {
            for (var i = 0; i < this.linkedEditors.length; ++i) {
                this.linkedEditors[i].cut(false);
            }
        }
    };

    this.del = function del(processLinks) {
        var start = (this.selectionStart < 0) ? 0 : (this.selectionStart >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionStart;
        var end = (this.selectionEnd < 0) ? 0 : (this.selectionEnd >= this.audioSequenceReference.data.length) ? this.audioSequenceReference.data.length - 1 : this.selectionEnd;

        this.audioSequenceReference.trim(start, end - start);
        this.updateVisualizationData();


        if (processLinks !== undefined && processLinks === true) {
            for (var i = 0; i < this.linkedEditors.length; ++i) {
                this.linkedEditors[i].del(false);
            }
        }
    };

    // Scan for attributes during the creation
    if ((typeof this.elementContext.attributes.title !== undefined) &&
        this.elementContext.attributes.title !== null) {
        this.title = this.elementContext.attributes.title.value;
    }

    // Add this element to the hosting layer control
    if (this.elementContext.parentNode.nodeName.toLowerCase() === "audiolayercontrol") {
        this.audioLayerControl = this.elementContext.parentNode.audioLayerControl;
        this.audioLayerControl.addAudioLayerSequenceEditor(this);
        this.createEditor();
    }
}

// Handle copy & cut & paste
var focusOnAudioLayerSequenceEditor = undefined;
var clipboardAudioSequence = undefined;

window.addEventListener("copy", function (e, f) {
    if (focusOnAudioLayerSequenceEditor !== undefined) {
        focusOnAudioLayerSequenceEditor.copy(true);
    }
}, true);

window.addEventListener("paste", function (e, f) {
    if (focusOnAudioLayerSequenceEditor !== undefined) {
        focusOnAudioLayerSequenceEditor.paste(true);
    }
}, true);

window.addEventListener("cut", function (e, f) {
    if (focusOnAudioLayerSequenceEditor !== undefined) {
        focusOnAudioLayerSequenceEditor.cut(true);
    }
}, true);

window.addEventListener("crop", function (e, f) {
    if (focusOnAudioLayerSequenceEditor !== undefined) {
        focusOnAudioLayerSequenceEditor.crop(true);
    }
}, true);

window.addEventListener("scroll", function (e) {
    //debugger;
}, true);

window.addEventListener("keydown", function (e) {


    if (focusOnAudioLayerSequenceEditor === undefined) return;

    if (e.keyCode == 46) // Delete
    {
        focusOnAudioLayerSequenceEditor.del(true);
    }

    if (e.keyCode == 81) // Q
    {
        focusOnAudioLayerSequenceEditor.movementActive = true;
    }

    if (e.keyCode == 32) // Space
    {
        document.querySelector("#audioLayerControl").playToggle();
        e.cancelBubble = true;
        e.returnValue = false;
    }
}, true);

window.addEventListener("keyup", function (e) {
    if (focusOnAudioLayerSequenceEditor === undefined) return;

    if (e.keyCode == 81) // q
    {
        focusOnAudioLayerSequenceEditor.movementActive = false;
    }
}, true);

function AudioPlayback() {
    /**
     * This is the internal update event to fill the buffer with the audio data
     */
    this.onAudioUpdate = function onAudioUpdate(evt) {
        var audioPlayback = this.eventHost;
        var bufferSize = audioPlayback.audioBufferSize;
        var elapsedTime = bufferSize / audioPlayback.sampleRate;

        // return if playback was stopped
        if (audioPlayback.isPlaying === false) return;

        // reference to the audio data arrays and audio buffer
        var audioData = audioPlayback.audioDataRef;
        var leftBuffer = evt.outputBuffer.getChannelData(0);
        var rightBuffer = evt.outputBuffer.getChannelData(1);

        if (audioData.length == 1) // mono
        {
            audioPlayback.copyChannelDataToBuffer(leftBuffer, audioData[0], audioPlayback.currentPlayPosition, bufferSize, audioPlayback.playStart, audioPlayback.playEnd, audioPlayback.isLooped);
            audioPlayback.currentPlayPosition = audioPlayback.copyChannelDataToBuffer(rightBuffer, audioData[0], audioPlayback.currentPlayPosition, bufferSize, audioPlayback.playStart, audioPlayback.playEnd, audioPlayback.isLooped);
        } else if (audioData.length == 2) // stereo
        {
            audioPlayback.copyChannelDataToBuffer(leftBuffer, audioData[0], audioPlayback.currentPlayPosition, bufferSize, audioPlayback.playStart, audioPlayback.playEnd, audioPlayback.isLooped);
            audioPlayback.currentPlayPosition = audioPlayback.copyChannelDataToBuffer(rightBuffer, audioData[1], audioPlayback.currentPlayPosition, bufferSize, audioPlayback.playStart, audioPlayback.playEnd, audioPlayback.isLooped);
        }

        // the playback is done
        if (audioPlayback.currentPlayPosition === undefined) {
            // stop playing, disconnect buffer
            audioPlayback.stop();
        } else {
            // Update the notification listener
            audioPlayback.lastPlaybackUpdate -= elapsedTime;
            if (audioPlayback.lastPlaybackUpdate < 0.0) {
                audioPlayback.lastPlaybackUpdate = audioPlayback.playbackUpdateInterval;
                audioPlayback.notifyUpdateListener();
            }
        }
    };

    /**
     * Copies the audio data to a channel buffer and sets the new play position. If looping is enabled,
     * the position is set automaticly.
     * @param bufferReference Reference to the channel buffer 
     * @param dataReference Reference to the audio data
     * @param position Current position of the playback
     * @param len Length of the chunk
     * @param startPosition Start position for looping
     * @param endPosition End position for looping
     * @param isLooped Enable looping.
     */
    this.copyChannelDataToBuffer = function copyChannelDataToBuffer(bufferReference, dataReference, position, len, startPosition, endPosition, isLooped) {
        /* In order to enable looping, we should need to split up when the end of the audio data is reached
         * to begin with the first position. Therefore is a split into two ranges if neccessary
         */
        var firstSplitStart = position;
        var firstSplitEnd = (position + len > dataReference.length) ?
            dataReference.length : (position + len > endPosition) ?
                endPosition : (position + len);

        var firstSplitLen = firstSplitEnd - firstSplitStart;

        var secondSplitStart = (firstSplitLen < bufferReference.length) ?
            (isLooped) ? startPosition : 0 : undefined;

        var secondSplitEnd = (secondSplitStart !== undefined) ? bufferReference.length - firstSplitLen + secondSplitStart : undefined;

        var secondSplitOffset = bufferReference.length - (firstSplitEnd - firstSplitStart);

        if (secondSplitStart === undefined) {
            this.copyIntoBuffer(bufferReference, 0, dataReference, firstSplitStart, firstSplitEnd);
            return firstSplitEnd;
        } else {
            this.copyIntoBuffer(bufferReference, 0, dataReference, firstSplitStart, firstSplitEnd);

            if (isLooped) {
                this.copyIntoBuffer(bufferReference, firstSplitLen, dataReference, secondSplitStart, secondSplitEnd);

                return secondSplitEnd;
            } else {
                return undefined;
            }
        }
    };

    /**
     * copies data from an array to the buffer with fast coping methods
     */
    this.copyIntoBuffer = function copyIntoBuffer(bufferReference, bufferOffset, dataReference, dataOffset, end) {
        bufferReference.set(dataReference.slice(dataOffset, end), bufferOffset);
    };


    this.play = function play(audioDataRef, sampleRate, isLooped, start, end) {
        // check if already playing or no data was given
        if (this.isPlaying || audioDataRef === undefined || audioDataRef.length < 1 ||
            sampleRate === undefined || sampleRate <= 0) return;


        // update playback variables
        this.audioDataRef = audioDataRef;
        this.sampleRate = sampleRate;
        this.isLooped = (isLooped === undefined) ? false : isLooped;
        this.playStart = (start === undefined || start < 0 || start >= audioDataRef[0].length) ? 0 : start;
        this.playEnd = (end === undefined || end - this.audioBufferSize < start || end >= audioDataRef[0].length) ? audioDataRef[0].length : end;
        this.currentPlayPosition = this.playStart;
        this.isPlaying = true;

        // connect the node, play!
        this.javaScriptNode.connect(this.analyserNode);

        // inform updatelistener
        this.notifyUpdateListener();
    };

    /**
     * Stops the playback and set all references to undefined (no resume possible)
     */
    this.stop = function stop() {
        // no playing audio, nothing to stop
        if (this.isPlaying === false) return;

        // diconnect the node, stop!
        this.javaScriptNode.disconnect(this.analyserNode);

        // set all playback information to default
        this.playStart = 0;
        this.playEnd = 0;
        this.isLooped = false;
        this.currentPlayPosition = 0;
        this.isPlaying = false;
        this.lastPlaybackUpdate = 0;

        // remove reference to the audio data
        this.audioDataRef = undefined;
        this.sampleRate = 0;

        // inform updatelistener
        this.notifyUpdateListener();
    };

    /**
     * Pause the playback of the audio
     */
    this.pause = function pause() {
        // no playing audio, nothing to pause
        if (this.isPlaying === false) return;
        this.isPlaying = false;
        this.lastPlaybackUpdate = 0;

        // diconnect the node, stop!
        this.audioJavaScriptNode.disconnect(this.analyserNode);

        // inform updatelistener
        this.notifyUpdateListener();
    };

    /**
     * Resume the audio playback from the last position
     */
    this.resume = function resume() {
        // check if already playing or no data was given
        if (this.isPlaying || this.audioDataRef === undefined || this.audioDataRef.length < 1) return;
        this.isPlaying = true;

        // connect the node, play!
        this.audioJavaScriptNode.connect(this.analyserNode);

        // inform updatelistener
        this.notifyUpdateListener();
    };

    /**
     * Add an update listener, which gets informed about changes in playback
     */
    this.addUpdateListener = function addUpdateListener(updateCallback) {
        this.updateListener.push(updateCallback);
    };

    /**
     * Notifies all update listener
     */
    this.notifyUpdateListener = function notifyUpdateListener() {
        for (var i = 0; i < this.updateListener.length; ++i) {
            this.updateListener[i].audioPlaybackUpdate();
        }
    };

    // Creation of a new audio context
    this.audioBufferSize = 1024;
    this.sampleRate = 0;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();

    // The JavaScriptNode is used to modifiy the output buffer    
    this.javaScriptNode = this.audioContext.createScriptProcessor(this.audioBufferSize, 1, 2);
    this.javaScriptNode.onaudioprocess = this.onAudioUpdate;
    this.javaScriptNode.eventHost = this;

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.minDecibels = -100;
    this.analyserNode.maxDecibels = 0;
    this.analyserNode.smoothingTimeConstant = 0.0;
    this.analyserNode.connect(this.audioContext.destination);

    this.audioDataRef = undefined;

    // Playback information
    this.playStart = 0;
    this.playEnd = 0;
    this.isLooped = false;
    this.currentPlayPosition = 0;
    this.isPlaying = false;

    // Callback information
    this.updateListener = [];
    this.playbackUpdateInterval = 0.0; // in Seconds
    this.lastPlaybackUpdate = 0;

}

function audioLayerControl(elementContext) {
    // the context of the hosting element
    this.elementContext = elementContext;
    this.elementContext.audioLayerControl = this;

    // HTML attributes
    this.title = "untitled";

    // HTML subelements
    this.label = undefined;
    /**
     * @type AudioSequenceEditor
     * @var Audio
     */
    this.audioPlayer = undefined;

    //
    this.listOfSequenceEditors = [];
    this.linkMode = false;

    // total length of the longest sequence
    this.audioSequenceLength = 0;

    this.playLoop = false;

    // use the audio context to play audio
    this.audioPlayback = new AudioPlayback();

    this.audioPlayback.addUpdateListener(this);

    this.spectrum = new SpectrumDisplay(this.elementContext, document.querySelectorAll('#spectrum')[0]);
    this.spectrumWorker = new SpectrumWorker();

    this.audioPlaybackUpdate = function audioPlaybackUpdate() {
        for (var i = 0; i < this.listOfSequenceEditors.length; ++i) {
            this.listOfSequenceEditors[i].playbackPos = this.audioPlayback.currentPlayPosition;
            this.listOfSequenceEditors[i].repaint();
        }

        var frequencyDomain = new Float32Array(this.audioPlayback.analyserNode.frequencyBinCount);
        this.audioPlayback.analyserNode.getFloatFrequencyData(frequencyDomain);
        this.spectrum.updateBuffer(frequencyDomain);
        this.spectrum.paintSpectrum();
    };

    this.audioSequenceSelectionUpdate = function audioSequenceSelectionUpdate() {
        var dataLength = this.listOfSequenceEditors[0].audioSequenceReference.data.length;
        var start = this.listOfSequenceEditors[0].selectionStart;
        start = (start < 0) ? 0 :
            (start > this.listOfSequenceEditors[0].audioSequenceReference.data.length - 1024) ?
                this.listOfSequenceEditors[0].audioSequenceReference.data.length - 1024 : start;

        var len = ((this.listOfSequenceEditors[0].selectionEnd > dataLength) ? dataLength : this.listOfSequenceEditors[0].selectionEnd) - start;

        var frequencyAmplitude = this.spectrumWorker.toAmplitudeSpectrumFromAudioSequence(
            this.listOfSequenceEditors[0].audioSequenceReference,
            start,
            len);

        this.spectrum.updateBuffer(frequencyAmplitude);
        this.spectrum.paintSpectrum();

    };

    // Properties    
    this.setTitle = function setTitle(titleValue) {
        this.title = titleValue;
        //this.label.innerHTML = this.title;
    };

    this.containsAudioLayerSequenceEditor = function containsAudioLayerSequenceEditor(name) {
        for (var i = 0; i < this.listOfSequenceEditors.length; ++i) {
            if (this.listOfSequenceEditors[i].title == name) return true;
        }
        return false;
    };

    this.addAudioLayerSequenceEditor = function addAudioLayerSequenceEditor(audioLayerSequenceEditor) {
        for (var i = 0; i < this.listOfSequenceEditors.length; ++i) {
            if (this.listOfSequenceEditors[i].title === audioLayerSequenceEditor.title) return;
        }
        this.listOfSequenceEditors.push(audioLayerSequenceEditor);

        this.updateLinkMode(this.linkMode);
    };

    this.removeAudioLayerSequenceEditor = function removeAudioLayerSequenceEditor(audioLayerSequenceEditor) {
        for (var i = 0; i < this.listOfSequenceEditors.length; ++i) {
            if (this.listOfSequenceEditors[i].title === audioLayerSequenceEditor.title) {
                this.listOfSequenceEditors.splice(i, 1);
            }
        }

        this.updateLinkMode(this.linkMode);
    };

    this.updateLinkMode = function updateLinkMode(linkModeValue) {
        this.linkMode = linkModeValue;
        if (this.linkMode) {
            for (var i = 0; i < this.listOfSequenceEditors.length - 1; ++i) {
                for (var j = i + 1; j < this.listOfSequenceEditors.length; ++j) {
                    this.listOfSequenceEditors[i].link(this.listOfSequenceEditors[j]);
                }
            }
        } else {

        }
    };

    // Create visual elements of this html element
    // Visual Elements
    this.createVisualElements = function createVisualElements() {
        /*this.label = document.createElement("label");
        this.label.innerHTML = this.title;
        this.elementContext.appendChild(this.label);
        */
        /*
        this.audioPlayer = document.createElement("Audio");
        this.audioPlayer.controls = true;
        this.elementContext.appendChild(this.audioPlayer);*/
    };

    this.createVisualElements();

    // Scan for attributes of the HTML element during the creation
    if ((typeof elementContext.attributes.title !== undefined) &&
        elementContext.attributes.title !== null) {
        this.setTitle(elementContext.attributes.title.value);
    }

    // public functions
    this.createSequenceEditor = function createSequenceEditor(name) {
        if (this.audioLayerControl.containsAudioLayerSequenceEditor(name) === true) return undefined;

        var sequenceEditorElement = document.createElement("audioLayerSequenceEditor");
        sequenceEditorElement.title = name;
        this.appendChild(sequenceEditorElement);
        var obj = new AudioLayerSequenceEditor(sequenceEditorElement);
        this.audioLayerControl.addAudioLayerSequenceEditor(obj);
        return obj;
    };

    this.removeAllSequenceEditors = function removeAllSequenceEditors() {
        for (var i = 0; i < this.children.length; ++i) {
            if (this.children[i].nodeName.toLowerCase() == "audiolayersequenceeditor") {
                this.audioLayerControl.removeAudioLayerSequenceEditor(this.children[i].audioLayerSequenceEditor);
                this.removeChild(this.children[i]);
                --i;
            }
        }
    };

    this.setLinkMode = function setLinkMode(linkModeValue) {
        this.audioLayerControl.updateLinkMode(linkModeValue);
    };

    this.zoomIntoSelection = function zoomIntoSelection() {
        if (this.audioLayerControl.listOfSequenceEditors.length > 0 && this.linkMode) {
            this.audioLayerControl.listOfSequenceEditors[0].zoomIntoSelection();
        } else {
            for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
                this.audioLayerControl.listOfSequenceEditors[i].zoomIntoSelection();
            }
        }
    };

    this.zoomToFit = function zoomToFit() {
        if (this.audioLayerControl.listOfSequenceEditors.length > 0 && this.linkMode) {
            this.audioLayerControl.istOfSequenceEditors[0].zoomIntoSelection();
        } else {
            for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
                this.audioLayerControl.listOfSequenceEditors[i].zoomToFit();
            }
        }
    };

    this.selectAll = function selectAll() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].selectAll();
        }
    };

    this.filterNormalize = function filterNormalize() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].filterNormalize();
        }
    };

    this.filterFadeIn = function filterFadeIn() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].filterFade(true);
        }
    };

    this.filterFadeOut = function filterFadeOut() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].filterFade(false);
        }
    };

    this.filterGain = function filterGain(decibel) {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].filterGain(decibel);
        }
    };

    this.filterSilence = function filterSilence() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].filterSilence();
        }
    };

    this.copy = function copy() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].copy(false);
        }
    };

    this.paste = function paste() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].paste(false);
        }
    };

    this.cut = function cut() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].cut(false);
        }
    };

    this.crop = function crop() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.copy();
            this.selectAll();
            this.paste();
            this.zoomToFit();
        }
    };

    this.del = function del() {
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].del(false);
        }
    };

    // in und export
    this.toWave = function toWave() {
        var wave = new WaveTrack();
        var sequenceList = [];

        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            sequenceList.push(this.audioLayerControl.listOfSequenceEditors[i].audioSequenceReference);
        }

        wave.fromAudioSequences(sequenceList);
        return wave;
    };

    this.playToggle = function playToggle() {
        if (this.audioLayerControl.audioPlayback.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
    };

    // playback
    this.play = function play() {
        // fast version (only chrome)
        var audioDataRefs = [];
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            audioDataRefs.push(this.audioLayerControl.listOfSequenceEditors[i].audioSequenceReference.data);
        }

        var selectionStart = this.audioLayerControl.listOfSequenceEditors[0].selectionStart;
        var selectionEnd = this.audioLayerControl.listOfSequenceEditors[0].selectionEnd;
        if (selectionStart != selectionEnd) {
            this.audioLayerControl.audioPlayback.play(audioDataRefs,
                this.audioLayerControl.listOfSequenceEditors[0].audioSequenceReference.sampleRate, this.playLoop,
                selectionStart, selectionEnd);
        } else {
            this.audioLayerControl.audioPlayback.play(audioDataRefs,
                this.audioLayerControl.listOfSequenceEditors[0].audioSequenceReference.sampleRate, this.playLoop);
        }


        /* slow version
        this.toWave().toBlobUrlAsync("audio/wav", function(url, host)
                                {
                                    host.audioLayerControl.audioPlayer.src = url;
                                    host.audioLayerControl.audioPlayer.play();
                                }, this);
        */
    };

    this.stop = function stop() {
        console.log("Stop");
        this.audioLayerControl.audioPlayback.stop();
        //this.audioLayerControl.stopFromAudioContext();
        //this.audioLayerControl.audioPlayer.pause();   
    };

    this.toggleLoop = function toogleLoop() {
        this.playLoop = !this.playLoop;
    };

    this.save = function save(saveLink) {
        var url = this.toWave().toBlobUrlAsync("application/octet-stream");
        saveLink.href = url;
        saveLink.className = "btn btn-large btn-success";
        /*this.toWave().toBlobUrlAsync(function(url, host)
                                {
                                    saveLink.href = url;
                                }, saveLink);  */
    };

    this.testFilter = function testFilter() { // audioLayerControl
        var audioDataRefs = [];
        for (var i = 0; i < this.audioLayerControl.listOfSequenceEditors.length; ++i) {
            audioDataRefs.push(this.audioLayerControl.listOfSequenceEditors[i].audioSequenceReference.data);
        }

        for (var i = 0; i < audioDataRefs.length; ++i) {
            this.audioLayerControl.listOfSequenceEditors[i].audioSequenceReference.data = this.audioLayerControl.spectrumWorker.testFilter(audioDataRefs[i]);
        }

        this.zoomToFit();

    };

    this.createTestSignal = function createTestSignal() {
        this.removeAllSequenceEditors();

        var numChannels = 2;
        for (var i = 0; i < numChannels; ++i) {
            var editor = this.createSequenceEditor("Test Channel " + i);
            var sequence = CreateNewAudioSequence(44100);
            sequence.createTestTone(44100 / 1024 * 10, 44100 * 10);
            editor.setAudioSequence(sequence);
            editor.zoomToFit();
        }
    };

    // Match functions for HTML Element
    this.elementContext.createSequenceEditor = this.createSequenceEditor;
    this.elementContext.removeAllSequenceEditors = this.removeAllSequenceEditors;
    this.elementContext.setLinkMode = this.setLinkMode;
    this.elementContext.zoomIntoSelection = this.zoomIntoSelection;
    this.elementContext.zoomToFit = this.zoomToFit;
    this.elementContext.selectAll = this.selectAll;

    this.elementContext.filterNormalize = this.filterNormalize;
    this.elementContext.filterFadeIn = this.filterFadeIn;
    this.elementContext.filterFadeOut = this.filterFadeOut;
    this.elementContext.filterGain = this.filterGain;
    this.elementContext.filterSilence = this.filterSilence;

    this.elementContext.toWave = this.toWave;
    this.elementContext.playToggle = this.playToggle;
    this.elementContext.play = this.play;
    this.elementContext.stop = this.stop;
    this.elementContext.toggleLoop = this.toggleLoop;
    this.elementContext.save = this.save;
    this.elementContext.testFilter = this.testFilter;
    this.elementContext.createTestSignal = this.createTestSignal;

    this.elementContext.copy = this.copy;
    this.elementContext.paste = this.paste;
    this.elementContext.cut = this.cut;
    this.elementContext.crop = this.crop;
    this.elementContext.del = this.del;

    // Drag and Drop
    this.filedb = undefined;

    this.createDropHandler = function createDropHandler() {
        var filedb = new FileDropbox();
        filedb.defineDropHandler(this.elementContext);
        filedb.eventHost = this;

        filedb.onFinish = function () {
            document.querySelectorAll('#app-progress')[0].style['width'] = '50%';
            activeAudioLayerControl = this.eventHost.elementContext;
            this.eventHost.audioPlayback.audioContext.decodeAudioData(this.resultArrayBuffer, this.eventHost.decodeAudioFinished, this.eventHost.decodeAudioFailed);
        };

        filedb.onFail = function (e) {
            var msg = '';


            switch (e.target.error.code) {
                case FileError.QUOTA_EXCEEDED_ERR:
                    msg = 'QUOTA_EXCEEDED_ERR';
                    break;
                case FileError.NOT_FOUND_ERR:
                    msg = 'NOT_FOUND_ERR';
                    break;
                case FileError.SECURITY_ERR:
                    msg = 'SECURITY_ERR';
                    break;
                case FileError.INVALID_MODIFICATION_ERR:
                    msg = 'INVALID_MODIFICATION_ERR';
                    break;
                case FileError.INVALID_STATE_ERR:
                    msg = 'INVALID_STATE_ERR';
                    break;
                default:
                    msg = 'Unknown Error ' + e.code;
                    break;
            }

            console.log('Error: ' + msg);
        }
    };

    this.decodeAudioFailed = function decodeAudioFailed(audioBuffer) {
        console.log('decodeAudioFailed, audiobuffer=', audioBuffer);

    };
    this.decodeAudioFinished = function decodeAudioFinished(audioBuffer) {
        document.querySelectorAll('#app-progress')[0].style['width'] = '90%';

        activeAudioLayerControl.removeAllSequenceEditors();

        var sampleRate = audioBuffer.sampleRate; // samples per second (float)
        var length = audioBuffer.length; // audio data in samples (float)
        var duration = audioBuffer.duration; // in seconds (float)
        var numChannels = audioBuffer.numberOfChannels; // (unsigned int)

        var channelNames = ["Left Channel", "Right Channel"];

        for (var i = 0; i < numChannels; ++i) {
            var editor = activeAudioLayerControl.createSequenceEditor(channelNames[i]);
            var sequence = CreateNewAudioSequence(sampleRate, audioBuffer.getChannelData(i));
            editor.setAudioSequence(sequence);
            editor.zoomToFit();
        }

        //activeAudioLayerControl.audioLayerControl.setupAudioContext();
        document.querySelectorAll('#app-progress')[0].style['width'] = '100%';

        setTimeout(function () {
            document.querySelectorAll('#app-progress')[0].style['width'] = '0%';
        }, 1000);
    };

    this.createDropHandler();

    this.elementContext.onselectstart = function () {
        return (false);
    };

}

function initializeAudioLayerControls() {
    new audioLayerControl(document.getElementsByTagName("audiolayercontrol")[0]);

    //var allElements = document.getElementsByTagName("audiolayercontrol");
    /*for(var i = 0; i < allElements.length; ++i)
    {
        var tagName = allElements[i].nodeName;
        console.log(tagName + " " + i);
        var obj = null;
        
        if (tagName.toLowerCase() == "audiolayercontrol")
        {
            obj = new audioLayerControl(allElements[i]);   
        }
        else if (tagName.toLowerCase() == "audiolayernavigation")
        {
            obj = new audioLayerControl(allElements[i]);   
        }
        else if (tagName.toLowerCase() == "audiolayersequenceeditor")
        {
            obj = new AudioLayerSequenceEditor(allElements[i]);   
        }
    }*/
}

var activeAudioLayerControl = undefined;
