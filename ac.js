////////////////////////////////////////////////////////////////////////////////
///
/// FIR low-pass (anti-alias) filter with filter coefficient design routine and
/// MMX optimization.
///
/// Anti-alias filter is used to prevent folding of high frequencies when
/// transposing the sample rate with interpolation.
///
/// Author        : Copyright (c) Olli Parviainen
/// Author e-mail : oparviai 'at' iki.fi
/// SoundTouch WWW: http://www.surina.net/soundtouch
///
////////////////////////////////////////////////////////////////////////////////
//
// Last changed  : $Date: 2006-09-18 22:29:22 $
// File revision : $Revision: 1.4 $
//
// $Id: AAFilter.cpp,v 1.4 2006-09-18 22:29:22 martynshaw Exp $
//
////////////////////////////////////////////////////////////////////////////////
//
// License :
//
//  SoundTouch audio processing library
//  Copyright (c) Olli Parviainen
//
//  This library is free software; you can redistribute it and/or
//  modify it under the terms of the GNU Lesser General Public
//  License as published by the Free Software Foundation; either
//  version 2.1 of the License, or (at your option) any later version.
//
//  This library is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//  Lesser General Public License for more details.
//
//  You should have received a copy of the GNU Lesser General Public
//  License along with this library; if not, write to the Free Software
//  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
//
////////////////////////////////////////////////////////////////////////////////

function ACAAFilter(length) {
    if (length === undefined) length = 32;

    this.pFIR = new ACFIRFilter();
    this.cutoffFreq = 0.9;
    this.length = 0;

    this.setCutoffFreq = function setCutoffFreq(newCutoffFreq) {
        this.cutoffFreq = newCutoffFreq;
        this.calculateCoeffs();
    };

    this.setLength = function setLength(newLength) {
        this.length = newLength;
        this.calculateCoeffs();
    };

    this.calculateCoeffs = function calculateCoeffs() {
        var i;
        var cntTemp, temp, tempCoeff, h, w;
        var fc2, wc;
        var scaleCoeff, sum;
        var work;
        var coeffs;

        if (this.length <= 0 || this.length % 4 != 0 || this.cutoffFreq < 0 || this.cutoffFreq > 1.5) debugger;

        work = new Float32Array(this.length);
        this.coeffs = new Float32Array(this.length);

        fc2 = 2.0 * this.cutoffFreq;
        wc = Math.PI * fc2;
        tempCoeff = Math.PI * 2 / length;

        sum = 0;
        for (i = 0; i < this.length; i++) {
            cntTemp = i - (this.length / 2);

            temp = cntTemp * wc;
            if (temp != 0) {
                h = fc2 * Math.sin(temp) / temp; // sinc function
            } else {
                h = 1.0;
            }
            w = 0.54 + 0.46 * Math.cos(tempCoeff * cntTemp); // hamming window

            temp = w * h;
            work[i] = temp;

            // calc net sum of coefficients
            sum += temp;
        }

        // ensure the sum of coefficients is larger than zero
        /*  assert(sum > 0);
    
        // ensure we've really designed a lowpass filter...
        assert(work[length/2] > 0);
        assert(work[length/2 + 1] > -1e-6);
        assert(work[length/2 - 1] > -1e-6);
    */
        // Calculate a scaling coefficient in such a way that the result can be
        // divided by 16384
        scaleCoeff = 16384.0 / sum;

        for (var i = 0; i < this.length; i++) {
            // scale & round to nearest integer
            temp = work[i] * scaleCoeff;
            temp += (temp >= 0) ? 0.5 : -0.5;
            // ensure no overfloods
            if (temp < -32768 || temp > 32767) debugger;
            this.coeffs[i] = temp;
        }

        // Set coefficients. Use divide factor 14 => divide result by 2^14 = 16384
        this.pFIR.setCoefficients(this.coeffs, this.length, 14);
    }

    this.evaluate = function evaluate(dest, src, numSamples) {
        return this.pFIR.evaluateFilter(dest, src, numSamples);
    };

    this.getLength = function getLength() {
        return this.pFIR.getLength();
    };

    this.setLength(length);
}

/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

/**********************************************************************

  FFT.cpp

  Dominic Mazzoni

  September 2000

*******************************************************************//*!

\file FFT.cpp
\brief Fast Fourier Transform routines.

  This file contains a few FFT routines, including a real-FFT
  routine that is almost twice as fast as a normal complex FFT,
  and a power spectrum routine when you know you don't care
  about phase information.

  Some of this code was based on a free implementation of an FFT
  by Don Cross, available on the web at:

    http://www.intersrv.com/~dcross/fft.html

  The basic algorithm for his code was based on Numerican Recipes
  in Fortran.  I optimized his code further by reducing array
  accesses, caching the bit reversal table, and eliminating
  float-to-double conversions, and I added the routines to
  calculate a real FFT and a real power spectrum.

*//*******************************************************************/
/*
  Salvo Ventura - November 2006
  Added more window functions:
    * 4: Blackman
    * 5: Blackman-Harris
    * 6: Welch
    * 7: Gaussian(a=2.5)
    * 8: Gaussian(a=3.5)
    * 9: Gaussian(a=4.5)
*/

var gFFTBitTable = undefined;
var MaxFastBits = 16;



function IsPowerOfTwo(x)
{
   if (x < 2)
      return false;

   if (x & (x - 1))             /* Thanks to 'byang' for this cute trick! */
      return false;

   return true;
}

function NumberOfBitsNeeded( PowerOfTwo)
{
   var i;

   if (PowerOfTwo < 2) {
      fprintf(stderr, "Error: FFT called with size %d\n", PowerOfTwo);
      exit(1);
   }

   for (var i = 0;; i++)
      if (PowerOfTwo & (1 << i))
         return i;
}

function ReverseBits( index,  NumBits)
{
   var i, rev;

   for (var i = rev = 0; i < NumBits; i++) {
      rev = (rev << 1) | (index & 1);
      index >>= 1;
   }

   return rev;
}

function ACInitFFT()
{
   gFFTBitTable = [];

   var len = 2;
   for (var b = 1; b <= MaxFastBits; b++) {

      gFFTBitTable[b - 1] = new Int32Array(len);

      for (var i = 0; i < len; i++)
         gFFTBitTable[b - 1][i] = ReverseBits(i, b);

      len <<= 1;
   }

   console.log("ACFFT initiliazed");
}

function DeinitFFT()
{
   if (gFFTBitTable) {
      for (var b = 1; b <= MaxFastBits; b++) {
         gFFTBitTable[b-1] = undefined;
      }
      gFFTBitTable = undefined;
   }
}

function FastReverseBits( i,  NumBits)
{
   if (NumBits <= MaxFastBits)
      return gFFTBitTable[NumBits - 1][i];
   else
      return ReverseBits(i, NumBits);
}

/*
 * Complex Fast Fourier Transform
 */

function ACFFT( NumSamples,
          InverseTransform,
          RealIn,  ImagIn,  RealOut,  ImagOut)
{
   var NumBits;                 /* Number of bits needed to store indices */
   var i, j, k, n;
   var BlockSize, BlockEnd;

   var angle_numerator = 2.0 * Math.PI;
   var tr, ti;                /* temp real, temp imaginary */

   if (!IsPowerOfTwo(NumSamples)) {
      console.log(NumSamples + " is not a power of two");
      return 1;
   }

   if (!gFFTBitTable)
      ACInitFFT();

   if (!InverseTransform)
      angle_numerator = -angle_numerator;

   NumBits = NumberOfBitsNeeded(NumSamples);

   /*
    **   Do simultaneous data copy and bit-reversal ordering into outputs...
    */

   for (var i = 0; i < NumSamples; i++) {
      j = FastReverseBits(i, NumBits);
      RealOut[j] = RealIn[i];
      ImagOut[j] = (ImagIn === undefined) ? 0.0 : ImagIn[i];
   }

   /*
    **   Do the FFT itself...
    */

   BlockEnd = 1;
   for (BlockSize = 2; BlockSize <= NumSamples; BlockSize <<= 1) {

      var delta_angle = angle_numerator /  BlockSize;

      var sm2 = Math.sin(-2 * delta_angle);
      var sm1 = Math.sin(-delta_angle);
      var cm2 = Math.cos(-2 * delta_angle);
      var cm1 = Math.cos(-delta_angle);
      var w = 2 * cm1;
      var ar0, ar1, ar2, ai0, ai1, ai2;

      for (var i = 0; i < NumSamples; i += BlockSize) {
         ar2 = cm2;
         ar1 = cm1;

         ai2 = sm2;
         ai1 = sm1;

         for (var j = i, n = 0; n < BlockEnd; j++, n++) {
            ar0 = w * ar1 - ar2;
            ar2 = ar1;
            ar1 = ar0;

            ai0 = w * ai1 - ai2;
            ai2 = ai1;
            ai1 = ai0;

            k = j + BlockEnd;
            tr = ar0 * RealOut[k] - ai0 * ImagOut[k];
            ti = ar0 * ImagOut[k] + ai0 * RealOut[k];

            RealOut[k] = RealOut[j] - tr;
            ImagOut[k] = ImagOut[j] - ti;

            RealOut[j] += tr;
            ImagOut[j] += ti;
         }
      }

      BlockEnd = BlockSize;
   }

   /*
      **   Need to normalize if inverse transform...
    */

   if (InverseTransform) {
      var denom = NumSamples;

      for (var i = 0; i < NumSamples; i++) {
         RealOut[i] /= denom;
         ImagOut[i] /= denom;
      }
   }
}

/*
 * Real Fast Fourier Transform
 *
 * This function was based on the code in Numerical Recipes in C.
 * In Num. Rec., the inner loop is based on a Math.single 1-based array
 * of interleaved real and imaginary numbers.  Because we have two
 * separate zero-based arrays, our indices are quite different.
 * Here is the correspondence between Num. Rec. indices and our indices:
 *
 * i1  <->  real[i]
 * i2  <->  imag[i]
 * i3  <->  real[n/2-i]
 * i4  <->  imag[n/2-i]
 */

function RealFFT( NumSamples,  RealIn,  RealOut,  ImagOut)
{

   var Half = NumSamples / 2;
   var i;

   var theta = Math.PI / Half;

   var tmpReal = new Float32Array(Half);
   var tmpImag = new Float32Array(Half);

   for (var i = 0; i < Half; i++) {
      tmpReal[i] = RealIn[2 * i];
      tmpImag[i] = RealIn[2 * i + 1];
   }

   ACFFT(Half, 0, tmpReal, tmpImag, RealOut, ImagOut);

   var wtemp = (Math.sin(0.5 * theta));

   var wpr = -2.0 * wtemp * wtemp;
   var wpi = -1.0 * (Math.sin(theta));
   var wr = 1.0 + wpr;
   var wi = wpi;

   var i3;

   var h1r, h1i, h2r, h2i;

   for (var i = 1; i < Half / 2; i++) {

      i3 = Half - i;

      h1r = 0.5 * (RealOut[i] + RealOut[i3]);
      h1i = 0.5 * (ImagOut[i] - ImagOut[i3]);
      h2r = 0.5 * (ImagOut[i] + ImagOut[i3]);
      h2i = -0.5 * (RealOut[i] - RealOut[i3]);

      RealOut[i] = h1r + wr * h2r - wi * h2i;
      ImagOut[i] = h1i + wr * h2i + wi * h2r;
      RealOut[i3] = h1r - wr * h2r + wi * h2i;
      ImagOut[i3] = -h1i + wr * h2i + wi * h2r;

      wr = (wtemp = wr) * wpr - wi * wpi + wr;
      wi = wi * wpr + wtemp * wpi + wi;
   }

   RealOut[0] = (h1r = RealOut[0]) + ImagOut[0];
   ImagOut[0] = h1r - ImagOut[0];
}


/*
 * PowerSpectrum
 *
 * This function computes the same as RealFFT, above, but
 * adds the squares of the real and imaginary part of each
 * coefficient, extracting the power and throwing away the
 * phase.
 *
 * For speed, it does not call RealFFT, but duplicates some
 * of its code.
 */

function PowerSpectrum( NumSamples,  In,  Out)
{
   var Half = NumSamples / 2;
   var i;

   var theta = Math.PI / Half;

   var tmpReal = new Float32Array(Half);
   var tmpImag = new Float32Array(Half);
   var RealOut = new Float32Array(Half);
   var ImagOut = new Float32Array(Half);

   for (var i = 0; i < Half; i++) {
      tmpReal[i] = In[2 * i];
      tmpImag[i] = In[2 * i + 1];
   }

   ACFFT(Half, 0, tmpReal, tmpImag, RealOut, ImagOut);

   var wtemp = (Math.sin(0.5 * theta));

   var wpr = -2.0 * wtemp * wtemp;
   var wpi = -1.0 * (Math.sin(theta));
   var wr = 1.0 + wpr;
   var wi = wpi;

   var i3;

   var h1r, h1i, h2r, h2i, rt, it;

   for (var i = 1; i < Half / 2; i++) {

      i3 = Half - i;

      h1r = 0.5 * (RealOut[i] + RealOut[i3]);
      h1i = 0.5 * (ImagOut[i] - ImagOut[i3]);
      h2r = 0.5 * (ImagOut[i] + ImagOut[i3]);
      h2i = -0.5 * (RealOut[i] - RealOut[i3]);

      rt = h1r + wr * h2r - wi * h2i;
      it = h1i + wr * h2i + wi * h2r;

      Out[i] = rt * rt + it * it;

      rt = h1r - wr * h2r + wi * h2i;
      it = -h1i + wr * h2i + wi * h2r;

      Out[i3] = rt * rt + it * it;

      wr = (wtemp = wr) * wpr - wi * wpi + wr;
      wi = wi * wpr + wtemp * wpi + wi;
   }

   rt = (h1r = RealOut[0]) + ImagOut[0];
   it = h1r - ImagOut[0];
   Out[0] = rt * rt + it * it;

   rt = RealOut[Half / 2];
   it = ImagOut[Half / 2];
   Out[Half / 2] = rt * rt + it * it;
}

/*
 * Windowing Functions
 */

function NumWindowFuncs()
{
   return 10;
}

function WindowFuncName(whichFunction)
{
   switch (whichFunction) {
   default:
   case 0:
      return "Rectangular";
   case 1:
      return "Bartlett";
   case 2:
      return "Hamming";
   case 3:
      return "Hanning";
   case 4:
      return "Blackman";
   case 5:
      return "Blackman-Harris";
   case 6:
      return "Welch";
   case 7:
      return "Gaussian(a=2.5)";
   case 8:
      return "Gaussian(a=3.5)";
   case 9:
      return "Gaussian(a=4.5)";
   }
}

function WindowFunc( whichFunction,  NumSamples,  inData)
{
   var i;
   var A;

   switch( whichFunction )
   {
   case 1:
      // Bartlett (triangular) window
      for (var i = 0; i < NumSamples / 2; i++) {
         inData[i] *= (i / NumSamples / 2.0);
         inData[i + (NumSamples / 2)] *=
             (1.0 - (i / NumSamples / 2.0));
      }
      break;
   case 2:
      // Hamming
      for (var i = 0; i < NumSamples; i++)
         inData[i] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (NumSamples - 1));
      break;
   case 3:
      // Hanning
      for (var i = 0; i < NumSamples; i++)
         inData[i] *= 0.50 - 0.50 * Math.cos(2 * Math.PI * i / (NumSamples - 1));
      break;
   case 4:
      // Blackman
      for (var i = 0; i < NumSamples; i++) {
          inData[i] *= 0.42 - 0.5 * Math.cos (2 * Math.PI * i / (NumSamples - 1)) + 0.08 * Math.cos (4 * Math.PI * i / (NumSamples - 1));
      }
      break;
   case 5:
      // Blackman-Harris
      for (var i = 0; i < NumSamples; i++) {
          inData[i] *= 0.35875 - 0.48829 * Math.cos(2 * Math.PI * i /(NumSamples-1)) + 0.14128 * Math.cos(4 * Math.PI * i/(NumSamples-1)) - 0.01168 * Math.cos(6 * Math.PI * i/(NumSamples-1));
      }
      break;
   case 6:
      // Welch
      for (var i = 0; i < NumSamples; i++) {
          inData[i] *= 4*i/ NumSamples *(1-(i/NumSamples));
      }
      break;
   case 7:
      // Gaussian (a=2.5)
      // Precalculate some values, and simplify the fmla to try and reduce overhead
      A=-2*2.5*2.5;

      for (var i = 0; i < NumSamples; i++) {

          inData[i] *= Math.exp(A*(0.25 + ((i/NumSamples)*(i/NumSamples)) - (i/NumSamples)));
      }
      break;
   case 8:
      // Gaussian (a=3.5)
      A=-2*3.5*3.5;
      for (var i = 0; i < NumSamples; i++) {
          // reduced
          inData[i] *= Math.exp(A*(0.25 + ((i/NumSamples)*(i/NumSamples)) - (i/NumSamples)));
      }
      break;
   case 9:
      // Gaussian (a=4.5)
      A=-2*4.5*4.5;

      for (var i = 0; i < NumSamples; i++) {
          // reduced
          inData[i] *= Math.exp(A*(0.25 + ((i/NumSamples)*(i/NumSamples)) - (i/NumSamples)));
      }
      break;
   default:
      
   }
}

// Indentation settings for Vim and Emacs and unique identifier for Arch, a
// version control system. Please do not modify past this point.
//
// Local Variables:
// c-basic-offset: 3
// indent-tabs-mode: nil
// End:
//
// vim: et sts=3 sw=3
// arch-tag: 47691958-d393-488c-abc5-81178ea2686e

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
///
/// General FIR digital filter routines with MMX optimization.
///
/// Note : MMX optimized functions reside in a separate, platform-specific file,
/// e.g. 'mmx_win.cpp' or 'mmx_gcc.cpp'
///
/// Author        : Copyright (c) Olli Parviainen
/// Author e-mail : oparviai 'at' iki.fi
/// SoundTouch WWW: http://www.surina.net/soundtouch
///
////////////////////////////////////////////////////////////////////////////////
//
// Last changed  : $Date: 2006-09-18 22:29:22 $
// File revision : $Revision: 1.4 $
//
// $Id: FIRFilter.cpp,v 1.4 2006-09-18 22:29:22 martynshaw Exp $
//
////////////////////////////////////////////////////////////////////////////////
//
// License :
//
//  SoundTouch audio processing library
//  Copyright (c) Olli Parviainen
//
//  This library is free software; you can redistribute it and/or
//  modify it under the terms of the GNU Lesser General Public
//  License as published by the Free Software Foundation; either
//  version 2.1 of the License, or (at your option) any later version.
//
//  This library is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
//  Lesser General Public License for more details.
//
//  You should have received a copy of the GNU Lesser General Public
//  License along with this library; if not, write to the Free Software
//  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
//
////////////////////////////////////////////////////////////////////////////////


/*****************************************************************************
 *
 * Implementation of the class 'FIRFilter'
 *
 *****************************************************************************/

function ACFIRFilter() {
    this.resultDivFactor = 0;
    this.length = 0;
    this.lengthDiv8 = 0;
    this.filterCoeffs = undefined;
    this.resultDivider = 0;

    this.evaluateFilter = function (dest, src, numSamples) {
        var i, j, end;
        var sum;
        var dScaler = 1.0 / this.resultDivider;


        if (this.length === 0) debugger;

        end = numSamples - this.length;
        var srcPos = 0;
        for (var j = 0; j < end; j++) {
            sum = 0;
            for (var i = 0; i < this.length; i += 4) {
                // loop is unrolled by factor of 4 here for efficiency
                sum += src[srcPos + i + 0] * this.filterCoeffs[i + 0] +
                    src[srcPos + i + 1] * this.filterCoeffs[i + 1] +
                    src[srcPos + i + 2] * this.filterCoeffs[i + 2] +
                    src[srcPos + i + 3] * this.filterCoeffs[i + 3];
            }

            sum *= dScaler;

            dest[j] = sum;
            srcPos++;
        }
        return end;
    }

    this.setCoefficients = function setCoefficients(coeffs, newLength, uResultDivFactor) {
        if (newLength === 0) debugger;
        if (newLength % 8) throw ("FIR filter length not divisible by 8");

        this.lengthDiv8 = newLength / 8;
        this.length = this.lengthDiv8 * 8;
        if (this.length !== newLength) debugger;

        this.resultDivFactor = uResultDivFactor;
        this.resultDivider = Math.pow(2., this.resultDivFactor);

        this.filterCoeffs = new Float32Array(this.length);
        for (var i = 0; i < this.filterCoeffs.length; ++i) {
            this.filterCoeffs[i] = coeffs[i];
        }
    }

    this.getLength = function getLength() {
        return this.length;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**********************************************************************

  Audacity: A Digital Audio Editor

  Spectrum.cpp

  Dominic Mazzoni

*******************************************************************/
/*!

\file Spectrum.cpp
\brief Functions for computing Spectra.

*/
/*******************************************************************/




function ComputeSpectrum(data, width,
    windowSize,
    rate, output,
    autocorrelation, windowFunc) {
    if (width < windowSize)
        return false;

    if (!data || !output)
        return true;

    var processed = new Float32Array(windowSize);

    var i;
    for (var i = 0; i < windowSize; i++)
        processed[i] = 0.0;
    var half = windowSize / 2;

    var inData = new Float32Array(windowSize);
    var out = new Float32Array(windowSize);
    var out2 = new Float32Array(windowSize);

    var start = 0;
    var windows = 0;
    while (start + windowSize <= width) {
        for (var i = 0; i < windowSize; i++)
            inData[i] = data[start + i];

        WindowFunc(windowFunc, windowSize, inData);

        if (autocorrelation) {
            // Take FFT
            ACFFT(windowSize, false, inData, undefined, out, out2);

            // Compute power
            for (var i = 0; i < windowSize; i++)
                inData[i] = (out[i] * out[i]) + (out2[i] * out2[i]);

            // Tolonen and Karjalainen recommend taking the cube root
            // of the power, instead of the square root

            for (var i = 0; i < windowSize; i++)
                inData[i] = Math.pow(inData[i], 1.0 / 3.0);

            ACFFT(windowSize, false, inData, undefined, out, out2);
        } else
            PowerSpectrum(windowSize, inData, out);

        // Take real part of result
        for (var i = 0; i < half; i++)
            processed[i] += out[i];

        start += half;
        windows++;
    }

    if (autocorrelation) {

        // Peak Pruning as described by Tolonen and Karjalainen, 2000
        /*
         Combine most of the calculations in a Math.Math.Math.single for loop.
         It should be safe, as indexes refer only to current and previous elements,
         that have already been clipped, etc...
        */
        for (var i = 0; i < half; i++) {
            // Clip at zero, copy to temp array
            if (processed[i] < 0.0)
                processed[i] = 0.0;
            out[i] = processed[i];
            // Subtract a time-doubled signal (linearly interp.) from the original
            // (clipped) signal
            if ((i % 2) == 0)
                processed[i] -= out[i / 2];
            else
                processed[i] -= ((out[i / 2] + out[i / 2 + 1]) / 2);

            // Clip at zero again
            if (processed[i] < 0.0)
                processed[i] = 0.0;
        }

        // Reverse and scale
        for (var i = 0; i < half; i++)
            inData[i] = processed[i] / (windowSize / 4);
        for (var i = 0; i < half; i++)
            processed[half - 1 - i] = inData[i];
    } else {
        // Convert to decibels
        // But do it safely; -Inf is nobody's friend
        for (var i = 0; i < half; i++) {
            var temp = (processed[i] / windowSize / windows);
            if (temp > 0.0)
                processed[i] = 10 * Math.log(temp) / Math.LN10;
            else
                processed[i] = 0;
        }
    }

    for (var i = 0; i < half; i++)
        output[i] = processed[i];


    return true;
}


/**********************************************************************

  Audacity: A Digital Audio Editor

  Spectrum.cpp

  Dominic Mazzoni

*******************************************************************/
/*!

\file Spectrum.cpp
\brief Functions for computing Spectra.

*/
/*******************************************************************/



function ComputeSpectrum(data, width,
    windowSize,
    rate, output,
    autocorrelation, windowFunc) {
    if (width < windowSize)
        return false;

    if (!data || !output)
        return true;

    var processed = new Float32Array(windowSize);

    var i;
    for (var i = 0; i < windowSize; i++)
        processed[i] = 0.0;
    var half = windowSize / 2;

    var inData = new Float32Array(windowSize);
    var out = new Float32Array(windowSize);
    var out2 = new Float32Array(windowSize);

    var start = 0;
    var windows = 0;
    while (start + windowSize <= width) {
        for (var i = 0; i < windowSize; i++)
            inData[i] = data[start + i];

        WindowFunc(windowFunc, windowSize, inData);

        if (autocorrelation) {
            // Take FFT
            ACFFT(windowSize, false, inData, undefined, out, out2);

            // Compute power
            for (var i = 0; i < windowSize; i++)
                inData[i] = (out[i] * out[i]) + (out2[i] * out2[i]);

            // Tolonen and Karjalainen recommend taking the cube root
            // of the power, instead of the square root

            for (var i = 0; i < windowSize; i++)
                inData[i] = Math.pow(inData[i], 1.0 / 3.0);

            ACFFT(windowSize, false, inData, undefined, out, out2);
        } else
            PowerSpectrum(windowSize, inData, out);

        // Take real part of result
        for (var i = 0; i < half; i++)
            processed[i] += out[i];

        start += half;
        windows++;
    }

    if (autocorrelation) {

        // Peak Pruning as described by Tolonen and Karjalainen, 2000
        /*
         Combine most of the calculations in a Math.Math.Math.single for loop.
         It should be safe, as indexes refer only to current and previous elements,
         that have already been clipped, etc...
        */
        for (var i = 0; i < half; i++) {
            // Clip at zero, copy to temp array
            if (processed[i] < 0.0)
                processed[i] = 0.0;
            out[i] = processed[i];
            // Subtract a time-doubled signal (linearly interp.) from the original
            // (clipped) signal
            if ((i % 2) == 0)
                processed[i] -= out[i / 2];
            else
                processed[i] -= ((out[i / 2] + out[i / 2 + 1]) / 2);

            // Clip at zero again
            if (processed[i] < 0.0)
                processed[i] = 0.0;
        }

        // Reverse and scale
        for (var i = 0; i < half; i++)
            inData[i] = processed[i] / (windowSize / 4);
        for (var i = 0; i < half; i++)
            processed[half - 1 - i] = inData[i];
    } else {
        // Convert to decibels
        // But do it safely; -Inf is nobody's friend
        for (var i = 0; i < half; i++) {
            var temp = (processed[i] / windowSize / windows);
            if (temp > 0.0)
                processed[i] = 10 * Math.log(temp) / Math.LN10;
            else
                processed[i] = 0;
        }
    }

    for (var i = 0; i < half; i++)
        output[i] = processed[i];


    return true;
}
