import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Simulator from './components/Simulator';
import { AppView, TattooSimulation } from './types';

// Celebrity and tattoo inspiration images - extensive collection
const GALLERY_IMAGES = [
  // Celebrity tattoos
  'https://i.pinimg.com/736x/a2/60/c8/a260c8607c703edda21e712b9be14e1a.jpg',
  'https://www.instyle.com/thmb/ttWjs5eo-rjITFvQ5dtBnqOBh60=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-136926216-f94171e274bd4c6b92785e23692635ae.jpg',
  'https://www.instyle.com/thmb/XOsvPxKlYpo62JueUvHIAQGDTmI=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-1399971748-3b4835ac392a40e0b33a41bc9d5d6190.jpg',
  'https://www.instyle.com/thmb/Ee8jCbe6-mWIE5dn5VsMm2eAKLI=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-634979854-07a2e5f7b1ab40638ca4bade474f49da.jpg',
  'https://www.instyle.com/thmb/SbOQGUVPtaYmzv8YG0pcZ1Ba2a8=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/84849682_188708915710689_9108558114338795144_n-eeabeb7012aa4f3f9640be889d18ee0c.jpg',
  'https://www.instyle.com/thmb/9LYO6KH3NujsjM21qy8DFXRKEe4=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-519018016-18f05968ca96467398a0d35d0fca99d8.jpg',
  'https://www.instyle.com/thmb/M3ipqzi4lFi7Ld38fjmvIIcRG-0=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-960832768-1cbfd7338071440c9a6834c1d21667d2.jpg',
  'https://www.instyle.com/thmb/9W-Cedhg3jQ0NX-nmpK7syyzOmk=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-680137220-53f1821424b446108c57274a0f4ade08.jpg',
  'https://www.instyle.com/thmb/8fIjAIJEOLOYhkOT6kWhnS5HUqM=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-920204568-55ba2ee46d7f469680f15ccc86c76337.jpg',
  'https://www.instyle.com/thmb/PoPXkJmKcDr7_zNKH2oekfYxg7A=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-1138777533-3e303bba6fe347089e7f08cbe1bb53b2.jpg',
  'https://www.instyle.com/thmb/KxPz1rceEJvzgV8kBGIPAviPNkw=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/GettyImages-1199324028-ebba7de88fde4f5fbcb7ee2bd4a2a622.jpg',
  'https://static.wixstatic.com/media/755078_57feda1b85874306bbb54851dff06528~mv2.jpg/v1/fill/w_480,h_720,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/755078_57feda1b85874306bbb54851dff06528~mv2.jpg',

];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [sims, setSims] = useState<TattooSimulation[]>([]);

  // LocalStorage Persistence
  useEffect(() => {
    const savedSims = localStorage.getItem('inksight_sims');
    if (savedSims) setSims(JSON.parse(savedSims));
  }, []);

  useEffect(() => {
    localStorage.setItem('inksight_sims', JSON.stringify(sims));
  }, [sims]);

  const handleAddSim = (sim: TattooSimulation) => setSims(prev => [sim, ...prev]);

  const renderContent = () => {
    switch (view) {
      case AppView.SIMULATOR:
        return <Simulator onSave={handleAddSim} />;

      case AppView.GALLERY:
        return (
          <div className="max-w-6xl mx-auto p-6 space-y-12">
            <h1 className="text-4xl font-serif">Your Ink Archive</h1>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Visualizations
              </h2>
              {sims.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-600">
                  No simulations saved yet. Start by designing your vision.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {sims.map(sim => (
                    <div key={sim.id} className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-white/5 cursor-pointer">
                      <img src={sim.resultImage} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={sim.prompt} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-3 transition-opacity">
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.href = sim.resultImage;
                              link.download = `ink-sight-${sim.id}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="bg-zinc-800 hover:bg-white hover:text-black text-white p-2 rounded-full transition-colors"
                            title="Save to Device"
                          >
                            <i className="fa-solid fa-download"></i>
                          </button>
                        </div>
                        <span className="text-[10px] font-bold uppercase text-white/60 mb-1">{sim.style}</span>
                        <p className="text-xs text-white line-clamp-2">{sim.prompt}</p>
                        <div className="mt-2 text-xs font-bold text-white flex items-center gap-1">
                          <i className="fa-solid fa-star text-amber-400"></i> {sim.boldnessRating}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      case AppView.LANDING:
      default:
        return (
          <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-zinc-800/20 rounded-full blur-[120px] -z-10"></div>
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-zinc-700/10 rounded-full blur-[120px] -z-10"></div>

            <div className="max-w-4xl w-full text-center space-y-8 animate-fadeIn">
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">Evolution of Tattooing</span>
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif tracking-tighter leading-none">
                  Ink Before <br />
                  <span className="text-zinc-600 italic">the Needle</span>
                </h1>
                <p className="text-base md:text-xl text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed px-4">
                  The first AI-powered advisor for tattoo enthusiasts and artists. Visualize placements and calculate vibe ratings with precision.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => setView(AppView.SIMULATOR)}
                  className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
                >
                  Start Simulation
                </button>
              </div>

              {/* Fast Auto-scrolling Celebrity Tattoo Gallery */}
              <div className="mt-12 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10"></div>
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10"></div>

                <div className="flex gap-3 animate-scroll-fast">
                  {/* First set of images */}
                  {GALLERY_IMAGES.map((img, index) => (
                    <div
                      key={`first-${index}`}
                      className="flex-shrink-0 w-40 h-56 rounded-xl overflow-hidden border border-white/10 shadow-lg"
                    >
                      <img
                        src={img}
                        alt={`Celebrity tattoo ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                  {/* Duplicate set for seamless loop */}
                  {GALLERY_IMAGES.map((img, index) => (
                    <div
                      key={`second-${index}`}
                      className="flex-shrink-0 w-40 h-56 rounded-xl overflow-hidden border border-white/10 shadow-lg"
                    >
                      <img
                        src={img}
                        alt={`Celebrity tattoo ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-12 border-t border-white/5 max-w-xl mx-auto">
                <div className="text-center">
                  <div className="text-2xl font-serif mb-1">99%</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-serif mb-1">08+</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Styles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-serif mb-1">∞</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Possibilities</div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout activeView={view} onNavigate={setView}>
      {renderContent()}
    </Layout>
  );
};

export default App;
