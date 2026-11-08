/**
 * MERIDIAN Audio Hub — Mobile-First Audio Engine & Interactive Dialogue Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Time Formatting Helper
  // --------------------------------------------------------------------------
  function formatTime(sec) {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  // --------------------------------------------------------------------------
  // 2. Track Segmented Tabs Management
  // --------------------------------------------------------------------------
  const tabButtons = document.querySelectorAll('.track-tab-btn');
  const trackPanels = document.querySelectorAll('.track-panel');
  let activeAudio = null;

  function switchTrack(trackId) {
    // Pause any playing audio
    if (activeAudio && !activeAudio.paused) {
      activeAudio.pause();
    }

    tabButtons.forEach(btn => {
      const isTarget = btn.dataset.trackId === trackId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    trackPanels.forEach(panel => {
      const isTarget = panel.id === `panel-${trackId}`;
      panel.classList.toggle('is-hidden', !isTarget);
      if (isTarget) {
        const audio = panel.querySelector('audio');
        if (audio) {
          activeAudio = audio;
          updateStickyDockInfo(panel);
        }
      }
    });

    // Update observer for sticky dock
    setupIntersectionObserver();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const trackId = btn.dataset.trackId;
      if (trackId) switchTrack(trackId);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Audio Player Components Setup (for each track panel)
  // --------------------------------------------------------------------------
  trackPanels.forEach(panel => {
    const audio = panel.querySelector('audio');
    if (!audio) return;

    if (!activeAudio && !panel.classList.contains('is-hidden')) {
      activeAudio = audio;
    }

    const playBtn = panel.querySelector('.btn-play-pause');
    const skipBackBtn = panel.querySelector('.btn-skip-backward');
    const skipFwdBtn = panel.querySelector('.btn-skip-forward');
    const scrubber = panel.querySelector('.scrubber-input');
    const curTimeSpan = panel.querySelector('.current-time');
    const durSpan = panel.querySelector('.duration-time');
    const speedBtns = panel.querySelectorAll('.speed-pill-btn');

    // Play / Pause toggle
    function togglePlay() {
      if (audio.paused) {
        // Pause all other audios
        document.querySelectorAll('audio').forEach(a => {
          if (a !== audio && !a.paused) {
            a.pause();
          }
        });
        activeAudio = audio;
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }

    if (playBtn) {
      playBtn.addEventListener('click', togglePlay);
    }

    // Skip controls (-5s / +5s)
    if (skipBackBtn) {
      skipBackBtn.addEventListener('click', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      });
    }

    if (skipFwdBtn) {
      skipFwdBtn.addEventListener('click', () => {
        audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + 5);
      });
    }

    // Audio lifecycle events
    audio.addEventListener('play', () => {
      activeAudio = audio;
      if (playBtn) playBtn.innerHTML = '⏸';
      syncDockState(true);
    });

    audio.addEventListener('pause', () => {
      if (playBtn) playBtn.innerHTML = '▶';
      syncDockState(false);
    });

    audio.addEventListener('ended', () => {
      if (playBtn) playBtn.innerHTML = '▶';
      if (scrubber) scrubber.value = 0;
      if (curTimeSpan) curTimeSpan.textContent = '00:00';
      syncDockState(false);
    });

    audio.addEventListener('loadedmetadata', () => {
      if (scrubber && audio.duration) {
        scrubber.max = Math.floor(audio.duration);
      }
      if (durSpan) {
        durSpan.textContent = formatTime(audio.duration);
      }
      syncDockProgress();
    });

    audio.addEventListener('timeupdate', () => {
      if (scrubber && !scrubber.dragging) {
        scrubber.value = Math.floor(audio.currentTime);
        if (curTimeSpan) curTimeSpan.textContent = formatTime(audio.currentTime);
      }
      syncDockProgress();
    });

    // Scrubber seeking
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        scrubber.dragging = true;
        if (curTimeSpan) curTimeSpan.textContent = formatTime(scrubber.value);
      });

      scrubber.addEventListener('change', () => {
        scrubber.dragging = false;
        audio.currentTime = parseFloat(scrubber.value);
      });
    }

    // Speed pills
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        audio.playbackRate = speed;
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });

  // --------------------------------------------------------------------------
  // 4. Sticky Floating Mobile Player Dock
  // --------------------------------------------------------------------------
  const stickyDock = document.getElementById('stickyPlayerDock');
  const dockKicker = document.getElementById('dockTrackKicker');
  const dockTitle = document.getElementById('dockTrackTitle');
  const dockFill = document.getElementById('dockProgressFill');
  const dockPlayBtn = document.getElementById('dockPlayBtn');
  const dockReplayBtn = document.getElementById('dockReplayBtn');
  const dockForwardBtn = document.getElementById('dockForwardBtn');
  const dockTime = document.getElementById('dockTime');

  function updateStickyDockInfo(panel) {
    if (!panel || !dockKicker || !dockTitle) return;
    const trackId = panel.querySelector('.player-track-id')?.textContent || '';
    const trackTitle = panel.querySelector('.player-track-title')?.textContent || '';
    dockKicker.textContent = trackId;
    dockTitle.textContent = trackTitle;
  }

  function syncDockState(isPlaying) {
    if (!dockPlayBtn) return;
    dockPlayBtn.innerHTML = isPlaying ? '⏸' : '▶';
  }

  function syncDockProgress() {
    if (!activeAudio || !dockFill) return;
    const cur = activeAudio.currentTime || 0;
    const dur = activeAudio.duration || 1;
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
    dockFill.style.width = pct + '%';
    if (dockTime) {
      dockTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
  }

  if (dockPlayBtn) {
    dockPlayBtn.addEventListener('click', () => {
      if (!activeAudio) return;
      if (activeAudio.paused) {
        activeAudio.play().catch(() => {});
      } else {
        activeAudio.pause();
      }
    });
  }

  if (dockReplayBtn) {
    dockReplayBtn.addEventListener('click', () => {
      if (!activeAudio) return;
      activeAudio.currentTime = Math.max(0, activeAudio.currentTime - 5);
    });
  }

  if (dockForwardBtn) {
    dockForwardBtn.addEventListener('click', () => {
      if (!activeAudio) return;
      activeAudio.currentTime = Math.min(activeAudio.duration || 9999, activeAudio.currentTime + 5);
    });
  }

  // IntersectionObserver to show dock when main player card is scrolled past
  let playerObserver = null;
  function setupIntersectionObserver() {
    if (!stickyDock) return;
    if (playerObserver) playerObserver.disconnect();

    const activePanel = document.querySelector('.track-panel:not(.is-hidden)');
    if (!activePanel) return;

    const playerCard = activePanel.querySelector('.player-card');
    if (!playerCard) return;

    updateStickyDockInfo(activePanel);

    playerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          // Scrolled past the player card down into dialogue
          stickyDock.classList.add('dock-visible');
        } else {
          // Player card is visible or above it
          stickyDock.classList.remove('dock-visible');
        }
      });
    }, { threshold: 0.1 });

    playerObserver.observe(playerCard);
  }

  setupIntersectionObserver();

  // --------------------------------------------------------------------------
  // 5. Dual-View Mode Switcher (Chat vs Dossier)
  // --------------------------------------------------------------------------
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      const panel = btn.closest('.track-panel');
      if (!panel) return;

      const viewBtns = panel.querySelectorAll('.view-btn');
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const chatView = panel.querySelector('.dialogue-view');
      const dossierView = panel.querySelector('.dossier-view');

      if (targetView === 'dossier') {
        if (chatView) chatView.classList.add('is-hidden');
        if (dossierView) dossierView.classList.add('is-active');
      } else {
        if (chatView) chatView.classList.remove('is-hidden');
        if (dossierView) dossierView.classList.remove('is-active');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Listening Gym Mode (Modo Treino Auditivo - Blur & Reveal)
  // --------------------------------------------------------------------------
  document.querySelectorAll('.btn-gym-toggle').forEach(gymBtn => {
    gymBtn.addEventListener('click', () => {
      const panel = gymBtn.closest('.track-panel');
      if (!panel) return;

      const isActive = gymBtn.classList.toggle('is-active');
      const tipBanner = panel.querySelector('.gym-tip-banner');
      const revealAllBtn = panel.querySelector('.btn-gym-reveal-all');
      const bubbles = panel.querySelectorAll('.bubble-text');

      if (tipBanner) tipBanner.classList.toggle('hidden', !isActive);
      if (revealAllBtn) {
        revealAllBtn.classList.toggle('hidden', !isActive);
        revealAllBtn.innerHTML = '👁️ Revelar Tudo';
        revealAllBtn.dataset.allRevealed = 'false';
      }

      bubbles.forEach(b => {
        if (isActive) {
          b.classList.add('is-blurred');
          b.classList.remove('is-revealed');
        } else {
          b.classList.remove('is-blurred');
          b.classList.remove('is-revealed');
        }
      });
    });
  });

  // Reveal all / Re-blur all button
  document.querySelectorAll('.btn-gym-reveal-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.track-panel');
      if (!panel) return;

      const bubbles = panel.querySelectorAll('.bubble-text');
      const isAllRevealed = btn.dataset.allRevealed === 'true';

      if (isAllRevealed) {
        bubbles.forEach(b => {
          b.classList.add('is-blurred');
          b.classList.remove('is-revealed');
        });
        btn.innerHTML = '👁️ Revelar Tudo';
        btn.dataset.allRevealed = 'false';
      } else {
        bubbles.forEach(b => {
          b.classList.remove('is-blurred');
          b.classList.add('is-revealed');
        });
        btn.innerHTML = '🕶️ Ocultar Tudo';
        btn.dataset.allRevealed = 'true';
      }
    });
  });

  // Tap individual turn card or blurred bubble to reveal & focus
  document.querySelectorAll('.turn-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const bubble = card.querySelector('.bubble-text');
      if (bubble && bubble.classList.contains('is-blurred')) {
        bubble.classList.remove('is-blurred');
        bubble.classList.add('is-revealed');
      }

      // Turn focus highlight
      const panel = card.closest('.track-panel');
      if (panel) {
        panel.querySelectorAll('.turn-card').forEach(c => c.classList.remove('turn-focused'));
        card.classList.add('turn-focused');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Portal (index.html) Level Filter & Instant Search
  // --------------------------------------------------------------------------
  const filterPills = document.querySelectorAll('.portal-filter-pill');
  const volumeCards = document.querySelectorAll('.volume-card');
  const searchInput = document.getElementById('portalSearchInput');

  function applyFilters() {
    const activePill = document.querySelector('.portal-filter-pill.active');
    const selectedLevel = activePill ? activePill.dataset.level : 'all';
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    volumeCards.forEach(card => {
      const cardLevel = card.dataset.level || '';
      const text = card.textContent.toLowerCase();

      const matchesLevel = (selectedLevel === 'all' || cardLevel === selectedLevel);
      const matchesSearch = (!query || text.includes(query));

      card.classList.toggle('is-filtered-out', !(matchesLevel && matchesSearch));
    });
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
});
