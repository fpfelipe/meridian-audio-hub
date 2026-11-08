// MERIDIAN Audio Hub — Mobile-First Audio Player Engine
document.addEventListener('DOMContentLoaded', () => {
  const players = document.querySelectorAll('.player-widget');

  players.forEach((widget) => {
    const audio = widget.querySelector('audio');
    const playBtn = widget.querySelector('.play-pause-btn');
    const scrubber = widget.querySelector('.scrubber-bar');
    const curTimeSpan = widget.querySelector('.current-time');
    const durSpan = widget.querySelector('.duration-time');
    const speedBtns = widget.querySelectorAll('.speed-btn');

    function formatTime(sec) {
      if (!sec || isNaN(sec)) return '00:00';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    // Play / Pause toggle
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        // Pause all other audios first
        document.querySelectorAll('audio').forEach(a => {
          if (a !== audio && !a.paused) {
            a.pause();
            const otherBtn = a.closest('.player-widget')?.querySelector('.play-pause-btn');
            if (otherBtn) otherBtn.textContent = '▶';
          }
        });
        audio.play();
        playBtn.textContent = '⏸';
      } else {
        audio.pause();
        playBtn.textContent = '▶';
      }
    });

    audio.addEventListener('play', () => { playBtn.textContent = '⏸'; });
    audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
    audio.addEventListener('ended', () => {
      playBtn.textContent = '▶';
      scrubber.value = 0;
      curTimeSpan.textContent = '00:00';
    });

    // Update duration
    audio.addEventListener('loadedmetadata', () => {
      scrubber.max = Math.floor(audio.duration);
      durSpan.textContent = formatTime(audio.duration);
    });

    // Update scrubber as it plays
    audio.addEventListener('timeupdate', () => {
      if (!scrubber.dragging) {
        scrubber.value = Math.floor(audio.currentTime);
        curTimeSpan.textContent = formatTime(audio.currentTime);
      }
    });

    // Seek via scrubber
    scrubber.addEventListener('input', () => {
      scrubber.dragging = true;
      curTimeSpan.textContent = formatTime(scrubber.value);
    });

    scrubber.addEventListener('change', () => {
      scrubber.dragging = false;
      audio.currentTime = scrubber.value;
    });

    // Speed controls
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        audio.playbackRate = speed;
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  // Transcript accordion toggle
  document.querySelectorAll('.transcript-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const body = document.getElementById(targetId);
      if (body) {
        body.classList.toggle('open');
        const isOpen = body.classList.contains('open');
        btn.textContent = isOpen ? '🙈 Ocultar Roteiro Textual' : '👁 Ver Roteiro Textual';
      }
    });
  });
});
