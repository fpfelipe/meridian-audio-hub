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
          syncDockState(false);
          syncDockProgress();
        }
      }
    });

    // Re-setup observer for sticky dock to watch new player card
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
      syncDockProgress();
    });

    audio.addEventListener('loadedmetadata', () => {
      if (scrubber && audio.duration && !isNaN(audio.duration)) {
        scrubber.max = Math.floor(audio.duration);
      }
      if (durSpan && audio.duration && !isNaN(audio.duration)) {
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

    // Scrubber seeking with robust mobile touch support
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        scrubber.dragging = true;
        if (curTimeSpan) curTimeSpan.textContent = formatTime(scrubber.value);
      });

      const finishScrub = () => {
        if (scrubber.dragging) {
          scrubber.dragging = false;
          audio.currentTime = parseFloat(scrubber.value);
          syncDockProgress();
        }
      };

      scrubber.addEventListener('change', finishScrub);
      scrubber.addEventListener('touchend', finishScrub);
      scrubber.addEventListener('mouseup', finishScrub);
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
  const dockProgressLine = document.querySelector('.dock-progress-line');
  const dockTrackInfo = document.querySelector('.dock-track-info');
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
    const dur = (activeAudio.duration && !isNaN(activeAudio.duration)) ? activeAudio.duration : 0;
    const pct = dur > 0 ? Math.min(100, Math.max(0, (cur / dur) * 100)) : 0;
    dockFill.style.width = pct + '%';
    if (dockTime) {
      dockTime.textContent = dur > 0
        ? `${formatTime(cur)} / ${formatTime(dur)}`
        : `${formatTime(cur)} / --:--`;
    }
  }

  // Interactive scrubbing on sticky dock's progress line
  function seekFromDock(e) {
    if (!activeAudio || !dockProgressLine) return;
    const rect = dockProgressLine.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = clickX / rect.width;
    const dur = activeAudio.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      activeAudio.currentTime = pct * dur;
      syncDockProgress();
    }
  }

  if (dockProgressLine) {
    dockProgressLine.addEventListener('click', seekFromDock);
    dockProgressLine.addEventListener('touchstart', (e) => {
      seekFromDock(e);
    }, { passive: true });
    dockProgressLine.addEventListener('touchmove', (e) => {
      seekFromDock(e);
    }, { passive: true });
  }

  // Tap track title in sticky dock to smoothly scroll back up to main player card
  if (dockTrackInfo) {
    dockTrackInfo.addEventListener('click', () => {
      const activePanel = document.querySelector('.track-panel:not(.is-hidden)');
      if (activePanel) {
        const playerCard = activePanel.querySelector('.player-card');
        if (playerCard) {
          playerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  if (dockPlayBtn) {
    dockPlayBtn.addEventListener('click', () => {
      if (!activeAudio) return;
      if (activeAudio.paused) {
        document.querySelectorAll('audio').forEach(a => {
          if (a !== activeAudio && !a.paused) a.pause();
        });
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
    card.addEventListener('click', () => {
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
  const searchClearBtn = document.getElementById('portalSearchClear');
  const portalCounter = document.getElementById('portalCounter');
  const portalEmptyState = document.getElementById('portalEmptyState');
  const volumesGrid = document.getElementById('volumesGrid');
  const btnClearSearch = document.getElementById('btnClearSearch');

  function applyFilters() {
    const activePill = document.querySelector('.portal-filter-pill.active');
    const selectedLevel = activePill ? activePill.dataset.level : 'all';
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (searchClearBtn) {
      searchClearBtn.style.display = query ? 'flex' : 'none';
    }

    let visibleCardsCount = 0;
    let visibleUnitsCount = 0;

    volumeCards.forEach(card => {
      const cardLevel = card.dataset.level || '';
      const searchData = (card.dataset.search || card.textContent || '').toLowerCase();

      const matchesLevel = (selectedLevel === 'all' || cardLevel === selectedLevel);
      const matchesSearch = (!query || searchData.includes(query));
      const isVisible = matchesLevel && matchesSearch;

      card.classList.toggle('is-filtered-out', !isVisible);

      if (isVisible) {
        visibleCardsCount++;
        // Count visible unit badges inside this volume card
        const unitLinks = card.querySelectorAll('.unit-links-grid a');
        if (query) {
          unitLinks.forEach(link => {
            const linkText = (link.dataset.unitText || link.title || '').toLowerCase();
            const linkMatched = linkText.includes(query) || link.textContent.toLowerCase().includes(query);
            link.style.opacity = linkMatched ? '1' : '0.4';
            link.style.transform = linkMatched ? 'scale(1.08)' : 'scale(1)';
            link.style.borderColor = linkMatched ? 'var(--cobalt)' : '';
            if (linkMatched) visibleUnitsCount++;
          });
        } else {
          unitLinks.forEach(link => {
            link.style.opacity = '1';
            link.style.transform = '';
            link.style.borderColor = '';
            visibleUnitsCount++;
          });
        }
      }
    });

    // Update Counter Text
    if (portalCounter) {
      if (visibleCardsCount === 0) {
        portalCounter.textContent = '0 lições encontradas';
      } else if (query) {
        portalCounter.textContent = `Encontradas ${visibleUnitsCount} lições em ${visibleCardsCount} volume(s) para "${query}"`;
      } else if (selectedLevel !== 'all') {
        const levelName = activePill ? activePill.textContent.trim() : selectedLevel.toUpperCase();
        portalCounter.textContent = `Exibindo ${visibleUnitsCount} lições em ${levelName}`;
      } else {
        portalCounter.textContent = 'Exibindo todas as 66 lições';
      }
    }

    // Toggle Empty State
    if (portalEmptyState && volumesGrid) {
      if (visibleCardsCount === 0) {
        portalEmptyState.style.display = 'block';
        volumesGrid.style.display = 'none';
      } else {
        portalEmptyState.style.display = 'none';
        volumesGrid.style.display = 'grid';
      }
    }
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

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      applyFilters();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      filterPills.forEach(p => p.classList.toggle('active', p.dataset.level === 'all'));
      applyFilters();
    });
  }
});


// ============================================================================
// 7. INTERACTIVE PILOT: KARAOKE, ROLEPLAY, TRANSLATION & SHADOWING RECORDER
// ============================================================================
(function initInteractivePilot() {
  const panels = document.querySelectorAll('.track-panel');

  panels.forEach(panel => {
    const audio = panel.querySelector('audio');
    if (!audio) return;

    const turnCards = panel.querySelectorAll('.turn-card[data-start]');
    const roleplayPills = panel.querySelectorAll('.roleplay-pill');
    let activeRole = 'none'; // 'none' or speaker name like 'MARK', 'CAMILA'
    let waitingForRoleplay = false;

    // Roleplay selection
    roleplayPills.forEach(pill => {
      pill.addEventListener('click', () => {
        roleplayPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeRole = pill.dataset.role || 'none';
        waitingForRoleplay = false;

        // Clear any previous roleplay prompts
        panel.querySelectorAll('.roleplay-prompt-banner').forEach(el => el.remove());
        panel.querySelectorAll('.turn-card').forEach(c => c.classList.remove('is-roleplay-waiting'));
      });
    });

    // Real-time Karaoke Sync & Roleplay Trigger on audio timeupdate
    audio.addEventListener('timeupdate', () => {
      const curTime = audio.currentTime;

      turnCards.forEach(card => {
        const start = parseFloat(card.dataset.start);
        const end = parseFloat(card.dataset.end);
        const speaker = (card.dataset.speaker || '').toUpperCase();
        const isCurrent = curTime >= start && curTime <= end;

        if (isCurrent) {
          if (!card.classList.contains('is-karaoke-active')) {
            turnCards.forEach(c => c.classList.remove('is-karaoke-active'));
            card.classList.add('is-karaoke-active');

            // Check if this turn is the user's roleplay character
            if (activeRole !== 'none' && speaker.startsWith(activeRole.toUpperCase()) && !waitingForRoleplay) {
              // Pause audio to let the user speak
              audio.pause();
              waitingForRoleplay = true;
              card.classList.add('is-roleplay-waiting');

              if (!card.querySelector('.roleplay-prompt-banner')) {
                const banner = document.createElement('div');
                banner.className = 'roleplay-prompt-banner';
                banner.innerHTML = `
                  <span>🗣️ <strong>Sua vez de falar!</strong> (${activeRole})</span>
                  <button type="button" class="btn-roleplay-continue">Já Falei! Continuar ▶</button>
                `;
                card.insertBefore(banner, card.querySelector('.bubble-text'));

                banner.querySelector('.btn-roleplay-continue').addEventListener('click', () => {
                  banner.remove();
                  card.classList.remove('is-roleplay-waiting');
                  waitingForRoleplay = false;
                  audio.currentTime = end + 0.1;
                  audio.play().catch(() => {});
                });
              }
            }
          }
        } else {
          if (curTime > end || curTime < start) {
            card.classList.remove('is-karaoke-active');
          }
        }
      });
    });

    // Play Individual Turn Button
    panel.querySelectorAll('.btn-bubble-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const start = parseFloat(btn.dataset.start);
        const end = parseFloat(btn.dataset.end);

        audio.currentTime = start;
        audio.play().catch(() => {});

        // Optional single-turn stop
        const checkTurnEnd = () => {
          if (audio.currentTime >= end) {
            audio.pause();
            audio.removeEventListener('timeupdate', checkTurnEnd);
          }
        };
        audio.addEventListener('timeupdate', checkTurnEnd);
      });
    });

    // Translation Toggle Button
    panel.querySelectorAll('.btn-bubble-pt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.turn-card');
        const transBox = card.querySelector('.turn-translation-box');
        if (transBox) {
          transBox.classList.toggle('hidden');
          btn.classList.toggle('active', !transBox.classList.contains('hidden'));
        }
      });
    });

    // Shadowing Voice Recording using Native MediaRecorder
    panel.querySelectorAll('.btn-bubble-rec').forEach(btn => {
      let mediaRecorder = null;
      let audioChunks = [];
      let isRecording = false;

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const turnId = btn.dataset.turnId;
        const feedbackBox = document.getElementById(`rec-box-${turnId}`);
        if (!feedbackBox) return;

        const statusRow = feedbackBox.querySelector('.rec-status-row');
        const playerRow = feedbackBox.querySelector('.rec-player-row');
        const userAudio = feedbackBox.querySelector('.user-recorded-audio');
        const stopBtn = feedbackBox.querySelector('.btn-stop-rec');

        if (!isRecording) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
              if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              const audioUrl = URL.createObjectURL(audioBlob);
              if (userAudio) userAudio.src = audioUrl;
              if (statusRow) statusRow.classList.add('hidden');
              if (playerRow) playerRow.classList.remove('hidden');
              btn.classList.remove('recording');
              btn.innerHTML = '<span class="btn-icon">🎙️</span> Regravar';
              isRecording = false;

              // Stop all mic tracks
              stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            feedbackBox.classList.remove('hidden');
            if (statusRow) statusRow.classList.remove('hidden');
            if (playerRow) playerRow.classList.add('hidden');
            btn.classList.add('recording');
            btn.innerHTML = '<span class="btn-icon">⏹</span> Gravando...';

            if (stopBtn) {
              stopBtn.onclick = () => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                  mediaRecorder.stop();
                }
              };
            }
          } catch (err) {
            alert('Permissão de microfone necessária para o modo shadowing.');
            console.error('Microphone error:', err);
          }
        } else {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }
      });
    });
  });
})();
