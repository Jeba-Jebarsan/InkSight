import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateTattooMockup, getApiToken, setApiToken, hasApiToken } from '../services/replicateService';
import { TattooSimulation } from '../types';

interface SimulatorProps {
  onSave: (sim: TattooSimulation) => void;
}

interface StateSnapshot {
  prompt: string;
  style: string;
  rotation: number;
  scale: number;
  brightness: number;
  contrast: number;
  sharpen: boolean;
  resultImageUrl: string | null;
  analysis: any | null;
}

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const STYLES = [
  { name: 'Traditional', icon: 'fa-anchor' },
  { name: 'Minimalist', icon: 'fa-minus' },
  { name: 'Realism', icon: 'fa-eye' },
  { name: 'Japanese (Irezumi)', icon: 'fa-dragon' },
  { name: 'Blackwork', icon: 'fa-fill-drip' },
  { name: 'Fineline', icon: 'fa-pen-nib' },
  { name: 'Cyberpunk', icon: 'fa-microchip' },
  { name: 'Geometric', icon: 'fa-shapes' }
];

const BODY_PARTS = [
  {
    name: 'Full Image', icon: 'fa-expand', value: 'full', prompts: [
      'A meaningful quote in elegant script',
      'A nature scene with mountains and trees',
      'Abstract geometric patterns'
    ]
  },
  {
    name: 'Arm/Hand', icon: 'fa-hand', value: 'arm', prompts: [
      'A sleeve of roses and thorns',
      'Tribal band pattern',
      'A clock with roman numerals',
      'A snake coiling around the arm',
      'Mandala on the wrist'
    ]
  },
  {
    name: 'Leg', icon: 'fa-shoe-prints', value: 'leg', prompts: [
      'A dragon wrapping around the calf',
      'Floral design with butterflies',
      'Polynesian tribal pattern',
      'An anchor with rope',
      'A lion portrait'
    ]
  },
  {
    name: 'Back', icon: 'fa-person', value: 'back', prompts: [
      'Angel wings spanning the shoulders',
      'A Japanese koi fish scene',
      'A phoenix rising from flames',
      'A tree of life',
      'A detailed skull with flowers'
    ]
  },
  {
    name: 'Chest', icon: 'fa-heart', value: 'chest', prompts: [
      'An anatomical heart with flowers',
      'Eagle with spread wings',
      'A sacred geometry pattern',
      'A crown with jewels',
      'A compass with coordinates'
    ]
  },
  {
    name: 'Custom Area', icon: 'fa-crop', value: 'custom', prompts: [
      'A small delicate butterfly',
      'A minimalist moon phases design',
      'A tiny heart outline',
      'A small star constellation',
      'An infinity symbol'
    ]
  }
];

const Simulator: React.FC<SimulatorProps> = ({ onSave }) => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Traditional');
  const [bodyPart, setBodyPart] = useState('full');
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sharpen, setSharpen] = useState(true);
  const [tattooOpacity, setTattooOpacity] = useState(100);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showEnhance, setShowEnhance] = useState(false);

  // Selection state for custom area
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [tempSelection, setTempSelection] = useState<SelectionBox | null>(null);

  // API Token state
  const [apiToken, setApiTokenState] = useState(getApiToken());
  const [showTokenInput, setShowTokenInput] = useState(!hasApiToken());
  const [tokenInputValue, setTokenInputValue] = useState('');

  // Unified Undo/Redo State
  const [history, setHistory] = useState<StateSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalChange = useRef(false);
  const promptTimeoutRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Tattoo machine sound effect ref
  const tattooSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize tattoo machine sound
  useEffect(() => {
    // Create audio element for tattoo buzzing sound
    const audio = new Audio();
    // Use local tattoo machine buzzing sound
    audio.src = '/tattoo-machine.mp3';
    audio.loop = true;
    audio.volume = 0.4;
    audio.preload = 'auto';
    tattooSoundRef.current = audio;

    return () => {
      if (tattooSoundRef.current) {
        tattooSoundRef.current.pause();
        tattooSoundRef.current = null;
      }
    };
  }, []);

  // Function to start tattoo sound
  const startTattooSound = () => {
    if (tattooSoundRef.current) {
      tattooSoundRef.current.currentTime = 0;
      tattooSoundRef.current.play().catch(err => {
        console.log('Audio play prevented:', err);
      });
    }
  };

  // Function to stop tattoo sound
  const stopTattooSound = () => {
    if (tattooSoundRef.current) {
      tattooSoundRef.current.pause();
      tattooSoundRef.current.currentTime = 0;
    }
  };

  // Initialize history when image is first uploaded
  useEffect(() => {
    if (image && history.length === 0) {
      pushSnapshot({
        prompt,
        style,
        rotation,
        scale,
        brightness,
        contrast,
        sharpen,
        resultImageUrl: null,
        analysis: null
      });
    }
  }, [image]);

  // Debounced Prompt & Style Change Recording
  useEffect(() => {
    if (!image || isInternalChange.current) return;

    if (promptTimeoutRef.current) window.clearTimeout(promptTimeoutRef.current);

    promptTimeoutRef.current = window.setTimeout(() => {
      const last = history[historyIndex];
      if (last && (last.prompt !== prompt || last.style !== style)) {
        pushSnapshot({
          prompt,
          style,
          rotation,
          scale,
          brightness,
          contrast,
          sharpen,
          resultImageUrl: last.resultImageUrl,
          analysis: last.analysis
        });
      }
    }, 800);

    return () => {
      if (promptTimeoutRef.current) window.clearTimeout(promptTimeoutRef.current);
    };
  }, [prompt, style]);

  // Clear selection when body part changes (except for custom)
  useEffect(() => {
    if (bodyPart !== 'custom') {
      setSelection(null);
      setIsSelecting(false);
    }
  }, [bodyPart]);

  const handleSaveToken = () => {
    if (tokenInputValue.trim()) {
      setApiToken(tokenInputValue.trim());
      setApiTokenState(tokenInputValue.trim());
      setShowTokenInput(false);
      setTokenInputValue('');
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem('replicate_api_token');
    setApiTokenState('');
    setShowTokenInput(true);
  };

  const pushSnapshot = (snapshot: StateSnapshot) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, snapshot];
    });
    setHistoryIndex(prev => prev + 1);
  };

  const applySnapshot = (index: number) => {
    const snap = history[index];
    if (!snap) return;

    isInternalChange.current = true;
    setPrompt(snap.prompt);
    setStyle(snap.style);
    setRotation(snap.rotation);
    setScale(snap.scale);
    setBrightness(snap.brightness);
    setContrast(snap.contrast);
    setSharpen(snap.sharpen);
    setHistoryIndex(index);

    setTimeout(() => {
      isInternalChange.current = false;
    }, 50);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      applySnapshot(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      applySnapshot(historyIndex + 1);
    }
  };

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setHistory([{
          prompt: '',
          style: 'Traditional',
          rotation: 0,
          scale: 1,
          brightness: 100,
          contrast: 100,
          sharpen: true,
          resultImageUrl: null,
          analysis: null
        }]);
        setHistoryIndex(0);
        setPrompt('');
        setStyle('Traditional');
        setRotation(0);
        setScale(1);
        setBrightness(100);
        setContrast(100);
        setSharpen(true);
        setTattooOpacity(100);
        setSelection(null);
        setBodyPart('full');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Selection handlers for custom area
  const handleSelectionStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (bodyPart !== 'custom' || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsSelecting(true);
    setTempSelection({ startX: x, startY: y, endX: x, endY: y });
  }, [bodyPart]);

  const handleSelectionMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !imageContainerRef.current || !tempSelection) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setTempSelection(prev => prev ? { ...prev, endX: x, endY: y } : null);
  }, [isSelecting, tempSelection]);

  const handleSelectionEnd = useCallback(() => {
    if (tempSelection) {
      // Normalize selection (ensure start is always less than end)
      const normalizedSelection = {
        startX: Math.min(tempSelection.startX, tempSelection.endX),
        startY: Math.min(tempSelection.startY, tempSelection.endY),
        endX: Math.max(tempSelection.startX, tempSelection.endX),
        endY: Math.max(tempSelection.startY, tempSelection.endY)
      };

      // Only save if selection has some size
      if (normalizedSelection.endX - normalizedSelection.startX > 5 &&
        normalizedSelection.endY - normalizedSelection.startY > 5) {
        setSelection(normalizedSelection);
      }
    }
    setIsSelecting(false);
    setTempSelection(null);
  }, [tempSelection]);

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    pushSnapshot({
      prompt,
      style,
      rotation: newRotation,
      scale,
      brightness,
      contrast,
      sharpen,
      resultImageUrl: history[historyIndex]?.resultImageUrl || null,
      analysis: history[historyIndex]?.analysis || null
    });
  };

  const applySharpenFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    const src = ctx.getImageData(0, 0, width, height);
    const sw = src.width;
    const sh = src.height;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data;
    const srcData = src.data;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const sy = y;
        const sx = x;
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;
            if (scy >= 0 && scy < sh && scx >= 0 && scx < sw) {
              const srcOff = (scy * sw + scx) * 4;
              const wt = weights[cy * side + cx];
              r += srcData[srcOff] * wt;
              g += srcData[srcOff + 1] * wt;
              b += srcData[srcOff + 2] * wt;
            }
          }
        }
        dst[dstOff] = r;
        dst[dstOff + 1] = g;
        dst[dstOff + 2] = b;
        dst[dstOff + 3] = srcData[dstOff + 3];
      }
    }
    ctx.putImageData(output, 0, 0);
  };

  const getProcessedImage = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!image) return resolve('');

      const img = new Image();
      img.onload = () => {
        const canvas = processingCanvasRef.current;
        if (!canvas) return resolve('');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('');

        const isHorizontal = rotation === 90 || rotation === 270;
        const width = isHorizontal ? img.height : img.width;
        const height = isHorizontal ? img.width : img.height;

        canvas.width = width * scale;
        canvas.height = height * scale;

        // Apply filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Reset filter for next operations if needed
        ctx.filter = 'none';

        // Custom sharpen filter (heavy operation, apply only at end)
        if (sharpen) {
          applySharpenFilter(ctx, canvas.width, canvas.height);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = image;
    });
  };

  // Get selection area description for the prompt
  const getAreaDescription = (): string => {
    if (bodyPart === 'custom' && selection) {
      return 'in the selected area';
    }
    switch (bodyPart) {
      case 'arm': return 'on the arm/hand area';
      case 'leg': return 'on the leg area';
      case 'back': return 'on the back area';
      case 'chest': return 'on the chest area';
      default: return '';
    }
  };

  const handleSimulate = async () => {
    if (!image || !prompt) return;

    if (!apiToken) {
      setShowTokenInput(true);
      return;
    }

    setIsProcessing(true);
    // Start tattoo machine buzzing sound
    startTattooSound();

    try {
      const bakedImage = await getProcessedImage();
      const areaDesc = getAreaDescription();
      const enhancedPrompt = areaDesc
        ? `${prompt} ${areaDesc}`
        : prompt;

      const data = await generateTattooMockup(bakedImage, enhancedPrompt, style, selection);

      // Stop the tattoo sound on success
      stopTattooSound();

      pushSnapshot({
        prompt,
        style,
        rotation,
        scale,
        brightness,
        contrast,
        sharpen,
        resultImageUrl: data.resultImageUrl,
        analysis: data.analysis
      });

      setTattooOpacity(100);

      const newSim: TattooSimulation = {
        id: Math.random().toString(36).substr(2, 9),
        originalImage: bakedImage,
        resultImage: data.resultImageUrl,
        prompt,
        style,
        boldnessRating: data.analysis.rating,
        analysis: data.analysis.feedback,
        timestamp: Date.now()
      };
      onSave(newSim);
    } catch (error) {
      // Stop the tattoo sound on error
      stopTattooSound();
      console.error("Simulation Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Check console for details";
      alert(`Simulation failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      // Ensure sound is stopped in finally block as well
      stopTattooSound();
    }
  };

  const currentSnapshot = history[historyIndex];
  const activeSelection = isSelecting ? tempSelection : selection;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 animate-fadeIn">
      <canvas ref={processingCanvasRef} className="hidden" />

      {/* API Token Setup Card */}
      {showTokenInput && (
        <div className="mb-6 p-4 md:p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-key text-amber-400 text-xl"></i>
            </div>
            <div className="flex-1 space-y-4 w-full">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Enter Your Replicate API Token</h3>
                <p className="text-zinc-400 text-sm">
                  Get your free API token from{' '}
                  <a
                    href="https://replicate.com/account/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    replicate.com
                  </a>
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="password"
                  value={tokenInputValue}
                  onChange={(e) => setTokenInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                  placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 bg-black/50 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                />
                <button
                  onClick={handleSaveToken}
                  disabled={!tokenInputValue.trim()}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
                >
                  Save
                </button>
              </div>

              <p className="text-zinc-500 text-xs flex items-center gap-2">
                <i className="fa-solid fa-lock"></i>
                Your token is stored locally in your browser and never sent to our servers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* API Token Status Bar (when token is saved) */}
      {apiToken && !showTokenInput && (
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-zinc-500">API Connected</span>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-600 font-mono">{apiToken.slice(0, 8)}...</span>
          </div>
          <button
            onClick={handleClearToken}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <i className="fa-solid fa-xmark"></i>
            <span className="hidden sm:inline">Clear Token</span>
            <span className="sm:hidden">Clear</span>
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-serif">1. The Canvas</h2>
              <div className="flex gap-2">
                {image && (
                  <>
                    <button
                      onClick={() => setShowEnhance(!showEnhance)}
                      className={`p-2 border rounded-md transition-colors ${showEnhance ? 'bg-white text-black border-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                      title="Image Preprocessing"
                    >
                      <i className="fa-solid fa-sliders"></i>
                    </button>
                    <button
                      onClick={handleRotate}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                      title="Rotate 90°"
                    >
                      <i className="fa-solid fa-rotate"></i>
                    </button>
                    <div className="h-8 w-px bg-zinc-800 mx-1"></div>
                  </>
                )}
                {history.length > 1 && (
                  <>
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                      title="Undo Action"
                    >
                      <i className="fa-solid fa-rotate-left"></i>
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className="p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                      title="Redo Action"
                    >
                      <i className="fa-solid fa-rotate-right"></i>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Preprocessing Tools */}
            {image && showEnhance && (
              <div className="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Preprocessing Tools</span>
                  <button onClick={() => {
                    setBrightness(100);
                    setContrast(100);
                    setSharpen(false);
                  }} className="text-[10px] text-zinc-600 hover:text-white uppercase font-bold">Reset</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </label>
                    <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                      <span>Contrast</span>
                      <span>{contrast}%</span>
                    </label>
                    <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${sharpen ? 'bg-white' : 'bg-zinc-800'}`}>
                    <input type="checkbox" checked={sharpen} onChange={(e) => setSharpen(e.target.checked)} className="sr-only" />
                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full transition-transform ${sharpen ? 'translate-x-5 bg-black' : 'bg-zinc-500'}`}></div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 group-hover:text-zinc-300">Detail Enhancement (Sharpen)</span>
                </label>
              </div>
            )}

            <div
              ref={imageContainerRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!image ? () => fileInputRef.current?.click() : undefined}
              onMouseDown={image && bodyPart === 'custom' ? handleSelectionStart : undefined}
              onMouseMove={image && bodyPart === 'custom' ? handleSelectionMove : undefined}
              onMouseUp={image && bodyPart === 'custom' ? handleSelectionEnd : undefined}
              onMouseLeave={image && bodyPart === 'custom' ? handleSelectionEnd : undefined}
              className={`relative border-2 border-dashed rounded-xl overflow-hidden group transition-all select-none
                ${image ? 'border-zinc-800' : 'h-64 flex flex-col items-center justify-center cursor-pointer'}
                ${isDragging ? 'border-white bg-white/5' : 'border-zinc-700 hover:border-zinc-500'}
                ${bodyPart === 'custom' && image ? 'cursor-crosshair' : ''}`}
            >
              {image ? (
                <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <img
                    src={image}
                    className="max-w-full max-h-full object-contain transition-transform duration-300 pointer-events-none"
                    style={{
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`
                    }}
                    alt="Canvas"
                  />

                  {/* Selection overlay */}
                  {activeSelection && (
                    <div
                      className="absolute border-2 border-amber-400 bg-amber-400/20 pointer-events-none"
                      style={{
                        left: `${Math.min(activeSelection.startX, activeSelection.endX)}%`,
                        top: `${Math.min(activeSelection.startY, activeSelection.endY)}%`,
                        width: `${Math.abs(activeSelection.endX - activeSelection.startX)}%`,
                        height: `${Math.abs(activeSelection.endY - activeSelection.startY)}%`
                      }}
                    >
                      <div className="absolute -top-6 left-0 text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded font-bold whitespace-nowrap">
                        Tattoo Area
                      </div>
                    </div>
                  )}

                  {/* Selection instruction */}
                  {bodyPart === 'custom' && !selection && !isSelecting && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                      <div className="bg-zinc-900/90 px-4 py-3 rounded-lg border border-zinc-700">
                        <p className="text-sm text-white flex items-center gap-2">
                          <i className="fa-solid fa-crop text-amber-400"></i>
                          Click and drag to select tattoo area
                        </p>
                      </div>
                    </div>
                  )}

                  <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    onClick={(e) => {
                      if (bodyPart !== 'custom') {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }
                    }}
                    style={{ pointerEvents: bodyPart === 'custom' ? 'none' : 'auto' }}
                  >
                    <span className="bg-white text-black px-4 py-2 rounded-full font-semibold text-sm">Replace Image</span>
                  </div>
                  <div className="absolute bottom-4 right-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const newScale = Math.max(0.5, scale - 0.1);
                        setScale(newScale);
                        pushSnapshot({ prompt, style, rotation, scale: newScale, brightness, contrast, sharpen, resultImageUrl: currentSnapshot?.resultImageUrl || null, analysis: currentSnapshot?.analysis || null });
                      }}
                      className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-black transition-colors"
                    >
                      <i className="fa-solid fa-minus text-xs"></i>
                    </button>
                    <button
                      onClick={() => {
                        const newScale = Math.min(3, scale + 0.1);
                        setScale(newScale);
                        pushSnapshot({ prompt, style, rotation, scale: newScale, brightness, contrast, sharpen, resultImageUrl: currentSnapshot?.resultImageUrl || null, analysis: currentSnapshot?.analysis || null });
                      }}
                      className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-black transition-colors"
                    >
                      <i className="fa-solid fa-plus text-xs"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 pointer-events-none">
                  <i className={`fa-solid ${isDragging ? 'fa-upload animate-bounce' : 'fa-camera'} text-3xl mb-3 text-zinc-500`}></i>
                  <p className="text-zinc-400 font-medium">Drag & Drop or Click to Upload</p>
                  <p className="text-zinc-600 text-sm mt-1">Arm, leg, chest or back photos work best</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>

            {/* Body Part Selector */}
            {image && (
              <div className="mt-4">
                <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2 font-bold">
                  Select Placement Area
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BODY_PARTS.map(part => (
                    <button
                      key={part.value}
                      onClick={() => setBodyPart(part.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tight border transition-all ${bodyPart === part.value
                        ? 'bg-amber-500 text-black border-amber-500'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                    >
                      <i className={`fa-solid ${part.icon}`}></i>
                      <span className="truncate">{part.name}</span>
                    </button>
                  ))}
                </div>

                {selection && bodyPart === 'custom' && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-amber-400 flex items-center gap-1">
                      <i className="fa-solid fa-check-circle"></i>
                      Area selected
                    </span>
                    <button
                      onClick={() => setSelection(null)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">2. The Vision</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2 font-bold">Concept</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A delicate black snake weaving through roses"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 focus:outline-none focus:border-white transition-colors h-24 text-sm"
                />
              </div>

              <div>
                <label className="block text-zinc-500 text-xs uppercase tracking-widest mb-2 font-bold">Style Preference</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STYLES.map(s => (
                    <button
                      key={s.name}
                      onClick={() => setStyle(s.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tight border transition-all ${style === s.name ? 'bg-white text-black border-white shadow-lg shadow-white/10' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'}`}
                    >
                      <i className={`fa-solid ${s.icon}`}></i>
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <button
            disabled={!image || !prompt || isProcessing || !apiToken}
            onClick={handleSimulate}
            className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                Generating Tattoo on Your Image...
              </>
            ) : !apiToken ? (
              <>Enter API Token Above <i className="fa-solid fa-arrow-up"></i></>
            ) : (
              <>Simulate Placement <i className="fa-solid fa-wand-sparkles"></i></>
            )}
          </button>
        </div>

        <div className="lg:sticky lg:top-24 h-fit">
          <h2 className="text-2xl font-serif mb-4">3. Preview</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-6 relative">

            {/* Loading Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn">
                <div className="relative mb-4">
                  <div className="w-16 h-16 border-4 border-zinc-800 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Inking in Progress...</h3>
                <p className="text-zinc-400 text-sm">Applying your distinct vision</p>
                <div className="mt-6 flex items-center gap-2 text-xs text-amber-500/80 font-mono">
                  <i className="fa-solid fa-bolt animate-pulse"></i>
                  <span>TATTOO MACHINE ACTIVE</span>
                </div>
              </div>
            )}

            {currentSnapshot?.resultImageUrl ? (
              <div className="w-full space-y-6 animate-fadeIn">
                <div className="relative group rounded-lg overflow-hidden border border-white/10 shadow-2xl aspect-square bg-zinc-950">
                  <img
                    src={image!}
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`
                    }}
                    alt="Base"
                  />
                  <img
                    src={currentSnapshot.resultImageUrl}
                    className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
                    style={{ opacity: tattooOpacity / 100 }}
                    alt="Result"
                  />

                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-zinc-400">Boldness</span>
                    <span className="text-lg font-bold text-white">{currentSnapshot.analysis?.rating}/10</span>
                  </div>
                  <div className="absolute bottom-4 left-4 text-[10px] text-zinc-400 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                    State {historyIndex + 1} of {history.length}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-white/5 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tattoo Opacity</label>
                      <span className="text-xs font-mono text-zinc-300">{tattooOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={tattooOpacity}
                      onChange={(e) => setTattooOpacity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 text-sm">
                      <i className="fa-solid fa-comment"></i>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-1">Artist Critique</h4>
                      <p className="text-zinc-300 text-sm leading-relaxed">{currentSnapshot.analysis?.feedback}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-emerald-900/10 border border-emerald-900/30 p-4 rounded-lg">
                      <h4 className="text-[10px] uppercase font-bold text-emerald-500 mb-2">Strengths</h4>
                      <ul className="text-xs text-emerald-100 space-y-1">
                        {currentSnapshot.analysis?.pros?.map((p: string, i: number) => <li key={i}>• {p}</li>)}
                      </ul>
                    </div>
                    <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded-lg">
                      <h4 className="text-[10px] uppercase font-bold text-amber-500 mb-2">Considerations</h4>
                      <ul className="text-xs text-amber-100 space-y-1">
                        {currentSnapshot.analysis?.cons?.map((p: string, i: number) => <li key={i}>• {p}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-600 space-y-4">
                <div className="w-24 h-24 border-2 border-dashed border-zinc-800 rounded-full mx-auto flex items-center justify-center">
                  <i className="fa-solid fa-eye-slash text-2xl"></i>
                </div>
                <p className="text-sm font-medium">Visualization will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulator;
