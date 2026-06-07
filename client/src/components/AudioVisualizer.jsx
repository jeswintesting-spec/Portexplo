import React, { useEffect, useRef, useState } from 'react';
import { Music, Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function AudioVisualizer({ fileUrl, fileName }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [vinylAngle, setVinylAngle] = useState(0);
  const vinylAngleRef = useRef(0);

  // Set up Web Audio API analyser on first play
  const ensureAudioContext = () => {
    if (audioCtxRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;
  };

  // Canvas waveform draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      const W = canvas.width;
      const H = canvas.height;

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Dark background
      ctx.fillStyle = 'rgba(5, 10, 22, 0.0)';
      ctx.fillRect(0, 0, W, H);

      if (!analyserRef.current || !isPlaying) {
        // Draw idle flat line + ambient glow
        drawIdleBars(ctx, W, H);
        return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      drawActiveBars(ctx, W, H, dataArray, bufferLength);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  function drawIdleBars(ctx, W, H) {
    const barCount = 64;
    const barWidth = (W / barCount) * 0.7;
    const gap = (W / barCount) * 0.3;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap);
      // Gentle sine wave idle animation
      const idleH = 3 + Math.sin(Date.now() / 800 + i * 0.3) * 3;
      const y = H / 2 - idleH / 2;

      const gradient = ctx.createLinearGradient(x, y, x, y + idleH);
      gradient.addColorStop(0, 'rgba(0, 200, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 80, 180, 0.1)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, idleH, 2);
      ctx.fill();
    }
  }

  function drawActiveBars(ctx, W, H, dataArray, bufferLength) {
    const barCount = Math.min(bufferLength, 80);
    const barWidth = (W / barCount) * 0.75;
    const gap = (W / barCount) * 0.25;

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i];
      const barH = Math.max(3, (value / 255) * (H * 0.9));
      const x = i * (barWidth + gap);
      const y = H - barH;

      // Colour: cyan for high-intensity, indigo for low
      const intensity = value / 255;
      const r = Math.round(0 + intensity * 60);
      const g = Math.round(180 + intensity * 62);
      const b = Math.round(255);
      const alpha = 0.6 + intensity * 0.4;

      const gradient = ctx.createLinearGradient(x, y, x, H);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(0, 100, 220, 0.6)`);
      gradient.addColorStop(1, `rgba(0, 40, 120, 0.2)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
      ctx.fill();

      // Glow on tall bars
      if (barH > H * 0.5) {
        ctx.shadowColor = `rgba(0, 220, 255, 0.5)`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
        ctx.fillRect(x, y, barWidth, barH);
        ctx.shadowBlur = 0;
      }
    }

    // Mirror (reflection) below center
    ctx.save();
    ctx.scale(1, -0.3);
    ctx.translate(0, -H * (1 / 0.3) - H);
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i];
      const barH = Math.max(3, (value / 255) * (H * 0.9));
      const x = i * (barWidth + gap);
      const y = H - barH;
      const gradient = ctx.createLinearGradient(x, y, x, H);
      gradient.addColorStop(0, 'rgba(0, 200, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1.0;
  }

  // Vinyl spin animation
  useEffect(() => {
    if (!isPlaying) return;
    const spin = setInterval(() => {
      vinylAngleRef.current = (vinylAngleRef.current + 1.2) % 360;
      setVinylAngle(vinylAngleRef.current);
    }, 16);
    return () => clearInterval(spin);
  }, [isPlaying]);

  // Time tracking
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handlePlayPause = () => {
    ensureAudioContext();
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioRef.current.volume = val;
    setIsMuted(val === 0);
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audioRef.current.muted = newMuted;
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      padding: '8px 0 0',
      gap: '0',
      userSelect: 'none',
    }}>
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={fileUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      {/* Vinyl Disc + Waveform Canvas Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px', width: '100%', padding: '0 24px' }}>

        {/* Vinyl disc */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          flexShrink: 0,
        }}>
          {/* Outer ring */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(#0d1a2e 0deg, #1a2f50 45deg, #0d1a2e 90deg, #172540 135deg, #0d1a2e 180deg, #1a2f50 225deg, #0d1a2e 270deg, #172540 315deg, #0d1a2e 360deg)`,
            transform: `rotate(${vinylAngle}deg)`,
            boxShadow: isPlaying
              ? '0 0 30px rgba(0, 200, 255, 0.35), 0 0 60px rgba(0, 100, 220, 0.15)'
              : '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'box-shadow 0.4s ease',
          }} />
          {/* Groove rings */}
          {[38, 46, 54].map(r => (
            <div key={r} style={{
              position: 'absolute',
              inset: `${r}px`,
              borderRadius: '50%',
              border: '1px solid rgba(0, 200, 255, 0.06)',
              pointerEvents: 'none',
              transform: `rotate(${vinylAngle}deg)`,
            }} />
          ))}
          {/* Centre label */}
          <div style={{
            position: 'absolute',
            inset: '34px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #0a1628 0%, #071020 100%)',
            border: '1px solid rgba(0, 200, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Music size={18} style={{ color: isPlaying ? '#00c8ff' : 'rgba(100,150,200,0.5)' }} />
          </div>
          {/* Needle arm */}
          <div style={{
            position: 'absolute',
            top: '-4px',
            right: '-2px',
            width: '2px',
            height: '44px',
            background: 'linear-gradient(to bottom, rgba(0,200,255,0.8), rgba(0,100,180,0.2))',
            transformOrigin: '50% 0%',
            transform: `rotate(${isPlaying ? '28deg' : '18deg'})`,
            transition: 'transform 0.5s ease',
            borderRadius: '2px',
          }} />
        </div>

        {/* Waveform Canvas */}
        <canvas
          ref={canvasRef}
          width={500}
          height={120}
          style={{
            flex: 1,
            height: '120px',
            borderRadius: '12px',
            background: 'rgba(0, 10, 25, 0.4)',
            border: '1px solid rgba(0, 200, 255, 0.08)',
          }}
        />
      </div>

      {/* Controls Row */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        padding: '16px 24px 4px',
        gap: '12px',
      }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '36px', textAlign: 'right', fontFamily: 'monospace' }}>
            {formatTime(currentTime)}
          </span>
          <div style={{ flex: 1, position: 'relative', height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, #00a8ff, #00f2fe)',
              borderRadius: '4px',
              transition: 'width 0.1s linear',
              boxShadow: '0 0 8px rgba(0, 200, 255, 0.4)',
            }} />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              style={{
                position: 'absolute', inset: 0, width: '100%',
                opacity: 0, cursor: 'pointer', height: '100%', margin: 0,
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '36px', fontFamily: 'monospace' }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom: Play button + Volume */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            style={{
              width: '44px', height: '44px',
              borderRadius: '50%',
              background: isPlaying
                ? 'linear-gradient(135deg, #0066cc, #00c6ff)'
                : 'rgba(255,255,255,0.08)',
              border: `1px solid ${isPlaying ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isPlaying ? '0 0 20px rgba(0, 198, 255, 0.3)' : 'none',
              transition: 'all 0.25s ease',
              color: 'white',
            }}
          >
            {isPlaying
              ? <Pause size={16} fill="white" style={{ border: 'none' }} />
              : <Play size={16} fill="white" style={{ border: 'none', marginLeft: '2px' }} />
            }
          </button>

          {/* Volume control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleMuteToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              {isMuted || volume === 0
                ? <VolumeX size={15} />
                : <Volume2 size={15} />
              }
            </button>
            <div style={{ position: 'relative', width: '80px', height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${(isMuted ? 0 : volume) * 100}%`,
                background: 'rgba(0, 200, 255, 0.5)',
                borderRadius: '4px',
              }} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
