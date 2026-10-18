/**
 * TRANSITPULSE - FIELD BUS SURVEY APPLICATION
 * Utilitarian, mobile-first, high contrast, immediate localStorage sync, offline resilient
 */

(function () {
  'use strict';

  // LOCAL STORAGE KEYS
  const STORAGE_KEYS = {
    RECORDER_NAME: 'survey_recorder_name',
    ACTIVE_CARDS: 'active_bus_cards',
    OFFLINE_QUEUE: 'offline_survey_queue',
    THEME: 'survey_theme',
    RECORDER_LOCATION: 'survey_recorder_location'
  };

  // MAXIMUM ALLOWED CONCURRENT BUS CARDS
  const MAX_ACTIVE_CARDS = 4;

  // APPLICATION STATE
  const state = {
    recorderName: '',
    activeCards: [], // Max 4 cards
    offlineQueue: [],
    theme: 'sunlight',
    isOnline: navigator.onLine,
    pendingSubmitCardId: null,
    recorderLocation: ''
  };

  // DOM ELEMENTS CACHE
  const DOM = {};

  function initDomElements() {
    DOM.displayRecorderName = document.getElementById('displayRecorderName');
    DOM.displayRecorderLocation = document.getElementById('displayRecorderLocation');
    DOM.activeCardsContainer = document.getElementById('activeCardsContainer');
    DOM.emptyWorkspace = document.getElementById('emptyWorkspace');
    DOM.btnAddBus = document.getElementById('btnAddBus');
    DOM.btnAddBusLabel = document.getElementById('btnAddBusLabel');
    DOM.btnEmptyAddBus = document.getElementById('btnEmptyAddBus');
    DOM.btnResetRecorder = document.getElementById('btnResetRecorder');
    DOM.slotCountText = document.getElementById('slotCountText');
    DOM.slotDots = [
      document.getElementById('slotDot1'),
      document.getElementById('slotDot2'),
      document.getElementById('slotDot3'),
      document.getElementById('slotDot4')
    ];

    // Recorder Modal
    DOM.recorderModal = document.getElementById('recorderModal');
    DOM.recorderForm = document.getElementById('recorderForm');
    DOM.recorderNameInput = document.getElementById('recorderNameInput');
    DOM.recorderLocationInput = document.getElementById('recorderLocationInput');

    // Bus Modal
    DOM.busModal = document.getElementById('busModal');
    DOM.busModalTitle = document.getElementById('busModalTitle');
    DOM.busModalAccentBar = document.getElementById('busModalAccentBar');
    DOM.modalSlotIndicator = document.getElementById('modalSlotIndicator');
    DOM.busForm = document.getElementById('busForm');
    DOM.editCardId = document.getElementById('editCardId');
    DOM.cardSlotNumber = document.getElementById('cardSlotNumber');
    DOM.inputRouteNo = document.getElementById('inputRouteNo');
    DOM.inputVehicleNo = document.getElementById('inputVehicleNo');
    DOM.inputRouteText = document.getElementById('inputRouteText');
    DOM.inputLocation = document.getElementById('inputLocation');
    DOM.inputArrivalTime = document.getElementById('inputArrivalTime');
    DOM.inputDepartureTime = document.getElementById('inputDepartureTime');
    DOM.btnCloseBusModal = document.getElementById('btnCloseBusModal');
    DOM.btnCancelBusModal = document.getElementById('btnCancelBusModal');
    DOM.btnDeleteBusCard = document.getElementById('btnDeleteBusCard');

    // Reset Recorder Dialog
    DOM.confirmResetModal = document.getElementById('confirmResetModal');
    DOM.btnCancelResetRecorder = document.getElementById('btnCancelResetRecorder');
    DOM.btnConfirmResetRecorder = document.getElementById('btnConfirmResetRecorder');

    // Submit Bus Record Dialog
    DOM.confirmSubmitModal = document.getElementById('confirmSubmitModal');
    DOM.submitModalSummary = document.getElementById('submitModalSummary');
    DOM.btnCancelSubmitRecord = document.getElementById('btnCancelSubmitRecord');
    DOM.btnConfirmSubmitRecord = document.getElementById('btnConfirmSubmitRecord');

    // History Modal
    DOM.historyModal = document.getElementById('historyModal');
    DOM.btnOpenHistory = document.getElementById('btnOpenHistory');
    DOM.btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
    DOM.btnRefreshHistory = document.getElementById('btnRefreshHistory');
    DOM.historyTableBody = document.getElementById('historyTableBody');
    DOM.statTotalBuses = document.getElementById('statTotalBuses');

    DOM.statTotalNet = document.getElementById('statTotalNet');

    // Network & Theme
    DOM.networkDot = document.getElementById('networkDot');
    DOM.networkLabel = document.getElementById('networkLabel');
    DOM.networkStatusBtn = document.getElementById('networkStatusBtn');
    DOM.offlineQueueBadge = document.getElementById('offlineQueueBadge');
    DOM.offlineBanner = document.getElementById('offlineBanner');
    DOM.offlineBannerText = document.getElementById('offlineBannerText');
    DOM.btnManualSync = document.getElementById('btnManualSync');
    DOM.menuContainer = document.getElementById('menuContainer');
    DOM.btnToggleMenu = document.getElementById('btnToggleMenu');
    DOM.menuDropdown = document.getElementById('menuDropdown');
    DOM.toastContainer = document.getElementById('toastContainer');
  }

  // =========================================================================
  // HELPER UTILITIES
  // =========================================================================

  function formatCurrentTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  function formatCurrentDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Find lowest available slot number (1, 2, 3, or 4)
  function getNextAvailableSlot() {
    const occupiedSlots = new Set(state.activeCards.map(c => Number(c.slot)));
    for (let slot = 1; slot <= MAX_ACTIVE_CARDS; slot++) {
      if (!occupiedSlots.has(slot)) {
        return slot;
      }
    }
    return null;
  }

  // =========================================================================
  // PERSISTENCE (localStorage)
  // =========================================================================

  function saveActiveCardsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CARDS, JSON.stringify(state.activeCards));
    } catch (e) {
      console.error('Failed to sync active cards to localStorage:', e);
    }
  }

  function loadActiveCardsFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_CARDS);
      if (data) {
        state.activeCards = JSON.parse(data) || [];
      }
    } catch (e) {
      console.error('Failed to load active cards from localStorage:', e);
      state.activeCards = [];
    }
  }

  function saveRecorderNameToStorage(name) {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDER_NAME, name);
      state.recorderName = name;
    } catch (e) {
      console.error('Failed to save recorder name:', e);
    }
  }

  function loadRecorderNameFromStorage() {
    try {
      return localStorage.getItem(STORAGE_KEYS.RECORDER_NAME) || '';
    } catch (e) {
      return '';
    }
  }

  function saveOfflineQueueToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(state.offlineQueue));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  function loadOfflineQueueFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (data) {
        state.offlineQueue = JSON.parse(data) || [];
      }
    } catch (e) {
      state.offlineQueue = [];
    }
  }

  // =========================================================================
  // RECORDER SESSION MANAGEMENT
  // =========================================================================

  function checkRecorderSession() {
    const savedName = loadRecorderNameFromStorage();
    const savedLocation = loadRecorderLocationFromStorage();
    if (!savedName || !savedLocation) {
      openRecorderModal();
    } else {
      state.recorderName = savedName.trim();
      state.recorderLocation = savedLocation.trim();
      updateRecorderDisplay();
      closeRecorderModal();
    }
  }

  function openRecorderModal() {
    DOM.recorderModal.style.display = 'flex';
    DOM.recorderNameInput.value = state.recorderName || '';
    DOM.recorderLocationInput.value = state.recorderLocation || '';
    setTimeout(() => DOM.recorderNameInput.focus(), 100);
  }

  function loadRecorderLocationFromStorage() {
    try { return localStorage.getItem(STORAGE_KEYS.RECORDER_LOCATION) || ''; } catch (e) { return ''; }
  }

  function closeRecorderModal() {
    DOM.recorderModal.style.display = 'none';
  }

  function confirmRecorderName() {
    const inputVal = DOM.recorderNameInput.value.trim();
    const locationVal = DOM.recorderLocationInput.value.trim();
    if (!inputVal) { DOM.recorderNameInput.focus(); return; }
    if (!locationVal) { DOM.recorderLocationInput.focus(); return; }
    saveRecorderNameToStorage(inputVal);
    localStorage.setItem(STORAGE_KEYS.RECORDER_LOCATION, locationVal);
    state.recorderLocation = locationVal;
    updateRecorderDisplay();
    closeRecorderModal();
    showToast(`Welcome, Surveyor ${inputVal}!`, 'success');
  }

  function updateRecorderDisplay() {
    if (DOM.displayRecorderName) {
      DOM.displayRecorderName.textContent = state.recorderName || '---';
      DOM.displayRecorderLocation.textContent = state.recorderLocation ? `· ${state.recorderLocation}` : '';
    }
  }

  function promptResetRecorder() {
    DOM.confirmResetModal.style.display = 'flex';
  }

  function executeResetRecorder() {
    localStorage.removeItem(STORAGE_KEYS.RECORDER_NAME);
    localStorage.removeItem(STORAGE_KEYS.RECORDER_LOCATION);
    state.recorderName = '';
    state.recorderLocation = '';
    updateRecorderDisplay();
    DOM.confirmResetModal.style.display = 'none';
    openRecorderModal();
    showToast('Recorder session cleared.', 'warning');
  }

  // =========================================================================
  // =========================================================================
  // BUS CREATION & EDIT MODAL
  // =========================================================================

  function openAddBusModal() {
    if (state.activeCards.length >= MAX_ACTIVE_CARDS) {
      showToast('Maximum 4 buses can be tracked concurrently.', 'warning');
      return;
    }

    const availableSlot = getNextAvailableSlot();
    if (!availableSlot) {
      showToast('No free card slots available.', 'warning');
      return;
    }

    // Reset Form
    DOM.busForm.reset();
    DOM.editCardId.value = '';
    DOM.cardSlotNumber.value = String(availableSlot);
    DOM.busModalTitle.textContent = 'Add Bus';
    DOM.modalSlotIndicator.textContent = `SLOT ${availableSlot}`;

    // Set slot theme color on modal header
    const slotColors = ['#1d4ed8', '#047857', '#d97706', '#7c3aed'];
    DOM.modalSlotIndicator.style.backgroundColor = slotColors[availableSlot - 1];
    DOM.modalSlotIndicator.style.color = '#ffffff';

    // Set Defaults
    setRadioValue('ownership_type', 'Private');
    setRadioValue('service_type', 'Normal');
    setRadioValue('seat_capacity_slot', 'Below 20');

    // Auto-fill arrival time
    DOM.inputArrivalTime.value = formatCurrentTime();
    DOM.inputDepartureTime.value = ''; // left blank during creation

    DOM.inputLocation.value = state.recorderLocation || '';
    DOM.inputLocation.readOnly = true;
    DOM.btnDeleteBusCard.style.display = 'none';
    DOM.busModal.style.display = 'flex';
    setTimeout(() => DOM.inputRouteNo.focus(), 150);
  }

  function openEditBusModal(cardId) {
    const card = state.activeCards.find(c => c.id === cardId);
    if (!card) return;

    DOM.editCardId.value = card.id;
    DOM.cardSlotNumber.value = String(card.slot);
    DOM.busModalTitle.textContent = `Edit (Slot ${card.slot})`;
    DOM.modalSlotIndicator.textContent = `SLOT ${card.slot}`;

    const slotColors = ['#1d4ed8', '#047857', '#d97706', '#7c3aed'];
    DOM.modalSlotIndicator.style.backgroundColor = slotColors[card.slot - 1];

    DOM.inputRouteNo.value = card.route_no || '';
    DOM.inputVehicleNo.value = card.vehicle_no || '';
    DOM.inputRouteText.value = card.route_text || '';
    setRadioValue('ownership_type', card.ownership_type || 'Private');
    setRadioValue('service_type', card.service_type || 'Normal');
    setRadioValue('seat_capacity_slot', card.seat_capacity_slot || 'Below 20');
    DOM.inputLocation.value = card.location || state.recorderLocation || '';
    DOM.inputLocation.readOnly = true;
    DOM.inputArrivalTime.value = card.arrival_time || formatCurrentTime();
    DOM.inputDepartureTime.value = card.departure_time || '';
    DOM.btnDeleteBusCard.style.display = 'block';

    DOM.busModal.style.display = 'flex';
    setTimeout(() => DOM.inputRouteNo.focus(), 150);
  }

  function closeBusModal() {
    DOM.busModal.style.display = 'none';
  }

  function deleteEditingCard() {
    const cardId = DOM.editCardId.value;
    const card = state.activeCards.find(c => c.id === cardId);
    if (!card || !window.confirm(`Delete Route ${card.route_no} from Slot ${card.slot}?`)) return;
    state.activeCards = state.activeCards.filter(c => c.id !== cardId);
    saveActiveCardsToStorage();
    renderCards();
    updateHeaderState();
    closeBusModal();
    showToast('Card deleted.', 'warning');
  }

  function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : '';
  }

  function setRadioValue(name, val) {
    const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  function saveBusCard(e) {
    e.preventDefault();

    const routeNo = DOM.inputRouteNo.value.trim();
    const vehicleNo = DOM.inputVehicleNo.value.trim().toUpperCase();
    const routeText = DOM.inputRouteText.value.trim();
    const ownershipType = getRadioValue('ownership_type');
    const serviceType = getRadioValue('service_type');
    const seatCapacitySlot = getRadioValue('seat_capacity_slot');
    const location = DOM.inputLocation.value.trim() || 'Terminal Bus Bay';
    const arrivalTime = DOM.inputArrivalTime.value.trim() || formatCurrentTime();
    const departureTime = DOM.inputDepartureTime.value.trim();
    const editId = DOM.editCardId.value;
    const slotNumber = parseInt(DOM.cardSlotNumber.value, 10) || 1;

    if (!routeNo) {
      showToast('Please enter a Route Number', 'warning');
      DOM.inputRouteNo.focus();
      return;
    }
    if (!vehicleNo) {
      showToast('Please enter a Vehicle Number', 'warning');
      DOM.inputVehicleNo.focus();
      return;
    }
    if (!routeText) {
      showToast('Please enter Route Details', 'warning');
      DOM.inputRouteText.focus();
      return;
    }

    if (editId) {
      // Editing existing card
      const index = state.activeCards.findIndex(c => c.id === editId);
      if (index !== -1) {
        state.activeCards[index] = {
          ...state.activeCards[index],
          route_no: routeNo,
          vehicle_no: vehicleNo,
          route_text: routeText,
          ownership_type: ownershipType,
          service_type: serviceType,
          seat_capacity_slot: seatCapacitySlot,
          location: location,
          arrival_time: arrivalTime,
          departure_time: departureTime
        };
        showToast(`Route ${routeNo} updated.`, 'info');
      }
    } else {
      // Adding new card
      if (state.activeCards.length >= MAX_ACTIVE_CARDS) {
        showToast('Maximum 4 buses can be tracked concurrently.', 'warning');
        return;
      }

      const newCard = {
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        slot: slotNumber,
        route_no: routeNo,
        vehicle_no: vehicleNo,
        route_text: routeText,
        ownership_type: ownershipType,
        service_type: serviceType,
        seat_capacity_slot: seatCapacitySlot,
        location: location,
        arrival_time: arrivalTime,
        departure_time: departureTime,
        net_sum: 0,
        created_at: Date.now()
      };

      state.activeCards.push(newCard);
      showToast(`Bus ${routeNo} (${vehicleNo}) added to Slot ${slotNumber}.`, 'success');
    }

    // Immediately persist to localStorage
    saveActiveCardsToStorage();
    renderCards();
    updateHeaderState();
    closeBusModal();
  }

  // =========================================================================
  // PASSENGER COUNTERS & CARD ACTIONS
  // =========================================================================

  function adjustPassengerCount(cardId, delta) {
    const card = state.activeCards.find(c => c.id === cardId);
    if (!card) return;

    // Haptic vibration feedback for mobile surveyors
    if (navigator.vibrate) {
      try {
        navigator.vibrate(delta > 0 ? 30 : [20, 20]);
      } catch (e) {
        // Ignore devices where vibrate is restricted
      }
    }

    card.net_sum = (card.net_sum || 0) + delta;

    // Immediate sync to localStorage
    saveActiveCardsToStorage();

    // Fast DOM update for instant responsiveness
    updateCardMetricsInDom(card);
  }

  function updateCardMetricsInDom(card) {
    const cardElem = document.getElementById(card.id);
    if (!cardElem) {
      renderCards();
      return;
    }

    const valNet = cardElem.querySelector('.val-net');

    if (valNet) {
      valNet.textContent = (card.net_sum > 0 ? '+' : '') + card.net_sum;
    }
  }

  function onDepartureTimeBlur(cardId, inputElem) {
    const card = state.activeCards.find(c => c.id === cardId);
    if (!card) return;
    card.departure_time = inputElem.value.trim();
    saveActiveCardsToStorage();
  }

  // =========================================================================
  // SUBMIT BUS RECORD WORKFLOW
  // =========================================================================

  function promptSubmitBus(cardId) {
    const card = state.activeCards.find(c => c.id === cardId);
    if (!card) return;

    state.pendingSubmitCardId = cardId;

    // Default departure time if not set
    const finalDepTime = card.departure_time && card.departure_time.trim() !== '' 
      ? card.departure_time 
      : formatCurrentTime();

    DOM.submitModalSummary.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong>Route:</strong> <span>#${escapeHtml(card.route_no)} (${escapeHtml(card.vehicle_no)})</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <strong>Times:</strong> <span>Arr: ${escapeHtml(card.arrival_time)} | Dep: ${escapeHtml(finalDepTime)}</span>
      </div>
      <div style="display:flex; justify-content:flex-end; font-weight:800; border-top:1px dashed #94a3b8; padding-top:6px;">
        <span>Net: <span>${card.net_sum}</span></span>
      </div>
    `;

    DOM.confirmSubmitModal.style.display = 'flex';
  }

  async function executeSubmitBusRecord() {
    const cardId = state.pendingSubmitCardId;
    if (!cardId) return;

    const card = state.activeCards.find(c => c.id === cardId);
    if (!card) {
      DOM.confirmSubmitModal.style.display = 'none';
      return;
    }

    // 1) If departure_time was not manually set, default to current time
    const finalDepTime = card.departure_time && card.departure_time.trim() !== ''
      ? card.departure_time
      : formatCurrentTime();

    // 2) Capture current date (YYYY-MM-DD)
    const surveyDate = formatCurrentDate();

    // 3) Package all card data + recorder_name into payload
    const payload = {
      recorder_name: state.recorderName || 'Surveyor Field',
      survey_date: surveyDate,
      route_no: card.route_no,
      vehicle_no: card.vehicle_no,
      route_text: card.route_text,
      ownership_type: card.ownership_type,
      service_type: card.service_type,
      seat_capacity_slot: card.seat_capacity_slot,
      location: card.location,
      arrival_time: card.arrival_time,
      departure_time: finalDepTime,
      net_sum: card.net_sum || 0
    };

    DOM.confirmSubmitModal.style.display = 'none';

    // 4) Send to backend/storage
    let submittedSuccessfully = false;
    try {
      const response = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        submittedSuccessfully = true;
        showToast(`Route ${card.route_no} record submitted to database!`, 'success');
      } else {
        throw new Error('Server returned ' + response.status);
      }
    } catch (err) {
      console.warn('Network or server error while submitting. Queuing offline:', err);
      // Offline fallback: save in offline queue
      state.offlineQueue.push({
        ...payload,
        queued_at: Date.now()
      });
      saveOfflineQueueToStorage();
      updateOfflineQueueDisplay();
      showToast(`Offline mode: Route ${card.route_no} queued locally. Will auto-sync when online.`, 'warning');
    }

    // 5) Remove card from active screen and free up the colour slot
    state.activeCards = state.activeCards.filter(c => c.id !== cardId);
    saveActiveCardsToStorage();
    renderCards();
    updateHeaderState();
  }

  // =========================================================================
  // OFFLINE SYNC MANAGEMENT
  // =========================================================================

  async function syncOfflineQueue() {
    if (!state.offlineQueue || state.offlineQueue.length === 0) {
      showToast('No pending offline submissions.', 'info');
      return;
    }

    if (!navigator.onLine) {
      showToast('Device is still offline. Connect to internet to sync.', 'warning');
      return;
    }

    showToast(`Syncing ${state.offlineQueue.length} offline records...`, 'info');

    try {
      const response = await fetch('/api/surveys/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveys: state.offlineQueue })
      });

      if (response.ok) {
        const count = state.offlineQueue.length;
        state.offlineQueue = [];
        saveOfflineQueueToStorage();
        updateOfflineQueueDisplay();
        showToast(`Successfully synced ${count} field records!`, 'success');
      } else {
        throw new Error('Batch sync failed');
      }
    } catch (err) {
      console.error('Failed to sync offline queue:', err);
      showToast('Sync failed. Will retry automatically when reconnected.', 'error');
    }
  }

  function updateOfflineQueueDisplay() {
    const count = state.offlineQueue.length;
    if (count > 0) {
      DOM.offlineQueueBadge.style.display = 'inline-block';
      DOM.offlineQueueBadge.textContent = count;
      DOM.offlineBanner.style.display = 'flex';
      DOM.offlineBannerText.textContent = `${count} pending offline survey(s) saved on this device.`;
    } else {
      DOM.offlineQueueBadge.style.display = 'none';
      if (state.isOnline) {
        DOM.offlineBanner.style.display = 'none';
      } else {
        DOM.offlineBanner.style.display = 'flex';
        DOM.offlineBannerText.textContent = 'Working Offline: Submissions queue locally & auto-sync when connected.';
      }
    }
  }

  function setupNetworkListeners() {
    function updateNetworkStatus() {
      state.isOnline = navigator.onLine;
      if (state.isOnline) {
        if (DOM.networkDot) DOM.networkDot.className = 'net-dot online';
        if (DOM.networkLabel) DOM.networkLabel.textContent = 'Online';
        if (DOM.networkStatusBtn) DOM.networkStatusBtn.title = 'Surveyor & Network: Online';
        if (state.offlineQueue.length > 0) {
          syncOfflineQueue();
        } else {
          DOM.offlineBanner.style.display = 'none';
        }
      } else {
        if (DOM.networkDot) DOM.networkDot.className = 'net-dot offline';
        if (DOM.networkLabel) DOM.networkLabel.textContent = 'Offline';
        if (DOM.networkStatusBtn) DOM.networkStatusBtn.title = 'Surveyor & Network: Offline (Click to sync)';
        DOM.offlineBanner.style.display = 'flex';
        DOM.offlineBannerText.textContent = 'Working Offline: Submissions queue locally & auto-sync when connected.';
      }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
  }

  // =========================================================================
  // RENDERING ACTIVE BUS CARDS
  // =========================================================================

  function renderCards() {
    if (!DOM.activeCardsContainer) return;

    if (state.activeCards.length === 0) {
      DOM.activeCardsContainer.innerHTML = '';
      DOM.emptyWorkspace.style.display = 'flex';
      return;
    }

    DOM.emptyWorkspace.style.display = 'none';

    // Sort by slot number for consistent visual layout
    const sortedCards = [...state.activeCards].sort((a, b) => a.slot - b.slot);

    DOM.activeCardsContainer.innerHTML = sortedCards.map(card => {
      const netDisplay = (card.net_sum > 0 ? '+' : '') + (card.net_sum || 0);

      return `
        <article class="bus-card slot-${card.slot}" id="${card.id}">
          <!-- Color-coded route top bar -->
          <div class="card-top">
            <span class="card-route-label">${escapeHtml(card.route_no)} · ${escapeHtml(card.route_text)}</span>
            <button type="button" class="card-edit-btn" onclick="window.TransitPulse.openEditBusModal('${card.id}')">Edit</button>
          </div>

          <!-- Net passenger count -->
          <div class="card-center">
            <div class="net-display">
              <span class="net-label">Net Count</span>
              <span class="net-value val-net">${netDisplay}</span>
            </div>
          </div>

          <!-- 4 large counter touch buttons -->
          <div class="counter-row">
            <button type="button" class="cnt-btn g" onclick="window.TransitPulse.adjustPassengerCount('${card.id}', 1)" aria-label="Add 1 boarding">+1</button>
            <button type="button" class="cnt-btn g" onclick="window.TransitPulse.adjustPassengerCount('${card.id}', 5)" aria-label="Add 5 boarding">+5</button>
            <button type="button" class="cnt-btn r" onclick="window.TransitPulse.adjustPassengerCount('${card.id}', -1)" aria-label="Add 1 alighting">-1</button>
            <button type="button" class="cnt-btn r" onclick="window.TransitPulse.adjustPassengerCount('${card.id}', -5)" aria-label="Add 5 alighting">-5</button>
          </div>

          <!-- Card footer -->
          <div class="card-bottom">
            <span class="card-meta-tiny">Arr: ${escapeHtml(card.arrival_time || '')}</span>
            <button type="button" class="card-submit-btn" onclick="window.TransitPulse.promptSubmitBus('${card.id}')">Submit</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function updateHeaderState() {
    const count = state.activeCards.length;

    // Slot count text (hidden but keep for backward compat)
    if (DOM.slotCountText) DOM.slotCountText.textContent = `${count}/${MAX_ACTIVE_CARDS}`;

    // Add New Bus Button state
    if (count >= MAX_ACTIVE_CARDS) {
      DOM.btnAddBus.disabled = true;
      DOM.btnAddBusLabel.textContent = 'Full';
      DOM.btnAddBus.title = 'Max 4 buses active';
    } else {
      DOM.btnAddBus.disabled = false;
      DOM.btnAddBusLabel.textContent = 'Add Bus';
      DOM.btnAddBus.title = 'Add a new bus';
    }
  }

  // =========================================================================
  // SUBMISSIONS HISTORY & STATS MODAL
  // =========================================================================

  async function openHistoryModal() {
    DOM.historyModal.style.display = 'flex';
    await refreshHistoryRecords();
  }

  function closeHistoryModal() {
    DOM.historyModal.style.display = 'none';
  }

  async function refreshHistoryRecords() {
    DOM.historyTableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:16px;">Loading records from database...</td></tr>`;

    try {
      const [surveysRes, statsRes] = await Promise.all([
        fetch('/api/surveys?limit=100'),
        fetch('/api/stats')
      ]);

      if (surveysRes.ok) {
        const data = await surveysRes.json();
        renderHistoryTable(data.surveys || []);
      }

      if (statsRes.ok) {
        const statData = await statsRes.json();
        const stats = statData.stats || {};
        DOM.statTotalBuses.textContent = stats.total_buses || 0;
        DOM.statTotalNet.textContent = stats.total_net_passengers || 0;
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      DOM.historyTableBody.innerHTML = `<tr><td colspan="9" style="padding:16px; color:#dc2626; text-align:center;">Failed to load records from server. (Are you offline?)</td></tr>`;
    }
  }

  function renderHistoryTable(surveys) {
    if (!surveys || surveys.length === 0) {
      DOM.historyTableBody.innerHTML = `<tr><td colspan="9" style="padding:20px; text-align:center; color:#64748b;">No survey records submitted yet.</td></tr>`;
      return;
    }

    DOM.historyTableBody.innerHTML = surveys.map(r => `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td>${escapeHtml(r.survey_date)}</td>
        <td><strong style="color:#2563eb;">${escapeHtml(r.route_no)}</strong></td>
        <td>${escapeHtml(r.vehicle_no)}</td>
        <td>${escapeHtml(r.ownership_type)}</td>
        <td>${escapeHtml(r.service_type)}</td>
        <td style="font-family:var(--font-mono); font-size:0.8rem;">${escapeHtml(r.arrival_time)}<br>${escapeHtml(r.departure_time)}</td>
        <td style="font-weight:900;">${(r.net_sum > 0 ? '+' : '') + r.net_sum}</td>
        <td style="font-size:0.8rem;">${escapeHtml(r.recorder_name)}</td>
      </tr>
    `).join('');
  }

  function initTheme() {
    // Pure light mode
    document.body.className = 'theme-light';
  }

  // =========================================================================
  // EVENT LISTENERS BINDING
  // =========================================================================

  function bindEvents() {
    // Add bus buttons
    DOM.btnAddBus.addEventListener('click', openAddBusModal);
    DOM.btnEmptyAddBus.addEventListener('click', openAddBusModal);

    // Modal buttons
    DOM.btnCloseBusModal.addEventListener('click', closeBusModal);
    DOM.btnCancelBusModal.addEventListener('click', closeBusModal);
    DOM.busForm.addEventListener('submit', saveBusCard);
    DOM.btnDeleteBusCard.addEventListener('click', deleteEditingCard);

    // Recorder Session
    DOM.btnResetRecorder.addEventListener('click', promptResetRecorder);
    DOM.btnCancelResetRecorder.addEventListener('click', () => {
      DOM.confirmResetModal.style.display = 'none';
    });
    DOM.btnConfirmResetRecorder.addEventListener('click', executeResetRecorder);

    // Submit Bus Record Confirmation
    DOM.btnCancelSubmitRecord.addEventListener('click', () => {
      DOM.confirmSubmitModal.style.display = 'none';
    });
    DOM.btnConfirmSubmitRecord.addEventListener('click', executeSubmitBusRecord);

    // History Modal
    DOM.btnOpenHistory.addEventListener('click', openHistoryModal);
    DOM.btnCloseHistoryModal.addEventListener('click', closeHistoryModal);
    DOM.btnRefreshHistory.addEventListener('click', refreshHistoryRecords);

    // Manual Sync Button
    DOM.btnManualSync.addEventListener('click', syncOfflineQueue);
    DOM.networkStatusBtn.addEventListener('click', () => {
      if (state.offlineQueue.length > 0) {
        syncOfflineQueue();
      } else {
        showToast(state.isOnline ? 'Network status: Online and ready.' : 'Network status: Offline. Data is safely cached in localStorage.', 'info');
      }
    });

    // Dropdown Menu handling
    if (DOM.btnToggleMenu && DOM.menuDropdown) {
      DOM.btnToggleMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = DOM.menuDropdown.style.display === 'flex';
        DOM.menuDropdown.style.display = isOpen ? 'none' : 'flex';
        DOM.btnToggleMenu.setAttribute('aria-expanded', !isOpen);
      });

      // Close dropdown when selecting an item
      DOM.menuDropdown.addEventListener('click', (e) => {
        if (e.target.classList.contains('menu-item')) {
          DOM.menuDropdown.style.display = 'none';
          DOM.btnToggleMenu.setAttribute('aria-expanded', 'false');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (DOM.menuContainer && !DOM.menuContainer.contains(e.target)) {
          DOM.menuDropdown.style.display = 'none';
          DOM.btnToggleMenu.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Close modals when clicking backdrop
    [DOM.busModal, DOM.confirmResetModal, DOM.confirmSubmitModal, DOM.historyModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  function init() {
    initDomElements();
    initTheme();
  try {
    state.recorderLocation = localStorage.getItem(STORAGE_KEYS.RECORDER_LOCATION) || '';
  } catch (error) {
    state.recorderLocation = '';
  }
    loadActiveCardsFromStorage();
    loadOfflineQueueFromStorage();
    updateOfflineQueueDisplay();
    setupNetworkListeners();
    bindEvents();
    renderCards();
    updateHeaderState();
    checkRecorderSession();

    // Register Service Worker for offline capability if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }

  // EXPOSE TO WINDOW FOR INLINE HANDLERS
  window.TransitPulse = {
    confirmRecorderName,
    setRecorderPreset: function (presetName) {
      if (DOM.recorderNameInput) {
        DOM.recorderNameInput.value = presetName;
      }
    },
    openEditBusModal,
    adjustPassengerCount,
    onDepartureTimeBlur,
    promptSubmitBus
  };
  window.PACE = window.TransitPulse;

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
