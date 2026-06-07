import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Play, Pause, FileText } from 'lucide-react';

export default function PdfPresenter({ fileUrl, fileName }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [libLoaded, setLibLoaded] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load PDF.js script dynamically from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setLibLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      setLibLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Load PDF document once library is ready
  useEffect(() => {
    if (!libLoaded) return;

    setLoading(true);
    const loadingTask = window.pdfjsLib.getDocument(fileUrl);
    loadingTask.promise.then(
      (loadedPdf) => {
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPageNumber(1);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading PDF document:', error);
        setLoading(false);
      }
    );
  }, [fileUrl, libLoaded]);

  // Render active page
  useEffect(() => {
    if (!pdf) return;

    pdf.getPage(pageNumber).then((page) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      
      // Calculate responsive scale based on container size
      const containerWidth = containerRef.current ? containerRef.current.clientWidth - 40 : 800;
      const containerHeight = containerRef.current ? containerRef.current.clientHeight - 80 : 500;
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      
      // Calculate width and height scale factors
      const scaleX = containerWidth / unscaledViewport.width;
      const scaleY = containerHeight / unscaledViewport.height;
      const scale = Math.min(scaleX, scaleY, 1.5); // Cap scale at 1.5 for quality
      
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      page.render(renderContext);
    });
  }, [pdf, pageNumber]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === ' ') {
        e.preventDefault();
        setSlideshowActive(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdf, pageNumber, totalPages]);

  // Autoplay Slideshow Timer
  useEffect(() => {
    let timer;
    if (slideshowActive && totalPages > 1) {
      timer = setInterval(() => {
        setPageNumber((prev) => (prev % totalPages) + 1);
      }, 4000); // 4 seconds per slide
    }
    return () => clearInterval(timer);
  }, [slideshowActive, totalPages]);

  const goToNextPage = () => {
    if (pageNumber < totalPages) {
      setPageNumber(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(prev => prev - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="pdf-presenter-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '60vh',
      background: 'rgba(5, 8, 15, 0.45)',
      borderRadius: 'var(--radius-sm)',
      position: 'relative',
      overflow: 'hidden',
      padding: '20px',
      border: '1px solid var(--border-color)'
    }}>
      {/* Top Overlay Slideshow Control Bar */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(10, 15, 30, 0.85)',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        padding: '6px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <button 
          onClick={goToPrevPage} 
          disabled={pageNumber <= 1}
          className="btn btn-icon"
          style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, cursor: 'pointer' }}
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', minWidth: '80px', textAlign: 'center' }}>
          Page {pageNumber} of {totalPages || '?'}
        </span>

        <button 
          onClick={goToNextPage} 
          disabled={pageNumber >= totalPages}
          className="btn btn-icon"
          style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, cursor: 'pointer' }}
          title="Next Page (Right Arrow)"
        >
          <ChevronRight size={16} />
        </button>

        <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }} />

        {/* Autoplay Play/Pause */}
        <button 
          onClick={() => setSlideshowActive(!slideshowActive)}
          className="btn"
          style={{ 
            width: '28px', 
            height: '28px', 
            borderRadius: '50%', 
            padding: 0,
            background: slideshowActive ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
            color: slideshowActive ? '#00f2fe' : 'var(--text-main)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={slideshowActive ? "Pause Autoplay" : "Start Autoplay (Space)"}
        >
          {slideshowActive ? <Pause size={14} fill="#00f2fe" style={{ border: 'none' }} /> : <Play size={14} fill="currentColor" style={{ border: 'none' }} />}
        </button>

        {/* Fullscreen */}
        <button 
          onClick={toggleFullscreen}
          className="btn btn-icon"
          style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, cursor: 'pointer' }}
          title="Fullscreen Mode"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Slide Canvas Wrapper */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '100%',
        overflow: 'auto',
        marginTop: '36px'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
            <span className="spin" style={{ display: 'inline-block' }}>
              <FileText size={32} />
            </span>
            <span style={{ fontSize: '13px' }}>Rendering PDF vector slides...</span>
          </div>
        ) : (
          <canvas 
            ref={canvasRef} 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
              borderRadius: '8px',
              backgroundColor: '#fff',
              transition: 'opacity 0.2s ease'
            }} 
          />
        )}
      </div>
    </div>
  );
}
